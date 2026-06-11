/**
 * Convierte el JSON de document_data (backend) en HTML imprimible (72–80 mm típico).
 * Estilo alineado al ticket ESC/POS del cliente Raspberry (jerarquía, total destacado, QR).
 */

import QRCode from "qrcode";

export function escapeHtml(s: string): string {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderFlatObject(obj: Record<string, unknown>, skip: Set<string>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
        if (skip.has(k)) continue;
        if (v == null) continue;
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            parts.push(
                `<div class="kv"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(
                    String(v)
                )}</span></div>`
            );
        }
    }
    return parts.join("");
}

/** Mismo criterio de datos que el cliente Raspberry (print_document): ticket en columna única. */
function looksLikeThermalDocumentPayload(doc: Record<string, unknown>): boolean {
    const branch = doc.branch;
    const document = doc.document;
    const amounts = doc.amounts;
    const hasBranch = branch != null && typeof branch === "object" && !Array.isArray(branch);
    const hasDocument = document != null && typeof document === "object" && !Array.isArray(document);
    const hasAmounts = amounts != null && typeof amounts === "object" && !Array.isArray(amounts);
    const hasItems = Array.isArray(doc.items) && doc.items.length > 0;
    return hasBranch && (hasDocument || hasAmounts || hasItems);
}

function n(v: unknown): string {
    if (v == null) return "";
    return escapeHtml(String(v));
}

function num2(v: unknown): string {
    const x = Number(v);
    if (Number.isFinite(x)) return x.toFixed(2);
    return n(v);
}

function isLikelyImagePath(value: string): boolean {
    const t = value.trim();
    if (!t) return false;
    if (
        t.startsWith("http://") ||
        t.startsWith("https://") ||
        t.startsWith("/") ||
        t.startsWith("branches/") ||
        t.startsWith("companies/")
    ) {
        return true;
    }
    if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(t)) return true;
    if (t.includes("/") && t.length < 200 && !t.startsWith("data:")) return true;
    return false;
}

function resolveMediaPath(path: string): string {
    const t = path.trim();
    if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("data:")) {
        return t;
    }
    const graphql =
        (typeof process !== "undefined" &&
            (process.env.VITE_GRAPHQL_URL || process.env.GRAPHQL_URL)) ||
        "";
    const mediaBase = graphql
        ? graphql.replace("/graphql", "/media/")
        : "/media/";
    try {
        if (t.startsWith("/media/")) {
            const base = mediaBase.replace(/\/media\/?$/, "");
            return new URL(t, base || "http://localhost").toString();
        }
        const origin =
            typeof window !== "undefined" ? window.location.origin : "http://localhost";
        const base = mediaBase.startsWith("http")
            ? mediaBase
            : `${origin}${mediaBase.startsWith("/") ? "" : "/"}${mediaBase}`;
        return new URL(t, base).toString();
    } catch {
        return `${mediaBase}${t}`.replace(/\/+/g, "/");
    }
}

function logoImgHtml(doc: Record<string, unknown>): string {
    const url =
        typeof doc.logo_url === "string" ? doc.logo_url.trim() : "";
    if (url) {
        return `<div class="logo-wrap"><img class="logo" src="${escapeHtml(url)}" alt=""/></div>`;
    }
    const logo =
        typeof doc.logo_base64 === "string" ? doc.logo_base64.trim() : "";
    if (!logo) return "";
    let src: string;
    if (logo.startsWith("data:")) {
        src = logo;
    } else if (isLikelyImagePath(logo)) {
        src = resolveMediaPath(logo);
    } else {
        src = `data:image/png;base64,${logo}`;
    }
    return `<div class="logo-wrap"><img class="logo" src="${escapeHtml(src)}" alt=""/></div>`;
}

/**
 * HTML que imita el layout del ticket térmico (logo, sucursal, documento, ítems alineados, totales).
 */
