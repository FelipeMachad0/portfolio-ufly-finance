import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { TransactionForm } from '../components/financial/TransactionForm';
import { FilaDeLeituras } from '../components/financial/FilaDeLeituras';
import { useImportacoes } from '../hooks/useImportacoes';
import { confirmarImportacao } from '../services/importacoes.service';
import { ImportDocumentoDialog } from '../components/financial/ImportDocumentoDialog';
import { DynamicFieldCell, formatFieldValue } from '../components/financial/DynamicFieldCell';
import { ColumnFilter } from '../components/financial/ColumnFilter';
import { useApi } from '../hooks/useApi';
import { deleteTransaction } from '../services/transactions.service';
import { getCategories } from '../services/categories.service';
import { downloadControleFinanceiro } from '../services/export.service';
import {
  DOCUMENTO_TIPO_META,
  type Category,
  type CategoryField,
  type NotaImportResult,
  type PaginatedResponse,
} from '@ufly/shared';
import type { TransactionRow } from '../services/transactions.service';
import { getTypeFields, type TypeFields } from '../services/typefields.service';
import { compareByField, type SortDir } from '../utils/fieldSort';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { PageHeader } from '../components/common/PageHeader';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/common/Table';
import { KpiCard } from '../components/common/KpiCard';
import {
  PeriodoSelector,
  buildPeriodo,
  periodoLabel,
  type Periodo,
} from '../components/common/PeriodoSelector';

const TYPE_LABEL: Record<string, string> = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência',
};

/**
 * Chaves das colunas que vêm da própria transação, não do metadata. O prefixo
 * evita colisão com a key de um campo dinâmico (que é snake_case sem `__`).
 */
const BASE_KEYS = {
  data: '__data',
  descricao: '__descricao',
  tipo: '__tipo',
  categoria: '__categoria',
  valor: '__valor',
} as const;

function fmtBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

type TxType = 'income' | 'expense' | 'transfer';

/** Visão selecionada pelo dropdown "Lançamentos" do menu (via ?view=). */
type View = 'all' | 'income' | 'expense';

