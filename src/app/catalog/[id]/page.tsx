import Link from 'next/link';
import { ArrowLeft, Package, ShieldCheck } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requirePagePrincipal } from '@/server/page-auth';
import { getAppDetail } from '@/server/services/apps';
import { AppError } from '@/server/errors';
import { DownloadButton } from '@/components/download-button';
import { formatDate, formatSize } from '@/lib/format';
export default async function AppPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await requirePagePrincipal(`/catalog/${id}`);
  const app = await getAppDetail(principal, id).catch(error => { if (error instanceof AppError && error.status === 403) notFound(); throw error; });
  return <><Link className="back-link" href="/catalog"><ArrowLeft size={13} />Back to your library</Link><div className="page-heading"><div><div className="eyebrow">{app.platform} application</div><h1>{app.name}</h1><p>{app.description}</p></div><div className="app-symbol"><Package size={27} /></div></div><div className="section-title"><h2>Release history</h2><span>{app.releases.length} published versions</span></div>{app.releases.length ? app.releases.map((release, index) => <article className={`release ${index === 0 ? 'latest' : ''}`} key={release.id}><div className="release-heading"><div className="release-title"><h2>Version {release.version}</h2>{index === 0 && <span className="badge">Latest release</span>}</div>{principal.role !== 'VIEWER' && <DownloadButton id={release.id} version={release.version} />}</div><div className="eyebrow">What’s new</div><p className="notes">{release.notes || 'No feature notes were added to this release.'}</p><div className="release-info"><span>Published {formatDate(release.publishedAt)}</span><span>{formatSize(release.size)}</span><span>{release.filename}</span></div><p className="checksum">SHA-256: {release.checksum}</p></article>) : <div className="empty"><h2>No published versions yet</h2><p>Check back when your administrator publishes the first release.</p></div>}{principal.role === 'VIEWER' && <p className="hint">Your viewer role includes release details and feature notes. Downloads are available to assigned customers and administrators.</p>}<p className="footer-note"><ShieldCheck size={12} />All downloads require an authorized company account</p></>;
}
