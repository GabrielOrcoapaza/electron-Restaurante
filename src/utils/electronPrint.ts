/**
 * Impresión vía proceso principal de Electron (ventana oculta + webContents.print).
 * Solo cuando la app corre en Electron con ipcRenderer disponible.
 */

export const PRINT_JSON_DOCUMENT_CHANNEL = "print-json-document" as const;

export type PrintJsonDocumentResult = { ok: boolean; message?: string };

function isElectronRenderer(): boolean {
	return (
		typeof window !== "undefined" &&
		Boolean((window as unknown as { process?: { versions?: { electron?: string } } }).process?.versions?.electron)
	);
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
