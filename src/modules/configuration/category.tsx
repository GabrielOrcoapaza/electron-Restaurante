import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_CATEGORIES_BY_BRANCH } from '../../graphql/queries';
import { CREATE_CATEGORY } from '../../graphql/mutations';
import CategoryList from './categoryList';

interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
  isActive: boolean;
}

const CategoryModule: React.FC = () => {
  const { companyData } = useAuth();
  const branchId = companyData?.branch?.id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    order: 0,
    isActive: true,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, loading, error, refetch } = useQuery(GET_CATEGORIES_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only',
  });

  const [createCategory, { loading: creating }] = useMutation(CREATE_CATEGORY, {
    onCompleted: (res) => {
      const result = res?.createCategory;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message || 'Categoría creada exitosamente' });
        setFormData({
          name: '',
          description: '',
          order: 0,
          isActive: true,
        });
        refetch();
      } else {
        setMessage({ type: 'error', text: result?.message || 'No se pudo crear la categoría' });
      }
    },
    onError: (mutationError) => {
      setMessage({ type: 'error', text: mutationError.message });
    },
  });

  const categories: Category[] = data?.categoriesByBranch || [];

  if (!branchId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        No se encontró información de sucursal.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
        Cargando categorías...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#dc2626' }}>
        Error al cargar categorías: {error.message}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '1rem',
          border: '1px solid #e2e8f0',
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem', color: '#334155' }}>Crear Categoría</h3>

        {message && (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.75rem',
              borderRadius: '8px',
              border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
              backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: message.type === 'success' ? '#166534' : '#991b1b',
              fontSize: '0.875rem',
            }}
          >
            {message.text}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            createCategory({
              variables: {
                branchId,
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                icon: null,
                color: '#000000',
                order: Number(formData.order) || 0,
                isActive: formData.isActive,
              },
            });
          }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}
        >
          <input
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Nombre de categoría"
            required
            style={{ padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
          />

          <input
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Descripción (opcional)"
            style={{ padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="number"
              min={0}
              value={formData.order}
              onChange={(e) => setFormData((prev) => ({ ...prev, order: Number(e.target.value) || 0 }))}
              style={{ padding: '0.5rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '8px', width: '70px', maxWidth: '70px', boxSizing: 'border-box' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.875rem', margin: 0, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Activa
            </label>
          </div>

          <button
            type="submit"
            disabled={creating || !formData.name.trim()}
            style={{
              padding: '0.625rem 1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: creating ? '#94a3b8' : '#6366f1',
              color: 'white',
              fontWeight: 600,
              cursor: creating ? 'not-allowed' : 'pointer',
            }}
          >
            {creating ? 'Creando...' : 'Crear Categoría'}
          </button>
        </form>
      </div>

      <CategoryList categories={categories} />
    </div>
  );
};

export default CategoryModule;
