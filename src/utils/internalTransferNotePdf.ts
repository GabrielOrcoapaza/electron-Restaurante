/**
 * Datos y descarga del PDF de la "Nota de Transferencia Interna" (folio TRI-XXXX),
 * generada al transferir stock entre dos almacenes de la MISMA sucursal. Reutiliza
 * la plantilla A4 de `transferNoteHtml` con `variant: "INTERNAL"`.
 *
 * Los ítems NO tienen estado (el movimiento es inmediato): la columna final del
 * documento queda como "Observaciones".
 */

import { downloadTransferNotePdf } from "./downloadTransferNotePdf";
import type { TransferNoteData } from "./transferNoteHtml";

export interface InternalTransferNoteItem {
    id: string;
    quantity: number;
    unitCost?: number | null;
    product: {
        id: string;
        code?: string | null;
        name: string;
        unitMeasure?: string | null;
    };
}

export interface InternalTransferNote {
    id: string;
    folio: string;
    motive?: string | null;
    notes?: string | null;
    createdAt: string;
    company: {
        id: string;
        denomination?: string | null;
        commercialName?: string | null;
        ruc?: string | null;
        logo?: string | null;
    };
    branch: {
        id: string;
        name: string;
        address?: string | null;
        phone?: string | null;
    };
    fromWarehouse: { id: string; name: string };
    toWarehouse: { id: string; name: string };
    createdBy?: { id: string; fullName: string } | null;
    items: InternalTransferNoteItem[];
}

/** Mapea la nota interna (GraphQL) al modelo del documento imprimible. */
export function buildInternalTransferNoteData(
    note: InternalTransferNote,
): TransferNoteData {
    return {
        variant: "INTERNAL",
        folio: note.folio,
        companyName:
            note.company?.denomination || note.company?.commercialName || "",
        companyRuc: note.company?.ruc || "",
        companyLogo: note.company?.logo || null,
        issuedAt: note.createdAt,
        sentAt: note.createdAt,
        origin: {
            branchName: note.fromWarehouse.name,
            manager: note.createdBy?.fullName || "",
            address: note.branch?.address || "",
            phone: note.branch?.phone || "",
        },
        destination: {
            branchName: note.toWarehouse.name,
            manager: "",
            address: note.branch?.address || "",
            phone: note.branch?.phone || "",
        },
        motive: note.motive || "",
        driverName: "",
        vehiclePlate: "",
        items: (note.items || []).map((it) => ({
            code: it.product?.code || "",
            description: it.product?.name || "",
            unit: it.product?.unitMeasure || "",
            quantity: Number(it.quantity) || 0,
            // El ítem no tiene estado: la columna se rotula "Observaciones".
            status: "",
        })),
        notes: note.notes || "",
    };
}

export async function downloadInternalTransferNotePdf(
    note: InternalTransferNote,
): Promise<{ ok: boolean; message?: string }> {
    return downloadTransferNotePdf(buildInternalTransferNoteData(note));
}
