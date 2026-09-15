/**
 * Genera el HTML de "Reporte de cierre de caja" (formato A4, imprimible / exportable a PDF
 * desde el diálogo de impresión del sistema) y lo abre en una ventana nueva con .print().
 * Mismo patrón que openBrowserPrintDialog en issuedDocumentPrintWithPreview.ts, pero con
 * HTML propio (esto no es un ticket de comprobante, es un reporte multi-sección).
 */

export type CashClosureReportRow<T extends Record<string, unknown>> = T;

export type CashClosureDetailData = {
    closureId: string;
    closureNumber: number;
    companyName: string;
    companyRuc: string;
    branchName: string;
    branchAddress?: string | null;
    status: string;
    openedAt?: string | null;
    closedAt: string;
    reportDate: string;
    employeeName: string;
    cashRegisterName: string;
    openingAmount: number;
    totalIncome: number;
    totalExpense: number;
    netTotal: number;
    realCash: number;
    openings: { description: string; amount: number }[];
    expenses: { motive: string; amount: number }[];
    documentsByType: { documentName: string; count: number; total: number }[];
    documentsRange: { documentName: string; first: string; last: string }[];
    salesByMethod: {
        methodCode: string;
        methodName: string;
        count: number;
        total: number;
    }[];
    products: {
        productName: string;
        quantity: number;
        discount: number;
        total: number;
    }[];
    totals: {
        productsCount: number;
        productsValue: number;
        individualDiscountsValue: number;
        globalDiscountsValue: number;
    };
};

const currency = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
});

const money = (v: number) => currency.format(Number(v) || 0);

