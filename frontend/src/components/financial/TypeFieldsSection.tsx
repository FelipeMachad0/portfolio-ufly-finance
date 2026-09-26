import { useEffect, useState } from 'react';
import type { CategoryField } from '@ufly/shared';
import { getTypeFields, updateTypeFields } from '../../services/typefields.service';
import { CategoryFieldsEditor } from './CategoryFieldsEditor';
import { Card } from '../common/Card';
import { Button } from '../common/Button';

type Tipo = 'income' | 'expense';

/**
 * Editor dos campos padrão por TIPO (Entradas/Saídas). Esses campos aparecem
 * em todo lançamento do tipo, além dos campos gerais e dos da categoria.
 */
export function TypeFieldsSection() {
  // `null` = nenhum tipo selecionado, e a seção fica recolhida. A seleção do
  // tipo é o próprio mecanismo de expandir/recolher: clicar no tipo já ativo
  // desmarca e volta ao estado inicial, sem precisar de um botão separado.
  const [tab, setTab] = useState<Tipo | null>(null);
  const [income, setIncome] = useState<CategoryField[]>([]);
  const [expense, setExpense] = useState<CategoryField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getTypeFields()
      .then((d) => { setIncome(d.income); setExpense(d.expense); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fields = tab === 'income' ? income : tab === 'expense' ? expense : [];
  const setFields = tab === 'income' ? setIncome : setExpense;

  const save = async () => {
    if (!tab) return;
    setSaving(true);
    setMsg('');
    try {
      await updateTypeFields(tab, fields);
      setMsg('Campos salvos.');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const TabButton = ({ value, label, color }: { value: Tipo; label: string; color: string }) => {
    const active = tab === value;
    const qtd = value === 'income' ? income.length : expense.length;
    return (
      <button
        type="button"
        // Alterna: seleciona, ou desmarca se já estava selecionado.
        onClick={() => { setTab(active ? null : value); setMsg(''); }}
        aria-expanded={active}
        title={active ? `Clique para recolher ${label}` : `Configurar campos de ${label}`}
        className="px-4 py-1.5 text-sm rounded-lg transition-colors inline-flex items-center gap-2"
        style={{
          background: active ? color : 'var(--neutral-100)',
          color: active ? '#fff' : 'var(--neutral-700)',
          border: `1px solid ${active ? color : 'var(--neutral-200)'}`,
          fontWeight: active ? 600 : 400,
        }}
      >
        {label}
        {/* Contagem no botão: com a seção recolhida, é o que informa se aquele
            tipo já tem campos configurados. */}
        <span
          className="text-xs px-1.5 rounded-full"
          style={{
            background: active ? 'rgba(255,255,255,.25)' : 'var(--neutral-200)',
            color: active ? '#fff' : 'var(--neutral-600)',
          }}
        >
          {qtd}
        </span>
        <span aria-hidden style={{ opacity: 0.8 }}>{active ? '×' : '+'}</span>
      </button>
    );
  };

  return (
    <Card padding="lg" className="mb-6">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--neutral-900)', fontFamily: 'var(--font-display)' }}>
        Campos padrão por tipo
      </h2>
      <p className="text-sm mt-1 mb-3" style={{ color: 'var(--neutral-500)' }}>
        Configure campos que aparecem em todo lançamento de Entrada ou Saída — além dos campos gerais e dos campos da categoria.
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <TabButton value="income" label="Entradas" color="var(--finance-income)" />
        <TabButton value="expense" label="Saídas" color="var(--finance-expense)" />
        {!tab && (
          <span className="text-xs ml-1" style={{ color: 'var(--neutral-500)' }}>
            Selecione um tipo para configurar seus campos.
          </span>
        )}
      </div>

      {tab && (
        <>
          <div
            className="p-4 rounded-lg mt-4"
            style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-50)' }}
          >
            <CategoryFieldsEditor
              key={tab}
              value={fields}
              onChange={setFields}
              emptyHint={`Nenhum campo padrão para ${tab === 'income' ? 'Entradas' : 'Saídas'}. Adicione campos para que apareçam em todo lançamento desse tipo.`}
            />
          </div>

          <div className="flex items-center gap-3 mt-4">
            <Button type="button" disabled={saving} onClick={save}>
              {saving ? 'Salvando...' : `Salvar campos de ${tab === 'income' ? 'Entradas' : 'Saídas'}`}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setTab(null); setMsg(''); }}>
              Recolher
            </Button>
            {msg && <span className="text-sm" style={{ color: 'var(--ufly-cyan)' }}>{msg}</span>}
          </div>
        </>
      )}
    </Card>
  );
}