async function renderThermalDocumentStyle(doc: Record<string, unknown>): Promise<string> {
    const parts: string[] = [];

    const logoHtml = logoImgHtml(doc);
    if (logoHtml) parts.push(logoHtml);

    const branch = (doc.branch ?? {}) as Record<string, unknown>;
    const bCompany = String(branch.company ?? branch.name ?? "");
    const bName = String(branch.name ?? "");
    if (bCompany) parts.push(`<div class="t-center t-branch t-bold">${n(bCompany)}</div>`);
    if (bName && bName !== bCompany) parts.push(`<div class="t-center t-branch t-bold">${n(bName)}</div>`);
    if (branch.ruc) parts.push(`<div class="t-center t-meta">RUC: ${n(branch.ruc)}</div>`);
    if (branch.address) parts.push(`<div class="t-center t-meta">${n(branch.address)}</div>`);
    if (branch.phone) parts.push(`<div class="t-center t-meta">Tel: ${n(branch.phone)}</div>`);

    parts.push(`<div class="t-sep">================================================</div>`);

    const title = String(doc.type ?? "DOCUMENTO");
    parts.push(`<div class="t-title">${n(title)}</div>`);

    const d = (doc.document ?? {}) as Record<string, unknown>;
    if (d.invoice) {
        parts.push(`<div class="t-center t-docline t-bold">${n(d.invoice)}</div>`);
    } else if (d.number) {
        parts.push(`<div class="t-center t-docline t-bold">${n(d.number)}</div>`);
    }
    const dt = String(d.datetime ?? "").trim() || [d.date, d.time].filter(Boolean).join(" ");
    if (dt) parts.push(`<div class="t-center t-meta">${n(dt)}</div>`);

    const customer = (doc.customer ?? doc.cliente) as Record<string, unknown> | undefined;
    if (customer && typeof customer === "object" && (customer.name || customer.document)) {
        parts.push(`<div class="t-sep2">------------------------------------------------</div>`);
        if (customer.name) parts.push(`<div class="t-bodyline">Cliente: ${n(customer.name)}</div>`);
        if (customer.document) {
            const dt2 = String(customer.document_type ?? "Doc");
            parts.push(`<div class="t-bodyline">${n(dt2)}: ${n(customer.document)}</div>`);
        }
        if (customer.address) parts.push(`<div class="t-meta">${n(customer.address)}</div>`);
    }

    if (doc.table) parts.push(`<div class="t-bodyline">Mesa: ${n(doc.table)}</div>`);
    if (doc.waiter) parts.push(`<div class="t-bodyline">Atendido por: ${n(doc.waiter)}</div>`);

    const billingStatus = doc.billing_status ?? doc.billingStatus;
    if (billingStatus) {
        parts.push(`<div class="t-bodyline">Estado: ${n(String(billingStatus))}</div>`);
    }

    const payments = doc.payments;
    if (Array.isArray(payments)) {
        for (const row of payments) {
            if (!row || typeof row !== "object") continue;
            const r = row as Record<string, unknown>;
            const method = String(r.method ?? r.payment_method ?? r.paymentMethod ?? "").trim();
            const amount = r.amount ?? r.paid_amount ?? r.paidAmount;
            if (method && amount != null) {
                parts.push(
                    `<div class="t-bodyline">${n(method)}: S/ ${num2(amount)}</div>`,
                );
            }
        }
    }

    parts.push(`<div class="t-sep">================================================</div>`);
    parts.push(
        `<div class="t-rowline"><span>CANT</span><span>DESC</span><span class="n">P.U</span><span class="n">TOTAL</span></div>`
    );
    parts.push(`<div class="t-sep2">------------------------------------------------</div>`);

    const items = doc.items;
    if (Array.isArray(items)) {
        for (const row of items) {
            if (!row || typeof row !== "object") continue;
            const r = row as Record<string, unknown>;
            const name = String(
                r.product_name ?? r.productName ?? r.name ?? r.description ?? r.product ?? ""
            );
            const qty = r.quantity ?? r.qty ?? "";
            const price = r.unit_price ?? r.unitPrice ?? r.price;
            const total = r.total ?? r.subtotal;
            const qtyS = String(qty);
            const namePad = name.length > 24 ? name.slice(0, 24) : name;
            const pStr = price != null && price !== "" && Number.isFinite(Number(price)) ? num2(price) : n(price);
            const tStr = total != null && total !== "" && Number.isFinite(Number(total)) ? num2(total) : n(total);
            parts.push(
                `<div class="t-itemline"><span class="q">${n(qtyS)}</span><span class="d">${n(
                    namePad
                )}</span><span class="n p">${pStr}</span><span class="n t">${tStr}</span></div>`
            );
            if (r.notes) {
                parts.push(`<div class="t-note"> &gt; ${n(String(r.notes))}</div>`);
            }
        }
    }

    parts.push(`<div class="t-sep2">------------------------------------------------</div>`);

    const amounts = (doc.amounts ?? {}) as Record<string, unknown>;
    const base = amounts.total_taxable ?? amounts.subtotal;
    if (base != null && Number(base) > 0) {
        parts.push(
            `<div class="t-totrow"><span>OP. Gravadas</span><span class="n">S/ ${num2(base)}</span></div>`
        );
    }
    const igvPct = amounts.igv_percent;
    if (amounts.igv != null) {
        const label =
            igvPct != null && Number(igvPct) > 0
                ? `IGV (${Number(igvPct).toFixed(1)}%)`
                : "IGV";
        parts.push(`<div class="t-totrow"><span>${n(label)}</span><span class="n">S/ ${num2(amounts.igv)}</span></div>`);
    }
    const disc = amounts.discount;
    if (disc != null && Number(disc) > 0) {
        const pct = amounts.discount_percent;
        const dLabel =
            pct != null && Number(pct) > 0 ? `Descuento (${Number(pct).toFixed(0)}%)` : "Descuento";
        parts.push(
            `<div class="t-totrow"><span>${n(dLabel)}</span><span class="n">S/ -${num2(disc)}</span></div>`
        );
    }
    parts.push(`<div class="t-sep">================================================</div>`);
    const totalAmt = amounts.total;
    if (totalAmt != null) {
        parts.push(
            `<div class="t-grand"><span>TOTAL: S/ ${num2(totalAmt)}</span></div>`
        );
    }

    if (doc.qr_data) {
        const rawQr = String(doc.qr_data).trim();
        if (rawQr) {
            try {
                const dataUrl = await QRCode.toDataURL(rawQr, {
                    errorCorrectionLevel: "M",
                    margin: 1,
                    width: 96,
                });
                parts.push(
                    `<div class="t-qr-wrap"><img class="t-qr-img" src="${dataUrl}" alt=""/></div>`
                );
            } catch {
                parts.push(`<div class="t-qr-fallback t-meta t-center">${escapeHtml(rawQr)}</div>`);
            }
        }
    }

    const now = new Date();
    const foot = now.toLocaleString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    parts.push(`<div class="t-center t-footer t-pad">Gracias por su preferencia</div>`);
    parts.push(`<div class="t-center t-footer">Impreso: ${n(foot)}</div>`);
    parts.push(`<div class="t-center t-footer">https://sumapp.pe</div>`);

    return parts.join("");
}

