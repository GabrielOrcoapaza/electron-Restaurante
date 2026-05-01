/**
 * documentToEscPos.ts
 * Genera comandos ESC/POS desde el JSON del backend.
 * Produce salida IDÉNTICA al cliente Raspberry Pi (printer_client.py).
 *
 * Coloca este archivo en el mismo directorio que main.ts
 * Instalar: npm install jimp
 */

const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

const CMD = {
    INIT:         Buffer.from([ESC, 0x40]),
    ALIGN_LEFT:   Buffer.from([ESC, 0x61, 0x00]),
    ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
    ALIGN_RIGHT:  Buffer.from([ESC, 0x61, 0x02]),
    MODE_NORMAL:  Buffer.from([ESC, 0x21, 0x00]),
    MODE_BOLD:    Buffer.from([ESC, 0x21, 0x08]),
    MODE_2H2W:    Buffer.from([ESC, 0x21, 0x30]),
    MODE_B2H2W:   Buffer.from([ESC, 0x21, 0x38]),
    FEED5:        Buffer.from([ESC, 0x64, 0x05]),
    CUT_PARTIAL:  Buffer.from([GS,  0x56, 0x01]),
    BEEP:         Buffer.from([ESC, 0x42, 0x03, 0x05]),
};

function cleanText(text: string): string {
    if (!text) return "";
    text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const repl: Record<string, string> = {
        "€":"EUR","£":"GBP","¥":"YEN","°":"o","º":"o","ª":"a",
        "™":"TM","®":"(R)","©":"(C)","½":"1/2","¼":"1/4","¾":"3/4",
        "×":"x","÷":"/","±":"+/-","≤":"<=","≥":">=","≠":"!=",
        "∞":"INF","√":"sqrt","π":"pi","Ñ":"N","ñ":"n",
    };
    for (const [from, to] of Object.entries(repl)) text = text.split(from).join(to);
    return text.split("").map(c => {
        const code = c.charCodeAt(0);
        return (code >= 32 && code <= 126) ? c : " ";
    }).join("");
}

function num2(v: unknown): string {
    const x = Number(v);
    return Number.isFinite(x) ? x.toFixed(2) : String(v ?? "");
}

class EscPos {
    private chunks: Buffer[] = [];

    raw(buf: Buffer): this { this.chunks.push(buf); return this; }
    cmd(buf: Buffer): this { return this.raw(buf); }

    text(s: string, newline = true): this {
        const clean = cleanText(s);
        const bytes: number[] = [];
        for (const char of clean) {
            const code = char.charCodeAt(0);
            bytes.push(code >= 32 && code <= 126 ? code : 0x3f);
        }
        if (newline) bytes.push(LF);
        this.chunks.push(Buffer.from(bytes));
        return this;
    }

    separator(char = "=", width = 48): this {
        return this.cmd(CMD.ALIGN_CENTER).text(char.repeat(width));
    }

    separator2(char = "-", width = 48): this {
        return this.cmd(CMD.ALIGN_CENTER).text(char.repeat(width));
    }

    itemLine(qty: string, name: string, price: string, total: string): this {
        const q = qty.slice(0, 4).padEnd(4);
        const d = (name.length > 24 ? name.slice(0, 24) : name).padEnd(24);
        const p = price.padStart(7);
        const t = total.padStart(8);
        const line = `${q}  ${d} ${p} ${t}`;
        this.cmd(CMD.ALIGN_LEFT);
        const bytes: number[] = [];
        for (const c of line) {
            const code = c.charCodeAt(0);
            bytes.push(code >= 32 && code <= 126 ? code : 0x20);
        }
        bytes.push(LF);
        this.chunks.push(Buffer.from(bytes));
        return this;
    }

    amountLine(label: string, amount: number, negative = false): this {
        const lbl    = cleanText(label).padStart(30);
        const amtStr = `S/ ${negative ? "-" : ""}${amount.toFixed(2)}`.padStart(17);
        const line   = `${lbl}:${amtStr}`;
        this.cmd(CMD.ALIGN_LEFT);
        const bytes: number[] = [];
        for (const c of line) {
            const code = c.charCodeAt(0);
            bytes.push(code >= 32 && code <= 126 ? code : 0x20);
        }
        bytes.push(LF);
        this.chunks.push(Buffer.from(bytes));
        return this;
    }

    toBuffer(): Buffer { return Buffer.concat(this.chunks); }
}

