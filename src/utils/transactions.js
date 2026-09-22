/**
 * Reads the transaction list recorded by the fiuu-notify webhook.
 *
 * These are payments Fiuu notified us about, not the app's own record of what
 * it tried. A transaction only appears here if Fiuu sent a webhook for it, so
 * anything that predates the webhook going live will be missing - see the
 * README for backfilling those through Fiuu's requery API.
 */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, FIUU_APP_TOKEN } from '@env';

const FUNCTION_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/fiuu-notify`
  : null;

/** '00' paid, '11' declined, '22' pending, '-1' signature failed. */
export const TRANSACTION_STATUS = {
  '00': { label: 'PAID', color: '#28a745' },
  '11': { label: 'FAILED', color: '#dc3545' },
  '22': { label: 'PENDING', color: '#ffc107' },
  '-1': { label: 'UNVERIFIED', color: '#6f42c1' },
};

export const describeStatus = (status) =>
  TRANSACTION_STATUS[status] || { label: status || 'UNKNOWN', color: '#6c757d' };

/**
 * @returns {Promise<{ok: boolean, transactions: object[], error?: string}>}
 */
export async function fetchTransactions({ limit = 100 } = {}) {
  if (!FUNCTION_URL) {
    return { ok: false, transactions: [], error: 'SUPABASE_URL not set' };
  }
  if (!FIUU_APP_TOKEN) {
    return { ok: false, transactions: [], error: 'FIUU_APP_TOKEN not set' };
  }

  try {
    const response = await fetch(`${FUNCTION_URL}?list=1&limit=${limit}`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY || '',
        'x-app-token': FIUU_APP_TOKEN,
      },
    });

    if (response.status === 401) {
      return { ok: false, transactions: [], error: 'Rejected: app token does not match the server' };
    }
    if (!response.ok) {
      return { ok: false, transactions: [], error: `HTTP ${response.status}` };
    }

    const body = await response.json();
    return { ok: true, transactions: body.transactions || [] };
  } catch (err) {
    return { ok: false, transactions: [], error: String(err?.message || err) };
  }
}

/** '2026-09-22T09:37:36+00:00' -> '22 Sep 2026, 09:37'. Falls back to the raw value. */
export function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
