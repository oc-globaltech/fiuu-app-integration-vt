import { createHash } from 'node:crypto';

const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');

export type NotifyParams = Record<string, string>;

/** key0 = md5(tranID + orderid + status + domain + amount + currency) */
export function computeSkey(p: NotifyParams, secretKey: string): string {
  const key0 = md5(
    `${p.tranID ?? ''}${p.orderid ?? ''}${p.status ?? ''}${p.domain ?? ''}${p.amount ?? ''}${p.currency ?? ''}`,
  );
  // key1 = md5(paydate + domain + key0 + appcode + secret_key)
  return md5(`${p.paydate ?? ''}${p.domain ?? ''}${key0}${p.appcode ?? ''}${secretKey}`);
}

export function verifySkey(p: NotifyParams, secretKey: string): boolean {
  if (!secretKey || !p.skey) return false;
  return p.skey.toLowerCase() === computeSkey(p, secretKey).toLowerCase();
}
