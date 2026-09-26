/**
 * Grava os dados fictícios da demonstração em frontend/src/demo/dados.json —
 * a "base" da versão estática (GitHub Pages), que roda sem backend nem banco.
 *
 * Uso: com `npm run demo` rodando, execute `npm run demo:exportar`.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const API = process.env.API_URL ?? 'http://localhost:3000/api';
const destino = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../frontend/src/demo/dados.json'
);

const login = await fetch(`${API}/auth/demo`, { method: 'POST' });
if (!login.ok) throw new Error(`/auth/demo respondeu ${login.status} — a demo está rodando?`);
const { token, user } = await login.json();

async function get(caminho) {
  const r = await fetch(`${API}${caminho}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`GET ${caminho} respondeu ${r.status}`);
  return r.json();
}

const dados = {
  geradoEm: new Date().toISOString(),
  usuario: user,
  accounts: await get('/accounts'),
  categories: await get('/categories'),
  transactions: (await get('/transactions?limit=1000')).data,
  clientes: await get('/clientes'),
  projetos: await get('/projetos'),
  budgets: await get('/budgets'),
  costCenters: await get('/cost-centers'),
  typeFields: await get('/type-fields'),
  users: await get('/users'),
};

writeFileSync(destino, JSON.stringify(dados, null, 2) + '\n');
console.log(`[demo] ${dados.transactions.length} lançamentos gravados em ${path.relative(process.cwd(), destino)}`);
