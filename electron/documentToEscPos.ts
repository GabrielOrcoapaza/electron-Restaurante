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
    MODE_2H:      Buffer.from([ESC, 0x21, 0x10]),
    MODE_B2H:     Buffer.from([ESC, 0x21, 0x18]),
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

async function resolveLogoBase64(doc: Record<string, unknown>): Promise<string | null> {
    const embedded =
        typeof doc.logo_base64 === "string" ? doc.logo_base64.trim() : "";
    if (embedded) {
        return embedded.replace(/^data:image\/\w+;base64,/, "");
    }

    const url = typeof doc.logo_url === "string" ? doc.logo_url.trim() : "";
    if (!url) return null;

    try {
        const { net } = require("electron") as typeof import("electron");
        const response = await net.fetch(url);
        if (!response.ok) return null;
        const buf = Buffer.from(await response.arrayBuffer());
        if (buf.length === 0) return null;
        return buf.toString("base64");
    } catch (error) {
        console.error("[ESC/POS] Error descargando logo_url:", error);
        return null;
    }
}

function resolveQrData(doc: Record<string, unknown>): string {
    const raw =
        doc.qr_data ??
        doc.qrData ??
        doc.hash_code ??
        doc.hashCode ??
        "";
    return String(raw).trim();
}

async function logoToEscPos(logo_base64: string, paperWidthMm: number): Promise<Buffer> {
    try {
        const sharp = require('sharp');
        
        // Limpiar base64
        const cleanBase64 = logo_base64.replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(cleanBase64, "base64");
        
        // Tamaños máximos para el logo
        const maxWidth = paperWidthMm >= 80 ? 320 : 240;
        const maxHeight = paperWidthMm >= 80 ? 160 : 120;
        const paperPx = paperWidthMm >= 80 ? 576 : 384;
        const widthBytes = paperPx / 8; // 72 bytes para 80mm (576 dots)
        
        // Procesar imagen con sharp: redimensionar, convertir a escala de grises y a raw (1 byte por píxel)
        const { data, info } = await sharp(buf)
            .resize(maxWidth, maxHeight, { fit: 'inside' })
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });
        
        const width = info.width;
        const height = info.height;
        
        // Calcular offset para centrar horizontalmente (en píxeles)
        const offsetPx = Math.max(0, Math.floor((paperPx - width) / 2));
        
        // Crear el buffer de datos de la imagen (1 bit por píxel)
        // El ancho debe ser siempre widthBytes (72 para 80mm)
        const rasterData = Buffer.alloc(widthBytes * height, 0);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const gray = data[y * width + x];
                if (gray < 128) { // Píxel negro
                    const targetX = x + offsetPx;
                    if (targetX < paperPx) {
                        const byteIdx = y * widthBytes + Math.floor(targetX / 8);
                        const bitIdx = 7 - (targetX % 8);
                        rasterData[byteIdx] |= (1 << bitIdx);
                    }
                }
            }
        }
        
        // Comando ESC/POS: GS v 0 m xL xH yL yH d1...dk
        // m = 0 (Normal)
        // xL, xH = Ancho en bytes (72 para 80mm)
        // yL, yH = Alto en puntos (height)
        const xL = widthBytes & 0xFF;
        const xH = (widthBytes >> 8) & 0xFF;
        const yL = height & 0xFF;
        const yH = (height >> 8) & 0xFF;
        
        const header = Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
        
        return Buffer.concat([
            CMD.ALIGN_CENTER,
            Buffer.from([0x0A]), // Salto de línea antes
            header,
            rasterData,
            Buffer.from([0x0A]), // Salto de línea después
            CMD.ALIGN_LEFT
        ]);
        
    } catch (error) {
        console.error("Error en logoToEscPos (sharp):", error);
        return Buffer.alloc(0);
    }
}

