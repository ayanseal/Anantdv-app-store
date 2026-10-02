import { redirect } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { requirePagePrincipal } from '@/server/page-auth';
export default async function AdminLayout({ children }: { children: React.ReactNode }) { const principal = await requirePagePrincipal('/admin'); if (principal.role !== 'ADMIN') redirect('/catalog'); return <Navigation principal={principal}>{children}</Navigation>; }
