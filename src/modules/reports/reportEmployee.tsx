import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_USER_SALES_REPORT, SEARCH_USERS } from '../../graphql/queries';
import ReportEmployeeList from './reportEmployeeList';
import { formatLocalDateYYYYMMDD } from '../../utils/localDateTime';

const SEARCH_DEBOUNCE_MS = 300;

export interface UserSaleOperation {
  id: string;
  order: string;
  operationDate: string;
  total: number;
  status: string;
  user: {
    id: string;
    fullName: string;
  };
}

export interface UserSalesSummary {
  totalOperations: number;
  grandTotal: number;
}

const currencyFormatter = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2
});

const ReportEmployee: React.FC = () => {
  const { companyData } = useAuth();
  const branchId = companyData?.branch?.id;

  const [startDate, setStartDate] = useState<string>(() => formatLocalDateYYYYMMDD());
  const [endDate, setEndDate] = useState<string>(() => formatLocalDateYYYYMMDD());
  const [userId, setUserId] = useState<string>('');
  const [selectedUserLabel, setSelectedUserLabel] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: searchData } = useQuery(SEARCH_USERS, {
    variables: { branchId: branchId!, query: debouncedQuery },
    skip: !branchId || debouncedQuery.length < 2,
    fetchPolicy: 'network-only'
  });

  const searchResults: Array<{ id: string; fullName: string; role?: string; dni?: string }> = searchData?.searchUsers ?? [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (u: { id: string; fullName: string; role?: string }) => {
    setUserId(u.id);
    setSelectedUserLabel(`${u.fullName}${u.role ? ` (${u.role})` : ''}`);
    setSearchInput('');
    setShowUserDropdown(false);
  };

  const handleClearUser = () => {
    setUserId('');
    setSelectedUserLabel('');
    setSearchInput('');
  };

  const { data, loading, error, refetch } = useQuery(GET_USER_SALES_REPORT, {
    variables: {
      branchId: branchId!,
      userId: userId || '',
      startDate,
      endDate
    },
    skip: !branchId || !userId || !startDate || !endDate,
    fetchPolicy: 'network-only'
  });

  const operations: UserSaleOperation[] = data?.userSalesReport?.operations ?? [];
  const summary: UserSalesSummary | null = data?.userSalesReport?.summary ?? null;

  const averageSale = useMemo(() => {
    if (!summary || summary.totalOperations === 0) return 0;
    return summary.grandTotal / summary.totalOperations;
  }, [summary]);

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
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-amber-500 text-white shadow-lg shadow-amber-200 dark:shadow-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                        Reporte de Empleados
                    </h1>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 sm:text-sm">
                        Análisis de rendimiento y ventas por colaborador
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
                <div className="relative flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800" ref={userDropdownRef}>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seleccionar Empleado</label>
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            placeholder="Buscar por nombre o DNI..."
                            value={userId ? selectedUserLabel : searchInput}
                            readOnly={!!userId}
                            onChange={(e) => {
                                setSearchInput(e.target.value);
                                setShowUserDropdown(true);
                            }}
                            onFocus={() => debouncedQuery.length >= 2 && setShowUserDropdown(true)}
                            className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200 cursor-pointer placeholder:text-slate-300"
                        />
                        {userId && (
                            <button onClick={handleClearUser} className="text-slate-400 hover:text-rose-500 ml-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Modern User Picker Dropdown */}
                    {showUserDropdown && debouncedQuery.length >= 2 && !userId && (
                        <div className="absolute left-0 right-0 top-full z-50 mt-4 max-h-72 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900 custom-scrollbar">
                            {searchResults.length === 0 ? (
                                <div className="px-4 py-3 text-xs font-bold text-slate-400">Sin coincidencias</div>
                            ) : (
                                searchResults.map((u) => (
                                    <div
                                        key={u.id}
                                        onClick={() => handleSelectUser(u)}
                                        className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                    >
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 text-[10px] font-black dark:bg-amber-900/20">
                                            {u.fullName.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{u.fullName}</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{u.role || 'Empleado'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

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

                <div className="flex items-center p-2">
                    <button
                        onClick={handleSearch}
                        disabled={loading || !userId}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-amber-200 transition-all hover:bg-amber-600 hover:shadow-amber-300 disabled:opacity-50 dark:shadow-none"
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
                <div className="relative overflow-hidden rounded-[32px] bg-amber-500 p-6 text-white shadow-lg shadow-amber-200 dark:shadow-none">
                    <div className="relative z-10">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Recaudación Personal</span>
                        <div className="mt-1 text-3xl font-black">{currencyFormatter.format(summary.grandTotal)}</div>
                    </div>
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                </div>

                <div className="relative overflow-hidden rounded-[32px] bg-slate-800 p-6 text-white shadow-lg shadow-slate-200 dark:shadow-none">
                    <div className="relative z-10">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Órdenes Gestionadas</span>
                        <div className="mt-1 text-3xl font-black">{summary.totalOperations}</div>
                    </div>
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                </div>

                <div className="flex flex-col justify-center gap-1 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900 sm:col-span-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ticket Promedio</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-amber-600">{currencyFormatter.format(averageSale)}</span>
                    </div>
                </div>

                <div className="flex flex-col justify-center gap-1 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900 sm:col-span-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado de Cuenta</span>
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Activo y Operando</span>
                    </div>
                </div>
            </div>
        )}

        {/* Results List Container */}
        <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-50 p-6 dark:border-slate-800/50">
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Desglose de Operaciones</h2>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800">
                    {operations.length} Órdenes encontradas
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
                    <ReportEmployeeList
                        operations={operations}
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

export default ReportEmployee;