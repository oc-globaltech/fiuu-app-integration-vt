// Run: deno test supabase/functions/fiuu-notify/report_test.ts
import { assertEquals } from 'jsr:@std/assert@1';
import { fromMyt, mytDate, paymentsFromReport, reportUrl } from './report.ts';

Deno.test('Fiuu times are Malaysia time', () => {
  assertEquals(new Date(fromMyt('2026-09-22 09:40:17')!).toISOString(), '2026-09-22T01:40:17.000Z');
  assertEquals(fromMyt(''), null);
});

Deno.test('report date rolls over at Malaysian midnight', () => {
  const at = Date.parse('2026-09-23T17:00:00Z'); // 01:00 on the 24th in MYT
  assertEquals(mytDate(0, at), '2026-09-24');
  assertEquals(mytDate(7, at), '2026-09-17');
});

Deno.test('skey = md5(rdate + merchantID + secret_key)', () => {
  const u = new URL(reportUrl('https://api.fiuu.com', 'M1', 'S', '2026-09-22', 7));
  // md5('2026-09-22M1S')
  assertEquals(u.searchParams.get('skey'), '8ee60cc5b3b7214b2df768931d691206');
  assertEquals(u.searchParams.get('rduration'), '604800');
});

Deno.test('latest row per order wins', () => {
  const rows = paymentsFromReport([
    { OrderID: 'VT-1', TranID: '1', StatCode: '00', StatName: 'captured', Amount: '1.01', BillingDate: '2026-09-22 09:12:00' },
    { OrderID: 'VT-1', TranID: '1', StatCode: '11', StatName: 'cancelled', Amount: '1.01', BillingDate: '2026-09-22 09:13:00' },
    { OrderID: 'VT-2', TranID: '2', StatCode: '00', StatName: 'captured', Amount: '2.00' },
    { TranID: 'no-order' },
  ]);
  assertEquals(rows.length, 2);
  assertEquals(rows[0].status, '11');
  assertEquals(rows[0].stat_name, 'cancelled');
  assertEquals(rows[0].amount, 1.01);
  assertEquals(rows[1].paydate, null);
});
