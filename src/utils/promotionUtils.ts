import type { IPromotion } from "../types/promotions";

// Producto mínimo necesario para evaluar promociones
export interface PromotionProduct {
    id: string;
    salePrice?: number;
    subcategoryId?: string | null;
    subcategory?: { category?: { id?: string } | null } | null;
    category?: { id?: string } | null;
    productType?: string | null;
    categoryId?: string | null; // Añade este campo
}

export interface CartLine {
    index: number;
    product: PromotionProduct;
    unitPrice: number;
    quantity: number;
    isGift: boolean;
}
function getProductCategoryId(
    product: PromotionProduct,
    subcategoriesOfCategory?: any[],
    selectedCategoryId?: string | null,
    allSubcategories?: any[], // ← NUEVO PARÁMETRO: todas las subcategorías de la sucursal
): string | null {
    // 1. Si ya tiene categoryId directo
    if (product.category?.id) return product.category.id;
    if (product?.categoryId) return product?.categoryId;

    // 2. Si tiene subcategory con category
    if (product.subcategory?.category?.id)
        return product.subcategory.category.id;

    // 3. Buscar en subcategoriesOfCategory (solo si tiene selectedCategory)
    if (product.subcategoryId && subcategoriesOfCategory) {
        const subcat = subcategoriesOfCategory.find(
            (s) => String(s.id) === String(product.subcategoryId),
        );
        if (subcat?.category?.id) {
            return subcat.category.id;
        }
    }

    // 4. NUEVO: Buscar en todas las subcategorías de la sucursal
    if (product.subcategoryId && allSubcategories) {
        const subcat = allSubcategories.find(
            (s) => String(s.id) === String(product.subcategoryId),
        );
        if (subcat?.category?.id) {
            return subcat.category.id;
        }
    }

    // 5. FALLBACK: si selectedCategory está presente, usarlo
    if (selectedCategoryId) {
        return selectedCategoryId;
    }

    return null;
}
/** Devuelve true si la promoción aplica al producto (según appliesTo y scopes). */
export function promotionAppliesToProduct(
    promo: IPromotion,
    product: PromotionProduct | null | undefined,
    subcategoriesOfCategory?: any[], // Nuevo parámetro opcional
    selectedCategoryId?: string | null, // ← NUEVO PARÁMETRO
): boolean {
    // Si no hay producto, la promoción no aplica
    if (!product) {
        return false;
    }
    switch (promo.appliesTo) {
        case "ALL":
            return true;
        case "CATEGORY": {
            // Obtener el categoryId del producto
            let productCategoryId: string | null = null;

            // Intentar obtener de diferentes fuentes
            if (product.category?.id) productCategoryId = product.category.id;
            else if (product.categoryId) productCategoryId = product.categoryId;
            else if (product.subcategory?.category?.id)
                productCategoryId = product.subcategory.category.id;
            else if (product.subcategoryId && subcategoriesOfCategory) {
                // Buscar en subcategoriesOfCategory
                const subcat = subcategoriesOfCategory.find(
                    (s) => String(s.id) === String(product.subcategoryId),
                );
                if (subcat?.category?.id) {
                    productCategoryId = subcat.category.id;
                }
            }

            if (!productCategoryId) return false;

            return promo.scopes.some((scope) => {
                if (!scope.category?.id) return false;
                return String(scope.category.id) === String(productCategoryId);
            });
        }
        case "SUBCATEGORY":
            return promo.scopes.some(
                (scope) =>
                    scope.subcategory?.id != null &&
                    String(scope.subcategory.id) ===
                        String(product.subcategoryId),
            );
        case "PRODUCT":
            return promo.scopes.some(
                (scope) =>
                    scope.product?.id != null &&
                    String(scope.product.id) === String(product.id),
            );
        default:
            return false;
    }
}

/**
 * Encuentra la mejor promoción de tipo DISCOUNT_PERCENT o DISCOUNT_AMOUNT para un producto.
 * Usa `priority` para desempatar (mayor = primero).
 */
