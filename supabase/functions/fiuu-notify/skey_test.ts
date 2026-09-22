// Run: deno test supabase/functions/fiuu-notify/skey_test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { computeSkey, verifySkey } from './skey.ts';

const SECRET = 'test_secret_key';
const base = {
  tranID: '1234567890',
  orderid: 'ORDER-1',
  status: '00',
  domain: 'SB_demo',
  amount: '1.10',
  currency: 'MYR',
  paydate: '2026-09-22 10:00:00',
  appcode: 'A1B2C3',
};

Deno.test('a correctly signed notification verifies', () => {
  const p = { ...base, skey: computeSkey(base, SECRET) };
  assert(verifySkey(p, SECRET));
});

Deno.test('skey is case-insensitive', () => {
  const p = { ...base, skey: computeSkey(base, SECRET).toUpperCase() };
  assert(verifySkey(p, SECRET));
});

Deno.test('tampering with any signed field is rejected', () => {
  const skey = computeSkey(base, SECRET);
  for (const field of ['tranID', 'orderid', 'status', 'domain', 'amount', 'currency', 'paydate', 'appcode']) {
    const p = { ...base, [field]: 'tampered', skey };
    assertEquals(verifySkey(p, SECRET), false, `${field} tampering not caught`);
  }
});

Deno.test('amount tampering is caught (the attack that matters)', () => {
  const p = { ...base, amount: '9999.00', skey: computeSkey(base, SECRET) };
  assertEquals(verifySkey(p, SECRET), false);
});

Deno.test('wrong secret is rejected', () => {
  const p = { ...base, skey: computeSkey(base, SECRET) };
  assertEquals(verifySkey(p, 'wrong_secret'), false);
});

Deno.test('missing skey or secret never passes', () => {
  assertEquals(verifySkey({ ...base }, SECRET), false);
  assertEquals(verifySkey({ ...base, skey: computeSkey(base, SECRET) }, ''), false);
});
