'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, LayoutGrid, Building2, Users, Layers, ScrollText, LogOut, ShieldCheck, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api-client';
import type { Principal } from '@/server/auth/principal';
export function Navigation({ principal, children }: { principal: Principal; children: React.ReactNode }) {
  const path = usePathname();
  const admin = path.startsWith('/admin');
  const items = admin ? [{ href: '/admin', label: 'Overview', Icon: LayoutGrid }, { href: '/admin/companies', label: 'Companies', Icon: Building2 }, { href: '/admin/users', label: 'Users & roles', Icon: Users }, { href: '/admin/apps', label: 'Apps & releases', Icon: Layers }, { href: '/admin/audit', label: 'Activity log', Icon: ScrollText }] : [{ href: '/catalog', label: 'App library', Icon: LayoutGrid }];
  const [first, ...last] = principal.name.split(' ');
  const initials = (first[0] + (last.at(-1)?.[0] || '')).toUpperCase();
  return <div className="shell"><aside className="sidebar"><Link href="/catalog" className="brand"><div className="brand-icon"><Package size={20} /></div><span>payana<small>APP STORE</small></span></Link><div className="nav-label">{admin ? 'ADMINISTRATION' : 'WORKSPACE'}</div><nav>{items.map(({ href, label, Icon }) => <Link className={`nav-item ${path === href || (href !== '/admin' && path.startsWith(href + '/')) ? 'active' : ''}`} href={href} key={href}><Icon size={17} />{label}</Link>)}{principal.role === 'ADMIN' && <Link className="nav-item" href={admin ? '/catalog' : '/admin'}><Layers size={17} />{admin ? 'App library' : 'Administration'}</Link>}</nav><div className="sidebar-bottom"><div className="access-box"><ShieldCheck size={20} /><strong>{principal.role === 'ADMIN' ? 'Admin access protected' : 'Your company workspace'}</strong><p>{principal.role === 'CUSTOMER' ? principal.companyName : principal.role === 'VIEWER' ? 'Browse the full library with view-only access.' : 'Authenticator verification keeps your workspace secure.'}</p></div><button className="nav-item" onClick={async () => { await api('/api/auth/logout', { method: 'POST' }); window.location.replace('/login'); }}><LogOut size={16} />Sign out</button></div></aside><div className="workspace"><header className="topbar"><div className="crumb">Workspace<ChevronRight size={12} /><span>{admin ? 'Administration' : 'App library'}</span></div><div className="profile"><div><strong>{principal.name}</strong><small>{principal.role === 'CUSTOMER' ? principal.companyName : principal.role === 'ADMIN' ? 'Administrator' : 'Viewer'}</small></div><div className="avatar">{initials}</div></div></header><main className="content">{children}</main></div></div>;
}
