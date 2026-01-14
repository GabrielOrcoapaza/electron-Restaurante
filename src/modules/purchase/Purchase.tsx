import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { 
  GET_SUPPLIERS_BY_BRANCH, 
  GET_PURCHASE_OPERATIONS,
  GET_PRODUCTS_WITH_STOCK 
} from '../../graphql/queries';
import { 
  CREATE_PURCHASE_OPERATION, 
  CANCEL_PURCHASE_OPERATION 
} from '../../graphql/mutations';

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

interface PurchaseOperation {
  id: string;
  order: string;
  operationDate: string;
  status: string;
  subtotal: number;
  igvAmount: number;
  igvPercentage: number;
  total: number;
  notes?: string;
  cancelledAt?: string;
  person: {
    id: string;
    name: string;
    documentNumber?: string;
  } | null;
  user: {
    id: string;
    fullName: string;
  };
  details: Array<{
    id: string;
    quantity: number;
    unitMeasure: string;
    unitValue: number;
    unitPrice: number;
    notes?: string;
    isCanceled: boolean;
    product: {
      id: string;
      code: string;
      name: string;
      productType: string;
    };
  }>;
}

const Purchase: React.FC = () => {
  const { companyData, user } = useAuth();
  const branchId = companyData?.branch?.id;
  const igvPercentage = companyData?.branch?.igvPercentage || 18;

  const [view, setView] = useState<'list' | 'create'>('list');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [operationDate, setOperationDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetail[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [productNotes, setProductNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedOperationId, setSelectedOperationId] = useState<string>('');
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Queries
  // Usa personsByBranch (del backend: persons_by_branch) y filtra proveedores (isSupplier=true) en el frontend
  const { data: personsData, loading: suppliersLoading } = useQuery(GET_SUPPLIERS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only'
  });

  const { data: productsData, loading: productsLoading } = useQuery(GET_PRODUCTS_WITH_STOCK, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only'
  });

  const { data: operationsData, loading: operationsLoading, refetch: refetchOperations } = useQuery(
    GET_PURCHASE_OPERATIONS,
    {
      variables: { branchId: branchId! },
      skip: !branchId || view !== 'list',
      fetchPolicy: 'network-only'
    }
  );

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
          refetchOperations();
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
  
  const [cancelPurchaseOperation, { loading: cancelingPurchase }] = useMutation(
    CANCEL_PURCHASE_OPERATION,
    {
      onCompleted: (data) => {
        if (data.cancelPurchaseOperation.success) {
          setMessage({ 
            type: 'success', 
            text: data.cancelPurchaseOperation.message 
          });
          setShowCancelModal(false);
          setSelectedOperationId('');
          setCancellationReason('');
          refetchOperations();
          setTimeout(() => setMessage(null), 5000);
        } else {
          setMessage({ 
            type: 'error', 
            text: data.cancelPurchaseOperation.message 
          });
          setTimeout(() => setMessage(null), 5000);
        }
      },
      onError: (error) => {
        setMessage({ type: 'error', text: error.message });
        setTimeout(() => setMessage(null), 5000);
      }
    }
  );

  // Filtrar solo los proveedores (personas con isSupplier=true) de todas las personas
  const allPersons = personsData?.personsByBranch || [];
  const suppliers: Supplier[] = allPersons.filter((person: any) => person.isSupplier === true);
  const allProducts: Product[] = productsData?.productsByBranch || [];
  // Filtrar solo ingredientes y bebidas
  const availableProducts = allProducts.filter(
    p => (p.productType === 'INGREDIENT' || p.productType === 'BEVERAGE') && p.isActive
  );
  const operations: PurchaseOperation[] = operationsData?.purchasesByBranch || [];

  const resetForm = () => {
    setSelectedSupplierId('');
    setOperationDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setPurchaseDetails([]);
    setSelectedProductId('');
    setQuantity('1');
    setUnitPrice('');
    setProductNotes('');
  };

  const handleAddProduct = () => {
    if (!selectedProductId || !quantity || parseFloat(quantity) <= 0) {
      setMessage({ type: 'error', text: 'Selecciona un producto y una cantidad válida' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const product = availableProducts.find(p => p.id === selectedProductId);
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
    setQuantity('1');
    setUnitPrice('');
    setProductNotes('');
  };

  const handleRemoveProduct = (index: number) => {
    setPurchaseDetails(purchaseDetails.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = purchaseDetails.reduce((sum, detail) => sum + detail.subtotal, 0);
    const igvAmount = subtotal * (igvPercentage / 100);
    const total = subtotal + igvAmount;
    return { subtotal, igvAmount, total };
  };

  const handleCreatePurchase = async () => {
    if (purchaseDetails.length === 0) {
      setMessage({ type: 'error', text: 'Agrega al menos un producto' });
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

    try {
      await createPurchaseOperation({
        variables: {
          branchId: branchId!,
          personId: selectedSupplierId || null,
          userId: user.id,
          operationDate: operationDateTime,
          notes: notes || null,
          details: details,
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

  const handleCancelPurchase = () => {
    if (!cancellationReason.trim()) {
      setMessage({ type: 'error', text: 'Ingresa una razón de cancelación' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (!user?.id) {
      setMessage({ type: 'error', text: 'Usuario no encontrado' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    cancelPurchaseOperation({
      variables: {
        operationId: selectedOperationId,
        branchId: branchId!,
        userId: user.id,
        cancellationReason: cancellationReason
      }
    });
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
        gap: '2rem',
        background: 'linear-gradient(160deg, #f0f4ff 0%, #f9fafb 45%, #ffffff 100%)',
        padding: '1.5rem',
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
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>
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
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>
            📋 Lista de Compras ({operations.length})
          </h3>
          
          {operationsLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              Cargando compras...
            </div>
          ) : operations.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <p>No hay compras registradas</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Orden</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Fecha</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Proveedor</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Subtotal</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>IGV</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Total</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Estado</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.map((operation) => (
                    <tr key={operation.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem', color: '#334155', fontFamily: 'monospace' }}>
                        #{operation.order}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#334155' }}>
                        {new Date(operation.operationDate).toLocaleDateString('es-PE')}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#334155' }}>
                        {operation.person?.name || 'Sin proveedor'}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#334155', fontWeight: 500 }}>
                        {currencyFormatter.format(operation.subtotal)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#334155' }}>
                        {currencyFormatter.format(operation.igvAmount)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#334155', fontWeight: 600 }}>
                        {currencyFormatter.format(operation.total)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: operation.status === 'CANCELLED' ? '#fee2e2' : '#dcfce7',
                          color: operation.status === 'CANCELLED' ? '#991b1b' : '#166534'
                        }}>
                          {operation.status === 'CANCELLED' ? 'Cancelada' : 'Procesada'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        {operation.status !== 'CANCELLED' && (
                          <button
                            onClick={() => {
                              setSelectedOperationId(operation.id);
                              setShowCancelModal(true);
                            }}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              transition: 'all 0.2s'
                            }}
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                style={{
                  width: '100%',
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
            )}
          </div>

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
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#475569' }}>
                  Producto
                </label>
                {productsLoading ? (
                  <div>Cargando productos...</div>
                ) : (
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">Selecciona un producto</option>
                    {availableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.code} - {product.name} ({product.productType})
                      </option>
                    ))}
                  </select>
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

      {/* Modal de cancelación */}
      {showCancelModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem', fontWeight: 600, color: '#334155' }}>
              Cancelar Compra
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: '#64748b' }}>
              ¿Estás seguro de que deseas cancelar esta compra? Esta acción reducirá el stock de los productos.
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#475569' }}>
                Razón de cancelación *
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ingresa la razón de cancelación..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedOperationId('');
                  setCancellationReason('');
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
                onClick={handleCancelPurchase}
                disabled={cancelingPurchase || !cancellationReason.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: cancelingPurchase || !cancellationReason.trim()
                    ? '#94a3b8'
                    : '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: cancelingPurchase || !cancellationReason.trim()
                    ? 'not-allowed'
                    : 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                {cancelingPurchase ? 'Cancelando...' : 'Confirmar Cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchase;

