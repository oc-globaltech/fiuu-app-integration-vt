/**
 * Fiuu payment status webhook.
 *
 * POST  - Fiuu's Notify URL / Callback URL. Verifies skey, upserts the payment.
 * GET   - ?order_id=... so the app can confirm a payment was actually recorded.
 *         ?list=1[&sync=1] for the app's transaction list; sync first pulls
 *         Fiuu's Daily Transaction Report so VT payments (which never send a
 *         notification) and later voids show up.
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
import { fromMyt, mytDate, paymentsFromReport, reportUrl } from './report.ts';

const SECRET_KEY = Deno.env.get('FIUU_SECRET_KEY') ?? '';
const MERCHANT_ID = Deno.env.get('FIUU_MERCHANT_ID') ?? '';
// Sandbox merchants must ACK to the sandbox host.
const ACK_URL = Deno.env.get('FIUU_ACK_URL') ??
  'https://pay.fiuu.com/RMS/API/chkstat/returnipn.php';
// Sandbox merchants: https://sandbox-api.fiuu.com
const API_BASE = Deno.env.get('FIUU_API_BASE') ?? 'https://api.fiuu.com';
const SYNC_DAYS = 7;
// Fiuu blocks "excessive and rapid" report calls without notice (spec v13.93),
// and the VT screen polls every few seconds.
// ponytail: per-isolate throttle; move lastSync into a table if cold starts pile up.
const SYNC_MIN_MS = 60_000;
let lastSync = 0;

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

/**
 * Upsert Fiuu's own record of the last `days` days (Malaysia time) over ours.
 * Returns an error message instead of throwing, so a Fiuu outage never hides
 * the rows we already have.
 */
async function syncFromFiuu(days: number): Promise<string | null> {
  if (!MERCHANT_ID || !SECRET_KEY) return 'FIUU_MERCHANT_ID / FIUU_SECRET_KEY not set';
  if (Date.now() - lastSync < SYNC_MIN_MS) return null;
  lastSync = Date.now();
  try {
    const res = await fetch(reportUrl(API_BASE, MERCHANT_ID, SECRET_KEY, mytDate(days), days + 1));
    const text = await res.text();
    let report: unknown;
    try {
      report = JSON.parse(text);
    } catch {
      return `Fiuu report: ${text.slice(0, 200)}`;
    }
    // ponytail: first page only; add `page` looping past a few hundred txns a week.
    if (!Array.isArray(report)) return `Fiuu report: ${JSON.stringify(report).slice(0, 200)}`;
    const rows = paymentsFromReport(report);
    if (!rows.length) return null;
    const { error } = await db.from('fiuu_payments').upsert(rows, { onConflict: 'order_id' });
    return error ? error.message : null;
  } catch (err) {
    return `Fiuu report: ${err instanceof Error ? err.message : String(err)}`;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    const url = new URL(req.url);

    // Operator-only listing, for answering "did Fiuu ever call us?". Guarded by
    // a shared secret because this endpoint is public (Fiuu cannot send a JWT).
    const debugToken = Deno.env.get('FIUU_DEBUG_TOKEN');
    if (debugToken && url.searchParams.get('debug') === debugToken) {
      const wanted = url.searchParams.get('order_id');
      if (wanted) {
        const { data } = await db
          .from('fiuu_payments').select('*').eq('order_id', wanted).maybeSingle();
        return Response.json({ payment: data ?? null });
      }
      const { data } = await db
        .from('fiuu_payments')
        .select('order_id, txn_id, status, amount, channel, verified, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      return Response.json({ count: data?.length ?? 0, recent: data ?? [] });
    }

    // Transaction list for the app. The endpoint is public (Fiuu cannot send a
    // JWT), so it is gated on a shared token the app carries. That token ships
    // in the bundle and is extractable - see the README security note - so this
    // exposes the merchant's own transaction list. It never exposes card data,
    // which Fiuu does not send here.
    if (url.searchParams.get('list') === '1') {
      const appToken = Deno.env.get('FIUU_APP_TOKEN');
      if (!appToken || req.headers.get('x-app-token') !== appToken) {
        return Response.json({ error: 'unauthorised' }, { status: 401 });
      }
      const syncError = url.searchParams.get('sync') === '1' ? await syncFromFiuu(SYNC_DAYS) : null;
      if (syncError) console.error('fiuu sync failed', syncError);
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 100) || 100, 200);
      const { data, error } = await db
        .from('fiuu_payments')
        .select('order_id, txn_id, status, stat_name, amount, currency, channel, paydate, verified, created_at')
        .order('paydate', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ count: data?.length ?? 0, transactions: data ?? [], syncError });
    }

    const orderId = url.searchParams.get('order_id');
    // Fiuu's portal "Check" button probes the endpoint with no parameters and
    // treats any non-2xx as a failure, so a bare GET must answer 200.
    if (!orderId) {
      return Response.json({ ok: true, endpoint: 'fiuu-notify' });
    }
    const lookup = () => db
      .from('fiuu_payments')
      .select('order_id, txn_id, status, stat_name, amount, currency, channel, paydate, verified')
      .eq('order_id', orderId)
      .maybeSingle();
    let { data } = await lookup();
    // VT card-present payments never notify us; ask Fiuu before saying no.
    if (!data) {
      await syncFromFiuu(1);
      ({ data } = await lookup());
    }

    // Unverified rows are not evidence of payment.
    const paid = !!data && data.verified && data.status === '00';
    return Response.json({ paid, payment: data ?? null });
  }

  // Operator-only cleanup, so the end-to-end test can remove the rows it makes
  // instead of leaving test data among real payments. Gated on the same debug
  // secret as the listing, and inert unless that secret is set.
  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const debugToken = Deno.env.get('FIUU_DEBUG_TOKEN');
    const orderId = url.searchParams.get('order_id');
    if (!debugToken || url.searchParams.get('debug') !== debugToken) {
      return Response.json({ error: 'unauthorised' }, { status: 401 });
    }
    if (!orderId) {
      return Response.json({ error: 'order_id required' }, { status: 400 });
    }
    const { error } = await db.from('fiuu_payments').delete().eq('order_id', orderId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ deleted: orderId });
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
    stat_name: null,
    amount: p.amount ? Number(p.amount) : null,
    currency: p.currency ?? null,
    channel: p.channel ?? null,
    paydate: fromMyt(p.paydate),
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
