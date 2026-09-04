
import { exportToExcel, type ExcelRow, type ExportToExcelResult } from "../../utils/exportToExcel";
import { getPaymentMethodLabel } from "../../utils/paymentMethodLabels";
import type { SoldProductItem, SoldProductsSummary } from "./reportsProductsSold";
import type { CategorySalesGroup, CategorySalesSummary } from "./reportCategorySalesList";
import type { ExpensePayment, ExpenseReportSummary } from "./reportExpense";
import type { EmployeeDishLine, UserSaleOperation } from "./reportEmployee";
import type { CancellationItem } from "./reportCancel";

type DateRange = {
    startDate: string;
    endDate: string;
};

function formatDateTime(value?: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("es-PE");
}

function roundMoney(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function paymentMethodsLabel(methods: string[]): string {
    return [...new Set(methods.filter(Boolean))].map(getPaymentMethodLabel).join(", ");
}

function expenseSourceLabel(payment: ExpensePayment): string {
    const opType = (payment.operation?.operationType || "").toUpperCase();
    if (opType === "PURCHASE") {
        const order = payment.operation?.order;
        return order != null ? `Compra #${order}` : "Compra";
    }
    if (payment.issuedDocument) {
        return `${payment.issuedDocument.serial}-${payment.issuedDocument.number}`;
    }
    if (payment.operation?.order != null) {
        return `Operación #${payment.operation.order}`;
    }
    return "Manual";
}

function cancellationTypeLabel(type: string): string {
    if (type === "OPERATION") return "Orden completa";
    if (type === "ITEM") return "Producto";
    return type;
}

export async function downloadProductsSoldReport(
    products: SoldProductItem[],
    summary: SoldProductsSummary | null,
    range: DateRange,
): Promise<ExportToExcelResult> {
    const rows: ExcelRow[] = products.map((product) => ({
        Código: product.code,
        Producto: product.name,
        "Cantidad vendida": product.totalQuantity,
        "Precio promedio": roundMoney(product.avgUnitPrice),
        Total: roundMoney(product.totalAmount),
    }));

    if (summary) {
        rows.push({
            Código: "",
            Producto: "TOTAL",
            "Cantidad vendida": summary.totalItemsSold,
            "Precio promedio": "",
            Total: roundMoney(summary.grandTotal),
        });
    }

    return exportToExcel({
        filename: `productos-vendidos_${range.startDate}_${range.endDate}`,
        sheets: [{ name: "Productos", rows }],
    });
}

export async function downloadCategorySalesReport(
    categories: CategorySalesGroup[],
    summary: CategorySalesSummary | null,
    range: DateRange,
): Promise<ExportToExcelResult> {
    const rows: ExcelRow[] = [];

    for (const category of categories) {
        for (const product of category.products) {
            rows.push({
                Categoría: category.categoryName,
                Código: product.code,
                Producto: product.name,
                Cantidad: product.totalQuantity,
                Total: roundMoney(product.totalAmount),
            });
        }
    }

    if (summary) {
        rows.push({
            Categoría: "TOTAL",
            Código: "",
            Producto: "",
            Cantidad: summary.grandTotalQuantity,
            Total: roundMoney(summary.grandTotalAmount),
        });
    }

    return exportToExcel({
        filename: `ventas-por-categoria_${range.startDate}_${range.endDate}`,
        sheets: [{ name: "Ventas", rows }],
    });
}

export async function downloadExpenseReport(
    payments: ExpensePayment[],
    summary: ExpenseReportSummary,
    range: DateRange,
): Promise<ExportToExcelResult> {
    const rows: ExcelRow[] = payments.map((payment) => ({
        Fecha: formatDateTime(payment.paymentDate),
        Monto: roundMoney(payment.paidAmount),
        "Método de pago": getPaymentMethodLabel(payment.paymentMethod),
        Origen: expenseSourceLabel(payment),
        Usuario: payment.user?.fullName ?? "",
        Caja: payment.cashRegister?.name ?? "",
        Cierre: payment.cashClosure?.closureNumber ?? "",
        Referencia: payment.referenceNumber ?? "",
        Notas: payment.notes ?? "",
    }));

    rows.push({
        Fecha: "TOTAL",
        Monto: roundMoney(summary.totalAmount),
        "Método de pago": `${summary.totalPayments} movimientos`,
        Origen: "",
        Usuario: "",
        Caja: "",
        Cierre: "",
        Referencia: "",
        Notas: "",
    });

    return exportToExcel({
        filename: `egresos_${range.startDate}_${range.endDate}`,
        sheets: [{ name: "Egresos", rows }],
    });
}

export async function downloadEmployeeOrdersReport(
    operations: UserSaleOperation[],
    employeeName: string,
    range: DateRange,
): Promise<ExportToExcelResult> {
    const rows: ExcelRow[] = [];

    for (const operation of operations) {
        const details = operation.details ?? [];
        if (details.length === 0) {
            rows.push({
                Orden: operation.order,
                Fecha: formatDateTime(operation.operationDate),
                Empleado: operation.user.fullName,
                Estado: operation.status,
                Producto: "",
                Cantidad: "",
                "Precio unitario": "",
                Total: roundMoney(operation.total),
            });
            continue;
        }

        for (const detail of details) {
            rows.push({
                Orden: operation.order,
                Fecha: formatDateTime(operation.operationDate),
                Empleado: operation.user.fullName,
                Estado: operation.status,
                Producto: detail.productName,
                Cantidad: detail.quantity,
                "Precio unitario": roundMoney(detail.unitPrice),
                Total: roundMoney(detail.total),
            });
        }
    }

    return exportToExcel({
        filename: `empleado-ordenes_${employeeName.replace(/\s+/g, "-")}_${range.startDate}_${range.endDate}`,
        sheets: [{ name: "Operaciones", rows }],
    });
}

export async function downloadEmployeeDishesReport(
    dishes: EmployeeDishLine[],
    employeeName: string,
    range: DateRange,
): Promise<ExportToExcelResult> {
    const rows: ExcelRow[] = dishes.map((dish) => ({
        Orden: dish.order,
        Fecha: formatDateTime(dish.operationDate),
        Código: dish.code,
        Plato: dish.name,
        Cantidad: dish.quantity,
        "Precio unitario": roundMoney(dish.unitPrice),
        Total: roundMoney(dish.total),
    }));

    return exportToExcel({
        filename: `empleado-platos_${employeeName.replace(/\s+/g, "-")}_${range.startDate}_${range.endDate}`,
        sheets: [{ name: "Platos", rows }],
    });
}

type SalesDocumentForExport = {
    serial: string;
    number: string | number;
    emissionDate: string;
    emissionTime?: string;
    totalAmount: number;
    totalDiscount?: number;
    igvAmount?: number;
    billingStatus?: string;
    document: { code: string; description: string };
    person?: { name: string; documentNumber: string; documentType?: string } | null;
    user?: { fullName: string } | null;
    operation?: {
        order?: string | number | null;
        user?: { fullName: string } | null;
        table?: { name: string; floor?: { name: string } | null } | null;
    } | null;
    payments?: Array<{ paymentMethod: string; paidAmount: number; status?: string }>;
};

type SalesSummaryForExport = {
    totalDocuments: number;
    totalAmount: number;
    totalCash: number;
    totalYape: number;
    totalPlin: number;
    totalCard: number;
    totalTransfer: number;
    totalOthers: number;
};

export async function downloadSalesReport(
    documents: SalesDocumentForExport[],
    summary: SalesSummaryForExport | null,
    range: DateRange,
): Promise<ExportToExcelResult> {
    const documentRows: ExcelRow[] = documents.map((doc) => {
        const activePayments =
            doc.payments?.filter(
                (payment) => (payment.status || "").toUpperCase() !== "CANCELLED",
            ) ?? [];

        return {
            Comprobante: `${doc.serial}-${doc.number}`,
            "Tipo documento": `${doc.document.code} - ${doc.document.description}`,
            Fecha: `${doc.emissionDate} ${doc.emissionTime ?? ""}`.trim(),
            Cliente: doc.person?.name ?? "Público general",
            "Doc. cliente": doc.person?.documentNumber ?? "",
            Orden: doc.operation?.order ?? "",
            Mesa: doc.operation?.table?.name ?? "",
            Mozo: doc.operation?.user?.fullName ?? "",
            Cajero: doc.user?.fullName ?? "",
            Subtotal: roundMoney(doc.totalAmount - (doc.igvAmount ?? 0)),
            IGV: roundMoney(doc.igvAmount),
            Descuento: roundMoney(doc.totalDiscount),
            Total: roundMoney(doc.totalAmount),
            "Estado SUNAT": doc.billingStatus ?? "",
            "Métodos de pago": paymentMethodsLabel(
                activePayments.map((payment) => payment.paymentMethod),
            ),
        };
    });

    const summaryRows: ExcelRow[] = summary
        ? [
              { Concepto: "Documentos emitidos", Valor: summary.totalDocuments },
              { Concepto: "Venta total", Valor: roundMoney(summary.totalAmount) },
              { Concepto: "Efectivo", Valor: roundMoney(summary.totalCash) },
              { Concepto: "Yape", Valor: roundMoney(summary.totalYape) },
              { Concepto: "Plin", Valor: roundMoney(summary.totalPlin) },
              { Concepto: "Tarjeta", Valor: roundMoney(summary.totalCard) },
              { Concepto: "Transferencia", Valor: roundMoney(summary.totalTransfer) },
              { Concepto: "Otros", Valor: roundMoney(summary.totalOthers) },
          ]
        : [];

    return exportToExcel({
        filename: `ventas_${range.startDate}_${range.endDate}`,
        sheets: [
            { name: "Documentos", rows: documentRows },
            { name: "Resumen", rows: summaryRows },
        ],
    });
}

export async function downloadCancellationReport(
    items: CancellationItem[],
    range: DateRange,
): Promise<ExportToExcelResult> {
    const rows: ExcelRow[] = items.map((item) => ({
        Tipo: cancellationTypeLabel(item.type),
        Orden: item.operationOrder,
        Mesa: item.tableName ?? "",
        Mozo: item.waiterName ?? "",
        Producto: item.productName ?? "",
        Cantidad: item.quantity ?? "",
        Monto: roundMoney(item.amount),
        Motivo: item.reason,
        Fecha: formatDateTime(item.cancelledAt),
        Usuario: item.user.fullName,
    }));

    return exportToExcel({
        filename: `anulaciones_${range.startDate}_${range.endDate}`,
        sheets: [{ name: "Anulaciones", rows }],
    });
}

type DriverDeliveryDocumentForExport = {
    serial: string;
    number: number;
    emissionDate: string;
    emissionTime?: string;
    clientName?: string;
    clientDocumentNumber?: string;
    deliveryPrice: number;
    totalAmount: number;
    billingStatus?: string;
    driverName?: string;
};

type DriverDeliverySummaryForExport = {
    totalDocuments: number;
    totalDeliveryPrice: number;
    totalSaleAmount: number;
};

function formatDriverDeliveryCorrelativo(serial: string, number: number): string {
    return `${serial}-${String(number).padStart(8, "0")}`;
}

export async function downloadDriverDeliveryReport(
    documents: DriverDeliveryDocumentForExport[],
    summary: DriverDeliverySummaryForExport | null,
    range: DateRange,
    driverName?: string,
): Promise<ExportToExcelResult> {
    const documentRows: ExcelRow[] = documents.map((doc) => ({
        Fecha: `${doc.emissionDate} ${doc.emissionTime?.slice(0, 5) ?? ""}`.trim(),
        Comprobante: formatDriverDeliveryCorrelativo(doc.serial, doc.number),
        Cliente: doc.clientName || "Cliente varios",
        "Doc. cliente": doc.clientDocumentNumber ?? "",
        Motorizado: doc.driverName ?? "",
        "Precio delivery": roundMoney(doc.deliveryPrice),
        "Total venta": roundMoney(doc.totalAmount),
        "Estado SUNAT": doc.billingStatus ?? "",
    }));

    const summaryRows: ExcelRow[] = summary
        ? [
              { Concepto: "Documentos", Valor: summary.totalDocuments },
              {
                  Concepto: "Total cobrado delivery",
                  Valor: roundMoney(summary.totalDeliveryPrice),
              },
              {
                  Concepto: "Total ventas",
                  Valor: roundMoney(summary.totalSaleAmount),
              },
          ]
        : [];

    const driverSuffix = driverName
        ? `_${driverName.replace(/\s+/g, "-")}`
        : "";

    return exportToExcel({
        filename: `motorizados-delivery${driverSuffix}_${range.startDate}_${range.endDate}`,
        sheets: [
            { name: "Entregas", rows: documentRows },
            { name: "Resumen", rows: summaryRows },
        ],
    });
}

type ClientSalesDocumentForExport = {
    serial: string;
    number: number;
    emissionDate: string;
    emissionTime?: string;
    clientName: string;
    clientDocumentNumber?: string;
    clientDocumentType?: string;
    paymentMethods?: string;
    totalAmount: number;
    billingStatus?: string;
};

type ClientSalesSummaryForExport = {
    totalDocuments: number;
    totalClients: number;
    totalAmount: number;
    totalCash: number;
    totalYape: number;
    totalPlin: number;
    totalCard: number;
    totalTransfer: number;
    totalRappi: number;
    totalPedidoYa: number;
    totalOthers: number;
};

function formatClientSalesCorrelativo(serial: string, number: number): string {
    return `${serial}-${String(number).padStart(8, "0")}`;
}

export async function downloadClientSalesReport(
    documents: ClientSalesDocumentForExport[],
    summary: ClientSalesSummaryForExport | null,
    range: DateRange,
): Promise<ExportToExcelResult> {
    const documentRows: ExcelRow[] = documents.map((doc) => ({
        Fecha: `${doc.emissionDate} ${doc.emissionTime?.slice(0, 5) ?? ""}`.trim(),
        Comprobante: formatClientSalesCorrelativo(doc.serial, doc.number),
        Cliente: doc.clientName,
        "Tipo doc.": doc.clientDocumentType ?? "",
        "Doc. cliente": doc.clientDocumentNumber ?? "",
        "Método de pago": doc.paymentMethods ?? "",
        Total: roundMoney(doc.totalAmount),
        "Estado SUNAT": doc.billingStatus ?? "",
    }));

    const summaryRows: ExcelRow[] = summary
        ? [
              { Concepto: "Documentos", Valor: summary.totalDocuments },
              { Concepto: "Clientes distintos", Valor: summary.totalClients },
              { Concepto: "Total vendido", Valor: roundMoney(summary.totalAmount) },
              { Concepto: "Efectivo", Valor: roundMoney(summary.totalCash) },
              { Concepto: "Yape", Valor: roundMoney(summary.totalYape) },
              { Concepto: "Plin", Valor: roundMoney(summary.totalPlin) },
              { Concepto: "Tarjeta", Valor: roundMoney(summary.totalCard) },
              { Concepto: "Transferencia", Valor: roundMoney(summary.totalTransfer) },
              { Concepto: "Rappi", Valor: roundMoney(summary.totalRappi) },
              { Concepto: "Pedido Ya", Valor: roundMoney(summary.totalPedidoYa) },
              { Concepto: "Otros", Valor: roundMoney(summary.totalOthers) },
          ]
        : [];

    return exportToExcel({
        filename: `ventas-clientes_${range.startDate}_${range.endDate}`,
        sheets: [
            { name: "Ventas", rows: documentRows },
            { name: "Resumen", rows: summaryRows },
        ],
    });
}
