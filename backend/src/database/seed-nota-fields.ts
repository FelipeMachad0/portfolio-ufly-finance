/**
 * Seed idempotente: adiciona aos campos padrão do tipo "Entrada" (income) os
 * campos que a leitura automática preenche a partir da nota fiscal — Número da nota e os
 * impostos (ISS, PIS, COFINS, IR, INSS, CSLL).
 *
 * Não duplica: campos cuja `key` já existir são preservados como estão.
 *
 * Uso:
 *   npx ts-node src/database/seed-nota-fields.ts           # usa SEED_USER_EMAIL ou 1º usuário
 *   npx ts-node src/database/seed-nota-fields.ts --email admin@exemplo.com.br
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env.development') });

import { prisma } from './prisma';
import { getTypeFields, upsertTypeFields } from '../models/typefields.model';
import type { CategoryField } from '@ufly/shared';

/** Campos da nota fiscal a garantir nos type-fields de Entrada. */
const NOTA_FIELDS: CategoryField[] = [
  { key: 'numero_nota', label: 'Número da nota', type: 'string', required: false },
  { key: 'iss', label: 'ISS', type: 'currency', required: false },
  { key: 'pis', label: 'PIS', type: 'currency', required: false },
  { key: 'cofins', label: 'COFINS', type: 'currency', required: false },
  // O "Valor IR" da nota vai para o campo IRPJ já existente (evita coluna duplicada).
  { key: 'irpj', label: 'IRPJ', type: 'currency', required: false },
  { key: 'inss', label: 'INSS', type: 'currency', required: false },
  { key: 'csll', label: 'CSLL', type: 'currency', required: false },
];

/** Chaves depreciadas a remover (consolidadas em outro campo). */
const DEPRECATED_KEYS = ['ir'];

async function resolveUserId(email?: string): Promise<{ id: string; email: string }> {
  const user = email
    ? await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true, email: true } })
    : await prisma.user.findFirst({
        where: { accounts: { some: {} }, deletedAt: null },
        select: { id: true, email: true },
      });
  if (!user) throw new Error('Usuário não encontrado (informe --email ou defina SEED_USER_EMAIL)');
  return user;
}

async function main(): Promise<void> {
  const emailArg = process.argv.includes('--email')
    ? process.argv[process.argv.indexOf('--email') + 1]
    : process.env.SEED_USER_EMAIL;

  const user = await resolveUserId(emailArg);
  const current = await getTypeFields();
  const existing = current.income;
  const existingKeys = new Set(existing.map((f) => f.key));

  const toAdd = NOTA_FIELDS.filter((f) => !existingKeys.has(f.key));
  const toRemove = existing.filter((f) => DEPRECATED_KEYS.includes(f.key));

  if (toAdd.length === 0 && toRemove.length === 0) {
    console.log(`[seed] Nada a fazer — campos já reconciliados para ${user.email}.`);
    return;
  }

  const removeSet = new Set(toRemove.map((f) => f.key));
  const merged = [...existing.filter((f) => !removeSet.has(f.key)), ...toAdd];
  await upsertTypeFields(user.id, 'income', merged);

  console.log(`[seed] Usuário ${user.email}:`);
  if (toAdd.length) console.log(`[seed] Adicionados: ${toAdd.map((f) => f.key).join(', ')}`);
  if (toRemove.length) console.log(`[seed] Removidos (depreciados): ${toRemove.map((f) => f.key).join(', ')}`);
  console.log(`[seed] Total de campos de Entrada agora: ${merged.length}`);
}

main()
  .catch((err) => {
    console.error('[seed] Falha:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
