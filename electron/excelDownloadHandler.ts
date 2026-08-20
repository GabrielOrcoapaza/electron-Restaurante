/**
 * Guarda archivos Excel en la carpeta Descargas / Downloads del usuario.
 */

import { ipcMain, shell } from "electron";
import * as fs from "fs";
import * as path from "path";
import log from "electron-log";
import {
    formatSavedInDownloadsMessage,
    resolveUniqueDownloadFilePath,
} from "./downloadPaths";

function sanitizeExcelFilename(filename: string): string {
    const base = path.basename(String(filename || "reporte.xlsx"));
    const withExt = base.toLowerCase().endsWith(".xlsx") ? base : `${base}.xlsx`;
    return withExt.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
}

export function registerExcelDownloadHandler(): void {
    ipcMain.removeHandler("download-excel-file");
    ipcMain.handle(
        "download-excel-file",
        async (_event, payload: { base64: string; filename: string }) => {
            const base64 = String(payload?.base64 || "").trim();
            const filename = String(payload?.filename || "reporte.xlsx");

            if (!base64) {
                return { ok: false, message: "No hay datos del archivo Excel." };
            }

            try {
                const buffer = Buffer.from(base64, "base64");
                if (buffer.length < 32) {
                    return { ok: false, message: "El archivo Excel generado es inválido." };
                }

                const filePath = resolveUniqueDownloadFilePath(
                    filename,
                    sanitizeExcelFilename,
                );
                fs.writeFileSync(filePath, buffer);
                log.info(`[excel] Archivo guardado en ${filePath} (${buffer.length} bytes)`);

                try {
                    shell.showItemInFolder(filePath);
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    log.warn("[excel] No se pudo abrir la carpeta de descargas:", msg);
                }

                return {
                    ok: true,
                    path: filePath,
                    message: formatSavedInDownloadsMessage(filePath),
                };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                log.error("[excel] Error guardando archivo:", msg);
                return { ok: false, message: msg };
            }
        },
    );

    log.info("[main] Handler IPC registrado: download-excel-file");
}
