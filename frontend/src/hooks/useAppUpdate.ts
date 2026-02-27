import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const VERSION_POLL_MS = 3 * 60 * 1000; // 3 minutes
const RELOAD_GUARD_KEY = '__aarogya_reload_ts';
const RELOAD_MIN_GAP_MS = 10_000;

function safeReload() {
  const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0');
  if (Date.now() - last < RELOAD_MIN_GAP_MS) return;
  sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  window.location.reload();
}

/**
 * Handles two update vectors:
 * 1. Service worker update via vite-plugin-pwa autoUpdate → auto-reload
 * 2. /version.json polling → catches edge cases where SW update is delayed
 */
export function useAppUpdate() {
  const savedVersion = useRef<string | null>(null);

  // --- Vector 1: SW update ---
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Poll for SW update every 60s (in addition to browser's 24h check)
      setInterval(() => { registration.update(); }, 60_000);
    },
    onRegisterError(error) {
      console.error('[SW] registration error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      updateServiceWorker(true);
      safeReload();
    }
  }, [needRefresh, updateServiceWorker]);

  // --- Vector 2: version.json polling ---
  useEffect(() => {
    let active = true;

    async function checkVersion() {
      try {
        const resp = await fetch('/version.json?_t=' + Date.now(), { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json();
        const current = data.buildId || data.timestamp;
        if (!current) return;

        if (savedVersion.current === null) {
          savedVersion.current = current;
          return;
        }
        if (current !== savedVersion.current) {
          console.log('[version] new build detected:', current, '(was', savedVersion.current + ')');
          savedVersion.current = current;
          safeReload();
        }
      } catch { /* offline or version.json missing — ignore */ }
    }

    checkVersion();
    const timer = setInterval(checkVersion, VERSION_POLL_MS);

    const onFocus = () => checkVersion();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkVersion();
    });

    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
}