export function findBestDiscountPromotion(
    product: PromotionProduct | null | undefined,
    promotions: IPromotion[],
    cartTotal: number,
    subcategoriesOfCategory?: any[],
    selectedCategoryId?: string | null, // ← NUEVO PARÁMETRO
): IPromotion | null {
    if (!product) {
        return null;
    }
    const candidates = promotions.filter(
        (promo) =>
            (promo.promotionType === "DISCOUNT_PERCENT" ||
                promo.promotionType === "DISCOUNT_AMOUNT") &&
            promotionAppliesToProduct(
                promo,
                product,
                subcategoriesOfCategory,
                selectedCategoryId, // ← PASA EL PARÁMETRO
            ) &&
            cartTotal >= promo.minPurchaseAmount,
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((best, curr) =>
        curr.priority > best.priority ? curr : best,
    );
}
/**
 * Calcula el descuento total para una línea del carrito.
 * Resultado = descuento total de TODA la línea (precio × cantidad × factor).
 */
export function calculateLineDiscount(
    unitPrice: number,
    quantity: number,
    promo: IPromotion,
): number {
    switch (promo.promotionType) {
        case "DISCOUNT_PERCENT": {
            const pct =
                typeof promo.discountPercent === "string"
                    ? parseFloat(promo.discountPercent)
                    : (promo.discountPercent ?? 0);
            return Math.round(((unitPrice * quantity * pct) / 100) * 100) / 100;
        }
        case "DISCOUNT_AMOUNT": {
            const amount =
                typeof promo.discountAmount === "string"
                    ? parseFloat(promo.discountAmount)
                    : (promo.discountAmount ?? 0);
            return Math.min(
                Math.round(amount * 100) / 100,
                Math.round(unitPrice * quantity * 100) / 100,
            );
        }
        default:
            return 0;
    }
}

/** Badge para mostrar en la tarjeta de producto (ej: "20% OFF", "3×2", "REGALO"). */
export function promotionBadgeLabel(promo: IPromotion): string {
    switch (promo.promotionType) {
        case "DISCOUNT_PERCENT": {
            const pct =
                typeof promo.discountPercent === "string"
                    ? parseFloat(promo.discountPercent)
                    : (promo.discountPercent ?? 0);
            return `${Math.round(pct)}% OFF`;
        }
        case "DISCOUNT_AMOUNT": {
            const amount =
                typeof promo.discountAmount === "string"
                    ? parseFloat(promo.discountAmount)
                    : (promo.discountAmount ?? 0);
            return `-S/ ${amount.toFixed(2)}`;
        }
        case "NXM":
            return `${promo.buyQuantity}×${promo.getQuantity}`;
        case "GIFT":
            return "REGALO";
        default:
            return "";
    }
}

/** Encuentra la mejor promoción (no COMBO) para mostrar badge en un producto. */
export function findBadgePromotion(
    product: PromotionProduct,
    promotions: IPromotion[],
): IPromotion | null {
    const candidates = promotions.filter(
        (promo) =>
            promo.promotionType !== "COMBO" &&
            promotionAppliesToProduct(promo, product),
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((best, curr) =>
        curr.priority > best.priority ? curr : best,
    );
}

/**
 * Para cada promoción NxM, determina qué líneas del carrito obtienen descuento 100%.
 * Los más baratos son los que quedan gratis.
 * Devuelve un Map<lineIndex, { promoName: string; freeUnits: number }>.
 */
export function computeNxMFreeSet(
    lines: CartLine[],
    nxmPromotions: IPromotion[],
    subcategoriesOfCategory?: any[],
    selectedCategoryId?: string | null,
): Map<number, { promoName: string; freeUnits: number }> {
    console.log("[promotionUtils] computeNxMFreeSet called with lines:", lines);
    const result = new Map<number, { promoName: string; freeUnits: number }>();
    for (const promo of nxmPromotions) {
        console.log("[promotionUtils] Checking NxM promo:", promo);
        const N = promo.buyQuantity;
        const M = promo.getQuantity;
        console.log("[promotionUtils] N:", N, "M:", M);
        if (!N || !M || M >= N || N <= 0) continue;
        const freePerGroup = N - M;
        console.log("[promotionUtils] Free per group:", freePerGroup);

        // Primero, filtrar líneas que aplican
        const applicableLines = lines.filter((l) => {
            console.log(
                "[promotionUtils] Checking line for promo",
                promo.name,
                ":",
                l.product ? { id: l.product.id } : null,
            );
            const applies =
                !l.isGift &&
                promotionAppliesToProduct(
                    promo,
                    l.product,
                    subcategoriesOfCategory,
                    selectedCategoryId,
                );
            console.log("[promotionUtils] Does it apply?", applies);
            return applies;
        });

        // Expandir líneas con quantity > 1 en unidades individuales
        const expandedUnits: { originalIndex: number; unitPrice: number }[] =
            [];
        applicableLines.forEach((line) => {
            for (let i = 0; i < line.quantity; i++) {
                expandedUnits.push({
                    originalIndex: line.index,
                    unitPrice: line.unitPrice,
                });
            }
        });

        // Ordenar unidades por precio (más baratos primero)
        expandedUnits.sort((a, b) => a.unitPrice - b.unitPrice);
        console.log(
            "[promotionUtils] Expanded qualifying units for promo",
            promo.name,
            ":",
            expandedUnits,
        );

        if (expandedUnits.length < N) {
            console.log(
                "[promotionUtils] Not enough qualifying units (need",
                N,
                "have",
                expandedUnits.length,
                ")",
            );
            continue;
        }

        // Contar cuántas unidades gratis hay por índice original (Versión A: solo grupos completos)
        const totalGroups = Math.floor(expandedUnits.length / N);
        const totalFreeUnits = totalGroups * freePerGroup;
        console.log(
            "[promotionUtils] Total units:",
            expandedUnits.length,
            "N:",
            N,
            "Complete groups:",
            totalGroups,
            "Total free units:",
            totalFreeUnits,
        );

        const freeUnitsByIndex = new Map<number, number>();
        expandedUnits.forEach((unit, pos) => {
            if (pos < totalFreeUnits) {
                const current = freeUnitsByIndex.get(unit.originalIndex) || 0;
                freeUnitsByIndex.set(unit.originalIndex, current + 1);
            }
        });

        // Aplicar descuento a las líneas originales
        freeUnitsByIndex.forEach((freeUnits, originalIndex) => {
            result.set(originalIndex, {
                promoName: promo.name,
                freeUnits: freeUnits,
            });
        });
    }
    console.log(
        "[promotionUtils] Final free set:",
        Array.from(result.entries()),
    );
    return result;
}
