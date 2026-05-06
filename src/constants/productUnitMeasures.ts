/**
 * Coincide con ProductsProductUnitMeasureChoices en backend (Django):
 * NIU (Unit), KGM (Kilogram), LTR (Liter).
 */
export const PRODUCT_UNIT_MEASURE_CODES = ["NIU", "KGM", "LTR"] as const;
export type ProductUnitMeasureCode = (typeof PRODUCT_UNIT_MEASURE_CODES)[number];

export const PRODUCT_UNIT_MEASURE_OPTIONS: ReadonlyArray<{
    value: ProductUnitMeasureCode;
    label: string;
}> = [
    { value: "NIU", label: "NIU - Unidad" },
    { value: "KGM", label: "KGM - Kilogramo" },
    { value: "LTR", label: "LTR - Litro" },
];

/** Tuplas [código, nombre corto] para selects (p. ej. recetas). */
export const PRODUCT_UNIT_MEASURES_TUPLES: ReadonlyArray<
    [ProductUnitMeasureCode, string]
> = [
    ["NIU", "Unidad"],
    ["KGM", "Kilogramo"],
    ["LTR", "Litro"],
];

const KNOWN = new Set<string>(PRODUCT_UNIT_MEASURE_CODES);

/**
 * Normaliza valores legacy (p. ej. "KG") y desconocidos al catálogo permitido.
 */
export function normalizeProductUnitMeasure(
    value: string | null | undefined,
): ProductUnitMeasureCode {
    const v = String(value ?? "NIU")
        .trim()
        .toUpperCase();
    if (v === "KG") return "KGM";
    if (KNOWN.has(v)) return v as ProductUnitMeasureCode;
    return "NIU";
}
