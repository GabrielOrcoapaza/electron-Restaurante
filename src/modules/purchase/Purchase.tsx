import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import {
  GET_SUPPLIERS_BY_BRANCH,
  GET_PRODUCTS_WITH_STOCK,
  GET_CASH_REGISTERS,
  SEARCH_PRODUCTS,
  GET_PRODUCTS_BY_BRANCH
} from '../../graphql/queries';
import { CREATE_PURCHASE_OPERATION } from '../../graphql/mutations';
import CreateSupplierModal from './createSupplier';
import PurchaseList from './purchaseList';
import { formatLocalDateYYYYMMDD } from '../../utils/localDateTime';

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

interface Supplier {
  id: string;
  name: string;
  documentType?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  isSupplier: boolean;
  isActive: boolean;
}

interface Product {
  id: string;
  code: string;
  name: string;
  productType: string;
  purchasePrice: number;
  unitMeasure?: string;
  currentStock?: number;
  isActive: boolean;
}

interface PurchaseDetail {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitMeasure: string;
  unitValue: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
}

const Purchase: React.FC = () => {
  const { companyData, user } = useAuth();
  const { breakpoint } = useResponsive();
  const branchId = companyData?.branch?.id;
  // IGV para compras establecido en 18% según solicitud
  const igvPercentage = 18;

  // Adaptar según tamaño de pantalla de PC
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px

  // Tamaños adaptativos
  const containerPadding = isSmallDesktop ? '1.25rem' : '1.5rem';
  const containerGap = isSmallDesktop ? '1.5rem' : '2rem';
  const titleFontSize = isSmallDesktop ? '1.375rem' : '1.5rem';

  const [view, setView] = useState<'list' | 'create'>('list');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [operationDate, setOperationDate] = useState<string>(formatLocalDateYYYYMMDD());
  const [notes, setNotes] = useState<string>('');
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetail[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [productNotes, setProductNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCreateSupplierModal, setShowCreateSupplierModal] = useState(false);

  // Estados para Pago
  const [cashRegisterId, setCashRegisterId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [referenceNumber, setReferenceNumber] = useState<string>('');

  // Queries
  // Usa personsByBranch (del backend: persons_by_branch) y filtra proveedores (isSupplier=true) en el frontend
  const { data: personsData, loading: suppliersLoading, refetch: refetchSuppliers } = useQuery(GET_SUPPLIERS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only'
  });

  const { data: productsData, loading: productsLoading } = useQuery(GET_PRODUCTS_WITH_STOCK, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only'
  });

  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchFocused, setProductSearchFocused] = useState(false);

  const { data: searchData, loading: searchLoading } = useQuery(SEARCH_PRODUCTS, {
    variables: { search: productSearchTerm, branchId: branchId!, limit: 50 },
    skip: !branchId || productSearchTerm.length < 3,
    errorPolicy: 'ignore',
    fetchPolicy: 'network-only'
  });

  const { data: productsByBranchData } = useQuery(GET_PRODUCTS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only'
  });

  const { data: cashData } = useQuery(GET_CASH_REGISTERS, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only',
  });

  const cashRegisters = cashData?.cashRegistersByBranch || [];

  // Seleccionar la primera caja por defecto
  React.useEffect(() => {
    if (cashRegisters.length > 0 && !cashRegisterId) {
      setCashRegisterId(cashRegisters[0].id);
    }
  }, [cashRegisters, cashRegisterId]);

  // Mutations
  const [createPurchaseOperation, { loading: creatingPurchase }] = useMutation(
    CREATE_PURCHASE_OPERATION,
    {
      onCompleted: (data) => {
        if (data.createPurchaseOperation.success) {
          setMessage({
            type: 'success',
            text: data.createPurchaseOperation.message
          });
          resetForm();
          setView('list');
          setTimeout(() => setMessage(null), 5000);
        } else {
          setMessage({
            type: 'error',
            text: data.createPurchaseOperation.message
          });
          setTimeout(() => setMessage(null), 5000);
        }
        setIsProcessing(false);
      },
      onError: (error) => {
        setMessage({ type: 'error', text: error.message });
        setIsProcessing(false);
        setTimeout(() => setMessage(null), 5000);
      }
    }
  );

  // Filtrar solo los proveedores (personas con isSupplier=true) de todas las personas
  const allPersons = personsData?.personsByBranch || [];
  const suppliers: Supplier[] = allPersons.filter((person: any) => person.isSupplier === true);
  const allProducts: Product[] = productsData?.productsByBranch || [];
  const allProductsByBranch = productsByBranchData?.productsByBranch || [];
  const baseProducts = allProducts.filter(
    p => (p.productType === 'INGREDIENT' || p.productType === 'BEVERAGE') && p.isActive
  );

  const productSearchResults = (() => {
    if (productSearchTerm.length < 3) return baseProducts.slice(0, 50);
    const fromSearch = (searchData?.searchProducts || []).filter(
      (p: any) => (p.productType === 'INGREDIENT' || p.productType === 'BEVERAGE') && p.isActive !== false
    );
    if (fromSearch.length > 0) return fromSearch;
    const lower = productSearchTerm.toLowerCase();
    return baseProducts.filter(
      (p: any) =>
        (p.name || '').toLowerCase().includes(lower) ||
        (p.code || '').toLowerCase().includes(lower) ||
        (p.description || '').toLowerCase().includes(lower)
    ).slice(0, 50);
  })();

  const selectedProductForDisplay = selectedProductId
    ? productSearchResults.find((p: any) => p.id === selectedProductId) ||
      baseProducts.find((p: any) => p.id === selectedProductId) ||
      allProductsByBranch.find((p: any) => p.id === selectedProductId)
    : null;

  const availableProducts = baseProducts;

  const resetForm = () => {
    setSelectedSupplierId('');
    setOperationDate(formatLocalDateYYYYMMDD());
    setNotes('');
    setPurchaseDetails([]);
    setSelectedProductId('');
    setProductSearchTerm('');
    setQuantity('1');
    setUnitPrice('');
    setProductNotes('');
    setPaymentMethod('CASH');
    setReferenceNumber('');
  };

  const findProductById = (id: string) =>
    productSearchResults.find((p: any) => p.id === id) ||
    baseProducts.find((p: any) => p.id === id) ||
    allProductsByBranch.find((p: any) => p.id === id);

  const handleAddProduct = () => {
    if (!selectedProductId || !quantity || parseFloat(quantity) <= 0) {
      setMessage({ type: 'error', text: 'Selecciona un producto y una cantidad válida' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const product = findProductById(selectedProductId);
    if (!product) return;

    const qty = parseFloat(quantity);
    const price = unitPrice ? parseFloat(unitPrice) : product.purchasePrice;
    const subtotal = qty * price;

    const detail: PurchaseDetail = {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      quantity: qty,
      unitMeasure: product.unitMeasure || 'NIU',
      unitValue: price,
      unitPrice: price,
      subtotal: subtotal,
      notes: productNotes
    };

    setPurchaseDetails([...purchaseDetails, detail]);
    setSelectedProductId('');
    setProductSearchTerm('');
    setQuantity('1');
    setUnitPrice('');
    setProductNotes('');
  };

  const handleRemoveProduct = (index: number) => {
    setPurchaseDetails(purchaseDetails.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    // Para compras, el precio ingresado ya incluye el IGV (Total)
    // El usuario desea que el IGV se calcule como el 18% del Total
    const totalSum = purchaseDetails.reduce((sum, detail) => sum + detail.subtotal, 0);
    const igvAmount = totalSum * (igvPercentage / 100);
    const subtotalCalculated = totalSum - igvAmount;
    return { subtotal: subtotalCalculated, igvAmount, total: totalSum };
  };

  const handleCreatePurchase = async () => {
    if (purchaseDetails.length === 0) {
      setMessage({ type: 'error', text: 'Agrega al menos un producto' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (!cashRegisterId) {
      setMessage({ type: 'error', text: 'Selecciona una caja para el pago' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (!user?.id) {
      setMessage({ type: 'error', text: 'Usuario no encontrado' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setIsProcessing(true);

    const { subtotal, igvAmount, total } = calculateTotals();
    const operationDateTime = operationDate
      ? new Date(operationDate + 'T00:00:00').toISOString()
      : new Date().toISOString();

    const details = purchaseDetails.map(detail => ({
      productId: detail.productId,
      quantity: detail.quantity,
      unitMeasure: detail.unitMeasure,
      unitValue: detail.unitValue,
      unitPrice: detail.unitPrice,
      notes: detail.notes || ''
    }));

    const payments = [{
      cashRegisterId: cashRegisterId,
      paymentMethod: paymentMethod,
      paymentType: 'CASH',
      transactionType: 'EXPENSE',
      paidAmount: total,
      totalAmount: total,
      paymentDate: operationDateTime,
      referenceNumber: referenceNumber || null,
      notes: `Pago de compra - Proveedor: ${suppliers.find(s => s.id === selectedSupplierId)?.name || 'Sin proveedor'}`
    }];

    try {
      await createPurchaseOperation({
        variables: {
          branchId: branchId!,
          personId: selectedSupplierId || null,
          userId: user.id,
          operationDate: operationDateTime,
          notes: notes || null,
          details: details,
          payments: payments,
          subtotal: subtotal,
          igvAmount: igvAmount,
          igvPercentage: igvPercentage,
          total: total
        }
      });
    } catch (error) {
      console.error('Error creating purchase:', error);
      setIsProcessing(false);
    }
  };

  const handleProductSelect = (productId: string) => {
    const product = availableProducts.find(p => p.id === productId);
    if (product) {
      setSelectedProductId(productId);
      setUnitPrice(product.purchasePrice.toString());
    }
  };

  if (!branchId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        No se encontró información de la sucursal. Por favor, inicia sesión nuevamente.
      </div>
    );
  }

  const { subtotal, igvAmount, total } = calculateTotals();

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: containerGap,
        background: 'linear-gradient(160deg, #f0f4ff 0%, #f9fafb 45%, #ffffff 100%)',
        padding: containerPadding,
        borderRadius: '18px',
        boxShadow: '0 25px 50px -12px rgba(15,23,42,0.18)',
      }}
    >
      {/* Mensajes */}
      {message && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '10px',
            backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: message.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
            fontWeight: 500
          }}
        >
          {message.text}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: titleFontSize, fontWeight: 700, color: '#1e293b' }}>
            🛒 Gestión de Compras
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            {view === 'list' ? 'Lista de compras realizadas' : 'Registrar nueva compra'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {view === 'list' ? (
            <button
              onClick={() => {
                setView('create');
                resetForm();
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #10b981, #059669)',
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
              + Nueva Compra
            </button>
          ) : (
            <button
              onClick={() => {
                setView('list');
                resetForm();
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#64748b',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem',
                transition: 'all 0.2s ease'
              }}
            >
              ← Volver a Lista
            </button>
          )}
        </div>
      </div>

      {/* Contenido según la vista */}
      {view === 'list' ? (
        <PurchaseList branchId={branchId!} setMessage={setMessage} />
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {/* Información del proveedor */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#475569' }}>
              Proveedor (Opcional)
            </label>
            {suppliersLoading ? (
              <div>Cargando proveedores...</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  style={{
                    flex: '1',
                    minWidth: '200px',
                    maxWidth: '400px',
                    padding: '0.625rem 0.875rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Selecciona un proveedor</option>
                  {suppliers
                    .filter(s => s.isActive)
                    .map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name} {supplier.documentNumber ? `(${supplier.documentNumber})` : ''}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCreateSupplierModal(true)}
                  style={{
                    padding: '0.625rem 1rem',
                    background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  + Crear proveedor
                </button>
              </div>
            )}
          </div>

          {showCreateSupplierModal && branchId && (
            <CreateSupplierModal
              isOpen={showCreateSupplierModal}
              onClose={() => setShowCreateSupplierModal(false)}
              branchId={branchId}
              suppliers={suppliers}
              refetchSuppliers={refetchSuppliers}
              onSuccess={(supplier) => {
                setSelectedSupplierId(supplier.id);
                setShowCreateSupplierModal(false);
              }}
              showToast={(msg, type) => {
                setMessage({ type: type === 'error' ? 'error' : 'success', text: msg });
                setTimeout(() => setMessage(null), 5000);
              }}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#475569' }}>
                Fecha de Compra
              </label>
              <input
                type="date"
                value={operationDate}
                onChange={(e) => setOperationDate(e.target.value)}
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
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#475569' }}>
                Notas
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales..."
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

          {/* Agregar productos */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1rem',
            backgroundColor: '#f8fafc'
          }}>
            <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: '#334155' }}>
              Agregar Producto
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Producto
                </label>
                {productsLoading ? (
                  <div>Cargando productos...</div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute',
                      left: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.9rem',
                      opacity: 0.6,
                      pointerEvents: 'none'
                    }}>🔎</span>
                    <input
                      type="text"
                      value={selectedProductForDisplay ? `${selectedProductForDisplay.code} - ${selectedProductForDisplay.name}` : productSearchTerm}
                      onChange={(e) => {
                        setSelectedProductId('');
                        setProductSearchTerm(e.target.value);
                      }}
                      onFocus={() => setProductSearchFocused(true)}
                      onBlur={() => setTimeout(() => setProductSearchFocused(false), 200)}
                      placeholder="Buscar producto o escanear código..."
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem 0.625rem 2rem',
                        paddingRight: selectedProductForDisplay ? '2.5rem' : undefined,
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                    {selectedProductForDisplay && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProductId('');
                          setProductSearchTerm('');
                        }}
                        style={{
                          position: 'absolute',
                          right: '0.5rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: '#f1f5f9',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          color: '#64748b',
                          fontWeight: 500
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
                {productSearchFocused && productSearchTerm.length >= 3 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.25rem',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 20
                  }}>
                    {productSearchTerm.length >= 3 && searchLoading ? (
                      <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>Buscando...</div>
                    ) : productSearchResults.length === 0 ? (
                      <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>No se encontraron productos (ingredientes o bebidas)</div>
                    ) : (
                      productSearchResults.slice(0, 40).map((p: any) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            handleProductSelect(p.id);
                            setProductSearchTerm('');
                            setProductSearchFocused(false);
                          }}
                          style={{
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            borderBottom: '1px solid #f1f5f9'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                        >
                          <span style={{ fontWeight: 600 }}>{p.code}</span> - {p.name} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({p.productType})</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Cantidad
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0.01"
                  step="0.01"
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
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Precio Unit.
                </label>
                <input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="Auto"
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
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Notas
                </label>
                <input
                  type="text"
                  value={productNotes}
                  onChange={(e) => setProductNotes(e.target.value)}
                  placeholder="Opcional"
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
              <button
                onClick={handleAddProduct}
                style={{
                  padding: '0.625rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  whiteSpace: 'nowrap'
                }}
              >
                Agregar
              </button>
            </div>
          </div>

          {/* Lista de productos agregados */}
          {purchaseDetails.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: '#334155' }}>
                Productos Agregados ({purchaseDetails.length})
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Código</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Producto</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Cantidad</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Precio Unit.</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Subtotal</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseDetails.map((detail, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem', color: '#334155', fontFamily: 'monospace' }}>
                          {detail.productCode}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#334155' }}>
                          {detail.productName}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#334155' }}>
                          {detail.quantity} {detail.unitMeasure}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#334155' }}>
                          {currencyFormatter.format(detail.unitPrice)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#334155', fontWeight: 600 }}>
                          {currencyFormatter.format(detail.subtotal)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleRemoveProduct(index)}
                            style={{
                              padding: '0.5rem',
                              background: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sección de Pago */}
          {purchaseDetails.length > 0 && (
            <div style={{
              borderTop: '2px solid #e2e8f0',
              paddingTop: '1.5rem',
              marginTop: '1rem',
              backgroundColor: '#f8fafc',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}>
              <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: '#334155' }}>
                💳 Información del Pago (Egreso)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                    Caja
                  </label>
                  <select
                    value={cashRegisterId}
                    onChange={(e) => setCashRegisterId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">Selecciona caja</option>
                    {cashRegisters.map((cash: any) => (
                      <option key={cash.id} value={cash.id}>
                        {cash.name} (S/ {Number(cash.currentBalance || 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                    Método
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="CASH">Efectivo</option>
                    <option value="YAPE">Yape</option>
                    <option value="PLIN">Plin</option>
                    <option value="CARD">Tarjeta</option>
                    <option value="TRANSFER">Transferencia</option>
                    <option value="OTROS">Otros</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                    Referencia
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="N° Operación"
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
            </div>
          )}

          {/* Totales */}
          {purchaseDetails.length > 0 && (
            <div style={{
              borderTop: '2px solid #e2e8f0',
              paddingTop: '1rem',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <div style={{ minWidth: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#64748b' }}>Subtotal:</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>
                    {currencyFormatter.format(subtotal)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#64748b' }}>IGV ({igvPercentage}%):</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>
                    {currencyFormatter.format(igvAmount)}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '0.75rem',
                  borderTop: '2px solid #334155',
                  marginTop: '0.5rem'
                }}>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#334155' }}>Total:</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#334155' }}>
                    {currencyFormatter.format(total)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Botón guardar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              onClick={() => {
                setView('list');
                resetForm();
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#64748b',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleCreatePurchase}
              disabled={isProcessing || creatingPurchase || purchaseDetails.length === 0}
              style={{
                padding: '0.75rem 1.5rem',
                background: isProcessing || creatingPurchase || purchaseDetails.length === 0
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 600,
                cursor: isProcessing || creatingPurchase || purchaseDetails.length === 0
                  ? 'not-allowed'
                  : 'pointer',
                fontSize: '0.875rem',
                transition: 'all 0.2s ease'
              }}
            >
              {isProcessing || creatingPurchase ? 'Guardando...' : 'Guardar Compra'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchase;

