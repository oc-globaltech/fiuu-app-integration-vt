/**
 * Fiuu Virtual Terminal (VT) Deep Link Utilities
 *
 * The VT SDK uses app-to-app deep link communication:
 * 1. Merchant app opens razervt:// URL to launch Fiuu VT app
 * 2. VT app processes payment and returns result via merchant's URL scheme
 *
 * Supported operations: SALE, VOID, STATUS
 * Supported channels: CARD, RPP_DuitNowQR-Offline, etc.
 */

import * as Linking from 'expo-linking';

const VT_APP_URL = 'razervt://merchant.razer.com';
const MERCHANT_URL_SCHEME = 'fiuuapp';
const MERCHANT_HOST = 'vt.callback';

/**
 * Build a deep link URL to open Fiuu VT app for a SALE transaction
 *
 * @param {Object} params
 * @param {string} params.currency    - e.g. 'MYR'
 * @param {string} params.amount      - e.g. '1.01'
 * @param {string} params.orderId     - Unique order ID
 * @param {string} params.channel     - 'CARD' or 'RPP_DuitNowQR-Offline'
 * @param {string} params.payType     - '2' for e-wallet (optional)
 * @returns {string} Deep link URL
 */
export function buildVTSaleUrl({ currency, amount, orderId, channel, payType }) {
  const params = new URLSearchParams({
    merchantUrlScheme: MERCHANT_URL_SCHEME,
    merchantHost: MERCHANT_HOST,
    opType: 'SALE',
    currency,
    amount,
    orderId,
    channel,
  });

  if (payType) {
    params.append('payType', payType);
  }

  return `${VT_APP_URL}?${params.toString()}`;
}

/**
 * Build a deep link URL to check transaction STATUS
 *
 * @param {string} orderId - The order ID to query
 * @returns {string} Deep link URL
 */
export function buildVTStatusUrl(orderId) {
  const params = new URLSearchParams({
    merchantUrlScheme: MERCHANT_URL_SCHEME,
    merchantHost: MERCHANT_HOST,
    opType: 'STATUS',
    orderId,
  });

  return `${VT_APP_URL}?${params.toString()}`;
}

/**
 * Build a deep link URL to VOID a transaction
 *
 * @param {string} orderId - The order ID to void
 * @returns {string} Deep link URL
 */
export function buildVTVoidUrl(orderId) {
  const params = new URLSearchParams({
    merchantUrlScheme: MERCHANT_URL_SCHEME,
    merchantHost: MERCHANT_HOST,
    opType: 'VOID',
    orderId,
  });

  return `${VT_APP_URL}?${params.toString()}`;
}

/**
 * Parse a response deep link from Fiuu VT app
 *
 * @param {string} url - The incoming deep link URL
 * @returns {Object|null} Parsed response or null if not a VT response
 */
export function parseVTResponse(url) {
  if (!url) return null;

  const parsed = Linking.parse(url);

  // Only handle URLs from our expected scheme and host
  if (parsed.scheme !== MERCHANT_URL_SCHEME || parsed.path !== MERCHANT_HOST) {
    return null;
  }

  const query = parsed.queryParams || {};

  // Check if it's an error response
  if (query.errorCode) {
    return {
      type: 'ERROR',
      opType: query.opType || null,
      errorCode: query.errorCode,
      errorMsg: query.errorMsg || 'Unknown error',
    };
  }

  // Success/pending response
  return {
    type: 'RESPONSE',
    opType: query.opType || null,
    status: query.status || null,
    tranID: query.tranID || null,
    orderId: query.orderid || null,
    amount: query.amount || null,
    currency: query.currency || null,
    channel: query.channel || null,
    payDate: query.payDate || null,
  };
}

/**
 * Check if Fiuu VT app is installed
 *
 * @returns {Promise<boolean>}
 */
export async function isVTAppInstalled() {
  return await Linking.canOpenURL(VT_APP_URL);
}
