/**
 * Reads the transaction list kept by the fiuu-notify function.
 *
 * Rows come from Fiuu's webhooks plus a sync against Fiuu's Daily Transaction
 * Report (last 7 days) run on every fetch, so VT card-present payments - which
 * never notify - and later voids show Fiuu's current status.
 */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, FIUU_APP_TOKEN } from '@env';

const FUNCTION_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/fiuu-notify`
  : null;

/** '00' paid, '11' declined, '22' pending, '-1' signature failed. */
export const TRANSACTION_STATUS = {
  '00': { label: 'PAID', color: '#8ed462' },
  '11': { label: 'FAILED', color: '#ff705d' },
  '22': { label: 'PENDING', color: '#f5e211' },
  '-1': { label: 'UNVERIFIED', color: '#2ba0ff' },
};

const NEUTRAL = '#e0dbce';
// Fiuu's StatName says more than StatCode: a voided sale is '11' like a
// decline, but it is not a failure.
const NAME_COLOR = { cancelled: NEUTRAL, release: NEUTRAL, chargeback: '#ff705d' };

export function describeStatus(status, statName) {
  const byCode = TRANSACTION_STATUS[status] || { label: status || 'UNKNOWN', color: NEUTRAL };
  if (!statName) return byCode;
  const name = statName.toLowerCase();
  return { label: name.toUpperCase(), color: NAME_COLOR[name] || byCode.color };
}

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
    const response = await fetch(`${FUNCTION_URL}?list=1&sync=1&limit=${limit}`, {
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
    return {
      ok: true,
      transactions: body.transactions || [],
      // The list still loads from our copy when Fiuu's report is unreachable.
      warning: body.syncError ? `Could not refresh from Fiuu: ${body.syncError}` : null,
    };
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
