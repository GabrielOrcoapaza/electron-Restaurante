import React from 'react';

interface Subcategory {
  id: string;
  name: string;
  description?: string;
  order?: number;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  isActive: boolean;
  subcategories?: Subcategory[];
}

interface SubcategoryRow extends Subcategory {
  categoryName: string;
  categoryId: string;
}

interface SubcategoryListProps {
  categories: Category[];
  onEdit?: (row: SubcategoryRow) => void;
}

const SubcategoryList: React.FC<SubcategoryListProps> = ({ categories, onEdit }) => {
  const rows: SubcategoryRow[] = categories.flatMap((category) =>
    (category.subcategories || []).map((subcategory) => ({
      categoryName: category.name,
      categoryId: category.id,
      ...subcategory,
    }))
  );

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
        Subcategorías ({rows.length})
      </h3>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem 1rem' }}>
          No hay subcategorías registradas.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'center', padding: '0.65rem' }}>Categoría</th>
                <th style={{ textAlign: 'center', padding: '0.65rem' }}>Subcategoría</th>
                <th style={{ textAlign: 'center', padding: '0.65rem' }}>Descripción</th>
                <th style={{ textAlign: 'center', padding: '0.65rem' }}>Orden</th>
                <th style={{ textAlign: 'center', padding: '0.65rem' }}>Estado</th>
                {onEdit && <th style={{ textAlign: 'center', padding: '0.65rem', width: '80px' }}>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.65rem', color: '#334155', fontWeight: 600 }}>{row.categoryName}</td>
                  <td style={{ padding: '0.65rem', color: '#334155' }}>{row.name}</td>
                  <td style={{ padding: '0.65rem', color: '#64748b' }}>{row.description || '-'}</td>
                  <td style={{ padding: '0.65rem', color: '#334155', textAlign: 'center' }}>{row.order ?? 0}</td>
                  <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: row.isActive ? '#dcfce7' : '#fee2e2',
                        color: row.isActive ? '#166534' : '#991b1b',
                      }}
                    >
                      {row.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  {onEdit && (
                    <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
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
      )}
    </div>
  );
};

export default SubcategoryList;
