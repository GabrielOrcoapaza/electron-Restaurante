import type { CompanyData } from "../context/AuthContext";

const DEFAULT_IGV_PERCENTAGE = 10.5;

// Catálogo SUNAT 07 (Tipo de Afectación del IGV)
const TAX_AFFECTATION_GRAVADO = "10";

export type BranchSessionPatch = Partial<CompanyData["branch"]>;

/** true si la sucursal está Gravada (IGV normal). Exonerada/Inafecta => sin IGV. */
export function isBranchGravado(
    branch: CompanyData["branch"] | null | undefined,
): boolean {
    // Sin dato (sucursales antiguas / respuesta parcial): asumir Gravado, igual que el default del backend.
    return (branch?.taxAffectationType ?? TAX_AFFECTATION_GRAVADO) === TAX_AFFECTATION_GRAVADO;
}

/** Fusiona datos de sucursal del login de usuario (como SumApp PreferencesManager). */
export function mergeBranchIntoCompanyData(
    companyData: CompanyData,
    branchPatch: BranchSessionPatch,
): CompanyData {
    const igvRaw =
        branchPatch.igvPercentage ?? companyData.branch.igvPercentage;
    const igv = Number(igvRaw);

    return {
        ...companyData,
        branch: {
            ...companyData.branch,
            ...branchPatch,
            ...(Number.isFinite(igv) && igv > 0
                ? { igvPercentage: igv }
                : {}),
        },
    };
}

/**
 * IGV efectivo de la sede: contexto React primero, luego localStorage (login de empresa).
 * Si la sucursal no está Gravada (Exonerada/Inafecta, ej. Ley de Amazonía), retorna 0
 * sin importar el igvPercentage nominal configurado.
 */
export function getBranchIgvPercentage(
    companyData: CompanyData | null | undefined,
): number {
    if (companyData?.branch && !isBranchGravado(companyData.branch)) {
        return 0;
    }

    const fromContext = Number(companyData?.branch?.igvPercentage);
    if (Number.isFinite(fromContext) && fromContext > 0) {
        return fromContext;
    }

    try {
        const raw = localStorage.getItem("companyData");
        if (raw) {
            const parsed = JSON.parse(raw) as CompanyData;
            if (parsed?.branch && !isBranchGravado(parsed.branch)) {
                return 0;
            }
            const fromStorage = Number(parsed?.branch?.igvPercentage);
            if (Number.isFinite(fromStorage) && fromStorage > 0) {
                return fromStorage;
            }
        }
    } catch {
        // companyData corrupto en localStorage
    }

    return DEFAULT_IGV_PERCENTAGE;
}

/**
 * Tipo de afectación IGV de la sede (catálogo SUNAT 07: "10" Gravado, "20" Exonerado,
 * "30" Inafecto). Mismo orden de resolución que getBranchIgvPercentage: contexto, luego
 * localStorage, default "10". Útil para enrutar el neto de un documento al casillero
 * correcto (totalTaxable/totalExempt/totalUnaffected) al crearlo para SUNAT.
 */
export function getBranchTaxAffectationType(
    companyData: CompanyData | null | undefined,
): string {
    if (companyData?.branch?.taxAffectationType) {
        return companyData.branch.taxAffectationType;
    }

    try {
        const raw = localStorage.getItem("companyData");
        if (raw) {
            const parsed = JSON.parse(raw) as CompanyData;
            if (parsed?.branch?.taxAffectationType) {
                return parsed.branch.taxAffectationType;
            }
        }
    } catch {
        // companyData corrupto en localStorage
    }

    return TAX_AFFECTATION_GRAVADO;
}
