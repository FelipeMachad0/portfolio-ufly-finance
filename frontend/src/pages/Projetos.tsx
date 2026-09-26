import { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useApi } from '../hooks/useApi';
import type { Cliente } from '@ufly/shared';
import { getClientes } from '../services/clientes.service';
import { deleteProjeto, type ProjetoRow } from '../services/projetos.service';
import { ProjetoForm } from '../components/financial/ProjetoForm';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { PageHeader } from '../components/common/PageHeader';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/common/Table';

function fmtDate(v: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function Projetos() {
  const { data: projetos, loading, error, refetch } = useApi<ProjetoRow[]>('/projetos');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProjetoRow | null>(null);

  useEffect(() => {
    getClientes().then(setClientes).catch(() => {});
  }, []);

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (p: ProjetoRow) => { setEditing(p); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este projeto?')) return;
    await deleteProjeto(id);
    refetch();
  };

  const isFormOpen = showForm || !!editing;

  return (
    <Layout>
      <PageHeader
        title="Projetos"
        subtitle="Contratos master e seus itens, por cliente"
        actions={
          <Button onClick={openNew} disabled={clientes.length === 0}>
            + Novo Projeto
          </Button>
        }
      />

      {clientes.length === 0 && !loading && (
        <p className="mb-4 text-sm" style={{ color: 'var(--neutral-500)' }}>
          Cadastre um cliente antes de criar projetos.
        </p>
      )}

      {isFormOpen && (
        <Card padding="lg" className="mb-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--neutral-900)', fontFamily: 'var(--font-display)' }}>
            {editing ? 'Editar Projeto' : 'Novo Projeto'}
          </h2>
          <ProjetoForm
            projeto={editing ?? undefined}
            clientes={clientes}
            onSuccess={() => { closeForm(); refetch(); }}
            onCancel={closeForm}
          />
        </Card>
      )}

      {loading && <p style={{ color: 'var(--neutral-500)' }}>Carregando...</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {projetos && projetos.length > 0 && (
        <Card padding="none">
          <Table>
            <Thead>
              <Tr>
                <Th>Projeto</Th>
                <Th>Cliente</Th>
                <Th>Contrato master</Th>
                <Th>Itens</Th>
                <Th>Contrato</Th>
                <Th style={{ textAlign: 'right' }}>Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {projetos.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-medium">{p.nome}</Td>
                  <Td style={{ color: 'var(--neutral-600)' }}>{p.cliente?.nome ?? '—'}</Td>
                  <Td style={{ color: 'var(--neutral-600)' }}>
                    {fmtDate(p.inicioMaster)} – {fmtDate(p.fimMaster)}
                  </Td>
                  <Td>
                    <Badge tone="neutral">{p.itens?.length ?? 0}</Badge>
                  </Td>
                  <Td>{p.contrato ? '📎' : '—'}</Td>
                  <Td style={{ textAlign: 'right' }}>
                    <button onClick={() => openEdit(p)} className="text-sm mr-3 hover:underline" style={{ color: 'var(--ufly-cyan)' }}>
                      Editar
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-sm hover:underline" style={{ color: 'var(--danger)' }}>
                      Remover
                    </button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      )}

      {!loading && projetos?.length === 0 && (
        <p className="text-center py-12" style={{ color: 'var(--neutral-500)' }}>
          Nenhum projeto cadastrado.
        </p>
      )}
    </Layout>
  );
}
