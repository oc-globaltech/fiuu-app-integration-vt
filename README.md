# Fiuu Payment Integration - React Native Expo

A base React Native Expo application integrated with both **Fiuu Mobile XDK** and **Fiuu Virtual Terminal (VT) SDK**.

## Features

- **React Native 0.86** with **Expo SDK 57**
- **Fiuu Mobile XDK** (`fiuu-mobile-xdk-expo`) — In-app webview payment
- **Fiuu Virtual Terminal SDK** — App-to-app deep link payment (SALE, VOID, STATUS)
- Tab navigation between XDK and VT screens
- Environment variables via `.env` for secure credential management
- Real-time payment result display

## Prerequisites

- Node.js 18.20.5+ (tested with 26.7.0)
- Java 21.0.7+ (for Android builds)
- Xcode 15+ (for iOS builds)
- Minimum Android SDK 26 / API level 19
- Minimum iOS target: iOS 16
- Fiuu VT app installed (for Virtual Terminal integration)

## Installation

```bash
npm install
```

## Running the App

### Start the development server

```bash
npx expo start
```

### Run on Android

```bash
npm run android
```

### Run on iOS

```bash
npm run ios
```

## Configuration

Create a `.env` file in the project root:

```bash
FIUU_MERCHANT_ID=your_merchant_id
FIUU_VERIFICATION_KEY=your_verification_key
FIUU_SECRET_KEY=your_secret_key
FIUU_USERNAME=your_username
FIUU_PASSWORD=your_password
FIUU_APP_NAME=YourAppName
FIUU_SANDBOX_MODE=true
```

> `.env` is gitignored — never commit credentials.

## Tab 1: Mobile XDK

The Mobile XDK launches a webview-based payment flow inside your app.

```js
import { startPayment } from 'fiuu-mobile-xdk-expo';

const paymentDetails = {
  mp_merchant_ID: 'your_merchant_id',
  mp_verification_key: 'your_vkey',
  mp_amount: '1.10',
  mp_order_ID: 'ORDER-123',
  mp_currency: 'MYR',
  mp_country: 'MY',
  mp_channel: 'multi',
  mp_core_env: '4', // Sandbox
};

startPayment(paymentDetails, (result) => {
  console.log('Payment result:', result);
});
```

## Tab 2: Virtual Terminal (VT)

The VT SDK uses **deep links** to communicate with the Fiuu VT app.

### SALE Request

```
razervt://merchant.razer.com?merchantUrlScheme=fiuuapp&merchantHost=vt.callback
  &opType=SALE&currency=MYR&amount=1.01&orderId=ABC123&channel=CARD
```

### SALE Response

```
fiuuapp://vt.callback?opType=SALE&amount=1.01&orderid=ABC123
  &tranID=123456&status=00&currency=MYR&channel=MYDEBIT_CP
```

### Supported Operations

| Operation | Description |
|-----------|-------------|
| `SALE`    | Charge a card or e-wallet |
| `STATUS`  | Query transaction status |
| `VOID`    | Void a previous transaction |

### Supported Channels

| Channel | Type |
|---------|------|
| `CARD` | Credit/Debit card (tap/chip/swipe) |
| `RPP_DuitNowQR-Offline` | DuitNow QR offline |

## Project Structure

```
fiuu-app-integration-vt/
├── App.js                          # Main app with tab navigation
├── src/
│   ├── components/
│   │   ├── XDKPayment.js           # Mobile XDK screen
│   │   └── VTPayment.js            # Virtual Terminal screen
│   ├── utils/
│   │   └── vtDeepLink.js           # VT deep link helpers
│   └── config/
│       └── fiuuConfig.js           # XDK configuration helpers
├── app.json                        # Expo config + URL scheme
├── .env                            # Credentials (gitignored)
└── assets/                         # App icons
```

## Response Codes

### Mobile XDK

| StatCode | Status   | Description                     |
|----------|----------|---------------------------------|
| `00`     | Success  | Payment captured / successful   |
| `11`     | Failed   | Payment failed or cancelled     |
| `22`     | Pending  | Payment pending (cash channels) |

### Virtual Terminal

| Status | Meaning |
|--------|---------|
| `00`   | Approved |
| `11`   | Failed |
| `22`   | Pending |
| `44`   | Voided |

## Important Notes

- **Never** commit real merchant credentials to version control.
- For VT integration, the Fiuu VT app must be installed on the device.
- For Google Pay (Android only), register your app's signing certificate SHA-1 with Fiuu.
- For Apple Pay (iOS only), enable the Apple Pay capability in Xcode.

## Documentation

- [Fiuu API Specification](https://github.com/FiuuPayment/Documentation-Fiuu_API_Spec)
- [Fiuu Mobile XDK Expo](https://github.com/FiuuPayment/Mobile-XDK-Fiuu_Expo)
- [Fiuu Mobile XDK React Native](https://github.com/FiuuPayment/Mobile-XDK-Fiuu_React_Native)
- [Fiuu Virtual Terminal SDK](https://github.com/FiuuPayment/Fiuu-Virtual-Terminal-SDK)

## Support

- Fiuu Merchant Support: support@fiuu.com
- Fiuu Technical: technical@fiuu.com
