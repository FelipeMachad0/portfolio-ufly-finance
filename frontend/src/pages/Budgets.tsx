import { useState, useCallback } from 'react';
import { Layout } from '../components/layout/Layout';
import { BudgetForm } from '../components/financial/BudgetForm';
import { BudgetProgressBar } from '../components/financial/BudgetProgressBar';
import { useApi } from '../hooks/useApi';
import { deleteBudget, type BudgetWithStatus } from '../services/budgets.service';
import { Button } from '../components/common/Button';
import { PageHeader } from '../components/common/PageHeader';

export function Budgets() {
  const { data: budgets, loading, error, refetch } = useApi<BudgetWithStatus[]>('/budgets');
  const [showForm, setShowForm] = useState(false);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Remover este orçamento?')) return;
      await deleteBudget(id);
      refetch();
    },
    [refetch]
  );

  const monthly = (budgets ?? []).filter((b) => b.period === 'monthly');
  const yearly = (budgets ?? []).filter((b) => b.period === 'yearly');

  return (
    <Layout>
      <PageHeader
        title="Orçamentos"
        subtitle="Defina limites de gastos por categoria"
        actions={
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : '+ Novo Orçamento'}
          </Button>
        }
      />

      {showForm && (
        <div className="mb-6">
          <BudgetForm
            onSuccess={() => { setShowForm(false); refetch(); }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {loading && <p style={{ color: 'var(--neutral-500)' }}>Carregando...</p>}
      {error && <p style={{ color: 'var(--danger)' }}>Erro ao carregar orçamentos</p>}

      {!loading && (
        <>
          <section className="mb-8">
            <h2
              className="text-lg font-semibold mb-3"
              style={{ color: 'var(--neutral-700)', fontFamily: 'var(--font-display)' }}
            >
              Mensais
            </h2>
            {monthly.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
                Nenhum orçamento mensal definido
              </p>
            ) : (
              <div className="space-y-3">
                {monthly.map((b) => (
                  <BudgetProgressBar key={b.id} budget={b} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2
              className="text-lg font-semibold mb-3"
              style={{ color: 'var(--neutral-700)', fontFamily: 'var(--font-display)' }}
            >
              Anuais
            </h2>
            {yearly.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
                Nenhum orçamento anual definido
              </p>
            ) : (
              <div className="space-y-3">
                {yearly.map((b) => (
                  <BudgetProgressBar key={b.id} budget={b} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}
