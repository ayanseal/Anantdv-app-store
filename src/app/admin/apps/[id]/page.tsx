import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Globe, Lock } from 'lucide-react';
import { requirePagePrincipal } from '@/server/page-auth';
import { getAdminApp, listAdminApps } from '@/server/services/apps';
import { listCompanies } from '@/server/services/companies';
import { getConfig } from '@/config/env';
import { AppForm, AppIconForm, AppCompanyAssignments, ReleaseForm, ReleasePublish, DeleteReleaseButton, DeleteAppButton } from '@/components/admin-forms';
import { DownloadButton } from '@/components/download-button';
import { formatDate, formatSize } from '@/lib/format';

const platformEmoji: Record<string, string> = { Android: '🤖', iOS: '🍎', Windows: '🪟', macOS: '🍏', Linux: '🐧', Other: '📦' };
const platformColor: Record<string, string> = { Android: 'android', iOS: 'ios', Windows: 'windows', macOS: 'macos', Linux: 'linux', Other: 'other' };

export default async function AdminApp({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePagePrincipal(`/admin/apps/${id}`);
  const [app, companies] = await Promise.all([
    getAdminApp(actor, id),
    listCompanies(actor),
  ]);
  const config = getConfig();
  const assignedCompanyIds = app.assignments.map(a => a.company.id);

  return <>
    <Link className="back-link" href="/admin/apps"><ArrowLeft size={13} />All apps</Link>

    <div className="page-heading">
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {app.iconUrl
            ? <Image src={app.iconUrl} alt={`${app.name} icon`} width={60} height={60} style={{ borderRadius: 14, border: '1px solid var(--line)', objectFit: 'contain', background: '#f9faf7' }} unoptimized />
            : <div className={`store-icon-placeholder-full ${platformColor[app.platform] || 'other'}`} style={{ width: 60, height: 60, borderRadius: 14, fontSize: 28 }}><span>{platformEmoji[app.platform] || '📦'}</span></div>
          }
        </div>
        <div>
          <div className="eyebrow">{app.platform} · Release workspace</div>
          <h1>{app.name}</h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{app.assignments.length} assigned companies · {app.releases.length} uploaded versions</span>
            {app.isPublic
              ? <span className="badge" style={{ display: 'inline-flex', gap: 4 }}><Globe size={10} />Public</span>
              : <span className="badge neutral" style={{ display: 'inline-flex', gap: 4 }}><Lock size={10} />Private</span>
            }
          </p>
        </div>
      </div>
      <span className={`badge ${app.active ? '' : 'neutral'}`}>{app.active ? 'Active' : 'Disabled'}</span>
    </div>

    <div className="split">
      {/* Left: upload release */}
      <section className="panel">
        <h2>Upload a new release</h2>
        <ReleaseForm appId={id} maxMb={config.uploadMaxBytes / 1048576} extensions={config.extensions} />
      </section>

      {/* Right: icon + details + company assignments */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <section className="panel">
          <h2>App details</h2>
          <div className="section-title" style={{ marginTop: 0, marginBottom: 14 }}><h3>App icon</h3></div>
          <AppIconForm appId={id} currentIconUrl={app.iconUrl} />
          <details style={{ marginTop: 20 }}>
            <summary>Edit app information</summary>
            <AppForm app={app} />
          </details>
        </section>

        <section className="panel">
          <h2>Assigned companies</h2>
          {app.isPublic && (
            <div className="notice" style={{ background: 'var(--brand-light)', border: '1px solid #c3dfc9', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--brand)', display: 'flex', gap: 8 }}>
              <Globe size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              This app is <strong>public</strong> — visible to everyone on the public store regardless of company assignments. Assignments still control which <em>customers</em> see it in their private library.
            </div>
          )}
          <AppCompanyAssignments appId={id} companies={companies} selected={assignedCompanyIds} />
        </section>
      </div>
    </div>

    <div className="section-title"><h2>All versions</h2><span>{app.releases.length} release{app.releases.length !== 1 ? 's' : ''}</span></div>
    {app.releases.map((release, i) => (
      <article className={`release ${i === 0 ? 'latest' : ''}`} key={release.id}>
        <div className="release-heading">
          <div className="release-title">
            <h2>Version {release.version}</h2>
            <span className={`badge ${release.published ? '' : 'neutral'}`}>{release.published ? 'Published' : 'Draft'}</span>
            {i === 0 && release.published && <span className="badge">Latest</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <DownloadButton id={release.id} version={release.version} />
            <DeleteReleaseButton releaseId={release.id} version={release.version} />
          </div>
        </div>
        <p className="notes">{release.notes || 'No feature notes added.'}</p>
        <div className="release-info">
          <span>{formatDate(release.publishedAt)}</span>
          <span>{release.filename}</span>
          <span>{formatSize(release.size)}</span>
        </div>
        <details style={{ marginTop: 18 }}>
          <summary>Publication settings</summary>
          <ReleasePublish id={release.id} published={release.published} />
        </details>
      </article>
    ))}
    {!app.releases.length && <div className="empty"><h2>No versions yet</h2><p>Upload your first release using the form above.</p></div>}

    {/* Danger Zone */}
    <section className="panel" style={{ marginTop: 32, border: '1px solid #fecaca', background: '#fffafb' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ color: '#991b1b', margin: 0, fontSize: 16 }}>Danger Zone</h2>
          <p className="hint" style={{ margin: '4px 0 0', color: '#7f1d1d' }}>
            Delete this application profile. Choose between a normal delete (keeping APKs & version folder preserved on disk) or a permanent root purge (deleting all files & database records).
          </p>
        </div>
        <DeleteAppButton appId={id} appName={app.name} />
      </div>
    </section>
  </>;
}
