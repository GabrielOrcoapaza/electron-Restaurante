import React, { useState, useEffect } from "react";
import { useQuery } from "@apollo/client";
import {
    GET_PRODUCTS_WITH_STOCK,
    GET_CATEGORIES_BY_BRANCH,
    GET_PRODUCTS,
} from "../../graphql/queries";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../hooks/useResponsive";

interface Product {
    id: string;
    code: string;
    name: string;
    description?: string;
    salePrice: number;
    purchasePrice?: number;
    unitMeasure: string;
    currentStock?: number | null;
    stockMin?: number | null;
    stockMax?: number | null;
    imageBase64?: string;
    isActive: boolean;
    productType: string;
    subcategoryId?: string;
}

interface Subcategory {
    id: string;
    name: string;
    description?: string;
    order: number;
    isActive: boolean;
}

interface Category {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    order: number;
    isActive: boolean;
    subcategories?: Subcategory[];
}

// Helper para formatear números de forma segura
const formatNumber = (
    value: number | null | undefined,
    decimals: number = 2,
): string => {
    if (value === null || value === undefined || isNaN(value)) {
        return "0.00";
    }
    return Number(value).toFixed(decimals);
};

// Helper para obtener un número seguro (default 0 si es null/undefined)
const getSafeNumber = (
    value: number | null | undefined,
    defaultValue: number = 0,
): number => {
    if (value === null || value === undefined || isNaN(value)) {
        return defaultValue;
    }
    return Number(value);
};

const PAGE_SIZE = 10;

