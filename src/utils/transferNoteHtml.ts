/**
 * Genera el HTML de la "Nota de Transferencia de Inventario entre Sucursales"
 * (formato A4) que Electron descarga como PDF al presionar "Enviar" en
 * SendTransferModal. La cabecera (folio TR-XXXX por empresa, motivo, chofer,
 * placa y observaciones) vive en WarehouseTransferNote — ver backend
 * apps/inventory/models.py.
 */

import { getFullImageUrl, isLikelyImagePath } from "./getFullImageUrl";

export type TransferNoteItemRow = {
    code: string;
    description: string;
    unit: string;
    quantity: number;
    /** Estado / observaciones de la fila (ej.: "Enviada"). */
    status: string;
};

export type TransferNoteBranchSide = {
    branchName: string;
    /** Encargado: en origen quien despacha; en destino quien recibe (o pendiente). */
    manager: string;
    address: string;
    phone: string;
};

export type TransferNoteData = {
    folio: string;
    /** BRANCH = entre sucursales (TR-/TRE-); INTERNAL = entre almacenes de la misma
     *  sucursal (TRI-). Cambia títulos y etiquetas del documento. */
    variant?: "BRANCH" | "INTERNAL";
    companyName: string;
    companyRuc: string;
    /** Logo crudo de companyData (ruta /media, URL http o base64); se resuelve aquí. */
    companyLogo?: string | null;
    issuedAt: Date | string;
    sentAt: Date | string;
    origin: TransferNoteBranchSide;
    destination: TransferNoteBranchSide;
    motive: string;
    driverName: string;
    vehiclePlate: string;
    items: TransferNoteItemRow[];
    notes: string;
};

