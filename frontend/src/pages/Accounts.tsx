import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { AccountForm } from '../components/financial/AccountForm';
import { useApi } from '../hooks/useApi';
import { deleteAccount } from '../services/accounts.service';
import { Account } from '@ufly/shared';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { PageHeader } from '../components/common/PageHeader';

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  bank: 'Conta Bancária',
  credit_card: 'Cartão de Crédito',
  wallet: 'Carteira',
};

export function Accounts() {
  const { data: accounts, loading, error, refetch } = useApi<Account[]>('/accounts');
  const [showForm, setShowForm] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta conta?')) return;
    await deleteAccount(id);
    refetch();
  };

  return (
    <Layout>
      <PageHeader
        title="Contas"
        subtitle="Gerencie suas contas bancárias, cartões e carteiras"
        actions={
          <Button onClick={() => setShowForm(true)}>+ Nova Conta</Button>
        }
      />

      {showForm && (
        <Card padding="lg" className="mb-6">
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--neutral-900)', fontFamily: 'var(--font-display)' }}
          >
            Nova Conta
          </h2>
          <AccountForm
            onSuccess={() => { setShowForm(false); refetch(); }}
            onCancel={() => setShowForm(false)}
          />
        </Card>
      )}

      {loading && <p style={{ color: 'var(--neutral-500)' }}>Carregando...</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts?.map((account) => (
          <Card key={account.id} padding="md" className="hover:shadow-md transition">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3
                  className="font-semibold text-lg"
                  style={{ color: 'var(--ufly-navy)', fontFamily: 'var(--font-display)' }}
                >
                  {account.name}
                </h3>
                <div className="mt-1">
                  <Badge tone="neutral">
                    {ACCOUNT_TYPE_LABEL[account.type] ?? account.type}
                  </Badge>
                </div>
              </div>
              <button
                onClick={() => handleDelete(account.id)}
                className="text-sm hover:underline"
                style={{ color: 'var(--danger)' }}
              >
                Remover
              </button>
            </div>
            <p
              className="text-2xl font-bold font-mono tabular-nums"
              style={{
                color:
                  Number(account.balance) >= 0
                    ? 'var(--finance-income)'
                    : 'var(--finance-expense)',
              }}
            >
              R$ {Number(account.balance).toFixed(2)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--neutral-500)' }}>
              {account.currency}
            </p>
          </Card>
        ))}
      </div>

      {!loading && accounts?.length === 0 && (
        <p className="text-center py-12" style={{ color: 'var(--neutral-500)' }}>
          Nenhuma conta cadastrada. Crie a primeira!
        </p>
      )}
    </Layout>
  );
}
