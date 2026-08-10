import type { CompanyData } from "../context/AuthContext";

const DEFAULT_IGV_PERCENTAGE = 10.5;

export type BranchSessionPatch = Partial<CompanyData["branch"]>;

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

/** IGV de la sede: contexto React primero, luego localStorage (login de empresa). */
export function getBranchIgvPercentage(
    companyData: CompanyData | null | undefined,
): number {
    const fromContext = Number(companyData?.branch?.igvPercentage);
    if (Number.isFinite(fromContext) && fromContext > 0) {
        return fromContext;
    }

    try {
        const raw = localStorage.getItem("companyData");
        if (raw) {
            const parsed = JSON.parse(raw) as CompanyData;
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
