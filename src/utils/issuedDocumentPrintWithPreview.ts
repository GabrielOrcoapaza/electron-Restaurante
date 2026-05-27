/**
 * Vista previa del comprobante en la app + diálogo de impresión del sistema.
 * Electron en Windows no muestra miniatura dentro del cuadro "Imprimir".
 */

import {
	invokeElectronDocumentJsonToHtml,
	invokeElectronPrintJsonDocumentWithDialog,
	isElectronRenderer,
} from "./electronPrint";

const LOG = "[Vista previa impresión]";

export type DocumentPreviewAction = "print" | "continue" | "cancel";

/** HTML del ticket en blob: para iframe en modal de caja. */
export async function buildPreviewHtmlBlobUrl(
	documentJson: string,
): Promise<string | null> {
	try {
		let html: string;
		if (isElectronRenderer()) {
			const res = await invokeElectronDocumentJsonToHtml(documentJson);
			if (!res.ok || !res.html) return null;
			html = res.html;
		} else {
			const mod = await import("../../electron/documentToPrintHtml");
			html = await mod.documentDataJsonToHtml(documentJson);
		}
		const blob = new Blob([html], { type: "text/html;charset=utf-8" });
		return URL.createObjectURL(blob);
	} catch (e) {
		console.warn(`${LOG} No se pudo generar HTML de vista previa:`, e);
		return null;
	}
}

export function revokePreviewHtmlBlobUrl(url: string | null | undefined): void {
	if (url?.startsWith("blob:")) {
		try {
			URL.revokeObjectURL(url);
		} catch {
			/* ignore */
		}
	}
}

async function openBrowserPrintDialog(documentJson: string): Promise<{
	printed: boolean;
	cancelled: boolean;
}> {
	try {
		const mod = await import("../../electron/documentToPrintHtml");
		const html = await mod.documentDataJsonToHtml(documentJson);
		return await new Promise((resolve) => {
			const w = window.open("", "_blank", "width=420,height=720");
			if (!w) {
				resolve({ printed: false, cancelled: true });
				return;
			}
			w.document.open();
			w.document.write(html);
			w.document.close();
			let settled = false;
			const finish = (printed: boolean, cancelled: boolean) => {
				if (settled) return;
				settled = true;
				try {
					w.close();
				} catch {
					/* ignore */
				}
				resolve({ printed, cancelled });
			};
			w.onafterprint = () => finish(true, false);
			w.onbeforeunload = () => {
				window.setTimeout(() => {
					if (!settled) finish(false, true);
				}, 300);
			};
			w.focus();
			w.print();
		});
	} catch (e) {
		console.warn(`${LOG} window.print falló:`, e);
		return { printed: false, cancelled: false };
	}
}

/** Diálogo de impresión del SO (ventana visible + cuadro Imprimir en Electron). */
export async function openIssuedDocumentPrintPreview(
	documentJson: string,
	localPrinterName?: string | null,
): Promise<{ printed: boolean; cancelled: boolean }> {
	console.log(`${LOG} Abriendo diálogo (${documentJson.length} chars)`);

	if (isElectronRenderer()) {
		const res = await invokeElectronPrintJsonDocumentWithDialog(
			documentJson,
			localPrinterName,
		);
		return {
			printed: res.printed === true,
			cancelled: res.cancelled === true,
		};
	}

	return openBrowserPrintDialog(documentJson);
}
