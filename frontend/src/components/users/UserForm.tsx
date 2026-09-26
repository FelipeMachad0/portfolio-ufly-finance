import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { UserCreateSchema, UserUpdateSchema } from '@ufly/shared';
import { createUser, updateUser, type UserRow } from '../../services/users.service';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';

interface FormValues {
  name: string;
  email: string;
  role: string;
  status: string;
}

interface Props {
  user?: UserRow;
  /** Recebe a senha padrão atribuída quando um novo usuário é criado */
  onSuccess: (created?: { email: string }) => void;
  onCancel: () => void;
}

export function UserForm({ user, onSuccess, onCancel }: Props) {
  const isEdit = Boolean(user);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'USUARIO',
      status: user?.status ?? 'ATIVO',
    },
  });

  const onSubmit = async (raw: FormValues) => {
    setServerError('');
    try {
      if (isEdit && user) {
        const parsed = UserUpdateSchema.safeParse({
          name: raw.name,
          role: raw.role,
          status: raw.status,
        });
        if (!parsed.success) {
          setServerError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
          return;
        }
        await updateUser(user.id, parsed.data);
        onSuccess();
      } else {
        const parsed = UserCreateSchema.safeParse({
          email: raw.email,
          name: raw.name,
          role: raw.role,
        });
        if (!parsed.success) {
          setServerError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
          return;
        }
        const created = await createUser(parsed.data);
        onSuccess(
        created.email ? { email: created.email } : undefined,
        );
      }
    } catch (err) {
      const apiErr = err as { response?: { data?: { error?: string } }; message?: string };
      setServerError(apiErr.response?.data?.error ?? apiErr.message ?? 'Erro ao salvar');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{serverError}</p>
      )}

      <Input label="Nome" placeholder="Nome completo" {...register('name')} />

      <Input
        label="Email"
        type="email"
        disabled={isEdit}
        placeholder="email@empresa.com"
        {...register('email')}
      />

      <Select label="Papel" {...register('role')}>
        <option value="USUARIO">Usuário</option>
        <option value="GESTOR_DEPARTAMENTO">Gestor de Departamento</option>
        <option value="GESTOR_GERAL">Gestor Geral</option>
        <option value="AUDITOR">Auditor</option>
      </Select>

      {isEdit && (
        <Select label="Status" {...register('status')}>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
        </Select>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Usuário'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
