import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Building2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { requirePagePrincipal } from '@/server/page-auth';
import { requireAdminOrViewer } from '@/server/auth/principal';
import { listAdminApps } from '@/server/services/apps';
import { CompanyAssignments, CompanyLogoForm } from '@/components/admin-forms';
import { formatDate } from '@/lib/format';

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePagePrincipal(`/admin/companies/${id}`); requireAdminOrViewer(actor);
  const isAdmin = actor.role === 'ADMIN';
  const [company, apps] = await Promise.all([
    db.company.findUnique({ where: { id }, include: { assignments: { include: { app: { include: { releases: { orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], select: { id: true, version: true, notes: true, published: true, publishedAt: true } } } } } }, users: { select: { id: true, name: true, email: true, active: true } } } }),
    listAdminApps(actor),
  ]);
  if (!company) notFound();
  return <>
    <Link className="back-link" href="/admin/companies"><ArrowLeft size={13} />All companies</Link>

    <div className="page-heading">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {company.logoUrl
          ? <Image src={company.logoUrl} alt={`${company.name} logo`} width={52} height={52} style={{ borderRadius: 12, border: '1px solid var(--line)', objectFit: 'contain', background: '#fff' }} unoptimized />
          : <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--brand-light)', display: 'grid', placeItems: 'center', border: '1px solid var(--line)', color: 'var(--brand)' }}><Building2 size={24} /></div>
        }
        <div>
          <div className="eyebrow">Company workspace</div>
          <h1>{company.name}</h1>
          <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>{company.users.length} accounts · {company.assignments.length} assigned apps</p>
        </div>
      </div>
      <span className={`badge ${company.active ? '' : 'neutral'}`}>{company.active ? 'Active' : 'Disabled'}</span>
    </div>

    <div className="split">
      <div>
        <section className="panel">
          <h2>Assigned applications</h2>
          {isAdmin ? (
            <CompanyAssignments companyId={id} apps={apps} selected={company.assignments.map(a => a.appId)} />
          ) : (
            <div>
              {company.assignments.length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {company.assignments.map(a => (
                    <span className="badge" key={a.appId}>{a.app.name} ({a.app.platform})</span>
                  ))}
                </div>
              ) : (
                <p className="muted">No assigned applications.</p>
              )}
            </div>
          )}
        </section>

        <div className="section-title"><h2>Apps & versions</h2></div>
        {company.assignments.length ? company.assignments.map(({ app }) => (
          <section className="panel" key={app.id}>
            <div className="resource-heading">
              <Link href={`/admin/apps/${app.id}`}><h2>{app.name}</h2></Link>
              <span className="badge neutral">{app.platform}</span>
            </div>
            {app.releases.length ? app.releases.map(release => (
              <div className="resource" key={release.id}>
                <div className="resource-heading">
                  <h3>Version {release.version}</h3>
                  <span className={`badge ${release.published ? '' : 'neutral'}`}>{release.published ? formatDate(release.publishedAt) : 'Draft'}</span>
                </div>
                <p style={{ whiteSpace: 'pre-wrap' }} className="muted">{release.notes || 'No feature notes.'}</p>
              </div>
            )) : <p className="muted">No versions uploaded yet.</p>}
          </section>
        )) : <div className="empty"><h2>No assigned apps</h2><p>Select apps above to make them available to this company.</p></div>}
      </div>

      <div>
        {isAdmin && (
          <section className="panel">
            <h2>Company logo</h2>
            <CompanyLogoForm companyId={id} currentLogoUrl={company.logoUrl} />
            <p className="hint" style={{ marginTop: 8 }}>The logo is shown on the company's profile page.</p>
          </section>
        )}

        <section className="panel">
          <h2>Company users</h2>
          {company.users.map(user => (
            <div className="row" key={user.id}>
              <div><strong>{user.name}</strong><small>{user.email}</small></div>
              <span className={`badge ${user.active ? '' : 'neutral'}`}>{user.active ? 'Active' : 'Disabled'}</span>
            </div>
          ))}
          <Link href="/admin/users" className="text-button">Manage users →</Link>
        </section>
      </div>
    </div>
  </>;
}
