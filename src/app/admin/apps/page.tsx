import Link from 'next/link';
import { ArrowUpRight, Layers } from 'lucide-react';
import { requirePagePrincipal } from '@/server/page-auth';
import { listAdminApps } from '@/server/services/apps';
import { AppForm } from '@/components/admin-forms';
export default async function AppsPage() {
  const apps = await listAdminApps(await requirePagePrincipal('/admin/apps'));
  return <><div className="page-heading"><div><div className="eyebrow">Release management</div><h1>Apps & releases</h1><p>Upload app versions, share feature notes, and manage publication.</p></div><span className="badge neutral">{apps.length} apps</span></div><section className="panel"><h2>Create an app</h2><AppForm /></section><section className="panel"><h2>All apps</h2>{apps.length ? apps.map(app => <div className="row" key={app.id}><div className="row-main"><Link href={`/admin/apps/${app.id}`}><h3>{app.name}</h3></Link><small>{app.platform} · {app._count.releases} versions · {app._count.assignments} companies</small></div><div className="row-actions"><span className={`badge ${app.active ? '' : 'neutral'}`}>{app.active ? 'Active' : 'Disabled'}</span><Link href={`/admin/apps/${app.id}`} className="button secondary small">Manage releases<ArrowUpRight size={13} /></Link></div></div>) : <div className="empty"><Layers size={30} /><h2>Add your first app</h2><p>Create an app, then upload a binary and release notes.</p></div>}</section></>;
}
