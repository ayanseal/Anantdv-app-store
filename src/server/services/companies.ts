import { z } from 'zod';
import { db } from '@/server/db';
import { loadPrincipal, requireAdmin, type Principal } from '@/server/auth/principal';
import { recordAudit } from '@/server/audit';
export const companyInput = z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(100), slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), active: z.boolean() });
export type CompanyInput = z.infer<typeof companyInput>;
export async function listCompanies(actor: Principal) {
  requireAdmin(await loadPrincipal(actor.id));
  return db.company.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { users: true, assignments: true } } } });
}
export async function saveCompany(actor: Principal, raw: CompanyInput) {
  requireAdmin(await loadPrincipal(actor.id));
  const { id, ...input } = companyInput.parse(raw);
  return db.$transaction(async tx => {
    const company = id ? await tx.company.update({ where: { id }, data: input }) : await tx.company.create({ data: input });
    await recordAudit({ actorId: actor.id, action: id ? 'COMPANY_UPDATED' : 'COMPANY_CREATED', targetId: company.id, metadata: { active: company.active } }, tx);
    return company;
  });
}
