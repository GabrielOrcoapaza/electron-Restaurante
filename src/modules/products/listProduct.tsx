import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_PRODUCTS_BY_BRANCH, GET_CATEGORIES_BY_BRANCH, GET_PRODUCTS } from '../../graphql/queries';
import { useAuth } from '../../hooks/useAuth';
import RecipeModal from './recipe';

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  salePrice: number;
  imageBase64?: string;
  preparationTime?: number;
  productType?: string;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order: number;
  isActive: boolean;
}

interface ListProductProps {
  onEdit: (product: Product) => void;
  refreshKey?: number;
}

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

const ListProduct: React.FC<ListProductProps> = ({ onEdit, refreshKey = 0 }) => {
  const { companyData } = useAuth();
  const branchId = companyData?.branch?.id;
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProductType, setSelectedProductType] = useState<string>('');
  const [selectedProductForRecipe, setSelectedProductForRecipe] = useState<{ id: string; name: string } | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 20;

  // Determinar si hay algún filtro activo
  const hasFilters = Boolean(selectedProductType || selectedCategory);

  // Query optimizada con filtros (productType y/o categoryId)
  // Esta query se usa cuando hay al menos un filtro activo
  const { data: filteredProductsData, loading: filteredProductsLoading, error: filteredProductsError, refetch: refetchFilteredProducts } = useQuery(
    GET_PRODUCTS,
    {
      variables: { 
        branchId: branchId!,
        ...(selectedProductType && { productType: selectedProductType }),
        ...(selectedCategory && { categoryId: selectedCategory })
      },
      skip: !branchId || !hasFilters,
      fetchPolicy: 'network-only'
    }
  );

  // Query para obtener todos los productos (cuando no hay filtros)
  const { data: productsData, loading: productsLoading, error: productsError, refetch: refetchProducts } = useQuery(
    GET_PRODUCTS_BY_BRANCH,
    {
      variables: { branchId: branchId! },
      skip: !branchId || hasFilters,
      fetchPolicy: 'network-only'
    }
  );

  const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId
  });

  // Obtener productos según la query usada
  const filteredProducts: Product[] = hasFilters 
    ? (filteredProductsData?.products || [])
    : (productsData?.productsByBranch || []);
  
  const categories: Category[] = categoriesData?.categoriesByBranch || [];
  const loading = hasFilters ? filteredProductsLoading : productsLoading;
  const error = hasFilters ? filteredProductsError : productsError;

  // Calcular paginación
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Resetear página cuando cambie la categoría o el tipo de producto
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedProductType]);

  // Refrescar cuando cambie el refreshKey
  React.useEffect(() => {
    if (hasFilters) {
      refetchFilteredProducts();
    } else {
      refetchProducts();
    }
  }, [refreshKey, hasFilters, refetchProducts, refetchFilteredProducts]);

  if (!branchId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        No se encontró información de la sucursal. Por favor, inicia sesión nuevamente.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Cargando productos...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        Error al cargar productos: {error.message}
      </div>
    );
  }

  return (
    <div>
      {/* Filtros */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap'
      }}>
        {/* Filtro de categorías */}
        {categories.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '1rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e2e8f0',
            flex: '1',
            minWidth: '250px'
          }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontWeight: 500, 
              fontSize: '0.875rem', 
              color: '#475569' 
            }}>
              Filtrar por categoría:
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
                backgroundColor: 'white'
              }}
            >
              <option value="">Todas las categorías</option>
              {categories
                .filter(cat => cat.isActive)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Filtro de tipo de producto */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '1rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          flex: '1',
          minWidth: '250px'
        }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: 500, 
            fontSize: '0.875rem', 
            color: '#475569' 
          }}>
            Filtrar por tipo:
          </label>
          <select
            value={selectedProductType}
            onChange={(e) => setSelectedProductType(e.target.value)}
            style={{
              width: '100%',
              padding: '0.625rem 0.875rem',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.875rem',
              boxSizing: 'border-box',
              backgroundColor: 'white'
            }}
          >
            <option value="">Todos los tipos</option>
            <option value="DISH">Plato</option>
            <option value="INGREDIENT">Ingrediente</option>
            <option value="BEVERAGE">Bebida</option>
          </select>
        </div>
      </div>

      {/* Lista de productos */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>
            📋 Lista de Productos ({filteredProducts.length})
          </h3>
          {filteredProducts.length > itemsPerPage && (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
              Página {currentPage} de {totalPages}
            </p>
          )}
        </div>
        
        {filteredProducts.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem', 
            color: '#64748b' 
          }}>
            <p style={{ fontSize: '1rem', margin: 0 }}>No hay productos registrados</p>
            <p style={{ fontSize: '0.875rem', margin: '0.5rem 0 0' }}>
              Haz clic en "Nuevo Producto" para agregar uno
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '0.875rem'
            }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Imagen</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Código</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Nombre</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Descripción</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Precio</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Tiempo (min)</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Estado</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product) => (
                  <tr key={product.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {product.imageBase64 ? (
                        <img
                          src={`data:image/jpeg;base64,${product.imageBase64}`}
                          alt={product.name}
                          style={{
                            width: '50px',
                            height: '50px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            margin: '0 auto',
                            display: 'block'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '50px',
                          height: '50px',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#94a3b8',
                          fontSize: '1.5rem',
                          margin: '0 auto'
                        }}>
                          🖼️
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#334155', fontFamily: 'monospace' }}>
                      {product.code}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#334155', fontWeight: 500 }}>
                      {product.name}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', maxWidth: '300px' }}>
                      {product.description || '-'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#334155', fontWeight: 600 }}>
                      {currencyFormatter.format(product.salePrice)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                      {product.preparationTime || '-'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: product.isActive ? '#dcfce7' : '#fee2e2',
                        color: product.isActive ? '#166534' : '#991b1b'
                      }}>
                        {product.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => onEdit(product)}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => setSelectedProductForRecipe({ id: product.id, name: product.name })}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                        >
                          🍳 Receta
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Controles de paginación */}
        {filteredProducts.length > itemsPerPage && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #e2e8f0'
          }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: currentPage === 1 ? '#e2e8f0' : '#667eea',
                color: currentPage === 1 ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 500,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (currentPage !== 1) e.currentTarget.style.backgroundColor = '#5568d3';
              }}
              onMouseLeave={(e) => {
                if (currentPage !== 1) e.currentTarget.style.backgroundColor = '#667eea';
              }}
            >
              ← Anterior
            </button>

            {/* Números de página */}
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Mostrar solo algunas páginas alrededor de la actual
                const showPage = 
                  page === 1 || 
                  page === totalPages || 
                  (page >= currentPage - 2 && page <= currentPage + 2);
                
                if (!showPage) {
                  // Mostrar puntos suspensivos
                  if (page === currentPage - 3 || page === currentPage + 3) {
                    return (
                      <span key={page} style={{ padding: '0 0.5rem', color: '#94a3b8' }}>
                        ...
                      </span>
                    );
                  }
                  return null;
                }

                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      minWidth: '2.5rem',
                      padding: '0.5rem',
                      backgroundColor: page === currentPage ? '#667eea' : 'white',
                      color: page === currentPage ? 'white' : '#374151',
                      border: `1px solid ${page === currentPage ? '#667eea' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      fontWeight: page === currentPage ? 600 : 500,
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (page !== currentPage) {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (page !== currentPage) {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }
                    }}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: currentPage === totalPages ? '#e2e8f0' : '#667eea',
                color: currentPage === totalPages ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 500,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (currentPage !== totalPages) e.currentTarget.style.backgroundColor = '#5568d3';
              }}
              onMouseLeave={(e) => {
                if (currentPage !== totalPages) e.currentTarget.style.backgroundColor = '#667eea';
              }}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Modal de receta */}
      {selectedProductForRecipe && (
        <RecipeModal
          productId={selectedProductForRecipe.id}
          productName={selectedProductForRecipe.name}
          onClose={() => setSelectedProductForRecipe(null)}
        />
      )}
    </div>
  );
};

export default ListProduct;

