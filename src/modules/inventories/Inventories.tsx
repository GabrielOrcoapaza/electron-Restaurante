import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_PRODUCTS_WITH_STOCK, GET_CATEGORIES_BY_BRANCH } from '../../graphql/queries';
import { useAuth } from '../../hooks/useAuth';

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
  const branchId = companyData?.branch?.id;
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

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
          marginBottom: '2rem'
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '1.5rem', 
              fontWeight: 700, 
              color: '#1e293b' 
            }}>
              📦 Gestión de Inventario
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
              Controla el stock de tus productos
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem'
        }}>
          <div>
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
              fontSize: '0.875rem', 
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
                padding: '0.625rem 0.875rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.875rem',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Lista de productos con inventario */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>
            📋 Inventario de Productos ({filteredProducts.length})
          </h3>
          
          {filteredProducts.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem', 
              color: '#64748b' 
            }}>
              <p style={{ fontSize: '1rem', margin: 0 }}>No hay productos en el inventario</p>
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
                    <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Stock Actual</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Stock Mín.</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Stock Máx.</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Unidad</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const stockStatus = getStockStatus(product);
                    return (
                      <tr key={product.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem' }}>
                          {product.imageBase64 ? (
                            <img
                              src={`data:image/jpeg;base64,${product.imageBase64}`}
                              alt={product.name}
                              style={{
                                width: '50px',
                                height: '50px',
                                objectFit: 'cover',
                                borderRadius: '8px'
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
                              fontSize: '1.5rem'
                            }}>
                              🖼️
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#334155', fontFamily: 'monospace' }}>
                          {product.code}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#334155', fontWeight: 500 }}>
                          {product.name}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#334155', fontWeight: 600 }}>
                          {formatNumber(product.currentStock)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                          {formatNumber(product.stockMin)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                          {formatNumber(product.stockMax)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                          {product.unitMeasure}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
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