async function logoToEscPos(logo_base64: string, paperWidthMm: number): Promise<Buffer> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Jimp = require("jimp");
        /** Logo más pequeño en datos = menos CPU y menos bytes al puerto (sigue viéndose bien en térmica). */
        const maxW    = paperWidthMm >= 80 ? 256 : 192;
        const maxH    = paperWidthMm >= 80 ? 96 : 80;
        const paperPx = paperWidthMm >= 80 ? 576 : 384;
        const widthBytes = Math.ceil(paperPx / 8);

        const buf = Buffer.from(logo_base64, "base64");
        const img = await Jimp.read(buf);

        let iw = img.getWidth();
        let ih = img.getHeight();
        const scale = Math.min(1, maxW / iw, maxH / ih);
        iw = Math.max(1, Math.round(iw * scale));
        ih = Math.max(1, Math.round(ih * scale));
        img.resize(iw, ih);
        img.grayscale();
        img.contrast(0.2);

        const rgba = img.bitmap.data as Buffer;
        const stride = iw * 4;
        const offset = Math.max(0, Math.floor((paperPx - iw) / 2));

        const rows: Buffer[] = [];
        for (let y = 0; y < ih; y++) {
            const rowOff = y * stride;
            const lineData: number[] = [];
            for (let xByte = 0; xByte < widthBytes; xByte++) {
                let byteVal = 0;
                for (let bit = 0; bit < 8; bit++) {
                    const x = xByte * 8 + bit;
                    if (x >= offset && x < offset + iw) {
                        const xi = x - offset;
                        const r = rgba[rowOff + (xi << 2)];
                        if (r < 128) byteVal |= 1 << (7 - bit);
                    }
                }
                lineData.push(byteVal);
            }
            const nL = widthBytes & 0xff;
            const nH = (widthBytes >> 8) & 0xff;
            rows.push(Buffer.from([ESC, 0x2a, 0x00, nL, nH, ...lineData, LF]));
        }

        return Buffer.concat([CMD.ALIGN_CENTER, Buffer.from([LF]), ...rows, Buffer.from([LF])]);
    } catch {
        return Buffer.alloc(0);
    }
}

function qrToEscPos(qrData: string, _paperWidthMm: number): Buffer {
    const dataBytes = Buffer.from(qrData, "utf-8");
    /** Punto por módulo del QR (1–16). Bajo = QR pequeño; subir a 3 si `qr_data` es muy largo y no escanea bien. */
    const qrModuleSize = 2;
    const storeLen     = dataBytes.length + 3;
    const storePL      = storeLen & 0xff;
    const storePH      = (storeLen >> 8) & 0xff;

    return Buffer.concat([
        CMD.ALIGN_CENTER,
        Buffer.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
        Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, qrModuleSize]),
        Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),
        Buffer.from([GS, 0x28, 0x6b, storePL, storePH, 0x31, 0x50, 0x30]),
        dataBytes,
        Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
        CMD.ALIGN_LEFT,
        Buffer.from([LF]),
    ]);
}

