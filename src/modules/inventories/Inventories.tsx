import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_PRODUCTS_WITH_STOCK, GET_CATEGORIES_BY_BRANCH } from '../../graphql/queries';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  salePrice: number;
  purchasePrice?: number;
  unitMeasure: string;
  currentStock?: number | null;
  stockMin?: number | null;
  stockMax?: number | null;
  imageBase64?: string;
  isActive: boolean;
  productType: string;
  subcategoryId?: string;
}

interface Subcategory {
  id: string;
  name: string;
  description?: string;
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

// Helper para formatear números de forma segura
const formatNumber = (value: number | null | undefined, decimals: number = 2): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00';
  }
  return Number(value).toFixed(decimals);
};

// Helper para obtener un número seguro (default 0 si es null/undefined)
const getSafeNumber = (value: number | null | undefined, defaultValue: number = 0): number => {
  if (value === null || value === undefined || isNaN(value)) {
    return defaultValue;
  }
  return Number(value);
};

const Inventories: React.FC = () => {
  const { companyData } = useAuth();
  const { breakpoint } = useResponsive();
  const branchId = companyData?.branch?.id;
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
  const isSmall = breakpoint === 'sm'; // 640px - 767px
  const isMedium = breakpoint === 'md'; // 768px - 1023px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  const isMediumDesktop = breakpoint === 'xl'; // 1280px - 1535px
  
  // Tamaños adaptativos
  const containerPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const containerGap = isSmall ? '1rem' : isMedium ? '1.5rem' : isSmallDesktop ? '1.5rem' : isMediumDesktop ? '2rem' : '2rem';
  const titleFontSize = isSmall ? '1.125rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.375rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const subtitleFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const labelFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const inputFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const inputPadding = isSmall ? '0.5rem 0.625rem' : isMedium ? '0.5625rem 0.75rem' : isSmallDesktop ? '0.5625rem 0.75rem' : isMediumDesktop ? '0.625rem 0.875rem' : '0.625rem 0.875rem';
  const tableFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const tableCellPadding = isSmall ? '0.5rem' : isMedium ? '0.625rem' : isSmallDesktop ? '0.625rem' : isMediumDesktop ? '0.75rem' : '0.75rem';
  const cardPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const badgeFontSize = isSmall ? '0.625rem' : isMedium ? '0.6875rem' : isSmallDesktop ? '0.6875rem' : isMediumDesktop ? '0.75rem' : '0.75rem';

  const { data: productsData, loading: productsLoading, error: productsError } = useQuery(
    GET_PRODUCTS_WITH_STOCK,
    {
      variables: { branchId: branchId! },
      skip: !branchId
    }
  );

  const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId
  });

  const allProducts: Product[] = productsData?.productsByBranch || [];
  const categories = categoriesData?.categoriesByBranch || [];

  // Filtrar productos
  let filteredProducts = allProducts;

  // Filtrar por categoría - buscar productos que pertenezcan a subcategorías de la categoría seleccionada
  if (selectedCategory) {
    const categorySubcategories = (categories as Category[])
      .find((cat: Category) => cat.id === selectedCategory)
      ?.subcategories?.map((sub: Subcategory) => sub.id) || [];
    
    filteredProducts = filteredProducts.filter((product) => 
      product.subcategoryId && categorySubcategories.includes(product.subcategoryId)
    );
  }

  // Filtrar por búsqueda
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    filteredProducts = filteredProducts.filter((product) =>
      product.name?.toLowerCase().includes(searchLower) ||
      product.code?.toLowerCase().includes(searchLower) ||
      product.description?.toLowerCase().includes(searchLower)
    );
  }

  // Determinar el estado del stock
  const getStockStatus = (product: Product) => {
    const currentStock = getSafeNumber(product.currentStock, 0);
    const stockMin = getSafeNumber(product.stockMin, 0);
    const stockMax = getSafeNumber(product.stockMax, 0);
    
    if (currentStock <= stockMin) {
      return { status: 'low', color: '#dc2626', bgColor: '#fee2e2', label: 'Stock Bajo' };
    } else if (stockMax > 0 && currentStock >= stockMax) {
      return { status: 'high', color: '#059669', bgColor: '#d1fae5', label: 'Stock Alto' };
    } else {
      return { status: 'normal', color: '#2563eb', bgColor: '#dbeafe', label: 'Stock Normal' };
    }
  };

  if (!branchId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        No se encontró información de la sucursal. Por favor, inicia sesión nuevamente.
      </div>
    );
  }

  if (productsLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Cargando inventario...
      </div>
    );
  }

  if (productsError) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        Error al cargar inventario: {productsError.message}
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100%',
        width: '100%',
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: containerGap,
        background: 'linear-gradient(160deg, #f0f4ff 0%, #f9fafb 45%, #ffffff 100%)',
        padding: containerPadding,
        borderRadius: '18px',
        boxShadow: '0 25px 50px -12px rgba(15,23,42,0.18)',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
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
          alignItems: isSmall ? 'flex-start' : 'center',
          flexDirection: isSmall ? 'column' : 'row',
          marginBottom: isSmall ? '1rem' : isMedium ? '1.5rem' : isSmallDesktop ? '1.5rem' : '2rem',
          flexWrap: isSmall || isMedium ? 'wrap' : 'nowrap',
          gap: isSmall || isMedium ? '1rem' : '0'
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: titleFontSize, 
              fontWeight: 700, 
              color: '#1e293b' 
            }}>
              📦 Gestión de Inventario
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: subtitleFontSize }}>
              Controla el stock de tus productos
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: cardPadding,
          marginBottom: isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : '1.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          display: 'grid',
          gridTemplateColumns: isSmall ? '1fr' : '1fr 1fr',
          gap: isSmall ? '0.75rem' : isMedium ? '0.875rem' : isSmallDesktop ? '0.875rem' : '1rem'
        }}>
          <div>
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
              {(categories as Category[])
                .filter((cat: Category) => cat.isActive)
                .map((category: Category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontWeight: 500, 
              fontSize: labelFontSize, 
              color: '#475569' 
            }}>
              Buscar producto:
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, código o descripción..."
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
        </div>

        {/* Lista de productos con inventario */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: cardPadding,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ 
            margin: '0 0 1rem', 
            fontSize: isSmall ? '1rem' : isMedium ? '1.05rem' : isSmallDesktop ? '1.05rem' : '1.1rem', 
            fontWeight: 600, 
            color: '#334155' 
          }}>
            📋 Inventario de Productos ({filteredProducts.length})
          </h3>
          
          {filteredProducts.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: isSmall ? '2rem' : isMedium ? '2.5rem' : '3rem', 
              color: '#64748b' 
            }}>
              <p style={{ fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : '1rem', margin: 0 }}>No hay productos en el inventario</p>
            </div>
          ) : (
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
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>Imagen</th>
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>Código</th>
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>Nombre</th>
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>Stock Actual</th>
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>Stock Mín.</th>
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>Stock Máx.</th>
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>Unidad</th>
                    <th style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: tableFontSize }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const stockStatus = getStockStatus(product);
                    return (
                      <tr key={product.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: tableCellPadding, textAlign: 'center' }}>
                          {product.imageBase64 ? (
                            <img
                              src={`data:image/jpeg;base64,${product.imageBase64}`}
                              alt={product.name}
                              style={{
                                width: isSmall ? '40px' : isMedium ? '45px' : '50px',
                                height: isSmall ? '40px' : isMedium ? '45px' : '50px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                margin: '0 auto',
                                display: 'block'
                              }}
                            />
                          ) : (
                            <div style={{
                              width: isSmall ? '40px' : isMedium ? '45px' : '50px',
                              height: isSmall ? '40px' : isMedium ? '45px' : '50px',
                              backgroundColor: '#f1f5f9',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#94a3b8',
                              fontSize: isSmall ? '1.25rem' : isMedium ? '1.375rem' : '1.5rem',
                              margin: '0 auto'
                            }}>
                              🖼️
                            </div>
                          )}
                        </td>
                        <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#334155', fontFamily: 'monospace', fontSize: tableFontSize }}>
                          {product.code}
                        </td>
                        <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#334155', fontWeight: 500, fontSize: tableFontSize }}>
                          {product.name}
                        </td>
                        <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#334155', fontWeight: 600, fontSize: tableFontSize }}>
                          {formatNumber(product.currentStock)}
                        </td>
                        <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontSize: tableFontSize }}>
                          {formatNumber(product.stockMin)}
                        </td>
                        <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontSize: tableFontSize }}>
                          {formatNumber(product.stockMax)}
                        </td>
                        <td style={{ padding: tableCellPadding, textAlign: 'center', color: '#64748b', fontSize: tableFontSize }}>
                          {product.unitMeasure}
                        </td>
                        <td style={{ padding: tableCellPadding, textAlign: 'center' }}>
                          <span style={{
                            padding: isSmall ? '0.25rem 0.5rem' : isMedium ? '0.25rem 0.625rem' : '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: badgeFontSize,
                            fontWeight: 600,
                            backgroundColor: stockStatus.bgColor,
                            color: stockStatus.color
                          }}>
                            {stockStatus.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inventories;

