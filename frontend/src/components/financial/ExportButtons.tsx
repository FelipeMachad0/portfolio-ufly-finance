import { useState } from 'react';
import { downloadTransactions, downloadReport } from '../../services/export.service';
import { Button } from '../common/Button';

interface Props {
  /** Ausentes no preset "Tudo": exporta sem filtro de data. */
  startDate?: Date;
  endDate?: Date;
}

export function ExportButtons({ startDate, endDate }: Props) {
  const [downloading, setDownloading] = useState<'transactions' | 'report' | null>(null);

  const handle = async (type: 'transactions' | 'report') => {
    setDownloading(type);
    try {
      if (type === 'transactions') {
        await downloadTransactions(startDate, endDate);
      } else {
        await downloadReport(startDate, endDate);
      }
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        onClick={() => handle('transactions')}
        disabled={downloading !== null}
        aria-label="Exportar transações em XLSX"
        style={{ background: 'var(--success)', color: '#fff' }}
      >
        {downloading === 'transactions' ? 'Exportando…' : '⬇ Transações'}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => handle('report')}
        disabled={downloading !== null}
        aria-label="Exportar relatório completo em XLSX"
      >
        {downloading === 'report' ? 'Exportando…' : '📊 Relatório'}
      </Button>
    </div>
  );
}
