import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRequestPrincipal } from './http';
export async function requirePagePrincipal(next = '/catalog') {
  try { return await getRequestPrincipal(); }
  catch {
    if ((await cookies()).get('payana_refresh')?.value) redirect(`/renew?next=${encodeURIComponent(next)}`);
    redirect('/login');
  }
}
