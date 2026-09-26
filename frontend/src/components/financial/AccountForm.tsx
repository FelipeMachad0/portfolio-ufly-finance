import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AccountCreateSchema } from '@ufly/shared';
import { createAccount } from '../../services/accounts.service';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';

interface FormValues {
  name: string;
  type: string;
  balance: string;
}

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export function AccountForm({ onSuccess, onCancel }: Props) {
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormValues>();

  const onSubmit = async (raw: FormValues) => {
    setServerError('');
    const parsed = AccountCreateSchema.safeParse({
      name: raw.name,
      type: raw.type,
      balance: parseFloat(raw.balance) || 0,
    });
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
      return;
    }
    try {
      await createAccount(parsed.data);
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

      <Input
        label="Nome"
        placeholder="Ex: Nubank, Carteira"
        {...register('name')}
      />

      <Select label="Tipo" {...register('type')}>
        <option value="">Selecione o tipo</option>
        <option value="bank">Conta Bancária</option>
        <option value="credit_card">Cartão de Crédito</option>
        <option value="wallet">Carteira</option>
      </Select>

      <Input
        label="Saldo Inicial (R$)"
        type="number"
        step="0.01"
        min="0"
        defaultValue="0"
        {...register('balance')}
      />

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Salvando...' : 'Criar Conta'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
