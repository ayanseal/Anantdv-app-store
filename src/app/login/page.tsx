import { Package, ShieldCheck, History } from 'lucide-react';
import { LoginForm } from '@/components/login-form';
export default function LoginPage() {
  return <main className="auth-page"><section className="auth-story"><div className="brand"><div className="brand-icon"><Package size={21} /></div><span>payana<small>APP STORE</small></span></div><div className="story-body"><div className="eyebrow">Built for your company</div><h1>The right apps.<br /><em>Ready for you.</em></h1><p>One place for your company’s apps. Get the latest releases, see what’s new, and find the versions you need.</p><div className="story-points"><span><ShieldCheck size={16} /> Secure access</span><span><History size={16} /> Every version</span></div></div><small>© {new Date().getFullYear()} Payana App Store</small></section><section className="auth-content"><LoginForm /></section></main>;
}
