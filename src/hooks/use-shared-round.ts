'use client';

import { useEffect, useState } from 'react';
import {
  loadSharedRoundByCode,
  subscribeToSharedRound,
  type SharedRoundBundle,
} from '@/lib/realtime/shared-rounds';

type Status = 'idle' | 'loading' | 'ready' | 'not_found' | 'error';

export function useSharedRound(roundCode: string) {
  const [status, setStatus] = useState<Status>('idle');
  const [bundle, setBundle] = useState<SharedRoundBundle | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function load() {
      try {
        setStatus('loading');

        const loaded = await loadSharedRoundByCode(roundCode);
        if (cancelled) return;

        if (!loaded) {
          setStatus('not_found');
          return;
        }

        setBundle(loaded);
        setStatus('ready');

        unsubscribe = subscribeToSharedRound(loaded.round.id, async () => {
          const refreshed = await loadSharedRoundByCode(roundCode);
          if (!cancelled) setBundle(refreshed);
        });
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setStatus('error');
        }
      }
    }

    if (roundCode) void load();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [roundCode]);

  return { status, bundle, error };
}
