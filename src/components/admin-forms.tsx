'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Upload, Check, ImagePlus, Globe, Lock, FileUp, X, Package, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { api } from '@/lib/api-client';
import { formatSize } from '@/lib/format';

type Company = { id: string; name: string; slug: string; active: boolean; logoUrl?: string | null };
type App = { id: string; name: string; slug: string; description: string; platform: string; active: boolean; isPublic?: boolean; iconUrl?: string | null };
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

function ImageUploadWidget({ label, endpoint, currentUrl, onSave }: { label: string; endpoint: string; currentUrl?: string | null; onSave?: (url: string) => void }) {
  const router = useRouter();
  const [preview, setPreview] = useState(currentUrl || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUrl) setPreview(currentUrl);
  }, [currentUrl]);

  async function upload(file: File) {
    setBusy(true); setError('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const result = await api<{ iconUrl?: string; logoUrl?: string }>(endpoint, { method: 'POST', body: fd });
      const url = result.iconUrl || result.logoUrl || '';
      setPreview(url);
      onSave?.(url);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setBusy(false); }
  }
  return <div className="icon-upload-widget">
    <div className="icon-preview" onClick={() => inputRef.current?.click()} title="Click to upload">
      {preview ? <Image src={preview} alt={label} width={72} height={72} className="icon-preview-img" unoptimized /> : <div className="icon-preview-empty"><ImagePlus size={24} /></div>}
      {busy && <div className="icon-uploading"><div className="spinner" /></div>}
    </div>
    <div>
      <button className="button secondary small" type="button" disabled={busy} onClick={() => inputRef.current?.click()}><ImagePlus size={13} />{preview ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}</button>
      <p className="hint" style={{ marginTop: 6 }}>PNG, JPG or WebP · max 2 MB</p>
      {error && <p className="error" style={{ marginTop: 6 }}>{error}</p>}
    </div>
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
  </div>;
}

export function CompanyForm({ company }: { company?: Company }) {
  return <ManagedForm endpoint="/api/admin/companies" label={company ? 'Save company' : 'Create company'} reset={!company} build={data => ({ id: company?.id, name: data.get('name'), slug: data.get('slug'), active: data.get('active') === 'on' })}>
    <div className="form-grid">
      <label className="field">Company name<input name="name" defaultValue={company?.name} placeholder="Acme Technologies" required maxLength={100} /></label>
      <label className="field">Company slug<input name="slug" defaultValue={company?.slug} placeholder="acme-technologies" pattern="[a-z0-9]+(-[a-z0-9]+)*" required maxLength={80} /></label>
    </div>
    <label className="check"><input type="checkbox" name="active" defaultChecked={company?.active ?? true} />Company is active</label>
  </ManagedForm>;
}

export function CompanyLogoForm({ companyId, currentLogoUrl }: { companyId: string; currentLogoUrl?: string | null }) {
  return <ImageUploadWidget label="Logo" endpoint={`/api/admin/companies/${companyId}/logo`} currentUrl={currentLogoUrl} />;
}

export function UserForm({ user, companies }: { user?: User; companies: Company[] }) {
  const [role, setRole] = useState(user?.role || 'CUSTOMER');
  return <ManagedForm endpoint="/api/admin/users" label={user ? 'Save user' : 'Create user'} reset={!user} build={data => ({ id: user?.id, name: data.get('name'), email: data.get('email'), role: data.get('role'), companyId: data.get('companyId') || null, active: data.get('active') === 'on' })}>
    <div className="form-grid">
      <label className="field">Full name<input name="name" defaultValue={user?.name} required maxLength={100} placeholder="Full name" /></label>
      <label className="field">Email address<input name="email" type="email" defaultValue={user?.email} required maxLength={254} placeholder="name@company.com" /></label>
      <label className="field">Role<select name="role" value={role} onChange={e => setRole(e.target.value)}><option value="CUSTOMER">Customer</option><option value="VIEWER">Viewer</option><option value="ADMIN">Administrator</option></select></label>
      <label className="field">Company<select name="companyId" defaultValue={user?.companyId || ''} required={role === 'CUSTOMER'} disabled={role !== 'CUSTOMER'}><option value="">Select a company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}{!c.active ? ' (inactive)' : ''}</option>)}</select></label>
    </div>
    <label className="check"><input type="checkbox" name="active" defaultChecked={user?.active ?? true} />Account is active</label>
    <p className="hint">Customers download company-assigned apps. Viewers browse all apps without downloading.</p>
  </ManagedForm>;
}

