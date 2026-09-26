import schedule from 'node-schedule';
import { checkBudgetsJob } from './budget-checker.job';
import { passadaDeLeitura, recuperarLeiturasInterrompidas } from './leitura-documentos.job';

export function initScheduler(): void {
  // Verificar orçamentos todo dia às 9:00
  schedule.scheduleJob('0 9 * * *', () => {
    void checkBudgetsJob();
  });

  // Leitura de documentos: a cada 20s. O intervalo é curto porque a passada é
  // barata quando a fila está vazia (uma consulta indexada por status) e porque a
  // pessoa está esperando o resultado aparecer na bandeja.
  schedule.scheduleJob('*/20 * * * * *', () => {
    void passadaDeLeitura();
  });

  // Um restart no meio de uma leitura deixaria a linha em "lendo" sem ninguém
  // acompanhando.
  void recuperarLeiturasInterrompidas().catch((e) =>
    console.error('[scheduler] recuperar leituras:', (e as Error).message)
  );

  console.log(
    '[scheduler] Iniciado — orçamentos às 09:00, leitura de documentos a cada 20s'
  );
}
