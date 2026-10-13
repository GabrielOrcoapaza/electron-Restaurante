/**
 * HTML A4 de la hoja de liquidación manual de un cierre de caja.
 */

export interface CashClosureSheetStaffRowData {
    id?: string;
    rowNumber: number;
    position?: string;
    staffName?: string;
    shiftTime?: string;
    payments?: number;
    purchaseExpense?: string;
    total?: number;
    user?: { id: string; fullName: string } | null;
}

export interface CashClosureSheetViewData {
    id?: string;
    sheetDate?: string | null;
    cashierName?: string;
    cardSales?: number;
    cashSales?: number;
    yapeSales?: number;
    totalSales?: number;
    totalExpenses?: number;
    netSales?: number;
    paymentsTotal?: number;
    purchaseExpensesTotal?: number;
    observations?: string;
    staffRows?: CashClosureSheetStaffRowData[];
}

export type CashClosureSheetPdfData = CashClosureSheetViewData & {
    closureNumber: number;
    registerName: string;
};

const currency = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
});

const money = (value: unknown) => {
    const amount = Number(value);
    return currency.format(Number.isFinite(amount) ? amount : 0);
};

const escapeHtml = (value: unknown) =>
    String(value ?? "").replace(
        /[&<>"']/g,
        (c) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[c] as string,
    );

const formatSheetDate = (value?: string | null): string => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("es-PE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
};

const displayStaffName = (row: CashClosureSheetStaffRowData): string =>
    row.user?.fullName?.trim() || row.staffName?.trim() || "—";

const hasStaffRowContent = (row: CashClosureSheetStaffRowData): boolean =>
    Boolean(
        row.position?.trim() ||
            row.staffName?.trim() ||
            row.user?.fullName?.trim() ||
            row.shiftTime?.trim() ||
            row.purchaseExpense?.trim() ||
            Number(row.payments) > 0 ||
            Number(row.total) > 0,
    );

function staffRowsForSheet(sheet: CashClosureSheetViewData) {
    const staffRows = [...(sheet.staffRows ?? [])].sort(
        (a, b) => a.rowNumber - b.rowNumber,
    );
    const visible = staffRows.filter(hasStaffRowContent);
    return visible.length > 0 ? visible : staffRows;
}

export function buildCashClosureSheetFilename(closureNumber: number): string {
    return `hoja_cierre_${closureNumber}.pdf`;
}

export function buildCashClosureSheetHtml(data: CashClosureSheetPdfData): string {
    const { closureNumber, registerName, ...sheet } = data;

    const rows = staffRowsForSheet(sheet);

    const staffPaymentsRows = rows
        .map(
            (row) => `
        <tr>
            <td class="num-center">${row.rowNumber}</td>
            <td>${escapeHtml(row.position?.trim() || "—")}</td>
            <td>${escapeHtml(displayStaffName(row))}</td>
            <td>${escapeHtml(row.shiftTime?.trim() || "—")}</td>
            <td class="num">${money(row.payments)}</td>
        </tr>
    `,
        )
        .join("");

    const staffExpenseRows = rows
        .map(
            (row) => `
        <tr>
            <td class="num-center">${row.rowNumber}</td>
            <td>${escapeHtml(row.purchaseExpense?.trim() || "—")}</td>
            <td class="num">${money(row.total)}</td>
        </tr>
    `,
        )
        .join("");

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Hoja de cierre #${closureNumber}</title>
<style>
    * { box-sizing: border-box; }
    body {
        font-family: -apple-system, Segoe UI, Arial, sans-serif;
        color: #1e293b;
        margin: 0;
        padding: 24px 32px;
        font-size: 12px;
    }
    h1 { font-size: 18px; text-align: center; margin: 0 0 4px; }
    .subtitle { text-align: center; color: #64748b; margin: 0 0 20px; font-size: 13px; }
    .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 20px;
    }
    .meta-box {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 14px;
    }
    .meta-label {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #94a3b8;
        margin-bottom: 4px;
    }
    .meta-value { font-weight: 700; font-size: 13px; }
    .tables-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 20px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 800; text-transform: uppercase; font-size: 10px; }
    .num { text-align: right; white-space: nowrap; }
    .num-center { text-align: center; font-weight: 700; }
    tr.total td { background: #f8fafc; font-weight: 800; }
    .totals-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 20px;
    }
    .totals-box {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 14px;
    }
    .totals-box h3 {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #94a3b8;
        margin: 0 0 10px;
    }
    .row-line {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 4px 0;
        font-size: 12px;
    }
    .row-line span:last-child { font-weight: 800; }
    .observations {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 14px;
    }
    .observations h3 {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #94a3b8;
        margin: 0 0 8px;
    }
    .observations p {
        margin: 0;
        white-space: pre-wrap;
        line-height: 1.5;
    }
    @media print {
        body { padding: 8mm 10mm; }
        @page { size: A4; margin: 10mm; }
    }
</style>
</head>
<body>
    <h1>Hoja de cierre #${closureNumber}</h1>
    <p class="subtitle">${escapeHtml(registerName)}</p>

    <div class="meta-grid">
        <div class="meta-box">
            <div class="meta-label">Fecha</div>
            <div class="meta-value">${escapeHtml(formatSheetDate(sheet.sheetDate))}</div>
        </div>
        <div class="meta-box">
            <div class="meta-label">Caja</div>
            <div class="meta-value">${escapeHtml(sheet.cashierName?.trim() || "—")}</div>
        </div>
    </div>

    <div class="tables-grid">
        <div>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Cargo</th>
                        <th>Nombre</th>
                        <th>Hora</th>
                        <th>Pagos</th>
                    </tr>
                </thead>
                <tbody>
                    ${staffPaymentsRows || `<tr><td colspan="5">Sin filas registradas</td></tr>`}
                    <tr class="total">
                        <td colspan="4" style="text-align:right;text-transform:uppercase;">Pagos total</td>
                        <td class="num">${money(sheet.paymentsTotal)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Gasto en compras</th>
                        <th>Total S/</th>
                    </tr>
                </thead>
                <tbody>
                    ${staffExpenseRows || `<tr><td colspan="3">Sin filas registradas</td></tr>`}
                    <tr class="total">
                        <td style="text-align:right;text-transform:uppercase;">Gastos total</td>
                        <td colspan="2" class="num">${money(sheet.purchaseExpensesTotal)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <div class="totals-grid">
        <div class="totals-box">
            <h3>Ventas por método</h3>
            <div class="row-line"><span>Venta Visa</span><span>${money(sheet.cardSales)}</span></div>
            <div class="row-line"><span>Venta Yape</span><span>${money(sheet.yapeSales)}</span></div>
            <div class="row-line"><span>Venta Efectivo</span><span>${money(sheet.cashSales)}</span></div>
        </div>
        <div class="totals-box">
            <h3>Totales</h3>
            <div class="row-line"><span>Total venta</span><span>${money(sheet.totalSales)}</span></div>
            <div class="row-line"><span>Total de gastos</span><span>${money(sheet.totalExpenses)}</span></div>
            <div class="row-line"><span>Venta neta</span><span>${money(sheet.netSales)}</span></div>
        </div>
    </div>

    <div class="observations">
        <h3>Observaciones</h3>
        <p>${escapeHtml(sheet.observations?.trim() || "—")}</p>
    </div>
</body>
</html>`;
}
