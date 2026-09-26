import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import {
  listCostCenters,
  upsertCostCenter,
  getCostCenterComparison,
  type CostCenterBudget,
  type CostCenterComparison,
} from '../services/cost-centers.service';
import { getUsers, type UserRow } from '../services/users.service';
import {
  PeriodoSelector,
  defaultPeriodo,
  periodoLabel,
  type Periodo,
} from '../components/common/PeriodoSelector';

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Cor por prefixo de setor — TODAS em hex direto para que `${cor}22` (alpha)
// funcione corretamente. Variáveis CSS não podem ser concatenadas assim.
const SETOR_COLOR: Record<string, string> = {
  Administrativo: '#08133E', // navy escuro Ufly
  Comercial: '#10B981',      // verde
  Delivery: '#F59E0B',       // âmbar
  'Operações': '#7C3AED',    // roxo
};

function setorFromCode(code: string): keyof typeof SETOR_COLOR | '—' {
  const p = code.split('-')[0];
  switch (p) {
    case 'ADM': return 'Administrativo';
    case 'COM': return 'Comercial';
    case 'DEL': return 'Delivery';
    case 'OPE': return 'Operações';
    default: return '—';
  }
}

export function CentrosCusto() {
  const [budgets, setBudgets] = useState<CostCenterBudget[]>([]);
  const [comparison, setComparison] = useState<CostCenterComparison[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>(defaultPeriodo());
  const [editingValue, setEditingValue] = useState<{ id: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Carrega usuários ativos uma única vez para popular o select de gestor
  useEffect(() => {
    getUsers({ status: 'ATIVO' })
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, c] = await Promise.all([
      listCostCenters().catch(() => []),
      getCostCenterComparison(periodo.start, periodo.end).catch(() => []),
    ]);
    setBudgets(b);
    setComparison(c);
    setLoading(false);
  }, [periodo]);

  useEffect(() => {
    load();
  }, [load]);

  const linhas = useMemo(() => {
    const compByCode = new Map<string, CostCenterComparison>();
    for (const c of comparison) compByCode.set(c.cost_center, c);

    return budgets.map((b) => {
      const c = compByCode.get(b.cost_center);
      return {
        ...b,
        setor: setorFromCode(b.cost_center),
        previsto: c?.previsto ?? 0,
        realizado: c?.realizado ?? 0,
        acumulado: c?.acumulado ?? 0,
        uso_pct: c?.uso_pct ?? null,
      };
    });
  }, [budgets, comparison]);

  const totaisPorSetor = useMemo(() => {
    const map: Record<string, { previsto: number; realizado: number }> = {};
    for (const l of linhas) {
      if (l.setor === '—') continue;
      if (!map[l.setor]) map[l.setor] = { previsto: 0, realizado: 0 };
      map[l.setor].previsto += l.previsto;
      map[l.setor].realizado += l.realizado;
    }
    return map;
  }, [linhas]);

  const totalGeral = useMemo(
    () =>
      linhas.reduce(
        (acc, l) => ({
          previsto: acc.previsto + l.previsto,
          realizado: acc.realizado + l.realizado,
          acumulado: acc.acumulado + l.acumulado,
        }),
        { previsto: 0, realizado: 0, acumulado: 0 }
      ),
    [linhas]
  );

  // Salva apenas monthly_amount (edição inline)
  const saveAmount = async (b: CostCenterBudget) => {
    if (!editingValue) return;
    const newValue = Number(editingValue.value.replace(',', '.'));
    if (!isFinite(newValue) || newValue < 0) {
      setEditingValue(null);
      return;
    }
    setSaving(true);
    try {
      await upsertCostCenter({
        cost_center: b.cost_center,
        label: b.label,
        monthly_amount: newValue,
        gestor_user_id: b.gestor_user_id,
      });
      setEditingValue(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  // Salva apenas o gestor (select inline)
  const saveGestor = async (b: CostCenterBudget, gestor_user_id: string | null) => {
    setSaving(true);
    try {
      await upsertCostCenter({
        cost_center: b.cost_center,
        label: b.label,
        monthly_amount: b.monthly_amount,
        gestor_user_id,
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Centros de Custo"
        subtitle="Defina o orçamento mensal previsto, o gestor responsável e acompanhe o realizado"
      />

      {/* Filtro de período */}
      <div className="mb-6">
        <PeriodoSelector periodo={periodo} onChange={setPeriodo} />
        <p className="text-xs mt-2" style={{ color: 'var(--neutral-500)' }}>
          Previsto período = orçamento mensal × meses proporcionais em {periodoLabel(periodo)}
        </p>
      </div>

      {/* Cards por setor */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {(Object.keys(SETOR_COLOR) as Array<keyof typeof SETOR_COLOR>).map((setor) => {
          const t = totaisPorSetor[setor] ?? { previsto: 0, realizado: 0 };
          const exceeded = t.previsto > 0 && t.realizado > t.previsto;
          return (
            <Card key={setor} padding="md">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: SETOR_COLOR[setor] }}
                />
                <p
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--neutral-500)' }}
                >
                  {setor}
                </p>
              </div>
              <p
                className="text-lg font-semibold tabular-nums font-mono"
                style={{
                  color: exceeded ? 'var(--finance-expense)' : 'var(--neutral-900)',
                }}
              >
                {fmtBRL(t.realizado)}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--neutral-500)' }}>
                de {fmtBRL(t.previsto)} previsto
              </p>
            </Card>
          );
        })}
      </div>

      {/* Tabela */}
      <div
        className="overflow-x-auto"
        style={{
          background: '#fff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--neutral-200)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <table className="w-full text-sm" style={{ minWidth: 1100 }}>
          <thead>
            <tr
              className="text-left text-xs border-b"
              style={{
                color: 'var(--neutral-500)',
                borderColor: 'var(--neutral-100)',
                background: 'var(--neutral-50)',
              }}
            >
              <th className="px-4 py-3 font-medium uppercase tracking-wide whitespace-nowrap" style={{ width: 80 }}>
                Código
              </th>
              <th className="px-3 py-3 font-medium uppercase tracking-wide whitespace-nowrap">
                Setor
              </th>
              <th className="px-3 py-3 font-medium uppercase tracking-wide">Centro de Custo</th>
              <th className="px-3 py-3 font-medium uppercase tracking-wide">Gestor</th>
              <th
                className="px-3 py-3 font-medium uppercase tracking-wide text-right whitespace-nowrap"
                title="Orçamento mensal cadastrado"
              >
                Previsto<br />mensal
              </th>
              <th
                className="px-3 py-3 font-medium uppercase tracking-wide text-right whitespace-nowrap"
                title="Previsto mensal × meses proporcionais no período"
              >
                Previsto<br />período
              </th>
              <th className="px-3 py-3 font-medium uppercase tracking-wide text-right whitespace-nowrap">
                Realizado
              </th>
              <th
                className="px-3 py-3 font-medium uppercase tracking-wide text-right whitespace-nowrap"
                title="Gasto histórico do CC — ignora o filtro de período"
              >
                Acumulado
              </th>
              <th className="px-3 py-3 font-medium uppercase tracking-wide text-right whitespace-nowrap">
                Uso
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center"
                  style={{ color: 'var(--neutral-500)' }}
                >
                  Carregando...
                </td>
              </tr>
            )}
            {!loading &&
              linhas.map((l) => {
                const cor = l.setor !== '—' ? SETOR_COLOR[l.setor] : '#6B7280';
                const isEditingValue = editingValue?.id === l.id;
                const exceeded = l.previsto > 0 && l.realizado > l.previsto;
                return (
                  <tr
                    key={l.id}
                    className="border-b transition-colors"
                    style={{ borderColor: 'var(--neutral-100)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--neutral-50)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-mono font-medium px-2 py-1 rounded-md whitespace-nowrap inline-block"
                        style={{ background: `${cor}22`, color: cor }}
                      >
                        {l.cost_center}
                      </span>
                    </td>
                    <td
                      className="px-3 py-3 whitespace-nowrap"
                      style={{ color: 'var(--neutral-500)' }}
                    >
                      {l.setor}
                    </td>
                    <td
                      className="px-3 py-3 font-medium"
                      style={{ color: 'var(--neutral-900)' }}
                    >
                      {l.label || '—'}
                    </td>

                    {/* Gestor — select inline */}
                    <td className="px-3 py-3">
                      <select
                        value={l.gestor_user_id ?? ''}
                        disabled={saving}
                        onChange={(e) =>
                          saveGestor(l, e.target.value || null)
                        }
                        className="text-sm px-2 py-1 rounded"
                        style={{
                          border: '1px solid var(--neutral-200)',
                          background: l.gestor_user_id
                            ? 'var(--neutral-50)'
                            : 'transparent',
                          color: l.gestor_user_id
                            ? 'var(--neutral-900)'
                            : 'var(--neutral-400)',
                          minWidth: 140,
                          maxWidth: 200,
                        }}
                        title={l.gestor_email ?? ''}
                      >
                        <option value="">— Definir —</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Previsto mensal — editável */}
                    <td className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {isEditingValue ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          autoFocus
                          value={editingValue!.value}
                          disabled={saving}
                          onChange={(e) =>
                            setEditingValue({ id: l.id, value: e.target.value })
                          }
                          onBlur={() => saveAmount(l)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveAmount(l);
                            if (e.key === 'Escape') setEditingValue(null);
                          }}
                          className="w-28 text-right px-2 py-1 text-sm rounded"
                          style={{
                            border: '1px solid var(--ufly-cyan)',
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <button
                          onClick={() =>
                            setEditingValue({ id: l.id, value: String(l.monthly_amount) })
                          }
                          className="text-right hover:underline"
                          style={{
                            color:
                              l.monthly_amount > 0
                                ? 'var(--ufly-cyan)'
                                : 'var(--neutral-300)',
                          }}
                        >
                          {l.monthly_amount > 0 ? fmtBRL(l.monthly_amount) : 'Definir'}
                        </button>
                      )}
                    </td>

                    {/* Previsto no período */}
                    <td
                      className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap"
                      style={{ color: 'var(--neutral-500)' }}
                    >
                      {l.previsto > 0 ? fmtBRL(l.previsto) : '—'}
                    </td>

                    {/* Realizado no período */}
                    <td
                      className="px-3 py-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap"
                      style={{
                        color: exceeded
                          ? 'var(--finance-expense)'
                          : l.realizado > 0
                            ? 'var(--neutral-900)'
                            : 'var(--neutral-300)',
                      }}
                    >
                      {l.realizado > 0 ? fmtBRL(l.realizado) : '—'}
                    </td>

                    {/* Gasto acumulado (histórico, sem filtro) */}
                    <td
                      className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap"
                      style={{
                        color: l.acumulado > 0
                          ? 'var(--finance-expense)'
                          : 'var(--neutral-300)',
                      }}
                    >
                      {l.acumulado > 0 ? fmtBRL(l.acumulado) : '—'}
                    </td>

                    {/* Uso (%) */}
                    <td className="px-3 py-3 text-right">
                      {l.uso_pct === null ? (
                        <span className="text-xs" style={{ color: 'var(--neutral-300)' }}>
                          —
                        </span>
                      ) : (
                        <span
                          className="text-xs px-2 py-1 rounded-full font-semibold tabular-nums"
                          style={{
                            background: exceeded
                              ? 'var(--danger-soft, #fef2f2)'
                              : l.uso_pct > 80
                                ? 'var(--warning-soft, #fffbeb)'
                                : 'var(--neutral-100)',
                            color: exceeded
                              ? 'var(--finance-expense)'
                              : l.uso_pct > 80
                                ? '#92400e'
                                : 'var(--neutral-700)',
                          }}
                        >
                          {l.uso_pct.toFixed(0)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            {!loading && (
              <tr style={{ background: 'var(--ufly-navy)', color: '#fff' }}>
                <td
                  colSpan={5}
                  className="px-4 py-3 font-semibold uppercase tracking-wide text-xs"
                >
                  Total Geral
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums font-bold">
                  {fmtBRL(totalGeral.previsto)}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums font-bold">
                  {fmtBRL(totalGeral.realizado)}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums font-bold">
                  {fmtBRL(totalGeral.acumulado)}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums font-bold">
                  {totalGeral.previsto > 0
                    ? `${((totalGeral.realizado / totalGeral.previsto) * 100).toFixed(0)}%`
                    : '—'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs mt-3" style={{ color: 'var(--neutral-500)' }}>
        💡 Clique no valor de <strong>Previsto mensal</strong> para editar. O{' '}
        <strong>Gestor</strong> é selecionável entre os usuários ativos. O{' '}
        <strong>Acumulado</strong> ignora o filtro e soma todas as despesas
        históricas do CC.
      </p>
    </Layout>
  );
}
