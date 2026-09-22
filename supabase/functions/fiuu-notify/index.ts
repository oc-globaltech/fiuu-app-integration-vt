/**
 * Fiuu payment status webhook.
 *
 * POST  - Fiuu's Notify URL / Callback URL. Verifies skey, upserts the payment.
 * GET   - ?order_id=... so the app can confirm a payment was actually recorded.
 *
 * Deploy with verify_jwt = false: Fiuu cannot send a Supabase JWT. Authenticity
 * comes from the skey hash, which only someone holding the merchant secret key
 * can produce. Never ship FIUU_SECRET_KEY to the app.
 *
 * skey (https://e2payprod.gitbook.io/payment-gateway/api-documentation/
 *       technical-doc-of-fiuu-id/payment-response-parameter/
 *       payment-status-notification-merchant-webhook-or-the-3-endpoints):
 *   key0 = md5(tranID + orderid + status + domain + amount + currency)
 *   key1 = md5(paydate + domain + key0 + appcode + secret_key)
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifySkey } from './skey.ts';

const SECRET_KEY = Deno.env.get('FIUU_SECRET_KEY') ?? '';
const MERCHANT_ID = Deno.env.get('FIUU_MERCHANT_ID') ?? '';
// Sandbox merchants must ACK to the sandbox host.
const ACK_URL = Deno.env.get('FIUU_ACK_URL') ??
  'https://pay.fiuu.com/RMS/API/chkstat/returnipn.php';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

/** Fiuu posts form-encoded; tolerate JSON so the endpoint is testable by hand. */
async function readParams(req: Request): Promise<Record<string, string>> {
  const body = await req.text();
  const type = req.headers.get('content-type') ?? '';

  if (type.includes('application/json')) {
    try {
      const parsed = JSON.parse(body);
      return Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [k, v == null ? '' : String(v)]),
      );
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(body));
}

/** Notify URL with IPN: echo every POST var back plus treq=1. Best effort. */
async function acknowledge(p: Record<string, string>): Promise<void> {
  try {
    const form = new URLSearchParams(p);
    form.set('treq', '1');
    await fetch(ACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
  } catch (err) {
    // A failed ACK only costs us a retry; never fail the webhook over it.
    console.error('fiuu ack failed', err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    const orderId = new URL(req.url).searchParams.get('order_id');
    if (!orderId) {
      return Response.json({ error: 'order_id required' }, { status: 400 });
    }
    const { data } = await db
      .from('fiuu_payments')
      .select('order_id, txn_id, status, amount, currency, channel, paydate, verified')
      .eq('order_id', orderId)
      .maybeSingle();

    // Unverified rows are not evidence of payment.
    const paid = !!data && data.verified && data.status === '00';
    return Response.json({ paid, payment: data ?? null });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const p = await readParams(req);
  if (!p.orderid) {
    return new Response('CBTOKEN:MPSTATOK', {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const verified = verifySkey(p, SECRET_KEY);
  if (!verified) {
    console.error('fiuu skey mismatch', { orderid: p.orderid, tranID: p.tranID });
  }
  if (MERCHANT_ID && p.domain && p.domain !== MERCHANT_ID) {
    console.error('fiuu domain mismatch', { got: p.domain });
  }

  // status -1 marks a notification we could not authenticate (Fiuu's convention).
  const status = verified ? (p.status ?? '') : '-1';

  const { error } = await db.from('fiuu_payments').upsert({
    order_id: p.orderid,
    txn_id: p.tranID ?? null,
    status,
    amount: p.amount ? Number(p.amount) : null,
    currency: p.currency ?? null,
    channel: p.channel ?? null,
    paydate: p.paydate ? p.paydate.replace(' ', 'T') : null,
    appcode: p.appcode ?? null,
    error_code: p.error_code ?? null,
    error_desc: p.error_desc ?? null,
    verified,
    raw: p,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'order_id' });

  if (error) {
    // Do not ACK - let Fiuu retry rather than lose the notification.
    console.error('fiuu upsert failed', error);
    return new Response('error', { status: 500 });
  }

  if (verified) await acknowledge(p);

  // Callback URL with IPN expects this exact plaintext.
  return new Response('CBTOKEN:MPSTATOK', {
    headers: { 'Content-Type': 'text/plain' },
  });
});
