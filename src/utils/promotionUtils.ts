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
    product: PromotionProduct,
    subcategoriesOfCategory?: any[], // Nuevo parámetro opcional
    selectedCategoryId?: string | null, // ← NUEVO PARÁMETRO
): boolean {
    console.log("[promotionUtils] Evaluando:", {
        promotionName: promo.name,
        appliesTo: promo.appliesTo,
        productId: product.id,
        productCategoryId: getProductCategoryId(
            product,
            subcategoriesOfCategory,
            selectedCategoryId, // ← PASA A getProductCategoryId
        ),
        productSubcategoryId: product.subcategoryId,
        scopes: promo.scopes.map((s) => ({
            categoryId: s.category?.id,
            subcategoryId: s.subcategory?.id,
            productId: s.product?.id,
        })),
    });
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
    product: PromotionProduct,
    promotions: IPromotion[],
    cartTotal: number,
    subcategoriesOfCategory?: any[],
    selectedCategoryId?: string | null, // ← NUEVO PARÁMETRO
): IPromotion | null {
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
            const pct = promo.discountPercent ?? 0;
            return Math.round(((unitPrice * quantity * pct) / 100) * 100) / 100;
        }
        case "DISCOUNT_AMOUNT": {
            const amount = promo.discountAmount ?? 0;
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
        case "DISCOUNT_PERCENT":
            return `${Math.round(promo.discountPercent ?? 0)}% OFF`;
        case "DISCOUNT_AMOUNT":
            return `-S/ ${(promo.discountAmount ?? 0).toFixed(2)}`;
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
 * Devuelve un Map<lineIndex, promoName>.
 */
export function computeNxMFreeSet(
    lines: CartLine[],
    nxmPromotions: IPromotion[],
): Map<number, string> {
    const result = new Map<number, string>();
    for (const promo of nxmPromotions) {
        const N = promo.buyQuantity;
        const M = promo.getQuantity;
        if (!N || !M || M >= N || N <= 0) continue;
        const freePerGroup = N - M;

        const qualifying = lines
            .filter(
                (l) => !l.isGift && promotionAppliesToProduct(promo, l.product),
            )
            .sort((a, b) => a.unitPrice - b.unitPrice); // más baratos = gratis

        if (qualifying.length < N) continue;

        qualifying.forEach((line, pos) => {
            const groupPos = pos % N;
            if (groupPos < freePerGroup) {
                result.set(line.index, promo.name);
            }
        });
    }
    return result;
}
