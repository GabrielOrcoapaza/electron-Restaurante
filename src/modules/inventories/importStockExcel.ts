import * as XLSX from "xlsx";
import { exportToExcel } from "../../utils/exportToExcel";

export type ImportableProduct = {
    id: string;
    code: string;
    name: string;
    currentStock?: number | null;
    salePrice?: number | null;
    productType: string;
    managesStock?: boolean | null;
};

export type StockImportRow = {
    rowNumber: number;
    productCode: string;
    newQuantity: number;
    unitCost?: number;
    salePrice?: number;
};

export type StockImportParseError = {
    rowNumber: number;
    message: string;
};

export type StockImportParseResult = {
    rows: StockImportRow[];
    errors: StockImportParseError[];
};

const TEMPLATE_HEADERS = [
    "codigo",
    "nombre",
    "stock_actual",
    "cantidad_nueva",
    "costo_unitario",
    "precio_venta_actual",
    "precio_venta_nuevo",
];

/** Solo INGREDIENT/BEVERAGE con manages_stock activo pueden importarse (igual regla que el backend). */
export function getImportableProducts(
    products: ImportableProduct[],
): ImportableProduct[] {
    return products.filter(
        (p) => p.productType !== "DISH" && p.managesStock,
    );
}

export async function downloadStockImportTemplate(
    products: ImportableProduct[],
    branchName: string,
): Promise<void> {
    const importable = getImportableProducts(products);
    const rows = importable.map((p) => ({
        codigo: p.code,
        nombre: p.name,
        stock_actual: Number(p.currentStock ?? 0),
        cantidad_nueva: "",
        costo_unitario: "",
        precio_venta_actual: Number(p.salePrice ?? 0),
        precio_venta_nuevo: "",
    }));

    await exportToExcel({
        filename: `plantilla_stock_${branchName || "sede"}`,
        sheets: [{ name: "Stock", rows }],
    });
}

function normalizeHeader(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[áàä]/g, "a")
        .replace(/[éèë]/g, "e")
        .replace(/[íìï]/g, "i")
        .replace(/[óòö]/g, "o")
        .replace(/[úùü]/g, "u")
        .replace(/ñ/g, "n");
}

function parseNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const cleaned = String(value).trim().replace(",", ".");
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}

/**
 * Lee el Excel resubido por el usuario.
 * Requeridas: codigo, cantidad_nueva. Opcionales: costo_unitario, precio_venta_nuevo
 * (solo se aplican si vienen llenas; "precio_venta_actual" es solo informativa y se ignora).
 */
export async function parseStockImportExcel(
    file: File,
): Promise<StockImportParseResult> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        return {
            rows: [],
            errors: [{ rowNumber: 0, message: "El archivo no tiene hojas." }],
        };
    }

    const sheet = workbook.Sheets[sheetName];
    const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
    });

    if (raw.length === 0) {
        return {
            rows: [],
            errors: [{ rowNumber: 0, message: "El archivo está vacío." }],
        };
    }

    // Mapear cada fila normalizando sus claves (por si el usuario cambió mayúsculas/tildes)
    const rows: StockImportRow[] = [];
    const errors: StockImportParseError[] = [];

    raw.forEach((rawRow, i) => {
        const rowNumber = i + 2; // fila 1 = cabecera
        const normalized: Record<string, unknown> = {};
        for (const key of Object.keys(rawRow)) {
            normalized[normalizeHeader(key)] = rawRow[key];
        }

        const code = String(normalized["codigo"] ?? "").trim();
        const hasAnyValue = Object.values(normalized).some(
            (v) => String(v ?? "").trim() !== "",
        );
        if (!hasAnyValue) return; // fila en blanco, se ignora silenciosamente

        if (!code) {
            errors.push({ rowNumber, message: "Falta el código de producto." });
            return;
        }

        const newQuantity = parseNumber(normalized["cantidad_nueva"]);
        if (newQuantity === null) {
            errors.push({
                rowNumber,
                message: `Fila ${rowNumber} (${code}): cantidad_nueva vacía o inválida.`,
            });
            return;
        }
        if (newQuantity < 0) {
            errors.push({
                rowNumber,
                message: `Fila ${rowNumber} (${code}): la cantidad no puede ser negativa.`,
            });
            return;
        }

        const unitCostRaw = parseNumber(normalized["costo_unitario"]);
        const salePriceRaw = parseNumber(normalized["precio_venta_nuevo"]);

        rows.push({
            rowNumber,
            productCode: code,
            newQuantity,
            unitCost: unitCostRaw !== null && unitCostRaw > 0 ? unitCostRaw : undefined,
            salePrice: salePriceRaw !== null && salePriceRaw > 0 ? salePriceRaw : undefined,
        });
    });

    return { rows, errors };
}

export { TEMPLATE_HEADERS };
