import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_CATEGORY_SALES_REPORT, GET_CATEGORIES_BY_BRANCH } from '../../graphql/queries';
import ReportCategorySalesList from './reportCategorySalesList';
import type { CategorySalesGroup, CategorySalesSummary } from './reportCategorySalesList';
import { formatLocalDateYYYYMMDD } from '../../utils/localDateTime';

function mapReport(
  raw: Record<string, unknown> | null | undefined
): { categories: CategorySalesGroup[]; summary: CategorySalesSummary | null } {
  if (!raw) return { categories: [], summary: null };
  const categoriesRaw = (raw.categories as Record<string, unknown>[]) ?? [];
  const categories: CategorySalesGroup[] = categoriesRaw.map((c) => ({
    categoryId: String(c.categoryId ?? (c as { category_id?: string }).category_id ?? ''),
    categoryName: String(c.categoryName ?? (c as { category_name?: string }).category_name ?? ''),
    categoryOrder: Number(c.categoryOrder ?? (c as { category_order?: number }).category_order ?? 0),
    totalQuantity: Number(c.totalQuantity ?? (c as { total_quantity?: number }).total_quantity ?? 0),
    totalAmount: Number(c.totalAmount ?? (c as { total_amount?: unknown }).total_amount ?? 0),
    products: ((c.products as Record<string, unknown>[]) ?? []).map((p) => ({
      productId: String(p.productId ?? (p as { product_id?: string }).product_id ?? ''),
      code: String(p.code ?? ''),
      name: String(p.name ?? ''),
      totalQuantity: Number(p.totalQuantity ?? (p as { total_quantity?: number }).total_quantity ?? 0),
      totalAmount: Number(p.totalAmount ?? (p as { total_amount?: unknown }).total_amount ?? 0),
    })),
  }));
  const s = (raw.summary as Record<string, unknown>) ?? (raw as { summary?: Record<string, unknown> }).summary;
  const summary: CategorySalesSummary | null = s
    ? {
        grandTotalQuantity: Number(
          s.grandTotalQuantity ?? (s as { grand_total_quantity?: number }).grand_total_quantity ?? 0
        ),
        grandTotalAmount: Number(s.grandTotalAmount ?? (s as { grand_total_amount?: unknown }).grand_total_amount ?? 0),
      }
    : null;
  return { categories, summary };
}

const currencyFormatter = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
});

const ReportCategorySales: React.FC = () => {
  const { companyData } = useAuth();
  const branchId = companyData?.branch?.id;

  const [startDate, setStartDate] = useState<string>(() => formatLocalDateYYYYMMDD());
  const [endDate, setEndDate] = useState<string>(() => formatLocalDateYYYYMMDD());
  const [categoryId, setCategoryId] = useState<string>('');

  const { data: categoriesMeta } = useQuery(GET_CATEGORIES_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'cache-first',
  });

  const categoryOptions = useMemo(() => {
    const list = categoriesMeta?.categoriesByBranch ?? [];
    return list.filter((c: { isActive?: boolean }) => c.isActive !== false);
  }, [categoriesMeta?.categoriesByBranch]);

  const { data, loading, error, refetch } = useQuery(GET_CATEGORY_SALES_REPORT, {
    variables: {
      branchId: branchId!,
      startDate,
      endDate,
      categoryId: categoryId || null,
    },
    skip: !branchId || !startDate || !endDate,
    fetchPolicy: 'network-only',
  });

  const root =
    (data as { categorySalesReport?: Record<string, unknown>; category_sales_report?: Record<string, unknown> } | undefined)
      ?.categorySalesReport ??
    (data as { category_sales_report?: Record<string, unknown> } | undefined)?.category_sales_report;
  
  const { categories, summary } = mapReport(root);

  // Top Category calculation
  const topCategory = useMemo(() => {
    if (!categories.length) return null;
    return [...categories].sort((a, b) => b.totalAmount - a.totalAmount)[0];
  }, [categories]);

  const handleSearch = () => {
    refetch();
  };

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
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                        Ventas por Categoría
                    </h1>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 sm:text-sm">
                        Distribución estratégica de ingresos por grupos de menú
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

                <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Categoría</label>
                    <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200 cursor-pointer"
                    >
                        <option value="">Todas las categorías</option>
                        {categoryOptions.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center p-2">
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 disabled:opacity-50 dark:shadow-none"
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
                <div className="relative overflow-hidden rounded-[32px] bg-indigo-600 p-6 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                    <div className="relative z-10">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Recaudación Total</span>
                        <div className="mt-1 text-3xl font-black">{currencyFormatter.format(summary.grandTotalAmount)}</div>
                    </div>
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                </div>

                <div className="relative overflow-hidden rounded-[32px] bg-slate-800 p-6 text-white shadow-lg shadow-slate-200 dark:shadow-none">
                    <div className="relative z-10">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Ítems Facturados</span>
                        <div className="mt-1 text-3xl font-black">{summary.grandTotalQuantity}</div>
                    </div>
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                </div>

                {topCategory && (
                    <div className="col-span-1 flex flex-col justify-center gap-1 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900 sm:col-span-2">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/20">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Categoría Líder</span>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-xl font-black text-slate-800 dark:text-slate-100 truncate max-w-[200px]">{topCategory.categoryName}</span>
                                    <span className="text-lg font-black text-indigo-600">{currencyFormatter.format(topCategory.totalAmount)}</span>
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
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Desglose por Categoría</h2>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800">
                    {categories.length} Grupos detectados
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
                    <ReportCategorySalesList
                        categories={categories}
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

export default ReportCategorySales;
