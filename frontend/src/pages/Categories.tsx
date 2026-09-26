import { useCallback, useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { CategoryForm } from '../components/financial/CategoryForm';
import { TypeFieldsSection } from '../components/financial/TypeFieldsSection';
import { deleteCategory, getCategories } from '../services/categories.service';
import type { Category } from '@ufly/shared';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/common/PageHeader';

export function Categories() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Usa getCategories() (que normaliza snake_case → camelCase) em vez de
  // useApi direto, garantindo que category.fieldsSchema sempre exista.
  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    getCategories()
      .then((data) => setCategories(data))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta categoria?')) return;
    await deleteCategory(id);
    refetch();
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCategory(null);
  };

  const income = categories?.filter((c) => c.type === 'income') ?? [];
  const expense = categories?.filter((c) => c.type === 'expense') ?? [];

  const isFormOpen = showForm || !!editingCategory;

  return (
    <Layout>
      <PageHeader
        title="Categorias"
        subtitle="Organize receitas e despesas em categorias"
        actions={
          <Button onClick={() => { setEditingCategory(null); setShowForm(true); }}>
            + Nova Categoria
          </Button>
        }
      />

      <TypeFieldsSection />

      {isFormOpen && (
        <Card padding="lg" className="mb-6">
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--neutral-900)', fontFamily: 'var(--font-display)' }}
          >
            {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
          </h2>
          <CategoryForm
            category={editingCategory ?? undefined}
            onSuccess={() => { closeForm(); refetch(); }}
            onCancel={closeForm}
          />
        </Card>
      )}

      {loading && <p style={{ color: 'var(--neutral-500)' }}>Carregando...</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2
            className="text-lg font-semibold mb-3"
            style={{ color: 'var(--finance-income)', fontFamily: 'var(--font-display)' }}
          >
            Receitas
          </h2>
          <div className="space-y-2">
            {income.map((c) => (
              <CategoryCard
                key={c.id}
                category={c}
                onEdit={() => { setShowForm(false); setEditingCategory(c); }}
                onDelete={handleDelete}
              />
            ))}
            {income.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
                Nenhuma categoria de receita
              </p>
            )}
          </div>
        </div>

        <div>
          <h2
            className="text-lg font-semibold mb-3"
            style={{ color: 'var(--finance-expense)', fontFamily: 'var(--font-display)' }}
          >
            Despesas
          </h2>
          <div className="space-y-2">
            {expense.map((c) => (
              <CategoryCard
                key={c.id}
                category={c}
                onEdit={() => { setShowForm(false); setEditingCategory(c); }}
                onDelete={handleDelete}
              />
            ))}
            {expense.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
                Nenhuma categoria de despesa
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function CategoryCard({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card padding="sm" className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />
        <span className="font-medium truncate" style={{ color: 'var(--ufly-navy)' }}>
          {category.name}
        </span>
        {category.icon && (
          <span className="text-sm" style={{ color: 'var(--neutral-500)' }}>
            {category.icon}
          </span>
        )}
        {category.fieldsSchema.length > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{
              background: 'var(--ufly-ice)',
              color: 'var(--ufly-deep)',
            }}
            title={category.fieldsSchema.map((f) => f.label).join(', ')}
          >
            {category.fieldsSchema.length} {category.fieldsSchema.length === 1 ? 'campo' : 'campos'}
          </span>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={onEdit}
          className="text-sm hover:underline"
          style={{ color: 'var(--ufly-mid)' }}
        >
          Editar
        </button>
        <button
          onClick={() => onDelete(category.id)}
          className="text-sm hover:underline"
          style={{ color: 'var(--danger)' }}
        >
          Remover
        </button>
      </div>
    </Card>
  );
}
