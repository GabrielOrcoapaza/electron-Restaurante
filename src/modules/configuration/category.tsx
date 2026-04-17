import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_CATEGORIES_BY_BRANCH } from '../../graphql/queries';
import { CREATE_CATEGORY, UPDATE_CATEGORY } from '../../graphql/mutations';
import { CATEGORY_ICONS } from '../../constants/categoryIcons';
import CategoryIcon from '../../components/CategoryIcon';
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
    icon: 'category',
    color: '#6366f1',
    order: 0,
    isActive: true,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', description: '', icon: 'category', color: '#6366f1', order: 0, isActive: true });

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
          icon: 'category',
          color: '#6366f1',
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

  const [updateCategory, { loading: updating }] = useMutation(UPDATE_CATEGORY, {
    onCompleted: (res) => {
      const result = res?.updateCategory;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message || 'Categoría actualizada' });
        setEditingCategory(null);
        refetch();
      } else {
        setMessage({ type: 'error', text: result?.message || 'No se pudo actualizar' });
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
                icon: formData.icon || null,
                color: formData.color || '#6366f1',
                order: Number(formData.order) || 0,
                isActive: formData.isActive,
              },
            });
          }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <input
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre de categoría"
              required
              style={{ padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
            />
            <span style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.35 }}>
              Puede repetirse el mismo nombre en varias categorías; en listas y desplegables se mostrará un sufijo para distinguirlas.
            </span>
          </div>

          <input
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Descripción (opcional)"
            style={{ padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
          />

          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>Icono</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '8px', maxHeight: '100px', overflowY: 'auto' }}>
              {CATEGORY_ICONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, icon: opt.id }))}
                  title={opt.label}
                  style={{
                    padding: '0.35rem',
                    border: formData.icon === opt.id ? '2px solid #6366f1' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: formData.icon === opt.id ? '#eef2ff' : 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CategoryIcon iconId={opt.id} type="category" size="1.5rem" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>Color</label>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
              style={{ width: '48px', height: '36px', padding: '2px', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}
            />
          </div>

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

      <CategoryList categories={categories} onEdit={(cat) => { setEditingCategory(cat); setEditFormData({ name: cat.name, description: cat.description || '', icon: cat.icon || 'category', color: cat.color || '#6366f1', order: cat.order ?? 0, isActive: cat.isActive }); setMessage(null); }} />

      {/* Modal editar categoría */}
      {editingCategory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setEditingCategory(null)}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', maxWidth: '420px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem', color: '#334155' }}>Editar Categoría</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateCategory({
                  variables: {
                    categoryId: editingCategory.id,
                    name: editFormData.name.trim(),
                    description: editFormData.description.trim() || null,
                    icon: editFormData.icon || null,
                    color: editFormData.color || null,
                    order: editFormData.order,
                    isActive: editFormData.isActive,
                  },
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <input
                value={editFormData.name}
                onChange={(e) => setEditFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nombre"
                required
                style={{ padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
              />
              <input
                value={editFormData.description}
                onChange={(e) => setEditFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Descripción (opcional)"
                style={{ padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
              />
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.875rem' }}>Icono</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '8px', maxHeight: '90px', overflowY: 'auto' }}>
                  {CATEGORY_ICONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEditFormData((p) => ({ ...p, icon: opt.id }))}
                      title={opt.label}
                      style={{
                        padding: '0.3rem',
                        border: editFormData.icon === opt.id ? '2px solid #6366f1' : '1px solid #e2e8f0',
                        borderRadius: '6px',
                        background: editFormData.icon === opt.id ? '#eef2ff' : 'white',
                        cursor: 'pointer',
                      }}
                    >
                      <CategoryIcon iconId={opt.id} type="category" size="1.25rem" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.875rem' }}>Color</label>
                <input
                  type="color"
                  value={editFormData.color}
                  onChange={(e) => setEditFormData((p) => ({ ...p, color: e.target.value }))}
                  style={{ width: '48px', height: '32px', padding: '2px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="number"
                  min={0}
                  value={editFormData.order}
                  onChange={(e) => setEditFormData((p) => ({ ...p, order: Number(e.target.value) || 0 }))}
                  style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px', width: '80px', boxSizing: 'border-box' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', margin: 0, cursor: 'pointer' }}>
                  <input type="checkbox" checked={editFormData.isActive} onChange={(e) => setEditFormData((p) => ({ ...p, isActive: e.target.checked }))} />
                  Activa
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setEditingCategory(null)} style={{ padding: '0.625rem 1rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={updating || !editFormData.name.trim()} style={{ padding: '0.625rem 1rem', borderRadius: '8px', border: 'none', background: updating ? '#94a3b8' : '#6366f1', color: 'white', fontWeight: 600, cursor: updating ? 'not-allowed' : 'pointer', flex: 1 }}>{updating ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryModule;
