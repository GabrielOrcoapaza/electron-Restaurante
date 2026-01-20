import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { UPDATE_PRODUCT } from '../../graphql/mutations';
import { GET_CATEGORIES_BY_BRANCH } from '../../graphql/queries';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  salePrice: number;
  preparationTime?: number;
  productType?: string;
  purchasePrice?: number;
  unitMeasure?: string;
  stockMin?: number;
  stockMax?: number;
  currentStock?: number;
  isActive?: boolean;
}

interface EditProductProps {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
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

const EditProduct: React.FC<EditProductProps> = ({ product, onClose, onSuccess }) => {
  const { companyData } = useAuth();
  const { breakpoint } = useResponsive();
  const branchId = companyData?.branch?.id;

  // Adaptar según tamaño de pantalla de PC
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  
  // Tamaños adaptativos
  const modalPadding = isSmallDesktop ? '1.5rem' : '2rem';
  const modalMaxWidth = isSmallDesktop ? '600px' : '700px';
  const inputFontSize = isSmallDesktop ? '0.8125rem' : '0.875rem';
  const inputPadding = isSmallDesktop ? '0.5625rem 0.75rem' : '0.625rem 0.875rem';
  const buttonPadding = isSmallDesktop ? '0.625rem 1.25rem' : '0.75rem 1.5rem';
  const buttonFontSize = isSmallDesktop ? '0.8125rem' : '0.875rem';
  const gapSize = isSmallDesktop ? '0.875rem' : '1rem';

  const [formData, setFormData] = useState({
    categoryId: '',
    subcategoryId: '',
    code: product.code,
    name: product.name,
    description: product.description || '',
    productType: product.productType || 'DISH',
    salePrice: product.salePrice?.toString() || '0',
    purchasePrice: product.purchasePrice?.toString() || '0',
    unitMeasure: product.unitMeasure || 'NIU',
    preparationTime: product.preparationTime?.toString() || '0',
    stockMin: product.stockMin?.toString() || '0',
    stockMax: product.stockMax?.toString() || '0',
    currentStock: product.currentStock?.toString() || '0',
    isActive: product.isActive !== undefined ? product.isActive : true,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId
  });

  const categories: Category[] = categoriesData?.categoriesByBranch || [];
  const selectedCategory = categories.find(cat => cat.id === formData.categoryId);
  const availableSubcategories = selectedCategory?.subcategories?.filter(sub => sub.isActive) || [];

  const [updateProduct, { loading }] = useMutation(UPDATE_PRODUCT, {
    onCompleted: (data) => {
      if (data.updateProduct.success) {
        setMessage({ type: 'success', text: data.updateProduct.message });
        setTimeout(() => {
          onSuccess();
        }, 1000);
      } else {
        setMessage({ type: 'error', text: data.updateProduct.message });
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => {
      const newData = { ...prev, [name]: type === 'checkbox' ? checked : value };
      // Si cambia la categoría, limpiar la subcategoría seleccionada
      if (name === 'categoryId') {
        newData.subcategoryId = '';
      }
      return newData;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const variables: any = {
      productId: product.id,
      code: formData.code,
      name: formData.name,
      description: formData.description || null,
      productType: formData.productType,
      salePrice: formData.salePrice ? parseFloat(formData.salePrice) : undefined,
      purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : undefined,
      unitMeasure: formData.unitMeasure,
      preparationTime: formData.preparationTime ? parseInt(formData.preparationTime) : undefined,
      stockMin: formData.stockMin ? parseFloat(formData.stockMin) : undefined,
      stockMax: formData.stockMax ? parseFloat(formData.stockMax) : undefined,
      currentStock: formData.currentStock ? parseFloat(formData.currentStock) : undefined,
      isActive: formData.isActive,
    };

    // Solo incluir subcategoryId si se seleccionó una
    if (formData.subcategoryId) {
      variables.subcategoryId = formData.subcategoryId;
    }

    // Solo incluir los campos que tienen valores
    Object.keys(variables).forEach(key => {
      if (variables[key] === undefined || variables[key] === null) {
        delete variables[key];
      }
    });

    updateProduct({ variables });
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
          fontSize: '1.5rem', 
          fontWeight: 700, 
          color: '#1e293b' 
        }}>
          ✏️ Editar Producto
        </h2>

        {/* Mensaje */}
        {message && (
          <div style={{
            padding: '1rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
            backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: message.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fecaca'}`
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: gapSize }}>
            {/* Categoría y Subcategoría */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: gapSize }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Categoría
                </label>
                <select
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={handleChange}
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
                  <option value="">Mantener categoría actual</option>
                  {categories
                    .filter(cat => cat.isActive)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Subcategoría
                </label>
                <select
                  name="subcategoryId"
                  value={formData.subcategoryId}
                  onChange={handleChange}
                  disabled={!formData.categoryId}
                  style={{
                    width: '100%',
                    padding: inputPadding,
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: inputFontSize,
                    boxSizing: 'border-box',
                    backgroundColor: formData.categoryId ? 'white' : '#f1f5f9'
                  }}
                >
                  <option value="">Mantener subcategoría actual</option>
                  {availableSubcategories.map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tipo de Producto */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                Tipo de Producto *
              </label>
              <select
                name="productType"
                value={formData.productType}
                onChange={handleChange}
                required
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
                <option value="DISH">Plato</option>
                <option value="BEVERAGE">Bebida</option>
                <option value="INGREDIENT">Ingrediente</option>
              </select>
            </div>

            {/* Código y Nombre */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: gapSize }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Código *
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  required
                  placeholder="PROD001"
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Nombre *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Nombre del producto"
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

            {/* Descripción */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                Descripción
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Descripción del producto"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Precios */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Precio de Venta
                </label>
                <input
                  type="number"
                  name="salePrice"
                  value={formData.salePrice}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Precio de Compra
                </label>
                <input
                  type="number"
                  name="purchasePrice"
                  value={formData.purchasePrice}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
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
            </div>

            {/* Unidad de Medida y Tiempo de preparación */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: gapSize }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Unidad de Medida
                </label>
                <select
                  name="unitMeasure"
                  value={formData.unitMeasure}
                  onChange={handleChange}
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
                  <option value="NIU">NIU - Unidad</option>
                  <option value="KG">KG - Kilogramo</option>
                  <option value="LTR">LTR - Litro</option>
                  <option value="MTR">MTR - Metro</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Tiempo de Preparación (min)
                </label>
                <input
                  type="number"
                  name="preparationTime"
                  value={formData.preparationTime}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
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

            {/* Stock */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: gapSize }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Stock Mínimo
                </label>
                <input
                  type="number"
                  name="stockMin"
                  value={formData.stockMin}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Stock Máximo
                </label>
                <input
                  type="number"
                  name="stockMax"
                  value={formData.stockMax}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Stock Actual
                </label>
                <input
                  type="number"
                  name="currentStock"
                  value={formData.currentStock}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
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

            {/* Estado Activo */}
            <div>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                cursor: 'pointer',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: formData.isActive ? '#dcfce7' : '#fee2e2',
                border: `1px solid ${formData.isActive ? '#86efac' : '#fecaca'}`
              }}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ 
                  fontWeight: 500, 
                  fontSize: '0.875rem', 
                  color: formData.isActive ? '#166534' : '#991b1b'
                }}>
                  {formData.isActive ? '✅ Producto Activo' : '❌ Producto Inactivo'}
                </span>
              </label>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  background: loading ? '#94a3b8' : 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                {loading ? 'Guardando...' : '💾 Guardar Cambios'}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: buttonPadding,
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: buttonFontSize
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProduct;
