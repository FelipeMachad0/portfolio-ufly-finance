import dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });

import app from './app';
import { initScheduler } from './jobs/scheduler';

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  initScheduler();
});
