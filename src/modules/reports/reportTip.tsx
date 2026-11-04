import React, { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import {
    GET_PAYMENTS_BY_DATE_RANGE,
    GET_USERS_BY_BRANCH,
    GET_WAITER_TIPS_SUMMARY,
} from "../../graphql/queries";
import ReportTipList from "./reportTipList";
import {
    formatLocalDateYYYYMMDD,
    toLocalRangeEndISO,
    toLocalRangeStartISO,
} from "../../utils/localDateTime";
import ReportExportExcelButton from "../../components/ReportExportExcelButton";
import { useToast } from "../../context/ToastContext";
import { downloadTipsReport } from "./reportExcelExports";

export interface WaiterTipsMethodSummary {
    methodCode: string;
    methodName: string;
    totalAmount: number;
    count: number;
}

export interface WaiterTipsSummaryRow {
    waiterId: string;
    waiterName: string;
    totalAmount: number;
    tipCount: number;
    methods: WaiterTipsMethodSummary[];
}

export interface TipPayment {
    id: string;
    paymentDate: string;
    paidAmount: number;
    paymentMethod: string;
    paymentPurpose?: string | null;
    status: string;
    isActive?: boolean;
    user?: { id: string; fullName: string } | null;
    tipWaiter?: { id: string; fullName: string } | null;
    operation?: {
        id: string;
        order?: string | number | null;
        operationType?: string | null;
    } | null;
    issuedDocument?: {
        id: string;
        serial: string;
        number: string | number;
    } | null;
    cashRegister?: { id: string; name: string } | null;
}

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

const roundMoney2 = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const isCancelledPayment = (status?: string | null): boolean => {
    const normalized = (status ?? "").trim().toUpperCase();
    return (
        normalized === "CANCELLED" ||
        normalized === "CANCELED" ||
        normalized === "ANULLED" ||
        normalized === "VOID"
    );
};

const isTipPayment = (payment: TipPayment): boolean =>
    (payment.paymentPurpose || "").trim().toUpperCase() === "TIP";

const ReportTip: React.FC = () => {
    const { companyData } = useAuth();
    const { showToast } = useToast();
    const branchId = companyData?.branch?.id;
    const tipsEnabled = Boolean(companyData?.branch?.tipsEnabled);

    const [startDate, setStartDate] = useState<string>(() =>
        formatLocalDateYYYYMMDD(),
    );
    const [endDate, setEndDate] = useState<string>(() =>
        formatLocalDateYYYYMMDD(),
    );
    const [waiterId, setWaiterId] = useState<string>("");

    const rangeStart = toLocalRangeStartISO(startDate);
    const rangeEnd = toLocalRangeEndISO(endDate);

    const { data: usersData } = useQuery(GET_USERS_BY_BRANCH, {
        variables: { branchId: branchId! },
        skip: !branchId,
    });

    const waiters = useMemo(() => {
        const users = usersData?.usersByBranch || [];
        return users.filter(
            (u: { role?: string; isActive?: boolean }) =>
                u.isActive !== false &&
                (u.role || "").toUpperCase() === "WAITER",
        );
    }, [usersData]);

    const {
        data: summaryData,
        loading: loadingSummary,
        error: summaryError,
        refetch: refetchSummary,
    } = useQuery(GET_WAITER_TIPS_SUMMARY, {
        variables: {
            branchId: branchId!,
            startDate: rangeStart,
            endDate: rangeEnd,
            waiterId: waiterId || null,
        },
        skip: !branchId || !startDate || !endDate,
        fetchPolicy: "network-only",
    });

    const {
        data: paymentsData,
        loading: loadingPayments,
        error: paymentsError,
        refetch: refetchPayments,
    } = useQuery(GET_PAYMENTS_BY_DATE_RANGE, {
        variables: {
            branchId: branchId!,
            startDate: rangeStart,
            endDate: rangeEnd,
        },
        skip: !branchId || !startDate || !endDate,
        fetchPolicy: "network-only",
    });

    const summaryRows: WaiterTipsSummaryRow[] =
        summaryData?.waiterTipsSummary ?? [];

    const tipPayments = useMemo(() => {
        const rows = (paymentsData?.paymentsByDateRange || []) as TipPayment[];
        return rows
            .filter(
                (p) =>
                    isTipPayment(p) &&
                    (p.status || "").toUpperCase() === "PAID" &&
                    p.isActive !== false &&
                    !isCancelledPayment(p.status),
            )
            .filter((p) => {
                if (!waiterId) return true;
                const beneficiary =
                    p.tipWaiter?.id || p.user?.id || "";
                return String(beneficiary) === String(waiterId);
            })
            .sort(
                (a, b) =>
                    new Date(b.paymentDate).getTime() -
                    new Date(a.paymentDate).getTime(),
            );
    }, [paymentsData, waiterId]);

    const totals = useMemo(() => {
        const totalAmount = roundMoney2(
            tipPayments.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0),
        );
        return {
            totalAmount,
            totalCount: tipPayments.length,
            waiterCount: summaryRows.length,
        };
    }, [tipPayments, summaryRows.length]);

    const loading = loadingSummary || loadingPayments;
    const error = summaryError || paymentsError;

    const refetch = () => {
        void refetchSummary();
        void refetchPayments();
    };

    const selectedWaiterName = waiterId
        ? waiters.find((w: { id: string }) => w.id === waiterId)?.fullName
        : undefined;

    const handleExportExcel = async () => {
        if (!tipPayments.length && !summaryRows.length) {
            showToast("No hay propinas para exportar en este periodo.", "warning");
            return;
        }
        try {
            const result = await downloadTipsReport(
                summaryRows,
                tipPayments,
                totals,
                { startDate, endDate },
                selectedWaiterName,
            );
            showToast(result.message || "Reporte descargado en Excel.", "success");
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "No se pudo exportar el reporte.";
            showToast(message, "error");
        }
    };

    if (!branchId) {
        return (
            <div className="flex min-h-[400px] items-center justify-center rounded-[32px] bg-white p-8 shadow-sm dark:bg-slate-900">
                <div className="text-center font-bold text-rose-500">
                    No se encontró información de la sucursal activa.
                </div>
            </div>
        );
    }

    if (!tipsEnabled) {
        return (
            <div className="flex min-h-[400px] items-center justify-center rounded-[32px] bg-white p-8 shadow-sm dark:bg-slate-900">
                <div className="max-w-md text-center">
                    <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Propinas desactivadas
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                        Active las propinas en Configuración → Sede para usar
                        este reporte.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-amber-500 text-white shadow-lg shadow-amber-200 dark:shadow-none">
                        <span className="text-2xl">🪙</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                            Reporte de propinas
                        </h1>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 sm:text-sm">
                            Propinas registradas por mozo y método de pago
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <ReportExportExcelButton
                        onClick={handleExportExcel}
                        disabled={
                            loading ||
                            (tipPayments.length === 0 &&
                                summaryRows.length === 0)
                        }
                    />
                    <button
                        type="button"
                        onClick={() => refetch()}
                        disabled={loading}
                        className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm transition-all hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        {loading ? "Actualizando…" : "Refrescar"}
                    </button>
                </div>
            </div>

            <div className="rounded-[28px] border border-slate-100 bg-white p-2 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Mozo
                        </label>
                        <select
                            value={waiterId}
                            onChange={(e) => setWaiterId(e.target.value)}
                            className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-900 outline-none dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100 dark:[color-scheme:light]"
                        >
                            <option value="" className="bg-white text-slate-900">
                                Todos los mozos
                            </option>
                            {waiters.map((w: { id: string; fullName: string }) => (
                                <option
                                    key={w.id}
                                    value={w.id}
                                    className="bg-white text-slate-900"
                                >
                                    {w.fullName}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Desde
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="report-date-field w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                        />
                    </div>
                    <div className="flex flex-col justify-center px-6 py-3 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Hasta
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            min={startDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="report-date-field w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                        />
                    </div>
                    <div className="flex items-center p-2">
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={loading}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-amber-200 transition-all hover:bg-amber-600 disabled:opacity-50 dark:shadow-none"
                        >
                            Filtrar reporte
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-[28px] bg-amber-500 p-6 text-white shadow-lg shadow-amber-200 dark:shadow-none">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-100">
                        Total propinas
                    </p>
                    <p className="mt-2 text-3xl font-black">
                        {currencyFormatter.format(totals.totalAmount)}
                    </p>
                </div>
                <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Movimientos
                    </p>
                    <p className="mt-2 text-3xl font-black text-slate-800 dark:text-slate-100">
                        {totals.totalCount}
                    </p>
                </div>
                <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Mozos con propina
                    </p>
                    <p className="mt-2 text-3xl font-black text-slate-800 dark:text-slate-100">
                        {totals.waiterCount}
                    </p>
                </div>
            </div>

            <ReportTipList
                summaryRows={summaryRows}
                payments={tipPayments}
                loading={loading}
                error={error}
            />
        </div>
    );
};

export default ReportTip;
