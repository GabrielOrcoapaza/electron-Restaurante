import React, { useState } from "react";
import { useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../hooks/useResponsive";
import { GET_CANCELLATION_REPORT } from "../../graphql/queries";
import ReportCancelList from "./reportCancelList";
import { formatLocalDateYYYYMMDD } from "../../utils/localDateTime";

export interface CancellationItem {
    id: string;
    type: string;
    operationId: string;
    operationOrder: string;
    detailId?: string;
    productName?: string;
    quantity?: number;
    amount: number;
    reason: string;
    cancelledAt: string;
    user: {
        id: string;
        fullName: string;
    };
}

const ReportCancel: React.FC = () => {
    const { companyData } = useAuth();
    const { breakpoint, isMobile, isXs } = useResponsive();
    const branchId = companyData?.branch?.id;

    // Adaptar según tamaño de pantalla
    const isSmall = breakpoint === "sm" || isMobile;
    const isMedium = breakpoint === "md";
    const isSmallDesktop = breakpoint === "lg";

    const containerPadding = isXs ? "0.75rem" : isSmall ? "1rem" : "1.5rem";
    const containerGap = isXs ? "0.75rem" : isSmall ? "1rem" : "1.5rem";
    const titleFontSize = isXs ? "1.1rem" : isSmall ? "1.25rem" : "1.5rem";
    const subtitleFontSize = isXs ? "0.7rem" : isSmall ? "0.75rem" : "0.875rem";
    const cardPadding = isXs ? "0.85rem" : isSmall ? "1rem" : "1.5rem";
    const inputFontSize = isXs ? "0.85rem" : isSmall ? "0.9rem" : "0.875rem";
    const buttonFontSize = isXs ? "0.85rem" : isSmall ? "0.9rem" : "0.875rem";

    // Estado para los filtros: por defecto fecha actual (hoy); el usuario puede cambiar si desea otro rango
    const [startDate, setStartDate] = useState<string>(() =>
        formatLocalDateYYYYMMDD(),
    );
    const [endDate, setEndDate] = useState<string>(() =>
        formatLocalDateYYYYMMDD(),
    );
    const [type, setType] = useState<string>("BOTH"); // OPERATIONS, ITEMS, BOTH

    // Query para obtener reporte de anulaciones
    const { data, loading, error, refetch } = useQuery(
        GET_CANCELLATION_REPORT,
        {
            variables: {
                branchId: branchId!,
                startDate: startDate,
                endDate: endDate,
            },
            skip: !branchId || !startDate || !endDate,
            fetchPolicy: "network-only",
        },
    );

    const cancellationItems: CancellationItem[] = React.useMemo(() => {
        if (!data?.cancellationReport?.operations) return [];

        const items: CancellationItem[] = [];
        const operations = data.cancellationReport.operations;

        operations.forEach((op: any) => {
            // Agregar anulación de operación si corresponde
            if (op.status === "CANCELLED") {
                items.push({
                    id: op.operationId,
                    type: "OPERATION",
                    operationId: op.operationId,
                    operationOrder: op.order,
                    amount: op.cancelledTotal,
                    reason: "Anulación de operación",
                    cancelledAt: op.cancelledAt,
                    user: {
                        id: "",
                        fullName: op.cancelledByName || "Desconocido",
                    },
                });
            }

            // Agregar anulaciones de items
            if (op.cancelledItems && op.cancelledItems.length > 0) {
                op.cancelledItems.forEach((item: any) => {
                    items.push({
                        id: item.detailId,
                        type: "ITEM",
                        operationId: op.operationId,
                        operationOrder: op.order,
                        detailId: item.detailId,
                        productName: item.productName,
                        quantity: item.quantity,
                        amount: item.total,
                        reason: item.notes || "Sin motivo",
                        cancelledAt: item.cancelledAt,
                        user: {
                            id: "",
                            fullName: item.cancelledByName || "Desconocido",
                        },
                    });
                });
            }
        });

        // Filtrar según selección
        return items.filter((item) => {
            if (type === "BOTH") return true;
            if (type === "OPERATIONS") return item.type === "OPERATION";
            if (type === "ITEMS") return item.type === "ITEM";
            return true;
        });
    }, [data, type]);

    const handleSearch = () => {
        refetch();
    };

    if (!branchId) {
        return (
            <div
                style={{
                    padding: containerPadding,
                    textAlign: "center",
                    color: "#dc2626",
                    fontSize: subtitleFontSize,
                }}
            >
                No se encontró información de la sucursal. Por favor, inicia
                sesión nuevamente.
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: "100%",
                display: "flex",
                flexDirection: "column",
                gap: containerGap,
                background:
                    "linear-gradient(160deg, #f0f4ff 0%, #f9fafb 45%, #ffffff 100%)",
                padding: containerPadding,
                borderRadius: "18px",
                boxShadow: "0 25px 50px -12px rgba(15,23,42,0.18)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Elementos decorativos de fondo */}
            <div
                style={{
                    position: "absolute",
                    top: "-120px",
                    right: "-120px",
                    width: isSmall
                        ? "180px"
                        : isMedium
                          ? "220px"
                          : isSmallDesktop
                            ? "220px"
                            : "260px",
                    height: isSmall
                        ? "180px"
                        : isMedium
                          ? "220px"
                          : isSmallDesktop
                            ? "220px"
                            : "260px",
                    background:
                        "radial-gradient(circle at center, rgba(102,126,234,0.25), transparent 70%)",
                    filter: "blur(2px)",
                    zIndex: 0,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    bottom: "-80px",
                    left: "-80px",
                    width: isSmallDesktop ? "180px" : "220px",
                    height: isSmallDesktop ? "180px" : "220px",
                    background:
                        "radial-gradient(circle at center, rgba(72,219,251,0.18), transparent 70%)",
                    filter: "blur(2px)",
                    zIndex: 0,
                }}
            />

            {/* Contenido principal */}
            <div style={{ position: "relative", zIndex: 1 }}>
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: isSmall ? "flex-start" : "center",
                        flexDirection: isSmall ? "column" : "row",
                        marginBottom: containerGap,
                        flexWrap: isSmall || isMedium ? "wrap" : "nowrap",
                        gap: isSmall || isMedium ? "1rem" : "0",
                    }}
                >
                    <div>
                        <h1
                            style={{
                                fontSize: titleFontSize,
                                fontWeight: 700,
                                color: "#1e293b",
                                margin: 0,
                                marginBottom: "0.5rem",
                            }}
                        >
                            Reporte de Anulaciones
                        </h1>
                        <p
                            style={{
                                fontSize: subtitleFontSize,
                                color: "#64748b",
                                margin: 0,
                            }}
                        >
                            Operaciones y productos anulados
                        </p>
                    </div>
                </div>

                {/* Filtros */}
                <div
                    style={{
                        background: "white",
                        borderRadius: "12px",
                        padding: cardPadding,
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        marginBottom: containerGap,
                    }}
                >
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: isSmall
                                ? "1fr"
                                : isMedium
                                  ? "1fr 1fr"
                                  : isSmallDesktop
                                    ? "1fr 1fr 1fr"
                                    : "1fr 1fr 1fr auto",
                            gap: "1rem",
                            alignItems: "end",
                        }}
                    >
                        <div>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: inputFontSize,
                                    fontWeight: 500,
                                    color: "#374151",
                                    marginBottom: "0.5rem",
                                }}
                            >
                                Fecha Inicio
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "0.625rem",
                                    fontSize: inputFontSize,
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    outline: "none",
                                    transition: "border-color 0.2s",
                                }}
                            />
                        </div>

                        <div>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: inputFontSize,
                                    fontWeight: 500,
                                    color: "#374151",
                                    marginBottom: "0.5rem",
                                }}
                            >
                                Fecha Fin
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "0.625rem",
                                    fontSize: inputFontSize,
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    outline: "none",
                                    transition: "border-color 0.2s",
                                }}
                            />
                        </div>

                        <div>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: inputFontSize,
                                    fontWeight: 500,
                                    color: "#374151",
                                    marginBottom: "0.5rem",
                                }}
                            >
                                Tipo
                            </label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "0.625rem",
                                    fontSize: inputFontSize,
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    outline: "none",
                                    transition: "border-color 0.2s",
                                    backgroundColor: "white",
                                }}
                            >
                                <option value="BOTH">Ambos</option>
                                <option value="OPERATIONS">Operaciones</option>
                                <option value="ITEMS">Productos</option>
                            </select>
                        </div>

                        <button
                            onClick={handleSearch}
                            style={{
                                padding: "0.625rem 1.5rem",
                                fontSize: buttonFontSize,
                                fontWeight: 600,
                                color: "white",
                                background:
                                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                border: "none",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                height: "42px",
                            }}
                        >
                            Buscar
                        </button>
                    </div>
                </div>

                {/* Lista de resultados */}
                <ReportCancelList
                    items={cancellationItems}
                    loading={loading}
                    error={error}
                    isSmall={isSmall}
                    isXs={isXs}
                />
            </div>
        </div>
    );
};

export default ReportCancel;
