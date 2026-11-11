import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { loadGolfEvent } from '@/lib/events/golf-events';
import { VAPID_PUBLIC_KEY } from '@/lib/push/config';
import { supabase } from '@/lib/supabase/client';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Subscription = { endpoint: string; p256dh: string; auth: string };

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/** Posts an announcement (the database checks who may) and pushes it to subscribed phones. */
export async function POST(request: NextRequest) {
  let body: { scope?: unknown; code?: unknown; key?: unknown; deviceId?: unknown; body?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, 'Bad request.');
  }
  const scope = body.scope === 'round' ? 'round' : 'event';
  const code = typeof body.code === 'string' ? body.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) : '';
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 1000) : '';
  if (!code || !text) return fail(400, 'Write a message first.');

  const { data, error } = await supabase.rpc('post_announcement', {
    p_scope: scope,
    p_code: code,
    p_key: typeof body.key === 'string' ? body.key : null,
    p_device_id: typeof body.deviceId === 'string' ? body.deviceId : null,
    p_body: text,
  });
  if (error) {
    if (/could not find the function|does not exist|schema cache/i.test(error.message)) return fail(503, 'Announcements are not set up yet (run supabase-announcements.sql).');
    return fail(403, error.message);
  }
  const subscriptions = (data ?? []) as Subscription[];

  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey || !subscriptions.length) return NextResponse.json({ notified: 0, subscribers: subscriptions.length, pushReady: Boolean(privateKey) });

  const event = scope === 'event' ? await loadGolfEvent(code).catch(() => null) : null;
  const payload = JSON.stringify({
    title: event?.title ?? (scope === 'round' ? `Round ${code}` : code),
    body: text.length > 180 ? `${text.slice(0, 177)}…` : text,
    url: scope === 'event' ? `/join/${code}` : `/r/${code}`,
    tag: `${scope}-${code}`,
  });
  webpush.setVapidDetails('https://triple-down.vercel.app', VAPID_PUBLIC_KEY, privateKey);

  let notified = 0;
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 12 * 60 * 60, urgency: 'high' });
        notified += 1;
      } catch (pushError) {
        const status = (pushError as { statusCode?: number }).statusCode;
        // The phone unsubscribed or the app was removed: forget it.
        if (status === 404 || status === 410) await supabase.rpc('push_unsubscribe', { p_endpoint: subscription.endpoint });
        else console.error('push failed', status);
      }
    })
  );
  return NextResponse.json({ notified, subscribers: subscriptions.length, pushReady: true });
}
