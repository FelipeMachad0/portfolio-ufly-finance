import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import accountsRoutes from './routes/accounts.routes';
import categoriesRoutes from './routes/categories.routes';
import transactionsRoutes from './routes/transactions.routes';
import budgetsRoutes from './routes/budgets.routes';
import reportsRoutes from './routes/reports.routes';
import importRoutes from './routes/import.routes';
import exportRoutes from './routes/export.routes';
import usersRoutes from './routes/users.routes';
import costCentersRoutes from './routes/cost-centers.routes';
import uploadsRoutes from './routes/uploads.routes';
import notasRoutes from './routes/notas.routes';
import importacoesRoutes from './routes/importacoes.routes';
import clientesRoutes from './routes/clientes.routes';
import projetosRoutes from './routes/projetos.routes';
import typeFieldsRoutes from './routes/typefields.routes';
import { pool } from './database/pool';

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    // Em desenvolvimento aceita qualquer origem localhost (porta variável)
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    const allowed = (process.env.CORS_ORIGIN ?? '').split(',').map(s => s.trim());
    cb(allowed.includes(origin) ? null : new Error('Not allowed by CORS'), allowed.includes(origin));
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/cost-centers', costCentersRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/notas', notasRoutes);
app.use('/api/importacoes', importacoesRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/projetos', projetosRoutes);
app.use('/api/type-fields', typeFieldsRoutes);

app.get('/api/health', async (_req, res) => {
  let dbStatus = 'unavailable';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'ok';
  } catch {
    // DB not connected yet
  }
  res.json({ status: 'OK', db: dbStatus, timestamp: new Date().toISOString() });
});

export default app;
