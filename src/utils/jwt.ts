type JwtPayload = {
    exp?: number;
    origIat?: number;
    [key: string]: unknown;
};

function decodeJwtPayload(jwtToken: string): JwtPayload | null {
    try {
        const parts = jwtToken.split(".");
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1])) as JwtPayload;
        return payload;
    } catch {
        return null;
    }
}

/** Timestamp Unix (segundos) de expiración del JWT, o null si no se puede leer. */
export function getTokenExpiration(jwtToken: string | null): number | null {
    if (!jwtToken) return null;
    const payload = decodeJwtPayload(jwtToken);
    return typeof payload?.exp === "number" ? payload.exp : null;
}

/** True si el JWT ya venció. */
export const isTokenExpired = (jwtToken: string | null): boolean => {
    const exp = getTokenExpiration(jwtToken);
    if (exp == null) return true;
    const now = Math.floor(Date.now() / 1000);
    return exp <= now;
};

/** True si el JWT vence dentro de `bufferSeconds` (renovación proactiva). */
export function isTokenExpiringSoon(
    jwtToken: string | null,
    bufferSeconds = 1800,
): boolean {
    const exp = getTokenExpiration(jwtToken);
    if (exp == null) return true;
    const now = Math.floor(Date.now() / 1000);
    return exp - now <= bufferSeconds;
}
