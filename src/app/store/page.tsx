import { redirect } from 'next/navigation';

export default async function PublicStoreRedirect({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; platform?: string }>;
}) {
  const p = await searchParams;
  const qs = new URLSearchParams();
  if (p.search) qs.set('search', p.search);
  if (p.platform) qs.set('platform', p.platform);
  const query = qs.toString();
  redirect(query ? `/?${query}` : '/');
}
