'use client';

import * as React from 'react';

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  language?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function getTurnstileSiteKey(): string {
  return (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
}

export function isTurnstileEnabled(): boolean {
  return Boolean(getTurnstileSiteKey());
}

let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstileApi(): Promise<TurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile hanya berjalan di browser.'));
  }

  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const resolveWhenReady = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (window.turnstile) {
          window.clearInterval(timer);
          resolve(window.turnstile);
        } else if (attempts >= 40) {
          window.clearInterval(timer);
          turnstileScriptPromise = null;
          reject(new Error('Cloudflare Turnstile gagal diinisialisasi.'));
        }
      }, 100);
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    );

    if (existing) {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      existing.addEventListener('load', resolveWhenReady, { once: true });
      existing.addEventListener(
        'error',
        () => {
          turnstileScriptPromise = null;
          reject(new Error('Gagal memuat skrip Cloudflare Turnstile.'));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', resolveWhenReady, { once: true });
    script.addEventListener(
      'error',
      () => {
        turnstileScriptPromise = null;
        reject(new Error('Gagal memuat skrip Cloudflare Turnstile.'));
      },
      { once: true }
    );
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
}

export const TurnstileWidget = React.forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ onSuccess, onExpire, onError, className }, ref) {
    const siteKey = getTurnstileSiteKey();
    const containerRef = React.useRef<HTMLDivElement>(null);
    const widgetIdRef = React.useRef<string | null>(null);
    const [loadError, setLoadError] = React.useState(false);

    const callbacksRef = React.useRef({ onSuccess, onExpire, onError });
    React.useEffect(() => {
      callbacksRef.current = { onSuccess, onExpire, onError };
    }, [onSuccess, onExpire, onError]);

    React.useImperativeHandle(ref, () => ({
      reset() {
        if (typeof window !== 'undefined' && window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch {
            // Ignore reset race if widget is already unmounted
          }
        }
      },
    }));

    React.useEffect(() => {
      if (!siteKey) return;

      let cancelled = false;
      setLoadError(false);

      loadTurnstileApi()
        .then((turnstile) => {
          if (cancelled || !containerRef.current) return;
          containerRef.current.innerHTML = '';
          widgetIdRef.current = turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: 'light',
            size: 'flexible',
            language: 'id',
            callback: (token) => {
              callbacksRef.current.onSuccess(token);
            },
            'expired-callback': () => {
              callbacksRef.current.onExpire?.();
            },
            'error-callback': () => {
              callbacksRef.current.onError?.();
            },
          });
        })
        .catch(() => {
          if (cancelled) return;
          setLoadError(true);
          callbacksRef.current.onError?.();
        });

      return () => {
        cancelled = true;
        if (typeof window !== 'undefined' && window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Ignore cleanup race
          }
          widgetIdRef.current = null;
        }
      };
    }, [siteKey]);

    if (!siteKey) {
      return null;
    }

    return (
      <div className={className}>
        <div
          ref={containerRef}
          aria-label="Verifikasi keamanan Cloudflare Turnstile"
          className="min-h-[65px] w-full overflow-hidden rounded-lg"
        />
        {loadError && (
          <p className="mt-1.5 text-xs text-status-danger">
            Widget verifikasi keamanan gagal dimuat. Nonaktifkan pemblokir skrip lalu muat ulang halaman.
          </p>
        )}
      </div>
    );
  }
);
