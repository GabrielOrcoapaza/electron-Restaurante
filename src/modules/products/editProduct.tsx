import React, { useState, useRef } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { UPDATE_PRODUCT } from '../../graphql/mutations';
import { GET_CATEGORIES_BY_BRANCH } from '../../graphql/queries';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { useToast } from '../../context/ToastContext';

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
  stockMin?: number;
  stockMax?: number;
  currentStock?: number;
  isActive?: boolean;
  managesStock?: boolean;
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

  // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
  const isXs = breakpoint === 'xs'; // < 640px
  const isSmall = breakpoint === 'sm'; // 640px - 767px
  const isMedium = breakpoint === 'md'; // 768px - 1023px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  const isMediumDesktop = breakpoint === 'xl'; // 1280px - 1535px

  // Tamaños adaptativos (Compactados)
  const modalPadding = isXs ? '1rem' : isSmall ? '1.25rem' : isMedium ? '1.5rem' : '1.5rem';
  const modalMaxWidth = isXs ? '98%' : isSmall ? '95%' : isMedium ? '550px' : isSmallDesktop ? '600px' : '700px';
  const labelFontSize = isXs ? '0.75rem' : isSmall ? '0.8rem' : '0.8rem';
  const inputFontSize = isXs ? '0.875rem' : isSmall ? '0.8rem' : '0.8rem';
  const inputPadding = isXs ? '0.625rem 0.75rem' : isSmall ? '0.5rem 0.625rem' : '0.625rem 0.75rem';
  const buttonPadding = isXs ? '0.75rem 1rem' : isSmall ? '0.625rem 1rem' : '0.75rem 1.25rem';
  const buttonFontSize = isXs ? '0.875rem' : isSmall ? '0.8rem' : '0.8rem';
  const gapSize = isXs ? '0.75rem' : isSmall ? '0.875rem' : '1rem';
  const titleFontSize = isXs ? '1.125rem' : isSmall ? '1.2rem' : '1.25rem';

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
    managesStock: product.managesStock ?? false,
  });
  const [enableStockEdit, setEnableStockEdit] = useState(false);
  const [newImageBase64, setNewImageBase64] = useState<string | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const existingImageDataUrl =
    product.imageBase64 && !imageRemoved
      ? product.imageBase64.startsWith('data:')
        ? product.imageBase64
        : `data:image/jpeg;base64,${product.imageBase64}`
      : null;
  const displayImageSrc = newImagePreview ?? existingImageDataUrl;

  const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

  const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only'
  });

  const categories: Category[] = categoriesData?.categoriesByBranch || [];
  const selectedCategory = categories.find(cat => cat.id === formData.categoryId);
  const availableSubcategories = selectedCategory?.subcategories?.filter(sub => sub.isActive) || [];

  const [updateProduct, { loading }] = useMutation(UPDATE_PRODUCT, {
    onCompleted: (data) => {
      if (data.updateProduct.success) {
        showToast(data.updateProduct.message, 'success');
        setTimeout(() => {
          onSuccess();
        }, 1000);
      } else {
        showToast(data.updateProduct.message, 'error');
      }
    },
    onError: (error) => {
      showToast(error.message, 'error');
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('El archivo debe ser una imagen', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('La imagen no debe superar 3 MB', 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(',');
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      setNewImageBase64(b64);
      setNewImagePreview(dataUrl);
      setImageRemoved(false);
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    if (newImageBase64 !== null) {
      setNewImageBase64(null);
      setNewImagePreview(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
      return;
    }
    if (product.imageBase64) {
      setImageRemoved(true);
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

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
      isActive: formData.isActive,
      managesStock: formData.managesStock,
    };

    // Solo enviar el stock si la edición está habilitada y ha cambiado respecto al valor original
    if (enableStockEdit) {
      const currentStockFloat = formData.currentStock ? parseFloat(formData.currentStock) : 0;
      if (currentStockFloat !== (product.currentStock || 0)) {
        variables.currentStock = currentStockFloat;
      }
    }

    // Solo incluir subcategoryId si se seleccionó una
    if (formData.subcategoryId) {
      variables.subcategoryId = formData.subcategoryId;
    }

    let imageMutation: string | null | undefined = undefined;
    if (newImageBase64 !== null) {
      imageMutation = newImageBase64;
    } else if (imageRemoved && product.imageBase64) {
      imageMutation = null;
    }

    // Solo incluir los campos que tienen valores
    Object.keys(variables).forEach(key => {
      if (variables[key] === undefined || variables[key] === null) {
        delete variables[key];
      }
    });

    if (imageMutation !== undefined) {
      variables.imageBase64 = imageMutation;
    }

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
          margin: '0 0 1rem',
          fontSize: titleFontSize,
          fontWeight: 700,
          color: '#1e293b'
        }}>
          ✏️ Editar Producto
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {/* Categoría y Subcategoría */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isXs || isSmall ? '1fr' : '1fr 1fr',
              gap: gapSize
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
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
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                Tipo de Producto *
              </label>
              <select
                name="productType"
                value={formData.productType}
                onChange={handleChange}
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
                <option value="DISH">Plato</option>
                <option value="BEVERAGE">Bebida</option>
                <option value="INGREDIENT">Ingrediente</option>
              </select>
            </div>

            {/* Código y Nombre */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isXs || isSmall ? '1fr' : '1fr 2fr',
              gap: gapSize
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
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
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                Descripción
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Descripción del producto"
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

            {/* Foto del producto */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                Foto del producto
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '0.75rem' }}>
                {displayImageSrc ? (
                  <img
                    src={displayImageSrc}
                    alt="Producto"
                    style={{
                      width: isXs || isSmall ? '72px' : '88px',
                      height: isXs || isSmall ? '72px' : '88px',
                      objectFit: 'cover',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: isXs || isSmall ? '72px' : '88px',
                      height: isXs || isSmall ? '72px' : '88px',
                      borderRadius: '10px',
                      border: '1px dashed #cbd5e1',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                      fontSize: '1.5rem',
                    }}
                  >
                    🖼️
                  </div>
                )}
                <div style={{ flex: '1', minWidth: isXs || isSmall ? '100%' : '160px' }}>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageChange}
                    style={{
                      width: '100%',
                      padding: isXs || isSmall ? '0.35rem' : '0.4rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: inputFontSize,
                      boxSizing: 'border-box',
                      backgroundColor: 'white'
                    }}
                  />
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.65rem', color: '#94a3b8' }}>
                    JPG, PNG, WebP o GIF. Máx. 3 MB. Guardar envía la nueva imagen o quita la actual.
                  </p>
                </div>
                {(displayImageSrc || newImageBase64 !== null) && (
                  <button
                    type="button"
                    onClick={handleClearImage}
                    style={{
                      padding: '0.4rem 0.65rem',
                      fontSize: inputFontSize,
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      color: '#64748b',
                      cursor: 'pointer',
                      fontWeight: 500,
                      alignSelf: 'center'
                    }}
                  >
                    Quitar foto
                  </button>
                )}
              </div>
            </div>

            {/* Precios */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isXs || isSmall ? '1fr' : '1fr 1fr',
              gap: gapSize
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
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
            <div style={{
              display: 'grid',
              gridTemplateColumns: isXs || isSmall ? '1fr' : '1fr 1fr',
              gap: gapSize
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
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

            {/* Stock - Solo visible para Bebidas e Ingredientes */}
            {(formData.productType === 'BEVERAGE' || formData.productType === 'INGREDIENT') && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isXs || isSmall ? '1fr' : isMedium ? '1fr 1fr' : '1fr 1fr 1fr',
                  gap: gapSize
                }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
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
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
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
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginBottom: '0.5rem',
                    fontWeight: 500,
                    fontSize: labelFontSize,
                    color: '#475569'
                  }}>
                    Stock Actual
                    <input
                      type="checkbox"
                      checked={enableStockEdit}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEnableStockEdit(checked);
                        if (checked) {
                          showToast('Advertencia: Cambiar el stock afectará tu Kardex y generará un ajuste.', 'warning');
                        }
                      }}
                      title="Habilitar edición de stock"
                      style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                    />
                  </label>
                  <input
                    type="number"
                    name="currentStock"
                    value={formData.currentStock}
                    onChange={handleChange}
                    disabled={!enableStockEdit}
                    min="0"
                    step="0.01"
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: inputPadding,
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: inputFontSize,
                      boxSizing: 'border-box',
                      backgroundColor: enableStockEdit ? 'white' : '#f8fafc',
                      cursor: enableStockEdit ? 'text' : 'not-allowed'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Manejo de Stock - Solo para Bebidas e Ingredientes */}
            {(formData.productType === 'BEVERAGE' || formData.productType === 'INGREDIENT') && (
              <div style={{
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: formData.managesStock ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${formData.managesStock ? '#bfdbfe' : '#e2e8f0'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: 'pointer'
              }}
                onClick={() => {
                  setFormData(prev => ({ ...prev, managesStock: !prev.managesStock }));
                }}
              >
                <input
                  type="checkbox"
                  name="managesStock"
                  checked={formData.managesStock}
                  onChange={(e) => {
                    e.stopPropagation();
                    setFormData(prev => ({ ...prev, managesStock: e.target.checked }));
                  }}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: labelFontSize, color: '#1e40af' }}>
                    Manejar Stock e Inventario
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Si se activa, este producto generará movimientos en el Kardex. Una vez guardado, no se podrá desactivar.
                  </div>
                </div>
              </div>
            )}

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
                  fontSize: labelFontSize,
                  color: formData.isActive ? '#166534' : '#991b1b'
                }}>
                  {formData.isActive ? '✅ Producto Activo' : '❌ Producto Inactivo'}
                </span>
              </label>
            </div>

            {/* Botones */}
            <div style={{
              display: 'flex',
              flexDirection: isXs || isSmall ? 'column' : 'row',
              gap: '0.75rem',
              marginTop: '1rem'
            }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: buttonPadding,
                  background: loading ? '#94a3b8' : 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: buttonFontSize
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
