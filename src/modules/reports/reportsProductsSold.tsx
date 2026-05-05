import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_SOLD_PRODUCTS_REPORT, GET_PRODUCTS_BY_BRANCH } from '../../graphql/queries';
import ReportsProductsSoldList from './reportsProductsSoldList';
import { formatLocalDateYYYYMMDD } from '../../utils/localDateTime';

export interface SoldProductItem {
  code: string;
  name: string;
  totalQuantity: number;
  avgUnitPrice: number;
  totalAmount: number;
}

export interface SoldProductsSummary {
  totalItemsSold: number;
  grandTotal: number;
}

const currencyFormatter = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2
});

const ReportsProductsSold: React.FC = () => {
  const { companyData } = useAuth();
  const branchId = companyData?.branch?.id;

  const [startDate, setStartDate] = useState<string>(() => formatLocalDateYYYYMMDD());
  const [endDate, setEndDate] = useState<string>(() => formatLocalDateYYYYMMDD());
  const [productId, setProductId] = useState<string>('');
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const productPickerRef = useRef<HTMLDivElement>(null);

  const { data: productsData } = useQuery(GET_PRODUCTS_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only'
  });

  const products = productsData?.productsByBranch ?? [];
  
  const activeProducts = useMemo(() => 
    products.filter((p: any) => ['DISH', 'BEVERAGE'].includes(p.productType) && p.isActive),
    [products]
  );

  const selectedReportProduct = useMemo(
    () => activeProducts.find((p: any) => p.id === productId) ?? null,
    [activeProducts, productId]
  );

  const filteredReportProducts = useMemo(() => {
    const q = productSearchTerm.toLowerCase().trim();
    if (!q) return [];
    return activeProducts
      .filter(
        (p: any) =>
          p.name?.toLowerCase().includes(q) ||
          p.code?.toLowerCase().includes(q) ||
          Boolean(p.description && p.description.toLowerCase().includes(q))
      )
      .slice(0, 80);
  }, [activeProducts, productSearchTerm]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (productPickerRef.current && !productPickerRef.current.contains(e.target as Node)) {
        setProductPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const clearProductFilter = () => {
    setProductId('');
    setProductSearchTerm('');
    setProductPickerOpen(false);
  };

  const { data, loading, error, refetch } = useQuery(GET_SOLD_PRODUCTS_REPORT, {
    variables: {
      branchId: branchId!,
      startDate,
      endDate,
      productId: productId || null
    },
    skip: !branchId || !startDate || !endDate,
    fetchPolicy: 'network-only'
  });

  const productsList: SoldProductItem[] = data?.soldProductsReport?.products ?? [];
  const summary: SoldProductsSummary | null = data?.soldProductsReport?.summary ?? null;

  const handleSearch = () => {
    refetch();
  };

  // Real-time Top Product calculation
  const topProduct = useMemo(() => {
    if (!productsList.length) return null;
    return [...productsList].sort((a, b) => b.totalQuantity - a.totalQuantity)[0];
  }, [productsList]);

  if (!branchId) {
    return (
        <div className="flex min-h-[400px] items-center justify-center rounded-[32px] bg-white p-8 shadow-sm dark:bg-slate-900">
            <div className="text-center text-rose-500 font-bold">
                No se encontró información de la sucursal activa.
            </div>
        </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                        Productos Vendidos
                    </h1>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 sm:text-sm">
                        Análisis de rendimiento y popularidad del menú
                    </p>
                </div>
            </div>
            <button
                onClick={() => refetch()}
                disabled={loading}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm transition-all hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {loading ? "Actualizando" : "Refrescar"}
            </button>
        </div>

        {/* Unified Filter Toolbar */}
        <div className="rounded-[28px] border border-slate-100 bg-white p-2 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
                <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Desde</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                    />
                </div>

                <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hasta</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                    />
                </div>

                <div className="relative flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800" ref={productPickerRef}>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrar Producto</label>
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            placeholder="Buscar plato o bebida..."
                            value={selectedReportProduct ? `${selectedReportProduct.code} - ${selectedReportProduct.name}` : productSearchTerm}
                            readOnly={!!selectedReportProduct}
                            onChange={(e) => {
                                setProductSearchTerm(e.target.value);
                                setProductPickerOpen(true);
                            }}
                            onFocus={() => setProductPickerOpen(true)}
                            className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200 cursor-pointer placeholder:text-slate-300"
                        />
                        {selectedReportProduct && (
                            <button onClick={clearProductFilter} className="text-slate-400 hover:text-rose-500 ml-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Modern Product Picker Dropdown */}
                    {productPickerOpen && !selectedReportProduct && (
                        <div className="absolute left-0 right-0 top-full z-50 mt-4 max-h-72 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900 custom-scrollbar">
                            <button
                                onClick={clearProductFilter}
                                className="w-full rounded-xl px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                            >
                                • Mostrar Todos
                            </button>
                            {filteredReportProducts.length === 0 && productSearchTerm ? (
                                <div className="px-4 py-3 text-xs font-bold text-slate-400">Sin coincidencias</div>
                            ) : (
                                filteredReportProducts.map((p: any) => (
                                    <div
                                        key={p.id}
                                        onClick={() => {
                                            setProductId(p.id);
                                            setProductSearchTerm('');
                                            setProductPickerOpen(false);
                                        }}
                                        className="flex cursor-pointer flex-col rounded-xl px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                    >
                                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter">{p.code}</span>
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{p.name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center p-2">
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-600 hover:shadow-emerald-300 disabled:opacity-50 dark:shadow-none"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Filtrar Reporte
                    </button>
                </div>
            </div>
        </div>

        {/* Summary Cards */}
        {summary && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative overflow-hidden rounded-[32px] bg-emerald-500 p-6 text-white shadow-lg shadow-emerald-200 dark:shadow-none">
                    <div className="relative z-10">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Unidades Vendidas</span>
                        <div className="mt-1 text-3xl font-black">{summary.totalItemsSold}</div>
                    </div>
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                </div>

                <div className="relative overflow-hidden rounded-[32px] bg-slate-800 p-6 text-white shadow-lg shadow-slate-200 dark:shadow-none">
                    <div className="relative z-10">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Recaudación de Menú</span>
                        <div className="mt-1 text-3xl font-black">{currencyFormatter.format(summary.grandTotal)}</div>
                    </div>
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                </div>

                {topProduct && (
                    <div className="col-span-1 flex flex-col justify-center gap-1 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900 sm:col-span-2">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/20">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                </svg>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Producto Estrella</span>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-xl font-black text-slate-800 dark:text-slate-100 truncate max-w-[200px]">{topProduct.name}</span>
                                    <span className="text-lg font-black text-amber-500">{topProduct.totalQuantity} <small className="text-[10px] uppercase">und</small></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Results List Container */}
        <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-50 p-6 dark:border-slate-800/50">
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Rendimiento por Producto</h2>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800">
                    {productsList.length} Ítems analizados
                </span>
            </div>

            <div className="p-4 sm:p-6">
                {loading ? (
                    <div className="flex min-h-[300px] flex-col gap-4">
                        {Array(5).fill(0).map((_, i) => (
                            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/50" />
                        ))}
                    </div>
                ) : (
                    <ReportsProductsSoldList
                        products={productsList}
                        summary={summary}
                        loading={loading}
                        error={error}
                    />
                )}
            </div>
        </div>

        {error && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-600 dark:border-rose-900/30 dark:bg-rose-900/10">
                Error al cargar el reporte: {error.message}
            </div>
        )}
    </div>
  );
};

export default ReportsProductsSold;
