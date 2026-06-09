export type ProductStockInfo = {
    productType?: string | null;
    managesStock?: boolean | null;
    currentStock?: number | null;
};

/** Muestra stock solo si el producto maneja inventario (managesStock). */
export function shouldShowProductStock(p: ProductStockInfo): boolean {
    const t = p.productType;
    if (t === "PROMOTION" || t === "INGREDIENT") return false;
    return Boolean(p.managesStock);
}

export function formatProductStockQty(
    stock: number | null | undefined,
): string {
    const n = Number(stock ?? 0);
    if (!Number.isFinite(n)) return "0";
    if (Math.abs(n - Math.round(n)) < 0.0001) {
        return String(Math.round(n));
    }
    return n.toFixed(2).replace(/\.?0+$/, "");
}

export function productStockLabel(p: ProductStockInfo): string | null {
    if (!shouldShowProductStock(p)) return null;
    return `Cant: ${formatProductStockQty(p.currentStock)}`;
}

/** Cantidad formateada para listados de productos (admin). Incluye insumos. */
export function productListStockDisplay(p: ProductStockInfo): string | null {
    const t = p.productType;
    if (t === "PROMOTION") return null;
    if (t === "INGREDIENT" || Boolean(p.managesStock)) {
        return formatProductStockQty(p.currentStock);
    }
    return null;
}