export function Transactions() {
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionRow | null>(null);
  const [showImport, setShowImport] = useState(false);
  // Documento importado pela página: abre o form já pré-preenchido.
  const [pendingImport, setPendingImport] = useState<NotaImportResult | null>(null);
  /** Id da leitura sendo revisada, para vincular ao lançamento na confirmação. */
  const [leituraEmRevisao, setLeituraEmRevisao] = useState<string | null>(null);
  const { importacoes, prontas, emAndamento, recarregar: recarregarLeituras } =
    useImportacoes();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [page, setPage] = useState(1);

  // A visão (Entradas/Saídas) vem do dropdown do menu via query param ?view=
  const [searchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const view: View = rawView === 'income' || rawView === 'expense' ? rawView : 'all';
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>(() => buildPeriodo('este_mes', 0, 0));
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [typeFields, setTypeFields] = useState<TypeFields>({ income: [], expense: [] });
  // Filtros por coluna (key do campo -> valores permitidos, formatados)
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({});
  // Ordenação por coluna (uma de cada vez)
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);

  // Debounce do input de busca
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
    getTypeFields().then(setTypeFields).catch(() => {});
  }, []);

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  // Colunas dinâmicas = campos padrão do tipo (Entrada/Saída) + campos da
  // categoria selecionada. Vão sendo somados, nunca substituídos.
  const activeCategory = categoryId ? categoryById.get(categoryId) ?? null : null;
  const typeFieldsForView =
    view === 'income' || view === 'expense' ? typeFields[view] : [];
  const categoryFields = activeCategory?.fieldsSchema ?? [];
  const dynamicColumns: CategoryField[] = [
    ...typeFieldsForView,
    ...categoryFields.filter((cf) => !typeFieldsForView.some((tf) => tf.key === cf.key)),
  ];

  // Colunas do próprio lançamento, sempre presentes e também filtráveis. Antes
  // a tabela com filtros só existia quando havia campo dinâmico: em Saídas (sem
  // campos padrão de tipo configurados) nada era filtrável até escolher uma
  // categoria, e em Entradas faltava a coluna Data.
  const colunasBase: CategoryField[] = useMemo(
    () => [
      { key: BASE_KEYS.data, label: 'Data', type: 'date', required: false },
      { key: BASE_KEYS.descricao, label: 'Descrição', type: 'string', required: false },
      ...(view === 'all'
        ? [{ key: BASE_KEYS.tipo, label: 'Tipo', type: 'string' as const, required: false }]
        : []),
      { key: BASE_KEYS.categoria, label: 'Categoria', type: 'string', required: false },
      { key: BASE_KEYS.valor, label: 'Valor (R$)', type: 'currency', required: false },
    ],
    [view]
  );

  const colunas: CategoryField[] = [...colunasBase, ...dynamicColumns];

  /** Valor de uma coluna: das colunas-base vem da transação; das demais, do metadata. */
  const valorDaColuna = (row: TransactionRow, key: string): unknown => {
    switch (key) {
      case BASE_KEYS.data:
        return typeof row.date === 'string' ? row.date.slice(0, 10) : row.date;
      case BASE_KEYS.descricao:
        return row.description;
      case BASE_KEYS.tipo:
        return TYPE_LABEL[row.type] ?? row.type;
      case BASE_KEYS.categoria:
        return row.category_id ? categoryById.get(row.category_id)?.name ?? '' : '';
      case BASE_KEYS.valor:
        return Number(row.amount);
      default:
        return row.metadata?.[key];
    }
  };

  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Busca todos os registros do filtro atual; a paginação e o filtro por
  // coluna são feitos no cliente (para o filtro estilo planilha funcionar).
  const params = new URLSearchParams({ page: '1', limit: '1000' });
  if (view !== 'all') params.set('type', view);
  if (categoryId) params.set('categoryId', categoryId);
  // Sem período ("Tudo") os parâmetros são omitidos e o backend não filtra por data.
  if (periodo.start) params.set('startDate', ymd(periodo.start));
  if (periodo.end) params.set('endDate', ymd(periodo.end));
  if (search) params.set('search', search);

  const { data, loading, error, refetch } = useApi<PaginatedResponse<TransactionRow>>(
    `/transactions?${params}`
  );

  // Filtro por coluna (client-side) + paginação client-side
  const allRows = data?.data ?? [];
  const filteredRows = allRows.filter((row) =>
    Object.entries(colFilters).every(([key, allowed]) => {
      const field = colunas.find((f) => f.key === key);
      if (!field) return true;
      return allowed.includes(formatFieldValue(field, valorDaColuna(row, key)));
    })
  );
  // Ordenação (client-side, genérica pelo tipo do campo)
  const sortedRows = (() => {
    if (!sort) return filteredRows;
    const field = colunas.find((f) => f.key === sort.key);
    if (!field) return filteredRows;
    const cmp = compareByField(field, sort.dir);
    return [...filteredRows].sort((a, b) =>
      cmp(valorDaColuna(a, sort.key), valorDaColuna(b, sort.key))
    );
  })();
  // Total do filtro atual: soma TODAS as linhas filtradas (não só a página
  // exibida), então acompanha visão, período, categoria, busca e filtros de coluna.
  const totalFiltrado = filteredRows.reduce((acc, row) => acc + Number(row.amount), 0);
  // Legenda do card: período + categoria (se houver) + quantidade resultante.
  const resumoSub = [
    periodoLabel(periodo),
    activeCategory?.name,
    `${filteredRows.length} ${filteredRows.length === 1 ? 'lançamento' : 'lançamentos'}`,
  ]
    .filter((part): part is string => !!part)
    .join(' · ');

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const pageRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const optionsFor = (field: CategoryField) =>
    Array.from(
      new Set(allRows.map((r) => formatFieldValue(field, valorDaColuna(r, field.key))))
    );
  const updateColFilter = (key: string, selected: string[] | null) => {
    setColFilters((prev) => {
      const next = { ...prev };
      if (selected === null) delete next[key];
      else next[key] = selected;
      return next;
    });
    setPage(1);
  };
  const updateSort = (key: string, dir: SortDir) => {
    setSort({ key, dir });
    setPage(1);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta transação?')) return;
    await deleteTransaction(id);
    refetch();
  };

  // Exporta a planilha completa — todos os lançamentos, sem os filtros da tela.
  const handleExport = async () => {
    setExporting(true);
    setExportError('');
    try {
      await downloadControleFinanceiro();
    } catch (err) {
      setExportError((err as Error).message || 'Falha ao gerar a planilha.');
    } finally {
      setExporting(false);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTx(null);
    setPendingImport(null);
    setLeituraEmRevisao(null);
  };

  /**
   * Confirmar um lançamento vindo de leitura tira a leitura da bandeja. Se falhar,
   * o lançamento já existe — então a leitura volta a aparecer, e é melhor assim:
   * duplicar o lançamento é pior que o usuário descartar a leitura à mão.
   */
  const revisarLeitura = (imp: {
    id: string;
    arquivoId: string;
    nomeOriginal: string;
    mimetype: string;
    tamanho: number;
    resultado: NotaImportResult['extraction'] | null;
  }) => {
    if (!imp.resultado) return;
    setEditingTx(null);
    setPendingImport({
      nota: {
        id: imp.arquivoId,
        originalName: imp.nomeOriginal,
        mimetype: imp.mimetype,
        size: imp.tamanho,
      },
      extraction: imp.resultado,
    });
    setLeituraEmRevisao(imp.id);
    setShowForm(true);
  };

  const aoSalvarLancamento = async (criada?: { id: string }) => {
    if (leituraEmRevisao && criada?.id) {
      try {
        await confirmarImportacao(leituraEmRevisao, criada.id);
      } catch {
        /* a leitura segue na bandeja para o usuário descartar */
      }
      void recarregarLeituras();
    }
    closeForm();
    refetch();
  };

  const isFormOpen = showForm || !!editingTx;

  // Ao trocar a visão (pelo menu), limpa o drill-down de categoria e a página
  useEffect(() => {
    setCategoryId(null);
    setColFilters({});
    setSort(null);
    setPage(1);
  }, [view]);

  const toggleCategory = (id: string) => {
    setCategoryId((cur) => (cur === id ? null : id));
    setColFilters({});
    setSort(null);
    setPage(1);
  };
  const changePeriodo = (p: Periodo) => {
    setPeriodo(p);
    setPage(1);
  };

  // Categorias agrupadas por tipo, escopadas pela visão atual
  const incomeCategories = categories.filter((c) => c.type === 'income');
  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const visibleCategories =
    view === 'income'
      ? incomeCategories
      : view === 'expense'
        ? expenseCategories
        : [...incomeCategories, ...expenseCategories];

  // Pré-seleciona a categoria do filtro no form de criação. Numa importação não
  // pré-selecionamos: o documento pode ser de outro tipo que a categoria do filtro
  // (ex.: importar um boleto estando na visão Entradas).
  const defaultCategoryIdForNew = pendingImport ? undefined : categoryId ?? undefined;
  // Numa importação o tipo vem da leitura do documento, aplicado pelo próprio
  // formulário; aqui só passamos o da visão atual.
  const defaultTypeForNew = pendingImport
    ? undefined
    : view !== 'all'
      ? view
      : undefined;

  return (
    <Layout>
      <PageHeader
        title={view === 'income' ? 'Entradas' : view === 'expense' ? 'Saídas' : 'Lançamentos'}
        subtitle={
          view === 'income'
            ? 'Receitas registradas'
            : view === 'expense'
              ? 'Despesas registradas'
              : 'Acompanhe receitas, despesas e transferências'
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={exporting}
              title="Baixa todos os lançamentos em XLSX, sem aplicar os filtros da tela"
            >
              {exporting ? 'Gerando…' : 'Exportar'}
            </Button>
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              Importar
            </Button>
            <Button onClick={() => { setEditingTx(null); setShowForm(true); }}>
              + Nova Transação
            </Button>
          </>
        }
      />

      <FilaDeLeituras
        prontas={prontas}
        emAndamento={emAndamento}
        falhas={importacoes.filter((i) => i.status === 'falhou')}
        emRevisao={leituraEmRevisao}
        onRevisar={revisarLeitura}
        onMudou={() => void recarregarLeituras()}
      />

      {isFormOpen && (
        <Card padding="lg" className="mb-6">
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--neutral-900)', fontFamily: 'var(--font-display)' }}
          >
            {editingTx
              ? 'Editar Transação'
              : pendingImport
                ? `Nova Transação — ${DOCUMENTO_TIPO_META[pendingImport.extraction.tipoDetectado].label}`
                : 'Nova Transação'}
          </h2>
          <TransactionForm
            transaction={editingTx ?? undefined}
            defaultCategoryId={editingTx ? undefined : defaultCategoryIdForNew}
            defaultType={editingTx ? undefined : defaultTypeForNew}
            initialImport={editingTx ? undefined : pendingImport ?? undefined}
            onSuccess={(criada) => void aoSalvarLancamento(criada)}
            onEnfileirouDocumento={() => void recarregarLeituras()}
            onCancel={closeForm}
          />
        </Card>
      )}

      {/* FILTROS */}
      <div className="space-y-3 mb-4">
        {/* Busca */}
        <div className="relative max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--neutral-500)"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar lançamento..."
            className="w-full pl-9 pr-3 py-2 text-sm focus:outline-none"
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--neutral-300)',
              background: 'var(--ufly-white)',
              color: 'var(--neutral-900)',
            }}
          />
        </div>

        {/* Filtro de tempo (a visão Entradas/Saídas vem do menu Lançamentos) */}
        <div className="flex flex-wrap items-center gap-3">
          <PeriodoSelector periodo={periodo} onChange={changePeriodo} />
        </div>

        {/* Categorias (drill-down), escopadas pela visão */}
        {visibleCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {visibleCategories.map((c) => (
              <FilterChip
                key={c.id}
                label={c.name}
                dotColor={c.color}
                active={categoryId === c.id}
                onClick={() => toggleCategory(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* TOTAL — mesmo card da home, mas somando só o que está filtrado aqui */}
      {view !== 'all' && (
        <div className="max-w-[260px] mb-4">
          <KpiCard
            titulo={view === 'income' ? 'Entradas' : 'Saídas'}
            valor={loading && !data ? '—' : fmtBRL(totalFiltrado)}
            sub={resumoSub}
            cor={view === 'income' ? 'var(--finance-income)' : 'var(--finance-expense)'}
          />
        </div>
      )}

      {exportError && <p style={{ color: 'var(--danger)' }}>{exportError}</p>}
      {loading && <p style={{ color: 'var(--neutral-500)' }}>Carregando...</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <TransactionsTable
        colunas={colunas}
        qtdDinamicas={dynamicColumns.length}
        rows={pageRows}
        valorDaColuna={valorDaColuna}
        colFilters={colFilters}
        optionsFor={optionsFor}
        onFilter={updateColFilter}
        sort={sort}
        onSort={updateSort}
        onEdit={(tx) => { setShowForm(false); setEditingTx(tx); }}
        onDelete={handleDelete}
      />

      {!loading && filteredRows.length === 0 && (
        <p className="text-center py-12" style={{ color: 'var(--neutral-500)' }}>
          {search || view !== 'all' || categoryId || Object.keys(colFilters).length > 0
            ? 'Nenhuma transação encontrada com os filtros aplicados.'
            : 'Nenhuma transação encontrada.'}
        </p>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4 items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="px-3 py-1 text-sm" style={{ color: 'var(--neutral-700)' }}>
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Próxima
          </Button>
        </div>
      )}

      {showImport && (
        <ImportDocumentoDialog
          onClose={() => setShowImport(false)}
          onEnfileirado={() => {
            setShowImport(false);
            void recarregarLeituras();
          }}
        />
      )}
    </Layout>
  );
}

// ─── FilterChip ──────────────────────────────────────────────────────────────

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: 'income' | 'expense';
  /** Bolinha colorida prefixando o label (categorias). */
  dotColor?: string;
}

function FilterChip({ label, active, onClick, tone, dotColor }: FilterChipProps) {
  // Cor de destaque: navy (default), verde (income), vermelho (expense)
  const accent =
    tone === 'income'
      ? 'var(--finance-income)'
      : tone === 'expense'
        ? 'var(--finance-expense)'
        : 'var(--ufly-navy)';

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
      style={{
        borderRadius: 'var(--radius-md)',
        background: active ? accent : 'transparent',
        color: active ? '#fff' : 'var(--neutral-700)',
        border: `1px solid ${active ? accent : 'var(--neutral-300)'}`,
        fontWeight: active ? 600 : 400,
      }}
    >
      {dotColor && (
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background: dotColor,
            opacity: active ? 0.85 : 1,
            boxShadow: active ? '0 0 0 1px rgba(255,255,255,.4)' : 'none',
          }}
        />
      )}
      {label}
    </button>
  );
}