const Inventories: React.FC = () => {
    const { companyData } = useAuth();
    const { breakpoint, isMobile, isXs } = useResponsive();
    const branchId = companyData?.branch?.id;
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Resetear a página 1 cuando cambie la categoría o la búsqueda
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, searchTerm]);

    // Adaptar según tamaño de pantalla
    const isSmall = breakpoint === "sm" || isMobile; 
    const isMedium = breakpoint === "md";
    const isSmallDesktop = breakpoint === "lg";

    // Tamaños adaptativos
    const containerPadding = isXs ? "0.75rem" : isSmall ? "1rem" : "1.5rem";
    const containerGap = isXs ? "0.75rem" : isSmall ? "1rem" : "1.5rem";
    const titleFontSize = isXs ? "1.1rem" : isSmall ? "1.25rem" : "1.5rem";
    const subtitleFontSize = isXs ? "0.7rem" : isSmall ? "0.75rem" : "0.875rem";
    const labelFontSize = isXs ? "0.7rem" : isSmall ? "0.75rem" : "0.875rem";
    const inputFontSize = isXs ? "0.85rem" : isSmall ? "0.9rem" : "1rem";
    const inputPadding = isXs ? "0.6rem" : isSmall ? "0.7rem" : "0.8rem";
    const tableFontSize = isXs ? "0.8rem" : isSmall ? "0.85rem" : "0.875rem";
    const tableCellPadding = isXs ? "0.4rem" : isSmall ? "0.6rem" : "0.75rem";
    const cardPadding = isXs ? "0.85rem" : isSmall ? "1rem" : "1.5rem";
    const gapSize = isXs ? "0.6rem" : isSmall ? "0.75rem" : "1rem";
    const badgeFontSize = isXs ? "0.65rem" : isSmall ? "0.7rem" : "0.75rem";

    const {
        data: productsData,
        loading: productsLoading,
        error: productsError,
    } = useQuery(GET_PRODUCTS_WITH_STOCK, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    // Productos de la categoría seleccionada (usa el backend para saber qué productos pertenecen a la categoría)
    const { data: productsByCategoryData, loading: productsByCategoryLoading } =
        useQuery(GET_PRODUCTS, {
            variables: {
                branchId: branchId!,
                productType: undefined,
                categoryId: selectedCategory || undefined,
            },
            skip: !branchId || !selectedCategory,
            fetchPolicy: "network-only",
        });

    const allProducts: Product[] = productsData?.productsByBranch || [];
    const categories: Category[] = categoriesData?.categoriesByBranch || [];
    const productIdsInCategory: string[] = (
        productsByCategoryData?.products || []
    ).map((p: { id: string }) => p.id);

    const getProductCategoryNames = (subcategoryId?: string) => {
        if (!subcategoryId) return { catName: "—", subName: "—" };
        for (const cat of categories) {
            const sub = cat.subcategories?.find((s) => s.id === subcategoryId);
            if (sub) return { catName: cat.name, subName: sub.name };
        }
        return { catName: "—", subName: "—" };
    };

    const trimmedSearch = searchTerm.trim();
    const hasSearch = Boolean(trimmedSearch);

    const matchesSearch = (product: Product, searchLower: string) => {
        const { catName, subName } = getProductCategoryNames(
            product.subcategoryId,
        );
        return (
            product.name?.toLowerCase().includes(searchLower) ||
            product.code?.toLowerCase().includes(searchLower) ||
            (product.description &&
                product.description.toLowerCase().includes(searchLower)) ||
            (catName !== "—" && catName.toLowerCase().includes(searchLower)) ||
            (subName !== "—" && subName.toLowerCase().includes(searchLower))
        );
    };

    // Sin categoría + con búsqueda: todos los productos con stock que coincidan (no hace falta elegir categoría)
    // Con categoría: intersección con productos de esa categoría; la búsqueda acota si hay texto
    let filteredProducts: Product[] = [];

    if (hasSearch && !selectedCategory) {
        const searchLower = trimmedSearch.toLowerCase();
        filteredProducts = allProducts.filter((product) =>
            matchesSearch(product, searchLower),
        );
    } else if (selectedCategory) {
        filteredProducts = allProducts.filter((product) =>
            productIdsInCategory.includes(product.id),
        );
        if (hasSearch) {
            const searchLower = trimmedSearch.toLowerCase();
            filteredProducts = filteredProducts.filter((product) =>
                matchesSearch(product, searchLower),
            );
        }
    }

    const showSelectCategoryHint = !selectedCategory && !hasSearch;
    const showCategoryLoadingState = Boolean(
        selectedCategory && productsByCategoryLoading,
    );

    // Paginación
    const totalPages = Math.max(
        1,
        Math.ceil(filteredProducts.length / PAGE_SIZE),
    );
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;
    const paginatedProducts = filteredProducts.slice(
        startIndex,
        startIndex + PAGE_SIZE,
    );

    // Determinar el estado del stock
    const getStockStatus = (product: Product) => {
        const currentStock = getSafeNumber(product.currentStock, 0);
        const stockMin = getSafeNumber(product.stockMin, 0);
        const stockMax = getSafeNumber(product.stockMax, 0);

        if (currentStock <= stockMin) {
            return {
                status: "low",
                color: "#dc2626",
                bgColor: "#fee2e2",
                label: "Stock Bajo",
            };
        } else if (stockMax > 0 && currentStock >= stockMax) {
            return {
                status: "high",
                color: "#059669",
                bgColor: "#d1fae5",
                label: "Stock Alto",
            };
        } else {
            return {
                status: "normal",
                color: "#2563eb",
                bgColor: "#dbeafe",
                label: "Stock Normal",
            };
        }
    };

    if (!branchId) {
        return (
            <div
                style={{
                    padding: "2rem",
                    textAlign: "center",
                    color: "#dc2626",
                }}
            >
                No se encontró información de la sucursal. Por favor, inicia
                sesión nuevamente.
            </div>
        );
    }

    if (productsLoading) {
        return (
            <div
                style={{
                    padding: "2rem",
                    textAlign: "center",
                    color: "#64748b",
                }}
            >
                Cargando inventario...
            </div>
        );
    }

    if (productsError) {
        return (
            <div
                style={{
                    padding: "2rem",
                    textAlign: "center",
                    color: "#dc2626",
                }}
            >
                Error al cargar inventario: {productsError.message}
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: "100%",
                width: "100%",
                maxWidth: "100%",
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
                boxSizing: "border-box",
            }}
        >
            {/* Elementos decorativos de fondo */}
            <div
                style={{
                    position: "absolute",
                    top: "-120px",
                    right: "-120px",
                    width: "260px",
                    height: "260px",
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
                    width: "220px",
                    height: "220px",
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
                        marginBottom: isSmall
                            ? "1rem"
                            : isMedium
                              ? "1.5rem"
                              : isSmallDesktop
                                ? "1.5rem"
                                : "2rem",
                        flexWrap: isSmall || isMedium ? "wrap" : "nowrap",
                        gap: isSmall || isMedium ? "1rem" : "0",
                    }}
                >
                    <div>
                        <h2
                            style={{
                                margin: 0,
                                fontSize: titleFontSize,
                                fontWeight: 700,
                                color: "#1e293b",
                            }}
                        >
                            📦 Gestión de Inventario
                        </h2>
                        <p
                            style={{
                                margin: "0.25rem 0 0",
                                color: "#64748b",
                                fontSize: subtitleFontSize,
                            }}
                        >
                            Controla el stock de tus productos
                        </p>
                    </div>
                </div>

                {/* Filtros (mismo patrón que listProduct en Products) */}
                <div
                    style={{
                        display: "flex",
                        gap: gapSize,
                        marginBottom: isSmall
                            ? "1rem"
                            : isMedium
                              ? "1.25rem"
                              : isSmallDesktop
                                ? "1.25rem"
                                : "1.5rem",
                        flexWrap: "wrap",
                    }}
                >
                    <div
                        style={{
                            backgroundColor: "white",
                            borderRadius: "12px",
                            padding: cardPadding,
                            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
                            border: "1px solid #e2e8f0",
                            flex: "1",
                            minWidth: isSmall
                                ? "100%"
                                : isMedium
                                  ? "250px"
                                  : isSmallDesktop
                                    ? "300px"
                                    : "350px",
                        }}
                    >
                        <label
                            style={{
                                display: "block",
                                marginBottom: "0.5rem",
                                fontWeight: 500,
                                fontSize: labelFontSize,
                                color: "#475569",
                            }}
                        >
                            Buscar producto:
                        </label>
                        <div style={{ position: "relative" }}>
                            <span
                                style={{
                                    position: "absolute",
                                    left: 10,
                                    top: 10,
                                    opacity: 0.6,
                                }}
                            >
                                {"\u{1F50D}"}
                            </span>
                            <input
                                type="text"
                                placeholder="Buscar producto o escanear código"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "0.65rem 0.85rem 0.65rem 2.2rem",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "8px",
                                    fontSize: inputFontSize,
                                    boxSizing: "border-box",
                                    backgroundColor: "white",
                                }}
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm("")}
                                    style={{
                                        position: "absolute",
                                        right: 10,
                                        top: 10,
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        opacity: 0.5,
                                        fontSize: "1rem",
                                    }}
                                >
                                    {"\u2715"}
                                </button>
                            )}
                        </div>
                    </div>

                    <div
                        style={{
                            backgroundColor: "white",
                            borderRadius: "12px",
                            padding: cardPadding,
                            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
                            border: "1px solid #e2e8f0",
                            flex: "1",
                            minWidth: isSmall
                                ? "100%"
                                : isMedium
                                  ? "200px"
                                  : isSmallDesktop
                                    ? "200px"
                                    : "250px",
                        }}
                    >
                        <label
                            style={{
                                display: "block",
                                marginBottom: "0.5rem",
                                fontWeight: 500,
                                fontSize: labelFontSize,
                                color: "#475569",
                            }}
                        >
                            Filtrar por categoría:
                        </label>
                        <select
                            value={selectedCategory}
                            onChange={(e) =>
                                setSelectedCategory(e.target.value)
                            }
                            style={{
                                width: "100%",
                                padding: inputPadding,
                                border: "1px solid #e2e8f0",
                                borderRadius: "8px",
                                fontSize: inputFontSize,
                                boxSizing: "border-box",
                                backgroundColor: "white",
                            }}
                        >
                            <option value="">Todas las categorías</option>
                            {categories
                                .filter((cat) => cat.isActive)
                                .map((category) => (
                                    <option
                                        key={category.id}
                                        value={category.id}
                                    >
                                        {category.name}
                                    </option>
                                ))}
                        </select>
                    </div>
                </div>

                {/* Lista de productos con inventario */}
                <div
                    style={{
                        backgroundColor: "white",
                        borderRadius: "16px",
                        padding: cardPadding,
                        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
                        border: "1px solid #e2e8f0",
                    }}
                >
                    <h3
                        style={{
                            margin: "0 0 1rem",
                            fontSize: isSmall
                                ? "1rem"
                                : isMedium
                                  ? "1.05rem"
                                  : isSmallDesktop
                                    ? "1.05rem"
                                    : "1.1rem",
                            fontWeight: 600,
                            color: "#334155",
                        }}
                    >
                        📋 Inventario de Productos ({filteredProducts.length})
                        {filteredProducts.length > 0 && (
                            <span
                                style={{
                                    fontWeight: 400,
                                    color: "#64748b",
                                    fontSize: subtitleFontSize,
                                }}
                            >
                                {" "}
                                · Página {safePage} de {totalPages}
                            </span>
                        )}
                    </h3>

                    {showSelectCategoryHint ? (
                        <div
                            style={{
                                textAlign: "center",
                                padding: isSmall ? "2rem" : "3rem",
                                color: "#64748b",
                            }}
                        >
                            <p
                                style={{
                                    fontSize: isSmall ? "0.875rem" : "1rem",
                                    margin: 0,
                                }}
                            >
                                Busca un producto o selecciona una categoría
                                para ver el inventario
                            </p>
                        </div>
                    ) : showCategoryLoadingState ? (
                        <div
                            style={{
                                textAlign: "center",
                                padding: isSmall ? "2rem" : "3rem",
                                color: "#64748b",
                            }}
                        >
                            <p
                                style={{
                                    fontSize: isSmall ? "0.875rem" : "1rem",
                                    margin: 0,
                                }}
                            >
                                Cargando productos de la categoría...
                            </p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div
                            style={{
                                textAlign: "center",
                                padding: isSmall ? "2rem" : "3rem",
                                color: "#64748b",
                            }}
                        >
                            <p
                                style={{
                                    fontSize: isSmall ? "0.875rem" : "1rem",
                                    margin: 0,
                                }}
                            >
                                {hasSearch
                                    ? "No se encontraron productos con ese criterio"
                                    : "No hay productos en esta categoría"}
                            </p>
                        </div>
                    ) : (
                        <div style={{ width: "100%" }}>
                            {!isSmall ? (
                                <div
                                    style={{
                                        overflowX: "auto",
                                        width: "100%",
                                        maxWidth: "100%",
                                        boxSizing: "border-box",
                                        borderRadius: "8px",
                                        border: "1px solid #f1f5f9",
                                    }}
                                >
                                    <table
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            fontSize: tableFontSize,
                                        }}
                                    >
                                        <thead>
                                            <tr style={{ borderBottom: "2px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                                                <th style={{ padding: tableCellPadding, textAlign: "center", color: "#64748b", fontWeight: 600 }}>Imagen</th>
                                                <th style={{ padding: tableCellPadding, textAlign: "center", color: "#64748b", fontWeight: 600 }}>Código</th>
                                                <th style={{ padding: tableCellPadding, textAlign: "center", color: "#64748b", fontWeight: 600 }}>Nombre</th>
                                                <th style={{ padding: tableCellPadding, textAlign: "center", color: "#64748b", fontWeight: 600 }}>Stock Actual</th>
                                                <th style={{ padding: tableCellPadding, textAlign: "center", color: "#64748b", fontWeight: 600 }}>Stock Mín.</th>
                                                <th style={{ padding: tableCellPadding, textAlign: "center", color: "#64748b", fontWeight: 600 }}>Stock Máx.</th>
                                                <th style={{ padding: tableCellPadding, textAlign: "center", color: "#64748b", fontWeight: 600 }}>Unidad</th>
                                                <th style={{ padding: tableCellPadding, textAlign: "center", color: "#64748b", fontWeight: 600 }}>Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedProducts.map((product) => {
                                                const stockStatus = getStockStatus(product);
                                                return (
                                                    <tr key={product.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                        <td style={{ padding: tableCellPadding, textAlign: "center" }}>
                                                            {product.imageBase64 ? (
                                                                <img
                                                                    src={`data:image/jpeg;base64,${product.imageBase64}`}
                                                                    alt={product.name}
                                                                    style={{ width: "45px", height: "45px", objectFit: "cover", borderRadius: "8px", margin: "0 auto", display: "block" }}
                                                                />
                                                            ) : (
                                                                <div style={{ width: "45px", height: "45px", backgroundColor: "#f1f5f9", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "1.25rem", margin: "0 auto" }}>🖼️</div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: tableCellPadding, textAlign: "center", color: "#334155", fontFamily: "monospace" }}>{product.code}</td>
                                                        <td style={{ padding: tableCellPadding, textAlign: "center", color: "#334155", fontWeight: 500 }}>{product.name}</td>
                                                        <td style={{ padding: tableCellPadding, textAlign: "center", color: "#334155", fontWeight: 600 }}>{formatNumber(product.currentStock)}</td>
                                                        <td style={{ padding: tableCellPadding, textAlign: "center", color: "#64748b" }}>{formatNumber(product.stockMin)}</td>
                                                        <td style={{ padding: tableCellPadding, textAlign: "center", color: "#64748b" }}>{formatNumber(product.stockMax)}</td>
                                                        <td style={{ padding: tableCellPadding, textAlign: "center", color: "#64748b" }}>{product.unitMeasure}</td>
                                                        <td style={{ padding: tableCellPadding, textAlign: "center" }}>
                                                            <span style={{ padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: badgeFontSize, fontWeight: 600, backgroundColor: stockStatus.bgColor, color: stockStatus.color }}>{stockStatus.label}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                    {paginatedProducts.map((product) => {
                                        const stockStatus = getStockStatus(product);
                                        return (
                                            <div key={product.id} style={{ 
                                                padding: "1rem", 
                                                borderRadius: "12px", 
                                                border: "1px solid #e2e8f0", 
                                                backgroundColor: "white",
                                                boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                                            }}>
                                                <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem" }}>
                                                    {product.imageBase64 ? (
                                                        <img
                                                            src={`data:image/jpeg;base64,${product.imageBase64}`}
                                                            alt={product.name}
                                                            style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "8px" }}
                                                        />
                                                    ) : (
                                                        <div style={{ width: "60px", height: "60px", backgroundColor: "#f1f5f9", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "1.5rem" }}>🖼️</div>
                                                    )}
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "1rem" }}>{product.name}</div>
                                                        <div style={{ fontSize: "0.8rem", color: "#64748b", fontFamily: "monospace" }}>{product.code}</div>
                                                        <span style={{
                                                            marginTop: "0.4rem",
                                                            display: "inline-block",
                                                            padding: "0.2rem 0.6rem",
                                                            borderRadius: "9999px",
                                                            fontSize: "0.7rem",
                                                            fontWeight: 700,
                                                            backgroundColor: stockStatus.bgColor,
                                                            color: stockStatus.color
                                                        }}>
                                                            {stockStatus.label}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div style={{ 
                                                    display: "grid", 
                                                    gridTemplateColumns: "repeat(3, 1fr)", 
                                                    gap: "0.5rem", 
                                                    padding: "0.75rem", 
                                                    backgroundColor: "#f8fafc", 
                                                    borderRadius: "8px",
                                                    fontSize: "0.85rem",
                                                    textAlign: "center"
                                                }}>
                                                    <div>
                                                        <div style={{ color: "#64748b", fontSize: "0.7rem", fontWeight: 600, marginBottom: "0.2rem" }}>ACTUAL</div>
                                                        <div style={{ fontWeight: 800, color: stockStatus.color, fontSize: "1.1rem" }}>{formatNumber(product.currentStock, 1)}</div>
                                                        <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{product.unitMeasure}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ color: "#64748b", fontSize: "0.7rem", fontWeight: 600, marginBottom: "0.2rem" }}>MÍN.</div>
                                                        <div style={{ fontWeight: 600, color: "#475569" }}>{formatNumber(product.stockMin, 1)}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ color: "#64748b", fontSize: "0.7rem", fontWeight: 600, marginBottom: "0.2rem" }}>MÁX.</div>
                                                        <div style={{ fontWeight: 600, color: "#475569" }}>{formatNumber(product.stockMax, 1)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Paginación */}
                    {!showCategoryLoadingState &&
                        filteredProducts.length > 0 && (
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "0.75rem",
                                    marginTop: "1rem",
                                    paddingTop: "1rem",
                                    borderTop: "1px solid #e2e8f0",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: inputFontSize,
                                        color: "#64748b",
                                    }}
                                >
                                    {isXs ? "" : "Mostrando "} {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, filteredProducts.length)} de {filteredProducts.length}
                                </span>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        width: isXs ? "100%" : "auto",
                                        justifyContent: isXs ? "space-between" : "flex-end"
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCurrentPage((p) =>
                                                Math.max(1, p - 1),
                                            )
                                        }
                                        disabled={safePage <= 1}
                                        style={{
                                            padding: "0.5rem 0.75rem",
                                            fontSize: inputFontSize,
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "8px",
                                            background:
                                                safePage <= 1
                                                    ? "#f1f5f9"
                                                    : "white",
                                            color:
                                                safePage <= 1
                                                    ? "#94a3b8"
                                                    : "#334155",
                                            cursor:
                                                safePage <= 1
                                                    ? "not-allowed"
                                                    : "pointer",
                                            fontWeight: 500,
                                            flex: isXs ? 1 : "none"
                                        }}
                                    >
                                        Anterior
                                    </button>
                                    <span
                                        style={{
                                            fontSize: inputFontSize,
                                            color: "#475569",
                                            padding: "0 0.5rem",
                                            fontWeight: 600
                                        }}
                                    >
                                        {safePage} / {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCurrentPage((p) =>
                                                Math.min(totalPages, p + 1),
                                            )
                                        }
                                        disabled={safePage >= totalPages}
                                        style={{
                                            padding: "0.5rem 0.75rem",
                                            fontSize: inputFontSize,
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "8px",
                                            background:
                                                safePage >= totalPages
                                                    ? "#f1f5f9"
                                                    : "white",
                                            color:
                                                safePage >= totalPages
                                                    ? "#94a3b8"
                                                    : "#334155",
                                            cursor:
                                                safePage >= totalPages
                                                    ? "not-allowed"
                                                    : "pointer",
                                            fontWeight: 500,
                                            flex: isXs ? 1 : "none"
                                        }}
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
};

export default Inventories;
