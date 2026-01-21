import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_SUBCATEGORIES_WITH_MODIFIERS } from '../../graphql/queries';
import { CREATE_MODIFIER } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';

interface Category {
  id: string;
  name: string;
  isActive?: boolean;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
  notes?: Modifier[];
  categoryName?: string;
  categoryId?: string;
}

interface Modifier {
  id: string;
  note: string;
  isActive: boolean;
}

const Observation: React.FC = () => {
  const { companyData } = useAuth();
  const { breakpoint } = useResponsive();
  const branchId = companyData?.branch?.id;

  const isSmallDesktop = breakpoint === 'lg';
  
  // Tamaños adaptativos
  const cardPadding = isSmallDesktop ? '1.25rem' : '1.5rem';
  const labelFontSize = isSmallDesktop ? '0.8125rem' : '0.875rem';
  const inputFontSize = isSmallDesktop ? '0.8125rem' : '0.875rem';
  const inputPadding = isSmallDesktop ? '0.5625rem 0.75rem' : '0.625rem 0.875rem';
  const buttonPadding = isSmallDesktop ? '0.625rem 1.25rem' : '0.75rem 1.5rem';
  const buttonFontSize = isSmallDesktop ? '0.8125rem' : '0.875rem';
  const tableFontSize = isSmallDesktop ? '0.8125rem' : '0.875rem';
  const tableCellPadding = isSmallDesktop ? '0.625rem' : '0.75rem';

  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');
  const [formData, setFormData] = useState({
    note: '',
    isActive: true,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Query para obtener categorías y subcategorías
  const { data, loading, error, refetch } = useQuery(GET_SUBCATEGORIES_WITH_MODIFIERS, {
    variables: { branchId: branchId! },
    skip: !branchId,
  });

  // Mutación para crear modificador
  const [createModifier, { loading: creating }] = useMutation(CREATE_MODIFIER, {
    onCompleted: (data) => {
      if (data.createModifier.success) {
        setMessage({ type: 'success', text: data.createModifier.message });
        setFormData({ note: '', isActive: true });
        refetch();
      } else {
        setMessage({ type: 'error', text: data.createModifier.message });
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message });
    },
  });

  const categories: Category[] = data?.categoriesByBranch || [];
  
  // Obtener todas las subcategorías activas de todas las categorías
  const allSubcategories = categories
    .filter(cat => cat.isActive ?? true)
    .flatMap(cat => 
      (cat.subcategories || [])
        .filter(sub => sub.isActive)
        .map(sub => ({
          ...sub,
          categoryName: cat.name,
          categoryId: cat.id
        }))
    );

  // Encontrar la subcategoría seleccionada
  const selectedSubcategory = allSubcategories.find(sub => sub.id === selectedSubcategoryId);
  const existingModifiers = selectedSubcategory?.notes || [];

  const handleSubcategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubcategoryId(e.target.value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubcategoryId) {
      setMessage({ type: 'error', text: 'Por favor selecciona una subcategoría' });
      return;
    }
    if (!formData.note.trim()) {
      setMessage({ type: 'error', text: 'Por favor ingresa una observación' });
      return;
    }
    setMessage(null);
    createModifier({
      variables: {
        subcategoryId: selectedSubcategoryId,
        note: formData.note.trim(),
        isActive: formData.isActive,
      },
    });
  };

  if (loading) {
    return (
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: cardPadding,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          color: '#64748b'
        }}
      >
        Cargando subcategorías...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '12px',
          padding: cardPadding,
          color: '#991b1b'
        }}
      >
        Error al cargar los datos: {error.message}
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        background: 'linear-gradient(160deg, #f0f4ff 0%, #f9fafb 45%, #ffffff 100%)',
        padding: '1.5rem',
        borderRadius: '18px',
        boxShadow: '0 25px 50px -12px rgba(15,23,42,0.18)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Elementos decorativos de fondo */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: '260px',
          height: '260px',
          background: 'radial-gradient(circle at center, rgba(102,126,234,0.25), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-80px',
          left: '-80px',
          width: '220px',
          height: '220px',
          background: 'radial-gradient(circle at center, rgba(72,219,251,0.18), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0,
        }}
      />

      {/* Contenido principal */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{ 
              fontSize: isSmallDesktop ? '1.5rem' : '1.875rem',
              fontWeight: 700,
              color: '#1e293b',
              margin: 0,
              marginBottom: '0.5rem'
            }}>
              Observaciones (Modificadores)
            </h1>
            <p style={{ 
              fontSize: labelFontSize,
              color: '#64748b',
              margin: 0
            }}>
              Crea observaciones para las subcategorías de productos
            </p>
          </div>
        </div>

        {/* Mensaje de éxito/error */}
        {message && (
          <div
            style={{
              padding: '0.875rem 1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
              border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
              color: message.type === 'success' ? '#166534' : '#991b1b',
              fontSize: inputFontSize,
            }}
          >
            {message.text}
          </div>
        )}

        {/* Formulario */}
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: cardPadding,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            marginBottom: '2rem',
          }}
        >
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Subcategoría */}
              <div>
                <label
                  htmlFor="subcategoryId"
                  style={{
                    display: 'block',
                    fontSize: labelFontSize,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '0.5rem',
                  }}
                >
                  Subcategoría
                </label>
                <select
                  id="subcategoryId"
                  name="subcategoryId"
                  value={selectedSubcategoryId}
                  onChange={handleSubcategoryChange}
                  required
                  style={{
                    width: '100%',
                    padding: inputPadding,
                    fontSize: inputFontSize,
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    background: 'white',
                    cursor: 'pointer',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                >
                  <option value="">Seleccionar subcategoría</option>
                  {allSubcategories.map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.categoryName} - {subcategory.name}
                    </option>
                  ))}
                </select>
                {allSubcategories.length === 0 && (
                  <p style={{ 
                    fontSize: inputFontSize,
                    color: '#f59e0b',
                    marginTop: '0.5rem',
                    margin: 0
                  }}>
                    No hay subcategorías activas disponibles. Debes crear subcategorías primero.
                  </p>
                )}
              </div>

              {/* Observación */}
              {selectedSubcategoryId && (
                <>
                  <div>
                    <label
                      htmlFor="note"
                      style={{
                        display: 'block',
                        fontSize: labelFontSize,
                        fontWeight: 600,
                        color: '#374151',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Observación (Modificador)
                    </label>
                    <input
                      type="text"
                      id="note"
                      name="note"
                      value={formData.note}
                      onChange={handleInputChange}
                      placeholder="Ej: Sin ensalada, Helado, Caliente, etc."
                      required
                      maxLength={100}
                      style={{
                        width: '100%',
                        padding: inputPadding,
                        fontSize: inputFontSize,
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#667eea'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>

                  {/* Estado activo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      id="isActive"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleInputChange}
                      style={{
                        width: '1rem',
                        height: '1rem',
                        cursor: 'pointer',
                      }}
                    />
                    <label
                      htmlFor="isActive"
                      style={{
                        fontSize: labelFontSize,
                        color: '#374151',
                        cursor: 'pointer',
                      }}
                    >
                      Activo
                    </label>
                  </div>

                  {/* Botón de envío */}
                  <button
                    type="submit"
                    disabled={creating || !formData.note.trim()}
                    style={{
                      padding: buttonPadding,
                      fontSize: buttonFontSize,
                      fontWeight: 600,
                      color: 'white',
                      background: creating || !formData.note.trim() 
                        ? '#9ca3af' 
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: creating || !formData.note.trim() ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: creating || !formData.note.trim() 
                        ? 'none' 
                        : '0 4px 6px -1px rgba(102, 126, 234, 0.3)',
                    }}
                    onMouseEnter={(e) => {
                      if (!creating && formData.note.trim()) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 12px -1px rgba(102, 126, 234, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!creating && formData.note.trim()) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(102, 126, 234, 0.3)';
                      }
                    }}
                  >
                    {creating ? 'Creando...' : 'Crear Observación'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        {/* Lista de observaciones existentes */}
        {selectedSubcategoryId && selectedSubcategory && (
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: cardPadding,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 style={{
              fontSize: isSmallDesktop ? '1.125rem' : '1.25rem',
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: '1rem',
            }}>
              Observaciones de "{selectedSubcategory.name}"
            </h2>
            
            {existingModifiers.length === 0 ? (
              <p style={{
                fontSize: inputFontSize,
                color: '#64748b',
                textAlign: 'center',
                padding: '2rem',
                margin: 0,
              }}>
                No hay observaciones creadas para esta subcategoría.
              </p>
            ) : (
              <div style={{
                overflowX: 'auto',
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: tableFontSize,
                }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{
                        padding: tableCellPadding,
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#374151',
                        borderBottom: '1px solid #e5e7eb',
                      }}>
                        Observación
                      </th>
                      <th style={{
                        padding: tableCellPadding,
                        textAlign: 'center',
                        fontWeight: 600,
                        color: '#374151',
                        borderBottom: '1px solid #e5e7eb',
                      }}>
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingModifiers.map((modifier) => (
                      <tr
                        key={modifier.id}
                        style={{
                          borderBottom: '1px solid #f3f4f6',
                        }}
                      >
                        <td style={{
                          padding: tableCellPadding,
                          color: '#1e293b',
                        }}>
                          {modifier.note}
                        </td>
                        <td style={{
                          padding: tableCellPadding,
                          textAlign: 'center',
                        }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '0.25rem 0.625rem',
                              borderRadius: '6px',
                              background: modifier.isActive ? '#dcfce7' : '#fee2e2',
                              color: modifier.isActive ? '#166534' : '#991b1b',
                            }}
                          >
                            {modifier.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Observation;