function qrToEscPos(qrData: string, paperWidthMm: number): Buffer {
    const dataBytes = Buffer.from(qrData, "utf-8");
    
    // ✅ IGUAL QUE PYTHON: tamaño 6 para 80mm, 4 para 58mm
    const qrModuleSize = paperWidthMm >= 80 ? 6 : 4;
    
    const storeLen = dataBytes.length + 3;
    const storePL = storeLen & 0xff;
    const storePH = (storeLen >> 8) & 0xff;
    
    return Buffer.concat([
        CMD.ALIGN_CENTER,
        // Modelo QR (Model 2)
        Buffer.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
        // Tamaño del módulo
        Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, qrModuleSize]),
        // Nivel de corrección (M)
        Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),
        // Almacenar datos
        Buffer.from([GS, 0x28, 0x6b, storePL, storePH, 0x31, 0x50, 0x30]),
        dataBytes,
        // Imprimir QR
        Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
        CMD.ALIGN_LEFT,
        Buffer.from([0x0A]),
    ]);
}

function isCashClosurePayload(doc: Record<string, unknown>): boolean {
    const t = String(doc.type ?? "").toUpperCase();
    if (t === "CASH_CLOSURE") return true;
    const closure = doc.closure ?? doc.cierre;
    const methods = doc.payment_methods ?? doc.paymentMethods;
    return closure != null && methods != null;
}

type PaymentMethodRow = { code: string; data: Record<string, unknown> };

function normalizePaymentMethods(doc: Record<string, unknown>): PaymentMethodRow[] {
    const raw = doc.payment_methods ?? doc.paymentMethods;
    if (!raw) return [];

    if (Array.isArray(raw)) {
        const rows: PaymentMethodRow[] = [];
        for (const entry of raw) {
            if (Array.isArray(entry) && entry.length >= 2) {
                rows.push({
                    code: String(entry[0] ?? ""),
                    data: (entry[1] ?? {}) as Record<string, unknown>,
                });
            } else if (entry && typeof entry === "object") {
                const o = entry as Record<string, unknown>;
                rows.push({
                    code: String(o.code ?? o.method ?? o.id ?? ""),
                    data: o,
                });
            }
        }
        return rows;
    }

    if (typeof raw === "object") {
        return Object.entries(raw as Record<string, unknown>).map(([code, data]) => ({
            code,
            data: (data && typeof data === "object" ? data : {}) as Record<string, unknown>,
        }));
    }

    return [];
}

