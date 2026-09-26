import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { BudgetCreateSchema, BudgetPeriodEnum } from '@ufly/shared';
import { createBudget } from '../../services/budgets.service';
import { getCategories } from '../../services/categories.service';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { Select } from '../common/Select';

interface FormValues {
  categoryId: string;
  limitAmount: string;
  period: string;
}

interface Category {
  id: string;
  name: string;
}

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export function BudgetForm({ onSuccess, onCancel }: Props) {
  const [serverError, setServerError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormValues>();

  useEffect(() => {
    getCategories('expense').then(setCategories).catch(() => {});
  }, []);

  const onSubmit = async (raw: FormValues) => {
    setServerError('');
    const parsed = BudgetCreateSchema.safeParse({
      categoryId: raw.categoryId,
      limitAmount: parseFloat(raw.limitAmount) || 0,
      period: raw.period,
    });
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
      return;
    }
    try {
      await createBudget(parsed.data);
      onSuccess();
    } catch (err) {
      setServerError((err as Error).message);
    }
  };

  return (
    <Card padding="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{serverError}</p>
        )}

        <Select label="Categoria de despesa" {...register('categoryId')}>
          <option value="">Selecione uma categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>

        <Input
          label="Limite (R$)"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0,00"
          {...register('limitAmount')}
        />

        <Select label="Período" {...register('period')}>
          <option value="">Selecione o período</option>
          {BudgetPeriodEnum.options.map((p) => (
            <option key={p} value={p}>{p === 'monthly' ? 'Mensal' : 'Anual'}</option>
          ))}
        </Select>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? 'Salvando...' : 'Criar Orçamento'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
