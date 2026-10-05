import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Package, Download, LogIn, LayoutDashboard } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getAppDetail } from '@/server/services/apps';
import { AppError } from '@/server/errors';
import { PublicDownload } from '@/components/download-button';
import { formatDate, formatSize } from '@/lib/format';
import { getRequestPrincipal } from '@/server/http';

const platformEmoji: Record<string, string> = { Android: '🤖', iOS: '🍎', Windows: '🪟', macOS: '🍏', Linux: '🐧', Other: '📦' };
const platformColor: Record<string, string> = { Android: 'android', iOS: 'ios', Windows: 'windows', macOS: 'macos', Linux: 'linux', Other: 'other' };

export default async function PublicAppPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await getAppDetail(null, id).catch(e => { if (e instanceof AppError && e.status === 403) notFound(); throw e; });

  let principal = null;
  try {
    principal = await getRequestPrincipal();
  } catch {}

  return (
    <div className="public-store">
      <header className="public-topbar">
        <Link href="/" className="brand"><div className="brand-icon"><Package size={19} /></div><span>Anantdv<small>APP STORE</small></span></Link>
        <nav className="public-nav">
          {principal ? (
            <Link
              href={principal.role === 'ADMIN' ? '/admin' : '/catalog'}
              className="public-user-chip"
              title={`Logged in as ${principal.email} (${principal.role})`}
            >
              <div className="avatar small">{principal.email.slice(0, 2).toUpperCase()}</div>
              <span className="user-chip-label">{principal.role === 'ADMIN' ? 'Admin Console' : 'Dashboard'}</span>
              <LayoutDashboard size={14} className="user-chip-icon" />
            </Link>
          ) : (
            <Link href="/login" className="button secondary small"><LogIn size={13} />Sign in</Link>
          )}
        </nav>
      </header>

      <main className="public-content" style={{ paddingTop: 32 }}>
        <Link className="back-link" href="/"><ArrowLeft size={13} />Back to store</Link>

        <div className="app-detail-header">
          <div className="app-detail-icon">
            {app.iconUrl
              ? <Image src={app.iconUrl} alt={`${app.name} icon`} width={88} height={88} className="app-detail-icon-img" unoptimized />
              : <div className={`store-icon-placeholder-full large ${platformColor[app.platform] || 'other'}`}><span>{platformEmoji[app.platform] || '📦'}</span></div>
            }
          </div>
          <div className="app-detail-info">
            <div className="eyebrow">{app.platform} application</div>
            <h1>{app.name}</h1>
            <p>{app.description}</p>
            <div className="app-detail-stats">
              <div className="app-stat"><span className="app-stat-val">{app.releases.length}</span><span className="app-stat-label">Versions</span></div>
              {app.releases[0] && <>
                <div className="app-stat"><span className="app-stat-val">v{app.releases[0].version}</span><span className="app-stat-label">Latest</span></div>
                <div className="app-stat"><span className="app-stat-val">{formatSize(app.releases[0].size)}</span><span className="app-stat-label">Size</span></div>
              </>}
            </div>
          </div>
          {app.releases[0] && (
            <div style={{ flexShrink: 0 }}>
              <PublicDownload id={app.releases[0].id} version={app.releases[0].version} />
            </div>
          )}
        </div>

        <div className="section-title"><h2>Release history</h2><span>{app.releases.length} versions</span></div>

        {app.releases.map((release, i) => (
          <article className={`release ${i === 0 ? 'latest' : ''}`} key={release.id}>
            <div className="release-heading">
              <div className="release-title">
                <h2>Version {release.version}</h2>
                {i === 0 && <span className="badge">Latest release</span>}
              </div>
              <PublicDownload id={release.id} version={release.version} />
            </div>
            <div className="eyebrow">What's new</div>
            <p className="notes">{release.notes || 'No feature notes.'}</p>
            <div className="release-info">
              <span>Published {formatDate(release.publishedAt)}</span>
              <span>{formatSize(release.size)}</span>
              <span>{release.filename}</span>
            </div>
          </article>
        ))}

        {!app.releases.length && <div className="empty"><Download size={35} /><h2>No releases yet</h2><p>Check back soon.</p></div>}

        <div className="public-login-prompt" style={{ marginTop: 32 }}>
          <LogIn size={15} />
          <span>Have a company account? <Link href="/login">Sign in</Link> to access your full private app library.</span>
        </div>
      </main>
      <footer className="public-footer-bar"><span>© {new Date().getFullYear()} Anantdv App Store</span></footer>
    </div>
  );
}
