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
      // Refresh only when needed; the download endpoint performs its own permission check.
      const state = await api<{ kind: string }>('/api/auth/state');
      if (state.kind !== 'session') await api('/api/auth/refresh', { method: 'POST' });
      // A binary response must use browser navigation, not the Next.js page router.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/api/releases/${encodeURIComponent(id)}/download`);
    } catch (error) { setError(error instanceof Error ? error.message : 'Download failed.'); }
    finally { setBusy(false); }
  }}><Download size={14} />Download v{version}</button>{error && <p className="error" role="alert">{error}</p>}</div>;
}
