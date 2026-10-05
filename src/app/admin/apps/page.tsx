import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Layers, Globe, Lock } from 'lucide-react';
import { requirePagePrincipal } from '@/server/page-auth';
import { listAdminApps } from '@/server/services/apps';
import { listCompanies } from '@/server/services/companies';
import { getConfig } from '@/config/env';
import { CreateAppFullForm, DeleteAppButton } from '@/components/admin-forms';

const platformEmoji: Record<string, string> = { Android: '🤖', iOS: '🍎', Windows: '🪟', macOS: '🍏', Linux: '🐧', Other: '📦' };

export default async function AppsPage() {
  const actor = await requirePagePrincipal('/admin/apps');
  const [apps, companies] = await Promise.all([
    listAdminApps(actor),
    listCompanies(actor),
  ]);
  const config = getConfig();

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Release management</div>
          <h1>Apps & releases</h1>
          <p>Upload new apps with photos & APK binaries stored locally on the server, allocate companies, and manage publications.</p>
        </div>
        <span className="badge neutral">{apps.length} apps</span>
      </div>

      <section className="panel" style={{ padding: '24px 28px' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Upload & Publish New Application</h2>
          <p className="hint">Upload your app photo/icon, APK installation binary, configure public store or company allocations — all saved locally on the server.</p>
        </div>
        <CreateAppFullForm
          companies={companies}
          maxMb={config.uploadMaxBytes / 1048576}
          extensions={config.extensions}
        />
      </section>

      <section className="panel">
        <h2>All applications ({apps.length})</h2>
        {apps.length ? (
          apps.map(app => (
            <div className="row" key={app.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden', flexShrink: 0, background: '#f8faf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {app.iconUrl ? (
                    <Image src={app.iconUrl} alt={app.name} width={44} height={44} style={{ objectFit: 'contain' }} unoptimized />
                  ) : (
                    <span style={{ fontSize: 22 }}>{platformEmoji[app.platform] || '📦'}</span>
                  )}
                </div>
                <div className="row-main">
                  <Link href={`/admin/apps/${app.id}`}>
                    <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {app.name}
                      {app.isPublic ? (
                        <span className="badge" style={{ fontSize: 10, padding: '2px 7px' }}><Globe size={10} /> Public</span>
                      ) : (
                        <span className="badge neutral" style={{ fontSize: 10, padding: '2px 7px' }}><Lock size={10} /> Private</span>
                      )}
                    </h3>
                  </Link>
                  <small>
                    {app.platform} · {app._count.releases} version{app._count.releases !== 1 ? 's' : ''} · {app._count.assignments} assigned compan{app._count.assignments !== 1 ? 'ies' : 'y'}
                  </small>
                </div>
              </div>
              <div className="row-actions">
                <span className={`badge ${app.active ? '' : 'neutral'}`}>{app.active ? 'Active' : 'Disabled'}</span>
                <Link href={`/admin/apps/${app.id}`} className="button secondary small">
                  Manage releases <ArrowUpRight size={13} />
                </Link>
                <DeleteAppButton appId={app.id} appName={app.name} redirectToList={false} />
              </div>
            </div>
          ))
        ) : (
          <div className="empty">
            <Layers size={30} />
            <h2>No applications yet</h2>
            <p>Upload your first app with its photo and APK binary using the form above.</p>
          </div>
        )}
      </section>
    </>
  );
}
