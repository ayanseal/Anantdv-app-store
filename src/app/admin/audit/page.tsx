import { db } from '@/server/db';
import { requirePagePrincipal } from '@/server/page-auth';
import { requireAdminOrViewer } from '@/server/auth/principal';
import { formatDate } from '@/lib/format';
export default async function AuditPage() {
  const actor = await requirePagePrincipal('/admin/audit');
  requireAdminOrViewer(actor);
  const events = await db.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  const ids = [...new Set(events.map(e => e.actorId).filter((id): id is string => !!id))];
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const names = new Map(users.map(u => [u.id, u.name]));
  return <><div className="page-heading"><div><div className="eyebrow">Workspace history</div><h1>Activity log</h1><p>Account changes, release activity, security events, and download requests.</p></div><span className="badge neutral">Latest 200 events</span></div><section className="panel">{events.map(event => <div className="resource" key={event.id}><div className="resource-heading"><h3 style={{ textTransform: 'capitalize' }}>{event.action.replaceAll('_', ' ').toLowerCase()}</h3><small className="muted">{formatDate(event.createdAt)} · {new Date(event.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}</small></div><p className="hint">{event.actorId ? names.get(event.actorId) || 'Former account' : 'System'}{event.targetId ? ` · Reference ${event.targetId}` : ''}</p>{event.metadata !== '{}' && <p className="hint" style={{ marginTop: 6 }}>{Object.entries(JSON.parse(event.metadata)).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</p>}</div>)}{!events.length && <p className="muted">No events yet.</p>}</section></>;
}
