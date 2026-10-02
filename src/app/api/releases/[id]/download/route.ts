import { route, getRequestPrincipal } from '@/server/http';
import { openDownload } from '@/server/services/releases';
import { attachmentHeader } from '@/server/storage';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const download = await openDownload(await getRequestPrincipal(), (await context.params).id);
    return new Response(download.stream, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(download.size), 'Content-Disposition': attachmentHeader(download.filename), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  });
}
