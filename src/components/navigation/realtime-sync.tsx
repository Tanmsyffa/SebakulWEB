'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import type { UserRoleType } from '@/types';

const REALTIME_UPDATE_EVENT = 'sebakul:realtime-update';

export function RealtimeSync({ userId, role, warungId }: {
  userId: string;
  role: UserRoleType;
  warungId: string | null;
}) {
  const router = useRouter();

  React.useEffect(() => {
    let disposed = false;
    let refreshTimer: number | undefined;
    const channels: ReturnType<ReturnType<typeof createBrowserClient>['channel']>[] = [];
    const statuses = new Map<string, string>();
    let allTopicsConnectedOnce = false;

    const refresh = () => {
      if (refreshTimer) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        window.dispatchEvent(new Event(REALTIME_UPDATE_EVENT));
        router.refresh();
      }, 180);
    };

    const topics = new Set([`user:${userId}`, `role:${role}`]);
    if (role === 'TENANT_MEMBER') {
      if (warungId) topics.add(`warung:${warungId}`);
      topics.add('role:TENANT_MEMBER');
    } else if (role === 'SUPER_ADMIN') {
      // Super Admin pages include sentra administration and Guyub oversight.
      topics.add('role:PENGELOLA_ADMIN');
      topics.add('role:TENANT_MEMBER');
    }

    const supabase = createBrowserClient();
    const onWindowRefresh = () => refresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    async function subscribe() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || disposed) return;
        await supabase.realtime.setAuth(session.access_token);
        if (disposed) return;

        for (const topic of topics) {
          const channel = supabase
            .channel(topic, { config: { private: true } })
            .on('broadcast', { event: 'app.invalidate' }, refresh)
            .subscribe(status => {
              statuses.set(topic, status);
              if (status === 'SUBSCRIBED') {
                const allConnected = [...topics].every(item => statuses.get(item) === 'SUBSCRIBED');
                if (allTopicsConnectedOnce) refresh();
                if (allConnected) allTopicsConnectedOnce = true;
              }
            });
          channels.push(channel);
        }
      } catch {
        // The polling fallback below keeps pages fresh while Realtime recovers.
      }
    }

    void subscribe();
    const fallback = window.setInterval(() => {
      const connected = [...topics].every(topic => statuses.get(topic) === 'SUBSCRIBED');
      if (!connected && navigator.onLine) refresh();
    }, 30_000);
    window.addEventListener('online', onWindowRefresh);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(fallback);
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.removeEventListener('online', onWindowRefresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [router, userId, role, warungId]);

  return null;
}
