/**
 * Normalises a Fiuu XDK payment result into { status, message, fields }.
 *
 * The Expo wrapper does not give you an object. Per Fiuu's docs ("Expo: Results
 * arrive as JSON strings requiring manual parsing") the payload is a JSON string,
 * and on iOS the native module wraps it again as { transactionResult: "<json>" }.
 * Reading result.status_code off the raw callback argument is therefore always
 * undefined, which silently renders every payment as FAILED.
 *
 * Status codes: "00" success, "11" declined, "22" pending (cash channels only).
 */

export const STATUS_COLORS = {
  SUCCESS: '#28a745',
  PENDING: '#ffc107',
  FAILED: '#dc3545',
  CANCELLED: '#6c757d',
};

const STATUS_BY_CODE = {
  '00': 'SUCCESS',
  '11': 'FAILED',
  '22': 'PENDING',
};

/** Unwraps { transactionResult } and parses JSON, tolerating double-encoding. */
function toObject(raw) {
  let value = raw;

  for (let i = 0; i < 3; i++) {
    if (value && typeof value === 'object') {
      // iOS sends the payload nested under transactionResult.
      if ('transactionResult' in value) {
        value = value.transactionResult;
        continue;
      }
      return value;
    }
    if (typeof value !== 'string') return {};

    const text = value.trim();
    if (!text.startsWith('{') && !text.startsWith('[')) {
      return { message: text };
    }
    try {
      value = JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  return value && typeof value === 'object' ? value : {};
}

export function parsePaymentResult(raw) {
  const fields = toObject(raw);

  // Google Pay uses StatCode/TranID/OrderID; every other channel uses snake_case.
  const code = fields.status_code ?? fields.StatCode;
  const error = fields.Error ?? fields.error;
  const text = String(fields.message ?? '');

  let status;
  let message;

  if (/cancel/i.test(text)) {
    status = 'CANCELLED';
    message = 'Payment was cancelled.';
  } else if (error) {
    status = 'FAILED';
    message = String(error);
  } else if (code != null && STATUS_BY_CODE[String(code)]) {
    status = STATUS_BY_CODE[String(code)];
    message = fields.err_desc || fields.error_desc || '';
  } else {
    // No recognised status code: treat as failure rather than claiming success.
    status = 'FAILED';
    message = text || fields.err_desc || 'Unrecognised response from Fiuu.';
  }

  return {
    status,
    message,
    fields,
    txnId: fields.txn_ID ?? fields.TranID ?? null,
    orderId: fields.order_id ?? fields.OrderID ?? null,
    amount: fields.amount ?? fields.Amount ?? null,
  };
}
