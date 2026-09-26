import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  DOCUMENTO_TIPO_META,
  TransactionCreateSchema,
  TransactionUpdateSchema,
  type Account,
  type Category,
  type CategoryField,
  type Cliente,
  type Confianca,
  type DocumentoTipo,
  type NotaImportResult,
} from '@ufly/shared';
import {
  createTransaction,
  updateTransaction,
  type TransactionRow,
} from '../../services/transactions.service';
import { getAccounts } from '../../services/accounts.service';
import { getCategories } from '../../services/categories.service';
import { getTypeFields, type TypeFields } from '../../services/typefields.service';
import { getClientes } from '../../services/clientes.service';
import { getProjetos, type ProjetoRow } from '../../services/projetos.service';
import { uploadNota, previewNota, downloadNota, canPreview, type NotaRef } from '../../services/uploads.service';
import { ImportDocumentoDialog } from './ImportDocumentoDialog';
import { FilePicker } from '../common/FilePicker';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import {
  DynamicFieldInput,
  coerceFieldValue,
  stringifyFieldValue,
} from './DynamicFieldInput';

interface FormValues {
  accountId: string;
  categoryId: string;
  amount: string;
  type: string;
  description: string;
  date: string;
  status: string;
}

interface Props {
  /** Quando presente, o form opera em modo edição. */
  transaction?: TransactionRow;
  /** Pré-seleciona uma categoria ao abrir o form (ex: vindo de um filtro). */
  defaultCategoryId?: string;
  /** Restringe as categorias a um tipo (Entradas/Saídas), vindo da visão atual. */
  defaultType?: 'income' | 'expense';
  /**
   * Resultado de uma importação já feita fora do form (botão "Importar" da
   * página). Aplicado uma vez ao abrir, igual à importação feita aqui dentro.
   */
  initialImport?: NotaImportResult;
  /** Avisado quando o usuário enfileira outro documento pelo "Trocar documento". */
  onEnfileirouDocumento?: () => void;
  /** Recebe o lançamento criado, quando é criação (a fila usa o id). */
  onSuccess: (criada?: { id: string }) => void;
  onCancel: () => void;
}

