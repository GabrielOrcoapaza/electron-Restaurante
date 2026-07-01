/** Utilidades de montos con IGV incluido (precio POS → valor unitario SUNAT). */

export const roundMoney2 = (n: number): number =>
    Math.round((Number(n) || 0) * 100) / 100;

/**
 * Valor unitario sin IGV a partir del precio de venta (IGV incluido).
 * Usa precisión extra para que el total de línea cuadre con el precio del POS.
 */
export function unitValueFromInclusivePrice(
    unitPrice: number,
    igvPercent: number,
): number {
    const price = roundMoney2(unitPrice);
    const rate = igvPercent / 100;
    if (rate <= 0) return price;
    return parseFloat((price / (1 + rate)).toFixed(6));
}

/**
 * Total de línea a mostrar (precio de venta × cantidad − descuento).
 * Evita discrepancias por redondeo del valor unitario sin IGV en el backend.
 */
export function issuedItemLineTotal(item: {
    quantity?: number | string | null;
    unitPrice?: number | string | null;
    discount?: number | string | null;
    total?: number | string | null;
}): number {
    const qty = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const discount = Number(item.discount) || 0;
    if (
        Number.isFinite(qty) &&
        qty > 0 &&
        Number.isFinite(unitPrice) &&
        unitPrice > 0
    ) {
        return roundMoney2(qty * unitPrice - discount);
    }
    return roundMoney2(Number(item.total) || 0);
}