export function AppForm({ app }: { app?: App }) {
  return <ManagedForm endpoint="/api/admin/apps" label={app ? 'Save app' : 'Create app'} reset={!app} build={data => ({ id: app?.id, name: data.get('name'), slug: data.get('slug'), description: data.get('description'), platform: data.get('platform'), active: data.get('active') === 'on', isPublic: data.get('isPublic') === 'on' })}>
    <div className="form-grid">
      <label className="field">App name<input name="name" defaultValue={app?.name} placeholder="Your application" required maxLength={100} /></label>
      <label className="field">App slug<input name="slug" defaultValue={app?.slug} placeholder="your-application" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} /></label>
    </div>
    <label className="field">Platform<select name="platform" defaultValue={app?.platform || 'Android'}>{['Android', 'iOS', 'Windows', 'macOS', 'Linux', 'Other'].map(p => <option key={p}>{p}</option>)}</select></label>
    <label className="field">Description<textarea name="description" defaultValue={app?.description} maxLength={3000} placeholder="What this app helps your customers do" /></label>
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <label className="check"><input name="active" type="checkbox" defaultChecked={app?.active ?? true} />App is active</label>
      <label className="check" title="Public apps appear on the public store and can be downloaded without an account">
        <input name="isPublic" type="checkbox" defaultChecked={app?.isPublic ?? false} />
        <Globe size={13} style={{ color: 'var(--brand)' }} />Publicly visible
      </label>
    </div>
    <p className="hint"><Lock size={11} style={{ display: 'inline', marginRight: 4 }} />Private apps are only visible to assigned companies. Public apps appear on the public store.</p>
  </ManagedForm>;
}

export function AppIconForm({ appId, currentIconUrl }: { appId: string; currentIconUrl?: string | null }) {
  return <ImageUploadWidget label="Icon" endpoint={`/api/admin/apps/${appId}/icon`} currentUrl={currentIconUrl} />;
}

export function AppCompanyAssignments({ appId, companies, selected }: { appId: string; companies: { id: string; name: string; active: boolean }[]; selected: string[] }) {
  return <ManagedForm endpoint={`/api/admin/apps/${appId}/companies`} label="Save company assignments" build={data => ({ companyIds: data.getAll('companyIds') })}>
    {companies.length
      ? companies.map(company => (
          <label className="check" key={company.id}>
            <input type="checkbox" name="companyIds" value={company.id} defaultChecked={selected.includes(company.id)} />
            {company.name}
            <span className={`badge ${company.active ? 'neutral' : 'neutral'}`} style={{ opacity: company.active ? 1 : 0.5 }}>{company.active ? 'Active' : 'Inactive'}</span>
          </label>
        ))
      : <p className="hint">No companies yet. <a href="/admin/companies">Create a company first.</a></p>
    }
    <p className="hint">Private app customers will only see this app if their company is checked here. Public apps are visible to everyone regardless.</p>
  </ManagedForm>;
}

export function CompanyAssignments({ companyId, apps, selected }: { companyId: string; apps: App[]; selected: string[] }) {
  return <ManagedForm endpoint={`/api/admin/companies/${companyId}/apps`} label="Save app assignments" build={data => ({ appIds: data.getAll('appIds') })}>{apps.length ? apps.map(app => <label className="check" key={app.id}><input type="checkbox" name="appIds" value={app.id} defaultChecked={selected.includes(app.id)} />{app.name}<span className="badge neutral">{app.platform}{!app.active ? ' · Inactive' : ''}</span>{app.isPublic && <span className="badge"><Globe size={10} />Public</span>}</label>) : <p className="hint">Create an app before assigning it to a company.</p>}<p className="hint">Customers in this company can download every published version of each assigned app.</p></ManagedForm>;
}

export function ReleaseForm({ appId, maxMb, extensions }: { appId: string; maxMb: number; extensions: string[] }) {
  return <ManagedForm endpoint={`/api/admin/apps/${appId}/releases`} label="Upload release" reset build={data => { data.set('published', data.get('published') === 'on' ? 'true' : 'false'); return data; }}><label className="field">Version label<input name="version" placeholder="e.g. 2.1.0" required maxLength={60} /></label><label className="field">App binary<input type="file" name="file" required accept={extensions.map(e => `.${e}`).join(',')} /></label><p className="hint">Maximum {maxMb} MB · {extensions.join(', ')}</p><label className="field">Features & release notes<textarea name="notes" maxLength={15000} placeholder="Describe the features and changes included in this version." /></label><label className="check"><input type="checkbox" name="published" defaultChecked />Publish this release immediately</label></ManagedForm>;
}

