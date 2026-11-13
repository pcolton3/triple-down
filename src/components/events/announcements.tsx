'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import {
  deleteAnnouncement,
  listAnnouncements,
  postAnnouncement,
  pushState,
  turnOffPush,
  turnOnPush,
  type Announcement,
  type AnnouncementScope,
  type PushState,
} from '@/lib/events/announcements';
import { currentDeviceId } from '@/lib/realtime/group-rounds';
import { supabase } from '@/lib/supabase/client';
import { LinkedText } from '@/components/shared/linked-text';

function when(iso: string) {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} hr ago`;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Loads announcements and keeps them fresh while the page is open. */
function useAnnouncements(scope: AnnouncementScope, code: string) {
  const [items, setItems] = useState<Announcement[]>([]);
  const refresh = useCallback(() => {
    if (!code) return;
    listAnnouncements(scope, code).then(setItems).catch(() => { /* Keep what we have. */ });
  }, [scope, code]);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);
  return { items, refresh };
}

/** "Get notifications" switch for this event or round on this phone. */
export function NotifyToggle({ scope, code }: { scope: AnnouncementScope; code: string }) {
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    pushState(scope, code).then(setState).catch(() => setState('unsupported'));
  }, [scope, code]);

  async function toggle() {
    setBusy(true);
    setMessage('');
    try {
      if (state === 'on') {
        await turnOffPush(scope, code);
        setState('off');
      } else {
        await turnOnPush(scope, code);
        setState('on');
        setMessage("You'll get a notification when the organizer posts an update.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not change notifications.');
      setState(await pushState(scope, code).catch(() => 'off' as const));
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading' || state === 'unsupported') return null;
  if (state === 'needs-home-screen') {
    return <p className="text-xs text-slate-500">For notifications on iPhone, add Triple Track to your home screen (Share → Add to Home Screen) and open it from there.</p>;
  }
  if (state === 'denied') return <p className="text-xs text-slate-500">Notifications are blocked for this app. Turn them on in your phone settings to get updates.</p>;
  return (
    <div className="space-y-1">
      <Button variant="secondary" disabled={busy} onClick={() => void toggle()}>
        {busy ? 'One moment…' : state === 'on' ? 'Notifications on · Turn off' : 'Get notifications'}
      </Button>
      {message ? <p className="text-xs text-slate-600" role="status">{message}</p> : null}
    </div>
  );
}

/** Organizer updates, shown to everyone on the invite page and round screens. Hidden when there are none. */
export function AnnouncementsBanner({ scope, code, showNotify = true }: { scope: AnnouncementScope; code: string; showNotify?: boolean }) {
  const { items } = useAnnouncements(scope, code);
  const [expanded, setExpanded] = useState(false);
  if (!items.length) {
    return showNotify ? (
      <div className="flex flex-wrap items-center gap-2">
        <NotifyToggle scope={scope} code={code} />
      </div>
    ) : null;
  }
  const shown = expanded ? items : items.slice(0, 1);
  return (
    <Card className="space-y-2 border-amber-300 bg-amber-50">
      <h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">From the organizer</h2>
      <ul className="space-y-2">
        {shown.map((item) => (
          <li key={item.id}>
            <p className="whitespace-pre-line text-slate-800"><LinkedText text={item.body} /></p>
            <p className="text-xs text-slate-500">{when(item.created_at)}</p>
          </li>
        ))}
      </ul>
      {items.length > 1 ? (
        <button type="button" className="min-h-[44px] text-sm font-semibold text-amber-800 underline" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show latest only' : `Earlier updates (${items.length - 1})`}
        </button>
      ) : null}
      {showNotify ? <NotifyToggle scope={scope} code={code} /> : null}
    </Card>
  );
}

/** Where an organizer posts updates. Posting also notifies subscribed phones. */
export function AnnouncementComposer({ scope, code, organizerKey, deviceId, title = 'Post an update' }: { scope: AnnouncementScope; code: string; organizerKey?: string; deviceId?: string | null; title?: string }) {
  const { items, refresh } = useAnnouncements(scope, code);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mine = items.filter((item) => item.scope === scope && item.code === code.toUpperCase());

  async function post() {
    if (!text.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await postAnnouncement({ scope, code, body: text, key: organizerKey, deviceId });
      setText('');
      refresh();
      setMessage(
        !result.pushReady
          ? 'Posted. Players see it in the app. (Phone notifications aren’t set up yet.)'
          : result.subscribers
            ? `Posted and sent to ${result.notified} of ${result.subscribers} phone${result.subscribers === 1 ? '' : 's'} with notifications on.`
            : 'Posted. Nobody has notifications on yet, so they’ll see it next time they open the app.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not post.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await deleteAnnouncement(id, organizerKey, deviceId);
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove it.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-slate-600">
          {scope === 'event'
            ? 'Shows at the top of the invite page and on this event’s round screens, and notifies phones that turned on notifications.'
            : 'Shows at the top of this round’s screens and notifies phones that turned on notifications.'}
        </p>
      </div>
      <label className="block">
        <span className="sr-only">Update</span>
        <textarea
          className="min-h-[96px] w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
          maxLength={1000}
          placeholder="Tee times moved to 7:40. Meet at the range by 7:15."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <Button disabled={busy || !text.trim()} onClick={() => void post()}>{busy ? 'Posting…' : 'Post update'}</Button>
      {message ? <p className="text-sm text-slate-700" role="status">{message}</p> : null}
      {mine.length ? (
        <ul className="divide-y divide-slate-100 text-sm">
          {mine.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="whitespace-pre-line text-slate-800"><LinkedText text={item.body} /></p>
                <p className="text-xs text-slate-500">{when(item.created_at)}</p>
              </div>
              <button type="button" className="min-h-[44px] shrink-0 px-2 text-red-700 underline" disabled={busy} onClick={() => void remove(item.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

/** On a round's page: lets the phone that created the round post updates to its players. */
export function RoundCreatorComposer({ roundCode }: { roundCode: string }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => {
    const mine = currentDeviceId();
    if (!mine || !roundCode) return;
    supabase
      .from('rounds')
      .select('creator_device_id')
      .eq('round_code', roundCode.toUpperCase())
      .maybeSingle()
      .then(({ data }) => {
        if ((data as { creator_device_id?: string | null } | null)?.creator_device_id === mine) setDeviceId(mine);
      });
  }, [roundCode]);
  if (!deviceId) return null;
  return <AnnouncementComposer scope="round" code={roundCode} deviceId={deviceId} title="Message this round's players" />;
}