/** Estilos ticket: jerarquía similar a ESC/POS del cliente Raspberry (título y total grandes, QR centrado). */
const THERMAL_PAPER_WIDTH = "72mm";

const thermalDocumentCss = `
    @page { margin: 0; size: ${THERMAL_PAPER_WIDTH} auto; }
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      width: ${THERMAL_PAPER_WIDTH};
      min-width: ${THERMAL_PAPER_WIDTH};
      max-width: ${THERMAL_PAPER_WIDTH};
      margin: 0;
      padding: 0;
      overflow-x: hidden;
      background: #fff;
    }
    body.ticket {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      width: ${THERMAL_PAPER_WIDTH};
      max-width: ${THERMAL_PAPER_WIDTH};
      margin: 0;
      padding: 3px 5px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media screen {
      html, body, body.ticket {
        width: ${THERMAL_PAPER_WIDTH};
        min-width: ${THERMAL_PAPER_WIDTH};
        max-width: ${THERMAL_PAPER_WIDTH};
      }
    }
    .logo-wrap { text-align: center; margin-bottom: 4px; }
    .logo { max-width: 100%; max-height: 52px; object-fit: contain; }
    .t-center { text-align: center; }
    .t-bold { font-weight: 800; }
    .t-branch { font-size: 12px; line-height: 1.3; margin: 2px 0; }
    .t-meta { font-size: 10px; line-height: 1.3; }
    .t-bodyline { font-size: 11px; margin: 2px 0; }
    .t-docline { font-size: 11px; margin: 2px 0; }
    .t-title {
      font-size: 15px;
      font-weight: 900;
      text-align: center;
      margin: 6px 0 4px;
      letter-spacing: 0.02em;
    }
    .t-sep, .t-sep2 { text-align: center; letter-spacing: -0.5px; margin: 4px 0; font-size: 9px; }
    .t-sep2 { margin: 3px 0; }
    .t-rowline {
      display: flex;
      justify-content: space-between;
      gap: 3px;
      font-weight: 800;
      font-size: 10px;
      margin: 4px 0 2px;
    }
    .t-rowline .n { text-align: right; flex: 0 0 auto; min-width: 2.2em; }
    .t-itemline {
      display: flex;
      justify-content: flex-start;
      gap: 4px;
      flex-wrap: nowrap;
      font-size: 10px;
      line-height: 1.45;
      margin: 2px 0;
    }
    .t-itemline .q { flex: 0 0 1.2em; }
    .t-itemline .d { flex: 1 1 auto; min-width: 0; word-break: break-word; }
    .t-itemline .n.p { flex: 0 0 2.6em; text-align: right; }
    .t-itemline .n.t { flex: 0 0 2.9em; text-align: right; font-weight: 700; }
    .t-note { padding-left: 1.4em; color: #000; font-size: 9px; line-height: 1.35; }
    .t-totrow { display: flex; justify-content: space-between; margin: 3px 0; font-size: 10px; }
    .t-totrow .n { text-align: right; font-weight: 700; }
    .t-grand {
      text-align: right;
      font-size: 19px;
      font-weight: 900;
      margin: 8px 0 6px;
      letter-spacing: -0.02em;
    }
    .t-qr-wrap { text-align: center; margin: 6px 0 3px; }
    .t-qr-img { width: 24mm; max-width: 72%; height: auto; image-rendering: pixelated; margin: 0 auto; display: block; }
    .t-qr-fallback { margin-top: 6px; word-break: break-all; }
    .t-footer { font-size: 9px; line-height: 1.35; }
    .t-pad { margin-top: 6px; }
`;

