'use client';
import { useEffect, useRef } from 'react';
import { api } from '@/lib/api-client';
export default function Renew() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; started.current = true;
    const next = new URLSearchParams(window.location.search).get('next') || '/catalog';
    const safe = /^\/(catalog|admin)(\/|\?|$)/.test(next) && !next.includes('\\') ? next : '/catalog';
    api('/api/auth/refresh', { method: 'POST' }).then(() => window.location.replace(safe)).catch(() => window.location.replace('/login'));
  }, []);
  return <main className="center-page"><div className="spinner" /><p>Restoring your session…</p></main>;
}
