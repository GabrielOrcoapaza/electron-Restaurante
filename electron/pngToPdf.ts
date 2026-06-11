/**
 * PDF de una página con imagen JPEG embebida (captura del ticket).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require("sharp") as typeof import("sharp");

/** Convierte PNG capturado a PDF de una sola página. */
export async function pngBufferToPdfBuffer(pngBuffer: Buffer): Promise<Buffer> {
    const meta = await sharp(pngBuffer).metadata();
    const widthPx = meta.width ?? 272;
    const heightPx = meta.height ?? 400;

    const jpegBuffer = await sharp(pngBuffer)
        .jpeg({ quality: 92 })
        .toBuffer();

    const pageW = Number(((widthPx * 72) / 96).toFixed(2));
    const pageH = Number(((heightPx * 72) / 96).toFixed(2));
    const contentStream = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im1 Do Q`;

    const parts: Buffer[] = [];
    const offsets: number[] = new Array(6).fill(0);
    let pos = 0;

    const append = (chunk: string | Buffer) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
        parts.push(buf);
        pos += buf.length;
    };

    const beginObj = (id: number, open: string) => {
        offsets[id] = pos;
        append(`${id} 0 obj\n${open}`);
    };

    const endObj = () => append("endobj\n");

    append("%PDF-1.4\n");

    beginObj(1, "<< /Type /Catalog /Pages 2 0 R >>\n");
    endObj();

    beginObj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n");
    endObj();

    beginObj(
        3,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\n`,
    );
    endObj();

    beginObj(
        4,
        `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuffer.length} >>\nstream\n`,
    );
    append(jpegBuffer);
    append("\nendstream\n");
    endObj();

    beginObj(
        5,
        `<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream\n`,
    );
    endObj();

    const xrefPos = pos;
    append("xref\n0 6\n");
    append("0000000000 65535 f \n");
    for (let i = 1; i <= 5; i += 1) {
        append(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
    }
    append(
        `trailer\n<< /Size 6 /Root 1 0 R /Info << /Producer (SumApp) >> >>\nstartxref\n${xrefPos}\n%%EOF\n`,
    );

    return Buffer.concat(parts);
}
