/**
 * Logs de diagnóstico del candado de mesa.
 * En desarrollo siempre activos; en producción solo si `VITE_DEBUG_TABLE_SESSION_LOCK=true` en `.env`.
 */
export function isTableSessionLockLogEnabled(): boolean {
    if (import.meta.env.DEV) return true;
    return (
        String(import.meta.env.VITE_DEBUG_TABLE_SESSION_LOCK || "")
            .toLowerCase()
            .trim() === "true"
    );
}

export function logTableSessionLock(
    scope: string,
    payload?: unknown,
): void {
    if (!isTableSessionLockLogEnabled()) return;
    console.log(`[TableSessionLock:${scope}]`, payload ?? "");
}
