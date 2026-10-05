'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '@/lib/api-client';

export function DownloadButton({ id, version }: { id: string; version: string }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <div><button className="button" disabled={busy} onClick={async () => {
    setBusy(true); setError('');
    try {
      const state = await api<{ kind: string }>('/api/auth/state');
      if (state.kind !== 'session') await api('/api/auth/refresh', { method: 'POST' });
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/api/releases/${encodeURIComponent(id)}/download`);
    } catch (error) { setError(error instanceof Error ? error.message : 'Download failed.'); }
    finally { setBusy(false); }
  }}><Download size={14} />Download v{version}</button>{error && <p className="error" role="alert">{error}</p>}</div>;
}

/** Full-width green download bar — used on catalog cards (authenticated) */
export function DirectDownload({ id, version }: { id: string; version: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div style={{ marginTop: 'auto' }}>
      {error && <p className="store-dl-error">{error}</p>}
      <button className="store-dl-btn" disabled={busy} onClick={async e => {
        e.preventDefault(); setBusy(true); setError('');
        try {
          const state = await api<{ kind: string }>('/api/auth/state');
          if (state.kind !== 'session') await api('/api/auth/refresh', { method: 'POST' });
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign(`/api/releases/${encodeURIComponent(id)}/download`);
        } catch { setError('Download failed. Please try again.'); }
        finally { setBusy(false); }
      }}>
        {busy ? <span className="dl-spinner" /> : <Download size={15} />}
        {busy ? 'Downloading…' : `Download v${version}`}
      </button>
    </div>
  );
}

/** Full-width green download bar — used on public store (no auth needed) */
export function PublicDownload({ id, version }: { id: string; version: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div style={{ marginTop: 'auto' }}>
      {error && <p className="store-dl-error">{error}</p>}
      <button className="store-dl-btn" disabled={busy} onClick={async e => {
        e.preventDefault(); setBusy(true); setError('');
        try {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign(`/api/releases/${encodeURIComponent(id)}/download`);
        } catch { setError('Download failed. Please try again.'); }
        finally { setBusy(false); }
      }}>
        {busy ? <span className="dl-spinner" /> : <Download size={15} />}
        {busy ? 'Downloading…' : `Download v${version}`}
      </button>
    </div>
  );
}
