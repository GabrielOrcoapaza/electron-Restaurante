/**
 * Ruta de la carpeta Descargas del usuario (Explorador de archivos en Windows).
 */

import { app } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function getUserDownloadsDir(): string {
	try {
		const downloadsDir = app.getPath("downloads");
		if (downloadsDir?.trim()) {
			fs.mkdirSync(downloadsDir, { recursive: true });
			return downloadsDir;
		}
	} catch {
		/* fallback abajo */
	}

	const fallback = path.join(os.homedir(), "Downloads");
	fs.mkdirSync(fallback, { recursive: true });
	return fallback;
}

export function resolveUniqueDownloadFilePath(
	filename: string,
	sanitize: (name: string) => string,
): string {
	const safeName = sanitize(filename);
	const downloadsDir = getUserDownloadsDir();
	let filePath = path.join(downloadsDir, safeName);
	if (!fs.existsSync(filePath)) return filePath;

	const parsed = path.parse(safeName);
	const stamp = Date.now();
	return path.join(
		downloadsDir,
		`${parsed.name}_${stamp}${parsed.ext || ""}`,
	);
}

export function formatSavedInDownloadsMessage(filePath: string): string {
	const downloadsDir = getUserDownloadsDir();
	const fileName = path.basename(filePath);
	return `Archivo guardado en Descargas (${downloadsDir}): ${fileName}`;
}
