/**
 * Descarga de comprobantes SUNAT / tuf4ctur4 sin navegar fuera de SumApp.
 *
 * PDF oficial: GET print_invoice/{sunatOperationId}/ → se guarda tal cual
 * (formato CPE configurado para el RUC en tuf4ctur4).
 *
 * fallbackHtml solo se usa si no hay URL o la descarga remota falló por completo.
 */

import { app, ipcMain, net, shell } from "electron";
import * as fs from "fs";
import * as path from "path";
import log from "electron-log";
import { htmlToA4PdfBuffer } from "./officialA4Pdf";

function sanitizeFilename(filename: string): string {
    const base = path.basename(String(filename || "archivo.xml"));
    return base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
}

function sanitizePdfFilename(filename: string): string {
    const base = path.basename(String(filename || "comprobante.pdf"));
    const withExt = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
    return withExt.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
}

function resolveDownloadPath(filename: string): string {
    const safeName = sanitizeFilename(filename);
    const downloadsDir = app.getPath("downloads");
    let filePath = path.join(downloadsDir, safeName);
    if (!fs.existsSync(filePath)) return filePath;

    const parsed = path.parse(safeName);
    const stamp = Date.now();
    return path.join(
        downloadsDir,
        `${parsed.name}_${stamp}${parsed.ext || ""}`,
    );
}

function resolvePdfDownloadPath(filename: string): string {
    const safeName = sanitizePdfFilename(filename);
    const downloadsDir = app.getPath("downloads");
    let filePath = path.join(downloadsDir, safeName);
    if (!fs.existsSync(filePath)) return filePath;

    const parsed = path.parse(safeName);
    const stamp = Date.now();
    return path.join(
        downloadsDir,
        `${parsed.name}_${stamp}${parsed.ext || ".pdf"}`,
    );
}

function isPdfBuffer(buffer: Buffer): boolean {
    return (
        buffer.length >= 5 &&
        buffer.subarray(0, 5).toString("ascii") === "%PDF-"
    );
}

/** Descarga el PDF oficial desde tuf4ctur4 (respuesta directa application/pdf). */
async function fetchOfficialDocumentPdf(
    url: string,
): Promise<{ ok: true; buffer: Buffer } | { ok: false; message: string }> {
    const target = String(url || "").trim();
    if (!target) {
        return { ok: false, message: "URL vacía." };
    }

    try {
        log.info(`[sunat] GET PDF oficial: ${target}`);
        const response = await net.fetch(target, {
            headers: {
                Accept: "application/pdf,application/octet-stream,*/*",
            },
        });

        if (!response.ok) {
            return {
                ok: false,
                message: `No se pudo descargar el PDF (HTTP ${response.status}).`,
            };
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length < 128) {
            return { ok: false, message: "El PDF descargado está vacío." };
        }

        if (!isPdfBuffer(buffer)) {
            const contentType = String(
                response.headers.get("content-type") || "",
            ).toLowerCase();
            log.warn(
                `[sunat] Respuesta no es PDF (${contentType}, ${buffer.length} bytes)`,
            );
            return {
                ok: false,
                message:
                    "El servidor no devolvió un PDF válido. Verifique sunatOperationId.",
            };
        }

        return { ok: true, buffer };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        log.error("[sunat] Error fetch PDF oficial:", msg);
        return { ok: false, message: msg };
    }
}

async function fetchUrlToBuffer(
    url: string,
): Promise<{ ok: true; buffer: Buffer } | { ok: false; message: string }> {
    const target = String(url || "").trim();
    if (!target) {
        return { ok: false, message: "URL vacía." };
    }

    try {
        const response = await net.fetch(target);
        if (!response.ok) {
            return {
                ok: false,
                message: `No se pudo descargar (HTTP ${response.status}).`,
            };
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length === 0) {
            return { ok: false, message: "El archivo descargado está vacío." };
        }
        return { ok: true, buffer };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, message: msg };
    }
}

export function registerSunatDownloadHandler(): void {
    ipcMain.removeHandler("open-external-url");
    ipcMain.handle(
        "open-external-url",
        async (_event, payload: { url?: string | null }) => {
            const url = String(payload?.url || "").trim();
            if (!url) {
                return { ok: false, message: "URL vacía." };
            }
            try {
                log.info(`[sunat] Abriendo en navegador externo: ${url}`);
                await shell.openExternal(url);
                return { ok: true, message: "Enlace abierto en el navegador." };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                log.error("[sunat] Error openExternal:", msg);
                return { ok: false, message: msg };
            }
        },
    );

    ipcMain.removeHandler("open-official-document-view");

    ipcMain.removeHandler("download-official-document-pdf");
    ipcMain.handle(
        "download-official-document-pdf",
        async (
            _event,
            payload: {
                url?: string | null;
                filename?: string | null;
                fallbackHtml?: string | null;
            },
        ) => {
            const url = String(payload?.url || "").trim();
            const filename = String(
                payload?.filename || "comprobante.pdf",
            ).trim();
            const fallbackHtml = String(payload?.fallbackHtml ?? "").trim();
            if (!url && !fallbackHtml) {
                return { ok: false, message: "Sin URL ni plantilla A4." };
            }

            try {
                let pdfBuffer: Buffer | null = null;

                if (url) {
                    const fetched = await fetchOfficialDocumentPdf(url);
                    if (fetched.ok) {
                        pdfBuffer = fetched.buffer;
                        log.info(
                            `[sunat] PDF oficial tuf4ctur4 (${pdfBuffer.length} bytes)`,
                        );
                    } else if (!fallbackHtml) {
                        return fetched;
                    }
                }

                if (!pdfBuffer) {
                    if (!fallbackHtml) {
                        return {
                            ok: false,
                            message:
                                "No se pudo obtener el PDF A4 del comprobante.",
                        };
                    }
                    log.info("[sunat] Generando PDF A4 local…");
                    pdfBuffer = await htmlToA4PdfBuffer(fallbackHtml);
                }

                const filePath = resolvePdfDownloadPath(filename);
                fs.writeFileSync(filePath, pdfBuffer);
                log.info(
                    `[sunat] PDF guardado en ${filePath} (${pdfBuffer.length} bytes)`,
                );

                return {
                    ok: true,
                    path: filePath,
                    message: `PDF guardado en Descargas: ${path.basename(filePath)}`,
                };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                log.error("[sunat] Error guardando PDF:", msg);
                return { ok: false, message: msg };
            }
        },
    );

    ipcMain.removeHandler("download-remote-file");
    ipcMain.handle(
        "download-remote-file",
        async (
            _event,
            payload: { url?: string | null; filename?: string | null },
        ) => {
            const url = String(payload?.url || "").trim();
            const filename = String(payload?.filename || "archivo.xml").trim();
            if (!url) {
                return { ok: false, message: "URL vacía." };
            }

            try {
                log.info(`[sunat] Descargando: ${url}`);
                const fetched = await fetchUrlToBuffer(url);
                if (!fetched.ok) {
                    return fetched;
                }

                const filePath = resolveDownloadPath(filename);
                fs.writeFileSync(filePath, fetched.buffer);
                log.info(
                    `[sunat] Guardado en ${filePath} (${fetched.buffer.length} bytes)`,
                );
                return {
                    ok: true,
                    path: filePath,
                    message: `Archivo guardado en Descargas: ${path.basename(filePath)}`,
                };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                log.error("[sunat] Error descargando archivo:", msg);
                return { ok: false, message: msg };
            }
        },
    );
}
