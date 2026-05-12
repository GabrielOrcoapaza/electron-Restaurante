import { useEffect, useRef } from "react";
import { useMutation } from "@apollo/client";
import {
    CLAIM_TABLE_SESSION_LOCK,
    RENEW_TABLE_SESSION_LOCK,
    RELEASE_TABLE_SESSION_LOCK,
} from "../graphql/mutations";
import { logTableSessionLock } from "../utils/tableSessionLockLog";

/**
 * En producción sin mutaciones GraphQL: `false` u omite la variable (sin 400).
 * En local con backend actualizado: `VITE_ENABLE_TABLE_SESSION_LOCK=true` en `.env`.
 */
function isTableSessionLockApiEnabled(): boolean {
    return String(import.meta.env.VITE_ENABLE_TABLE_SESSION_LOCK || "")
        .toLowerCase()
        .trim() === "true";
}

function renewalIntervalMs(): number {
    const n = Number(import.meta.env.VITE_TABLE_SESSION_LOCK_RENEW_INTERVAL_MS);
    return Number.isFinite(n) && n > 0 ? n : 45_000;
}

/** Evita liberar candado dos veces (Strict Mode) al remontar la misma mesa en seguida. */
const pendingReleaseTimersByLockKey = new Map<
    string,
    ReturnType<typeof setTimeout>
>();

/** Coherente con el debounce de refetch tras eventos WS en el plano. */
const SESSION_LOCK_RELEASE_DEBOUNCE_MS = 450;

function cancelScheduledSessionLockRelease(tableId: string, userId: string) {
    const key = `${tableId}|${userId}`;
    const t = pendingReleaseTimersByLockKey.get(key);
    if (t) {
        clearTimeout(t);
        pendingReleaseTimersByLockKey.delete(key);
    }
}

function scheduleSessionLockRelease(opts: {
    tableId: string;
    userId: string;
    releaseMut: (args: {
        variables: { tableId: string; userId: string };
    }) => unknown;
}) {
    const { tableId, userId, releaseMut } = opts;
    const key = `${tableId}|${userId}`;
    const existing = pendingReleaseTimersByLockKey.get(key);
    if (existing) clearTimeout(existing);
    pendingReleaseTimersByLockKey.set(
        key,
        setTimeout(() => {
            pendingReleaseTimersByLockKey.delete(key);
            void releaseMut({ variables: { tableId, userId } });
        }, SESSION_LOCK_RELEASE_DEBOUNCE_MS),
    );
}

/**
 * Toma candado HTTP al abrir mesa, renueva periódicamente y libera al desmontar.
 * Si el claim falla (mesa en uso), llama onLockDenied una vez.
 */
export function useTableSessionLock(opts: {
    tableId: string | undefined;
    userId: string | undefined;
    enabled: boolean;
    onLockDenied?: (message: string) => void;
}): void {
    const { tableId, userId, enabled, onLockDenied } = opts;
    const [claimMut] = useMutation(CLAIM_TABLE_SESSION_LOCK);
    const [renewMut] = useMutation(RENEW_TABLE_SESSION_LOCK);
    const [releaseMut] = useMutation(RELEASE_TABLE_SESSION_LOCK);
    const onDeniedRef = useRef(onLockDenied);
    onDeniedRef.current = onLockDenied;

    useEffect(() => {
        if (!isTableSessionLockApiEnabled()) {
            logTableSessionLock("hook:skip", {
                reason: "VITE_ENABLE_TABLE_SESSION_LOCK no es true",
                tableId,
                enabled,
            });
            return;
        }
        if (!enabled || !tableId || !userId) {
            logTableSessionLock("hook:skip", {
                reason: !enabled
                    ? "enabled=false (p. ej. sin acceso a mesa)"
                    : !tableId
                      ? "sin tableId"
                      : "sin userId",
                tableId,
                userId,
                enabled,
            });
            return;
        }

        cancelScheduledSessionLockRelease(tableId, userId);

        logTableSessionLock("hook:claim:start", { tableId, userId });

        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;
        let claimedSuccessfully = false;

        void (async () => {
            try {
                const { data } = await claimMut({
                    variables: { tableId, userId },
                });
                if (cancelled) {
                    // No hacer release aquí: un remontaje rápido (Strict Mode / navegación)
                    // debe reclamar sin que un broadcast "liberado" pise otros clientes.
                    if (data?.claimTableSessionLock?.success) {
                        logTableSessionLock(
                            "hook:claim:ok-after-cancelled-effect",
                            { tableId },
                        );
                    }
                    return;
                }
                if (!data?.claimTableSessionLock?.success) {
                    logTableSessionLock("hook:claim:denied", {
                        tableId,
                        message: data?.claimTableSessionLock?.message,
                    });
                    onDeniedRef.current?.(
                        data?.claimTableSessionLock?.message ||
                            "No se pudo reservar la mesa.",
                    );
                    return;
                }
                logTableSessionLock("hook:claim:ok", { tableId, userId });
                claimedSuccessfully = true;
                intervalId = setInterval(() => {
                    void renewMut({ variables: { tableId, userId } });
                }, renewalIntervalMs());
            } catch (e: any) {
                if (!cancelled) {
                    logTableSessionLock("hook:claim:exception", {
                        tableId,
                        message: e?.message,
                    });
                    onDeniedRef.current?.(
                        e?.message || "Error al reservar la mesa.",
                    );
                }
            }
        })();

        return () => {
            cancelled = true;
            if (intervalId) {
                clearInterval(intervalId);
            }
            if (claimedSuccessfully) {
                logTableSessionLock("hook:release:unmount-scheduled", {
                    tableId,
                    debounceMs: SESSION_LOCK_RELEASE_DEBOUNCE_MS,
                });
                scheduleSessionLockRelease({
                    tableId,
                    userId,
                    releaseMut,
                });
            }
        };
    }, [enabled, tableId, userId, claimMut, renewMut, releaseMut]);
}
