import { useState, useMemo } from 'react';
import { Layout } from '../components/layout/Layout';
import { UserForm } from '../components/users/UserForm';
import { useApi } from '../hooks/useApi';
import { deleteUser, type UserRow } from '../services/users.service';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Badge } from '../components/common/Badge';
import { PageHeader } from '../components/common/PageHeader';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/common/Table';

const ROLE_LABEL: Record<UserRow['role'], string> = {
  USUARIO: 'Usuário',
  GESTOR_DEPARTAMENTO: 'Gestor de Departamento',
  GESTOR_GERAL: 'Gestor Geral',
  AUDITOR: 'Auditor',
};

const STATUS_LABEL: Record<UserRow['status'], string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { timeZone: 'UTC' });
}

function roleTone(role: UserRow['role']): { bg: string; fg: string } {
  switch (role) {
    case 'USUARIO':
      return { bg: 'var(--badge-role-usuario-bg)', fg: 'var(--badge-role-usuario-fg)' };
    case 'GESTOR_DEPARTAMENTO':
      return { bg: 'var(--badge-role-gestor-dep-bg)', fg: 'var(--badge-role-gestor-dep-fg)' };
    case 'GESTOR_GERAL':
      return { bg: 'var(--badge-role-gestor-geral-bg)', fg: 'var(--badge-role-gestor-geral-fg)' };
    case 'AUDITOR':
      return { bg: 'var(--badge-role-auditor-bg)', fg: 'var(--badge-role-auditor-fg)' };
  }
}

export function Users() {
  const { data: users, loading, error, refetch } = useApi<UserRow[]>('/users');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRow | undefined>(undefined);
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [credentialNotice, setCredentialNotice] = useState<
    { email: string } | null
  >(null);

  const filtered = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      if (filterRole && u.role !== filterRole) return false;
      if (filterStatus && u.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [users, filterRole, filterStatus, search]);

  const handleDelete = async (user: UserRow) => {
    if (!confirm(`Remover o usuário "${user.name}"?`)) return;
    try {
      await deleteUser(user.id);
      refetch();
    } catch (err) {
      const apiErr = err as { response?: { data?: { error?: string } }; message?: string };
      alert(apiErr.response?.data?.error ?? apiErr.message ?? 'Erro ao remover');
    }
  };

  const handleEdit = (user: UserRow) => {
    setEditing(user);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditing(undefined);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditing(undefined);
  };

  return (
    <Layout>
      <PageHeader
        title="Gerenciamento de Usuários"
        subtitle="Cadastre e administre os usuários do sistema"
        actions={<Button onClick={handleNew}>+ Novo Usuário</Button>}
      />

      {credentialNotice && (
        <div
          className="mb-6 p-4 flex items-start gap-3"
          style={{
            background: 'var(--success-soft)',
            border: '1px solid var(--success)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <span style={{ fontSize: 20 }}>✅</span>
          <div className="flex-1">
            <p
              className="text-sm font-semibold"
              style={{ color: 'var(--success-dark)' }}
            >
              Usuário criado com sucesso!
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--neutral-700)' }}>
              Avise <strong>{credentialNotice.email}</strong> que o acesso está
              liberado. É só entrar em{' '}
              <strong>{window.location.host}</strong> e clicar em{' '}
              <strong>Entrar com Microsoft 365</strong>, usando a conta Ufly.
              Não há senha: a autenticação é pela conta Microsoft.
            </p>
          </div>
          <button
            onClick={() => setCredentialNotice(null)}
            className="text-xl leading-none px-2"
            style={{ color: 'var(--neutral-500)' }}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      )}

      {showForm && (
        <Card padding="lg" className="mb-6">
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--neutral-900)', fontFamily: 'var(--font-display)' }}
          >
            {editing ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <UserForm
            user={editing}
            onSuccess={(created) => {
              handleClose();
              refetch();
              if (created) setCredentialNotice(created);
            }}
            onCancel={handleClose}
          />
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Input
          label="Buscar"
          type="text"
          placeholder="Nome ou email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          label="Papel"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="">Todos os papéis</option>
          <option value="USUARIO">Usuário</option>
          <option value="GESTOR_DEPARTAMENTO">Gestor de Departamento</option>
          <option value="GESTOR_GERAL">Gestor Geral</option>
          <option value="AUDITOR">Auditor</option>
        </Select>
        <Select
          label="Status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
        </Select>
      </div>

      {loading && <p style={{ color: 'var(--neutral-500)' }}>Carregando...</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {!loading && !error && (
        <Table>
          <Thead>
            <Tr>
              <Th>Nome</Th>
              <Th>Email</Th>
              <Th>Papel</Th>
              <Th>Status</Th>
              <Th>Último login</Th>
              <Th>Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((u) => {
              const tone = roleTone(u.role);
              return (
                <Tr key={u.id}>
                  <Td className="font-medium">{u.name}</Td>
                  <Td style={{ color: 'var(--neutral-700)' }}>{u.email}</Td>
                  <Td>
                    <Badge bg={tone.bg} fg={tone.fg}>
                      {ROLE_LABEL[u.role]}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={u.status === 'ATIVO' ? 'active' : 'inactive'}>
                      {STATUS_LABEL[u.status]}
                    </Badge>
                  </Td>
                  <Td style={{ color: 'var(--neutral-700)' }}>{formatDate(u.last_login)}</Td>
                  <Td>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleEdit(u)}
                        className="text-sm hover:underline"
                        style={{ color: 'var(--ufly-deep)' }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-sm hover:underline"
                        style={{ color: 'var(--danger)' }}
                      >
                        Remover
                      </button>
                    </div>
                  </Td>
                </Tr>
              );
            })}
            {filtered.length === 0 && (
              <Tr>
                <Td className="px-4 py-12 text-center" style={{ color: 'var(--neutral-500)' }}>
                  <span className="block">Nenhum usuário encontrado.</span>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      )}
    </Layout>
  );
}
