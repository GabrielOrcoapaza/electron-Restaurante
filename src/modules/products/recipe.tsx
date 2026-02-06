import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_RECIPES_BY_PRODUCT, GET_PRODUCTS_WITH_STOCK } from '../../graphql/queries';
import { ADD_RECIPE, REMOVE_RECIPE } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';

interface Recipe {
  id: string;
  quantity: number;
  unitMeasure?: string;
  notes?: string;
  product: {
    id: string;
    name: string;
    code: string;
  };
  ingredient: {
    id: string;
    name: string;
    code: string;
    unitMeasure?: string;
  };
}

interface Ingredient {
  id: string;
  name: string;
  code: string;
  unitMeasure?: string;
}

interface RecipeModalProps {
  productId: string;
  productName: string;
  onClose: () => void;
}

// Unidades de medida válidas en el backend (ProductsRecipeUnitMeasureChoices)
const UNIT_MEASURES: Array<[string, string]> = [
  ['NIU', 'Unidad'],
  ['KGM', 'Kilogramo'],
  ['LTR', 'Litro'],
];

const RecipeModal: React.FC<RecipeModalProps> = ({ productId, productName, onClose }) => {
  const { companyData } = useAuth();
  const { breakpoint } = useResponsive();
  const branchId = companyData?.branch?.id;

  // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
  const isSmall = breakpoint === 'sm'; // 640px - 767px
  const isMedium = breakpoint === 'md'; // 768px - 1023px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  const isMediumDesktop = breakpoint === 'xl'; // 1280px - 1535px
  
  // Tamaños adaptativos
  const modalPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.5rem' : isMediumDesktop ? '1.75rem' : '2rem';
  const modalMaxWidth = isSmall ? '95%' : isMedium ? '500px' : isSmallDesktop ? '550px' : isMediumDesktop ? '600px' : '600px';
  const labelFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const inputFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const inputPadding = isSmall ? '0.5rem 0.625rem' : isMedium ? '0.5625rem 0.75rem' : isSmallDesktop ? '0.5625rem 0.75rem' : isMediumDesktop ? '0.625rem 0.875rem' : '0.625rem 0.875rem';
  const buttonPadding = isSmall ? '0.5625rem 1rem' : isMedium ? '0.625rem 1.25rem' : isSmallDesktop ? '0.625rem 1.25rem' : isMediumDesktop ? '0.75rem 1.5rem' : '0.75rem 1.5rem';
  const buttonFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const tableFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const tableCellPadding = isSmall ? '0.5rem' : isMedium ? '0.625rem' : isSmallDesktop ? '0.625rem' : isMediumDesktop ? '0.75rem' : '0.75rem';
  const gapSize = isSmall ? '0.75rem' : isMedium ? '0.875rem' : isSmallDesktop ? '0.875rem' : isMediumDesktop ? '1rem' : '1rem';
  const titleFontSize = isSmall ? '1.25rem' : isMedium ? '1.375rem' : isSmallDesktop ? '1.375rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    ingredientId: '',
    quantity: '',
    unitMeasure: 'NIU',
    notes: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, loading, error, refetch } = useQuery(GET_RECIPES_BY_PRODUCT, {
    variables: { productId },
    fetchPolicy: 'network-only'
  });

  // Obtener ingredientes disponibles
  const { data: productsData } = useQuery(GET_PRODUCTS_WITH_STOCK, {
    variables: { branchId: branchId! },
    skip: !branchId
  });

  const rawRecipes: Recipe[] = data?.recipesByProduct || [];
  // Filtrar recetas con ingredient null (p. ej. ingrediente eliminado) para evitar TypeError
  const recipes = rawRecipes.filter((r): r is Recipe => Boolean(r && r.ingredient));

  const allProducts: any[] = productsData?.productsByBranch || [];
  const availableIngredients: Ingredient[] = allProducts
    .filter(p => p.productType === 'INGREDIENT' && p.isActive)
    .map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      unitMeasure: p.unitMeasure
    }));

  // Filtrar ingredientes que ya están en la receta
  const ingredientIdsInRecipe = recipes.map(r => r.ingredient!.id);
  const filteredIngredients = availableIngredients.filter(
    ing => !ingredientIdsInRecipe.includes(ing.id)
  );

  const [addRecipe, { loading: addingRecipe }] = useMutation(ADD_RECIPE, {
    onCompleted: (data) => {
      if (data.addRecipe.success) {
        setMessage({ type: 'success', text: data.addRecipe.message });
        setFormData({ ingredientId: '', quantity: '', unitMeasure: 'NIU', notes: '' });
        setShowAddForm(false);
        refetch();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.addRecipe.message });
        setTimeout(() => setMessage(null), 3000);
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const [removeRecipe, { loading: removingRecipe }] = useMutation(REMOVE_RECIPE, {
    onCompleted: (data) => {
      if (data.removeRecipe.success) {
        setMessage({ type: 'success', text: data.removeRecipe.message });
        refetch();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.removeRecipe.message });
        setTimeout(() => setMessage(null), 3000);
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!formData.ingredientId || !formData.quantity) {
      setMessage({ type: 'error', text: 'Por favor completa todos los campos requeridos' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const quantity = parseFloat(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      setMessage({ type: 'error', text: 'La cantidad debe ser un número mayor a 0' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    addRecipe({
      variables: {
        productId,
        ingredientId: formData.ingredientId,
        quantity: quantity,
        unitMeasure: formData.unitMeasure,
        notes: formData.notes || null
      }
    });
  };

  const handleRemoveIngredient = (recipeId: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este ingrediente de la receta?')) {
      removeRecipe({
        variables: { recipeId }
      });
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: modalPadding,
          maxWidth: modalMaxWidth,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#64748b',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          ✕
        </button>

        <h2 style={{ 
          margin: '0 0 1.5rem', 
          fontSize: titleFontSize, 
          fontWeight: 700, 
          color: '#1e293b' 
        }}>
          🍳 Receta del Producto
        </h2>

        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
          <p style={{ margin: 0, fontSize: labelFontSize, color: '#64748b' }}>
            <strong style={{ color: '#334155' }}>Producto:</strong> {productName}
          </p>
        </div>

        {/* Mensajes */}
        {message && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2', 
            color: message.type === 'success' ? '#166534' : '#991b1b', 
            borderRadius: '8px',
            marginBottom: '1rem',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`
          }}>
            {message.text}
          </div>
        )}

        {/* Botón para agregar ingrediente */}
        {!showAddForm && filteredIngredients.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                padding: buttonPadding,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 500,
                cursor: 'pointer',
                fontSize: buttonFontSize,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              ➕ Agregar Ingrediente
            </button>
          </div>
        )}

        {/* Formulario para agregar ingrediente */}
        {showAddForm && (
          <div style={{ 
            marginBottom: '1.5rem', 
            padding: modalPadding, 
            backgroundColor: '#f8fafc', 
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : isSmallDesktop ? '0.9375rem' : '1rem', fontWeight: 600, color: '#334155' }}>
              Agregar Nuevo Ingrediente
            </h3>
            <form onSubmit={handleAddIngredient}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontSize: labelFontSize, 
                  fontWeight: 500, 
                  color: '#475569' 
                }}>
                  Ingrediente *
                </label>
                <select
                  value={formData.ingredientId}
                  onChange={(e) => setFormData({ ...formData, ingredientId: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: inputPadding,
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: inputFontSize,
                    boxSizing: 'border-box',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="">Selecciona un ingrediente</option>
                  {filteredIngredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name} ({ingredient.code})
                    </option>
                  ))}
                </select>
                {filteredIngredients.length === 0 && (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                    No hay ingredientes disponibles o todos ya están en la receta
                  </p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: gapSize, marginBottom: '1rem' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontSize: labelFontSize, 
                    fontWeight: 500, 
                    color: '#475569' 
                  }}>
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: inputPadding,
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: inputFontSize,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontSize: labelFontSize, 
                    fontWeight: 500, 
                    color: '#475569' 
                  }}>
                    Unidad *
                  </label>
                  <select
                    value={formData.unitMeasure}
                    onChange={(e) => setFormData({ ...formData, unitMeasure: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: inputPadding,
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: inputFontSize,
                      boxSizing: 'border-box',
                      backgroundColor: 'white'
                    }}
                  >
                    {UNIT_MEASURES.map(([value, label]) => (
                      <option key={value} value={value}>{value} ({label})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontSize: labelFontSize, 
                  fontWeight: 500, 
                  color: '#475569' 
                }}>
                  Notas (opcional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observaciones sobre este ingrediente..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: inputPadding,
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: inputFontSize,
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormData({ ingredientId: '', quantity: '', unitMeasure: 'NIU', notes: '' });
                    setMessage(null);
                  }}
                  style={{
                    padding: buttonPadding,
                    background: '#64748b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontSize: buttonFontSize,
                    transition: 'all 0.2s'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addingRecipe || filteredIngredients.length === 0}
                  style={{
                    padding: buttonPadding,
                    background: addingRecipe || filteredIngredients.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 500,
                    cursor: addingRecipe || filteredIngredients.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: buttonFontSize,
                    transition: 'all 0.2s'
                  }}
                >
                  {addingRecipe ? 'Agregando...' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            Cargando receta...
          </div>
        )}

        {error && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#fee2e2', 
            color: '#991b1b', 
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            Error al cargar la receta: {error.message}
          </div>
        )}

        {!loading && !error && recipes.length === 0 && !showAddForm && (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem', 
            color: '#64748b' 
          }}>
            <p style={{ fontSize: '1rem', margin: 0 }}>No hay ingredientes registrados para este producto</p>
            <p style={{ fontSize: '0.875rem', margin: '0.5rem 0 0' }}>
              {filteredIngredients.length > 0 
                ? 'Haz clic en "Agregar Ingrediente" para comenzar'
                : 'No hay ingredientes disponibles para agregar. Primero crea algunos ingredientes en la sección de productos.'
              }
            </p>
          </div>
        )}

        {!loading && !error && recipes.length > 0 && (
          <div>
            <div style={{ 
              backgroundColor: '#f8fafc', 
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ 
                overflowX: 'auto',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box'
              }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: tableFontSize,
                  tableLayout: 'auto'
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'left', 
                        color: '#64748b', 
                        fontWeight: 600,
                        fontSize: tableFontSize
                      }}>
                        Ingrediente
                      </th>
                      <th style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'right', 
                        color: '#64748b', 
                        fontWeight: 600,
                        fontSize: tableFontSize
                      }}>
                        Cantidad
                      </th>
                      <th style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'left', 
                        color: '#64748b', 
                        fontWeight: 600,
                        fontSize: tableFontSize
                      }}>
                        Notas
                      </th>
                      <th style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'center', 
                        color: '#64748b', 
                        fontWeight: 600,
                        fontSize: tableFontSize
                      }}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                <tbody>
                  {recipes.map((recipe, index) => (
                    <tr 
                      key={recipe.id} 
                      style={{ 
                        borderBottom: index < recipes.length - 1 ? '1px solid #f1f5f9' : 'none'
                      }}
                    >
                      <td style={{ 
                        padding: tableCellPadding, 
                        color: '#334155', 
                        fontWeight: 500,
                        fontSize: tableFontSize
                      }}>
                        {recipe.ingredient.name}
                        <span style={{ 
                          color: '#94a3b8', 
                          fontSize: isSmall ? '0.625rem' : isMedium ? '0.6875rem' : isSmallDesktop ? '0.6875rem' : '0.75rem',
                          marginLeft: '0.5rem',
                          fontFamily: 'monospace'
                        }}>
                          ({recipe.ingredient.code})
                        </span>
                      </td>
                      <td style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'right', 
                        color: '#334155',
                        fontWeight: 600,
                        fontSize: tableFontSize
                      }}>
                        {recipe.quantity} {recipe.unitMeasure || recipe.ingredient.unitMeasure || 'und'}
                      </td>
                      <td style={{ 
                        padding: tableCellPadding, 
                        color: '#64748b',
                        fontSize: isSmall ? '0.6875rem' : isMedium ? '0.75rem' : isSmallDesktop ? '0.75rem' : '0.8rem',
                        fontStyle: recipe.notes ? 'normal' : 'italic'
                      }}>
                        {recipe.notes || '-'}
                      </td>
                      <td style={{ 
                        padding: tableCellPadding, 
                        textAlign: 'center'
                      }}>
                        <button
                          onClick={() => handleRemoveIngredient(recipe.id)}
                          disabled={removingRecipe}
                          style={{
                            padding: buttonPadding,
                            background: removingRecipe ? '#94a3b8' : '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: 500,
                            cursor: removingRecipe ? 'not-allowed' : 'pointer',
                            fontSize: buttonFontSize,
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (!removingRecipe) {
                              e.currentTarget.style.background = '#dc2626';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!removingRecipe) {
                              e.currentTarget.style.background = '#ef4444';
                            }
                          }}
                        >
                          {removingRecipe ? 'Eliminando...' : '🗑️ Eliminar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem', 
              backgroundColor: '#f0fdf4', 
              borderRadius: '8px',
              border: '1px solid #bbf7d0'
            }}>
              <p style={{ 
                margin: 0, 
                fontSize: labelFontSize, 
                color: '#166534',
                textAlign: 'center',
                fontWeight: 500
              }}>
                Total de ingredientes: {recipes.length}
              </p>
            </div>
          </div>
        )}

        {/* Botón cerrar */}
        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: buttonPadding,
              background: '#64748b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: buttonFontSize,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#475569'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#64748b'}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeModal;
export { RecipeModal };

