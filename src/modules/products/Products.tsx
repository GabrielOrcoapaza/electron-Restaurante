import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import CreateProduct from './createProduct';
import EditProduct from './editProduct';
import ListProduct from './listProduct';

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  salePrice: number;
  imageBase64?: string;
  preparationTime?: number;
  isActive: boolean;
}

const Products: React.FC = () => {
  const { companyData } = useAuth();
  const branchId = companyData?.branch?.id;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleCloseEditModal = () => {
    setSelectedProduct(null);
  };

  const handleProductCreated = () => {
    setShowCreateModal(false);
    setRefreshKey(prev => prev + 1);
  };

  const handleProductUpdated = () => {
    setSelectedProduct(null);
    setRefreshKey(prev => prev + 1);
  };

  if (!branchId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        No se encontró información de la sucursal. Por favor, inicia sesión nuevamente.
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
              🍽️ Gestión de Productos
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
              Administra los productos de tu menú
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            + Nuevo Producto
          </button>
        </div>

        {/* Lista de productos */}
        <ListProduct onEdit={handleEdit} refreshKey={refreshKey} />
      </div>

      {/* Modal de creación */}
      {showCreateModal && (
        <CreateProduct
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleProductCreated}
        />
      )}

      {/* Modal de edición */}
      {selectedProduct && (
        <EditProduct
          product={selectedProduct}
          onClose={handleCloseEditModal}
          onSuccess={handleProductUpdated}
        />
      )}
    </div>
  );
};

export default Products;

