import * as XLSX from "xlsx";
import { exportToExcel } from "../../utils/exportToExcel";

/** Columnas alineadas con el admin Django / bulkImportCatalog en el backend. */
export const CATALOG_IMPORT_HEADERS = [
    "categoria",
    "subcategoria",
    "codigo",
    "nombre",
    "tipo",
    "precio_venta",
    "precio_compra",
    "unidad_medida",
    "modificadores",
] as const;

const EXAMPLE_ROWS: Record<string, string>[] = [
    {
        categoria: "Bebidas",
        subcategoria: "Gaseosas",
        codigo: "GAS001",
        nombre: "Coca Cola 500ml",
        tipo: "Bebida",
        precio_venta: "3.50",
        precio_compra: "2.00",
        unidad_medida: "Unidad",
        modificadores: "Normal, Sin hielo",
    },
    {
        categoria: "Carta",
        subcategoria: "Entradas",
        codigo: "ENT001",
        nombre: "Ensalada César",
        tipo: "Plato",
        precio_venta: "18.00",
        precio_compra: "6.00",
        unidad_medida: "Unidad",
        modificadores: "Sin crutones",
    },
    {
        categoria: "",
        subcategoria: "",
        codigo: "ING001",
        nombre: "Tomate cherry",
        tipo: "Ingrediente",
        precio_venta: "0",
        precio_compra: "4.50",
        unidad_medida: "Kilogramo",
        modificadores: "",
    },
];

export async function downloadCatalogImportTemplate(
    branchName: string,
): Promise<void> {
    await exportToExcel({
        filename: `plantilla_catalogo_${branchName || "sede"}`,
        sheets: [{ name: "Catálogo", rows: EXAMPLE_ROWS }],
    });
}

export function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== "string") {
                reject(new Error("No se pudo leer el archivo."));
                return;
            }
            const base64 = result.includes(",")
                ? result.split(",", 2)[1]
                : result;
            resolve(base64);
        };
        reader.onerror = () =>
            reject(reader.error ?? new Error("Error al leer el archivo."));
        reader.readAsDataURL(file);
    });
}

/** Vista previa local: valida cabeceras mínimas antes de enviar al servidor. */
export async function validateCatalogExcelHeaders(
    file: File,
): Promise<{ ok: boolean; message?: string; dataRowCount?: number }> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        return { ok: false, message: "El archivo no tiene hojas." };
    }
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
    }) as unknown[][];
    if (rows.length === 0) {
        return { ok: false, message: "El archivo está vacío." };
    }
    const headerKeys = (rows[0] || []).map((c) =>
        String(c ?? "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[áàä]/g, "a")
            .replace(/[éèë]/g, "e")
            .replace(/[íìï]/g, "i")
            .replace(/[óòö]/g, "o")
            .replace(/[úùü]/g, "u")
            .replace(/ñ/g, "n"),
    );
    const required = ["categoria", "subcategoria", "codigo", "nombre"];
    const missing = required.filter((h) => !headerKeys.includes(h));
    if (missing.length) {
        return {
            ok: false,
            message: `Faltan columnas en la cabecera: ${missing.join(", ")}`,
        };
    }
    const dataRows = rows.slice(1).filter((row) =>
        row.some((cell) => String(cell ?? "").trim() !== ""),
    );
    return { ok: true, dataRowCount: dataRows.length };
}
