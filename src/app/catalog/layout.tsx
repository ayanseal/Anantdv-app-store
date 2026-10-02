import { Navigation } from '@/components/navigation';
import { requirePagePrincipal } from '@/server/page-auth';
export default async function CatalogLayout({ children }: { children: React.ReactNode }) { const principal = await requirePagePrincipal('/catalog'); return <Navigation principal={principal}>{children}</Navigation>; }
