'use client';

import { useState } from 'react';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { eventInvite } from '@/lib/events/share';

export function ShareEventCard({ event, dates }: { event: { code: string; title: string }; dates: string }) {
  const [status, setStatus] = useState('');
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const { url, text } = eventInvite(origin, event, dates);

  async function share() {
    setStatus('');
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setStatus('Link copied. Paste it in a text or email.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setStatus('Couldn’t share automatically. Copy the link below.');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied.');
    } catch {
      setStatus('Couldn’t copy. Press and hold the link below to copy it.');
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-bold">Invite friends</h2>
      <p className="mt-1 text-sm text-slate-600">Know someone who should play? Send them the signup link.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" className="min-h-[48px]" onClick={() => void share()}>Share invite</Button>
        <Button type="button" variant="secondary" className="min-h-[48px]" onClick={() => void copy()}>Copy link</Button>
      </div>
      <p className="mt-2 select-all break-all rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">{url}</p>
      {status ? <p role="status" className="mt-2 text-sm font-semibold text-[#0f5132]">{status}</p> : null}
    </Card>
  );
}
