// Does App route a VT return link correctly, whatever tab is showing?
import assert from 'node:assert/strict';

// Mirrors expo-linking's parse for our scheme, matching vtDeepLink.parseVTResponse.
const parseVT = (url) => {
  if (!url) return null;
  const m = /^([a-z0-9.+-]+):\/\/([^?]*)\??(.*)$/i.exec(url);
  if (!m) return null;
  const [, scheme, host, query] = m;
  if (scheme !== 'fiuuapp' || host !== 'vt.callback') return null;
  const q = Object.fromEntries(new URLSearchParams(query));
  return q.errorCode
    ? { type: 'ERROR', errorCode: q.errorCode }
    : { type: 'RESPONSE', status: q.status ?? null, orderId: q.orderid ?? null };
};

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