export function TransactionForm({
  transaction,
  defaultCategoryId,
  defaultType,
  initialImport,
  onEnfileirouDocumento,
  onSuccess,
  onCancel,
}: Props) {
  const isEdit = !!transaction;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [typeFields, setTypeFields] = useState<TypeFields>({ income: [], expense: [] });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [projetos, setProjetos] = useState<ProjetoRow[]>([]);
  const [serverError, setServerError] = useState('');

  // Nota (anexo) do lançamento — referência guardada em metadata._nota.
  const [nota, setNota] = useState<NotaRef | null>(
    (transaction?.metadata?.['_nota'] as NotaRef | undefined) ?? null
  );
  const [notaFile, setNotaFile] = useState<File | null>(null);
  const [uploadingNota, setUploadingNota] = useState(false);

  // Importação de documento com leitura automática (pré-preenche o formulário).
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  /** O que a leitura identificou, mostrado para o usuário conferir. */
  const [leitura, setLeitura] = useState<{ tipo: DocumentoTipo; confianca: Confianca } | null>(null);
  /**
   * Categoria sugerida pela leitura, por NOME. Fica pendente até as categorias
   * carregarem — a importação pode chegar antes do fetch terminar.
   */
  const [categoriaSugerida, setCategoriaSugerida] = useState<string | null>(null);

  /**
   * Entrada ou Saída. Vem da visão em que o usuário estava (Lançamentos →
   * Entradas abre como Entrada), mas é editável: quem está com pressa não deve
   * precisar voltar e trocar de aba para lançar uma saída, nem alternar entre as
   * duas visões ao cadastrar várias transações seguidas.
   */
  const [tipoEscolhido, setTipoEscolhido] = useState<'income' | 'expense' | null>(
    defaultType ?? null
  );

  // Valores dos campos dinâmicos, indexados por field.key (strings cruas do input).
  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>(() => {
    if (transaction?.metadata) {
      const init: Record<string, string> = {};
      for (const [k, v] of Object.entries(transaction.metadata)) {
        init[k] = stringifyFieldValue(v);
      }
      return init;
    }
    return {};
  });

  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: transaction
      ? {
          accountId: transaction.account_id,
          categoryId: transaction.category_id ?? '',
          amount: String(transaction.amount),
          type: transaction.type,
          description: transaction.description,
          date: new Date(transaction.date).toISOString().split('T')[0],
          status: transaction.status,
        }
      : {
          categoryId: defaultCategoryId ?? '',
          status: 'completed',
          date: new Date().toISOString().split('T')[0],
        },
  });

  const selectedCategoryId = watch('categoryId');

  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => {});
    getCategories().then(setCategories).catch(() => {});
    getTypeFields().then(setTypeFields).catch(() => {});
    getClientes().then(setClientes).catch(() => {});
    getProjetos().then(setProjetos).catch(() => {});
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  // O tipo real vem da categoria escolhida; até lá, vale o do seletor
  // Entrada/Saída (ou o da transação, em edição, onde não se troca).
  const derivedType = selectedCategory?.type ?? (isEdit ? transaction?.type : tipoEscolhido);

  // Campos padrão do tipo (Entrada/Saída) + campos da categoria selecionada
  const typeFieldsForType: CategoryField[] =
    derivedType === 'income' || derivedType === 'expense' ? typeFields[derivedType] : [];
  const categoryFields: CategoryField[] = selectedCategory?.fieldsSchema ?? [];
  // combinado, sem chaves duplicadas (campos do tipo primeiro)
  const allDynamicFields: CategoryField[] = [
    ...typeFieldsForType,
    ...categoryFields.filter((cf) => !typeFieldsForType.some((tf) => tf.key === cf.key)),
  ];

  // Categorias restritas ao tipo escolhido (criação) ou ao da transação (edição)
  const typeForCategoryFilter = isEdit ? transaction?.type : tipoEscolhido;
  const filteredCategories = typeForCategoryFilter
    ? categories.filter((c) => c.type === typeForCategoryFilter)
    : categories;

  /**
   * Troca entre Entrada e Saída. Descarta a categoria selecionada quando ela não
   * pertence ao novo tipo — senão o form ficaria com "Serviços" (entrada) marcado
   * enquanto o seletor diz Saída, e o lançamento nasceria com o tipo errado.
   */
  const trocarTipo = (novo: 'income' | 'expense') => {
    setTipoEscolhido(novo);
    const atual = categories.find((c) => c.id === selectedCategoryId);
    if (atual && atual.type !== novo) setValue('categoryId', '');
  };

  /**
   * Aplica a categoria sugerida pela leitura do documento assim que as categorias
   * estiverem carregadas. A leitura devolve o NOME ("Impostos"), não o id — é o
   * que a leitura sabe produzir, e o id é interno do banco.
   */
  useEffect(() => {
    if (!categoriaSugerida || categories.length === 0) return;
    const alvo = categoriaSugerida.trim().toLowerCase();
    const achada = categories.find(
      (c) => c.name.trim().toLowerCase() === alvo && (!tipoEscolhido || c.type === tipoEscolhido)
    );
    if (achada) setValue('categoryId', achada.id);
    setCategoriaSugerida(null);
  }, [categoriaSugerida, categories, tipoEscolhido, setValue]);

  // ── Campos vinculados (cascata cliente -> empresa/cnpj/projeto) ──
  const clienteFieldKey = allDynamicFields.find((f) => f.type === 'cliente')?.key;
  const selectedClienteId = clienteFieldKey ? (dynamicValues[clienteFieldKey] ?? '') : '';
  const selectedClienteObj = clientes.find((c) => c.id === selectedClienteId) ?? null;
  const empresasOfCliente = selectedClienteObj?.empresas ?? [];
  const projetosOfCliente = projetos.filter((p) => p.clienteId === selectedClienteId);

  const renderDynamicField = (field: CategoryField) => {
    const value = dynamicValues[field.key] ?? '';
    const setValue = (v: string) => setDynamicValues((prev) => ({ ...prev, [field.key]: v }));
    const label = field.required ? `${field.label} *` : field.label;

    switch (field.type) {
      case 'cliente':
        return (
          <Select
            key={field.key}
            label={label}
            value={value}
            onChange={(e) => {
              const newId = e.target.value;
              setDynamicValues((prev) => {
                const next = { ...prev, [field.key]: newId };
                // troca de cliente limpa empresa/cnpj/projeto dependentes
                for (const f of allDynamicFields) {
                  if (f.type === 'empresa' || f.type === 'cnpj' || f.type === 'projeto') next[f.key] = '';
                }
                return next;
              });
            }}
          >
            <option value="">Selecione</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        );
      case 'empresa':
        return (
          <Select
            key={field.key}
            label={label}
            value={value}
            disabled={!selectedClienteId}
            onChange={(e) => {
              const nome = e.target.value;
              const emp = empresasOfCliente.find((em) => em.nome === nome);
              setDynamicValues((prev) => {
                const next = { ...prev, [field.key]: nome };
                const cnpjKey = allDynamicFields.find((f) => f.type === 'cnpj')?.key;
                if (cnpjKey) next[cnpjKey] = emp?.cnpj ?? '';
                return next;
              });
            }}
          >
            <option value="">{selectedClienteId ? 'Selecione' : 'Selecione o cliente antes'}</option>
            {empresasOfCliente.map((em, i) => <option key={i} value={em.nome}>{em.nome}</option>)}
          </Select>
        );
      case 'cnpj':
        return (
          <Input key={field.key} label={label} value={value} disabled readOnly placeholder="Preenchido pela empresa" />
        );
      case 'projeto':
        return (
          <Select
            key={field.key}
            label={label}
            value={value}
            disabled={!selectedClienteId}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">{selectedClienteId ? 'Selecione' : 'Selecione o cliente antes'}</option>
            {projetosOfCliente.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        );
      default:
        return <DynamicFieldInput key={field.key} field={field} value={value} onChange={setValue} />;
    }
  };

  const buildMetadata = (): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...(transaction?.metadata ?? {}) };
    for (const f of allDynamicFields) {
      const raw = dynamicValues[f.key] ?? '';
      const coerced = coerceFieldValue(f, raw);
      if (coerced === null || coerced === '' || coerced === undefined) {
        delete out[f.key];
      } else {
        out[f.key] = coerced;
      }
    }
    return out;
  };

  /**
   * Aplica o resultado de uma importação: anexa o documento e pré-preenche os
   * campos. Serve tanto para a importação feita aqui dentro quanto para a que
   * vem da página (initialImport).
   */
  const applyImport = useCallback(
    ({ nota: ref, extraction }: NotaImportResult) => {
      setServerError('');
      // O documento fica anexado ao lançamento (o usuário pode vê-lo depois).
      setNota(ref);
      setNotaFile(null);
      setLeitura({ tipo: extraction.tipoDetectado, confianca: extraction.confianca });
      // Entrada ou saída: a leitura sugere (nota fiscal → entrada, o resto →
      // saída) e o usuário pode trocar no seletor.
      if (extraction.tipoLancamentoSugerido) setTipoEscolhido(extraction.tipoLancamentoSugerido);
      if (extraction.categoriaSugerida) setCategoriaSugerida(extraction.categoriaSugerida);
      // Pré-preenche os campos de topo, se a leitura extraiu.
      if (extraction.amount !== undefined) setValue('amount', String(extraction.amount));
      if (extraction.description) setValue('description', extraction.description);
      if (extraction.date) setValue('date', extraction.date);
      // Pré-preenche os campos dinâmicos por key (cliente, cnpj, impostos, etc.).
      const meta = extraction.metadata ?? {};
      if (Object.keys(meta).length > 0) {
        setDynamicValues((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(meta)) next[k] = stringifyFieldValue(v);
          return next;
        });
      }
      setImportWarnings(extraction.warnings ?? []);
    },
    [setValue]
  );

  // Importação vinda da página: aplica uma única vez ao abrir o formulário.
  const initialImportApplied = useRef(false);
  useEffect(() => {
    if (!initialImport || initialImportApplied.current) return;
    initialImportApplied.current = true;
    applyImport(initialImport);
  }, [initialImport, applyImport]);

  const onSubmit = async (raw: FormValues) => {
    setServerError('');
    // Só é preenchida na criação; a fila de leituras usa o id para vincular a
    // importação ao lançamento e tirá-la da bandeja.
    let criada: { id: string } | undefined;
    try {
      let notaRef = nota;
      if (notaFile) {
        setUploadingNota(true);
        try {
          notaRef = await uploadNota(notaFile);
        } finally {
          setUploadingNota(false);
        }
      }
      const metadata = { ...buildMetadata() };
      if (notaRef) metadata['_nota'] = notaRef;
      else delete metadata['_nota'];
      if (isEdit && transaction) {
        const parsed = TransactionUpdateSchema.safeParse({
          categoryId: raw.categoryId || null,
          amount: parseFloat(raw.amount),
          description: raw.description,
          date: raw.date ? new Date(raw.date) : undefined,
          status: raw.status,
          metadata,
        });
        if (!parsed.success) {
          setServerError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
          return;
        }
        await updateTransaction(transaction.id, parsed.data);
      } else {
        if (!selectedCategory) {
          setServerError('Selecione uma categoria');
          return;
        }
        const parsed = TransactionCreateSchema.safeParse({
          accountId: raw.accountId,
          categoryId: selectedCategory.id,
          amount: parseFloat(raw.amount),
          type: selectedCategory.type,
          description: raw.description,
          date: raw.date ? new Date(raw.date) : new Date(),
          status: raw.status || 'completed',
          metadata,
        });
        if (!parsed.success) {
          setServerError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
          return;
        }
        criada = await createTransaction(parsed.data);
      }
      onSuccess(criada);
    } catch (err) {
      setServerError((err as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{serverError}</p>
      )}

      {/* IMPORTAR DOCUMENTO (só na criação) — a leitura pré-preenche */}
      {!isEdit && (
        <div
          className="rounded-lg p-3"
          style={{ border: '1px solid var(--ufly-cyan)', background: 'var(--neutral-50)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--ufly-navy)' }}>
                Importar documento
              </p>
              <p className="text-xs" style={{ color: 'var(--neutral-600)' }}>
                Nota fiscal, boleto, fatura de cartão ou imposto — a leitura
                identifica o documento e preenche os campos para você revisar.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setShowImportDialog(true)}>
              {leitura ? 'Trocar documento' : 'Importar'}
            </Button>
          </div>

          {/* O que foi identificado. A confiança é mostrada porque a leitura
              erra: baixa significa "revise tudo", não "está pronto". */}
          {leitura && (
            <p className="mt-2 text-xs flex items-center gap-2" style={{ color: 'var(--neutral-700)' }}>
              <span
                className="px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'var(--ufly-cyan-soft)', color: 'var(--ufly-navy)' }}
              >
                {DOCUMENTO_TIPO_META[leitura.tipo].label}
              </span>
              <span style={{ color: 'var(--neutral-600)' }}>
                {leitura.confianca === 'alta'
                  ? 'identificado com confiança — confira os campos'
                  : leitura.confianca === 'media'
                    ? 'identificação provável — confira os campos'
                    : 'não foi possível identificar com segurança — preencha e confira'}
              </span>
            </p>
          )}

          {importWarnings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {importWarnings.map((w, i) => (
                <li key={i} className="text-xs flex gap-1" style={{ color: 'var(--neutral-600)' }}>
                  <span aria-hidden>⚠️</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ENTRADA / SAÍDA — só na criação; em edição o tipo é imutável, junto de
          conta e categoria. */}
      {!isEdit && (
        <div>
          <span className="block text-sm font-medium mb-1" style={{ color: 'var(--neutral-700)' }}>
            Tipo de lançamento
          </span>
          <div
            role="radiogroup"
            aria-label="Tipo de lançamento"
            className="inline-flex p-1 gap-1 rounded-lg"
            style={{ background: 'var(--neutral-100)' }}
          >
            {([
              { valor: 'income', label: 'Entrada', cor: 'var(--ufly-green)' },
              { valor: 'expense', label: 'Saída', cor: 'var(--ufly-red)' },
            ] as const).map(({ valor, label, cor }) => {
              const ativo = tipoEscolhido === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => trocarTipo(valor)}
                  className="px-4 py-1.5 text-sm font-semibold rounded-md transition-colors"
                  style={{
                    background: ativo ? 'var(--ufly-white)' : 'transparent',
                    color: ativo ? cor : 'var(--neutral-600)',
                    boxShadow: ativo ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {!tipoEscolhido && (
            <p className="text-xs mt-1" style={{ color: 'var(--neutral-500)' }}>
              Escolha entrada ou saída para filtrar as categorias.
            </p>
          )}
        </div>
      )}

      {showImportDialog && (
        <ImportDocumentoDialog
          onClose={() => setShowImportDialog(false)}
          onEnfileirado={() => {
            // A leitura agora corre em segundo plano, então não há resultado para
            // aplicar aqui: o documento entra na fila e aparece no indicador do
            // topo quando ficar pronto.
            setShowImportDialog(false);
            onEnfileirouDocumento?.();
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Categoria"
          disabled={isEdit}
          {...register('categoryId', { required: !isEdit })}
        >
          <option value="">Selecione</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>

        <Input
          label="Valor (R$)"
          type="number"
          step="0.01"
          min="0.01"
          {...register('amount', { required: true })}
        />
      </div>

      <Input
        label="Descrição"
        placeholder="Ex: Supermercado, Salário"
        {...register('description', { required: true })}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Conta"
          disabled={isEdit}
          {...register('accountId', { required: !isEdit })}
        >
          <option value="">Selecione</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>

        <Input
          label="Data"
          type="date"
          {...register('date', { required: true })}
        />
      </div>

      <Select label="Status" {...register('status')}>
        <option value="completed">Concluída</option>
        <option value="pending">Pendente</option>
        <option value="cancelled">Cancelada</option>
      </Select>

      {/* CAMPOS PADRÃO DO TIPO (Entrada/Saída) */}
      {typeFieldsForType.length > 0 && (
        <div className="pt-4 mt-2 space-y-4" style={{ borderTop: '1px solid var(--neutral-200)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--neutral-700)' }}>
            Detalhes — {derivedType === 'income' ? 'Entrada' : 'Saída'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {typeFieldsForType.map(renderDynamicField)}
          </div>
        </div>
      )}

      {/* CAMPOS DINÂMICOS DA CATEGORIA */}
      {categoryFields.length > 0 && (
        <div className="pt-4 mt-2 space-y-4" style={{ borderTop: '1px solid var(--neutral-200)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--neutral-700)' }}>
              Detalhes — {selectedCategory?.name}
            </h3>
            <span className="text-xs" style={{ color: 'var(--neutral-500)' }}>
              {categoryFields.length} {categoryFields.length === 1 ? 'campo' : 'campos'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {categoryFields.map(renderDynamicField)}
          </div>
        </div>
      )}

      {/* NOTA (ANEXO) */}
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: 'var(--neutral-700)' }}>
          Documento / comprovante (opcional)
        </label>

        {nota ? (
          <div
            className="flex flex-wrap items-center gap-2 p-2 rounded"
            style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-50)' }}
          >
            <span className="text-sm truncate flex-1 min-w-0" style={{ color: 'var(--neutral-700)' }}>
              📎 {nota.originalName}
            </span>
            {canPreview(nota.mimetype) && (
              <button
                type="button"
                className="text-xs font-medium px-2 py-1 rounded"
                style={{ color: 'var(--ufly-cyan)' }}
                onClick={() => previewNota(nota).catch(() => setServerError('Falha ao abrir a nota'))}
              >
                Visualizar
              </button>
            )}
            <button
              type="button"
              className="text-xs font-medium px-2 py-1 rounded"
              style={{ color: 'var(--ufly-cyan)' }}
              onClick={() => downloadNota(nota).catch(() => setServerError('Falha ao baixar a nota'))}
            >
              Baixar
            </button>
            <button
              type="button"
              className="text-xs font-medium px-2 py-1 rounded"
              style={{ color: 'var(--danger)' }}
              onClick={() => { setNota(null); setNotaFile(null); }}
            >
              Remover
            </button>
          </div>
        ) : notaFile ? (
          <div
            className="flex items-center gap-2 p-2 rounded"
            style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-50)' }}
          >
            <span className="text-sm truncate flex-1 min-w-0" style={{ color: 'var(--neutral-700)' }}>
              📎 {notaFile.name} <span style={{ color: 'var(--neutral-500)' }}>(será enviada ao salvar)</span>
            </span>
            <button
              type="button"
              className="text-xs font-medium px-2 py-1 rounded"
              style={{ color: 'var(--danger)' }}
              onClick={() => setNotaFile(null)}
            >
              Remover
            </button>
          </div>
        ) : (
          <FilePicker
            accept="application/pdf,image/png,image/jpeg,image/webp"
            label="Anexar nota"
            onSelect={setNotaFile}
          />
        )}
      </div>

      {isEdit && (
        <p className="text-xs" style={{ color: 'var(--neutral-500)' }}>
          Conta e categoria não podem ser alteradas após o lançamento. Para isso, remova e crie novamente.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting
            ? (uploadingNota ? 'Enviando nota...' : 'Salvando...')
            : isEdit
              ? 'Salvar alterações'
              : 'Criar Transação'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
