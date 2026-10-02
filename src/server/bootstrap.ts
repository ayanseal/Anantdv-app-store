import { z } from 'zod';
import { db } from './db';
import { hashPassword } from './auth/password';
import { AppError } from './errors';
export async function bootstrapAdmin(input: { email: string; name: string; password: string }) {
  const email = z.email().parse(input.email.trim().toLowerCase());
  const name = z.string().trim().min(1).max(100).parse(input.name);
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async tx => {
    if (await tx.user.count({ where: { role: 'ADMIN' } })) throw new AppError('CONFLICT', 409, 'An administrator already exists. Use user management instead.');
    return tx.user.create({ data: { name, email, passwordHash, role: 'ADMIN', mustChangePassword: false } });
  });
}
