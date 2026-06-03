/** Alineado con DevicePrintConfig.PRINT_TYPE_CHOICES (Django). */
export const DEVICE_PRINT_TYPE_CATEGORY = "CATEGORY" as const;

export const DEVICE_PRINT_TYPE_OPTIONS = [
	{ value: "CATEGORY", label: "Categoría de Producto" },
	{ value: "PRECUENTA", label: "Precuenta" },
	{ value: "CUENTA", label: "Cuenta" },
	{ value: "BOLETA", label: "Boleta" },
	{ value: "FACTURA", label: "Factura" },
	{ value: "COMANDA", label: "Comanda General" },
] as const;

export type DevicePrintTypeValue =
	(typeof DEVICE_PRINT_TYPE_OPTIONS)[number]["value"];

export function devicePrintTypeLabel(printType: string): string {
	const found = DEVICE_PRINT_TYPE_OPTIONS.find((o) => o.value === printType);
	return found?.label ?? printType;
}

export function isCategoryPrintType(printType: string): boolean {
	return printType === DEVICE_PRINT_TYPE_CATEGORY;
}
