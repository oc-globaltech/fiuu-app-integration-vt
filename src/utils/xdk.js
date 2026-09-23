/**
 * Runs a Fiuu XDK checkout and always settles with the raw result.
 *
 * The package's own startPayment() drops failures on iOS: the native call
 * rejects its promise for any error other than a cancel, sends no event, and
 * startPayment ignores the promise - so the callback never fires and the Pay
 * button stays on "Processing..." until the app restarts. It also leaves that
 * orphaned listener behind to fire on the next payment. Calling the native
 * function directly and awaiting it avoids both.
 */
import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';
import { startPayment } from 'fiuu-mobile-xdk-expo';

/** @returns {Promise<any>} the result in whatever shape parsePaymentResult takes */
export function runXdk(paymentDetails) {
  if (Platform.OS !== 'ios') {
    // Android reports everything, failures included, through the event.
    return new Promise((resolve) => startPayment(paymentDetails, resolve));
  }

  return requireNativeModule('FiuuMobileXdkExpo')
    .setPaymentDetails(paymentDetails)
    .catch((error) => JSON.stringify({ Error: error?.message || 'Payment failed' }));
}
