'use client';
import { useEffect, useRef } from 'react';
import { api } from '@/lib/api-client';
export default function Renew() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const next = new URLSearchParams(window.location.search).get('next') || '/catalog';
    const safe = /^\/(catalog|admin)(\/|\?|$)/.test(next) && !next.includes('\\') ? next : '/catalog';

    const now = Date.now();
    const lastAttempt = Number(sessionStorage.getItem('last_renew_time') || '0');
    const attemptCount = Number(sessionStorage.getItem('renew_attempts') || '0');
    if (now - lastAttempt < 6000 && attemptCount >= 2) {
      sessionStorage.removeItem('renew_attempts');
      sessionStorage.removeItem('last_renew_time');
      window.location.replace('/login');
      return;
    }
    sessionStorage.setItem('last_renew_time', String(now));
    sessionStorage.setItem('renew_attempts', String(attemptCount + 1));

    api('/api/auth/refresh', { method: 'POST' })
      .then(() => {
        sessionStorage.removeItem('renew_attempts');
        sessionStorage.removeItem('last_renew_time');
        window.location.replace(safe);
      })
      .catch(() => {
        sessionStorage.removeItem('renew_attempts');
        sessionStorage.removeItem('last_renew_time');
        window.location.replace('/login');
      });
  }, []);
  return <main className="center-page"><div className="spinner" /><p>Restoring your session…</p></main>;
}
