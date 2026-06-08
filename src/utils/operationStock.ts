import {
    formatProductStockQty,
    type ProductStockInfo,
} from "./productStockDisplay";

export type StockTrackableProduct = ProductStockInfo & {
    id?: string;
    name?: string;
};

export type CartStockLine = {
    id?: string;
    productId: string;
    quantity: number;
    isCombo?: boolean;
    comboComponents?: Array<{
        product: StockTrackableProduct;
        quantity: number;
    }>;
    product?: StockTrackableProduct;
};

export function productManagesStock(p: StockTrackableProduct): boolean {
    return Boolean(p.managesStock);
}

export function getProductAvailableStock(p: StockTrackableProduct): number {
    const n = Number(p.currentStock ?? 0);
    return Number.isFinite(n) ? n : 0;
}

/** Uso acumulado de stock en el carrito/orden (excluye un ítem si se está recalculando). */
export function buildCartStockUsage(
    items: CartStockLine[],
    excludeItemId?: string,
): Record<string, number> {
    const running: Record<string, number> = {};

    for (const item of items) {
        if (excludeItemId && item.id === excludeItemId) continue;

        const product = item.product;
        const qty = Number(item.quantity) || 0;
        if (!product || qty <= 0) continue;

        if (product.productType === "PROMOTION" && item.comboComponents?.length) {
            for (const comp of item.comboComponents) {
                const cp = comp.product;
                if (!cp || !productManagesStock(cp)) continue;
                const cq = Number(comp.quantity) * qty;
                if (!Number.isFinite(cq) || cq <= 0) continue;
                const key = String(cp.id);
                running[key] = (running[key] ?? 0) + cq;
            }
        } else if (productManagesStock(product)) {
            const key = String(product.id ?? item.productId);
            running[key] = (running[key] ?? 0) + qty;
        }
    }

    return running;
}

export function canAddProductQuantity(
    product: StockTrackableProduct,
    qtyToAdd: number,
    running: Record<string, number>,
): { ok: boolean; message?: string } {
    if (product.productType === "PROMOTION") {
        return { ok: true };
    }
    if (!productManagesStock(product)) {
        return { ok: true };
    }

    const qty = Number(qtyToAdd);
    if (!Number.isFinite(qty) || qty <= 0) {
        return { ok: false, message: "Cantidad inválida" };
    }

    const avail = getProductAvailableStock(product);
    const key = String(product.id);
    const already = running[key] ?? 0;
    if (avail < already + qty) {
        const remaining = Math.max(0, avail - already);
        return {
            ok: false,
            message:
                remaining > 0
                    ? `Stock insuficiente: ${product.name ?? "Producto"} (disponible: ${formatProductStockQty(remaining)})`
                    : `Sin stock: ${product.name ?? "Producto"}`,
        };
    }

    return { ok: true };
}

export function canAddComboQuantity(
    comboName: string,
    components: Array<{ product: StockTrackableProduct; quantity: number }>,
    comboQty: number,
    running: Record<string, number>,
): { ok: boolean; message?: string } {
    const qty = Number(comboQty);
    if (!Number.isFinite(qty) || qty <= 0) {
        return { ok: false, message: "Cantidad inválida" };
    }

    for (const comp of components) {
        const cp = comp.product;
        if (!cp || !productManagesStock(cp)) continue;

        const cq = Number(comp.quantity) * qty;
        if (!Number.isFinite(cq) || cq <= 0) continue;

        const key = String(cp.id);
        const already = running[key] ?? 0;
        const avail = getProductAvailableStock(cp);
        if (avail < already + cq) {
            return {
                ok: false,
                message: `Sin stock: ${comboName} (componente: ${cp.name ?? "?"})`,
            };
        }
    }

    return { ok: true };
}

/** Producto simple disponible para agregar al menos 1 unidad más. */
export function canAddMoreProduct(
    product: StockTrackableProduct,
    cartItems: CartStockLine[],
    qty = 1,
): boolean {
    if (product.productType === "PROMOTION") return true;
    const running = buildCartStockUsage(cartItems);
    return canAddProductQuantity(product, qty, running).ok;
}

export function isProductOrderable(p: StockTrackableProduct): boolean {
    if (p.productType === "PROMOTION") return true;
    if (!productManagesStock(p)) return true;
    return getProductAvailableStock(p) > 0;
}

export function canSetItemQuantity(
    item: CartStockLine,
    newQuantity: number,
    allItems: CartStockLine[],
): { ok: boolean; message?: string } {
    const product = item.product;
    if (!product) return { ok: true };

    const running = buildCartStockUsage(allItems, item.id);
    const qty = Number(newQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
        return { ok: false, message: "Cantidad inválida" };
    }

    if (item.isCombo && item.comboComponents?.length) {
        return canAddComboQuantity(
            product.name ?? "Combo",
            item.comboComponents,
            qty,
            running,
        );
    }

    return canAddProductQuantity(product, qty, running);
}

export function isStockWarningMessage(message?: string | null): boolean {
    if (!message) return false;
    return /sin stock/i.test(message);
}
