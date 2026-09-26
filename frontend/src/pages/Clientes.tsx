import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useApi } from '../hooks/useApi';
import type { Cliente, Empresa } from '@ufly/shared';
import { createCliente, updateCliente, deleteCliente } from '../services/clientes.service';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { PageHeader } from '../components/common/PageHeader';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/common/Table';

function emptyEmpresa(): Empresa {
  return { nome: '', cnpj: '' };
}

export function Clientes() {
  const { data: clientes, loading, error, refetch } = useApi<Cliente[]>('/clientes');
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([emptyEmpresa()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const openNew = () => {
    setEditing(null);
    setNome('');
    setEmpresas([emptyEmpresa()]);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (c: Cliente) => {
    setEditing(c);
    setNome(c.nome);
    setEmpresas(c.empresas.length > 0 ? c.empresas : [emptyEmpresa()]);
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const updateEmpresa = (idx: number, patch: Partial<Empresa>) => {
    setEmpresas((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };
  const addEmpresa = () => setEmpresas((prev) => [...prev, emptyEmpresa()]);
  const removeEmpresa = (idx: number) => setEmpresas((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { setFormError('Informe o nome do cliente'); return; }
    // remove empresas vazias (sem nome)
    const limpas = empresas
      .map((emp) => ({ nome: emp.nome.trim(), cnpj: (emp.cnpj ?? '').trim() }))
      .filter((emp) => emp.nome.length > 0);
    setSaving(true);
    setFormError('');
    try {
      const payload = { nome: nome.trim(), empresas: limpas };
      if (editing) await updateCliente(editing.id, payload);
      else await createCliente(payload);
      closeForm();
      refetch();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este cliente?')) return;
    await deleteCliente(id);
    refetch();
  };

  return (
    <Layout>
      <PageHeader
        title="Clientes"
        subtitle="Cada cliente pode ter várias empresas (CNPJs)"
        actions={<Button onClick={openNew}>+ Novo Cliente</Button>}
      />

      {showForm && (
        <Card padding="lg" className="mb-6">
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--neutral-900)', fontFamily: 'var(--font-display)' }}
          >
            {editing ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <p className="text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>
            )}
            <Input
              label="Nome do cliente"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />

            <div className="pt-2 space-y-3" style={{ borderTop: '1px solid var(--neutral-200)' }}>
              <div className="flex items-center justify-between pt-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--neutral-700)' }}>
                  Empresas
                </h3>
                <Button type="button" variant="secondary" size="sm" onClick={addEmpresa}>+ Adicionar empresa</Button>
              </div>

              {empresas.map((emp, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                  <Input
                    label={idx === 0 ? 'Empresa' : undefined}
                    placeholder="Nome da empresa"
                    value={emp.nome}
                    onChange={(e) => updateEmpresa(idx, { nome: e.target.value })}
                  />
                  <Input
                    label={idx === 0 ? 'CNPJ' : undefined}
                    placeholder="00.000.000/0000-00"
                    value={emp.cnpj ?? ''}
                    onChange={(e) => updateEmpresa(idx, { cnpj: e.target.value })}
                  />
                  <button
                    type="button"
                    className="text-sm px-2 py-2 hover:underline"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => removeEmpresa(idx)}
                    disabled={empresas.length === 1}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar Cliente'}
              </Button>
              <Button type="button" variant="ghost" onClick={closeForm} className="flex-1">
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading && <p style={{ color: 'var(--neutral-500)' }}>Carregando...</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {clientes && clientes.length > 0 && (
        <Card padding="none">
          <Table>
            <Thead>
              <Tr>
                <Th>Cliente</Th>
                <Th>Empresas</Th>
                <Th style={{ textAlign: 'right' }}>Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {clientes.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-medium">{c.nome}</Td>
                  <Td style={{ color: 'var(--neutral-600)' }}>
                    {c.empresas.length === 0
                      ? '—'
                      : c.empresas.map((e) => `${e.nome}${e.cnpj ? ` (${e.cnpj})` : ''}`).join(', ')}
                  </Td>
                  <Td style={{ textAlign: 'right' }}>
                    <button onClick={() => openEdit(c)} className="text-sm mr-3 hover:underline" style={{ color: 'var(--ufly-cyan)' }}>
                      Editar
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="text-sm hover:underline" style={{ color: 'var(--danger)' }}>
                      Remover
                    </button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      )}

      {!loading && clientes?.length === 0 && (
        <p className="text-center py-12" style={{ color: 'var(--neutral-500)' }}>
          Nenhum cliente cadastrado. Crie o primeiro!
        </p>
      )}
    </Layout>
  );
}
