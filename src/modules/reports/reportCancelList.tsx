import React from "react";
import { ApolloError } from "@apollo/client";
import type { CancellationItem } from "./reportCancel";

interface ReportCancelListProps {
    items: CancellationItem[];
    loading: boolean;
    error?: ApolloError;
    isSmall?: boolean;
    isXs?: boolean;
}

const ReportCancelList: React.FC<ReportCancelListProps> = ({
    items,
    loading,
    error,
    isSmall = false,
    isXs = false,
}) => {
    const tableFontSize = isXs ? "0.8rem" : isSmall ? "0.85rem" : "0.875rem";
    const headerFontSize = isXs ? "0.75rem" : isSmall ? "0.8rem" : "0.8125rem";
    const cellPadding = isXs ? "0.6rem" : isSmall ? "0.75rem" : "1rem";

    if (loading) {
        return (
            <div
                style={{
                    padding: "2rem",
                    textAlign: "center",
                    color: "#64748b",
                    fontSize: tableFontSize,
                    background: "white",
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
            >
                Cargando datos...
            </div>
        );
    }

    if (error) {
        return (
            <div
                style={{
                    padding: "2rem",
                    textAlign: "center",
                    color: "#ef4444",
                    background: "white",
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
            >
                Error al cargar reporte: {error.message}
            </div>
        );
    }

    if (!items.length) {
        return (
            <div
                style={{
                    padding: "3rem",
                    textAlign: "center",
                    color: "#94a3b8",
                    background: "white",
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
            >
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>
                    📋
                </div>
                <div
                    style={{
                        fontWeight: 600,
                        color: "#475569",
                        marginBottom: "0.5rem",
                    }}
                >
                    Sin registros
                </div>
                No se encontraron anulaciones en el periodo seleccionado.
            </div>
        );
    }

    return (
        <div
            style={{
                background: "white",
                borderRadius: "12px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                overflow: "hidden",
            }}
        >
            {!isXs ? (
                <div
                    style={{
                        overflow: "auto",
                        maxHeight: "60vh",
                        minHeight: "200px",
                    }}
                >
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            minWidth: isSmall ? "640px" : "800px",
                            fontSize: tableFontSize,
                        }}
                    >
                        <thead>
                            <tr
                                style={{
                                    background: "#f8fafc",
                                    borderBottom: "1px solid #e2e8f0",
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 1,
                                    boxShadow: "0 1px 0 0 #e2e8f0",
                                }}
                            >
                                <th
                                    style={{
                                        padding: cellPadding,
                                        textAlign: "left",
                                        fontSize: headerFontSize,
                                        fontWeight: 700,
                                        color: "#475569",
                                        background: "#f8fafc",
                                    }}
                                >
                                    Fecha
                                </th>
                                <th
                                    style={{
                                        padding: cellPadding,
                                        textAlign: "center",
                                        fontSize: headerFontSize,
                                        fontWeight: 700,
                                        color: "#475569",
                                        background: "#f8fafc",
                                    }}
                                >
                                    Tipo
                                </th>
                                <th
                                    style={{
                                        padding: cellPadding,
                                        textAlign: "left",
                                        fontSize: headerFontSize,
                                        fontWeight: 700,
                                        color: "#475569",
                                        background: "#f8fafc",
                                    }}
                                >
                                    Usuario
                                </th>
                                <th
                                    style={{
                                        padding: cellPadding,
                                        textAlign: "left",
                                        fontSize: headerFontSize,
                                        fontWeight: 700,
                                        color: "#475569",
                                        background: "#f8fafc",
                                    }}
                                >
                                    Detalle
                                </th>
                                <th
                                    style={{
                                        padding: cellPadding,
                                        textAlign: "left",
                                        fontSize: headerFontSize,
                                        fontWeight: 700,
                                        color: "#475569",
                                        background: "#f8fafc",
                                    }}
                                >
                                    Razón
                                </th>
                                <th
                                    style={{
                                        padding: cellPadding,
                                        textAlign: "center",
                                        fontSize: headerFontSize,
                                        fontWeight: 700,
                                        color: "#475569",
                                        background: "#f8fafc",
                                    }}
                                >
                                    Cant.
                                </th>
                                <th
                                    style={{
                                        padding: cellPadding,
                                        textAlign: "right",
                                        fontSize: headerFontSize,
                                        fontWeight: 700,
                                        color: "#475569",
                                        background: "#f8fafc",
                                    }}
                                >
                                    Monto
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr
                                    key={`${item.id}-${index}`}
                                    style={{
                                        borderBottom:
                                            index < items.length - 1
                                                ? "1px solid #f1f5f9"
                                                : "none",
                                        transition: "background 0.15s",
                                    }}
                                    onMouseEnter={(e) =>
                                        (e.currentTarget.style.background =
                                            "#f8fafc")
                                    }
                                    onMouseLeave={(e) =>
                                        (e.currentTarget.style.background =
                                            "transparent")
                                    }
                                >
                                    <td
                                        style={{
                                            padding: cellPadding,
                                            color: "#334155",
                                        }}
                                    >
                                        {new Date(
                                            item.cancelledAt,
                                        ).toLocaleString()}
                                    </td>
                                    <td
                                        style={{
                                            padding: cellPadding,
                                            textAlign: "center",
                                        }}
                                    >
                                        <span
                                            style={{
                                                padding: "0.2rem 0.6rem",
                                                borderRadius: "6px",
                                                fontSize: "0.65rem",
                                                fontWeight: 700,
                                                background:
                                                    item.type === "OPERATION"
                                                        ? "#fee2e2"
                                                        : "#e0e7ff",
                                                color:
                                                    item.type === "OPERATION"
                                                        ? "#991b1b"
                                                        : "#3730a3",
                                                textTransform: "uppercase",
                                            }}
                                        >
                                            {item.type === "OPERATION"
                                                ? "Orden"
                                                : "Item"}
                                        </span>
                                    </td>
                                    <td
                                        style={{
                                            padding: cellPadding,
                                            color: "#334155",
                                            fontWeight: 500,
                                        }}
                                    >
                                        {item.user?.fullName || "N/A"}
                                    </td>
                                    <td
                                        style={{
                                            padding: cellPadding,
                                            color: "#334155",
                                        }}
                                    >
                                        {item.type === "OPERATION" ? (
                                            <span style={{ fontWeight: 600 }}>
                                                Orden #{item.operationOrder}
                                            </span>
                                        ) : (
                                            <div>
                                                <div
                                                    style={{ fontWeight: 600 }}
                                                >
                                                    {item.productName}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: "0.75rem",
                                                        color: "#64748b",
                                                    }}
                                                >
                                                    Orden #{item.operationOrder}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td
                                        style={{
                                            padding: cellPadding,
                                            color: "#64748b",
                                            fontSize: "0.75rem",
                                        }}
                                    >
                                        {item.reason}
                                    </td>
                                    <td
                                        style={{
                                            padding: cellPadding,
                                            textAlign: "center",
                                            color: "#334155",
                                        }}
                                    >
                                        {item.quantity ? item.quantity : "-"}
                                    </td>
                                    <td
                                        style={{
                                            padding: cellPadding,
                                            textAlign: "right",
                                            fontWeight: 700,
                                            color: "#ef4444",
                                        }}
                                    >
                                        S/ {Number(item.amount || 0).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                    {items.map((item, index) => (
                        <div
                            key={`${item.id}-${index}`}
                            style={{
                                padding: "1rem",
                                borderBottom:
                                    index < items.length - 1
                                        ? "1px solid #f1f5f9"
                                        : "none",
                                background: "white",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "0.6rem",
                                }}
                            >
                                <span
                                    style={{
                                        padding: "0.2rem 0.5rem",
                                        borderRadius: "4px",
                                        fontSize: "0.65rem",
                                        fontWeight: 700,
                                        background:
                                            item.type === "OPERATION"
                                                ? "#fee2e2"
                                                : "#e0e7ff",
                                        color:
                                            item.type === "OPERATION"
                                                ? "#991b1b"
                                                : "#3730a3",
                                    }}
                                >
                                    {item.type === "OPERATION"
                                        ? "ANULACIÓN ORDEN"
                                        : "ANULACIÓN PRODUCTO"}
                                </span>
                                <span
                                    style={{
                                        fontSize: "0.7rem",
                                        color: "#64748b",
                                    }}
                                >
                                    {new Date(
                                        item.cancelledAt,
                                    ).toLocaleDateString()}
                                </span>
                            </div>

                            <div style={{ marginBottom: "0.6rem" }}>
                                <div
                                    style={{
                                        fontSize: "0.95rem",
                                        fontWeight: 700,
                                        color: "#1e293b",
                                    }}
                                >
                                    {item.type === "OPERATION"
                                        ? `Orden #${item.operationOrder}`
                                        : item.productName}
                                </div>
                                {item.type === "ITEM" && (
                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "#64748b",
                                        }}
                                    >
                                        Orden #{item.operationOrder}
                                    </div>
                                )}
                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-end",
                                }}
                            >
                                <div style={{ flex: 1, paddingRight: "1rem" }}>
                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "#475569",
                                            marginBottom: "0.2rem",
                                        }}
                                    >
                                        <strong>Por:</strong>{" "}
                                        {item.user?.fullName}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "#64748b",
                                            fontStyle: "italic",
                                        }}
                                    >
                                        "{item.reason}"
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div
                                        style={{
                                            fontSize: "0.7rem",
                                            color: "#94a3b8",
                                        }}
                                    >
                                        {item.quantity
                                            ? `${item.quantity} und`
                                            : ""}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "1.1rem",
                                            fontWeight: 800,
                                            color: "#ef4444",
                                        }}
                                    >
                                        S/ {Number(item.amount || 0).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div
                style={{
                    padding: "1rem",
                    background: "#f8fafc",
                    borderTop: "1px solid #e5e7eb",
                    textAlign: "center",
                    fontSize: "0.8rem",
                    color: "#64748b",
                    fontWeight: 500,
                }}
            >
                Mostrando {items.length} registro(s) de anulación
            </div>
        </div>
    );
};

export default ReportCancelList;
