/** Nombre de impresora del SO (campo `name` de Chromium) para tickets al cobrar. */
export const LOCAL_TICKET_PRINTER_STORAGE_KEY = 'sumapp_local_ticket_printer_name';

/**
 * Si es true: en Caja se muestra el selector de impresora local (USB / integrada).
 * Sustituye a un flag del backend (p. ej. DevicePrintConfig.use_integrated_printer) cuando no hay API disponible.
 */
export const INTEGRATED_PRINTER_CASH_UI_KEY = 'sumapp_integrated_printer_cash_ui';

export function getIntegratedPrinterCashUiEnabled(): boolean {
	try {
		return localStorage.getItem(INTEGRATED_PRINTER_CASH_UI_KEY) === '1';
	} catch {
		return false;
	}
}

export function setIntegratedPrinterCashUiEnabled(on: boolean): void {
	try {
		if (on) localStorage.setItem(INTEGRATED_PRINTER_CASH_UI_KEY, '1');
		else localStorage.removeItem(INTEGRATED_PRINTER_CASH_UI_KEY);
		window.dispatchEvent(new Event('sumapp-integrated-printer-cash-ui'));
	} catch {
		/* ignore */
	}
}

export function getLocalTicketPrinterStorage(): string {
	try {
		return localStorage.getItem(LOCAL_TICKET_PRINTER_STORAGE_KEY)?.trim() || '';
	} catch {
		return '';
	}
}

export function setLocalTicketPrinterStorage(name: string): void {
	try {
		if (!name.trim()) localStorage.removeItem(LOCAL_TICKET_PRINTER_STORAGE_KEY);
		else localStorage.setItem(LOCAL_TICKET_PRINTER_STORAGE_KEY, name.trim());
	} catch {
		/* ignore */
	}
}
