/**
 * Fiuu Mobile XDK Configuration
 *
 * This file contains default configuration values for the Fiuu payment gateway.
 * In production, merchant credentials should be loaded from environment variables
 * or a secure backend, never hardcoded in the client.
 */

// Import from react-native-dotenv (defined in .env)
import {
  FIUU_MERCHANT_ID,
  FIUU_VERIFICATION_KEY,
  FIUU_SECRET_KEY,
  FIUU_USERNAME,
  FIUU_PASSWORD,
  FIUU_APP_NAME,
  FIUU_SANDBOX_MODE,
} from '@env';

export const FIUU_CONFIG = {
  // Environment: true = Sandbox/Dev mode, false = Production
  SANDBOX_MODE: FIUU_SANDBOX_MODE === 'false' ? false : true,

  // Merchant credentials (loaded from .env)
  MERCHANT_ID: FIUU_MERCHANT_ID || '',
  VERIFICATION_KEY: FIUU_VERIFICATION_KEY || '',
  SECRET_KEY: FIUU_SECRET_KEY || '',
  USERNAME: FIUU_USERNAME || '',
  PASSWORD: FIUU_PASSWORD || '',
  APP_NAME: FIUU_APP_NAME || 'FiuuApp',

  // Default currency and country
  DEFAULT_CURRENCY: 'MYR',
  DEFAULT_COUNTRY: 'MY',

  // Default language: EN, MS, VI, TH, FIL, MY, KM, ID, ZH
  DEFAULT_LANGUAGE: 'EN',

  // Minimum amount for Fiuu transactions
  MIN_AMOUNT: 1.01,
};

/**
 * Build a payment details object for Fiuu Mobile XDK
 *
 * @param {Object} params
 * @param {string} params.merchantId     - Fiuu Merchant ID
 * @param {string} params.verificationKey - Fiuu Verification Key
 * @param {string} params.amount         - Transaction amount (min 1.01)
 * @param {string} params.orderId        - Unique order ID
 * @param {string} params.currency       - Currency code (e.g. MYR)
 * @param {string} params.country        - Country code (e.g. MY)
 * @param {string} params.billName       - Customer name
 * @param {string} params.billEmail      - Customer email
 * @param {string} params.billMobile     - Customer mobile
 * @param {string} params.billDescription - Payment description
 * @param {string} params.username       - Fiuu username (optional)
 * @param {string} params.password       - Fiuu password (optional)
 * @param {string} params.appName        - App name (optional)
 * @param {boolean} params.sandboxMode   - Enable sandbox mode
 * @returns {Object} paymentDetails object for startMolpay()
 */
export function buildPaymentDetails({
  merchantId,
  verificationKey,
  amount,
  orderId,
  currency = FIUU_CONFIG.DEFAULT_CURRENCY,
  country = FIUU_CONFIG.DEFAULT_COUNTRY,
  billName = '',
  billEmail = '',
  billMobile = '',
  billDescription = '',
  username = '',
  password = '',
  appName = FIUU_CONFIG.APP_NAME,
  sandboxMode = FIUU_CONFIG.SANDBOX_MODE,
}) {
  if (!merchantId || !verificationKey) {
    throw new Error('Merchant ID and Verification Key are required');
  }

  if (!amount || parseFloat(amount) < FIUU_CONFIG.MIN_AMOUNT) {
    throw new Error(`Amount must be at least ${FIUU_CONFIG.MIN_AMOUNT}`);
  }

  return {
    mp_dev_mode: sandboxMode,
    mp_username: username,
    mp_password: password,
    mp_merchant_ID: merchantId,
    mp_app_name: appName,
    mp_verification_key: verificationKey,

    mp_amount: amount,
    mp_order_ID: orderId,
    mp_currency: currency,
    mp_country: country,

    mp_channel: 'multi',
    mp_bill_description: billDescription || 'Payment via Fiuu XDK',
    mp_bill_name: billName || 'Customer',
    mp_bill_email: billEmail || 'customer@example.com',
    mp_bill_mobile: billMobile || '+60123456789',

    mp_channel_editing: true,
    mp_editing_enabled: true,
    mp_sandbox_mode: sandboxMode,
    mp_express_mode: false,
    mp_language: FIUU_CONFIG.DEFAULT_LANGUAGE,
  };
}