function esc(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatDate(value: Date | string): string {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function formatDateTime(value: Date | string): string {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${formatDate(d)} ${hh}:${mi}`;
}

function formatQuantity(qty: number): string {
    return Number.isInteger(qty) ? String(qty) : qty.toFixed(2);
}

/** Resuelve el logo crudo (ruta /media, URL o base64) a una URL usable en <img>. */
function resolveLogoSrc(raw?: string | null): string | null {
    const value = raw?.trim();
    if (!value) return null;
    if (value.startsWith("data:")) return value;
    if (isLikelyImagePath(value)) {
        const full = getFullImageUrl(value);
        return full || null;
    }
    if (/^[A-Za-z0-9+/=]+$/.test(value.slice(0, 80))) {
        return `data:image/png;base64,${value}`;
    }
    return value;
}

function branchSideBlock(
    title: string,
    side: TransferNoteBranchSide,
    isOrigin: boolean,
    isInternal: boolean,
): string {
    const siteLabel = isInternal ? "Almacén" : "Sucursal";
    const managerLabel = isInternal ? "Responsable" : "Encargado";
    const rows: Array<[string, string]> = [
        [
            isOrigin ? `${siteLabel} de origen` : `${siteLabel} de destino`,
            side.branchName,
        ],
        [
            isOrigin
                ? `${managerLabel} (despacha)`
                : `${managerLabel} (recibe)`,
            side.manager,
        ],
        ["Dirección", side.address],
        ["Teléfono", side.phone],
    ];
    return `
        <div class="branch-side">
            <div class="branch-side-title">${esc(title)}</div>
            <table class="branch-table">
                ${rows
                    .map(
                        ([label, value]) => `
                <tr>
                    <td class="branch-label">${esc(label)}</td>
                    <td class="branch-value">${esc(value) || "—"}</td>
                </tr>`,
                    )
                    .join("")}
            </table>
        </div>`;
}

export function buildTransferNoteHtml(d: TransferNoteData): string {
    const logo = resolveLogoSrc(d.companyLogo);
    const isInternal = d.variant === "INTERNAL";
    const docTitle = isInternal
        ? "Transferencia de inventario entre almacenes"
        : "Transferencia de inventario entre sucursales";
    const siteLabel = isInternal ? "Almacén" : "Sucursal";
    const section1Title = isInternal
        ? "Datos de los almacenes (origen y destino)"
        : "Datos de origen y destino";
    const transferInfoHtml = isInternal
        ? `<div class="transfer-grid">
        <div class="transfer-field"><b>Motivo de la transferencia</b>${esc(d.motive) || "—"}</div>
        <div class="transfer-field"><b>Responsable</b>${esc(d.origin.manager) || "—"}</div>
        <div class="transfer-field"><b>Almacenes</b>${esc(d.origin.branchName)} → ${esc(d.destination.branchName)}</div>
    </div>`
        : `<div class="transfer-grid">
        <div class="transfer-field"><b>Motivo del traslado</b>${esc(d.motive) || "—"}</div>
        <div class="transfer-field"><b>Chofer / transportista</b>${esc(d.driverName) || "—"}</div>
        <div class="transfer-field"><b>Placa del vehículo</b>${esc(d.vehiclePlate) || "—"}</div>
    </div>`;
    const rowsHtml =
        d.items.length === 0
            ? `<tr><td colspan="5" class="empty">Sin productos en esta nota</td></tr>`
            : d.items
                  .map(
                      (item) => `
                <tr>
                    <td>${esc(item.code) || "—"}</td>
                    <td>${esc(item.description)}</td>
                    <td class="center">${esc(item.unit) || "—"}</td>
                    <td class="num">${esc(formatQuantity(item.quantity))}</td>
                    <td>${esc(item.status)}</td>
                </tr>`,
                  )
                  .join("");

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Nota de transferencia ${esc(d.folio)}</title>
<style>
    * { box-sizing: border-box; }
    body {
        font-family: -apple-system, Segoe UI, Arial, sans-serif;
        color: #1e293b;
        margin: 0;
        padding: 24px 32px;
        font-size: 12px;
    }
    @page { size: A4; margin: 10mm; }

    .header { text-align: center; border-bottom: 3px solid #1e293b; padding-bottom: 14px; }
    .header .logo { max-height: 72px; max-width: 200px; object-fit: contain; margin-bottom: 6px; }
    .header .company-name { font-size: 15px; font-weight: 800; margin: 0; }
    .header .company-ruc { font-size: 11px; color: #475569; margin: 2px 0 10px; }
    .header .doc-title {
        font-size: 17px;
        font-weight: 900;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        margin: 0 0 10px;
    }
    .header-meta {
        display: flex;
        justify-content: center;
        gap: 28px;
        font-size: 11px;
        color: #334155;
    }
    .header-meta .folio {
        font-size: 13px;
        font-weight: 900;
        color: #1e293b;
    }
    .header-meta b { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }

    h3 {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin: 16px 0 6px;
        color: #334155;
    }

    .branch-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .branch-side { border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
    .branch-side-title {
        background: #f1f5f9;
        padding: 6px 10px;
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #334155;
    }
    .branch-table { width: 100%; border-collapse: collapse; }
    .branch-table td { padding: 5px 10px; border-top: 1px solid #e2e8f0; vertical-align: top; }
    .branch-label { width: 42%; font-weight: 700; color: #64748b; }

    .transfer-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 16px; }
    .transfer-field { border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    .transfer-field b { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-bottom: 2px; }

    table.items { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.items th {
        background: #1e293b;
        color: #fff;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 7px 8px;
        text-align: left;
    }
    table.items td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
    table.items .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
    table.items .center { text-align: center; }
    table.items .empty { text-align: center; color: #94a3b8; padding: 14px; }

    .notes-box {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 10px 12px;
        min-height: 34px;
        white-space: pre-wrap;
    }
    .blank-lines { margin-top: 8px; }
    .blank-lines div { border-bottom: 1px solid #cbd5e1; height: 26px; }

    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
    .signature { border-top: 1px solid #1e293b; padding-top: 5px; text-align: center; font-size: 10px; color: #475569; }

    .footer { margin-top: 18px; text-align: center; font-size: 9px; color: #94a3b8; }
</style>
</head>
<body>
    <div class="header">
        ${logo ? `<img class="logo" src="${esc(logo)}" alt="Logo" />` : ""}
        <p class="company-name">${esc(d.companyName)}</p>
        <p class="company-ruc">RUC ${esc(d.companyRuc) || "—"}</p>
        <h1 class="doc-title">${esc(docTitle)}</h1>
        <div class="header-meta">
            <span class="folio"><b>Número de control</b>No. ${esc(d.folio)}</span>
            <span><b>Fecha de emisión</b>${esc(formatDate(d.issuedAt))}</span>
            <span><b>${isInternal ? "Fecha de transferencia" : "Fecha de envío real"}</b>${esc(formatDateTime(d.sentAt))}</span>
        </div>
    </div>

    <h3>1. ${esc(section1Title)}</h3>
    <div class="branch-grid">
        ${branchSideBlock(`${siteLabel} de origen (envía)`, d.origin, true, isInternal)}
        ${branchSideBlock(`${siteLabel} de destino (recibe)`, d.destination, false, isInternal)}
    </div>

    <h3>2. Información del traslado</h3>
    ${transferInfoHtml}

    <h3>3. Detalle de productos transferidos</h3>
    <table class="items">
        <thead>
            <tr>
                <th>Código / SKU</th>
                <th>Descripción del producto</th>
                <th class="center">Unidad</th>
                <th class="num">${isInternal ? "Cantidad transferida" : "Cantidad enviada"}</th>
                <th>${isInternal ? "Observaciones" : "Estado / observaciones"}</th>
            </tr>
        </thead>
        <tbody>${rowsHtml}
        </tbody>
    </table>

    <h3>4. Notas / observaciones adicionales</h3>
    <div class="notes-box">${esc(d.notes) || "&nbsp;"}</div>
    <div class="blank-lines"><div></div><div></div><div></div><div></div></div>

    <div class="signatures">
        <div class="signature">${isInternal ? "Firma de quien entrega" : "Firma de quien despacha"}</div>
        <div class="signature">Firma de quien recibe</div>
    </div>

    <div class="footer">Documento generado por SumApp · Nota ${esc(d.folio)}</div>
</body>
</html>`;
}

export function buildTransferNoteFilename(folio: string): string {
    const safeFolio = (folio || "TR-XXXX").replace(/[^A-Za-z0-9-]/g, "");
    return `Nota_Transferencia_${safeFolio}.pdf`;
}