const formatDateTime = (iso?: string | null) => {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("es-PE", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    } catch {
        return "—";
    }
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

function section(title: string, tableHtml: string): string {
    return `
        <section class="block">
            <h3>${escapeHtml(title)}</h3>
            ${tableHtml}
        </section>
    `;
}

function table(
    headers: string[],
    rows: string[][],
    emptyLabel = "Sin registros",
): string {
    if (rows.length === 0) {
        return `<div class="empty">${escapeHtml(emptyLabel)}</div>`;
    }
    return `
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    ${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}
                </tr>
            </thead>
            <tbody>
                ${rows
                    .map(
                        (row, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        ${row.map((cell) => `<td>${cell}</td>`).join("")}
                    </tr>
                `,
                    )
                    .join("")}
            </tbody>
        </table>
    `;
}

export function buildCashClosureReportHtml(d: CashClosureDetailData): string {
    const openingsTable = table(
        ["Descripción", "Monto"],
        d.openings.map((o) => [
            escapeHtml(o.description),
            `<span class="num">${money(o.amount)}</span>`,
        ]),
        "Sin apertura registrada",
    );

    const expensesTable = table(
        ["Motivo", "Monto"],
        d.expenses.map((e) => [
            escapeHtml(e.motive),
            `<span class="num">${money(e.amount)}</span>`,
        ]),
        "Sin egresos",
    );

    const documentsTable = table(
        ["Documento", "Cant", "Total"],
        d.documentsByType.map((doc) => [
            escapeHtml(doc.documentName),
            `<span class="num">${doc.count}</span>`,
            `<span class="num">${money(doc.total)}</span>`,
        ]),
        "Sin documentos emitidos",
    );

    const rangeTable = table(
        ["Documento", "Primero", "Último"],
        d.documentsRange.map((r) => [
            escapeHtml(r.documentName),
            escapeHtml(r.first),
            escapeHtml(r.last),
        ]),
        "Sin documentos emitidos",
    );

    const salesByMethodRows = d.salesByMethod.map((m) => [
        escapeHtml(m.methodName),
        `<span class="num">${m.count}</span>`,
        `<span class="num">${money(m.total)}</span>`,
    ]);
    const totalCount = d.salesByMethod.reduce((a, m) => a + m.count, 0);
    const totalSales = d.salesByMethod.reduce((a, m) => a + m.total, 0);
    salesByMethodRows.push([
        "<strong>Total</strong>",
        `<span class="num"><strong>${totalCount}</strong></span>`,
        `<span class="num"><strong>${money(totalSales)}</strong></span>`,
    ]);
    const salesByMethodTable = table(
        ["Método de pago", "Cant", "Total"],
        salesByMethodRows,
        "Sin ventas",
    );

    const productsTable = table(
        ["Descripción", "Cant", "Desc", "Total"],
        d.products.map((p) => [
            escapeHtml(p.productName),
            `<span class="num">${p.quantity}</span>`,
            `<span class="num">${money(p.discount)}</span>`,
            `<span class="num">${money(p.total)}</span>`,
        ]),
        "Sin productos",
    );

    const totalsTable = `
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Total de productos</th>
                    <th>Valor total de productos</th>
                    <th>Valor total de descuentos individuales</th>
                    <th>Valor total de descuentos globales</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1</td>
                    <td><span class="num">${d.totals.productsCount}</span></td>
                    <td><span class="num">${money(d.totals.productsValue)}</span></td>
                    <td><span class="num">${money(d.totals.individualDiscountsValue)}</span></td>
                    <td><span class="num">${money(d.totals.globalDiscountsValue)}</span></td>
                </tr>
            </tbody>
        </table>
    `;

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Cierre de caja #${d.closureNumber}</title>
<style>
    * { box-sizing: border-box; }
    body {
        font-family: -apple-system, Segoe UI, Arial, sans-serif;
        color: #1e293b;
        margin: 0;
        padding: 24px 32px;
        font-size: 12px;
    }
    h1 { font-size: 18px; text-align: center; margin: 0 0 16px; }
    h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; margin: 18px 0 6px; color: #334155; }
    .header-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        border-bottom: 3px solid #f59e0b;
        padding-bottom: 14px;
        margin-bottom: 6px;
    }
    .header-grid div { line-height: 1.6; }
    .header-grid b { display: block; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    th, td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 700; }
    .num { display: block; text-align: right; }
    .empty { font-style: italic; color: #94a3b8; padding: 6px 2px; }
    .block { break-inside: avoid; }
    @media print {
        body { padding: 8mm 10mm; }
        @page { size: A4; margin: 10mm; }
    }
</style>
</head>
<body>
    <h1>Reporte de cierre de caja</h1>
    <div class="header-grid">
        <div>
            <b>Empresa:</b> ${escapeHtml(d.companyName)}
            <b>RUC:</b> ${escapeHtml(d.companyRuc)}
            <b>Establecimiento:</b> ${escapeHtml(d.branchName)}${d.branchAddress ? " — " + escapeHtml(d.branchAddress) : ""}
        </div>
        <div>
            <b>Estado de caja:</b> ${escapeHtml(d.status)}
            <b>Fecha de apertura:</b> ${formatDateTime(d.openedAt)}
            <b>Fecha de cierre:</b> ${formatDateTime(d.closedAt)}
            <b>Empleado:</b> ${escapeHtml(d.employeeName)}
            <b>Asignado a:</b> ${escapeHtml(d.cashRegisterName)}
        </div>
        <div>
            <b>Montos de operación:</b>
            <b>Apertura:</b> ${money(d.openingAmount)}
            <b>Ingresos:</b> ${money(d.totalIncome)}
            <b>Egresos:</b> ${money(d.totalExpense)}
            <b>Monto total:</b> ${money(d.netTotal)}
            <b>Efectivo real:</b> ${money(d.realCash)}
        </div>
    </div>

    ${section("Apertura de caja", openingsTable)}
    ${section("Egresos", expensesTable)}
    ${section("Documentos por venta", documentsTable)}
    ${section("Documentos iniciales/finales", rangeTable)}
    ${section("Ventas por forma de pago", salesByMethodTable)}
    ${section("Detalle de productos", productsTable)}
    ${section("Montos totales", totalsTable)}
</body>
</html>`;
}

/** Abre una ventana nueva con el reporte y dispara el diálogo de impresión del sistema
 * (permite "Guardar como PDF" como destino, igual que el resto de la app). */
export function openCashClosureReportPrintWindow(
    detail: CashClosureDetailData,
): boolean {
    const html = buildCashClosureReportHtml(detail);
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return false;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    // Pequeño delay para que el navegador termine de pintar antes de abrir el diálogo.
    window.setTimeout(() => {
        w.print();
    }, 150);
    return true;
}
