/**
 * Fiuu payment channel codes for mp_channel.
 * Source: https://github.com/FiuuPayment/Mobile-XDK-Fiuu_Examples/blob/master/channel-list.md
 *
 * You can only use channels your merchant account is subscribed to — an
 * unsubscribed code is rejected by the gateway. 'multi' shows Fiuu's own
 * channel selection page with everything you are subscribed to.
 */

export const MULTI_CHANNEL = 'multi';

/** Credit channels cannot use express mode (Fiuu security requirement). */
const CREDIT_CHANNELS = ['credit', 'credit10', 'paymentasia', 'Unionpay'];

export const isCreditChannel = (code) => CREDIT_CHANNELS.includes(code);

export const CHANNEL_GROUPS = [
  {
    group: 'Cards',
    items: [
      { code: 'credit', name: 'Visa / Mastercard' },
      { code: 'credit10', name: 'Visa / Mastercard (10)' },
      { code: 'Unionpay', name: 'UnionPay' },
      { code: 'paymentasia', name: 'Union Pay (PA)' },
    ],
  },
  {
    group: 'E-Wallets',
    items: [
      { code: 'TNG-EWALLET', name: "Touch 'n Go" },
      { code: 'GrabPay', name: 'GrabPay' },
      { code: 'ShopeePay', name: 'ShopeePay' },
      { code: 'BOOST', name: 'Boost' },
      { code: 'WeChatPayMY', name: 'WeChat Pay MY' },
      { code: 'alipay', name: 'Alipay' },
      { code: 'MOLPoints', name: 'MOLPoints' },
      { code: 'PayNow', name: 'PayNow' },
    ],
  },
  {
    group: 'QR',
    items: [
      { code: 'RPP_DuitNowQR', name: 'DuitNow QR' },
      { code: 'MB2U_QRPay-Push', name: 'Maybank QR Pay' },
    ],
  },
  {
    group: 'Online Banking',
    items: [
      { code: 'maybank2u', name: 'Maybank2u' },
      { code: 'cimb', name: 'CIMB Clicks' },
      { code: 'rhb', name: 'RHB Now' },
      { code: 'publicbank', name: 'PBe' },
      { code: 'hlb', name: 'Hong Leong Connect' },
      { code: 'amb', name: 'AmOnline' },
      { code: 'abb', name: 'affinOnline' },
      { code: 'affin-epg', name: 'Affin Online' },
      { code: 'bankislam', name: 'Bank Islam' },
      { code: 'muamalat', name: 'i-Muamalat' },
      { code: 'ocbc', name: 'OCBC Online' },
      { code: 'scb', name: 'Standard Chartered' },
      { code: 'kuwait-finance', name: 'KFH Online' },
    ],
  },
  {
    group: 'FPX',
    items: [
      { code: 'FPX_ABMB', name: 'Alliance Online' },
      { code: 'FPX_BKRM', name: 'i-Rakyat' },
      { code: 'FPX_BSN', name: 'myBSN' },
      { code: 'FPX_UOB', name: 'UOB Online' },
      { code: 'FPX_HSBC', name: 'HSBC Online' },
      { code: 'FPX_AGROBANK', name: 'Agrobank Online' },
      { code: 'FPX_EMANDATE', name: 'FPX eMandate' },
      { code: 'FPX_B2B', name: 'FPX B2B' },
      { code: 'FPX_M2E', name: 'FPX Maybank2e' },
    ],
  },
  {
    group: 'Cash / Offline',
    items: [
      { code: 'cash', name: '7-Eleven' },
      { code: 'cash99', name: '99 Speedmart' },
      { code: 'esapay', name: 'Esapay Cash Retail' },
      { code: 'epay', name: 'Petronas ePay' },
      { code: 'jompay', name: 'JomPAY' },
      { code: 'Cash-Deposit', name: 'Cash Deposit' },
      { code: 'Cash-MBBCDM', name: 'Maybank CDM' },
      { code: 'Cash-MBBATM', name: 'Maybank ATM' },
      { code: 'CIMB-VA', name: 'CIMB Virtual Account' },
    ],
  },
];

const BY_CODE = Object.fromEntries(
  CHANNEL_GROUPS.flatMap((g) => g.items).map((c) => [c.code, c.name])
);

export const channelName = (code) =>
  code === MULTI_CHANNEL ? 'All channels' : BY_CODE[code] || code;
