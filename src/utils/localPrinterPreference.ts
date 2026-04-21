/** Nombre de impresora del SO (campo `name` de Chromium) para tickets al cobrar. */
export const LOCAL_TICKET_PRINTER_STORAGE_KEY = 'sumapp_local_ticket_printer_name';

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
