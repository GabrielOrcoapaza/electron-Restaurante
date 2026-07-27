import { getPaymentMethodLabel } from "./paymentMethodLabels";

export interface ExpenseReportPayment {
    id: string;
    paymentDate: string;
    paidAmount: number;
    paymentMethod: string;
    notes?: string | null;
    referenceNumber?: string | null;
    user?: { fullName?: string | null } | null;
}

export interface BuildExpenseReportPrintJsonParams {
    branchName: string;
    companyName?: string;
    companyRuc?: string;
    branchAddress?: string;
    startDate: string;
    endDate: string;
    generatedByName?: string;
    generatedByRole?: string;
    payments: ExpenseReportPayment[];
}

type ExpensePrintItem = {
    description: string;
    amount: number;
    time: string;
    reference: string;
    user: string;
};

type ExpensePrintMethodGroup = {
    name: string;
    total: number;
    items: ExpensePrintItem[];
};

function formatTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatPeriodLabel(startDate: string, endDate: string): string {
    const fmt = (d: string) => {
        const [y, m, day] = d.split("-");
        if (!y || !m || !day) return d;
        return `${day}/${m}/${y}`;
    };
    return startDate === endDate
        ? fmt(startDate)
        : `${fmt(startDate)} - ${fmt(endDate)}`;
}

export function buildExpenseReportPrintJson(
    params: BuildExpenseReportPrintJsonParams,
): Record<string, unknown> {
    const grouped: Record<string, ExpensePrintMethodGroup> = {};

    for (const payment of params.payments) {
        const code = (payment.paymentMethod || "OTROS").toUpperCase();
        if (!grouped[code]) {
            grouped[code] = {
                name: getPaymentMethodLabel(code),
                total: 0,
                items: [],
            };
        }
        const amount = Number(payment.paidAmount) || 0;
        grouped[code].total += amount;
        grouped[code].items.push({
            description: (payment.notes || "Egreso").slice(0, 60),
            amount,
            time: formatTime(payment.paymentDate),
            reference: payment.referenceNumber || "",
            user: payment.user?.fullName || "",
        });
    }

    const methodsSorted: Array<[string, ExpensePrintMethodGroup]> = [];
    if (grouped.CASH) methodsSorted.push(["CASH", grouped.CASH]);
    for (const [code, data] of Object.entries(grouped).sort(([a], [b]) =>
        a.localeCompare(b),
    )) {
        if (code !== "CASH") methodsSorted.push([code, data]);
    }

    const totalExpense = methodsSorted.reduce(
        (sum, [, data]) => sum + data.total,
        0,
    );

    return {
        type: "EXPENSES",
        logo_base64: null,
        branch: {
            name: params.branchName,
            company: params.companyName || "",
            ruc: params.companyRuc || "",
            address: params.branchAddress || "",
        },
        closure: {
            number: 0,
            closed_at: formatPeriodLabel(params.startDate, params.endDate),
        },
        user: {
            name: params.generatedByName || "Reporte",
            role: params.generatedByRole || "",
        },
        cash_register: {
            name: "Reporte de egresos",
        },
        expenses_by_method: methodsSorted,
        total_expense: totalExpense,
    };
}
