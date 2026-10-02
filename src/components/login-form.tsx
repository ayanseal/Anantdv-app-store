'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api-client';
type Kind = 'login' | 'password' | 'mfa' | 'enroll' | 'codes';
type Result = { kind: Kind | 'session'; role?: string; recoveryCodes?: string[] };
export function LoginForm() {
  const [kind, setKind] = useState<Kind>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [enrollment, setEnrollment] = useState<{ secret: string; qr: string }>();
  const [codes, setCodes] = useState<string[]>([]);
  async function update(result: Result) {
    if (result.recoveryCodes) { setCodes(result.recoveryCodes); setKind('codes'); return; }
    if (result.kind === 'session') { window.location.replace(result.role === 'ADMIN' ? '/admin' : '/catalog'); return; }
    setKind(result.kind);
    if (result.kind === 'enroll') setEnrollment(await api('/api/auth/enrollment', { method: 'POST' }));
  }
  useEffect(() => { api<Result>('/api/auth/state').then(update).catch(() => {}); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const action = kind === 'login' ? 'login' : kind;
      const body = kind === 'login' ? { email: data.get('email'), password: data.get('password') } : kind === 'password' ? { password: data.get('password') } : { code: data.get('code'), recovery };
      if (kind === 'password' && data.get('password') !== data.get('confirm')) throw new Error('The passwords do not match.');
      await update(await api<Result>(`/api/auth/${action}`, { method: 'POST', body: JSON.stringify(body) }));
    } catch (error) { setError(error instanceof Error ? error.message : 'Sign-in failed.'); } finally { setBusy(false); }
  }
  const heading = { login: 'Welcome back', password: 'Choose your password', mfa: 'Verify your identity', enroll: 'Secure your admin account', codes: 'Save your recovery codes' }[kind];
  const description = { login: 'Sign in with the account provided by your company administrator.', password: 'Replace your temporary password before accessing your apps. Use at least 12 characters.', mfa: 'Enter a code from your authenticator app to finish signing in.', enroll: 'Scan this QR code with your authenticator app, then enter its six-digit code.', codes: 'Keep these codes somewhere safe. Each code works once if you lose your authenticator, and this list is shown only now.' }[kind];
  return <div className="auth-card">
    <div className="eyebrow">Your private app workspace</div><h1>{heading}</h1><p>{description}</p>
    {kind === 'codes' ? <div className="form-stack"><div className="code-grid">{codes.map(code => <code key={code}>{code}</code>)}</div><button className="button full" onClick={() => window.location.replace('/admin')}>I saved my codes <ArrowRight size={15} /></button></div> :
      <form className="form-stack" onSubmit={submit} key={kind}>
        {kind === 'login' && <><label className="field">Email address<input name="email" type="email" autoComplete="username" placeholder="you@company.com" required /></label><label className="field">Password<input name="password" type="password" autoComplete="current-password" required maxLength={128} placeholder="Enter your password" /></label></>}
        {kind === 'password' && <><label className="field">New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label><label className="field">Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label></>}
        {kind === 'enroll' && (enrollment ? <><Image className="qr" src={enrollment.qr} alt="Authenticator enrollment QR code" width={200} height={200} unoptimized /><p className="hint">Or enter this setup key manually:</p><code className="secret">{enrollment.secret}</code></> : <p className="hint">Preparing your authenticator setup…</p>)}
        {(kind === 'mfa' || kind === 'enroll') && <label className="field">{recovery ? 'Recovery code' : 'Authenticator code'}<input name="code" autoComplete="one-time-code" inputMode={recovery ? 'text' : 'numeric'} pattern={recovery ? undefined : '[0-9]{6}'} maxLength={recovery ? 64 : 6} placeholder={recovery ? 'Enter an unused recovery code' : '000000'} required /></label>}
        {error && <div className="error" role="alert">{error}</div>}
        <button className="button full" disabled={busy || (kind === 'enroll' && !enrollment)}>{busy ? 'Please wait…' : kind === 'login' ? 'Sign in' : kind === 'password' ? 'Save password' : kind === 'enroll' ? 'Activate authenticator' : 'Verify and sign in'}<ArrowRight size={15} /></button>
        {kind === 'mfa' && <button className="text-button" type="button" onClick={() => setRecovery(!recovery)}>{recovery ? 'Use my authenticator instead' : 'Use a recovery code'}</button>}
        {kind !== 'login' && <button type="button" className="text-button" onClick={async () => { await api('/api/auth/logout', { method: 'POST' }); window.location.replace('/login'); }}>Start again</button>}
      </form>}
    <div className="auth-bottom"><p>Need access or help signing in? Contact your administrator.</p><p className="footer-note"><ShieldCheck size={13} /> Private access · Protected downloads</p></div>
  </div>;
}
