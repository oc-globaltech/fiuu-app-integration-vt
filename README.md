# Fiuu Payment Integration — React Native Expo

A React Native Expo app integrating **Fiuu Mobile XDK** (in-app webview checkout) and the
**Fiuu Virtual Terminal (VT) SDK** (app-to-app card terminal), with a **Supabase Edge Function**
that receives Fiuu's payment webhook so a payment is confirmed by the gateway rather than by the
device.

---

## Table of contents

1. [How it fits together](#how-it-fits-together)
2. [Prerequisites](#prerequisites)
3. [Setup](#setup)
4. [Building and running](#building-and-running)
5. [Testing the app](#testing-the-app) ← the walkthrough
6. [The payment webhook](#the-payment-webhook)
7. [Troubleshooting](#troubleshooting)
8. [Reference](#reference)

---

## How it fits together

There are two payment paths, and one webhook that backs both.

```
                     ┌─ XDK tab ──→ in-app webview ──→ Fiuu
  Your app ──────────┤
                     └─ VT tab ───→ Fiuu VT app ────→ card tap
                                          │
                                          ↓
                                        Fiuu
                          ┌───────────────┴───────────────┐
                          │                               │
                 deep link back to app            webhook → Supabase
                 (may never arrive)               (server-to-server)
                          │                               │
                          └──────────→ app ←──────────────┘
                                   asks by order_id
```

The webhook matters because the deep link is not guaranteed. If the cashier switches apps by
hand, or iOS drops the return, the card was still charged. The app re-checks the server every
time it becomes active, so the payment is detected either way.

**Fiuu's own guidance:** *"Never trust client-side success alone — always verify the checksum on
your backend."* The app therefore treats a payment as real only when the server says
`verified && status === '00'`.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18.20.5+ | Tested on 26.7.0 |
| Xcode 16+ | iOS 27 SDK; see the scene-lifecycle note in [Troubleshooting](#troubleshooting) |
| Java 21.0.7+ | Android builds only |
| A physical iPhone | Simulators cannot tap cards; VT testing needs real hardware |
| Fiuu VT app installed | Required for the Virtual Terminal tab |
| Fiuu merchant account | Sandbox credentials come from Fiuu — there is no self-serve signup |

Minimum targets: iOS 16, Android SDK 26.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Credentials

Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
```

```bash
FIUU_MERCHANT_ID=ocglobal_Dev          # must match the `domain` Fiuu sends in webhooks
FIUU_VERIFICATION_KEY=...
FIUU_SECRET_KEY=...                    # server-side only — see the warning below
FIUU_USERNAME=...
FIUU_PASSWORD=...
FIUU_APP_NAME=FiuuApp                  # must be registered in the Merchant Portal
FIUU_SANDBOX_MODE=true

SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

> **`FIUU_SECRET_KEY` must never reach the app bundle.** It is what signs the webhook's `skey`
> hash; anyone holding it can forge a paid order. Nothing in `src/` imports it, and the build is
> checked for it — see [Verify the secret stayed out](#verify-the-secret-stayed-out). It belongs
> in Supabase function secrets only.

`FIUU_MERCHANT_ID`, `FIUU_APP_NAME`, `FIUU_USERNAME` and `FIUU_PASSWORD` must all match **one**
merchant account. Mixing accounts is the most common cause of failures — see
[Troubleshooting](#troubleshooting).

### 3. Supabase (for payment recording)

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase secrets set \
  FIUU_SECRET_KEY='<secret>' \
  FIUU_MERCHANT_ID='<merchant id>' \
  FIUU_ACK_URL='https://www.onlinepayment.com.my/MOLPay/API/chkstat/returnipn.php'
npx supabase functions deploy fiuu-notify --no-verify-jwt
```

`--no-verify-jwt` is required: Fiuu cannot present a Supabase JWT. Authenticity comes from the
`skey` hash instead, which the function verifies on every request.

Find your `FIUU_ACK_URL` in the Merchant Portal — the Return URL IPN snippet contains it.

### 4. Merchant Portal

**Settings → Profile Settings → Advanced Settings → Registered Domain**
Register your Supabase host as a bare FQDN (no scheme, no path):

```
<project>.supabase.co
```

**Settings → Transaction Settings → Integration → End Points**
Set **both** Notification URL and Callback URL to the full function path:

```
https://<project>.supabase.co/functions/v1/fiuu-notify
```

Enable **Instant Payment Notification (IPN)** on both. Press **Check** — it must go green.

---

## Building and running

### Simulator

```bash
npx expo run:ios
```

### Physical iPhone

`npx expo run:ios --device` **does not work** — it fails at code signing because it does not pass
`-allowProvisioningUpdates`. Use `xcodebuild` directly:

```bash
# find your device UDID
xcrun devicectl list devices

cd ios
xcodebuild -workspace fiuuappintegrationvt.xcworkspace \
  -scheme fiuuappintegrationvt \
  -configuration Release \
  -destination "id=<UDID>" \
  -allowProvisioningUpdates \
  -derivedDataPath build/dd build

xcrun devicectl device install app --device <UDID> \
  build/dd/Build/Products/Release-iphoneos/fiuuappintegrationvt.app

xcrun devicectl device process launch --device <UDID> \
  com.anonymous.fiuu-app-integration-vt
```

Use **Release** for terminal testing: the JS bundle is embedded, so the app runs standalone with
no Metro server and no Wi-Fi dependency.

First install from a personal team needs trusting the developer on the phone:
**Settings → General → VPN & Device Management**.

### Verify the secret stayed out

After any build, confirm the merchant secret is not in the shipped bundle:

```bash
B=ios/build/dd/Build/Products/Release-iphoneos/fiuuappintegrationvt.app/main.jsbundle
SK=$(grep '^FIUU_SECRET_KEY=' .env | cut -d= -f2- | tr -d ' "')
strings "$B" | grep -c "$SK"    # must print 0
```

---

## Testing the app

### Test 1 — Mobile XDK (in-app checkout)

1. Launch the app, stay on the **Mobile XDK** tab.
2. Credentials auto-fill from `.env`. Check Merchant ID matches your account.
3. Set an **Amount** of at least `1.01` (Fiuu rejects less).
4. Tap **New ID** for a fresh Order ID — reusing one causes a duplicate-order rejection.
5. Tap **Payment Channel** and choose one:
   - **All channels** → Fiuu shows its own selection page (`mp_channel: 'multi'`)
   - A specific channel → jumps straight there via express mode
   - Credit channels never use express mode; Fiuu forbids it
6. Tap **Pay**.
7. Complete payment in the webview.

**Expected:** an alert reading `Payment SUCCESS` / `FAILED` / `PENDING`, then a result card. Below
it, a **Server** line showing whether the webhook confirmed it.

### Test 2 — Virtual Terminal (card tap)

This is the terminal flow. Requires the Fiuu VT app and a physical device.

1. Switch to the **Virtual Terminal** tab.
2. Confirm it does not warn that the VT app is missing.
3. Set Amount and Order ID, channel `CARD`.
4. Tap **SALE** → the Fiuu VT app opens.
5. **Tap a card** on the phone.
6. Return to this app — **by any route**. Let VT return you, *or* switch apps manually to prove
   the webhook path works without the deep link.

**Expected:** the Server card moves from *"Waiting for Fiuu to notify our server…"* to
*"Payment confirmed by server (txn …)"*. That transition is the whole point — it means Fiuu's
webhook arrived and its signature verified, independent of the device.

The app polls for roughly two minutes after returning to the foreground.

### Reading the Server card

| Shows | Means |
|---|---|
| **Payment confirmed by server** | `skey` verified and status `00` — the money moved |
| **Server recorded status …** | A notification arrived but is not a verified success (declined, pending, or the signature failed) |
| **No webhook received** | Nothing arrived within the poll window — Fiuu did not notify |
| **Could not reach server** | Network problem. Says **nothing** about the payment |

Only the first means paid. A `skey` failure records `status = -1` and is never reported as paid.

### Test 3 — verify the webhook rejects forgeries

Proves nobody can POST themselves a paid order:

```bash
U=https://<project>.supabase.co/functions/v1/fiuu-notify

curl -s -X POST "$U" \
  -d "orderid=FORGED-TEST&status=00&amount=9999.00&skey=deadbeef"

curl -s "$U?order_id=FORGED-TEST"
# {"paid":false,"payment":{...,"status":"-1","verified":false}}
```

`paid` must be `false` and `status` must be `-1`.

### Inspecting what Fiuu actually sent

Set a debug token once:

```bash
npx supabase secrets set FIUU_DEBUG_TOKEN="$(openssl rand -base64 24)"
npx supabase functions deploy fiuu-notify --no-verify-jwt
```

```bash
# the 20 most recent notifications
curl -s "$U?debug=<token>"

# the full raw payload for one order, exactly as Fiuu posted it
curl -s "$U?debug=<token>&order_id=DEMO361"
```

The listing is inert unless `FIUU_DEBUG_TOKEN` is set. Unset it when you are done.

### Running the unit tests

```bash
node src/utils/paymentResult.test.mjs                        # result parsing, 12 assertions
deno test --allow-import supabase/functions/fiuu-notify/skey_test.ts   # signature, 6 tests
```

---

## The payment webhook

`supabase/functions/fiuu-notify` serves three things:

| Request | Purpose |
|---|---|
| `POST /` | Fiuu's Notification / Callback URL |
| `GET /?order_id=X` | The app asking whether an order is paid |
| `GET /` | Health probe — the portal's **Check** button |

### Signature verification

Every notification is verified before it is trusted:

```
key0 = md5(tranID + orderid + status + domain + amount + currency)
key1 = md5(paydate + domain + key0 + appcode + secret_key)
```

`skey` must equal `key1`. On mismatch the row is stored with `status = -1` and `verified = false`
so nothing is lost, but it is never reported as paid.

Note `domain` is the **merchant ID Fiuu sends**, and `currency` may arrive as `RM` rather than
`MYR` — both are used verbatim from the payload, not from local config.

### Acknowledgement

With IPN enabled Fiuu expects an ACK or it retries every 15 minutes, up to 4 times. The function
replies `CBTOKEN:MPSTATOK` and posts the payload back with `treq=1` to `FIUU_ACK_URL` — but only
**after** the row is stored. If the write fails it returns 500 so Fiuu retries rather than the
notification being silently lost.

### Storage

`public.fiuu_payments`, one row per `order_id`. **RLS is on with no policies**: the function holds
the service role key and is the only way in or out. The app never talks to the table directly.

---

## Troubleshooting

### "No webhook received", but the payment succeeded in the portal

Check whether Fiuu called you at all, using the debug listing above.

- **A row exists with `status: -1`** → the notification arrived but the signature failed. Almost
  always the wrong account's secret key. Compare the `domain` in the raw payload against your
  `FIUU_MERCHANT_ID` — if they differ, you are using two different merchant accounts. Take the
  Secret Key from the portal of the account that `domain` names.
- **No row at all** → Fiuu never called. Re-check the Notification URL is the **full path**
  (a bare domain returns 404 `requested path is invalid`), that the domain is registered, and
  that the portal's **Check** is green.

### The portal's Check button fails

- `404 {"error":"requested path is invalid"}` → you pasted the bare domain. It must include
  `/functions/v1/fiuu-notify`.
- Any other non-2xx → the probe sends no parameters, so a bare `GET` must return 200.

### "Communication Error, please check internet connection, username, or password"

A Fiuu server response, not a network fault. `mp_username`, `mp_password`, `mp_app_name` and
`mp_merchant_ID` must all belong to the same account, and `mp_app_name` must be registered in
that account's Merchant Portal.

### Payments always show as FAILED

The Expo wrapper returns the result as a **JSON string**, and on iOS nests it again under
`transactionResult`. Reading `result.status_code` off the raw callback yields `undefined`.
`src/utils/paymentResult.js` handles the unwrapping.

### App crashes instantly on launch (iOS 26/27)

`EXC_BREAKPOINT` in `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`. iOS 27 traps
unless the app adopts the UIScene life cycle, and the Expo SDK 57 template still builds the window
in the app delegate. `plugins/withSceneDelegate.js` plus the `UIApplicationSceneManifest` entry in
`app.json` wire up Expo's `EXExpoAppSceneDelegate`. Both are applied by `expo prebuild`, so they
survive regeneration. If you see this crash, confirm the plugin is listed in `app.json`.

### `Unable to open URL: razervt://` 

`razervt` must be in `LSApplicationQueriesSchemes` (it is, via `app.json`), and the Fiuu VT app
must be installed.

### Sandbox environment is not used

Sandbox is selected by `mp_core_env: '4'` (production is `'2'`). `mp_sandbox_mode` is unrelated —
it simulates an *offline* payment.

---

## Reference

### Project structure

```
├── App.js                              # Tab navigation
├── src/
│   ├── components/
│   │   ├── XDKPayment.js               # In-app checkout + channel selector
│   │   └── VTPayment.js                # Card terminal via deep link
│   ├── config/
│   │   └── channels.js                 # mp_channel codes
│   └── utils/
│       ├── vtDeepLink.js               # VT deep link build/parse
│       ├── paymentResult.js            # Normalises the XDK callback
│       ├── paymentResult.test.mjs
│       └── paymentStatus.js            # Asks the server if an order is paid
├── supabase/
│   ├── functions/fiuu-notify/
│   │   ├── index.ts                    # Webhook + status lookup
│   │   ├── skey.ts                     # Signature verification
│   │   └── skey_test.ts
│   └── migrations/                     # fiuu_payments table
├── plugins/
│   └── withSceneDelegate.js            # iOS 27 scene lifecycle fix
└── app.json                            # Expo config, Info.plist, plugins
```

### Key XDK parameters

| Parameter | Notes |
|---|---|
| `mp_core_env` | `'4'` sandbox, `'2'` production. **This** selects the environment |
| `mp_dev_mode` | `true` for the online sandbox |
| `mp_sandbox_mode` | Simulates an offline payment — *not* the sandbox switch |
| `mp_channel` | `'multi'` or a code from `src/config/channels.js` |
| `mp_express_mode` | Skips the info page; needs a specific channel, forbidden for credit |
| `mp_amount` | String, minimum `1.01`, two decimals |

### Response codes

| Code | XDK | VT |
|---|---|---|
| `00` | Success | Approved |
| `11` | Failed | Failed |
| `22` | Pending (cash channels) | Pending |
| `44` | — | Voided |
| `-1` | Signature failed — set by this app, never by Fiuu | |

### VT operations and channels

| Operation | Description |
|---|---|
| `SALE` | Charge a card or e-wallet |
| `STATUS` | Query transaction status |
| `VOID` | Void a previous transaction |

| Channel | Type |
|---|---|
| `CARD` | Credit/debit card (tap, chip, swipe) |
| `RPP_DuitNowQR-Offline` | DuitNow QR offline |

### Documentation

- [Fiuu Mobile XDK docs](https://fiuupayment.github.io/XDK-Webview/docs/core-integration)
- [Payment parameters](https://fiuupayment.github.io/XDK-Webview/docs/payment-parameters)
- [Channel list](https://github.com/FiuuPayment/Mobile-XDK-Fiuu_Examples/blob/master/channel-list.md)
- [Payment status notification / IPN](https://e2payprod.gitbook.io/payment-gateway/api-documentation/technical-doc-of-fiuu-id/payment-response-parameter/payment-status-notification-merchant-webhook-or-the-3-endpoints)
- [Fiuu API cheatsheet](https://github.com/FiuuPayment/Cheatsheet-BestPractices-Fiuu_API)

### Support

- Merchant support: support@fiuu.com
- Technical: technical@fiuu.com