export function ReleasePublish({ id, published }: { id: string; published: boolean }) { return <ManagedForm endpoint={`/api/admin/releases/${id}`} label={published ? 'Unpublish' : 'Publish release'} build={() => ({ published: !published })}><p className="hint">{published ? 'Unpublish to remove customer and viewer access to this release.' : 'Make this version available to assigned customers and viewers.'}</p></ManagedForm>; }

export function ResetCredential({ id, mfa = false }: { id: string; mfa?: boolean }) { return <ManagedForm endpoint={`/api/admin/users/${id}/${mfa ? 'mfa' : 'password'}`} label={mfa ? 'Reset authenticator' : 'Reset password'} build={() => ({})}><p className="hint">{mfa ? 'Requires authenticator enrollment again and ends existing sessions. Another administrator must reset your authenticator.' : 'Ends existing sessions and generates a new temporary password.'}</p></ManagedForm>; }


export function CreateAppFullForm({
  companies,
  maxMb,
  extensions,
}: {
  companies: Company[];
  maxMb: number;
  extensions: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [platform, setPlatform] = useState('Android');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [active, setActive] = useState(true);

  // Photo / Icon
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState('');
  const iconInputRef = useRef<HTMLInputElement>(null);

  // Binary APK
  const [binaryFile, setBinaryFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [publishImmediately, setPublishImmediately] = useState(true);
  const binaryInputRef = useRef<HTMLInputElement>(null);

  // Companies
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  // State
  const [busy, setBusy] = useState(false);
  const [stepText, setStepText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function handleNameChange(val: string) {
    setName(val);
    if (!slugEdited) {
      const s = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
      setSlug(s);
    }
  }

  function handleIconFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Selected icon must be an image file (PNG, JPG, WebP, GIF, SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('App photo must be under 2 MB.');
      return;
    }
    setError('');
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  }

  function handleBinaryFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !extensions.includes(ext)) {
      setError(`Selected file format (.${ext || 'unknown'}) is not supported. Allowed formats: ${extensions.join(', ')}`);
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Binary exceeds max upload size of ${maxMb} MB.`);
      return;
    }
    setError('');
    setBinaryFile(file);
    if (!version) {
      const match = file.name.match(/v?(\d+\.\d+(?:\.\d+)?)/i);
      if (match) setVersion(match[1]);
      else setVersion('1.0.0');
    }
  }

  function toggleCompany(id: string) {
    setSelectedCompanyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function selectAllCompanies() {
    setSelectedCompanyIds(companies.map(c => c.id));
  }

  function clearCompanies() {
    setSelectedCompanyIds([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('App name is required.');
      return;
    }
    if (!slug.trim()) {
      setError('App slug is required.');
      return;
    }
    // Mandatory company allocation for private apps
    if (!isPublic && selectedCompanyIds.length === 0) {
      setError('Mandatory requirement: Private applications must be allocated to at least one company. Please check a company below.');
      return;
    }
    if (binaryFile && !version.trim()) {
      setError('Version label (e.g. 1.0.0) is required when uploading an app binary.');
      return;
    }

    setBusy(true);
    try {
      // 1. Create App
      setStepText('1/4 Creating application profile…');
      const app = await api<App>('/api/admin/apps', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          platform,
          description: description.trim(),
          active,
          isPublic,
        }),
      });

      // 2. Assign Companies
      if (selectedCompanyIds.length > 0) {
        setStepText('2/4 Saving company permissions…');
        await api(`/api/admin/apps/${app.id}/companies`, {
          method: 'POST',
          body: JSON.stringify({ companyIds: selectedCompanyIds }),
        });
      }

      // 3. Upload Icon (locally on server)
      if (iconFile) {
        setStepText('3/4 Storing app photo locally on server…');
        const fd = new FormData();
        fd.append('file', iconFile);
        await api(`/api/admin/apps/${app.id}/icon`, {
          method: 'POST',
          body: fd,
        });
      }

      // 4. Upload Binary (locally on server)
      if (binaryFile) {
        setStepText('4/4 Storing APK release locally on server…');
        const fd = new FormData();
        fd.append('file', binaryFile);
        fd.append('version', version.trim());
        fd.append('notes', notes.trim());
        fd.append('published', publishImmediately ? 'true' : 'false');
        await api(`/api/admin/apps/${app.id}/releases`, {
          method: 'POST',
          body: fd,
        });
      }

      setStepText('Application uploaded successfully! Redirecting…');
      setSuccess('Application and assets stored locally on server.');
      router.push(`/admin/apps/${app.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setBusy(false);
    }
  }

  return (
    <form className="full-upload-card" onSubmit={handleSubmit}>
      {/* ── SECTION 1: Identity & Photo ── */}
      <section className="upload-section">
        <div className="upload-section-title">
          <h3><ImagePlus size={16} style={{ color: 'var(--brand)' }} />App Identity & Photo</h3>
          <span className="desc">Photo and APK will be stored locally in server repository</span>
        </div>

        <div className="photo-upload-row">
          <div
            className="photo-preview-large"
            onClick={() => iconInputRef.current?.click()}
            title="Click to select photo / icon"
          >
            {iconPreview ? (
              <Image src={iconPreview} alt="App icon preview" width={92} height={92} className="photo-preview-img-large" unoptimized />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <ImagePlus size={26} />
                <span style={{ fontSize: 10, fontWeight: 600 }}>App Photo</span>
              </div>
            )}
          </div>

          <div className="photo-upload-cta">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button secondary small"
                onClick={() => iconInputRef.current?.click()}
                disabled={busy}
              >
                <ImagePlus size={13} />
                {iconPreview ? 'Change app photo' : 'Upload app photo / icon'}
              </button>
              {iconPreview && (
                <button
                  type="button"
                  className="button secondary small"
                  style={{ color: '#a03c2e', borderColor: '#f2d4cc' }}
                  onClick={() => { setIconFile(null); setIconPreview(''); }}
                  disabled={busy}
                >
                  <X size={13} /> Remove photo
                </button>
              )}
            </div>
            <p className="hint">PNG, JPG, WebP, GIF or SVG · Max 2 MB · <strong>Saved locally on server</strong></p>
          </div>
          <input
            ref={iconInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleIconFile(f);
            }}
          />
        </div>

        <div className="form-grid">
          <label className="field">
            App name *
            <input
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. Field Service Suite"
              required
              maxLength={100}
              disabled={busy}
            />
          </label>
          <label className="field">
            App slug *
            <input
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
              placeholder="e.g. field-service-suite"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={80}
              disabled={busy}
            />
          </label>
        </div>

        <div className="form-grid">
          <label className="field">
            Platform *
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              disabled={busy}
            >
              {['Android', 'iOS', 'Windows', 'macOS', 'Linux', 'Other'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingTop: 20 }}>
            <label className="check" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                disabled={busy}
              />
              App is active
            </label>
          </div>
        </div>

        <label className="field">
          Description
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={3000}
            rows={3}
            placeholder="Describe what this app does and what problems it solves for customers…"
            disabled={busy}
          />
        </label>
      </section>

      {/* ── SECTION 2: Binary APK Upload ── */}
      <section className="upload-section">
        <div className="upload-section-title">
          <h3><Package size={16} style={{ color: 'var(--brand)' }} />App Binary / APK File</h3>
          <span className="desc">Stored locally on server alongside app photo (Max {maxMb} MB)</span>
        </div>

        {!binaryFile ? (
          <div
            className="file-dropzone"
            onClick={() => binaryInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleBinaryFile(f);
            }}
          >
            <div className="file-dropzone-icon">
              <FileUp size={22} />
            </div>
            <strong style={{ fontSize: 13, color: 'var(--ink)' }}>Click to upload APK / binary or drag and drop</strong>
            <p className="hint">Supported: {extensions.join(', ')} · Max {maxMb} MB · Saved locally on disk</p>
            <button type="button" className="button secondary small" style={{ marginTop: 4 }}>
              Browse file…
            </button>
          </div>
        ) : (
          <div className="selected-file-chip">
            <div className="selected-file-info">
              <div className="file-dropzone-icon" style={{ width: 36, height: 36 }}>
                <Package size={18} />
              </div>
              <div className="selected-file-details">
                <span className="selected-file-name">{binaryFile.name}</span>
                <span className="selected-file-meta">{formatSize(binaryFile.size)} · Ready to save locally on server</span>
              </div>
            </div>
            <button
              type="button"
              className="button secondary small"
              onClick={() => { setBinaryFile(null); setVersion(''); }}
              disabled={busy}
            >
              <X size={13} /> Change file
            </button>
          </div>
        )}

        <input
          ref={binaryInputRef}
          type="file"
          accept={extensions.map(e => `.${e}`).join(',')}
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleBinaryFile(f);
          }}
        />

        {binaryFile && (
          <div className="form-stack" style={{ marginTop: 10 }}>
            <div className="form-grid">
              <label className="field">
                Version label *
                <input
                  value={version}
                  onChange={e => setVersion(e.target.value)}
                  placeholder="e.g. 1.0.0 or 2.1.0"
                  required={!!binaryFile}
                  maxLength={60}
                  disabled={busy}
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20 }}>
                <label className="check" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={publishImmediately}
                    onChange={e => setPublishImmediately(e.target.checked)}
                    disabled={busy}
                  />
                  Publish this release immediately
                </label>
              </div>
            </div>

            <label className="field">
              Release notes & features
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                maxLength={15000}
                rows={2}
                placeholder="Describe new features, bug fixes, or deployment instructions for this release…"
                disabled={busy}
              />
            </label>
          </div>
        )}
      </section>

      {/* ── SECTION 3: Access & Company Allocation ── */}
      <section className="upload-section">
        <div className="upload-section-title">
          <h3><Lock size={16} style={{ color: 'var(--brand)' }} />Access & Company Allocation</h3>
          <span className="desc">Control who can access and download this application</span>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', background: '#f5f7f2', padding: '12px 16px', borderRadius: 8 }}>
          <label className="check" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              disabled={busy}
            />
            <Globe size={14} style={{ color: 'var(--brand)' }} />
            <strong>Publicly visible on Play Store</strong>
          </label>
          <span className="hint">
            {isPublic
              ? 'Anyone visiting the public catalog can view and download this app without logging in.'
              : 'Private app — only assigned companies will be granted download and browse access.'}
          </span>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Company Allocation {!isPublic && <span style={{ color: '#a03c2e' }}>(Mandatory for private apps *)</span>}
            </span>
            {companies.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="text-button" onClick={selectAllCompanies} disabled={busy}>
                  Select all
                </button>
                <span>·</span>
                <button type="button" className="text-button" onClick={clearCompanies} disabled={busy}>
                  Clear
                </button>
              </div>
            )}
          </div>

          {!isPublic && selectedCompanyIds.length === 0 && (
            <div className="error" style={{ marginBottom: 12 }}>
              Allocation mandatory: Please select at least one company that will have access to this private app.
            </div>
          )}

          {companies.length ? (
            <div className="company-select-grid">
              {companies.map(c => {
                const checked = selectedCompanyIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    className={`company-select-card ${checked ? 'selected' : ''}`}
                    onClick={() => !busy && toggleCompany(c.id)}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      disabled={busy}
                    />
                    <span className="company-select-name">{c.name}</span>
                    <span className="badge neutral" style={{ fontSize: 9, opacity: c.active ? 1 : 0.5 }}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="hint">No companies registered yet. <a href="/admin/companies">Create a company first</a> to allocate private apps.</p>
          )}
        </div>
      </section>

      {/* ── Status & Actions ── */}
      {error && <div role="alert" className="error">{error}</div>}
      {success && <div role="status" className="success">{success}</div>}

      {busy && (
        <div className="upload-progress-card">
          <div className="spinner" style={{ width: 18, height: 18 }} />
          <span>{stepText}</span>
        </div>
      )}

      <button
        type="submit"
        className="button"
        disabled={busy}
        style={{ padding: '14px 24px', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {busy ? stepText || 'Uploading…' : 'Upload & Publish App'}
        {!busy && <Upload size={16} />}
      </button>
    </form>
  );
}

export function DeleteReleaseButton({ releaseId, version }: { releaseId: string; version: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete(purge: boolean) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/releases/${releaseId}/delete`, {
        method: 'POST',
        body: JSON.stringify({ purge }),
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete release.');
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="button secondary small"
        style={{ color: '#dc2626', borderColor: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        onClick={() => setOpen(true)}
        title="Delete this version"
      >
        <Trash2 size={13} />Delete version
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', padding: 28, boxShadow: '0 20px 40px rgba(0,0,0,0.25)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Delete Version {version}</h3>
              </div>
              <button type="button" className="text-button" onClick={() => !busy && setOpen(false)} style={{ color: '#6b7280' }}><X size={18} /></button>
            </div>

            <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
              Choose how you want to delete this version:
            </p>

            {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Option 1: Normal Delete */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 14, color: '#1f2937' }}>Normal Delete</strong>
                  <span className="badge neutral" style={{ fontSize: 11 }}>Preserve folder on disk</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>
                  Removes this version from the App Store and database records. The APK and version folder remain saved inside the backend directory on disk.
                </p>
                <button
                  type="button"
                  className="button secondary small"
                  disabled={busy}
                  onClick={() => handleDelete(false)}
                  style={{ alignSelf: 'flex-start', marginTop: 4 }}
                >
                  {busy ? 'Deleting…' : 'Normal Delete (Keep File on Disk)'}
                </button>
              </div>

              {/* Option 2: Root Delete / Purge */}
              <div style={{ border: '1px solid #fecaca', borderRadius: 12, padding: 16, background: '#fff5f5', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 14, color: '#991b1b' }}>Delete from Root (Permanent Purge)</strong>
                  <span className="badge" style={{ fontSize: 11, background: '#fee2e2', color: '#991b1b' }}>Deletes file & folder</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#7f1d1d', lineHeight: 1.4 }}>
                  Permanently deletes the database record AND permanently deletes the APK file and version directory from the server disk.
                </p>
                <button
                  type="button"
                  className="button danger small"
                  disabled={busy}
                  onClick={() => handleDelete(true)}
                  style={{ alignSelf: 'flex-start', marginTop: 4, background: '#dc2626', color: '#fff' }}
                >
                  {busy ? 'Purging…' : 'Permanent Root Delete (Delete All Files)'}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button type="button" className="button secondary small" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteAppButton({ appId, appName, redirectToList = true }: { appId: string; appName: string; redirectToList?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete(purge: boolean) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/apps/${appId}/delete`, {
        method: 'POST',
        body: JSON.stringify({ purge }),
      });
      setOpen(false);
      if (redirectToList) {
        router.push('/admin/apps');
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete app.');
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="button danger small"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#dc2626', color: '#fff' }}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={13} />Delete app profile
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 540, width: '100%', padding: 28, boxShadow: '0 20px 40px rgba(0,0,0,0.25)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Delete App: {appName}</h3>
              </div>
              <button type="button" className="text-button" onClick={() => !busy && setOpen(false)} style={{ color: '#6b7280' }}><X size={18} /></button>
            </div>

            <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
              Choose how you want to delete this app profile:
            </p>

            {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Option 1: Normal Delete */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 14, color: '#1f2937' }}>Normal Delete</strong>
                  <span className="badge neutral" style={{ fontSize: 11 }}>Preserve app folder on disk</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>
                  Removes the app profile, assignments, and all release records from the App Store and database. The app folder on disk (containing all uploaded APKs and release info) is <strong>preserved intact</strong> in <code>data/uploads/apps/</code>.
                </p>
                <button
                  type="button"
                  className="button secondary small"
                  disabled={busy}
                  onClick={() => handleDelete(false)}
                  style={{ alignSelf: 'flex-start', marginTop: 4 }}
                >
                  {busy ? 'Deleting…' : 'Normal Delete (Keep Files on Disk)'}
                </button>
              </div>

              {/* Option 2: Root Delete / Purge */}
              <div style={{ border: '1px solid #fecaca', borderRadius: 12, padding: 16, background: '#fff5f5', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 14, color: '#991b1b' }}>Delete from Root (Permanent Purge)</strong>
                  <span className="badge" style={{ fontSize: 11, background: '#fee2e2', color: '#991b1b' }}>Deletes all files & folders</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#7f1d1d', lineHeight: 1.4 }}>
                  Permanently deletes all database records AND permanently removes the entire app folder <code>data/uploads/apps/{appName}</code>, all its APKs, version info, and icons from the server disk.
                </p>
                <button
                  type="button"
                  className="button danger small"
                  disabled={busy}
                  onClick={() => handleDelete(true)}
                  style={{ alignSelf: 'flex-start', marginTop: 4, background: '#dc2626', color: '#fff' }}
                >
                  {busy ? 'Purging from Root…' : 'Permanent Root Delete (Delete All Records & Files)'}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button type="button" className="button secondary small" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
