// Run: node src/utils/paymentResult.test.mjs
import assert from 'node:assert/strict';
import { parsePaymentResult } from './paymentResult.js';

const check = (raw, expected, label) => {
  const got = parsePaymentResult(raw);
  assert.equal(got.status, expected, `${label}: expected ${expected}, got ${got.status}`);
  return got;
};

// iOS: JSON string nested under transactionResult (the shape that broke the UI)
const ok = check(
  { transactionResult: '{"status_code":"00","txn_ID":"T123","order_id":"ORDER-1","amount":"1.10"}' },
  'SUCCESS', 'ios nested success');
assert.equal(ok.txnId, 'T123');
assert.equal(ok.orderId, 'ORDER-1');
assert.equal(ok.amount, '1.10');

// Plain JSON string (Android / docs' Expo example)
check('{"status_code":"11","err_desc":"Declined"}', 'FAILED', 'declined');
check('{"status_code":"22"}', 'PENDING', 'pending cash channel');

// Google Pay field casing
const gp = check({ transactionResult: '{"StatCode":"00","TranID":"G9","Amount":"5.00"}' },
  'SUCCESS', 'google pay casing');
assert.equal(gp.txnId, 'G9');

// The real sandbox failure seen on device
const err = check(
  { transactionResult: '{"Error":"Communication Error, please check internet connection, username, or password"}' },
  'FAILED', 'server error payload');
assert.match(err.message, /Communication Error/);

// Cancellation comes back as a bare string, not JSON
check({ transactionResult: 'User Cancelled' }, 'CANCELLED', 'user cancelled');
check('User Cancelled', 'CANCELLED', 'bare cancelled string');

// Garbage must never read as success
check('not json at all', 'FAILED', 'unparseable');
check({}, 'FAILED', 'empty object');
check(null, 'FAILED', 'null');
check({ transactionResult: '{"unexpected":true}' }, 'FAILED', 'no status code');

console.log('paymentResult: all assertions passed');
