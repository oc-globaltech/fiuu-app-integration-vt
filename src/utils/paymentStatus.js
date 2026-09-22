/**
 * Confirms a payment against our own server rather than the client result.
 *
 * Fiuu's docs are explicit: "Never trust client-side success alone - always
 * verify the checksum on your backend." The XDK callback tells us what the
 * device saw; this tells us what Fiuu actually notified and what we recorded.
 *
 * The webhook is server-to-server and can land after the app regains focus,
 * so a miss is normal for a second or two - hence the retries.
 */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@env';

const FUNCTION_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/fiuu-notify`
  : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @returns {Promise<{state: 'confirmed'|'recorded'|'pending'|'unavailable',
 *                    paid: boolean, payment: object|null, error?: string}>}
 *   confirmed   - Fiuu notified us and the skey verified; the payment is real.
 *   recorded    - a row exists but is not a verified success (failed/pending/forged).
 *   pending     - nothing recorded yet; the webhook has not arrived.
 *   unavailable - we could not reach the server; says nothing about the payment.
 */
export async function confirmPayment(
  orderId,
  { attempts = 4, delayMs = 2000, maxDelayMs = 8000 } = {},
) {
  if (!FUNCTION_URL) {
    return { state: 'unavailable', paid: false, payment: null, error: 'SUPABASE_URL not set' };
  }

  let lastError;

  for (let attempt = 0; attempt < attempts; attempt++) {
    // Back off, but cap it so long polls stay responsive rather than
    // stretching to minutes between checks.
    if (attempt > 0) await sleep(Math.min(delayMs * attempt, maxDelayMs));

    try {
      const response = await fetch(
        `${FUNCTION_URL}?order_id=${encodeURIComponent(orderId)}`,
        { headers: { apikey: SUPABASE_PUBLISHABLE_KEY || '' } },
      );

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }

      const body = await response.json();
      if (body.paid) return { state: 'confirmed', paid: true, payment: body.payment };
      if (body.payment) return { state: 'recorded', paid: false, payment: body.payment };
      // No row yet - keep waiting for the webhook.
    } catch (err) {
      lastError = String(err?.message || err);
    }
  }

  return lastError
    ? { state: 'unavailable', paid: false, payment: null, error: lastError }
    : { state: 'pending', paid: false, payment: null };
}
