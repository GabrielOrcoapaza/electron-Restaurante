import { resolveClientDeviceIdForPrint } from "./deviceIdForPrint";
import {
	invokeElectronOpenCashDrawer,
	invokeElectronPrintJsonDocument,
	isElectronRenderer,
} from "./electronPrint";
import { invokeLocalIssuedDocumentPrint } from "./localDocumentPrint";
import { getLocalTicketPrinterStorage } from "./localPrinterPreference";

export type OpenCashDrawerMutationResult = {
	success?: boolean | null;
	message?: string | null;
	printLocally?: boolean | null;
	print_locally?: boolean | null;
	printViaBluetooth?: boolean | null;
	print_via_bluetooth?: boolean | null;
	documentData?: string | null;
	document_data?: string | null;
};

const FALLBACK_DRAWER_JSON = JSON.stringify({
	type: "OPEN_DRAWER",
	open_drawer: true,
});

export async function resolveDeviceIdForCashDrawer(deps: {
	getMacAddress: () => Promise<string>;
	getDeviceId: () => string;
}): Promise<string> {
	return resolveClientDeviceIdForPrint({
		getMacAddress: deps.getMacAddress,
		getDeviceId: deps.getDeviceId,
		logPrefix: "[Gaveta]",
	});
}

/**
 * Emergencia en ESTE equipo: pulso ESC/POS a la impresora USB/integrada.
 * No crea venta ni ticket. No depende de que el backend diga print_locally.
 */
export async function openCashDrawerOnThisDevice(): Promise<{
	ok: boolean;
	message: string;
}> {
	const localPrinterName = getLocalTicketPrinterStorage().trim() || null;
	console.log(
		"[Gaveta] intento local USB/Electron | impresora=",
		localPrinterName || "(predeterminada / USB001)",
	);

	if (isElectronRenderer()) {
		const dedicated = await invokeElectronOpenCashDrawer(localPrinterName);
		if (dedicated.ok) {
			return { ok: true, message: "Gaveta abierta (USB)" };
		}
		console.warn("[Gaveta] IPC open-cash-drawer:", dedicated.message);
		const viaPrint = await invokeElectronPrintJsonDocument(
			FALLBACK_DRAWER_JSON,
			localPrinterName,
		);
		if (viaPrint.ok) {
			return { ok: true, message: "Gaveta abierta (USB)" };
		}
		console.warn("[Gaveta] print-json-document:", viaPrint.message);
	}

	const localOk = await invokeLocalIssuedDocumentPrint(
		{ printLocally: true, documentData: FALLBACK_DRAWER_JSON },
		{
			label: "abrir gaveta",
			localPrinterName,
			openCashDrawer: true,
		},
	);
	if (localOk) {
		return { ok: true, message: "Gaveta abierta (USB)" };
	}

	return {
		ok: false,
		message:
			"No se pudo abrir la gaveta en este equipo. Use SumApp escritorio y revise la impresora de tickets.",
	};
}

/**
 * Tras la mutación openCashDrawer: USB/integrada imprime el pulso en local;
 * red ya lo envió el backend a PrintServer.
 */
export async function applyOpenCashDrawerResponse(
	result: OpenCashDrawerMutationResult | null | undefined,
	deviceId?: string | null,
): Promise<{ ok: boolean; message: string }> {
	if (!result?.success) {
		return {
			ok: false,
			message: result?.message || "No se pudo abrir la gaveta",
		};
	}

	const printLocally =
		result.printLocally === true || result.print_locally === true;
	if (!printLocally) {
		return {
			ok: true,
			message: result.message || "Gaveta abierta (sin venta)",
		};
	}

	const documentData =
		result.documentData ?? result.document_data ?? FALLBACK_DRAWER_JSON;
	const localOk = await invokeLocalIssuedDocumentPrint(
		{
			printLocally: true,
			printViaBluetooth:
				result.printViaBluetooth ?? result.print_via_bluetooth,
			documentData,
		},
		{
			label: "abrir gaveta",
			deviceId: deviceId ?? null,
			localPrinterName: getLocalTicketPrinterStorage().trim() || null,
			openCashDrawer: true,
		},
	);

	if (!localOk) {
		return {
			ok: false,
			message:
				"No se pudo abrir la gaveta en la impresora USB/integrada. Revise el nombre de la impresora o use la predeterminada.",
		};
	}

	return {
		ok: true,
		message: "Gaveta abierta (sin venta)",
	};
}
