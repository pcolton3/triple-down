import { describe, expect, it } from 'vitest';
import { eventInvite } from './share';

describe('eventInvite', () => {
  it('links to the public signup page with the event name and dates', () => {
    const invite = eventInvite('https://triple-down.vercel.app', { code: 'BDAY27', title: 'Birthday Cup 2027' }, 'Apr 24–25, 2027');
    expect(invite.url).toBe('https://triple-down.vercel.app/join/BDAY27');
    expect(invite.url).not.toContain('organize');
    expect(invite.text).toBe("You're invited to Birthday Cup 2027 (Apr 24–25, 2027). See the details and sign up here:");
  });
});
