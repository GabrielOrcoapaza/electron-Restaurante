/**
 * Impresión vía proceso principal de Electron (ventana oculta + webContents.print).
 * Solo cuando la app corre en Electron con ipcRenderer disponible.
 */

export const PRINT_JSON_DOCUMENT_CHANNEL = "print-json-document" as const;
export const PRINT_JSON_DOCUMENT_DIALOG_CHANNEL =
	"print-json-document-dialog" as const;
export const DOCUMENT_JSON_TO_PDF_CHANNEL = "document-json-to-pdf" as const;
export const DOCUMENT_JSON_TO_HTML_CHANNEL = "document-json-to-html" as const;
export const DOWNLOAD_DOCUMENT_PDF_CHANNEL = "download-document-pdf" as const;

export type PrintJsonDocumentResult = { ok: boolean; message?: string };
export type PrintJsonDocumentDialogResult = {
	ok: boolean;
	printed?: boolean;
	cancelled?: boolean;
	message?: string;
};
export type DocumentJsonToPdfResult = {
	ok: boolean;
	base64?: string;
	message?: string;
};
export type DocumentJsonToHtmlResult = {
	ok: boolean;
	html?: string;
	message?: string;
};
export type DownloadDocumentPdfResult = {
	ok: boolean;
	path?: string;
	message?: string;
};

/** True en SumApp escritorio. No usar `userAgent.includes("electron")`: Chromium ya no lo incluye por defecto. */
export function isElectronRenderer(): boolean {
	if (typeof window === "undefined") return false;
	if (
		Boolean(
			(window as unknown as { process?: { versions?: { electron?: string } } })
				.process?.versions?.electron,
		)
	) {
		return true;
	}
	try {
		const req = (window as unknown as { require?: (id: string) => unknown }).require;
		if (typeof req === "function") {
			const electron = req("electron") as { ipcRenderer?: unknown };
			return Boolean(electron?.ipcRenderer);
		}
	} catch {
		/* no Electron */
	}
	return false;
}

export async function invokeElectronPrintJsonDocument(
	documentJson: string,
	deviceName?: string | null
): Promise<PrintJsonDocumentResult> {
	if (!isElectronRenderer()) {
		return { ok: false, message: "No es entorno Electron." };
	}
	const nodeRequire = (window as unknown as { require?: (id: string) => unknown }).require;
	if (typeof nodeRequire !== "function") {
		return { ok: false, message: "require() no disponible." };
	}
	const electron = nodeRequire("electron") as {
		ipcRenderer?: {
			invoke: (ch: string, payload: unknown) => Promise<PrintJsonDocumentResult>;
		};
	};
	if (!electron?.ipcRenderer?.invoke) {
		return { ok: false, message: "ipcRenderer no disponible." };
	}
	return electron.ipcRenderer.invoke(PRINT_JSON_DOCUMENT_CHANNEL, {
		documentJson,
		deviceName: deviceName?.trim() || null,
	});
}

function getElectronIpcRenderer():
	| { invoke: (ch: string, payload: unknown) => Promise<unknown> }
	| null {
	if (!isElectronRenderer()) return null;
	const nodeRequire = (window as unknown as { require?: (id: string) => unknown })
		.require;
	if (typeof nodeRequire !== "function") return null;
	const electron = nodeRequire("electron") as {
		ipcRenderer?: { invoke: (ch: string, payload: unknown) => Promise<unknown> };
	};
	return electron?.ipcRenderer?.invoke ? electron.ipcRenderer : null;
}

export async function invokeElectronDocumentJsonToPdf(
	documentJson: string,
): Promise<DocumentJsonToPdfResult> {
	const ipc = getElectronIpcRenderer();
	if (!ipc) {
		return { ok: false, message: "No es entorno Electron." };
	}
	return ipc.invoke(DOCUMENT_JSON_TO_PDF_CHANNEL, {
		documentJson,
	}) as Promise<DocumentJsonToPdfResult>;
}

/** Abre el diálogo de impresión del sistema (vista previa nativa de Windows). */
export async function invokeElectronPrintJsonDocumentWithDialog(
	documentJson: string,
	deviceName?: string | null,
): Promise<PrintJsonDocumentDialogResult> {
	const ipc = getElectronIpcRenderer();
	if (!ipc) {
		return { ok: false, message: "No es entorno Electron." };
	}
	return ipc.invoke(PRINT_JSON_DOCUMENT_DIALOG_CHANNEL, {
		documentJson,
		deviceName: deviceName?.trim() || null,
	}) as Promise<PrintJsonDocumentDialogResult>;
}

export async function invokeElectronDocumentJsonToHtml(
	documentJson: string,
): Promise<DocumentJsonToHtmlResult> {
	const ipc = getElectronIpcRenderer();
	if (!ipc) {
		return { ok: false, message: "No es entorno Electron." };
	}
	return ipc.invoke(DOCUMENT_JSON_TO_HTML_CHANNEL, {
		documentJson,
	}) as Promise<DocumentJsonToHtmlResult>;
}

/** Genera el PDF en el proceso principal y lo guarda en la carpeta Descargas. */
export async function invokeElectronDownloadDocumentPdf(
	documentJson: string,
	filename: string,
): Promise<DownloadDocumentPdfResult> {
	const ipc = getElectronIpcRenderer();
	if (!ipc) {
		return { ok: false, message: "No es entorno Electron." };
	}
	return ipc.invoke(DOWNLOAD_DOCUMENT_PDF_CHANNEL, {
		documentJson,
		filename,
	}) as Promise<DownloadDocumentPdfResult>;
}
