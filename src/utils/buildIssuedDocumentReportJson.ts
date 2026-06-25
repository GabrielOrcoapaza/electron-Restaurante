/**
 * Arma el JSON del comprobante (formato document_data) a partir del reporte de ventas.
 * Mismo estilo simple que el ticket impreso (FACTURA, N°, cliente, estado, pago).
 */

import { isLikelyImagePath } from "./getFullImageUrl";
import type { CompanyData } from "../context/AuthContext";

export type IssuedDocumentReportSource = {
    serial: string;
    number: string | number;
    emissionDate: string;
    emissionTime: string;
    totalAmount: number;
    totalDiscount: number;
    globalDiscount?: number;
    globalDiscountPercent?: number;
    igvAmount: number;
    hashCode?: string | null;
    billingStatus?: string;
    document: {
        code: string;
        description: string;
    };
    person?: {
        name: string;
        documentNumber: string;
        documentType: string;
    } | null;
    operation?: {
        user?: { fullName: string } | null;
        table?: { name: string } | null;
    } | null;
    items: Array<{
        quantity: number;
        unitValue?: number;
        unitPrice: number;
        total: number;
        notes?: string;
        operationDetail?: {
            notes?: string;
            product?: {
                code?: string;
                name: string;
            };
        };
    }>;
    payments?: Array<{
        paymentMethod: string;
        paidAmount: number;
        status?: string;
    }>;
    branch?: {
        name?: string;
        igvPercentage?: number;
    };
};

const roundMoney2 = (n: number): number =>
    Math.round((Number(n) || 0) * 100) / 100;

function reportDocumentTypeLabel(
    code: string,
    description?: string | null,
): string {
    const c = String(code || "").trim();
    if (c === "01") return "FACTURA";
    if (c === "03") return "BOLETA";
    const d = String(description || "").trim();
    return d ? d.toUpperCase() : "NOTA DE VENTA";
}

function formatDocNumber(serial: string, number: string | number): string {
    const s = String(serial || "").trim();
    const n = String(number ?? "").trim();
    const padded = n.padStart(6, "0");
    return `N° ${s}-${padded}`;
}

function formatEmissionDateTime(date: string, time: string): string {
    const d = String(date || "").trim();
    const t = String(time || "").trim();
    if (d && t) return `${d} ${t}`;
    return d || t;
}

function billingStatusLabel(status?: string | null): string | undefined {
    const s = String(status || "").trim().toUpperCase();
    if (!s) return undefined;
    const map: Record<string, string> = {
        PROCESSING: "Procesando",
        SENT: "Enviado",
        ACCEPTED: "Emitido",
        ACCEPTED_WITH_OBSERVATIONS: "Emitido",
        REJECTED: "Rechazado",
        ERROR: "Error",
        CANCELLED: "Anulado",
    };
    return map[s] || status || undefined;
}

function formatPaymentMethodLabel(method: string): string {
    const m = String(method || "").trim().toUpperCase();
    if (m === "CARD" || m === "TARJETA" || m === "CREDIT_CARD") return "CARD";
    if (m === "CASH" || m === "EFECTIVO") return "EFECTIVO";
    if (m === "YAPE") return "YAPE";
    if (m === "PLIN") return "PLIN";
    if (m === "TRANSFER") return "TRANSFERENCIA";
    return m || "PAGO";
}

function formatCustomerDocumentType(
    value?: string | null,
    documentNumber?: string | null,
): string {
    const t = String(value || "").trim().toUpperCase();
    if (t === "6" || t === "RUC") return "RUC";
    if (t === "1" || t === "DNI") return "DNI";
    const docNum = String(documentNumber || "").trim();
    if (!t && docNum.length === 11) return "RUC";
    if (!t && docNum.length === 8) return "DNI";
    return t || "Doc";
}

function stripLogoBase64(logo?: string | null): string | undefined {
    if (!logo?.trim()) return undefined;
    const t = logo.trim();
    if (t.startsWith("data:")) {
        const i = t.indexOf("base64,");
        if (i >= 0) return t.slice(i + 7);
    }
    return t;
}

export function buildIssuedDocumentReportJson(
    doc: IssuedDocumentReportSource,
    companyData?: CompanyData | null,
): string {
    const igvPercent =
        Number(doc.branch?.igvPercentage ?? companyData?.branch?.igvPercentage) ||
        10.5;
    const subtotal = roundMoney2(doc.totalAmount - doc.igvAmount);
    const companyName =
        companyData?.company?.denomination ||
        companyData?.company?.commercialName ||
        "";

    const payload: Record<string, unknown> = {
        type: reportDocumentTypeLabel(
            doc.document.code,
            doc.document.description,
        ),
        branch: {
            company: companyName,
            name: doc.branch?.name ?? companyData?.branch?.name ?? "",
            ruc: companyData?.company?.ruc ?? "",
            address:
                companyData?.branch?.address ??
                companyData?.company?.address ??
                "",
            phone:
                companyData?.branch?.phone ?? companyData?.company?.phone ?? "",
        },
        document: {
            invoice: formatDocNumber(doc.serial, doc.number),
            date: doc.emissionDate,
            time: doc.emissionTime,
            datetime: formatEmissionDateTime(doc.emissionDate, doc.emissionTime),
        },
        items: doc.items.map((item) => ({
            product_name: item.operationDetail?.product?.name ?? "",
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total: item.total,
            notes: item.notes ?? item.operationDetail?.notes ?? "",
        })),
        amounts: {
            total_taxable: subtotal,
            subtotal,
            igv: doc.igvAmount,
            igv_percent: igvPercent,
            discount: doc.globalDiscount ?? doc.totalDiscount ?? 0,
            discount_percent: doc.globalDiscountPercent ?? 0,
            total_discount: doc.totalDiscount ?? 0,
            total: doc.totalAmount,
        },
    };

    const statusLabel = billingStatusLabel(doc.billingStatus);
    if (statusLabel) payload.billing_status = statusLabel;

    const activePayments = (doc.payments ?? []).filter(
        (p) => String(p.status || "COMPLETED").toUpperCase() !== "CANCELLED",
    );
    if (activePayments.length > 0) {
        payload.payments = activePayments.map((p) => ({
            method: formatPaymentMethodLabel(p.paymentMethod),
            amount: p.paidAmount,
        }));
    }

    const rawLogo =
        companyData?.branch?.logo?.trim() ||
        companyData?.company?.logo?.trim() ||
        null;
    if (rawLogo && !isLikelyImagePath(rawLogo)) {
        const logo = stripLogoBase64(rawLogo);
        if (logo) payload.logo_base64 = logo;
    }

    if (doc.person?.name || doc.person?.documentNumber) {
        payload.customer = {
            name: doc.person.name ?? "",
            document: doc.person.documentNumber ?? "",
            document_type: formatCustomerDocumentType(
                doc.person.documentType,
                doc.person.documentNumber,
            ),
        };
    }

    const tableName = doc.operation?.table?.name?.trim();
    if (tableName) payload.table = tableName;

    const waiterName = doc.operation?.user?.fullName?.trim();
    if (waiterName) payload.waiter = waiterName;

    return JSON.stringify(payload);
}

export function issuedDocumentPdfFilename(
    doc: Pick<IssuedDocumentReportSource, "serial" | "number" | "document">,
): string {
    const code = String(doc.document.code || "doc").replace(/[^\w-]/g, "");
    const serial = String(doc.serial || "").replace(/[^\w-]/g, "");
    const number = String(doc.number || "").replace(/[^\w-]/g, "");
    return `${code}_${serial}-${number}.pdf`;
}
