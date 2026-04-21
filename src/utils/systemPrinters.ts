/**
 * Lista de impresoras del sistema operativo (solo SumApp/Electron vía IPC).
 * En navegador puro no hay API para enumerar impresoras.
 */

export const GET_SYSTEM_PRINTERS_CHANNEL = "get-system-printers" as const;

export type SystemPrinterInfo = {
	name: string;
	displayName: string;
	description: string;
	/** Coincide con la impresora predeterminada del SO (Windows/macOS/Linux). */
	isSystemDefault: boolean;
	options?: Record<string, string>;
};

export type SystemPrintersResult = {
	ok: boolean;
	printers: SystemPrinterInfo[];
	/** Nombre según el sistema operativo (puede no aparecer en la lista de Chromium). */
	defaultPrinterName: string | null;
	message?: string;
};

function isElectronRenderer(): boolean {
	return (
		typeof window !== "undefined" &&
		Boolean((window as unknown as { process?: { versions?: { electron?: string } } }).process?.versions
			?.electron)
	);
}

/**
 * Obtiene impresoras instaladas en el equipo (Windows/Linux/macOS) cuando la app corre en Electron.
 */
export async function fetchSystemPrinters(): Promise<SystemPrintersResult> {
	if (typeof window === "undefined") {
		return { ok: false, printers: [], defaultPrinterName: null, message: "No disponible en este entorno." };
	}

	if (!isElectronRenderer()) {
		return {
			ok: false,
			printers: [],
			defaultPrinterName: null,
			message:
				"La detección de impresoras del equipo solo está disponible en SumApp de escritorio (Electron). En el navegador el sistema no expone esta API.",
		};
	}

	try {
		// nodeIntegration: true en SumApp — require del renderer (no import estático para Vite)
		const nodeRequire = (window as unknown as { require?: (id: string) => unknown }).require;
		if (typeof nodeRequire !== "function") {
			return {
				ok: false,
				printers: [],
				defaultPrinterName: null,
				message: "require() no disponible en este entorno.",
			};
		}
		const electron = nodeRequire("electron") as {
			ipcRenderer?: { invoke: (ch: string, ...args: unknown[]) => Promise<SystemPrintersResult> };
		};
		if (!electron?.ipcRenderer?.invoke) {
			return {
				ok: false,
				printers: [],
				defaultPrinterName: null,
				message: "ipcRenderer no disponible; verifique la ventana de Electron.",
			};
		}
		const raw = await electron.ipcRenderer.invoke(GET_SYSTEM_PRINTERS_CHANNEL);
		const printers = (raw.printers || []).map((p) => ({
			...p,
			isSystemDefault: Boolean(p.isSystemDefault),
		}));
		return {
			ok: raw.ok,
			printers,
			defaultPrinterName: raw.defaultPrinterName ?? null,
			message: raw.message,
		};
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		const lower = msg.toLowerCase();
		if (lower.includes("no handler registered") || lower.includes("no matching handler")) {
			return {
				ok: false,
				printers: [],
				defaultPrinterName: null,
				message:
					"El proceso principal de Electron no tiene registrado el canal IPC «get-system-printers» (código desactualizado). " +
					"Cierre SumApp por completo, ejecute en la carpeta del proyecto: `npm run build-electron` o `npm run electron`, y vuelva a abrir la app. " +
					"Si usa un instalador (.exe), genere e instale de nuevo el build con `npm run dist`. Detalle técnico: " +
					msg,
			};
		}
		return { ok: false, printers: [], defaultPrinterName: null, message: msg };
	}
}