/** Cierre de caja — mismo layout que print_cash_closure() del cliente Raspberry Pi. */
async function buildCashClosureEscPos(
    doc: Record<string, unknown>,
    paperWidthMm: number,
): Promise<Buffer> {
    const e = new EscPos();
    e.cmd(CMD.INIT).cmd(CMD.MODE_NORMAL);

    if (typeof doc.logo_base64 === "string" && doc.logo_base64) {
        e.raw(await logoToEscPos(doc.logo_base64, paperWidthMm));
    }

    const branch = (doc.branch ?? {}) as Record<string, unknown>;
    const company = cleanText(String(branch.company ?? ""));
    const branchName = cleanText(String(branch.name ?? ""));
    if (company) e.cmd(CMD.MODE_BOLD).cmd(CMD.ALIGN_CENTER).text(company).cmd(CMD.MODE_NORMAL);
    if (branchName) e.cmd(CMD.ALIGN_CENTER).text(branchName);
    if (branch.ruc) e.cmd(CMD.ALIGN_CENTER).text(`RUC: ${cleanText(String(branch.ruc))}`);

    e.separator("=");

    e.cmd(CMD.MODE_B2H).cmd(CMD.ALIGN_CENTER).text("CIERRE DE CAJA").cmd(CMD.MODE_NORMAL);

    const closure = (doc.closure ?? doc.cierre ?? {}) as Record<string, unknown>;
    const closureNum = closure.number ?? closure.closure_number ?? closure.closureNumber ?? 0;
    e.cmd(CMD.MODE_BOLD).cmd(CMD.ALIGN_CENTER).text(`CIERRE #${closureNum}`).cmd(CMD.MODE_NORMAL);

    e.separator("=");

    const user = (doc.user ?? doc.usuario ?? {}) as Record<string, unknown>;
    e.cmd(CMD.ALIGN_LEFT).cmd(CMD.MODE_BOLD).text(`Cajero: ${cleanText(String(user.name ?? user.full_name ?? user.fullName ?? ""))}`).cmd(CMD.MODE_NORMAL);
    e.cmd(CMD.ALIGN_LEFT).text(`Rol   : ${cleanText(String(user.role ?? ""))}`);

    const cashRegister = (doc.cash_register ?? doc.cashRegister ?? {}) as Record<string, unknown>;
    e.cmd(CMD.ALIGN_LEFT).text(`Caja  : ${cleanText(String(cashRegister.name ?? ""))}`);

    e.separator2("-");

    const closedAt = cleanText(String(closure.closed_at ?? closure.closedAt ?? ""));
    if (closedAt) e.cmd(CMD.ALIGN_LEFT).text(`Fecha: ${closedAt}`);

    e.separator("=");

    e.cmd(CMD.MODE_BOLD).cmd(CMD.ALIGN_CENTER).text("DETALLE POR METODO").cmd(CMD.MODE_NORMAL);
    e.separator2("-");

    for (const { code, data: methodData } of normalizePaymentMethods(doc)) {
        const methodName = cleanText(String(methodData.name ?? code));
        const income = Number(methodData.income ?? 0);
        const expense = Number(methodData.expense ?? 0);
        const net = Number(methodData.net ?? income - expense);

        e.raw(Buffer.from([LF]));
        e.cmd(CMD.MODE_B2H).cmd(CMD.ALIGN_CENTER).text(`>>> ${methodName} <<<`).cmd(CMD.MODE_NORMAL);
        e.cmd(CMD.MODE_B2H).cmd(CMD.ALIGN_LEFT).text(`INGRESOS: S/ ${income.toFixed(2).padStart(12)}`).cmd(CMD.MODE_NORMAL);
        e.cmd(CMD.MODE_B2H).cmd(CMD.ALIGN_LEFT).text(`EGRESOS : S/ ${expense.toFixed(2).padStart(12)}`).cmd(CMD.MODE_NORMAL);
        e.cmd(CMD.MODE_B2H).cmd(CMD.ALIGN_LEFT).text(`NETO    : S/ ${net.toFixed(2).padStart(12)}`).cmd(CMD.MODE_NORMAL);
        e.raw(Buffer.from([LF]));
        e.separator2("-");
    }

    const totals = (doc.totals ?? {}) as Record<string, unknown>;
    const totalIncome = Number(totals.total_income ?? totals.totalIncome ?? 0);
    const totalExpense = Number(totals.total_expense ?? totals.totalExpense ?? 0);
    const netTotal = Number(totals.net_total ?? totals.netTotal ?? totalIncome - totalExpense);

    e.separator("=");
    e.cmd(CMD.MODE_BOLD).cmd(CMD.ALIGN_LEFT).text(`TOTAL INGRESOS: S/ ${totalIncome.toFixed(2).padStart(10)}`).cmd(CMD.MODE_NORMAL);
    e.cmd(CMD.MODE_BOLD).cmd(CMD.ALIGN_LEFT).text(`TOTAL EGRESOS : S/ ${totalExpense.toFixed(2).padStart(10)}`).cmd(CMD.MODE_NORMAL);

    e.raw(Buffer.from([LF]));
    e.cmd(CMD.MODE_B2H).cmd(CMD.ALIGN_CENTER).text("TOTAL NETO:").cmd(CMD.MODE_NORMAL);
    e.cmd(CMD.MODE_B2H).cmd(CMD.ALIGN_CENTER).text(`S/ ${netTotal.toFixed(2)}`).cmd(CMD.MODE_NORMAL);

    e.separator("=");

    const now = new Date();
    const dateStr = now.toLocaleString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    e.cmd(CMD.ALIGN_CENTER).text(`Impreso: ${dateStr}`);

    e.cmd(CMD.FEED5).cmd(CMD.CUT_PARTIAL);

    return e.toBuffer();
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

    if (isCashClosurePayload(doc)) {
        console.log("[ESC/POS] Tipo CASH_CLOSURE → formato cierre de caja");
        return buildCashClosureEscPos(doc, paperWidthMm);
    }

    const e = new EscPos();
    e.cmd(CMD.INIT).cmd(CMD.MODE_NORMAL);

    const logoBase64 = await resolveLogoBase64(doc);
    const qrData = resolveQrData(doc);

    console.log("[ESC/POS] Logo presente:", !!logoBase64);
    console.log("[ESC/POS] QR data presente:", !!qrData);
    console.log("[ESC/POS] Paper width:", paperWidthMm);

    // LOGO
    if (logoBase64) {
        e.raw(await logoToEscPos(logoBase64, paperWidthMm));
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
    if (qrData) e.raw(qrToEscPos(qrData, paperWidthMm));

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