'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, LogIn } from 'lucide-react';
import { api } from '@/lib/api-client';

type Kind = 'login' | 'password' | 'forgot';
type Result = { kind: string; role?: string };

export function LoginForm({ initialMode = 'login' }: { initialMode?: 'login' | 'forgot' }) {
  const [kind, setKind] = useState<Kind>(initialMode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleSuccess(role?: string) {
    const destination = (role === 'ADMIN' || role === 'VIEWER') ? '/admin' : '/catalog';
    window.location.replace(destination);
  }

  useEffect(() => {
    if (initialMode === 'forgot') return;
    api<Result>('/api/auth/state')
      .then(res => {
        if (res.kind === 'session') {
          handleSuccess(res.role);
        } else if (res.kind === 'password') {
          setKind('password');
        }
      })
      .catch(() => {});
  }, [initialMode]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    setBusy(true);
    setError('');

    const data = new FormData(event.currentTarget);

    try {
      if (kind === 'password') {
        const password = String(data.get('password') || '');
        const confirm = String(data.get('confirm') || '');
        if (password !== confirm) {
          throw new Error('The passwords do not match.');
        }
        if (password.length < 12) {
          throw new Error('Password must be at least 12 characters.');
        }
        const result = await api<Result>('/api/auth/password', {
          method: 'POST',
          body: JSON.stringify({ password }),
        });
        if (result.kind === 'session') {
          handleSuccess(result.role);
          return;
        }
      } else if (kind === 'forgot') {
        const email = String(data.get('email') || '').trim();
        const previousPassword = String(data.get('previousPassword') || '');
        const newPassword = String(data.get('newPassword') || '');
        const confirm = String(data.get('confirm') || '');

        if (!email || !previousPassword || !newPassword) {
          throw new Error('Please fill in all fields.');
        }
        if (newPassword !== confirm) {
          throw new Error('The new passwords do not match.');
        }
        if (newPassword.length < 12) {
          throw new Error('New password must be at least 12 characters.');
        }
        if (previousPassword === newPassword) {
          throw new Error('New password must be different from previous password.');
        }

        const result = await api<Result>('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, previousPassword, newPassword }),
        });

        if (result.kind === 'session') {
          handleSuccess(result.role);
          return;
        }
        setError('Password reset could not be completed. Please try again.');
        return;
      } else {
        const email = String(data.get('email') || '').trim();
        const password = String(data.get('password') || '');
        if (!email || !password) {
          throw new Error('Please enter both email and password.');
        }
        const result = await api<Result>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (result.kind === 'session') {
          handleSuccess(result.role);
          return;
        }
        if (result.kind === 'password') {
          setKind('password');
          return;
        }
        if (result.kind === 'mfa') {
          setError('Two-factor authentication is required for this account.');
          return;
        }
        setError('Unexpected server response. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="eyebrow">{kind === 'forgot' ? 'Account recovery' : 'Your private app workspace'}</div>
      <h1>
        {kind === 'login'
          ? 'Welcome back'
          : kind === 'password'
          ? 'Choose your password'
          : 'Reset your password'}
      </h1>
      <p>
        {kind === 'login'
          ? 'Sign in with your email address and password to access your workspace.'
          : kind === 'password'
          ? 'Replace your temporary password before accessing your apps. Use at least 12 characters.'
          : 'Enter your account email along with your previous password to set a new password.'}
      </p>

      <form className="form-stack" onSubmit={submit} method="POST" action="/login" key={kind}>
        {kind === 'login' ? (
          <>
            <label className="field">
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                required
                autoFocus
              />
            </label>
            <label className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Password</span>
                <button
                  type="button"
                  className="text-button"
                  style={{ fontSize: '12px', padding: 0, color: 'var(--brand)', fontWeight: 600 }}
                  onClick={() => { setKind('forgot'); setError(''); }}
                >
                  Forgot password?
                </button>
              </div>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                placeholder="Enter your password"
              />
            </label>
          </>
        ) : kind === 'forgot' ? (
          <>
            <label className="field">
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                required
                autoFocus
              />
            </label>
            <label className="field">
              Previous password
              <input
                name="previousPassword"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                placeholder="Enter your previous password"
              />
            </label>
            <label className="field">
              New password
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                placeholder="At least 12 characters"
                required
              />
            </label>
            <label className="field">
              Confirm new password
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                placeholder="Re-enter new password"
                required
              />
            </label>
          </>
        ) : (
          <>
            <label className="field">
              New password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                placeholder="At least 12 characters"
                required
                autoFocus
              />
            </label>
            <label className="field">
              Confirm password
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                placeholder="Re-enter password"
                required
              />
            </label>
          </>
        )}

        {error && <div className="error" role="alert">{error}</div>}

        <button className="button full" disabled={busy} type="submit">
          {busy
            ? kind === 'forgot'
              ? 'Resetting password…'
              : 'Signing in…'
            : kind === 'login'
            ? 'Sign in'
            : kind === 'password'
            ? 'Save password'
            : 'Reset and sign in'}
          {!busy && <ArrowRight size={15} />}
        </button>

        {kind !== 'login' && (
          <button
            type="button"
            className="text-button"
            onClick={async () => {
              if (kind === 'password') {
                await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
              }
              setKind('login');
              setError('');
            }}
          >
            Cancel and return to sign in
          </button>
        )}
      </form>

      <div className="auth-bottom">
        <p>Need access or help signing in? Contact your administrator.</p>
        <p className="footer-note">
          <ShieldCheck size={13} /> Private access · Protected downloads
        </p>
      </div>
    </div>
  );
}
