import { requirePagePrincipal } from '@/server/page-auth';
import { listUsers } from '@/server/services/users';
import { listCompanies } from '@/server/services/companies';
import { UserForm, ResetCredential } from '@/components/admin-forms';
export default async function UsersPage() {
  const actor = await requirePagePrincipal('/admin/users');
  const [users, companies] = await Promise.all([listUsers(actor), listCompanies(actor)]);
  return <><div className="page-heading"><div><div className="eyebrow">Access management</div><h1>Users & roles</h1><p>Individual accounts, company membership, and the right level of access.</p></div><span className="badge neutral">{users.length} accounts</span></div><section className="panel"><h2>Create a user</h2><UserForm companies={companies} /></section><section className="panel"><h2>All users</h2>{users.map(user => <div className="resource" key={user.id}><div className="resource-heading"><div><h3>{user.name}</h3><small className="muted">{user.email} · {user.company?.name || 'Workspace-wide access'}</small></div><div className="row-actions"><span className="badge neutral">{user.role.toLowerCase()}</span><span className={`badge ${user.active ? '' : 'neutral'}`}>{user.active ? 'Active' : 'Disabled'}</span></div></div><div className="hint" style={{ marginBottom: 10 }}>{user.mustChangePassword ? 'Password change required at next login' : user.role === 'ADMIN' ? user.mfaEnabled ? 'Authenticator enabled' : 'Authenticator enrollment required' : 'Account ready'}</div><details><summary>Edit account & credentials</summary><UserForm user={user} companies={companies} /><ResetCredential id={user.id} />{user.role === 'ADMIN' && user.id !== actor.id && <ResetCredential id={user.id} mfa />}</details></div>)}</section></>;
}
