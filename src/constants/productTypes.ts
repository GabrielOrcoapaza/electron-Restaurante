/** Etiquetas alineadas con PRODUCT_TYPES del backend (sumaq). */
export const PRODUCT_TYPE_LABELS: Record<string, string> = {
    DISH: "Productos preparados",
    BEVERAGE: "Bebidas embotelladas",
    INGREDIENT: "Ingrediente",
    OTHER: "Otros",
    PROMOTION: "Promoción / Combo",
    SERVICE: "Servicio",
};

export function getProductTypeLabel(productType?: string | null): string {
    if (!productType) return "—";
    return PRODUCT_TYPE_LABELS[productType] ?? productType;
}

/** DISH y BEVERAGE requieren categoría/subcategoría en carta. */
export function productTypeNeedsCategory(productType: string): boolean {
    return productType === "DISH" || productType === "BEVERAGE";
}

/** Tipos que muestran campos de stock / managesStock en el formulario. */
export function productTypeHasStockFields(productType: string): boolean {
    return (
        productType === "DISH" ||
        productType === "BEVERAGE" ||
        productType === "INGREDIENT" ||
        productType === "OTHER"
    );
}

/** Compras e ingreso a kardex (con managesStock). */
export const KARDEX_PURCHASE_PRODUCT_TYPES = [
    "INGREDIENT",
    "BEVERAGE",
    "OTHER",
] as const;

export function isKardexPurchaseProductType(productType?: string | null): boolean {
    if (!productType) return false;
    return (KARDEX_PURCHASE_PRODUCT_TYPES as readonly string[]).includes(
        productType,
    );
}

/** Productos vendibles en salón / delivery (búsqueda y código). */
export function isSaleCatalogProductType(productType?: string | null): boolean {
    if (!productType) return false;
    return (
        productType === "DISH" ||
        productType === "BEVERAGE" ||
        productType === "PROMOTION" ||
        productType === "OTHER"
    );
}
