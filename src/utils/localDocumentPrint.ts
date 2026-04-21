/**
 * Impresión en dispositivo cuando el backend devuelve print_locally + document_data.
 * Orden: bridge JS (LocalPrinter / Android) → SumApp Electron (IPC print-json-document).
 */

import { invokeElectronPrintJsonDocument } from "./electronPrint";

export type LocalIssuedDocumentPrintPayload = {
	printLocally?: boolean | null;
	printViaBluetooth?: boolean | null;
	documentData?: string | null;
};

declare global {
	interface Window {
		LocalPrinter?: {
			printDocument?: (json: string, deviceName?: string) => void;
			print?: (json: string, deviceName?: string) => void;
		};
		AppsumaLocalPrint?: ((json: string, deviceName?: string) => void) | ((json: string) => void);
		Android?: {
			printLocalDocument?: (json: string, deviceName?: string) => void;
		};
	}
}

const LOG_PREFIX = '[Impresión documento emitido]';

/**
 * @returns true si no había que imprimir en local, o la impresión se delegó bien; false si falló.
 */
export async function invokeLocalIssuedDocumentPrint(
	payload: LocalIssuedDocumentPrintPayload,
	meta?: {
		label?: string;
		operationId?: string | null;
		deviceId?: string | null;
		localPrinterName?: string | null;
	}
): Promise<boolean> {
	const printLocally = payload.printLocally === true;
	const label = meta?.label ?? 'pago';
	const op = meta?.operationId ?? '—';
	const deviceId = meta?.deviceId?.trim() || null;
	const hasDeviceId = Boolean(deviceId);
	const localPrinterName = meta?.localPrinterName?.trim() || null;

	console.log(`${LOG_PREFIX} ─────────────────────────────────────────`);
	console.log(`${LOG_PREFIX} contexto: ${label} | operationId=${op}`);
	console.log(`${LOG_PREFIX} deviceId enviado al backend: ${hasDeviceId ? deviceId : '(ninguno)'}`);
	console.log(`${LOG_PREFIX} respuesta print_locally: ${printLocally}`);
	console.log(`${LOG_PREFIX} respuesta print_via_bluetooth: ${payload.printViaBluetooth === true}`);
	console.log(
		`${LOG_PREFIX} document_data: ${payload.documentData != null && String(payload.documentData).trim() !== '' ? `presente (${String(payload.documentData).length} chars)` : '(vacío o null)'}`
	);
	console.log(
		`${LOG_PREFIX} impresora local elegida: ${localPrinterName || '(predeterminada del sistema / sin especificar)'}`
	);

	if (printLocally) {
		console.log(
			`${LOG_PREFIX} ▶ Ruta: IMPRESIÓN LOCAL (integrada / USB / LocalPrinter en la app). El cliente debe imprimir con document_data.`
		);
	} else if (hasDeviceId) {
		console.log(
			`${LOG_PREFIX} ▶ Ruta: SERVIDOR / RASPBERRY (u otra impresora de red). print_locally=false → SmartPrintService en backend suele enviar el trabajo a la Pi; esta web no recibe document_data para USB.`
		);
	} else {
		console.log(
			`${LOG_PREFIX} ▶ Ruta: SIN impresión por dispositivo (no hubo deviceId). Si igual imprimió algo, fue otro canal o no se configuró impresión.`
		);
	}
	console.log(`${LOG_PREFIX} ─────────────────────────────────────────`);

	if (!printLocally) {
		return true;
	}

	console.log(`${LOG_PREFIX} [LocalPrinter] print_locally=true → intentando bridge nativo…`);

	const raw = payload.documentData;
	if (raw == null || String(raw).trim() === '') {
		console.warn(`${LOG_PREFIX} [LocalPrinter] print_locally=true pero document_data vacío; no se invoca impresora`);
		return false;
	}

	const json = String(raw);
	if (json.length <= 500) {
		console.log(`${LOG_PREFIX} [LocalPrinter] document_data (${json.length} chars):`, json);
	} else {
		console.log(`${LOG_PREFIX} [LocalPrinter] document_data length=${json.length} preview=`, json.slice(0, 400) + '…');
	}

	try {
		if (typeof window.LocalPrinter?.printDocument === 'function') {
			console.log(`${LOG_PREFIX} [LocalPrinter] usando window.LocalPrinter.printDocument`);
			if (localPrinterName) window.LocalPrinter.printDocument(json, localPrinterName);
			else window.LocalPrinter.printDocument(json);
			return true;
		}
		if (typeof window.LocalPrinter?.print === 'function') {
			console.log(`${LOG_PREFIX} [LocalPrinter] usando window.LocalPrinter.print`);
			if (localPrinterName) window.LocalPrinter.print(json, localPrinterName);
			else window.LocalPrinter.print(json);
			return true;
		}
		if (typeof window.AppsumaLocalPrint === 'function') {
			console.log(`${LOG_PREFIX} [LocalPrinter] usando window.AppsumaLocalPrint`);
			if (localPrinterName) window.AppsumaLocalPrint(json, localPrinterName);
			else window.AppsumaLocalPrint(json);
			return true;
		}
		if (typeof window.Android?.printLocalDocument === 'function') {
			console.log(`${LOG_PREFIX} [LocalPrinter] usando window.Android.printLocalDocument`);
			if (localPrinterName) window.Android.printLocalDocument(json, localPrinterName);
			else window.Android.printLocalDocument(json);
			return true;
		}
	} catch (e) {
		console.error(`${LOG_PREFIX} [LocalPrinter] error al invocar bridge nativo:`, e);
	}

	console.log(
		`${LOG_PREFIX} [LocalPrinter] sin bridge JS; intentando impresión SumApp/Electron (IPC print-json-document)…`
	);
	const electronRes = await invokeElectronPrintJsonDocument(json, localPrinterName);
	if (electronRes.ok) {
		console.log(`${LOG_PREFIX} [Electron] impresión enviada correctamente`);
		return true;
	}
	console.warn(
		`${LOG_PREFIX} [Electron] impresión fallida: ${electronRes.message || 'sin mensaje'}. ` +
			`Si no usa SumApp escritorio, defina LocalPrinter.printDocument en el WebView.`
	);
	return false;
}
