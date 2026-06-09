/**
 * Arma el JSON del comprobante (formato document_data) a partir del reporte de ventas.
 */

import { getFullImageUrl, isLikelyImagePath } from "./getFullImageUrl";
import { documentTypeLabelFromCode } from "./buildCashPayDocumentPreview";
import type { CompanyData } from "../context/AuthContext";

export type IssuedDocumentReportSource = {
    serial: string;
    number: string;
    emissionDate: string;
    emissionTime: string;
    totalAmount: number;
    totalDiscount: number;
    globalDiscount?: number;
    globalDiscountPercent?: number;
    igvAmount: number;
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
        unitPrice: number;
        total: number;
        notes?: string;
        operationDetail?: {
            notes?: string;
            product?: {
                name: string;
            };
        };
    }>;
    branch?: {
        name?: string;
        igvPercentage?: number;
    };
};

const roundMoney2 = (n: number): number =>
    Math.round((Number(n) || 0) * 100) / 100;

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
    const docNumber = `${doc.serial}-${doc.number}`;
    const companyName =
        companyData?.company?.denomination ||
        companyData?.company?.commercialName ||
        "";

    const payload: Record<string, unknown> = {
        type: documentTypeLabelFromCode(
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
            invoice: docNumber,
            number: docNumber,
            date: doc.emissionDate,
            time: doc.emissionTime,
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

    const rawLogo =
        companyData?.branch?.logo?.trim() ||
        companyData?.company?.logo?.trim() ||
        null;
    if (rawLogo) {
        if (isLikelyImagePath(rawLogo)) {
            payload.logo_url = getFullImageUrl(rawLogo);
        } else {
            const logo = stripLogoBase64(rawLogo);
            if (logo) payload.logo_base64 = logo;
        }
    }

    if (doc.person?.name || doc.person?.documentNumber) {
        payload.customer = {
            name: doc.person.name,
            document: doc.person.documentNumber,
            document_type: doc.person.documentType,
        };
    }

    const tableName = doc.operation?.table?.name?.trim();
    if (tableName) payload.table = `Mesa ${tableName}`;

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
