/** Payment app usernames a golfer is happy to share with their group. */
export type PaymentHandles = { venmo?: string; cashapp?: string; paypal?: string };

export type PayApp = keyof PaymentHandles;

export const PAY_APPS: Array<{ key: PayApp; label: string; placeholder: string; hint: string }> = [
  { key: 'venmo', label: 'Venmo', placeholder: '@jim-smith', hint: 'Venmo username' },
  { key: 'cashapp', label: 'Cash App', placeholder: '$jimsmith', hint: 'Cash App $cashtag' },
  { key: 'paypal', label: 'PayPal', placeholder: 'jimsmith', hint: 'PayPal.me name' },
];

/** Strips @, $, and pasted profile URLs down to the bare username. Returns '' if it doesn't look valid. */
export function cleanHandle(app: PayApp, raw: string): string {
  let value = raw.trim();
  value = value.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if (app === 'venmo') value = value.replace(/^venmo\.com\/(u\/)?/i, '').replace(/^@/, '');
  if (app === 'cashapp') value = value.replace(/^cash\.app\//i, '').replace(/^\$/, '');
  if (app === 'paypal') value = value.replace(/^(paypal\.me|paypal\.com\/paypalme)\//i, '');
  value = value.split(/[/?#\s]/)[0] ?? '';
  return /^[A-Za-z0-9_.-]{1,50}$/.test(value) ? value : '';
}

export function cleanHandles(handles: PaymentHandles): PaymentHandles {
  const next: PaymentHandles = {};
  PAY_APPS.forEach(({ key }) => {
    const value = cleanHandle(key, handles[key] ?? '');
    if (value) next[key] = value;
  });
  return next;
}

export function hasHandles(handles?: PaymentHandles | null) {
  return Boolean(handles && PAY_APPS.some(({ key }) => handles[key]));
}

export function displayHandle(app: PayApp, handle: string) {
  if (app === 'venmo') return `@${handle}`;
  if (app === 'cashapp') return `$${handle}`;
  return `paypal.me/${handle}`;
}

/**
 * Link that opens the payment app with the recipient, amount and note filled in. The payer still
 * reviews and confirms inside the app; Triple Track never moves money.
 */
export function payLink(app: PayApp, handle: string, amount: number, note: string): string {
  const value = (Math.round(amount * 100) / 100).toFixed(2);
  const user = encodeURIComponent(handle);
  if (app === 'venmo') {
    const params = new URLSearchParams({ txn: 'pay', audience: 'private', recipients: handle, amount: value, note });
    return `https://venmo.com/?${params.toString()}`;
  }
  if (app === 'cashapp') return `https://cash.app/$${user}/${value}`;
  return `https://paypal.me/${user}/${value}USD`;
}
