import { describe, expect, it } from 'vitest';
import { cleanHandle, cleanHandles, hasHandles, payLink } from './pay-links';

describe('cleanHandle', () => {
  it('accepts usernames typed or pasted in common forms', () => {
    expect(cleanHandle('venmo', '@Jim-Smith')).toBe('Jim-Smith');
    expect(cleanHandle('venmo', 'https://venmo.com/u/Jim-Smith')).toBe('Jim-Smith');
    expect(cleanHandle('cashapp', '$jimsmith')).toBe('jimsmith');
    expect(cleanHandle('cashapp', 'cash.app/$jimsmith')).toBe('jimsmith');
    expect(cleanHandle('paypal', 'paypal.me/jimsmith/20')).toBe('jimsmith');
    expect(cleanHandle('paypal', 'https://www.paypal.com/paypalme/jimsmith')).toBe('jimsmith');
  });

  it('rejects things that are not usernames', () => {
    expect(cleanHandle('venmo', '')).toBe('');
    expect(cleanHandle('venmo', '@')).toBe('');
    expect(cleanHandle('cashapp', '<script>')).toBe('');
  });

  it('drops blank or invalid apps when cleaning a set', () => {
    expect(cleanHandles({ venmo: ' @jim ', cashapp: '', paypal: '!!' })).toEqual({ venmo: 'jim' });
    expect(hasHandles({})).toBe(false);
    expect(hasHandles({ cashapp: 'jim' })).toBe(true);
  });
});

describe('payLink', () => {
  it('prefills recipient, amount and note', () => {
    const venmo = new URL(payLink('venmo', 'jim-smith', 25, 'Triple Track · Saturday Group'));
    expect(venmo.origin).toBe('https://venmo.com');
    expect(venmo.searchParams.get('txn')).toBe('pay');
    expect(venmo.searchParams.get('recipients')).toBe('jim-smith');
    expect(venmo.searchParams.get('amount')).toBe('25.00');
    expect(venmo.searchParams.get('note')).toBe('Triple Track · Saturday Group');
    expect(payLink('cashapp', 'jimsmith', 12.5, 'x')).toBe('https://cash.app/$jimsmith/12.50');
    expect(payLink('paypal', 'jimsmith', 1 / 3, 'x')).toBe('https://paypal.me/jimsmith/0.33USD');
  });
});
