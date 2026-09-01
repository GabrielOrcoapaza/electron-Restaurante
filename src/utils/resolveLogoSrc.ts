import type { CompanyData } from "../context/AuthContext";
import { getFullImageUrl, isLikelyImagePath } from "./getFullImageUrl";

/** Convierte ruta relativa, URL, data URL o base64 crudo en src válido para <img>. */
export function resolveLogoSrc(raw?: string | null): string | null {
    if (!raw?.trim()) return null;
    const value = raw.trim();
    if (value.startsWith("data:")) return value;
    if (isLikelyImagePath(value)) return getFullImageUrl(value);
    return `data:image/png;base64,${value}`;
}

/** Logo de sede con fallback a logo de empresa (misma prioridad que documentos/tickets). */
export function resolveBranchLogoSrc(
    companyData?: CompanyData | null,
): string | null {
    if (!companyData) return null;
    const raw =
        companyData.branch?.logo?.trim() ||
        companyData.branchLogo?.trim() ||
        companyData.company?.logo?.trim() ||
        companyData.companyLogo?.trim() ||
        null;
    return resolveLogoSrc(raw);
}

const BRANCH_LOGIN_LOGO_KEY = "branchLoginLogoCache";

export type BranchLoginLogoCache = {
    ruc: string;
    logo: string;
};

export function saveBranchLoginLogoCache(ruc: string, logo: string): void {
    const cleanRuc = ruc.trim().replace(/\D/g, "");
    if (!cleanRuc || !logo) return;
    try {
        localStorage.setItem(
            BRANCH_LOGIN_LOGO_KEY,
            JSON.stringify({ ruc: cleanRuc, logo } satisfies BranchLoginLogoCache),
        );
    } catch {
        /* storage lleno o no disponible */
    }
}

/** Logo guardado en el dispositivo (sin exigir RUC en el formulario). */
export function loadPersistedBranchLoginLogo(): string | null {
    try {
        const raw = localStorage.getItem(BRANCH_LOGIN_LOGO_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as BranchLoginLogoCache;
        if (!parsed.logo) return null;
        return resolveLogoSrc(parsed.logo);
    } catch {
        return null;
    }
}

export function loadBranchLoginLogoCache(
    ruc?: string,
): string | null {
    if (!ruc?.trim()) return loadPersistedBranchLoginLogo();
    const cleanRuc = ruc.trim().replace(/\D/g, "");
    if (cleanRuc.length !== 11) return loadPersistedBranchLoginLogo();
    try {
        const raw = localStorage.getItem(BRANCH_LOGIN_LOGO_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as BranchLoginLogoCache;
        if (parsed.ruc !== cleanRuc || !parsed.logo) {
            return loadPersistedBranchLoginLogo();
        }
        return resolveLogoSrc(parsed.logo);
    } catch {
        return loadPersistedBranchLoginLogo();
    }
}

export function clearBranchLoginLogoCache(): void {
    try {
        localStorage.removeItem(BRANCH_LOGIN_LOGO_KEY);
    } catch {
        /* ignorar */
    }
}
