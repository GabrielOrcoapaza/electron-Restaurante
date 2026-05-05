import React, { useState } from 'react';
import { ApolloError } from '@apollo/client';

export interface CategorySalesGroup {
  categoryId: string;
  categoryName: string;
  categoryOrder: number;
  totalQuantity: number;
  totalAmount: number;
  products: Array<{
    productId: string;
    code: string;
    name: string;
    totalQuantity: number;
    totalAmount: number;
  }>;
}

export interface CategorySalesSummary {
  grandTotalQuantity: number;
  grandTotalAmount: number;
}

interface ReportCategorySalesListProps {
  categories: CategorySalesGroup[];
  summary: CategorySalesSummary | null;
  loading: boolean;
  error?: ApolloError;
}

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
});

const ReportCategorySalesList: React.FC<ReportCategorySalesListProps> = ({
  categories,
  summary,
  loading,
  error,
}) => {
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  if (loading) return null; // Handled by parent skeleton

  if (error) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-900/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Error en el reporte</h3>
            <p className="max-w-xs text-sm font-bold text-slate-400">{error.message}</p>
        </div>
    );
  }

  if (!categories.length) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300 dark:bg-slate-800/50 dark:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Sin datos</h3>
            <p className="max-w-xs text-sm font-bold text-slate-400">No se encontraron ventas para las categorías seleccionadas.</p>
        </div>
    );
  }

  const grandTotal = summary?.grandTotalAmount || 1;

  return (
    <div className="grid grid-cols-1 gap-4">
      {categories.map((group, index) => {
        const share = (group.totalAmount / grandTotal) * 100;
        const isExpanded = expandedCategoryId === group.categoryId;

        return (
            <div 
                key={`${group.categoryId}-${index}`}
                className="group relative overflow-hidden rounded-[24px] border border-slate-100 bg-white transition-all hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/5 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-indigo-900/30"
            >
                <div 
                    onClick={() => setExpandedCategoryId(isExpanded ? null : group.categoryId)}
                    className="flex cursor-pointer flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                            <span className="text-lg font-black">{group.categoryName.charAt(0)}</span>
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                                {group.categoryName}
                            </h3>
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400">
                                <span>{group.totalQuantity} ITEMS VENDIDOS</span>
                                <span className="text-slate-200 dark:text-slate-800">|</span>
                                <span className="text-indigo-500">{Math.round(share)}% DEL TOTAL</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 justify-between sm:justify-end">
                        <div className="text-right">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Recaudado</div>
                            <div className="text-xl font-black text-slate-800 dark:text-slate-100">
                                {currencyFormatter.format(group.totalAmount)}
                            </div>
                        </div>
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 transition-all dark:border-slate-800 ${isExpanded ? 'rotate-180 bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Market Share Bar */}
                <div className="h-1.5 w-full bg-slate-50 dark:bg-slate-800">
                    <div 
                        className="h-full bg-indigo-600 transition-all duration-1000" 
                        style={{ width: `${share}%` }}
                    />
                </div>

                {/* Expanded Products List */}
                {isExpanded && (
                    <div className="bg-slate-50/50 p-5 dark:bg-slate-800/30">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Desglose de Productos</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {group.products.map((p) => (
                                <div key={p.productId} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter">{p.code}</span>
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{p.name}</span>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <div className="text-[10px] font-black text-slate-400">{p.totalQuantity} und</div>
                                            <div className="text-sm font-black text-slate-800 dark:text-slate-100">{currencyFormatter.format(p.totalAmount)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
      })}

      <div className="mt-4 text-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
            Total categorías analizadas: {categories.length}
        </span>
      </div>
    </div>
  );
};

export default ReportCategorySalesList;
