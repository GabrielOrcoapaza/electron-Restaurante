import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
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
  const branchId = companyData?.branch?.id;
  const igvPercentage = 18;

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
  const { data: personsData, loading: suppliersLoading, refetch: refetchSuppliers } = useQuery(GET_SUPPLIERS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only'
  });

  const { data: productsData } = useQuery(GET_PRODUCTS_WITH_STOCK, {
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
      <div className="p-8 text-center text-rose-600 font-bold bg-white rounded-3xl dark:bg-slate-900">
        No se encontró información de la sucursal. Por favor, inicia sesión nuevamente.
      </div>
    );
  }

  const { subtotal, igvAmount, total } = calculateTotals();

  return (
    <div className="flex min-h-full flex-col gap-6 rounded-3xl bg-white p-6 shadow-xl transition-all duration-300 dark:bg-slate-900 md:p-8 lg:p-10">
      {/* Mensajes */}
      {message && (
        <div className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
          message.type === 'success' 
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400' 
            : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400'
        }`}>
          <div className={`h-2 w-2 rounded-full ${message.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 md:text-3xl">
            Gestión de Compras
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {view === 'list' ? 'Historial de transacciones de abastecimiento' : 'Registro de nuevos egresos de inventario'}
          </p>
        </div>
        <div className="flex gap-3">
          {view === 'list' ? (
            <button
              onClick={() => {
                setView('create');
                resetForm();
              }}
              className="group flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Nueva Compra
            </button>
          ) : (
            <button
              onClick={() => {
                setView('list');
                resetForm();
              }}
              className="flex items-center gap-2 rounded-2xl bg-slate-100 px-6 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver a Lista
            </button>
          )}
        </div>
      </div>

      {/* Contenido según la vista */}
      {view === 'list' ? (
        <div className="animate-in fade-in duration-500">
          <PurchaseList branchId={branchId!} setMessage={setMessage} />
        </div>
      ) : (
        <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-4 duration-500">
          {/* Sección 1: Información General */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 flex flex-col gap-6 rounded-3xl border border-slate-100 bg-slate-50/30 p-6 dark:border-slate-800 dark:bg-slate-800/20">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Información del Proveedor
              </h3>
              
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Seleccionar Proveedor
                  </label>
                  {suppliersLoading ? (
                    <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <select
                        value={selectedSupplierId}
                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="">Consumidor Final / Sin Proveedor</option>
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
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-600 transition-all hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Nuevo Proveedor
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 rounded-3xl border border-slate-100 bg-slate-50/30 p-6 dark:border-slate-800 dark:bg-slate-800/20">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Detalles de Operación
              </h3>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Fecha de Registro
                  </label>
                  <input
                    type="date"
                    value={operationDate}
                    onChange={(e) => setOperationDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Glosa / Comentario
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Eje: Compra semanal de verduras..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
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

          {/* Sección 2: Búsqueda y Selección de Productos */}
          <div className="flex flex-col gap-6 rounded-3xl border border-slate-100 bg-indigo-50/30 p-6 dark:border-slate-800/50 dark:bg-indigo-950/10">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 dark:text-indigo-500">
              Selector de Ítems
            </h3>
            
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end">
              <div className="relative lg:col-span-5">
                <label className="mb-2 px-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Producto / Insumo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={selectedProductForDisplay ? `${selectedProductForDisplay.code} - ${selectedProductForDisplay.name}` : productSearchTerm}
                    onChange={(e) => {
                      setSelectedProductId('');
                      setProductSearchTerm(e.target.value);
                    }}
                    onFocus={() => setProductSearchFocused(true)}
                    onBlur={() => setTimeout(() => setProductSearchFocused(false), 200)}
                    placeholder="Buscar por nombre o código..."
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  {selectedProductForDisplay && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductId('');
                        setProductSearchTerm('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Dropdown de búsqueda */}
                {productSearchFocused && productSearchTerm.length >= 3 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl animate-in fade-in slide-in-from-top-2 dark:border-slate-700 dark:bg-slate-800">
                    {searchLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
                      </div>
                    ) : productSearchResults.length === 0 ? (
                      <div className="py-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Sin resultados
                      </div>
                    ) : (
                      productSearchResults.slice(0, 40).map((p: any) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            handleProductSelect(p.id);
                            setProductSearchTerm('');
                            setProductSearchFocused(false);
                          }}
                          className="flex w-full flex-col gap-0.5 rounded-xl p-3 text-left transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{p.name}</span>
                            <span className="text-[10px] font-mono font-black text-indigo-500 dark:text-indigo-400">{p.code}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-400">{p.productType}</span>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-[10px] font-bold text-slate-500">S/ {p.purchasePrice.toFixed(2)}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="lg:col-span-2">
                <label className="mb-2 px-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Cantidad
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="mb-2 px-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Precio Unit.
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">S/</span>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-bold text-slate-800 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-2 px-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Obs. Ítem
                </label>
                <input
                  type="text"
                  value={productNotes}
                  onChange={(e) => setProductNotes(e.target.value)}
                  placeholder="Lote..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="lg:col-span-1">
                <button
                  onClick={handleAddProduct}
                  className="flex h-[46px] w-full items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 hover:scale-105 active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Sección 3: Tabla de Ítems */}
          {purchaseDetails.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
                      <th className="px-6 py-4">Ítem / Código</th>
                      <th className="px-6 py-4 text-center">Cant.</th>
                      <th className="px-6 py-4 text-right">Unit.</th>
                      <th className="px-6 py-4 text-right">Subtotal</th>
                      <th className="px-6 py-4 text-center">Notas</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {purchaseDetails.map((detail, index) => (
                      <tr key={index} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-700 dark:text-slate-200">{detail.productName}</span>
                            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">{detail.productCode}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                            {detail.quantity} {detail.unitMeasure}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">
                          {currencyFormatter.format(detail.unitPrice)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-black text-slate-800 dark:text-slate-100">
                            {currencyFormatter.format(detail.subtotal)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="mx-auto max-w-[120px] truncate text-center text-[11px] text-slate-400">
                            {detail.notes || '—'}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleRemoveProduct(index)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sección 4: Pago y Totales */}
          {purchaseDetails.length > 0 && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="flex flex-col gap-6 rounded-3xl border border-slate-100 bg-slate-50/30 p-8 dark:border-slate-800 dark:bg-slate-800/20">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Liquidación de Pago
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Caja de Origen
                    </label>
                    <select
                      value={cashRegisterId}
                      onChange={(e) => setCashRegisterId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="">Selecciona caja</option>
                      {cashRegisters.map((cash: any) => (
                        <option key={cash.id} value={cash.id}>
                          {cash.name} (S/ {Number(cash.currentBalance || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Medio de Pago
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="CASH">Efectivo</option>
                      <option value="YAPE">Yape</option>
                      <option value="PLIN">Plin</option>
                      <option value="CARD">Tarjeta</option>
                      <option value="TRANSFER">Transferencia</option>
                      <option value="OTROS">Otros</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      N° Referencia / Operación
                    </label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="Ej: TRX-992288"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6 rounded-3xl bg-slate-900 p-8 text-white shadow-2xl dark:bg-slate-800/40">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Resumen de Costos
                </h3>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="text-sm font-medium text-slate-400">Subtotal</span>
                    <span className="text-lg font-bold text-slate-100">{currencyFormatter.format(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="text-sm font-medium text-slate-400">Impuestos (IGV {igvPercentage}%)</span>
                    <span className="text-lg font-bold text-slate-100">{currencyFormatter.format(igvAmount)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Total a Pagar</span>
                      <span className="text-3xl font-black text-white">{currencyFormatter.format(total)}</span>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setView('list');
                          resetForm();
                        }}
                        className="rounded-2xl border border-white/10 px-6 py-3 text-sm font-bold text-slate-300 transition-all hover:bg-white/5"
                      >
                        Descartar
                      </button>
                      <button
                        onClick={handleCreatePurchase}
                        disabled={isProcessing || creatingPurchase || purchaseDetails.length === 0}
                        className="flex min-w-[160px] items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white transition-all hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500"
                      >
                        {isProcessing || creatingPurchase ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            <span>Procesando...</span>
                          </>
                        ) : (
                          'Confirmar Compra'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


export default Purchase;

