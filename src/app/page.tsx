import Image from 'next/image';
import Link from 'next/link';
import { Search, Package, LogIn, Lock, LayoutDashboard, ShieldCheck, Zap, Layers, Clock, ArrowRight } from 'lucide-react';
import { listCatalog } from '@/server/services/apps';
import { formatSize, formatDate } from '@/lib/format';
import { PublicDownload } from '@/components/download-button';
import { PlatformSelect } from '@/components/platform-select';
import { getRequestPrincipal } from '@/server/http';

const platformEmoji: Record<string, string> = { Android: '🤖', iOS: '🍎', Windows: '🪟', macOS: '🍏', Linux: '🐧', Other: '📦' };
const platformColor: Record<string, string> = { Android: 'android', iOS: 'ios', Windows: 'windows', macOS: 'macos', Linux: 'linux', Other: 'other' };

const quickPlatforms = [
  { label: 'All', value: '', emoji: '✨' },
  { label: 'Android', value: 'Android', emoji: '🤖' },
  { label: 'Windows', value: 'Windows', emoji: '🪟' },
  { label: 'macOS', value: 'macOS', emoji: '🍏' },
  { label: 'iOS', value: 'iOS', emoji: '🍎' },
  { label: 'Linux', value: 'Linux', emoji: '🐧' },
];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ search?: string; platform?: string }> }) {
  const filters = await searchParams;
  const apps = await listCatalog(null, filters);

  let principal = null;
  try {
    principal = await getRequestPrincipal();
  } catch {}

  const currentPlatform = filters.platform || '';

  return (
    <div className="public-store">
      {/* Topbar */}
      <header className="public-topbar">
        <Link href="/" className="brand">
          <div className="brand-icon"><Package size={19} /></div>
          <span>Anantdv<small>APP STORE</small></span>
        </Link>
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

      {/* Hero */}
      <section className="public-hero">
        <div className="public-hero-inner">
          <div className="hero-pill-badge">
            <span className="badge-dot"></span>
            <span>Enterprise Software Distribution</span>
          </div>
          <h1>
            Discover & Download<br />
            <span className="gradient-text">Enterprise Applications</span>
          </h1>
          <p className="hero-subtitle">
            Direct access to verified application binaries across Android, Windows, macOS, iOS, and Linux. No account required for public releases.
          </p>

          {/* Search Island */}
          <form className="hero-search-island" action="/">
            <div className="input-wrap">
              <Search size={16} />
              <input name="search" placeholder="Search applications, tags, or features…" defaultValue={filters.search} />
            </div>
            <PlatformSelect defaultValue={currentPlatform} />
            <button className="hero-search-btn" type="submit">
              Search
            </button>
          </form>

          {/* Quick Platform Filter Pills */}
          <div className="quick-pills-row">
            {quickPlatforms.map(p => {
              const isActive = (p.value === '' && !currentPlatform) || (p.value !== '' && currentPlatform.toLowerCase() === p.value.toLowerCase());
              const href = p.value
                ? `/?platform=${encodeURIComponent(p.value)}${filters.search ? `&search=${encodeURIComponent(filters.search)}` : ''}`
                : (filters.search ? `/?search=${encodeURIComponent(filters.search)}` : '/');
              return (
                <Link key={p.label} href={href} className={`quick-pill ${isActive ? 'active' : ''}`}>
                  <span>{p.emoji}</span>
                  <span>{p.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust & Quality Features Strip */}
      <section className="trust-strip">
        <div className="trust-strip-inner">
          <div className="trust-item">
            <div className="trust-icon-box"><Zap size={18} /></div>
            <div className="trust-content">
              <h4>Direct Instant Downloads</h4>
              <p>High-speed distribution directly from verified release storage.</p>
            </div>
          </div>
          <div className="trust-item">
            <div className="trust-icon-box"><ShieldCheck size={18} /></div>
            <div className="trust-content">
              <h4>SHA-256 Verified</h4>
              <p>Cryptographic integrity hashes verified on every application release.</p>
            </div>
          </div>
          <div className="trust-item">
            <div className="trust-icon-box"><Layers size={18} /></div>
            <div className="trust-content">
              <h4>Cross-Platform Support</h4>
              <p>Packages for Android, iOS, Windows, macOS, and Linux.</p>
            </div>
          </div>
          <div className="trust-item">
            <div className="trust-icon-box"><Lock size={18} /></div>
            <div className="trust-content">
              <h4>Enterprise Workspace</h4>
              <p>Private company accounts with tenant-isolated release channels.</p>
            </div>
          </div>
        </div>
      </section>

      {/* App Grid */}
      <main className="public-content">
        <div className="store-header-row">
          <div>
            <h2>Explore Applications</h2>
            <p>
              {currentPlatform
                ? `Showing ${currentPlatform} applications available for immediate installation`
                : 'All verified software builds available for immediate installation'}
            </p>
          </div>
          <div className="store-count-badge">
            <Package size={14} />
            <span>{apps.length} {apps.length === 1 ? 'App available' : 'Apps available'}</span>
          </div>
        </div>

        {apps.length ? (
          <div className="store-grid">
            {apps.map(app => {
              const latest = app.releases[0];
              return (
                <div className="store-card" key={app.id}>
                  <Link href={`/store/${app.id}`} className="store-icon-banner" tabIndex={-1} aria-hidden="true">
                    {app.iconUrl ? (
                      <Image src={app.iconUrl} alt="" width={300} height={300} className="store-banner-img" unoptimized />
                    ) : (
                      <div className={`store-icon-placeholder-full ${platformColor[app.platform] || 'other'}`}>
                        <span>{platformEmoji[app.platform] || '📦'}</span>
                      </div>
                    )}
                  </Link>
                  <div className="store-card-body">
                    <Link href={`/store/${app.id}`} className="store-app-name">{app.name}</Link>
                    <div className="store-meta-row">
                      <span className={`store-platform-tag ${platformColor[app.platform] || 'other'}`}>{app.platform}</span>
                      {latest && (
                        <>
                          <span className="store-version-pill">v{latest.version}</span>
                          <span className="store-version-pill">{formatSize(latest.size)}</span>
                        </>
                      )}
                    </div>
                    <p className="store-description">{app.description || 'Available for immediate download.'}</p>
                    {latest && (
                      <span className="store-update-date">
                        <Clock size={11} />
                        <span>Updated {formatDate(latest.publishedAt)}</span>
                      </span>
                    )}
                  </div>
                  {latest ? (
                    <PublicDownload id={latest.id} version={latest.version} />
                  ) : (
                    <span className="store-view-btn" style={{ opacity: 0.5, cursor: 'default' }}>No releases yet</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            <Package size={35} />
            <h2>No public apps found</h2>
            <p>{filters.search || filters.platform ? 'Try a different search term or platform filter.' : 'Check back soon for available downloads.'}</p>
          </div>
        )}

        {/* Enterprise Callout Card */}
        <section className="modern-enterprise-card">
          <div className="enterprise-card-left">
            <div className="enterprise-card-icon">
              <ShieldCheck size={26} />
            </div>
            <div className="enterprise-card-text">
              <h3>Looking for your company’s private releases?</h3>
              <p>Sign in with your work credentials to access proprietary internal applications, staging channels, and assigned release binaries.</p>
            </div>
          </div>
          <Link href={principal ? (principal.role === 'ADMIN' ? '/admin' : '/catalog') : '/login'} className="enterprise-card-btn">
            {principal ? 'Go to your dashboard' : 'Sign in to workspace'}
            <ArrowRight size={15} />
          </Link>
        </section>
      </main>

      {/* Modern Footer */}
      <footer className="public-footer">
        <div className="public-footer-inner">
          <div className="footer-brand-col">
            <div className="brand" style={{ gap: 8 }}>
              <div className="brand-icon" style={{ width: 28, height: 28 }}><Package size={16} /></div>
              <span style={{ fontSize: 15 }}>Anantdv<small style={{ fontSize: 8.5 }}>APP STORE</small></span>
            </div>
            <p className="footer-tagline">Secure, unified application distribution platform for enterprise and public releases.</p>
          </div>
          <div className="footer-status-col">
            <div className="system-status-indicator">
              <span className="status-dot"></span>
              <span>All download mirrors operational</span>
            </div>
            <div className="footer-copyright">
              © {new Date().getFullYear()} Anantdv App Store. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
