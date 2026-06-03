export type ProductStockInfo = {
    productType?: string | null;
    managesStock?: boolean | null;
    currentStock?: number | null;
};

/** Platos: contador de ventas. Bebidas: solo si manejan stock. */
export function shouldShowProductStock(p: ProductStockInfo): boolean {
    const t = p.productType;
    if (t === "PROMOTION") return false;
    if (t === "DISH") return true;
    if (t === "BEVERAGE") return Boolean(p.managesStock);
    return false;
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
