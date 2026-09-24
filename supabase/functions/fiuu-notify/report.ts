import { createHash } from 'node:crypto';

const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');

export type ReportRow = Record<string, string>;

/** Fiuu stamps every time in Malaysia time (UTC+8) with no offset. */
export const fromMyt = (s?: string) => (s ? `${s.trim().replace(' ', 'T')}+08:00` : null);

/** YYYY-MM-DD in Malaysia time, `daysAgo` days before `now`. */
export function mytDate(daysAgo: number, now = Date.now()): string {
  return new Date(now + 8 * 3600e3 - daysAgo * 86400e3).toISOString().slice(0, 10);
}

/**
 * Daily Transaction Report (API spec v13.93, psq-daily.php).
 * skey = md5(rdate + merchantID + secret_key)
 */
export function reportUrl(base: string, merchantId: string, secretKey: string, rdate: string, days: number) {
  const q = new URLSearchParams({
    merchantID: merchantId,
    skey: md5(`${rdate}${merchantId}${secretKey}`),
    rdate,
    rduration: String(days * 86400),
    version: '4.0',
    response_type: 'json',
  });
  return `${base}/RMS/API/PSQ/psq-daily.php?${q}`;
}

/**
 * Report rows -> fiuu_payments rows, one per order. The report runs oldest
 * first, so a later row for the same order (a void after a capture) wins.
 */
export function paymentsFromReport(rows: ReportRow[]) {
  const byOrder = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    if (!r?.OrderID) continue;
    byOrder.set(r.OrderID, {
      order_id: r.OrderID,
      txn_id: r.TranID ?? null,
      status: r.StatCode ?? '',
      stat_name: r.StatName ?? null,
      amount: r.Amount ? Number(r.Amount) : null,
      currency: r.Currency ?? null,
      channel: r.Channel ?? null,
      paydate: fromMyt(r.BillingDate),
      // Fetched from Fiuu over TLS with our secret key: as trustworthy as a
      // signed notification.
      verified: true,
      raw: r,
      updated_at: new Date().toISOString(),
    });
  }
  return [...byOrder.values()];
}
