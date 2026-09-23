import { formatLocalDateYYYYMMDD } from "./localDateTime";

/** Días hacia atrás (incluye hoy) permitidos para anular o convertir. */
const VOID_CONVERT_DAYS_BY_CODE: Record<string, number> = {
    "01": 3, // Factura
    "03": 5, // Boleta
};

export function getVoidConvertMaxDays(documentCode: string): number | null {
    return VOID_CONVERT_DAYS_BY_CODE[documentCode] ?? null;
}

function parseLocalDateOnly(dateYYYYMMDD: string): Date {
    const [y, m, d] = dateYYYYMMDD.trim().slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
}

function startOfLocalDay(date: Date = new Date()): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getVoidConvertMinAllowedDate(
    documentCode: string,
    referenceDate: Date = new Date(),
): Date | null {
    const maxDays = getVoidConvertMaxDays(documentCode);
    if (maxDays === null) return null;

    const today = startOfLocalDay(referenceDate);
    const minAllowed = new Date(today);
    minAllowed.setDate(minAllowed.getDate() - maxDays);
    return minAllowed;
}

export function isWithinVoidConvertWindow(
    emissionDate: string,
    documentCode: string,
    referenceDate: Date = new Date(),
): boolean {
    const minAllowed = getVoidConvertMinAllowedDate(documentCode, referenceDate);
    if (minAllowed === null) return true;

    const emission = parseLocalDateOnly(emissionDate);
    const today = startOfLocalDay(referenceDate);
    return emission >= minAllowed && emission <= today;
}

export function getVoidConvertBlockedMessage(
    emissionDate: string,
    documentCode: string,
    referenceDate: Date = new Date(),
): string {
    const maxDays = getVoidConvertMaxDays(documentCode);
    if (maxDays === null) return "";

    const minAllowed = getVoidConvertMinAllowedDate(documentCode, referenceDate)!;
    const today = startOfLocalDay(referenceDate);
    const docLabel =
        documentCode === "01"
            ? "factura"
            : documentCode === "03"
              ? "boleta"
              : "comprobante";

    return `No se puede anular ni convertir esta ${docLabel}. Solo se permiten comprobantes emitidos del ${formatLocalDateYYYYMMDD(minAllowed)} al ${formatLocalDateYYYYMMDD(today)} (${maxDays} días). Fecha de emisión: ${emissionDate.slice(0, 10)}.`;
}
