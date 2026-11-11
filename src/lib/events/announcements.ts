import { supabase } from '@/lib/supabase/client';
import { VAPID_PUBLIC_KEY } from '@/lib/push/config';

export type AnnouncementScope = 'event' | 'round';
export type Announcement = { id: string; scope: AnnouncementScope; code: string; body: string; created_at: string };

function missingSetup(message = '') {
  return /could not find the function|does not exist|schema cache/i.test(message);
}

/** Latest announcements; a round also gets its event's. Empty if the SQL hasn't been run yet. */
export async function listAnnouncements(scope: AnnouncementScope, code: string): Promise<Announcement[]> {
  const { data, error } = await supabase.rpc('list_announcements', { p_scope: scope, p_code: code });
  if (error) {
    if (missingSetup(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as Announcement[];
}

export type PostResult = { notified: number; subscribers: number; pushReady: boolean };

export async function postAnnouncement(input: { scope: AnnouncementScope; code: string; body: string; key?: string; deviceId?: string | null }): Promise<PostResult> {
  const response = await fetch('/api/announce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<PostResult> & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Could not post the announcement.');
  return { notified: data.notified ?? 0, subscribers: data.subscribers ?? 0, pushReady: Boolean(data.pushReady) };
}

export async function deleteAnnouncement(id: string, key?: string, deviceId?: string | null) {
  const { error } = await supabase.rpc('delete_announcement', { p_id: id, p_key: key ?? null, p_device_id: deviceId ?? null });
  if (error) throw new Error(error.message);
}

/* ---------- Push notifications ---------- */

export type PushState = 'unsupported' | 'needs-home-screen' | 'denied' | 'off' | 'on';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function subscribedKey(scope: AnnouncementScope, code: string) {
  return `triple-track-push:${scope}:${code.toUpperCase()}`;
}

export async function pushState(scope: AnnouncementScope, code: string): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported';
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!supported) return isIos() && !isStandalone() ? 'needs-home-screen' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return subscription && localStorage.getItem(subscribedKey(scope, code)) ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

function keyBytes(base64: string) {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/** Must be called from a tap: asks permission, subscribes this phone, and saves it for this event or round. */
export async function turnOnPush(scope: AnnouncementScope, code: string) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Notifications are blocked. Turn them on for this app in your phone settings.' : 'Notifications were not allowed.');
  const registration = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const json = subscription.toJSON();
  const { error } = await supabase.rpc('push_subscribe', {
    p_scope: scope,
    p_code: code,
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
  });
  if (error) throw new Error(missingSetup(error.message) ? 'Notifications are not set up yet.' : error.message);
  try { localStorage.setItem(subscribedKey(scope, code), '1'); } catch { /* Still subscribed. */ }
}

/** Stops notifications for this event or round on this phone (the phone may still get others). */
export async function turnOffPush(scope: AnnouncementScope, code: string) {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await supabase.rpc('push_unsubscribe', { p_endpoint: subscription.endpoint, p_scope: scope, p_code: code });
  try { localStorage.removeItem(subscribedKey(scope, code)); } catch { /* Nothing saved. */ }
}
