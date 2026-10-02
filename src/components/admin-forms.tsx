'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Upload, Check } from 'lucide-react';
import { api } from '@/lib/api-client';
type Company = { id: string; name: string; slug: string; active: boolean };
type App = { id: string; name: string; slug: string; description: string; platform: string; active: boolean };
type User = { id: string; name: string; email: string; role: string; companyId: string | null; active: boolean };
function ManagedForm({ children, endpoint, build, label, reset = false }: { children: React.ReactNode; endpoint: string; build: (data: FormData) => unknown; label: string; reset?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [credential, setCredential] = useState('');
  return <form className="form-stack" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess(''); setCredential('');
    const form = event.currentTarget;
    try {
      const payload = build(new FormData(form));
      const result = await api<{ temporaryPassword?: string }>(endpoint, { method: 'POST', body: payload instanceof FormData ? payload : JSON.stringify(payload) });
      setSuccess('Saved successfully.'); setCredential(result.temporaryPassword || '');
      if (reset) form.reset(); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save.'); }
    finally { setBusy(false); }
  }}>{children}{error && <div role="alert" className="error">{error}</div>}{success && <div role="status" className="success">{success}{credential && <><p>Share this temporary password privately with the user. They must change it at first login.</p><code>{credential}</code><button className="text-button" type="button" onClick={() => setCredential('')}>Dismiss password</button></>}</div>}<button className="button" disabled={busy}>{busy ? 'Saving…' : label}{label.startsWith('Create') ? <Plus size={14} /> : label.startsWith('Upload') ? <Upload size={14} /> : <Check size={14} />}</button></form>;
}
export function CompanyForm({ company }: { company?: Company }) {
  return <ManagedForm endpoint="/api/admin/companies" label={company ? 'Save company' : 'Create company'} reset={!company} build={data => ({ id: company?.id, name: data.get('name'), slug: data.get('slug'), active: data.get('active') === 'on' })}><div className="form-grid"><label className="field">Company name<input name="name" defaultValue={company?.name} placeholder="Acme Technologies" required maxLength={100} /></label><label className="field">Company slug<input name="slug" defaultValue={company?.slug} placeholder="acme-technologies" pattern="[a-z0-9]+(-[a-z0-9]+)*" required maxLength={80} /></label></div><label className="check"><input type="checkbox" name="active" defaultChecked={company?.active ?? true} />Company is active</label></ManagedForm>;
}
export function UserForm({ user, companies }: { user?: User; companies: Company[] }) {
  const [role, setRole] = useState(user?.role || 'CUSTOMER');
  return <ManagedForm endpoint="/api/admin/users" label={user ? 'Save user' : 'Create user'} reset={!user} build={data => ({ id: user?.id, name: data.get('name'), email: data.get('email'), role: data.get('role'), companyId: data.get('companyId') || null, active: data.get('active') === 'on' })}><div className="form-grid"><label className="field">Full name<input name="name" defaultValue={user?.name} required maxLength={100} placeholder="Full name" /></label><label className="field">Email address<input name="email" type="email" defaultValue={user?.email} required maxLength={254} placeholder="name@company.com" /></label><label className="field">Role<select name="role" value={role} onChange={event => setRole(event.target.value)}><option value="CUSTOMER">Customer</option><option value="VIEWER">Viewer</option><option value="ADMIN">Administrator</option></select></label><label className="field">Company<select name="companyId" defaultValue={user?.companyId || ''} required={role === 'CUSTOMER'} disabled={role !== 'CUSTOMER'}><option value="">Select a company</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}{!company.active ? ' (inactive)' : ''}</option>)}</select></label></div><label className="check"><input type="checkbox" name="active" defaultChecked={user?.active ?? true} />Account is active</label><p className="hint">Customers download company-assigned apps. Viewers browse all apps. Administrators must enroll an authenticator.</p></ManagedForm>;
}
export function AppForm({ app }: { app?: App }) {
  return <ManagedForm endpoint="/api/admin/apps" label={app ? 'Save app' : 'Create app'} reset={!app} build={data => ({ id: app?.id, name: data.get('name'), slug: data.get('slug'), description: data.get('description'), platform: data.get('platform'), active: data.get('active') === 'on' })}><div className="form-grid"><label className="field">App name<input name="name" defaultValue={app?.name} placeholder="Your application" required maxLength={100} /></label><label className="field">App slug<input name="slug" defaultValue={app?.slug} placeholder="your-application" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} /></label></div><label className="field">Platform<select name="platform" defaultValue={app?.platform || 'Android'}>{['Android', 'iOS', 'Windows', 'macOS', 'Linux', 'Other'].map(platform => <option key={platform}>{platform}</option>)}</select></label><label className="field">Description<textarea name="description" defaultValue={app?.description} maxLength={3000} placeholder="What this app helps your customers do" /></label><label className="check"><input name="active" type="checkbox" defaultChecked={app?.active ?? true} />App is active</label></ManagedForm>;
}
export function CompanyAssignments({ companyId, apps, selected }: { companyId: string; apps: App[]; selected: string[] }) {
  return <ManagedForm endpoint={`/api/admin/companies/${companyId}/apps`} label="Save app assignments" build={data => ({ appIds: data.getAll('appIds') })}>{apps.length ? apps.map(app => <label className="check" key={app.id}><input type="checkbox" name="appIds" value={app.id} defaultChecked={selected.includes(app.id)} />{app.name}<span className="badge neutral">{app.platform}{!app.active ? ' · Inactive' : ''}</span></label>) : <p className="hint">Create an app before assigning it to a company.</p>}<p className="hint">Customers in this company can download every published version of each assigned app.</p></ManagedForm>;
}
export function ReleaseForm({ appId, maxMb, extensions }: { appId: string; maxMb: number; extensions: string[] }) {
  return <ManagedForm endpoint={`/api/admin/apps/${appId}/releases`} label="Upload release" reset build={data => { data.set('published', data.get('published') === 'on' ? 'true' : 'false'); return data; }}><label className="field">Version label<input name="version" placeholder="e.g. 2.1.0" required maxLength={60} /></label><label className="field">App binary<input type="file" name="file" required accept={extensions.map(e => `.${e}`).join(',')} /></label><p className="hint">Maximum {maxMb} MB · {extensions.join(', ')}</p><label className="field">Features & release notes<textarea name="notes" maxLength={15000} placeholder="Describe the features and changes included in this version." /></label><label className="check"><input type="checkbox" name="published" defaultChecked />Publish this release immediately</label></ManagedForm>;
}
export function ReleasePublish({ id, published }: { id: string; published: boolean }) { return <ManagedForm endpoint={`/api/admin/releases/${id}`} label={published ? 'Unpublish' : 'Publish release'} build={() => ({ published: !published })}><p className="hint">{published ? 'Unpublish to remove customer and viewer access to this release.' : 'Make this version available to assigned customers and viewers.'}</p></ManagedForm>; }
export function ResetCredential({ id, mfa = false }: { id: string; mfa?: boolean }) { return <ManagedForm endpoint={`/api/admin/users/${id}/${mfa ? 'mfa' : 'password'}`} label={mfa ? 'Reset authenticator' : 'Reset password'} build={() => ({})}><p className="hint">{mfa ? 'Requires authenticator enrollment again and ends existing sessions. Another administrator must reset your authenticator.' : 'Ends existing sessions and generates a new temporary password.'}</p></ManagedForm>; }
