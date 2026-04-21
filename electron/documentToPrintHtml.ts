/**
 * Convierte el JSON de document_data (backend) en HTML imprimible (80mm típico).
 * Estructura flexible: acepta distintas claves de ítems y objetos anidados comunes.
 */

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

export function documentDataJsonToHtml(jsonString: string): string {
    let doc: Record<string, unknown>;
    try {
        doc = JSON.parse(jsonString) as Record<string, unknown>;
    } catch {
        return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Documento</title></head><body><pre>${escapeHtml(
            jsonString.slice(0, 4000)
        )}</pre></body></html>`;
    }

    const parts: string[] = [];
    const logo = typeof doc.logo_base64 === "string" ? doc.logo_base64 : "";
    if (logo) {
        parts.push(
            `<div class="logo-wrap"><img class="logo" src="data:image/png;base64,${logo}" alt=""/></div>`
        );
    }

    const title = String(doc.type ?? doc.document_type ?? doc.tipo ?? "Documento");
    parts.push(`<h1>${escapeHtml(title)}</h1>`);

    const nestedSkip = new Set([
        "logo_base64",
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
    @page { margin: 1.5mm; size: 80mm 80mm; }
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
