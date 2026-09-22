// Run: node src/utils/pendingOrder.test.mjs
// Exercises the pending-order rules against an in-memory stand-in for the
// expo-file-system File, which cannot run outside the app.
import assert from 'node:assert/strict';

const MAX_AGE_MS = 60 * 60 * 1000;

function makeStore() {
  let content = null;      // null = file does not exist
  let throwOnRead = false;
  return {
    set: (v) => { content = v; },
    breakReads: () => { throwOnRead = true; },
    get exists() { return content !== null; },
    write(v) { content = v; },
    textSync() { if (throwOnRead) throw new Error('unreadable'); return content; },
    delete() { content = null; },
  };
}

// Mirrors readPendingOrder / savePendingOrder / clearPendingOrder.
function makeApi(file, now = () => Date.now()) {
  const clear = () => { try { if (file.exists) file.delete(); return true; } catch { return false; } };
  return {
    save(orderId) {
      if (!orderId) return false;
      try { file.write(JSON.stringify({ orderId, startedAt: now() })); return true; } catch { return false; }
    },
    read() {
      try {
        if (!file.exists) return null;
        const parsed = JSON.parse(file.textSync());
        if (!parsed?.orderId) return null;
        const startedAt = Number(parsed.startedAt) || 0;
        if (now() - startedAt > MAX_AGE_MS) { clear(); return null; }
        return { orderId: String(parsed.orderId), startedAt };
      } catch { clear(); return null; }
    },
    clear,
  };
}

// Nothing stored yet.
let f = makeStore(); let api = makeApi(f);
assert.equal(api.read(), null, 'no file -> null');

// Round trip: this is the case that rescues a lost tap.
assert.equal(api.save('VT-123'), true);
assert.equal(api.read().orderId, 'VT-123', 'must survive a restart');

// Cleared once confirmed.
api.clear();
assert.equal(api.read(), null, 'cleared -> null');

// Expiry: an hour-old order is stale and must not resurrect.
f = makeStore();
let clock = 1_000_000;
api = makeApi(f, () => clock);
api.save('VT-OLD');
clock += MAX_AGE_MS + 1;
assert.equal(api.read(), null, 'expired -> null');
assert.equal(f.exists, false, 'expired entry must be cleared, not left to retry');

// Just inside the window still counts.
f = makeStore(); clock = 1_000_000; api = makeApi(f, () => clock);
api.save('VT-FRESH');
clock += MAX_AGE_MS - 1000;
assert.equal(api.read().orderId, 'VT-FRESH', 'within the window -> returned');

// Corrupt JSON must not throw, and must not be retried forever.
f = makeStore(); api = makeApi(f);
f.set('{not json');
assert.equal(api.read(), null, 'corrupt -> null');
assert.equal(f.exists, false, 'corrupt entry must be dropped');

// Valid JSON missing the order id.
f = makeStore(); api = makeApi(f);
f.set(JSON.stringify({ startedAt: Date.now() }));
assert.equal(api.read(), null, 'no orderId -> null');

// A read that throws must be survivable.
f = makeStore(); api = makeApi(f);
api.save('VT-X');
f.breakReads();
assert.equal(api.read(), null, 'unreadable -> null, no throw');

// Empty or missing ids are never stored.
f = makeStore(); api = makeApi(f);
assert.equal(api.save(''), false);
assert.equal(api.save(null), false);
assert.equal(api.read(), null);

// Missing startedAt is treated as epoch, hence stale - never as fresh.
f = makeStore(); api = makeApi(f);
f.set(JSON.stringify({ orderId: 'VT-NO-TIME' }));
assert.equal(api.read(), null, 'missing startedAt must not read as fresh');

console.log('pendingOrder: all assertions passed');
