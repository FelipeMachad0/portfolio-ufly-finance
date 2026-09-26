import { useState } from 'react';
import type { Cliente, ProjetoItem } from '@ufly/shared';
import { createProjeto, updateProjeto, type ProjetoRow } from '../../services/projetos.service';
import {
  uploadNota,
  previewNota,
  downloadNota,
  canPreview,
  type NotaRef,
} from '../../services/uploads.service';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { FilePicker } from '../common/FilePicker';

interface Props {
  projeto?: ProjetoRow;
  clientes: Cliente[];
  onSuccess: () => void;
  onCancel: () => void;
}

function emptyItem(): ProjetoItem {
  return {
    descricao: '',
    categoria: '',
    prazoPagamento: '',
    inicioContrato: null,
    fimContrato: null,
    vendedor: '',
    comissaoPct: 0,
  };
}

/** Normaliza uma data ISO/Date para o input type=date (YYYY-MM-DD). */
function toDateInput(v: string | null | undefined): string {
  if (!v) return '';
  return new Date(v).toISOString().split('T')[0];
}

export function ProjetoForm({ projeto, clientes, onSuccess, onCancel }: Props) {
  const isEdit = !!projeto;
  const [clienteId, setClienteId] = useState(projeto?.clienteId ?? '');
  const [nome, setNome] = useState(projeto?.nome ?? '');
  const [descricao, setDescricao] = useState(projeto?.descricao ?? '');
  const [inicioMaster, setInicioMaster] = useState(toDateInput(projeto?.inicioMaster));
  const [fimMaster, setFimMaster] = useState(toDateInput(projeto?.fimMaster));
  const [itens, setItens] = useState<ProjetoItem[]>(projeto?.itens ?? []);

  const [contrato, setContrato] = useState<NotaRef | null>(projeto?.contrato ?? null);
  const [contratoFile, setContratoFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateItem = (idx: number, patch: Partial<ProjetoItem>) => {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItens((prev) => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItens((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!clienteId) { setError('Selecione o cliente'); return; }
    if (!nome.trim()) { setError('Informe o nome do projeto'); return; }
    setSaving(true);
    try {
      let contratoRef = contrato;
      if (contratoFile) contratoRef = await uploadNota(contratoFile);

      const payload = {
        clienteId,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        contrato: contratoRef,
        inicioMaster: inicioMaster ? new Date(inicioMaster) : null,
        fimMaster: fimMaster ? new Date(fimMaster) : null,
        itens,
      };
      if (isEdit && projeto) await updateProjeto(projeto.id, payload);
      else await createProjeto(payload);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Selecione</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </Select>
        <Input
          label="Nome do projeto"
          placeholder="Ex: Projeto A"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--neutral-700)' }}>
          Descrição do projeto
        </label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          className="w-full text-sm px-3 py-2 rounded-lg"
          style={{ border: '1px solid var(--neutral-300)', color: 'var(--neutral-800)', outline: 'none' }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Início contrato master" type="date" value={inicioMaster} onChange={(e) => setInicioMaster(e.target.value)} />
        <Input label="Fim contrato master" type="date" value={fimMaster} onChange={(e) => setFimMaster(e.target.value)} />
      </div>

      {/* CONTRATO (ANEXO) */}
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: 'var(--neutral-700)' }}>
          Contrato (anexo)
        </label>
        {contrato ? (
          <div
            className="flex flex-wrap items-center gap-2 p-2 rounded"
            style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-50)' }}
          >
            <span className="text-sm truncate flex-1 min-w-0" style={{ color: 'var(--neutral-700)' }}>
              📎 {contrato.originalName}
            </span>
            {canPreview(contrato.mimetype) && (
              <button type="button" className="text-xs font-medium px-2 py-1" style={{ color: 'var(--ufly-cyan)' }}
                onClick={() => previewNota(contrato).catch(() => setError('Falha ao abrir o contrato'))}>
                Visualizar
              </button>
            )}
            <button type="button" className="text-xs font-medium px-2 py-1" style={{ color: 'var(--ufly-cyan)' }}
              onClick={() => downloadNota(contrato).catch(() => setError('Falha ao baixar o contrato'))}>
              Baixar
            </button>
            <button type="button" className="text-xs font-medium px-2 py-1" style={{ color: 'var(--danger)' }}
              onClick={() => { setContrato(null); setContratoFile(null); }}>
              Remover
            </button>
          </div>
        ) : contratoFile ? (
          <div className="flex items-center gap-2 p-2 rounded" style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-50)' }}>
            <span className="text-sm truncate flex-1 min-w-0" style={{ color: 'var(--neutral-700)' }}>
              📎 {contratoFile.name} <span style={{ color: 'var(--neutral-500)' }}>(será enviado ao salvar)</span>
            </span>
            <button type="button" className="text-xs font-medium px-2 py-1" style={{ color: 'var(--danger)' }} onClick={() => setContratoFile(null)}>
              Remover
            </button>
          </div>
        ) : (
          <FilePicker
            accept="application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
            label="Anexar contrato"
            onSelect={setContratoFile}
          />
        )}
      </div>

      {/* ITENS DO CONTRATO */}
      <div className="pt-4 mt-2 space-y-3" style={{ borderTop: '1px solid var(--neutral-200)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--neutral-700)' }}>
            Itens do contrato
          </h3>
          <Button type="button" variant="secondary" size="sm" onClick={addItem}>+ Adicionar item</Button>
        </div>

        {itens.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>Nenhum item adicionado.</p>
        )}

        {itens.map((item, idx) => (
          <div key={idx} className="p-3 rounded-lg space-y-3" style={{ border: '1px solid var(--neutral-200)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: 'var(--neutral-500)' }}>Item {idx + 1}</span>
              <button type="button" className="text-xs font-medium" style={{ color: 'var(--danger)' }} onClick={() => removeItem(idx)}>
                Remover
              </button>
            </div>
            <Input label="Descrição do item" value={item.descricao} onChange={(e) => updateItem(idx, { descricao: e.target.value })} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Categoria" value={item.categoria ?? ''} onChange={(e) => updateItem(idx, { categoria: e.target.value })} />
              <Input label="Prazo de pagamento" placeholder="Ex: 30 dias" value={item.prazoPagamento ?? ''} onChange={(e) => updateItem(idx, { prazoPagamento: e.target.value })} />
              <Input label="Início contrato" type="date" value={toDateInput(item.inicioContrato)} onChange={(e) => updateItem(idx, { inicioContrato: e.target.value || null })} />
              <Input label="Fim contrato" type="date" value={toDateInput(item.fimContrato)} onChange={(e) => updateItem(idx, { fimContrato: e.target.value || null })} />
              <Input label="Vendedor" value={item.vendedor ?? ''} onChange={(e) => updateItem(idx, { vendedor: e.target.value })} />
              <Input
                label="% Comissão"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={String(item.comissaoPct ?? 0)}
                onChange={(e) => updateItem(idx, { comissaoPct: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar Projeto'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">Cancelar</Button>
      </div>
    </form>
  );
}
