import React, { useState, useEffect } from 'react';

interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
  isActive: boolean;
}

interface CategoryListProps {
  categories: Category[];
  onEdit?: (category: Category) => void;
}

const ITEMS_PER_PAGE = 10;

const CategoryList: React.FC<CategoryListProps> = ({ categories, onEdit }) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(categories.length / ITEMS_PER_PAGE));
  const categoriesPaginated = categories.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages, categories.length]);

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '1rem',
        border: '1px solid #e2e8f0',
      }}
    >
      <h3 style={{ margin: '0 0 0.75rem', color: '#334155' }}>
        Categorías ({categories.length})
      </h3>

      {categories.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem 1rem' }}>
          No hay categorías registradas.
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '0.65rem' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: '0.65rem' }}>Descripción</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem' }}>Orden</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem' }}>Estado</th>
                  {onEdit && <th style={{ textAlign: 'center', padding: '0.65rem', width: '80px' }}>Acción</th>}
                </tr>
              </thead>
              <tbody>
                {categoriesPaginated.map((category) => (
                <tr key={category.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.65rem', color: '#334155', fontWeight: 600 }}>{category.name}</td>
                  <td style={{ padding: '0.65rem', color: '#64748b' }}>{category.description || '-'}</td>
                  <td style={{ padding: '0.65rem', textAlign: 'center', color: '#334155' }}>{category.order ?? 0}</td>
                  <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: category.isActive ? '#dcfce7' : '#fee2e2',
                        color: category.isActive ? '#166534' : '#991b1b',
                      }}
                    >
                      {category.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  {onEdit && (
                    <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => onEdit(category)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#6366f1',
                          background: '#eef2ff',
                          border: '1px solid #c7d2fe',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '0.75rem 0',
              borderTop: '1px solid #e2e8f0',
              marginTop: '0.5rem',
            }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: '0.35rem 0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: page <= 1 ? '#f1f5f9' : 'white',
                  color: page <= 1 ? '#94a3b8' : '#475569',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                Anterior
              </button>
              <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 500 }}>
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  padding: '0.35rem 0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: page >= totalPages ? '#f1f5f9' : 'white',
                  color: page >= totalPages ? '#94a3b8' : '#475569',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CategoryList;
