import { useState } from 'react';
import { previewImport, confirmImport, type PreviewRow, type ImportPreview } from '../../services/import.service';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportDialog({ onClose, onSuccess }: Props) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await previewImport(formData);
      setPreview(data);
      setSelectedRows(
        new Set(
          data.rows
            .map((_, i) => i)
            .filter((i) => !data.rows[i].isDuplicate && data.rows[i].isValid)
        )
      );
    } catch {
      setError('Erro ao processar arquivo. Verifique o formato.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (i: number) => {
    const next = new Set(selectedRows);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelectedRows(next);
  };

  const handleImport = async () => {
    if (!preview) return;
    setLoading(true);
    setError('');
    try {
      const rows: PreviewRow[] = preview.rows.filter((_, i) => selectedRows.has(i));
      const result = await confirmImport(rows);
      alert(result.message);
      onSuccess();
      onClose();
    } catch {
      setError('Erro ao importar transações.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Importar Transações" size="xl">
      {error && (
        <p className="text-sm mb-4" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      {!preview ? (
        <div
          className="rounded-lg p-8 text-center"
          style={{
            border: '2px dashed var(--neutral-300)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <input
            id="import-file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Selecionar arquivo CSV ou XLSX"
          />
          <label htmlFor="import-file-input" className="cursor-pointer block">
            <p className="text-5xl mb-3">📁</p>
            <p className="text-lg font-semibold" style={{ color: 'var(--neutral-700)' }}>
              Clique para selecionar arquivo
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--neutral-500)' }}>
              Formatos suportados: CSV, XLSX, XLS
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--neutral-500)' }}>
              Colunas esperadas: data, descrição, valor, tipo (income/expense), categoria, conta
            </p>
          </label>
          {loading && (
            <p className="mt-4 text-sm" style={{ color: 'var(--ufly-cyan)' }}>
              Processando arquivo…
            </p>
          )}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div
              className="p-4 text-center"
              style={{ background: 'var(--ufly-ice-soft)', borderRadius: 'var(--radius-md)' }}
            >
              <p className="text-xs uppercase mb-1" style={{ color: 'var(--neutral-500)' }}>
                Total de linhas
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--ufly-navy)' }}>
                {preview.totalRows}
              </p>
            </div>
            <div
              className="p-4 text-center"
              style={{ background: 'var(--warning-soft)', borderRadius: 'var(--radius-md)' }}
            >
              <p className="text-xs uppercase mb-1" style={{ color: 'var(--neutral-500)' }}>
                Duplicadas
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--warning-dark)' }}>
                {preview.duplicates}
              </p>
            </div>
            <div
              className="p-4 text-center"
              style={{ background: 'var(--success-soft)', borderRadius: 'var(--radius-md)' }}
            >
              <p className="text-xs uppercase mb-1" style={{ color: 'var(--neutral-500)' }}>
                Selecionadas
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--success-dark)' }}>
                {selectedRows.size}
              </p>
            </div>
          </div>

          <div
            className="overflow-x-auto max-h-64"
            style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)' }}
          >
            <table className="w-full text-sm">
              <thead className="sticky top-0" style={{ background: 'var(--neutral-100)' }}>
                <tr>
                  <th className="p-2">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRows(
                            new Set(
                              preview.rows
                                .map((_, i) => i)
                                .filter((i) => !preview.rows[i].isDuplicate && preview.rows[i].isValid)
                            )
                          );
                        } else {
                          setSelectedRows(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr
                    key={i}
                    className={row.isDuplicate ? 'opacity-50' : 'hover:bg-[var(--neutral-50)]'}
                    style={{ borderTop: '1px solid var(--neutral-100)' }}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        disabled={row.isDuplicate || !row.isValid}
                        checked={selectedRows.has(i)}
                        onChange={() => toggleRow(i)}
                        aria-label={`Selecionar linha ${i + 1}`}
                      />
                    </td>
                    <td className="p-2">{row.date}</td>
                    <td className="p-2 max-w-xs truncate">{row.description}</td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      R$ {Number(row.amount).toFixed(2)}
                    </td>
                    <td className="p-2">
                      <Badge tone={row.type === 'income' ? 'income' : row.type === 'expense' ? 'expense' : 'transfer'}>
                        {row.type === 'income' ? 'Receita' : row.type === 'expense' ? 'Despesa' : 'Transferência'}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs">
                      {row.isDuplicate && (
                        <span style={{ color: 'var(--warning-dark)' }}>Duplicada</span>
                      )}
                      {!row.isValid && !row.isDuplicate && (
                        <span style={{ color: 'var(--danger)' }}>Inválida</span>
                      )}
                      {row.isValid && !row.isDuplicate && (
                        <span style={{ color: 'var(--success)' }}>✓ Válida</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={loading || selectedRows.size === 0}
              className="flex-1"
            >
              {loading ? 'Importando…' : `Importar ${selectedRows.size} transações`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
