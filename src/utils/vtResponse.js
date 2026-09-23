/**
 * Parses the link the Fiuu VT app opens to hand a result back to us:
 *   fiuuapp://vt.callback?opType=SALE&status=00&orderid=...&tranID=...
 *
 * Deliberately not expo-linking's parse. That goes through React Native's URL
 * class, which only extracts a host and path from http(s) URLs - for
 * fiuuapp://vt.callback it reports an empty path, so every return link was
 * rejected and dropped. No imports here, so the test runs this exact code.
 */

export const MERCHANT_URL_SCHEME = 'fiuuapp';
export const MERCHANT_HOST = 'vt.callback';

const decode = (s) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s; // a stray % must not throw away the whole result
  }
};

/**
 * @param {string} url - The incoming deep link URL
 * @returns {Object|null} Parsed response, or null if it is not a VT return link
 */
export function parseVTResponse(url) {
  if (typeof url !== 'string') return null;

  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)\/?(?:\?([^#]*))?/i.exec(url.trim());
  if (
    !match
    || match[1].toLowerCase() !== MERCHANT_URL_SCHEME
    || match[2].toLowerCase() !== MERCHANT_HOST
  ) {
    return null;
  }

  // Keys lowercased: the VT app's casing (orderid, tranID, payDate) is not
  // something we control, and a mismatch would silently lose the order ID.
  const query = {};
  for (const pair of (match[3] || '').split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = decode(eq < 0 ? pair : pair.slice(0, eq)).toLowerCase();
    query[key] = decode(eq < 0 ? '' : pair.slice(eq + 1));
  }

  if (query.errorcode) {
    return {
      type: 'ERROR',
      opType: query.optype || null,
      errorCode: query.errorcode,
      errorMsg: query.errormsg || 'Unknown error',
    };
  }

  return {
    type: 'RESPONSE',
    opType: query.optype || null,
    status: query.status || null,
    tranID: query.tranid || null,
    orderId: query.orderid || null,
    amount: query.amount || null,
    currency: query.currency || null,
    channel: query.channel || null,
    payDate: query.paydate || null,
  };
}
