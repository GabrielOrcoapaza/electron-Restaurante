// Helper para verificar si un token JWT ha expirado
export const isTokenExpired = (jwtToken: string | null): boolean => {
    if (!jwtToken) return true;
    try {
        const parts = jwtToken.split(".");
        if (parts.length !== 3) return true;
        const payload = JSON.parse(atob(parts[1]));
        const now = Math.floor(Date.now() / 1000);
        return payload.exp < now;
    } catch (e) {
        return true;
    }
};
