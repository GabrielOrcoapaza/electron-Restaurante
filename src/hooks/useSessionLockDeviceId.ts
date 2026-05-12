import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";

/**
 * Hook que resuelve el identificador único de este equipo para el candado de mesas.
 * En Electron prioriza la MAC; en navegador usa el device_id de localStorage.
 * 
 * Retorna null mientras se resuelve (ej. obteniendo MAC asíncronamente).
 */
export function useSessionLockDeviceId(): string | null {
    const { getMacAddress, deviceId } = useAuth();
    const [resolvedId, setResolvedId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const mac = await getMacAddress();
                if (!cancelled) {
                    setResolvedId(mac);
                }
            } catch (e) {
                console.error("[useSessionLockDeviceId] Error resolving MAC:", e);
                if (!cancelled) {
                    // Fallback al deviceId simple si falla la MAC
                    setResolvedId(deviceId || null);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [getMacAddress, deviceId]);

    return resolvedId;
}
