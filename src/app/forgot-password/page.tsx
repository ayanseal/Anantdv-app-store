import { Package, ShieldCheck, KeyRound } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getRequestPrincipal } from '@/server/http';
import { LoginForm } from '@/components/login-form';

export default async function ForgotPasswordPage() {
  try {
    const principal = await getRequestPrincipal();
    if (principal) {
      redirect((principal.role === 'ADMIN' || principal.role === 'VIEWER') ? '/admin' : '/catalog');
    }
  } catch {}

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand">
          <div className="brand-icon"><Package size={21} /></div>
          <span>Anantdv<small>APP STORE</small></span>
        </div>
        <div className="story-body">
          <div className="eyebrow">Account Recovery</div>
          <h1>Reset your password.<br /><em>Keep building.</em></h1>
          <p>Verify your previous credentials to set a new password and securely regain access to your workspace and apps.</p>
          <div className="story-points">
            <span><ShieldCheck size={16} /> Previous password verification</span>
            <span><KeyRound size={16} /> Instant password update</span>
          </div>
        </div>
        <small>© {new Date().getFullYear()} Anantdv App Store</small>
      </section>
      <section className="auth-content">
        <LoginForm initialMode="forgot" />
      </section>
    </main>
  );
}
