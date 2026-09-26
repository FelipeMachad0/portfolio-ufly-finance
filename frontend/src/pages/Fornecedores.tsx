import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';

// ───────────────────────────────────────────────────────────
// Modelo local — fornecedores ainda não têm tabela no backend.
// Persistência via localStorage por enquanto.
// ───────────────────────────────────────────────────────────
interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string;
  categoria: string;
  servico: string;
  email: string;
  telefone: string;
  endereco?: string;
  observacoes?: string;
  criadoEm: string;
}

const CATEGORIAS = [
  'Terceiros',
  'Impostos',
  'Infraestrutura',
  'Marketing',
  'Consultoria',
  'Outros',
] as const;

const STORAGE_KEY = 'ufly:fornecedores';

function loadFornecedores(): Fornecedor[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedDefault();
    const parsed = JSON.parse(raw) as Fornecedor[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedDefault();
  } catch {
    return seedDefault();
  }
}

function saveFornecedores(list: Fornecedor[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function seedDefault(): Fornecedor[] {
  return [
    {
      id: 'f1',
      nome: 'Contact Center Soluções LTDA',
      cnpj: '11.111.111/0001-11',
      categoria: 'Terceiros',
      servico: 'Licenças de contact center',
      email: 'financeiro@contactcenter.exemplo',
      telefone: '(11) 4000-0001',
      criadoEm: new Date().toISOString(),
    },
    {
      id: 'f2',
      nome: 'Nuvem Exemplo Serviços LTDA',
      cnpj: '22.222.222/0001-22',
      categoria: 'Infraestrutura',
      servico: 'Hospedagem em nuvem',
      email: 'cobranca@nuvem.exemplo',
      telefone: '(11) 4000-0002',
      criadoEm: new Date().toISOString(),
    },
    {
      id: 'f3',
      nome: 'CRM Exemplo Brasil',
      cnpj: '33.333.333/0001-33',
      categoria: 'Terceiros',
      servico: 'CRM / Platform',
      email: 'latam@crm.exemplo',
      telefone: '',
      criadoEm: new Date().toISOString(),
    },
  ];
}

function formatCNPJ(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

interface FormState {
  nome: string;
  cnpj: string;
  categoria: string;
  servico: string;
  email: string;
  telefone: string;
  endereco: string;
  observacoes: string;
}

const EMPTY_FORM: FormState = {
  nome: '',
  cnpj: '',
  categoria: 'Terceiros',
  servico: '',
  email: '',
  telefone: '',
  endereco: '',
  observacoes: '',
};

export function Fornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    setFornecedores(loadFornecedores());
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return fornecedores.filter((f) => {
      if (filterCat && f.categoria !== filterCat) return false;
      if (
        q &&
        !f.nome.toLowerCase().includes(q) &&
        !f.cnpj.includes(q) &&
        !f.servico.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [fornecedores, search, filterCat]);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (f: Fornecedor) => {
    setEditId(f.id);
    setForm({
      nome: f.nome,
      cnpj: f.cnpj,
      categoria: f.categoria,
      servico: f.servico,
      email: f.email,
      telefone: f.telefone,
      endereco: f.endereco ?? '',
      observacoes: f.observacoes ?? '',
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      alert('Informe a razão social.');
      return;
    }

    if (editId) {
      const next = fornecedores.map((f) =>
        f.id === editId ? { ...f, ...form } : f,
      );
      setFornecedores(next);
      saveFornecedores(next);
    } else {
      const novo: Fornecedor = {
        id: `f-${Date.now()}`,
        ...form,
        criadoEm: new Date().toISOString(),
      };
      const next = [novo, ...fornecedores];
      setFornecedores(next);
      saveFornecedores(next);
    }

    setShowForm(false);
    setForm(EMPTY_FORM);
    setEditId(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remover este fornecedor?')) return;
    const next = fornecedores.filter((f) => f.id !== id);
    setFornecedores(next);
    saveFornecedores(next);
  };

  return (
    <Layout>
      <PageHeader
        title="Fornecedores"
        subtitle="Cadastro de fornecedores e parceiros"
        actions={<Button onClick={openCreate}>+ Novo Fornecedor</Button>}
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <Input
          placeholder="Buscar por nome, CNPJ ou serviço..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px]"
        />
        <Select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="min-w-[180px]"
        >
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((f) => (
          <Card key={f.id} padding="md" className="hover:shadow-md transition">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <h3
                  className="font-semibold text-base truncate"
                  style={{
                    color: 'var(--ufly-navy)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {f.nome}
                </h3>
                <p
                  className="text-xs font-mono"
                  style={{ color: 'var(--neutral-500)' }}
                >
                  CNPJ: {f.cnpj || '—'}
                </p>
              </div>
              <Badge tone="neutral">{f.categoria}</Badge>
            </div>

            {f.servico && (
              <p
                className="text-sm mt-1"
                style={{ color: 'var(--neutral-700)' }}
              >
                {f.servico}
              </p>
            )}

            <div className="flex flex-col gap-1 mt-3 text-xs" style={{ color: 'var(--neutral-500)' }}>
              {f.email && <span>✉ {f.email}</span>}
              {f.telefone && <span>📞 {f.telefone}</span>}
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => openEdit(f)}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md hover:bg-[var(--neutral-100)]"
                style={{
                  border: '1px solid var(--neutral-200)',
                  color: 'var(--neutral-700)',
                }}
              >
                ✏️ Editar
              </button>
              <button
                onClick={() => handleDelete(f.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-[var(--danger-soft)]"
                style={{
                  border: '1px solid var(--neutral-200)',
                  color: 'var(--danger)',
                }}
              >
                Remover
              </button>
            </div>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div
            className="col-span-full p-12 text-center"
            style={{
              background: '#fff',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--neutral-200)',
              color: 'var(--neutral-500)',
            }}
          >
            Nenhum fornecedor encontrado.
          </div>
        )}
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Razão Social"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome da empresa"
              required
            />
            <Input
              label="CNPJ"
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })}
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Categoria"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Input
              label="Tipo de serviço"
              value={form.servico}
              onChange={(e) => setForm({ ...form, servico: e.target.value })}
              placeholder="Ex: Licenças de software"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="financeiro@empresa.com"
            />
            <Input
              label="Telefone"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(11) 99999-9999"
            />
          </div>

          <Input
            label="Endereço"
            value={form.endereco}
            onChange={(e) => setForm({ ...form, endereco: e.target.value })}
            placeholder="Rua, número, cidade — UF"
          />

          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ color: 'var(--neutral-700)' }}
            >
              Observações
            </label>
            <textarea
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Prazo de pagamento, condições contratuais..."
              className="w-full px-3 py-2 text-sm rounded-md"
              style={{
                border: '1px solid var(--neutral-200)',
                background: '#fff',
              }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {editId ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
