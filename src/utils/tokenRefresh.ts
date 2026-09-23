import {
    getTokenExpiration,
    isTokenExpired,
    isTokenExpiringSoon,
} from "./jwt";

/** Renovar el access token esta cantidad de segundos antes de que venza. */
export const TOKEN_REFRESH_BUFFER_SECONDS = 1800;

const REFRESH_TOKEN_MUTATION = `
    mutation RefreshToken($token: String!) {
        refreshToken(token: $token) {
            token
            refreshExpiresIn
        }
    }
`;

let refreshInFlight: Promise<string | null> | null = null;

function getGraphqlUrl(): string {
    return import.meta.env.VITE_GRAPHQL_URL as string;
}

export function notifyAuthStorageChanged(): void {
    window.dispatchEvent(
        new StorageEvent("storage", {
            key: "token",
            newValue: localStorage.getItem("token"),
            oldValue: null,
            storageArea: localStorage,
            url: window.location.href,
        }),
    );
}

export function clearAllAuthStorage(): void {
    console.log(
        "🧹 Limpiando almacenamiento de autenticación (sesión inválida o expirada)...",
    );
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userData");
    localStorage.removeItem("userPhoto");
    notifyAuthStorageChanged();
}

export function persistAccessToken(accessToken: string): void {
    localStorage.setItem("token", accessToken);
    notifyAuthStorageChanged();
}

function canUseRefreshToken(refreshToken: string | null): boolean {
    if (!refreshToken) return false;
    if (isTokenExpired(refreshToken)) return false;

    try {
        const parts = refreshToken.split(".");
        if (parts.length !== 3) return false;
        const payload = JSON.parse(atob(parts[1])) as {
            origIat?: number;
        };
        const origIat = payload.origIat;
        if (typeof origIat !== "number") return true;
        // Alineado con JWT_REFRESH_EXPIRATION_DELTA del backend (7 días).
        const refreshWindowSeconds = 7 * 24 * 60 * 60;
        const now = Math.floor(Date.now() / 1000);
        return now < origIat + refreshWindowSeconds;
    } catch {
        return !isTokenExpired(refreshToken);
    }
}

/**
 * Canjea el refreshToken por un access token nuevo (graphql_jwt `refreshToken`).
 * Usa fetch directo para no depender del auth link de Apollo.
 */
export async function refreshAccessToken(): Promise<string | null> {
    if (refreshInFlight) {
        return refreshInFlight;
    }

    refreshInFlight = (async () => {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!canUseRefreshToken(refreshToken)) {
            console.warn("⚠️ Refresh token ausente, expirado o fuera de ventana.");
            return null;
        }

        const graphqlUrl = getGraphqlUrl();
        if (!graphqlUrl) {
            console.error("❌ VITE_GRAPHQL_URL no configurada.");
            return null;
        }

        try {
            const response = await fetch(graphqlUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    operationName: "RefreshToken",
                    query: REFRESH_TOKEN_MUTATION,
                    variables: { token: refreshToken },
                }),
            });

            if (!response.ok) {
                console.error(
                    "❌ Error HTTP al refrescar token:",
                    response.status,
                );
                return null;
            }

            const result = (await response.json()) as {
                data?: { refreshToken?: { token?: string | null } | null };
                errors?: Array<{ message?: string }>;
            };

            if (result.errors?.length) {
                console.error(
                    "❌ GraphQL refreshToken:",
                    result.errors.map((e) => e.message).join("; "),
                );
                return null;
            }

            const newAccessToken = result.data?.refreshToken?.token ?? null;
            if (!newAccessToken) {
                console.error("❌ refreshToken no devolvió access token.");
                return null;
            }

            persistAccessToken(newAccessToken);
            const exp = getTokenExpiration(newAccessToken);
            console.log(
                "✅ Access token renovado",
                exp
                    ? `(vence ${new Date(exp * 1000).toLocaleString()})`
                    : "",
            );
            return newAccessToken;
        } catch (error) {
            console.error("❌ Error de red al refrescar token:", error);
            return null;
        } finally {
            refreshInFlight = null;
        }
    })();

    return refreshInFlight;
}

/**
 * Devuelve un access token válido: el actual o uno renovado con refreshToken.
 */
export async function ensureValidAccessToken(): Promise<string | null> {
    const currentToken = localStorage.getItem("token");
    const refreshToken = localStorage.getItem("refreshToken");

    if (
        currentToken &&
        !isTokenExpired(currentToken) &&
        !isTokenExpiringSoon(currentToken, TOKEN_REFRESH_BUFFER_SECONDS)
    ) {
        return currentToken;
    }

    if (!refreshToken) {
        if (currentToken && !isTokenExpired(currentToken)) {
            return currentToken;
        }
        return null;
    }

    const renewed = await refreshAccessToken();
    if (renewed) {
        return renewed;
    }

    if (currentToken && !isTokenExpired(currentToken)) {
        return currentToken;
    }

    return null;
}

export function isGraphqlAuthError(message?: string, code?: unknown): boolean {
    if (code === "UNAUTHENTICATED" || code === "UNAUTHORIZED") {
        return true;
    }
    if (!message) return false;
    const lower = message.toLowerCase();
    return (
        lower.includes("expir") ||
        lower.includes("expired") ||
        lower.includes("firma") ||
        lower.includes("signature") ||
        lower.includes("not authenticated") ||
        lower.includes("no autenticado") ||
        lower.includes("invalid token") ||
        lower.includes("token inválido")
    );
}
