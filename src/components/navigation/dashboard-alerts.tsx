'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, m } from 'motion/react';
import { AlertTriangle, Bell, CheckCheck, CircleCheck, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MOTION_DURATION, MOTION_EASE } from '@/components/motion/motion-tokens';
import { useHydratedReducedMotion } from '@/components/motion/use-hydrated-reduced-motion';
import {
  loadDashboardNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/server/actions/notification.actions';
import type { DashboardNotification } from '@/server/queries/dashboard-alerts';
import type { UserRoleType } from '@/types';

const severityClass = {
  urgent: 'bg-status-danger-bg text-status-danger',
  warning: 'bg-status-warning-bg text-status-warning',
  positive: 'bg-status-success-bg text-status-success',
};

function SeverityIcon({ severity }: { severity: DashboardNotification['severity'] }) {
  if (severity === 'urgent') return <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />;
  if (severity === 'positive') return <CircleCheck aria-hidden="true" className="h-4 w-4 shrink-0" />;
  return <Info aria-hidden="true" className="h-4 w-4 shrink-0" />;
}

function formatNotificationDate(date: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function DashboardAlerts({ role }: { role: UserRoleType }) {
  const router = useRouter();
  const prefersReduced = useHydratedReducedMotion();
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const bellRef = React.useRef<HTMLButtonElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const [items, setItems] = React.useState<DashboardNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<DashboardNotification | null>(null);
  const unreadCount = items.filter((item) => !item.readAt).length;

  React.useEffect(() => {
    let active = true;
    let requestSequence = 0;
    setLoading(true);
    const refresh = () => {
      const sequence = ++requestSequence;
      void loadDashboardNotifications()
        .then((result) => {
          if (active && sequence === requestSequence) setItems(result);
        })
        .catch(() => {
          if (active && sequence === requestSequence) setItems([]);
        })
        .finally(() => {
          if (active && sequence === requestSequence) setLoading(false);
        });
    };
    refresh();
    window.addEventListener('sebakul:realtime-update', refresh);
    return () => {
      active = false;
      window.removeEventListener('sebakul:realtime-update', refresh);
    };
  }, [role]);

  React.useEffect(() => {
    const newest = items.find(
      (item) => !item.readAt && Date.now() - new Date(item.createdAt).getTime() < 60_000
    );
    if (!newest) return;
    const previewKey = `sebakul-notification-preview:${role}`;
    if (window.localStorage.getItem(previewKey) === newest.id) return;
    window.localStorage.setItem(previewKey, newest.id);
    setPreview(newest);
  }, [items, role]);

  React.useEffect(() => {
    if (!preview) return;
    const timer = window.setTimeout(() => setPreview(null), 5000);
    return () => window.clearTimeout(timer);
  }, [preview]);

  React.useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        bellRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  async function openNotification(notification: DashboardNotification) {
    setOpen(false);
    setPreview(null);
    setItems((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, readAt: new Date() } : item))
    );
    try {
      await markNotificationRead(notification.id);
    } finally {
      router.push(notification.href);
    }
  }

  async function markAllRead() {
    const readAt = new Date();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
    await markAllNotificationsRead();
  }

  return (
    <div ref={wrapperRef} className="relative z-40">
      <Button
        type="button"
        ref={bellRef}
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Pemberitahuan${unreadCount ? `, ${unreadCount} belum dibaca` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative rounded-lg text-text-secondary hover:bg-surface-muted hover:text-text-primary"
      >
        <Bell aria-hidden="true" className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-status-danger px-1 py-0.5 text-xs font-semibold leading-none text-white tabular-nums"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <m.section
            key="notifications-popover"
            role="dialog"
            aria-label="Pemberitahuan"
            initial={prefersReduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: 4 }}
            transition={
              prefersReduced
                ? { duration: 0.01 }
                : { duration: MOTION_DURATION.fast, ease: MOTION_EASE }
            }
            className="fixed inset-x-3 top-[4.5rem] z-50 flex max-h-[min(72dvh,34rem)] flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:z-auto sm:mt-1.5 sm:max-h-[min(72vh,34rem)] sm:w-[min(25rem,calc(100vw-2rem))]"
          >
            <header className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text-primary">Pemberitahuan</h2>
                <p className="text-xs text-text-muted">Tersimpan di akun Anda</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!unreadCount}
                  onClick={() => void markAllRead()}
                  className="gap-1.5 px-2.5 text-xs"
                >
                  <CheckCheck aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Tandai dibaca</span>
                </Button>
                <Button
                  ref={closeRef}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setOpen(false);
                    bellRef.current?.focus();
                  }}
                  aria-label="Tutup pemberitahuan"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <div className="overflow-y-auto overscroll-contain">
              {loading ? (
                <p className="p-6 text-center text-sm text-text-secondary">
                  Memuat pemberitahuan...
                </p>
              ) : items.length === 0 ? (
                <p className="p-6 text-center text-sm text-text-secondary">
                  Belum ada pemberitahuan.
                </p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => void openNotification(item)}
                        className={cn(
                          'flex min-h-12 w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary',
                          item.readAt ? 'bg-surface' : 'bg-brand-soft/35'
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                            severityClass[item.severity]
                          )}
                        >
                          <SeverityIcon severity={item.severity} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-text-primary">
                              {item.title}
                            </span>
                            {!item.readAt && (
                              <span
                                aria-label="Belum dibaca"
                                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-primary"
                              />
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">
                            {item.body}
                          </span>
                          <span className="mt-1.5 flex items-center justify-between gap-2 text-xs text-text-muted">
                            <span>{formatNotificationDate(new Date(item.createdAt))}</span>
                            {!item.isActive && (
                              <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
                                Selesai
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </m.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {preview && (
          <m.div
            key={preview.id}
            role="status"
            aria-live="polite"
            initial={prefersReduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: -6 }}
            transition={
              prefersReduced
                ? { duration: 0.01 }
                : { duration: MOTION_DURATION.normal, ease: MOTION_EASE }
            }
            className="fixed right-3 top-20 z-[70] w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border border-border-subtle bg-surface p-3.5 shadow-lg sm:right-4"
          >
            <div className="flex items-start gap-3">
              <span className={cn('mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', severityClass[preview.severity])}>
                <SeverityIcon severity={preview.severity} />
              </span>
              <button
                type="button"
                onClick={() => void openNotification(preview)}
                className="min-h-11 min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <span className="block text-sm font-medium text-text-primary">
                  {preview.title}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-text-secondary">
                  {preview.body}
                </span>
                <span className="mt-1.5 block text-xs font-medium text-brand-primary">
                  Buka detail
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Tutup pratinjau"
                onClick={() => setPreview(null)}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
