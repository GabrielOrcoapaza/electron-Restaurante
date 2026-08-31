import type {
    ComboComponentSelection,
    ComboProduct,
    ComboScope,
} from "../types/promotions";
import { isProductOrderable } from "./operationStock";

function scopeRequiredQuantity(scope: ComboScope): number {
    const qty = Number(scope.requiredQuantity);
    if (!Number.isFinite(qty) || qty < 1) return 1;
    return Math.floor(qty);
}

function productBucketKey(scope: ComboScope): string | null {
    if (!scope.product?.id) return null;
    return (
        scope.product.subcategory?.id ||
        scope.product.subcategoryId ||
        (scope.product.subcategory?.name
            ? `subcat-name-${scope.product.subcategory.name}`
            : null) ||
        (scope.scopeLabel || scope.label || "").trim().toLowerCase() ||
        `fixed-${scope.id}`
    );
}

/** Todos los productos fijos del combo son tipo BEVERAGE */
export function isBeverageCombo(
    combo: ComboProduct | null | undefined,
): boolean {
    const scopes = combo?.asPromotion?.scopes ?? [];
    const fixedProducts = scopes.filter((s) => s.product?.id);
    if (fixedProducts.length === 0) return false;

    return fixedProducts.every((s) => {
        const t = String(s.product?.productType ?? "").toUpperCase();
        if (t === "BEVERAGE") return true;
        // El API a veces no incluye productType en scopes del combo
        if (!t) return true;
        return false;
    });
}

/** Scopes del combo: solo productos fijos (sin elegir categoría/subcategoría) */
export function isFixedProductCombo(
    combo: ComboProduct | null | undefined,
): boolean {
    const scopes = combo?.asPromotion?.scopes ?? [];
    if (scopes.length === 0) return false;

    if (scopes.some((s) => s.subcategory?.id || s.category?.id)) {
        return false;
    }

    return scopes.every((s) => Boolean(s.product?.id));
}

/**
 * Combo con productos fijos y sin elección (p. ej. Coca + Ron).
 * Usa buckets por subcategoría para detectar "elige una" (Coca o Inca Kola).
 */
export function isQuickAddCombo(
    combo: ComboProduct | null | undefined,
): boolean {
    if (!isFixedProductCombo(combo)) return false;

    const scopes = combo!.asPromotion!.scopes;
    const bucketCounts = new Map<string, number>();
    for (const scope of scopes) {
        const key = productBucketKey(scope);
        if (!key) return false;
        bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
    }

    for (const count of bucketCounts.values()) {
        if (count > 1) return false;
    }

    return true;
}

/**
 * Delivery: 1 toque si todos los scopes son producto fijo y todos son BEVERAGE.
 * No agrupa por subcategoría — Coca + Ron en la misma subcategoría también agrega ambos.
 */
export function isDeliveryQuickAddCombo(
    combo: ComboProduct | null | undefined,
): boolean {
    return isFixedProductCombo(combo) && isBeverageCombo(combo);
}

export function buildQuickAddComponents(
    combo: ComboProduct,
): ComboComponentSelection[] {
    const scopes = combo.asPromotion?.scopes ?? [];
    return scopes
        .filter((s) => s.product?.id && s.product.isActive !== false)
        .map((scope) => ({
            scopeId: scope.id,
            scopeLabel:
                scope.scopeLabel ||
                scope.label ||
                scope.product!.subcategory?.name ||
                scope.product!.name,
            product: {
                id: scope.product!.id,
                name: scope.product!.name,
                salePrice: Number(scope.product!.salePrice) || 0,
            },
            quantity: scopeRequiredQuantity(scope),
        }));
}

export function canQuickAddCombo(combo: ComboProduct): boolean {
    if (!isQuickAddCombo(combo)) return false;
    const scopes = combo.asPromotion?.scopes ?? [];
    return scopes.every(
        (s) => s.product && isProductOrderable(s.product),
    );
}

export function canDeliveryQuickAddCombo(combo: ComboProduct): boolean {
    if (!isDeliveryQuickAddCombo(combo)) return false;
    const scopes = combo.asPromotion?.scopes ?? [];
    return scopes.every(
        (s) => s.product && isProductOrderable(s.product),
    );
}

function normalizeComboSelectionKey(
    components: Array<{
        product?: { id?: string };
        productId?: string;
        quantity?: number;
    }>,
): string {
    return [...components]
        .map((c) => {
            const productId = c.product?.id ?? c.productId ?? "";
            const qty = Number(c.quantity) || 1;
            return `${productId}:${qty}`;
        })
        .sort()
        .join("|");
}

/** Misma promoción combo con los mismos productos/cantidades */
export function comboSelectionsMatch(
    a: ComboComponentSelection[] | undefined,
    b: ComboComponentSelection[] | undefined,
): boolean {
    const left = a ?? [];
    const right = b ?? [];
    if (left.length !== right.length) return false;
    return normalizeComboSelectionKey(left) === normalizeComboSelectionKey(right);
}
