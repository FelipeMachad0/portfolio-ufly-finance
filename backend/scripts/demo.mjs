/**
 * `npm run demo` — sobe a aplicação inteira em modo demonstração, sem precisar
 * de PostgreSQL instalado.
 *
 * 1. Inicia um PostgreSQL embutido (PGlite), com os dados em backend/.demo-db/.
 * 2. Expõe esse banco numa porta local, para o Prisma se conectar normalmente.
 * 3. Aplica as migrations.
 * 4. Sobe o backend (DEMO_MODE=true) e o frontend (VITE_DEMO_MODE=true).
 *
 * Para zerar a demonstração: pare o processo e apague backend/.demo-db/.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendDir = path.resolve(backendDir, '..', 'frontend');
const DB_PORT = 54329;
const isWin = process.platform === 'win32';

const db = await PGlite.create({ dataDir: path.join(backendDir, '.demo-db') });
const server = new PGLiteSocketServer({ db, port: DB_PORT, host: '127.0.0.1' });
await server.start();
console.log(`[demo] PostgreSQL embutido em 127.0.0.1:${DB_PORT}`);

// O PGlite atende uma conexão por vez: o Prisma precisa de pool de 1.
const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${DB_PORT}/postgres?sslmode=disable&connection_limit=1`,
  JWT_SECRET: process.env.JWT_SECRET ?? randomBytes(32).toString('hex'),
  CORS_ORIGIN: 'http://localhost:5173',
  DEMO_MODE: 'true',
};

// Assíncrono de propósito: o PGlite roda NESTE processo, e um spawnSync
// travaria o event loop — o banco não conseguiria responder ao Prisma.
const statusMigrate = await new Promise((resolve) => {
  spawn('npx', ['prisma', 'migrate', 'deploy'], { cwd: backendDir, env, stdio: 'inherit', shell: isWin })
    .on('exit', resolve);
});
if (statusMigrate !== 0) {
  console.error('[demo] falha ao aplicar as migrations');
  await server.stop();
  await db.close();
  process.exit(1);
}

const filhos = [
  spawn('npx', ['ts-node', 'src/server.ts'], { cwd: backendDir, env, stdio: 'inherit', shell: isWin }),
  spawn('npx', ['vite', '--port', '5173', '--strictPort'], {
    cwd: frontendDir,
    env: { ...process.env, VITE_API_URL: 'http://localhost:3000/api', VITE_DEMO_MODE: 'true' },
    stdio: 'inherit',
    shell: isWin,
  }),
];
console.log('[demo] abra http://localhost:5173 e clique em "Entrar como demonstração"');

async function encerrar() {
  for (const f of filhos) f.kill();
  await server.stop();
  await db.close();
  process.exit(0);
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