export async function documentJsonToEscPos(jsonString: string, paperWidthMm = 80): Promise<Buffer> {
    let doc: Record<string, unknown>;
    try {
        doc = JSON.parse(jsonString);
    } catch {
        const e = new EscPos();
        e.cmd(CMD.INIT).text("ERROR: JSON invalido").cmd(CMD.FEED5).cmd(CMD.CUT_PARTIAL);
        return e.toBuffer();
    }

    const e = new EscPos();
    e.cmd(CMD.INIT).cmd(CMD.MODE_NORMAL);

    // LOGO
    if (typeof doc.logo_base64 === "string" && doc.logo_base64) {
        e.raw(await logoToEscPos(doc.logo_base64, paperWidthMm));
    }

    // EMPRESA
    const branch     = (doc.branch ?? {}) as Record<string, unknown>;
    const company    = cleanText(String(branch.company ?? branch.name ?? ""));
    const branchName = cleanText(String(branch.name ?? ""));

    if (company)                         e.cmd(CMD.MODE_BOLD).cmd(CMD.ALIGN_CENTER).text(company).cmd(CMD.MODE_NORMAL);
    if (branchName && branchName !== company) e.cmd(CMD.MODE_BOLD).cmd(CMD.ALIGN_CENTER).text(branchName).cmd(CMD.MODE_NORMAL);
    if (branch.ruc)     e.cmd(CMD.ALIGN_CENTER).text(`RUC: ${cleanText(String(branch.ruc))}`);
    if (branch.address) e.cmd(CMD.ALIGN_CENTER).text(cleanText(String(branch.address)));
    if (branch.phone)   e.cmd(CMD.ALIGN_CENTER).text(`Tel: ${cleanText(String(branch.phone))}`);

    e.separator("=");

    // TIPO DOCUMENTO
    const docType = cleanText(String(doc.type ?? "DOCUMENTO"));
    e.cmd(CMD.MODE_2H2W).cmd(CMD.ALIGN_CENTER).text(docType).cmd(CMD.MODE_NORMAL);

    const d = (doc.document ?? {}) as Record<string, unknown>;
    if (d.invoice) e.cmd(CMD.MODE_BOLD).cmd(CMD.ALIGN_CENTER).text(cleanText(String(d.invoice))).cmd(CMD.MODE_NORMAL);
    if (d.number)  e.cmd(CMD.MODE_BOLD).cmd(CMD.ALIGN_CENTER).text(cleanText(String(d.number))).cmd(CMD.MODE_NORMAL);

    const docDate = [d.date, d.time].filter(Boolean).map(x => cleanText(String(x))).join(" ");
    if (docDate) e.cmd(CMD.ALIGN_CENTER).text(docDate);

    // CLIENTE
    const customer = doc.customer as Record<string, unknown> | undefined;
    if (customer && (customer.name || customer.document)) {
        e.separator2("-");
        if (customer.name)     e.cmd(CMD.ALIGN_LEFT).text(`Cliente: ${cleanText(String(customer.name))}`);
        if (customer.document) {
            const dtype = cleanText(String(customer.document_type ?? "Doc"));
            e.cmd(CMD.ALIGN_LEFT).text(`${dtype}: ${cleanText(String(customer.document))}`);
        }
        if (customer.address)  e.cmd(CMD.ALIGN_LEFT).text(cleanText(String(customer.address)));
    }

    if (doc.table)  e.cmd(CMD.ALIGN_LEFT).text(`Mesa: ${cleanText(String(doc.table))}`);
    if (doc.waiter) e.cmd(CMD.ALIGN_LEFT).text(`Atendido por: ${cleanText(String(doc.waiter))}`);

    e.separator("=");

    // CABECERA ITEMS
    e.cmd(CMD.MODE_BOLD).cmd(CMD.ALIGN_LEFT)
     .text("CANT  DESCRIPCION                P.UNIT   TOTAL")
     .cmd(CMD.MODE_NORMAL);
    e.separator2("-");

    // ITEMS
    const items = doc.items;
    if (Array.isArray(items)) {
        for (const row of items) {
            if (!row || typeof row !== "object") continue;
            const r     = row as Record<string, unknown>;
            const name  = cleanText(String(r.product_name ?? r.name ?? r.description ?? ""));
            const qty   = String(Math.round(Number(r.quantity ?? r.qty ?? 1)));
            const price = num2(r.unit_price ?? r.price);
            const total = num2(r.total ?? r.subtotal);
            e.itemLine(qty, name, price, total);
            if (r.notes) e.cmd(CMD.ALIGN_LEFT).text(`      > ${cleanText(String(r.notes))}`);
        }
    }

    e.separator2("-");

    // TOTALES
    const amounts = (doc.amounts ?? {}) as Record<string, unknown>;
    const base = amounts.total_taxable ?? amounts.subtotal;
    if (base != null && Number(base) > 0) e.amountLine("OP. Gravadas", Number(base));

    const igvPct = Number(amounts.igv_percent ?? 10.5);
    if (amounts.igv != null) e.amountLine(`IGV (${igvPct.toFixed(1)}%)`, Number(amounts.igv));

    const disc = Number(amounts.discount ?? 0);
    if (disc > 0) {
        const pct    = Number(amounts.discount_percent ?? 0);
        const dLabel = pct > 0 ? `Descuento (${pct.toFixed(0)}%)` : "Descuento";
        e.amountLine(dLabel, disc, true);
    }

    e.separator("=");

    // TOTAL FINAL
    const totalAmt = Number(amounts.total ?? 0);
    e.cmd(CMD.MODE_B2H2W).cmd(CMD.ALIGN_RIGHT)
     .text(`TOTAL: S/ ${totalAmt.toFixed(2)}`)
     .cmd(CMD.MODE_NORMAL).cmd(CMD.ALIGN_LEFT)
     .raw(Buffer.from([LF]));

    // QR
    if (doc.qr_data) e.raw(qrToEscPos(String(doc.qr_data), paperWidthMm));

    // PIE
    e.raw(Buffer.from([LF]));
    e.cmd(CMD.ALIGN_CENTER).text("Gracias por su preferencia!");
    const now = new Date();
    const dateStr = now.toLocaleString("es-PE", {
        day:"2-digit", month:"2-digit", year:"numeric",
        hour:"2-digit", minute:"2-digit", second:"2-digit",
    });
    e.cmd(CMD.ALIGN_CENTER).text(`Impreso: ${dateStr}`);
    e.cmd(CMD.ALIGN_CENTER).text("https://sumapp.pe");

    // CORTE
    e.cmd(CMD.FEED5).cmd(CMD.CUT_PARTIAL).cmd(CMD.BEEP);

    return e.toBuffer();
}