function renderItemsTable(items: unknown): string {
    if (!Array.isArray(items) || items.length === 0) return "";
    const rows: string[] = [];
    rows.push(
        "<table><thead><tr><th>Ítem</th><th class='n'>Cant</th><th class='n'>P.U.</th><th class='n'>Total</th></tr></thead><tbody>"
    );
    for (const row of items) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const desc = String(
            r.description ??
                r.name ??
                r.product ??
                r.product_name ??
                r.productName ??
                r.item ??
                ""
        );
        const qty = r.quantity ?? r.qty ?? r.cantidad ?? "";
        const price = r.unit_price ?? r.unitPrice ?? r.price ?? r.precio ?? "";
        const total = r.total ?? r.importe ?? r.subtotal ?? "";
        rows.push(
            `<tr><td>${escapeHtml(desc)}</td><td class='n'>${escapeHtml(String(qty))}</td><td class='n'>${escapeHtml(
                String(price)
            )}</td><td class='n'>${escapeHtml(String(total))}</td></tr>`
        );
    }
    rows.push("</tbody></table>");
    return rows.join("");
}

export async function documentDataJsonToHtml(jsonString: string): Promise<string> {
    let doc: Record<string, unknown>;
    try {
        doc = JSON.parse(jsonString) as Record<string, unknown>;
    } catch {
        return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Documento</title></head><body><pre>${escapeHtml(
            jsonString.slice(0, 4000)
        )}</pre></body></html>`;
    }

    if (looksLikeThermalDocumentPayload(doc)) {
        const body = await renderThermalDocumentStyle(doc);
        const title = String(doc.type ?? doc.document_type ?? doc.tipo ?? "Documento");
        const css = thermalDocumentCss;
        return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(
            title
        )}</title><style>${css}</style></head><body class="ticket">${body}</body></html>`;
    }

    const parts: string[] = [];
    const logoHtml = logoImgHtml(doc);
    if (logoHtml) parts.push(logoHtml);

    const title = String(doc.type ?? doc.document_type ?? doc.tipo ?? "Documento");
    parts.push(`<h1>${escapeHtml(title)}</h1>`);

    const nestedSkip = new Set([
        "logo_base64",
        "logo_url",
        "logo",
        "items",
        "lines",
        "details",
        "detalles",
        "operation_details",
    ]);

    const company = (doc.company ?? doc.emisor ?? doc.branch) as Record<string, unknown> | undefined;
    if (company && typeof company === "object") {
        parts.push('<div class="block"><div class="block-title">Datos comercio</div>');
        parts.push(renderFlatObject(company, new Set(["logo", "logo_base64"])));
        parts.push("</div>");
    }

    const customer = (doc.customer ?? doc.cliente ?? doc.person) as Record<string, unknown> | undefined;
    if (customer && typeof customer === "object") {
        parts.push('<div class="block"><div class="block-title">Cliente</div>');
        parts.push(renderFlatObject(customer, new Set()));
        parts.push("</div>");
    }

    parts.push(
        renderFlatObject(doc, new Set([...nestedSkip, "company", "emisor", "branch", "customer", "cliente", "person"]))
    );

    const items = doc.items ?? doc.lines ?? doc.details ?? doc.detalles ?? doc.operation_details;
    const table = renderItemsTable(items);
    if (table) {
        parts.push('<div class="block"><div class="block-title">Detalle</div>');
        parts.push(table);
        parts.push("</div>");
    }

    /* Térmicas 1-bit: grises y fondos suaves a veces salen en blanco con drivers GDI. Monocromo sólido y print-color-adjust. */
    /* Papel térmico 80×80 mm (mismo criterio que pageSize en main process). */
    const css = `
    @page { margin: 1.5mm; size: 80mm auto; }
    *, *::before, *::after { box-sizing: border-box; }
    html {
      width: 100%;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      width: 100%;
      max-width: 100%;
      margin: 0;
      padding: 2px 2px;
      font-size: 9px;
      line-height: 1.2;
      color: #000;
      background: #fff !important;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .logo-wrap { text-align: center; margin-bottom: 2px; }
    .logo { max-width: 100%; max-height: 32px; object-fit: contain; -webkit-print-color-adjust: exact; }
    h1 { font-size: 10px; text-align: center; margin: 2px 0 4px; font-weight: 800; color: #000; }
    .block { margin-bottom: 3px; }
    .block-title {
      font-weight: 700;
      font-size: 8px;
      text-transform: uppercase;
      color: #000;
      margin-bottom: 2px;
      border-bottom: 1px solid #000;
    }
    .kv { display: flex; justify-content: space-between; gap: 4px; margin: 1px 0; font-size: 8px; }
    .kv .k, .kv .v { color: #000; }
    .kv .v { text-align: right; font-weight: 600; flex: 1; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; font-size: 8px; margin-top: 2px; }
    th, td { border: 1px solid #000; padding: 2px; vertical-align: top; color: #000; }
    th { background: #fff; font-size: 7px; font-weight: 700; }
    td.n, th.n { text-align: right; white-space: nowrap; }
  `;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>${css}</style></head><body>${parts.join(
        ""
    )}</body></html>`;
}
