import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_PRODUCTS_BY_BRANCH, GET_CATEGORIES_BY_BRANCH, GET_PRODUCTS } from '../../graphql/queries';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import RecipeModal from './recipe';

interface ProductSubcategoryNested {
  id: string;
  name: string;
  category?: { id: string; name: string } | null;
}

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  salePrice: number;
  imageBase64?: string;
  preparationTime?: number;
  productType?: string;
  purchasePrice?: number;
  unitMeasure?: string;
  currentStock?: number;
  stockMin?: number;
  stockMax?: number;
  isActive: boolean;
  subcategoryId?: string | null;
  subcategory?: ProductSubcategoryNested | null;
}

interface Subcategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order: number;
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
  subcategories?: Subcategory[];
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
  const { breakpoint } = useResponsive();
  const branchId = companyData?.branch?.id;

  // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
  const isXs = breakpoint === 'xs'; // < 640px
  const isSmall = breakpoint === 'sm'; // 640px - 767px
  const isMedium = breakpoint === 'md'; // 768px - 1023px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  const isMediumDesktop = breakpoint === 'xl'; // 1280px - 1535px

  // Tamaños adaptativos
  const cardPadding = isXs ? '0.75rem' : isSmall ? '1rem' : isMedium ? '1.25rem' : '1.5rem';
  const gapSize = isXs ? '0.5rem' : isSmall ? '0.75rem' : isMedium ? '0.875rem' : '1rem';
  const titleFontSize = isXs ? '0.875rem' : isSmall ? '0.9375rem' : isMedium ? '1rem' : '1.1rem';
  const labelFontSize = isXs ? '0.7rem' : isSmall ? '0.75rem' : isMedium ? '0.8125rem' : '0.875rem';
  const inputFontSize = isXs ? '0.75rem' : isSmall ? '0.75rem' : isMedium ? '0.8125rem' : '0.875rem';
  const inputPadding = isXs ? '0.45rem 0.625rem' : isSmall ? '0.5rem 0.625rem' : isMedium ? '0.5625rem 0.75rem' : '0.625rem 0.875rem';
  const tableFontSize = isXs ? '0.7rem' : isSmall ? '0.75rem' : isMedium ? '0.8125rem' : '0.875rem';
  const buttonPadding = isXs ? '0.4rem 0.625rem' : isSmall ? '0.4375rem 0.75rem' : isMedium ? '0.5rem 0.875rem' : '0.5rem 1rem';
  const buttonFontSize = isXs ? '0.65rem' : isSmall ? '0.6875rem' : isMedium ? '0.75rem' : '0.75rem';
  const badgeFontSize = isXs ? '0.6rem' : isSmall ? '0.625rem' : isMedium ? '0.6875rem' : '0.75rem';

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProductType, setSelectedProductType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProductForRecipe, setSelectedProductForRecipe] = useState<{ id: string; name: string; productType?: string } | null>(null);
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
      skip: !branchId,
      fetchPolicy: 'network-only'
    }
  );

  const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only'
  });

  const categories: Category[] = categoriesData?.categoriesByBranch || [];

  const getProductCategoryName = (p: Product) => p.subcategory?.category?.name ?? '—';
  const getProductSubcategoryName = (p: Product) => p.subcategory?.name ?? '—';

  // Obtener productos según la query usada (sin búsqueda al servidor - filtrado local como order.tsx)
  let products: Product[] = [];
  if (hasFilters) {
    products = filteredProductsData?.products || [];
  } else {
    products = productsData?.productsByBranch || [];
  }

  // Filtrado local por término de búsqueda (sin llamadas al servidor, sin "Cargando productos...")
  if (searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase().trim();
    products = products.filter((p: Product) => {
      const catName = getProductCategoryName(p);
      const subName = getProductSubcategoryName(p);
      return (
        p.name?.toLowerCase().includes(searchLower) ||
        p.code?.toLowerCase().includes(searchLower) ||
        (p.description && p.description.toLowerCase().includes(searchLower)) ||
        (catName !== '—' && catName.toLowerCase().includes(searchLower)) ||
        (subName !== '—' && subName.toLowerCase().includes(searchLower))
      );
    });
  }

  const loading = hasFilters ? filteredProductsLoading : productsLoading;
  const error = hasFilters ? filteredProductsError : productsError;

  // Calcular paginación
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = products.slice(startIndex, endIndex);

  // Resetear página cuando cambie la categoría, el tipo de producto o el término de búsqueda
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedProductType, searchTerm]);

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
        gap: gapSize,
        marginBottom: isSmall ? '1rem' : isMedium ? '1.25rem' : '1.5rem',
        flexWrap: 'wrap'
      }}>
        {/* Búsqueda */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: cardPadding,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          flex: '1',
          minWidth: isXs || isSmall ? '100%' : isMedium ? '250px' : '350px'
        }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: 500,
            fontSize: labelFontSize,
            color: '#475569'
          }}>
            Buscar producto:
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: 10, opacity: 0.6 }}>🔎</span>
            <input
              type="text"
              placeholder="Buscar producto o escanear código"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem 0.65rem 2.2rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: inputFontSize,
                boxSizing: 'border-box',
                backgroundColor: 'white'
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 10,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: 0.5,
                  fontSize: '1rem'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filtro de categorías */}
        {categories.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: cardPadding,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e2e8f0',
            flex: '1',
            minWidth: isXs || isSmall ? '100%' : isMedium ? '200px' : '250px'
          }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 500,
              fontSize: labelFontSize,
              color: '#475569'
            }}>
              Filtrar por categoría:
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
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
          padding: cardPadding,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          flex: '1',
          minWidth: isXs || isSmall ? '100%' : isMedium ? '200px' : '250px'
        }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: 500,
            fontSize: labelFontSize,
            color: '#475569'
          }}>
            Filtrar por tipo:
          </label>
          <select
            value={selectedProductType}
            onChange={(e) => setSelectedProductType(e.target.value)}
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
            <option value="">Todos los tipos</option>
            <option value="DISH">Plato</option>
            <option value="INGREDIENT">Ingrediente</option>
            <option value="BEVERAGE">Bebida</option>
          </select>
        </div>
      </div>

      {/* Lista de productos */}
      <div style={{
        width: '100%',
        maxWidth: '100%',
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: cardPadding,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e2e8f0',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: titleFontSize, fontWeight: 600, color: '#334155' }}>
            📋 Lista de Productos ({products.length})
          </h3>
          {products.length > 0 && (
            <p style={{ margin: 0, fontSize: inputFontSize, color: '#64748b' }}>
              Página {currentPage} de {totalPages}
            </p>
          )}
        </div>

        {products.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: isXs ? '1.5rem' : isSmall ? '2rem' : '3rem',
            color: '#64748b'
          }}>
            <p style={{ fontSize: isXs ? '0.8rem' : isSmall ? '0.875rem' : '1rem', margin: 0 }}>No hay productos registrados</p>
            <p style={{ fontSize: labelFontSize, margin: '0.5rem 0 0' }}>
              Haz clic en "Nuevo Producto" para agregar uno
            </p>
          </div>
        ) : isXs ? (
          /* Vista de tarjetas para móviles */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {paginatedProducts.map((product) => (
              <div 
                key={product.id}
                style={{
                  padding: '1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  backgroundColor: '#f8fafc'
                }}
              >
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                  {product.imageBase64 ? (
                    <img
                      src={`data:image/jpeg;base64,${product.imageBase64}`}
                      alt={product.name}
                      style={{
                        width: '60px',
                        height: '60px',
                        objectFit: 'cover',
                        borderRadius: '8px'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '60px',
                      height: '60px',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                      fontSize: '1.5rem'
                    }}>
                      🖼️
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                      {product.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                      {product.code} • {getProductCategoryName(product)}
                    </div>
                    <div style={{ fontWeight: 700, color: '#3b82f6', fontSize: '1rem' }}>
                      {currencyFormatter.format(product.salePrice)}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{
                    padding: '0.25rem 0.625rem',
                    borderRadius: '9999px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    backgroundColor: product.isActive ? '#dcfce7' : '#fee2e2',
                    color: product.isActive ? '#166534' : '#991b1b'
                  }}>
                    {product.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => onEdit(product)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => setSelectedProductForRecipe({ id: product.id, name: product.name, productType: product.productType })}
                      style={{
                        padding: '0.4rem 0.75rem',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}
                    >
                      🍳 Receta
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Vista de tabla para desktop/tablet */
          <div style={{
            overflow: 'auto',
            width: '100%',
            maxWidth: '100%',
            maxHeight: 'min(55vh, 620px)',
            minHeight: '200px',
            boxSizing: 'border-box',
            WebkitOverflowScrolling: 'touch',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: tableFontSize,
              tableLayout: 'fixed',
              minWidth: 0
            }}>
              <colgroup>
                <col style={{ width: '6%' }} /><col style={{ width: '7%' }} /><col style={{ width: '12%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '14%' }} /><col style={{ width: '8%' }} /><col style={{ width: '6%' }} /><col style={{ width: '8%' }} /><col style={{ width: '19%' }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: isSmall ? '0.5rem' : '0.625rem', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize, position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#f8fafc', boxShadow: '0 1px 0 #e2e8f0' }}>Imagen</th>
                  <th style={{ padding: isSmall ? '0.5rem' : '0.625rem', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize, position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#f8fafc', boxShadow: '0 1px 0 #e2e8f0' }}>Código</th>
                  <th style={{ padding: isSmall ? '0.5rem' : '0.625rem', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize, position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#f8fafc', boxShadow: '0 1px 0 #e2e8f0' }}>Nombre</th>
                  <th style={{ padding: isSmall ? '0.5rem' : '0.625rem', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize, position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#f8fafc', boxShadow: '0 1px 0 #e2e8f0' }}>Categoría</th>
                  <th style={{ padding: isSmall ? '0.5rem' : '0.625rem', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize, position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#f8fafc', boxShadow: '0 1px 0 #e2e8f0' }}>Subcategoría</th>
                  <th style={{ padding: isSmall ? '0.5rem' : '0.625rem', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize, position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#f8fafc', boxShadow: '0 1px 0 #e2e8f0' }}>Descripción</th>
                  <th style={{ padding: isSmall ? '0.5rem' : '0.625rem', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize, position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#f8fafc', boxShadow: '0 1px 0 #e2e8f0' }}>Precio</th>
                  <th style={{ padding: isSmall ? '0.5rem' : '0.625rem', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize, position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#f8fafc', boxShadow: '0 1px 0 #e2e8f0' }}>Tiempo</th>
                  <th style={{ padding: isSmall ? '0.5rem' : '0.625rem', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize, position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#f8fafc', boxShadow: '0 1px 0 #e2e8f0' }}>Estado</th>
                  <th style={{ padding: isSmall ? '0.5rem' : '0.625rem', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize, position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#f8fafc', boxShadow: '0 1px 0 #e2e8f0' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product) => (
                  <tr key={product.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: isSmall ? '0.375rem' : '0.5rem', textAlign: 'center' }}>
                      {product.imageBase64 ? (
                        <img
                          src={`data:image/jpeg;base64,${product.imageBase64}`}
                          alt={product.name}
                          style={{
                            width: isSmall ? '35px' : isMedium ? '40px' : '45px',
                            height: isSmall ? '35px' : isMedium ? '40px' : '45px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            margin: '0 auto',
                            display: 'block'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: isSmall ? '35px' : isMedium ? '40px' : '45px',
                          height: isSmall ? '35px' : isMedium ? '40px' : '45px',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#94a3b8',
                          fontSize: isSmall ? '1.125rem' : isMedium ? '1.25rem' : '1.375rem',
                          margin: '0 auto'
                        }}>
                          🖼️
                        </div>
                      )}
                    </td>
                    <td style={{
                      padding: isSmall ? '0.375rem' : '0.5rem',
                      textAlign: 'center',
                      color: '#334155',
                      fontFamily: 'monospace',
                      fontSize: tableFontSize,
                      whiteSpace: 'nowrap'
                    }}>
                      {product.code}
                    </td>
                    <td style={{ padding: isSmall ? '0.375rem' : '0.5rem', verticalAlign: 'top' }}>
                      <div style={{
                        fontSize: tableFontSize,
                        color: '#334155',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 5,
                        WebkitBoxOrient: 'vertical' as 'vertical',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                        lineHeight: 1.4
                      }}>
                        {product.name}
                      </div>
                    </td>
                    <td style={{ padding: isSmall ? '0.375rem' : '0.5rem', verticalAlign: 'top' }}>
                      <div style={{
                        fontSize: tableFontSize,
                        color: '#475569',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical' as 'vertical',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                        lineHeight: 1.35,
                        textAlign: 'center'
                      }}>
                        {getProductCategoryName(product)}
                      </div>
                    </td>
                    <td style={{ padding: isSmall ? '0.375rem' : '0.5rem', verticalAlign: 'top' }}>
                      <div style={{
                        fontSize: tableFontSize,
                        color: '#475569',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical' as 'vertical',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                        lineHeight: 1.35,
                        textAlign: 'center'
                      }}>
                        {getProductSubcategoryName(product)}
                      </div>
                    </td>
                    <td style={{ padding: isSmall ? '0.375rem' : '0.5rem', verticalAlign: 'top' }}>
                      <div style={{
                        color: '#64748b',
                        fontSize: tableFontSize,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 5,
                        WebkitBoxOrient: 'vertical' as 'vertical',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                        lineHeight: 1.4
                      }}>
                        {product.description || '-'}
                      </div>
                    </td>
                    <td style={{
                      padding: isSmall ? '0.375rem' : '0.5rem',
                      textAlign: 'center',
                      color: '#334155',
                      fontWeight: 600,
                      fontSize: tableFontSize,
                      whiteSpace: 'nowrap'
                    }}>
                      {currencyFormatter.format(product.salePrice)}
                    </td>
                    <td style={{
                      padding: isSmall ? '0.375rem' : '0.5rem',
                      textAlign: 'center',
                      color: '#64748b',
                      fontSize: tableFontSize,
                      whiteSpace: 'nowrap'
                    }}>
                      {product.preparationTime || '-'}
                    </td>
                    <td style={{ padding: isSmall ? '0.375rem' : '0.5rem', textAlign: 'center' }}>
                      <span style={{
                        padding: isSmall ? '0.25rem 0.5rem' : isMedium ? '0.25rem 0.625rem' : isSmallDesktop ? '0.25rem 0.625rem' : '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: badgeFontSize,
                        fontWeight: 600,
                        backgroundColor: product.isActive ? '#dcfce7' : '#fee2e2',
                        color: product.isActive ? '#166534' : '#991b1b'
                      }}>
                        {product.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: isSmall ? '0.375rem' : '0.5rem', textAlign: 'center' }}>
                      <div style={{
                        display: 'flex',
                        gap: isSmall ? '0.25rem' : '0.375rem',
                        justifyContent: 'center',
                        flexWrap: 'nowrap',
                        alignItems: 'center'
                      }}>
                        <button
                          onClick={() => onEdit(product)}
                          title="Editar producto"
                          style={{
                            padding: isSmall ? '0.375rem 0.5rem' : isMedium ? '0.4375rem 0.625rem' : '0.5rem 0.75rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: isSmall ? '0.75rem' : isMedium ? '0.8125rem' : '0.875rem',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => setSelectedProductForRecipe({ id: product.id, name: product.name, productType: product.productType })}
                          title="Ver receta"
                          style={{
                            padding: isSmall ? '0.375rem 0.5rem' : isMedium ? '0.4375rem 0.625rem' : '0.5rem 0.75rem',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: isSmall ? '0.75rem' : isMedium ? '0.8125rem' : '0.875rem',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
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

        {/* Controles de paginación (visible con cualquier cantidad de productos) */}
        {products.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: isXs ? '0.35rem' : isSmall ? '0.5rem' : '0.75rem',
            marginTop: isXs ? '0.75rem' : '1.5rem',
            paddingTop: isXs ? '0.75rem' : '1.5rem',
            borderTop: '1px solid #e2e8f0',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: buttonPadding,
                backgroundColor: currentPage === 1 ? '#e2e8f0' : '#667eea',
                color: currentPage === 1 ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: buttonFontSize,
                transition: 'all 0.2s',
                minHeight: isXs ? '36px' : 'auto'
              }}
            >
              {isXs ? '←' : '← Anterior'}
            </button>

            {/* Números de página */}
            <div style={{
              display: 'flex',
              gap: isXs ? '0.15rem' : '0.25rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Mostrar solo algunas páginas alrededor de la actual
                const showPage =
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - (isXs ? 1 : 2) && page <= currentPage + (isXs ? 1 : 2));

                if (!showPage) {
                  if (page === currentPage - (isXs ? 2 : 3) || page === currentPage + (isXs ? 2 : 3)) {
                    return (
                      <span key={page} style={{ padding: '0 0.25rem', color: '#94a3b8', fontSize: buttonFontSize }}>
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
                      minWidth: isXs ? '1.85rem' : '2.25rem',
                      height: isXs ? '1.85rem' : '2.25rem',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: page === currentPage ? '#667eea' : 'white',
                      color: page === currentPage ? 'white' : '#374151',
                      border: `1px solid ${page === currentPage ? '#667eea' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      fontWeight: page === currentPage ? 700 : 500,
                      cursor: 'pointer',
                      fontSize: buttonFontSize,
                      transition: 'all 0.2s'
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
                padding: buttonPadding,
                backgroundColor: currentPage === totalPages ? '#e2e8f0' : '#667eea',
                color: currentPage === totalPages ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: buttonFontSize,
                transition: 'all 0.2s',
                minHeight: isXs ? '36px' : 'auto'
              }}
            >
              {isXs ? '→' : 'Siguiente →'}
            </button>
          </div>
        )}
      </div>

      {/* Modal de receta */}
      {selectedProductForRecipe && (
        <RecipeModal
          productId={selectedProductForRecipe.id}
          productName={selectedProductForRecipe.name}
          productType={selectedProductForRecipe.productType}
          onClose={() => setSelectedProductForRecipe(null)}
        />
      )}
    </div>
  );
};

export default ListProduct;