// ─── TransactionsTable ───────────────────────────────────────────────────────

interface TransactionsTableProps {
  /** Colunas-base do lançamento + campos dinâmicos, na ordem de exibição. */
  colunas: CategoryField[];
  /** Quantas das colunas são dinâmicas (para a legenda acima da tabela). */
  qtdDinamicas: number;
  rows: TransactionRow[];
  valorDaColuna: (row: TransactionRow, key: string) => unknown;
  colFilters: Record<string, string[]>;
  optionsFor: (field: CategoryField) => string[];
  onFilter: (key: string, selected: string[] | null) => void;
  sort: { key: string; dir: SortDir } | null;
  onSort: (key: string, dir: SortDir) => void;
  onEdit: (tx: TransactionRow) => void;
  onDelete: (id: string) => void;
}

/**
 * Tabela única de lançamentos. Antes existiam duas — uma com filtros por coluna
 * (quando havia campo dinâmico) e uma simples, sem filtro nenhum. Resultado: em
 * Saídas, que não tem campos padrão de tipo configurados, nada era filtrável até
 * escolher uma categoria; e em Entradas faltava a coluna Data. Agora as colunas
 * do próprio lançamento também são colunas de verdade: filtráveis e ordenáveis.
 */
function TransactionsTable({
  colunas,
  qtdDinamicas,
  rows,
  valorDaColuna,
  colFilters,
  optionsFor,
  onFilter,
  sort,
  onSort,
  onEdit,
  onDelete,
}: TransactionsTableProps) {
  // Lançamentos antigos podem não ter metadata; o aviso evita a impressão de
  // que a tabela está quebrada quando as colunas dinâmicas aparecem vazias.
  const algumSemMetadata =
    qtdDinamicas > 0 &&
    rows.some((tx) => !tx.metadata || Object.keys(tx.metadata).length === 0);

  return (
    <div className="space-y-2">
      {qtdDinamicas > 0 && (
        <div
          className="flex items-center gap-2 text-xs flex-wrap"
          style={{ color: 'var(--neutral-500)' }}
        >
          <span>
            {qtdDinamicas} {qtdDinamicas === 1 ? 'coluna adicional' : 'colunas adicionais'}{' '}
            (campos de tipo/categoria)
          </span>
          {algumSemMetadata && (
            <span
              className="ml-2 px-2 py-0.5 rounded-full text-[10px]"
              style={{ background: 'var(--warning-soft, #fffbeb)', color: '#92400e' }}
            >
              Algumas linhas ainda não têm os campos preenchidos — clique em
              "Editar" para completar.
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <Thead>
            <Tr>
              {colunas.map((f) => (
                <Th key={f.key} className={f.type === 'currency' ? 'text-right' : undefined}>
                  <span className="inline-flex items-center whitespace-nowrap">
                    {f.label}
                    {/* Descrição fica de fora: é texto livre, praticamente único
                        por lançamento, então uma lista de valores distintos não
                        filtra nada. Para ela existe a busca acima da tabela. */}
                    {f.key !== BASE_KEYS.descricao && (
                      <ColumnFilter
                        field={f}
                        options={optionsFor(f)}
                        selected={colFilters[f.key] ?? null}
                        onApply={(sel) => onFilter(f.key, sel)}
                        sortDir={sort?.key === f.key ? sort.dir : null}
                        onSort={(dir) => onSort(f.key, dir)}
                      />
                    )}
                  </span>
                </Th>
              ))}
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((tx) => {
              const type = tx.type as TxType;
              const corDoValor =
                type === 'income'
                  ? 'var(--finance-income)'
                  : type === 'expense'
                    ? 'var(--finance-expense)'
                    : 'var(--finance-transfer)';
              return (
                <Tr key={tx.id}>
                  {colunas.map((f) => {
                    const ehValor = f.key === BASE_KEYS.valor;
                    const ehDescricao = f.key === BASE_KEYS.descricao;
                    return (
                      <Td
                        key={f.key}
                        className={[
                          ehValor ? 'text-right font-mono font-semibold tabular-nums whitespace-nowrap' : '',
                          ehDescricao ? 'font-medium' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{
                          color: ehValor ? corDoValor : 'var(--neutral-700)',
                          ...(ehDescricao ? { minWidth: 240 } : {}),
                        }}
                      >
                        {ehValor ? (
                          <>
                            {type === 'income' ? '+' : type === 'expense' ? '-' : ''}{' '}
                            {fmtBRL(Number(tx.amount))}
                          </>
                        ) : f.key === BASE_KEYS.tipo ? (
                          <Badge tone={type}>{TYPE_LABEL[type]}</Badge>
                        ) : (
                          <DynamicFieldCell field={f} value={valorDaColuna(tx, f.key)} />
                        )}
                      </Td>
                    );
                  })}
                  <Td>
                    <RowActions onEdit={() => onEdit(tx)} onDelete={() => onDelete(tx.id)} />
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}

// ─── RowActions ──────────────────────────────────────────────────────────────

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-3 justify-end">
      <button
        onClick={onEdit}
        className="text-xs hover:underline"
        style={{ color: 'var(--ufly-mid)' }}
      >
        Editar
      </button>
      <button
        onClick={onDelete}
        className="text-xs hover:underline"
        style={{ color: 'var(--danger)' }}
      >
        Remover
      </button>
    </div>
  );
}
