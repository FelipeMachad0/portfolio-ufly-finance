import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  CategoryCreateSchema,
  CategoryUpdateSchema,
  type Category,
  type CategoryField,
} from '@ufly/shared';
import { createCategory, updateCategory } from '../../services/categories.service';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { CategoryFieldsEditor } from './CategoryFieldsEditor';

interface FormValues {
  name: string;
  type: string;
  color: string;
  icon: string;
}

interface Props {
  /** Quando presente, o form opera em modo edição. */
  category?: Category;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CategoryForm({ category, onSuccess, onCancel }: Props) {
  const isEdit = !!category;
  const [serverError, setServerError] = useState('');
  const [fieldsSchema, setFieldsSchema] = useState<CategoryField[]>(
    category?.fieldsSchema ?? []
  );

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: category
      ? {
          name: category.name,
          type: category.type,
          color: category.color,
          icon: category.icon ?? '',
        }
      : { color: '#08133E' },
  });

  const validateFields = (): string | null => {
    // Labels obrigatórios e chaves únicas
    const seen = new Set<string>();
    for (const f of fieldsSchema) {
      if (!f.label.trim()) {
        return 'Todos os campos precisam de um nome.';
      }
      if (seen.has(f.key)) {
        return `Existem dois campos com a mesma chave (${f.key}). Renomeie um deles.`;
      }
      seen.add(f.key);
      if (f.type === 'select' && (!f.options || f.options.length === 0)) {
        return `O campo "${f.label}" é do tipo lista, mas não tem opções.`;
      }
    }
    return null;
  };

  const onSubmit = async (raw: FormValues) => {
    setServerError('');
    const fieldsError = validateFields();
    if (fieldsError) {
      setServerError(fieldsError);
      return;
    }
    try {
      if (isEdit && category) {
        const parsed = CategoryUpdateSchema.safeParse({
          name: raw.name,
          color: raw.color,
          icon: raw.icon || undefined,
          fieldsSchema,
        });
        if (!parsed.success) {
          setServerError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
          return;
        }
        await updateCategory(category.id, parsed.data);
      } else {
        const parsed = CategoryCreateSchema.safeParse({
          name: raw.name,
          type: raw.type,
          color: raw.color,
          icon: raw.icon || undefined,
          fieldsSchema,
        });
        if (!parsed.success) {
          setServerError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
          return;
        }
        await createCategory(parsed.data);
      }
      onSuccess();
    } catch (err) {
      setServerError((err as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{serverError}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Nome"
          placeholder="Ex: Alimentação, Salário"
          {...register('name', { required: true })}
        />

        <Select
          label="Tipo"
          disabled={isEdit}
          {...register('type', { required: !isEdit })}
        >
          <option value="">Selecione</option>
          <option value="income">Receita</option>
          <option value="expense">Despesa</option>
        </Select>
      </div>

      <div className="grid grid-cols-[auto_1fr] items-end gap-4">
        <div className="flex flex-col">
          <label
            htmlFor="category-color"
            className="text-sm font-medium mb-1.5"
            style={{ color: 'var(--neutral-700)' }}
          >
            Cor
          </label>
          <input
            id="category-color"
            type="color"
            className="w-16 h-10 cursor-pointer"
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--neutral-300)',
            }}
            {...register('color')}
          />
        </div>

        <Input
          label="Ícone (opcional)"
          placeholder="Ex: shopping-cart"
          {...register('icon')}
        />
      </div>

      {/* EDITOR DE CAMPOS DINÂMICOS */}
      <div
        className="pt-4 mt-2 space-y-3"
        style={{ borderTop: '1px solid var(--neutral-200)' }}
      >
        <div>
          <h3
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--neutral-700)' }}
          >
            Campos da categoria
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--neutral-500)' }}>
            Defina quais informações aparecem no formulário e na tabela das
            transações desta categoria.
          </p>
        </div>
        <CategoryFieldsEditor
          value={fieldsSchema}
          onChange={setFieldsSchema}
        />
      </div>

      {isEdit && (
        <p className="text-xs" style={{ color: 'var(--neutral-500)' }}>
          O tipo (receita/despesa) não pode ser alterado para preservar transações vinculadas.
          As chaves dos campos existentes também são preservadas (a renomeação no nome
          não muda a chave interna).
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting
            ? 'Salvando...'
            : isEdit
              ? 'Salvar alterações'
              : 'Criar Categoria'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
