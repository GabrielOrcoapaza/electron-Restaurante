import React, {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback,
} from "react";
import { useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../hooks/useResponsive";
import { useUserPermissions } from "../../hooks/useUserPermissions";
import { useWebSocket } from "../../context/WebSocketContext";
import { useToast } from "../../context/ToastContext";
import type { Table } from "../../types/table";
import {
    GET_FLOORS_BY_BRANCH,
    GET_TABLES_BY_FLOOR,
} from "../../graphql/queries";
import Order, { type OrderSuccessPayload } from "./order";

const FLOOR_ORDER_START_STORAGE_PREFIX = "appsuma:floorOrderStart:v1";

/** Agrupa ráfagas de eventos WS en un solo GetTablesByFloor */
const TABLES_WS_EVENT_DEBOUNCE_MS = 400;
/** Tras reconexión WS, evita N refetch si el socket tiembla */
const TABLES_WS_RECONNECT_DEBOUNCE_MS = 500;

function floorOrderStartStorageKey(
    branchId: string,
    operationId: string | number,
): string {
    return `${FLOOR_ORDER_START_STORAGE_PREFIX}:${branchId}:${String(operationId)}`;
}

function getOrderStartedAtIso(
    table: Table,
    branchId: string | undefined,
): string | null {
    if (!branchId || !table.currentOperationId) return null;
    const fromApi = table.currentOperation?.operationDate;
    if (fromApi) return fromApi;
    try {
        return localStorage.getItem(
            floorOrderStartStorageKey(branchId, table.currentOperationId),
        );
    } catch {
        return null;
    }
}

function persistOrderStart(
    branchId: string,
    payload: OrderSuccessPayload,
): void {
    const opId = payload.operationId;
    if (opId == null || opId === "") return;
    const iso = payload.operationDate || new Date().toISOString();
    try {
        localStorage.setItem(floorOrderStartStorageKey(branchId, opId), iso);
    } catch {
        /* ignore quota / private mode */
    }
}

function tableShowsOrderTimer(table: Table): boolean {
    if (!table.currentOperationId) return false;
    if (table.status === "AVAILABLE" || table.status === "MAINTENANCE")
        return false;
    return (
        table.status === "OCCUPIED" ||
        table.status === "TO_PAY" ||
        table.status === "IN_PROCESS"
    );
}

/** Tiempo transcurrido solo en minutos (sin segundos): 0–59 s → «0 min», luego «1 min», … y con horas «1h 5m». */
function formatElapsedShort(fromMs: number, nowMs: number): string {
    const elapsed = Math.max(0, nowMs - fromMs);
    const totalMinutes = Math.floor(elapsed / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0) {
        return `${h}h ${m}m`;
    }
    return `${totalMinutes} min`;
}

type FloorProps = {
    onOpenCash?: (table: Table) => void;
};

// Colores Tailwind por estado para mejor compatibilidad con dark/light
const getTableTailwindClasses = (status: string) => {
    switch (status) {
        case "AVAILABLE":
            return {
                bg: "bg-green-100 dark:bg-green-900/30",
                border: "border-green-400 dark:border-green-700",
                text: "text-green-900 dark:text-green-100",
                badgeBg: "bg-green-600 dark:bg-green-500",
                badgeText: "text-white",
            };
        case "OCCUPIED":
            return {
                bg: "bg-red-100 dark:bg-red-900/30",
                border: "border-red-400 dark:border-red-700",
                text: "text-red-900 dark:text-red-100",
                badgeBg: "bg-red-600 dark:bg-red-500",
                badgeText: "text-white",
            };
        case "TO_PAY":
            return {
                bg: "bg-yellow-100 dark:bg-yellow-900/30",
                border: "border-yellow-400 dark:border-yellow-700",
                text: "text-yellow-900 dark:text-yellow-100",
                badgeBg: "bg-yellow-600 dark:bg-yellow-500",
                badgeText: "text-white",
            };
        case "IN_PROCESS":
            return {
                bg: "bg-cyan-100 dark:bg-cyan-900/30",
                border: "border-cyan-400 dark:border-cyan-700",
                text: "text-cyan-900 dark:text-cyan-100",
                badgeBg: "bg-cyan-600 dark:bg-cyan-500",
                badgeText: "text-white",
            };
        case "MAINTENANCE":
        default:
            return {
                bg: "bg-slate-100 dark:bg-slate-800",
                border: "border-slate-400 dark:border-slate-600",
                text: "text-slate-900 dark:text-slate-100",
                badgeBg: "bg-slate-600 dark:bg-slate-500",
                badgeText: "text-white",
            };
    }
};

const Floor: React.FC<FloorProps> = ({ onOpenCash }) => {
    const { companyData, user } = useAuth();
    const { hasPermission } = useUserPermissions();
    const { showToast } = useToast();
    const { breakpoint } = useResponsive();

    // Adaptar según tamaño de pantalla
    const isXs = breakpoint === "xs";
    const isSmall = breakpoint === "sm";
    const isMedium = breakpoint === "md";
    const isSmallDesktop = breakpoint === "lg";

    const tablesGridColumns = isXs
        ? "repeat(2, 1fr)"
        : isSmall
          ? "repeat(3, 1fr)"
          : isMedium
            ? "repeat(5, 1fr)"
            : isSmallDesktop
              ? "repeat(7, 1fr)"
              : "repeat(8, 1fr)";

    const floorsGridColumns = isXs
        ? "repeat(3, 1fr)"
        : isSmall
          ? "repeat(4, 1fr)"
          : isMedium
            ? "repeat(6, 1fr)"
            : "repeat(10, 1fr)";

    const [selectedFloorId, setSelectedFloorId] = useState<string>("");
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showOrder, setShowOrder] = useState(false);
    const [orderTimerTick, setOrderTimerTick] = useState(() => Date.now());

    useEffect(() => {
        const id = window.setInterval(
            () => setOrderTimerTick(Date.now()),
            1000,
        );
        return () => window.clearInterval(id);
    }, []);

    const {
        data: floorsData,
        loading: floorsLoading,
        error: floorsError,
    } = useQuery(GET_FLOORS_BY_BRANCH, {
        variables: { branchId: companyData?.branch.id },
        skip: !companyData?.branch.id,
        fetchPolicy: "network-only",
    });

    const branchFloors = floorsData?.floorsByBranch;
    const activeFloors = useMemo(
        () =>
            (branchFloors ?? []).filter(
                (f: { isActive?: boolean }) => f.isActive !== false,
            ),
        [branchFloors],
    );
    const hasAnyFloorRecord = (branchFloors?.length ?? 0) > 0;

    useEffect(() => {
        if (activeFloors.length === 0) {
            if (selectedFloorId) setSelectedFloorId("");
            return;
        }
        const stillValid = activeFloors.some(
            (f: { id: string }) => f.id === selectedFloorId,
        );
        if (!selectedFloorId || !stillValid) {
            setSelectedFloorId(activeFloors[0].id);
        }
    }, [activeFloors, selectedFloorId]);

    const {
        data: tablesData,
        loading: tablesLoading,
        error: tablesError,
        refetch: refetchTables,
    } = useQuery(GET_TABLES_BY_FLOOR, {
        variables: { floorId: selectedFloorId },
        skip: !selectedFloorId,
        fetchPolicy: "network-only",
        nextFetchPolicy: "network-only",
    });

    const tablesOnFloor: Table[] = tablesData?.tablesByFloor ?? [];
    const visibleTables = tablesOnFloor.filter((t) => t.isActive !== false);

    const refetchTablesFromServer = useCallback(
        () => refetchTables({ fetchPolicy: "network-only" }),
        [refetchTables],
    );

    const tablesWsEventDebounceRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null);
    const tablesWsReconnectDebounceRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null);

    const { subscribe } = useWebSocket();

    useEffect(() => {
        const runRefetch = () => {
            if (!selectedFloorId) return;
            void refetchTablesFromServer()
                .then(() => {})
                .catch((error) => {
                    console.error("❌ Error al refetch mesas:", error);
                });
        };

        const scheduleEventRefetch = () => {
            if (!selectedFloorId) return;
            if (tablesWsEventDebounceRef.current) {
                clearTimeout(tablesWsEventDebounceRef.current);
            }
            tablesWsEventDebounceRef.current = setTimeout(() => {
                tablesWsEventDebounceRef.current = null;
                runRefetch();
            }, TABLES_WS_EVENT_DEBOUNCE_MS);
        };

        const scheduleReconnectRefetch = () => {
            if (!selectedFloorId) return;
            if (tablesWsReconnectDebounceRef.current) {
                clearTimeout(tablesWsReconnectDebounceRef.current);
            }
            tablesWsReconnectDebounceRef.current = setTimeout(() => {
                tablesWsReconnectDebounceRef.current = null;
                runRefetch();
            }, TABLES_WS_RECONNECT_DEBOUNCE_MS);
        };

        const unsubscribeConnected = subscribe("connected", () =>
            scheduleReconnectRefetch(),
        );
        const unsubscribeConnection = subscribe(
            "connection_established",
            () => {},
        );
        const unsubscribeSnapshot = subscribe("tables_snapshot", () =>
            scheduleEventRefetch(),
        );
        const unsubscribeTableUpdate = subscribe("table_update", () =>
            scheduleEventRefetch(),
        );
        const unsubscribeTableStatusUpdate = subscribe(
            "table_status_update",
            () => scheduleEventRefetch(),
        );
        const unsubscribeError = subscribe("error", (message) =>
            showToast(message.message, "error"),
        );
        const unsubscribePong = subscribe("pong", () => {});

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                scheduleEventRefetch();
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            if (tablesWsEventDebounceRef.current)
                clearTimeout(tablesWsEventDebounceRef.current);
            if (tablesWsReconnectDebounceRef.current)
                clearTimeout(tablesWsReconnectDebounceRef.current);
            document.removeEventListener(
                "visibilitychange",
                onVisibilityChange,
            );
            unsubscribeConnected();
            unsubscribeConnection();
            unsubscribeSnapshot();
            unsubscribeTableUpdate();
            unsubscribeTableStatusUpdate();
            unsubscribeError();
            unsubscribePong();
        };
    }, [subscribe, refetchTablesFromServer, selectedFloorId, showToast]);

    const handleFloorSelect = (floorId: string) => {
        setSelectedFloorId(floorId);
    };

    const canAccessTable = (
        table: Table,
    ): { canAccess: boolean; reason?: string } => {
        if (hasPermission("sales.pay")) {
            return { canAccess: true };
        }

        if (!table.currentOperationId || !table.occupiedById) {
            return { canAccess: true };
        }

        const isMultiWaiterEnabled =
            companyData?.branch?.isMultiWaiterEnabled || false;

        if (isMultiWaiterEnabled) {
            return { canAccess: true };
        }

        const tableOccupiedById = String(table.occupiedById);
        const currentUserId = String(user?.id);

        if (tableOccupiedById === currentUserId) {
            return { canAccess: true };
        }

        return {
            canAccess: false,
            reason: `Esta mesa está siendo atendida por ${table.userName || "otro usuario"}.`,
        };
    };

    const isMozo = (user?.role || "").toUpperCase() === "WAITER";

    const handleTableClick = (table: Table) => {
        const accessCheck = canAccessTable(table);

        if (!accessCheck.canAccess) {
            showToast(
                accessCheck.reason ||
                    "No tiene permiso para acceder a esta mesa.",
                "error",
            );
            return;
        }

        const floorRec = activeFloors.find(
            (f: { id: string }) => f.id === selectedFloorId,
        );
        setSelectedTable({
            ...table,
            ...(floorRec?.name ? { floorName: String(floorRec.name) } : {}),
        });
        const hasExistingOrder =
            Boolean(table.currentOperationId) ||
            table.status === "OCCUPIED" ||
            table.status === "TO_PAY";

        if (isMozo) {
            setShowStatusModal(false);
            setShowOrder(true);
            return;
        }

        if (hasExistingOrder) {
            setShowOrder(false);
            setShowStatusModal(true);
        } else {
            setShowStatusModal(false);
            setShowOrder(true);
        }
    };

    if (floorsLoading) {
        return (
            <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
                Cargando pisos...
            </div>
        );
    }

    if (floorsError) {
        return (
            <div className="flex h-full items-center justify-center text-red-500 dark:text-red-400">
                Error al cargar los pisos: {floorsError.message}
            </div>
        );
    }

    return (
        <div className="flex h-full w-full flex-col overflow-hidden p-6">
            {/* Sección pisos */}
            <div className="flex-shrink-0 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
                {activeFloors.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 dark:text-slate-400">
                        <div className="mb-3 text-4xl">🏢</div>
                        <p className="text-sm font-medium">
                            {hasAnyFloorRecord
                                ? "No hay pisos activos. Active un piso en Configuración para verlo aquí."
                                : "No hay pisos disponibles para esta sucursal"}
                        </p>
                    </div>
                ) : (
                    <div className="max-h-44 overflow-y-auto pb-1">
                        <div
                            className="grid gap-3"
                            style={{ gridTemplateColumns: floorsGridColumns }}
                        >
                            {activeFloors.map((floor: any) => {
                                const isFloorSelected =
                                    selectedFloorId === floor.id;
                                return (
                                    <button
                                        key={floor.id}
                                        onClick={() =>
                                            handleFloorSelect(floor.id)
                                        }
                                        title={floor.name}
                                        className={`relative flex flex-col items-center justify-center rounded-xl border-2 px-4 py-3 text-center transition-all duration-200 min-w-0 ${
                                            isFloorSelected
                                                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300"
                                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/20"
                                        }`}
                                    >
                                        <span className="mb-1 text-2xl">
                                            🏢
                                        </span>
                                        <span className="line-clamp-2 w-full text-xs font-semibold leading-tight">
                                            {floor.name}
                                        </span>
                                        {isFloorSelected && (
                                            <div className="absolute right-2 top-2 flex h-2 w-2 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                                        )}
                                        <span
                                            className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                                isFloorSelected
                                                    ? "bg-indigo-500 text-white dark:bg-indigo-400"
                                                    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                            }`}
                                        >
                                            {floor.order}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Sección mesas */}
            {selectedFloorId && (
                <div className="mt-6 flex flex-1 flex-col overflow-hidden">
                    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
                        {tablesLoading ? (
                            <div className="flex flex-1 items-center justify-center text-slate-500 dark:text-slate-400">
                                Cargando mesas...
                            </div>
                        ) : tablesError ? (
                            <div className="flex flex-1 items-center justify-center text-red-500 dark:text-red-400">
                                Error al cargar las mesas: {tablesError.message}
                            </div>
                        ) : tablesOnFloor.length === 0 ? (
                            <div className="flex flex-1 flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                                <div className="mb-4 text-5xl">🪑</div>
                                <p className="text-sm font-medium">
                                    No hay mesas en este piso
                                </p>
                            </div>
                        ) : visibleTables.length === 0 ? (
                            <div className="flex flex-1 flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                                <div className="mb-4 text-5xl">🪑</div>
                                <p className="text-sm font-medium">
                                    No hay mesas activas en este piso.
                                </p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto pb-1">
                                <div
                                    className="grid gap-3"
                                    style={{
                                        gridTemplateColumns: tablesGridColumns,
                                    }}
                                >
                                    {visibleTables.map((table: Table) => {
                                        const classes = getTableTailwindClasses(
                                            table.status,
                                        );
                                        const tableShape =
                                            table.shape as string;
                                        const isRoundTable =
                                            tableShape === "ROUND" ||
                                            tableShape === "CIRCLE";

                                        let orderTimerLabel: string | null =
                                            null;
                                        if (tableShowsOrderTimer(table)) {
                                            const startIso =
                                                getOrderStartedAtIso(
                                                    table,
                                                    companyData?.branch?.id,
                                                );
                                            if (startIso) {
                                                const startMs = new Date(
                                                    startIso,
                                                ).getTime();
                                                if (!Number.isNaN(startMs)) {
                                                    orderTimerLabel =
                                                        formatElapsedShort(
                                                            startMs,
                                                            orderTimerTick,
                                                        );
                                                }
                                            }
                                        }

                                        const accessCheck =
                                            canAccessTable(table);

                                        return (
                                            <button
                                                key={table.id}
                                                onClick={() =>
                                                    handleTableClick(table)
                                                }
                                                disabled={
                                                    !accessCheck.canAccess
                                                }
                                                className={`relative flex flex-col items-center justify-center border-2 px-3 py-3 text-center transition-all duration-200 ${
                                                    isRoundTable
                                                        ? "aspect-square rounded-full"
                                                        : "rounded-xl min-h-24"
                                                } ${classes.bg} ${classes.border} ${
                                                    accessCheck.canAccess
                                                        ? "cursor-pointer hover:scale-[1.02] hover:shadow-md"
                                                        : "cursor-not-allowed opacity-60"
                                                }`}
                                            >
                                                <span
                                                    className={`mb-1 line-clamp-1 w-full font-bold ${classes.text}`}
                                                    style={{
                                                        fontSize: isXs
                                                            ? "1.2rem"
                                                            : "1.1rem",
                                                    }}
                                                >
                                                    {table.name}
                                                </span>

                                                {orderTimerLabel != null && (
                                                    <div
                                                        title="Tiempo desde la apertura de la orden"
                                                        className={`mt-1 rounded-md px-2 py-0.5 text-xs font-bold ${classes.text} bg-white/30 dark:bg-black/20`}
                                                    >
                                                        ⏱ {orderTimerLabel}
                                                    </div>
                                                )}

                                                {table.userName &&
                                                    table.status !==
                                                        "AVAILABLE" && (
                                                        <div
                                                            className={`mt-1 max-w-full truncate rounded-lg px-2 py-0.5 text-xs font-bold ${classes.badgeBg} ${classes.badgeText}`}
                                                        >
                                                            {table.userName}
                                                        </div>
                                                    )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de opciones de mesa */}
            {showStatusModal && selectedTable && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-950">
                        <h3 className="mb-6 text-center text-lg font-bold text-slate-900 dark:text-white">
                            Elige una opción
                        </h3>

                        <div className="mb-8 text-center">
                            <div className="mb-3 text-4xl">
                                {selectedTable.shape === "CIRCLE" ? "⭕" : "🟦"}
                            </div>
                            <h4 className="mb-1 text-base font-semibold text-slate-900 dark:text-white">
                                {selectedTable.name}
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Capacidad: {selectedTable.capacity}
                            </p>
                        </div>

                        <div className="space-y-3">
                            {selectedTable &&
                                canAccessTable(selectedTable).canAccess && (
                                    <button
                                        onClick={() => {
                                            setShowStatusModal(false);
                                            setShowOrder(true);
                                        }}
                                        className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                                    >
                                        Orden
                                    </button>
                                )}
                            <button
                                onClick={() => {
                                    const tableForCash = selectedTable;
                                    if (!tableForCash?.currentOperationId) {
                                        showToast(
                                            "Esta mesa no tiene una orden activa para cobrar.",
                                            "error",
                                        );
                                        return;
                                    }
                                    setShowStatusModal(false);
                                    setShowOrder(false);
                                    onOpenCash?.(tableForCash);
                                    setSelectedTable(null);
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                                Caja
                            </button>
                            <button
                                onClick={() => {
                                    setShowStatusModal(false);
                                    setSelectedTable(null);
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-800"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Orden */}
            {showOrder && selectedTable && (
                <Order
                    table={selectedTable}
                    onOpenCash={onOpenCash}
                    onClose={() => {
                        setShowOrder(false);
                        setSelectedTable(null);
                    }}
                    onSuccess={async (payload) => {
                        if (payload && companyData?.branch?.id) {
                            persistOrderStart(companyData.branch.id, payload);
                            showToast(
                                `Orden guardada exitosamente. La mesa ${selectedTable.name} ha sido actualizada.`,
                                "success",
                            );
                        }
                        console.log(
                            "🔄 Refetch inmediato de mesas después de guardar orden",
                        );
                        try {
                            await refetchTablesFromServer();
                            console.log("✅ Mesas actualizadas correctamente");
                        } catch (error) {
                            console.error(
                                "❌ Error al actualizar mesas:",
                                error,
                            );
                        }
                    }}
                />
            )}
        </div>
    );
};

export default Floor;
