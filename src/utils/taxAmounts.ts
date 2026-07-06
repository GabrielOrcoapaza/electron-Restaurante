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
 * Total de línea a mostrar.
 * Prioriza total/subtotal del backend (cuadra con el documento); evita usar unitPrice
 * cuando viene recalculado con IGV 18% (p. ej. 1.068 en lugar de 1.00).
 */
export function issuedItemLineTotal(item: {
    quantity?: number | string | null;
    unitPrice?: number | string | null;
    discount?: number | string | null;
    total?: number | string | null;
    subtotal?: number | string | null;
}): number {
    const backendTotal = Number(item.total ?? item.subtotal);
    if (Number.isFinite(backendTotal) && backendTotal >= 0) {
        return roundMoney2(backendTotal);
    }

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
    return 0;
}

/**
 * Precio unitario de venta (IGV incluido) para mostrar en comprobantes.
 * Deriva del total de línea del backend, no de unitPrice almacenado erróneamente.
 */
export function issuedItemDisplayUnitPrice(item: {
    quantity?: number | string | null;
    unitPrice?: number | string | null;
    discount?: number | string | null;
    total?: number | string | null;
    subtotal?: number | string | null;
}): number {
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
        return roundMoney2(Number(item.unitPrice) || 0);
    }
    const lineTotal = issuedItemLineTotal(item);
    const discount = Number(item.discount) || 0;
    return roundMoney2((lineTotal + discount) / qty);
}
