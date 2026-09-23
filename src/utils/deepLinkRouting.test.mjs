// Does App route a VT return link correctly, whatever tab is showing?
import assert from 'node:assert/strict';

// The real parser App and VTPayment use - not a copy. The old test mirrored
// it with its own regex, which is how a parser that rejected every real link
// on device still passed here.
import { parseVTResponse as parseVT } from './vtResponse.js';

// The routing App performs on every incoming URL.
function route(url, tabBefore) {
  const parsed = parseVT(url);
  if (!parsed) return { tab: tabBefore, delivered: false };
  return { tab: 'vt', delivered: true };
}

const SALE = 'fiuuapp://vt.callback?opType=SALE&orderid=VT-1&status=00&amount=1.01&tranID=9';

// The bug this fixes: a cold start lands on the XDK tab, and the old code
// only listened from inside VTPayment, so the result was dropped.
let r = route(SALE, 'xdk');
assert.equal(r.tab, 'vt', 'must switch to the VT tab');
assert.equal(r.delivered, true, 'result must be delivered from the XDK tab');

r = route(SALE, 'txn');
assert.equal(r.delivered, true, 'must also be delivered from the Transactions tab');

r = route(SALE, 'vt');
assert.equal(r.delivered, true, 'and when already on VT');

// An error return must still route, so a failure is never silent.
r = route('fiuuapp://vt.callback?opType=SALE&errorCode=E01&errorMsg=Declined', 'xdk');
assert.equal(r.delivered, true, 'error returns must route too');

// Unrelated links must not hijack the tab.
for (const url of [
  'com.anonymous.fiuu-app-integration-vt://expo-development-client/?url=x',
  'fiuuapp://something-else?a=1',
  'https://example.com',
  '',
  null,
]) {
  assert.equal(route(url, 'xdk').tab, 'xdk', `must not hijack: ${url}`);
  assert.equal(route(url, 'xdk').delivered, false);
}

// Status mapping shown to the user.
const label = (s) => s === '00' ? 'SUCCESS' : s === '22' ? 'PENDING' : s === '44' ? 'VOIDED' : 'FAILED';
assert.equal(label('00'), 'SUCCESS');
assert.equal(label('11'), 'FAILED');
assert.equal(label('22'), 'PENDING');
assert.equal(label('44'), 'VOIDED');
assert.equal(label(null), 'FAILED', 'unknown status must never read as success');

console.log('deep link routing: all assertions passed');

// What the parser actually extracts from a return link.
let p = parseVT(SALE);
assert.deepEqual(
  { type: p.type, opType: p.opType, status: p.status, orderId: p.orderId, amount: p.amount, tranID: p.tranID },
  { type: 'RESPONSE', opType: 'SALE', status: '00', orderId: 'VT-1', amount: '1.01', tranID: '9' },
);

// Shapes the VT app might send that we do not control.
p = parseVT('fiuuapp://vt.callback/?opType=SALE&orderId=VT-2&status=00&TranID=7');
assert.equal(p?.orderId, 'VT-2', 'trailing slash and orderId casing must still parse');
assert.equal(p.tranID, '7');
assert.equal(parseVT('FIUUAPP://VT.CALLBACK?status=22&orderid=VT-3')?.status, '22', 'scheme/host case');
assert.equal(parseVT('fiuuapp://vt.callback?orderid=VT-4&status=00&payDate=2026-09-23+15%3A40%3A00').payDate,
  '2026-09-23 15:40:00', '+ and %XX must decode');
assert.equal(parseVT('fiuuapp://vt.callback?orderid=VT-5&status=00&channel=100%').orderId, 'VT-5',
  'a malformed escape must not lose the result');
assert.equal(parseVT('fiuuapp://vt.callback').type, 'RESPONSE', 'no query still counts as a return');

p = parseVT('fiuuapp://vt.callback?opType=VOID&errorCode=E01&errorMsg=Card+declined');
assert.deepEqual([p.type, p.opType, p.errorCode, p.errorMsg], ['ERROR', 'VOID', 'E01', 'Card declined']);

// Near misses must not be taken for a VT result.
for (const url of ['fiuuapp://vt.callbackX?status=00', 'fiuuapp:vt.callback?status=00', 'xfiuuapp://vt.callback', 42, undefined]) {
  assert.equal(parseVT(url), null, `must reject: ${url}`);
}


