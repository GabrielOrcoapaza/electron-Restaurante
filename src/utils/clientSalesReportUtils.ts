/** Etiqueta de boleta / factura / nota de venta (SUNAT u otros). */
export function issuedDocumentTypeLabel(
    documentCode?: string | null,
    documentDescription?: string | null,
): string {
    const code = String(documentCode ?? "").trim();
    if (code === "01") return "Factura";
    if (code === "03") return "Boleta";
    const desc = String(documentDescription ?? "").trim();
    if (desc) {
        const lower = desc.toLowerCase();
        if (lower.includes("factura")) return "Factura";
        if (lower.includes("boleta")) return "Boleta";
        if (lower.includes("nota")) return "Nota de venta";
        return desc;
    }
    return "Nota de venta";
}

export function clientSalesClientKey(doc: {
    clientName: string;
    clientDocumentNumber?: string | null;
}): string {
    const name = doc.clientName.trim();
    const docNum = (doc.clientDocumentNumber ?? "").trim();
    return docNum ? `${docNum}::${name}` : name.toLowerCase();
}

export type ClientCreditVoucherGroup = {
    groupKey: string;
    clientKey: string;
    clientName: string;
    clientDocumentNumber?: string;
    voucherTypeLabel: string;
    documentCount: number;
    totalAmount: number;
    lastEmissionDate: string;
    lastEmissionTime?: string;
    comprobantes: string[];
};

type ClientSalesGroupSource = {
    id: string;
    serial: string;
    number: number;
    emissionDate: string;
    emissionTime?: string;
    clientName: string;
    clientDocumentNumber?: string | null;
    totalAmount: number;
    isCreditSale?: boolean;
    documentCode?: string | null;
    documentDescription?: string | null;
};

function formatCorrelativo(serial: string, number: number): string {
    return `${serial}-${String(number).padStart(8, "0")}`;
}

/** Agrupa ventas a crédito por cliente + tipo de comprobante. */
export function buildClientCreditVoucherGroups(
    documents: ClientSalesGroupSource[],
): ClientCreditVoucherGroup[] {
    const creditDocs = documents.filter((d) => Boolean(d.isCreditSale));
    const map = new Map<string, ClientCreditVoucherGroup>();

    for (const doc of creditDocs) {
        const clientKey = clientSalesClientKey(doc);
        const voucherTypeLabel = issuedDocumentTypeLabel(
            doc.documentCode,
            doc.documentDescription,
        );
        const groupKey = `${clientKey}::${voucherTypeLabel}`;
        const correlativo = formatCorrelativo(doc.serial, doc.number);
        const existing = map.get(groupKey);

        if (!existing) {
            map.set(groupKey, {
                groupKey,
                clientKey,
                clientName: doc.clientName,
                clientDocumentNumber: doc.clientDocumentNumber ?? undefined,
                voucherTypeLabel,
                documentCount: 1,
                totalAmount: Number(doc.totalAmount) || 0,
                lastEmissionDate: doc.emissionDate,
                lastEmissionTime: doc.emissionTime,
                comprobantes: [correlativo],
            });
            continue;
        }

        existing.documentCount += 1;
        existing.totalAmount += Number(doc.totalAmount) || 0;
        existing.comprobantes.push(correlativo);
        const dateA = `${doc.emissionDate}T${doc.emissionTime ?? "00:00"}`;
        const dateB = `${existing.lastEmissionDate}T${existing.lastEmissionTime ?? "00:00"}`;
        if (dateA > dateB) {
            existing.lastEmissionDate = doc.emissionDate;
            existing.lastEmissionTime = doc.emissionTime;
        }
    }

    return [...map.values()].sort((a, b) => {
        const nameCmp = a.clientName.localeCompare(b.clientName, "es");
        if (nameCmp !== 0) return nameCmp;
        return a.voucherTypeLabel.localeCompare(b.voucherTypeLabel, "es");
    });
}