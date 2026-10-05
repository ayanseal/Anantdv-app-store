import Link from 'next/link';
import Image from 'next/image';
import { Search, ShieldCheck, Layers } from 'lucide-react';
import { requirePagePrincipal } from '@/server/page-auth';
import { listCatalog } from '@/server/services/apps';
import { formatSize } from '@/lib/format';
import { DirectDownload } from '@/components/download-button';

const platformEmoji: Record<string, string> = { Android: '🤖', iOS: '🍎', Windows: '🪟', macOS: '🍏', Linux: '🐧', Other: '📦' };
const platformColor: Record<string, string> = { Android: 'android', iOS: 'ios', Windows: 'windows', macOS: 'macos', Linux: 'linux', Other: 'other' };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ search?: string; platform?: string }> }) {
  const principal = await requirePagePrincipal('/catalog');
  const filters = await searchParams;
  const apps = await listCatalog(principal, filters);
  const canDownload = principal.role !== 'VIEWER';

  return <>
    <div className="page-heading">
      <div>
        <div className="eyebrow">{principal.companyName || (principal.role === 'ADMIN' ? 'All companies' : 'Anantdv workspace')}</div>
        <h1>App store</h1>
        <p>{principal.role === 'ADMIN' ? 'All published apps across every company.' : principal.role === 'VIEWER' ? 'Browse apps and release history across the library.' : 'Your company apps — download the latest versions.'}</p>
      </div>
      <span className="badge"><ShieldCheck size={12} />{principal.role === 'ADMIN' ? 'Admin access' : principal.role === 'VIEWER' ? 'View-only' : 'Private workspace'}</span>
    </div>

    <form className="toolbar" action="/catalog">
      <div className="input-wrap"><Search size={16} /><input name="search" aria-label="Search apps" placeholder="Search apps…" defaultValue={filters.search} /></div>
      <select name="platform" aria-label="Filter by platform" defaultValue={filters.platform || ''}>
        <option value="">All platforms</option>
        {['Android', 'iOS', 'Windows', 'macOS', 'Linux', 'Other'].map(p => <option key={p}>{p}</option>)}
      </select>
      <button className="button secondary">Search</button>
    </form>

    <div className="section-title">
      <h2>Available apps <span style={{ marginLeft: 6 }}>({apps.length})</span></h2>
      <span>Published releases</span>
    </div>

    {apps.length ? (
      <div className="store-grid">
        {apps.map(app => {
          const latest = app.releases[0];
          return (
            <div className="store-card" key={app.id}>

              {/* Logo box — bordered, centered, full inside the card */}
              <Link href={`/catalog/${app.id}`} className="store-icon-banner" tabIndex={-1} aria-hidden="true">
                {app.iconUrl ? (
                  <Image src={app.iconUrl} alt="" width={300} height={300} className="store-banner-img" unoptimized />
                ) : (
                  <div className={`store-icon-placeholder-full ${platformColor[app.platform] || 'other'}`}>
                    <span>{platformEmoji[app.platform] || '📦'}</span>
                  </div>
                )}
              </Link>

              {/* Text rows */}
              <div className="store-card-body">
                <Link href={`/catalog/${app.id}`} className="store-app-name">{app.name}</Link>
                <div className="store-meta-row">
                  <span className="store-platform-tag">{app.platform}</span>
                  {latest && <><span className="store-sep">·</span><span className="store-version">v{latest.version}</span><span className="store-sep">·</span><span className="store-version">{formatSize(latest.size)}</span></>}
                </div>
                <p className="store-description">{app.description || 'Enterprise application available for your organization.'}</p>
              </div>

              {/* Full-width green download button */}
              {canDownload && latest
                ? <DirectDownload id={latest.id} version={latest.version} />
                : <Link href={`/catalog/${app.id}`} className="store-view-btn">
                    {latest ? 'View releases' : 'No releases yet'}
                  </Link>
              }

            </div>
          );
        })}
      </div>
    ) : (
      <div className="empty"><Layers size={35} /><h2>No apps here yet</h2><p>{filters.search || filters.platform ? 'Try a different search or platform.' : principal.role === 'CUSTOMER' ? 'Your administrator will make apps available here.' : 'No published apps yet.'}</p></div>
    )}
    <p className="footer-note"><ShieldCheck size={12} />Access managed by your administrator</p>
  </>;
}
