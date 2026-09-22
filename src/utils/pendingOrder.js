/**
 * Remembers which order we are waiting on, across app restarts.
 *
 * A card tap hands the phone to the Fiuu VT app, and iOS is free to reclaim us
 * while it is in front. In-memory state does not survive that. If the return
 * deep link also fails to arrive, nothing would tell the app to go and confirm
 * the payment - the card was charged and the app would never notice.
 *
 * Writing the order to disk closes that: on any start, if a pending order is
 * still there, we ask the server what Fiuu notified about it.
 *
 * Stored in the document directory (survives restarts; not purged like cache).
 * Every call is wrapped: losing this file must never break a payment screen.
 */
import { File, Paths } from 'expo-file-system';

const FILENAME = 'pending-order.json';

/** Beyond this the order is stale - the payment is long settled either way. */
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

const handle = () => new File(Paths.document, FILENAME);

export function savePendingOrder(orderId) {
  if (!orderId) return false;
  try {
    handle().write(JSON.stringify({ orderId, startedAt: Date.now() }));
    return true;
  } catch (err) {
    console.warn('pendingOrder: save failed', err);
    return false;
  }
}

/**
 * @returns {{orderId: string, startedAt: number}|null} the outstanding order,
 *   or null if there is none, it cannot be read, or it has expired. An expired
 *   entry is cleared as a side effect so it is not reconsidered.
 */
export function readPendingOrder() {
  try {
    const file = handle();
    if (!file.exists) return null;

    const parsed = JSON.parse(file.textSync());
    if (!parsed?.orderId) return null;

    const startedAt = Number(parsed.startedAt) || 0;
    if (Date.now() - startedAt > MAX_AGE_MS) {
      clearPendingOrder();
      return null;
    }
    return { orderId: String(parsed.orderId), startedAt };
  } catch (err) {
    // Corrupt or unreadable: drop it rather than retrying forever.
    console.warn('pendingOrder: read failed', err);
    clearPendingOrder();
    return null;
  }
}

export function clearPendingOrder() {
  try {
    const file = handle();
    if (file.exists) file.delete();
    return true;
  } catch (err) {
    console.warn('pendingOrder: clear failed', err);
    return false;
  }
}
