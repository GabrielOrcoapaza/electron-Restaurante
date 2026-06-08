import React, { useState } from "react";
import { useQuery } from "@apollo/client";
import {
    GET_CATEGORIES_BY_BRANCH,
    GET_PRODUCTS,
} from "../../graphql/queries";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../hooks/useResponsive";
import RecipeModal from "./recipe";

interface ProductSubcategoryNested {
    id: string;
    name: string;
    category?: { id: string; name: string } | null;
}

interface Product {
    id: string;
    code: string;
    name: string;
    description?: string;
    salePrice: number;
    preparationTime?: number;
    productType?: string;
    purchasePrice?: number;
    unitMeasure?: string;
    currentStock?: number;
    stockMin?: number;
    stockMax?: number;
    isActive: boolean;
    managesStock?: boolean;
    managesStockLocked?: boolean;
    subcategoryId?: string | null;
    subcategory?: ProductSubcategoryNested | null;
    asPromotion?: { id: string; name: string; promotionType?: string } | null;
}

interface Subcategory {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
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

interface ListProductProps {
    onEdit: (product: Product) => void;
    refreshKey?: number;
}

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

const ListProduct: React.FC<ListProductProps> = ({
    onEdit,
    refreshKey = 0,
}) => {
    const { companyData } = useAuth();
    const { breakpoint } = useResponsive();
    const branchId = companyData?.branch?.id;

    // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
    const isXs = breakpoint === "xs"; // < 640px
    const isSmall = breakpoint === "sm"; // 640px - 767px
    const isMedium = breakpoint === "md"; // 768px - 1023px
    const isSmallDesktop = breakpoint === "lg"; // 1024px - 1279px

    // Tamaños adaptativos
    const cardPadding = isXs
        ? "0.75rem"
        : isSmall
          ? "1rem"
          : isMedium
            ? "1.25rem"
            : "1.5rem";
    const gapSize = isXs
        ? "0.5rem"
        : isSmall
          ? "0.75rem"
          : isMedium
            ? "0.875rem"
            : "1rem";
    const titleFontSize = isXs
        ? "0.875rem"
        : isSmall
          ? "0.9375rem"
          : isMedium
            ? "1rem"
            : "1.1rem";
    const labelFontSize = isXs
        ? "0.7rem"
        : isSmall
          ? "0.75rem"
          : isMedium
            ? "0.8125rem"
            : "0.875rem";
    const inputFontSize = isXs
        ? "0.75rem"
        : isSmall
          ? "0.75rem"
          : isMedium
            ? "0.8125rem"
            : "0.875rem";
    const inputPadding = isXs
        ? "0.45rem 0.625rem"
        : isSmall
          ? "0.5rem 0.625rem"
          : isMedium
            ? "0.5625rem 0.75rem"
            : "0.625rem 0.875rem";
    const tableFontSize = isXs
        ? "0.7rem"
        : isSmall
          ? "0.75rem"
          : isMedium
            ? "0.8125rem"
            : "0.875rem";
    const buttonPadding = isXs
        ? "0.4rem 0.625rem"
        : isSmall
          ? "0.4375rem 0.75rem"
          : isMedium
            ? "0.5rem 0.875rem"
            : "0.5rem 1rem";
    const buttonFontSize = isXs
        ? "0.65rem"
        : isSmall
          ? "0.6875rem"
          : isMedium
            ? "0.75rem"
            : "0.75rem";
    const badgeFontSize = isXs
        ? "0.6rem"
        : isSmall
          ? "0.625rem"
          : isMedium
            ? "0.6875rem"
            : "0.75rem";

    /** Cabecera sticky: sin fondo inline para que dark: funcione */
    const tableThClass =
        "sticky top-0 z-[2] bg-slate-100 text-slate-600 shadow-[0_1px_0_#e2e8f0] dark:bg-slate-950 dark:text-slate-200 dark:shadow-[0_1px_0_rgb(51,65,85)]";

    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [selectedProductType, setSelectedProductType] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [selectedProductForRecipe, setSelectedProductForRecipe] = useState<{
        id: string;
        name: string;
        productType?: string;
    } | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const itemsPerPage = 20;

    const {
        data: productsData,
        loading,
        error,
        refetch: refetchProducts,
    } = useQuery(GET_PRODUCTS, {
        variables: {
            branchId: branchId!,
            ...(selectedProductType && { productType: selectedProductType }),
            ...(selectedCategory && { categoryId: selectedCategory }),
        },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const categories: Category[] = categoriesData?.categoriesByBranch || [];

    const getProductCategoryName = (p: Product) =>
        p.subcategory?.category?.name ?? "—";
    const getProductSubcategoryName = (p: Product) =>
        p.subcategory?.name ?? "—";

    // Obtener productos (filtros opcionales en servidor vía `products`)
    let products: Product[] = productsData?.products || [];

    // Filtrado local por término de búsqueda (sin llamadas al servidor, sin "Cargando productos...")
    if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase().trim();
        products = products.filter((p: Product) => {
            const catName = getProductCategoryName(p);
            const subName = getProductSubcategoryName(p);
            return (
                p.name?.toLowerCase().includes(searchLower) ||
                p.code?.toLowerCase().includes(searchLower) ||
                (p.description &&
                    p.description.toLowerCase().includes(searchLower)) ||
                (catName !== "—" &&
                    catName.toLowerCase().includes(searchLower)) ||
                (subName !== "—" && subName.toLowerCase().includes(searchLower))
            );
        });
    }

    // Calcular paginación
    const totalPages = Math.ceil(products.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProducts = products.slice(startIndex, endIndex);

    // Resetear página cuando cambie la categoría, el tipo de producto o el término de búsqueda
    React.useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, selectedProductType, searchTerm]);

    // Refrescar cuando cambie el refreshKey
    React.useEffect(() => {
        refetchProducts();
    }, [refreshKey, refetchProducts]);

    if (!branchId) {
        return (
            <div
                className="rounded-lg border border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300"
                style={{
                    padding: "2rem",
                    textAlign: "center",
                }}
            >
                No se encontró información de la sucursal. Por favor, inicia
                sesión nuevamente.
            </div>
        );
    }

    if (loading) {
        return (
            <div
                className="rounded-lg border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                style={{
                    padding: "2rem",
                    textAlign: "center",
                }}
            >
                Cargando productos...
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="rounded-lg border border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300"
                style={{
                    padding: "2rem",
                    textAlign: "center",
                }}
            >
                Error al cargar productos: {error.message}
            </div>
        );
    }

    return (
        <div className="text-slate-700 dark:text-slate-200">
            {/* Filtros */}
            <div
                style={{
                    display: "flex",
                    gap: gapSize,
                    marginBottom: isSmall
                        ? "1rem"
                        : isMedium
                          ? "1.25rem"
                          : "1.5rem",
                    flexWrap: "wrap",
                }}
            >
                {/* Búsqueda */}
                <div
                    className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                    style={{
                        borderRadius: "12px",
                        padding: cardPadding,
                        flex: "1",
                        minWidth:
                            isXs || isSmall
                                ? "100%"
                                : isMedium
                                  ? "250px"
                                  : "350px",
                    }}
                >
                    <label
                        className="text-slate-600 dark:text-slate-300"
                        style={{
                            display: "block",
                            marginBottom: "0.5rem",
                            fontWeight: 500,
                            fontSize: labelFontSize,
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
                            🔎
                        </span>
                        <input
                            type="text"
                            placeholder="Buscar producto o escanear código"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            style={{
                                padding: "0.65rem 0.85rem 0.65rem 2.2rem",
                                fontSize: inputFontSize,
                                boxSizing: "border-box",
                            }}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                style={{
                                    position: "absolute",
                                    right: 10,
                                    top: 10,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: "1rem",
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Filtro de categorías */}
                {categories.length > 0 && (
                    <div
                        className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                        style={{
                            borderRadius: "12px",
                            padding: cardPadding,
                            flex: "1",
                            minWidth:
                                isXs || isSmall
                                    ? "100%"
                                    : isMedium
                                      ? "200px"
                                      : "250px",
                        }}
                    >
                        <label
                            className="text-slate-600 dark:text-slate-300"
                            style={{
                                display: "block",
                                marginBottom: "0.5rem",
                                fontWeight: 500,
                                fontSize: labelFontSize,
                            }}
                        >
                            Filtrar por categoría:
                        </label>
                        <select
                            value={selectedCategory}
                            onChange={(e) =>
                                setSelectedCategory(e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            style={{
                                padding: inputPadding,
                                fontSize: inputFontSize,
                                boxSizing: "border-box",
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
                )}

                {/* Filtro de tipo de producto */}
                <div
                    className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                    style={{
                        borderRadius: "12px",
                        padding: cardPadding,
                        flex: "1",
                        minWidth:
                            isXs || isSmall
                                ? "100%"
                                : isMedium
                                  ? "200px"
                                  : "250px",
                    }}
                >
                    <label
                        className="text-slate-600 dark:text-slate-300"
                        style={{
                            display: "block",
                            marginBottom: "0.5rem",
                            fontWeight: 500,
                            fontSize: labelFontSize,
                        }}
                    >
                        Filtrar por tipo:
                    </label>
                    <select
                        value={selectedProductType}
                        onChange={(e) => setSelectedProductType(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        style={{
                            padding: inputPadding,
                            fontSize: inputFontSize,
                            boxSizing: "border-box",
                        }}
                    >
                        <option value="">Todos los tipos</option>
                        <option value="DISH">Plato</option>
                        <option value="INGREDIENT">Ingrediente</option>
                        <option value="BEVERAGE">Bebida</option>
                        <option value="PROMOTION">Promoción / Combo</option>
                    </select>
                </div>
            </div>

            {/* Lista de productos */}
            <div
                className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                style={{
                    width: "100%",
                    maxWidth: "100%",
                    borderRadius: "16px",
                    padding: cardPadding,
                    boxSizing: "border-box",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1rem",
                    }}
                >
                    <h3
                        className="text-slate-700 dark:text-slate-200"
                        style={{
                            margin: 0,
                            fontSize: titleFontSize,
                            fontWeight: 600,
                        }}
                    >
                        📋 Lista de Productos ({products.length})
                    </h3>
                    {products.length > 0 && (
                        <p
                            className="text-slate-500 dark:text-slate-400"
                            style={{
                                margin: 0,
                                fontSize: inputFontSize,
                            }}
                        >
                            Página {currentPage} de {totalPages}
                        </p>
                    )}
                </div>

                {products.length === 0 ? (
                    <div
                        className="text-slate-500 dark:text-slate-400"
                        style={{
                            textAlign: "center",
                            padding: isXs
                                ? "1.5rem"
                                : isSmall
                                  ? "2rem"
                                  : "3rem",
                        }}
                    >
                        <p
                            style={{
                                fontSize: isXs
                                    ? "0.8rem"
                                    : isSmall
                                      ? "0.875rem"
                                      : "1rem",
                                margin: 0,
                            }}
                        >
                            No hay productos registrados
                        </p>
                        <p
                            style={{
                                fontSize: labelFontSize,
                                margin: "0.5rem 0 0",
                            }}
                        >
                            Haz clic en "Nuevo Producto" para agregar uno
                        </p>
                    </div>
                ) : isXs ? (
                    /* Vista de tarjetas para móviles */
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                        }}
                    >
                        {paginatedProducts.map((product) => (
                            <div
                                key={product.id}
                                className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                                style={{
                                    padding: "1rem",
                                }}
                            >
                                <div style={{ marginBottom: "0.75rem" }}>
                                    <div
                                        className="text-slate-800 dark:text-slate-100"
                                        style={{
                                            fontWeight: 700,
                                            fontSize: "0.9rem",
                                            marginBottom: "0.25rem",
                                        }}
                                    >
                                        {product.name}{" "}
                                        {product.productType === "PROMOTION" && (
                                            <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded font-semibold align-middle">
                                                COMBO
                                            </span>
                                        )}
                                        {product.productType === "PROMOTION" &&
                                            !product.asPromotion && (
                                                <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-semibold align-middle">
                                                    SIN VINCULAR
                                                </span>
                                            )}
                                    </div>
                                    <div
                                        className="text-slate-500 dark:text-slate-400"
                                        style={{
                                            fontSize: "0.75rem",
                                            marginBottom: "0.25rem",
                                        }}
                                    >
                                        {product.code} •{" "}
                                        {getProductCategoryName(product)}
                                    </div>
                                    <div
                                        className="text-indigo-600 dark:text-indigo-300"
                                        style={{
                                            fontWeight: 700,
                                            fontSize: "1rem",
                                        }}
                                    >
                                        {currencyFormatter.format(
                                            product.salePrice,
                                        )}
                                    </div>
                                </div>

                                <div
                                    className="border-t border-slate-200 dark:border-slate-700"
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        paddingTop: "0.75rem",
                                    }}
                                >
                                    <span
                                        style={{
                                            padding: "0.25rem 0.625rem",
                                            borderRadius: "9999px",
                                            fontSize: "0.7rem",
                                            fontWeight: 600,
                                            backgroundColor: product.isActive
                                                ? "#dcfce7"
                                                : "#fee2e2",
                                            color: product.isActive
                                                ? "#166534"
                                                : "#991b1b",
                                        }}
                                    >
                                        {product.isActive
                                            ? "Activo"
                                            : "Inactivo"}
                                    </span>

                                    <div
                                        style={{
                                            display: "flex",
                                            gap: "0.5rem",
                                        }}
                                    >
                                        <button
                                            onClick={() => onEdit(product)}
                                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                            style={{
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                            }}
                                        >
                                            ✏️ Editar
                                        </button>
                                        <button
                                            onClick={() =>
                                                setSelectedProductForRecipe({
                                                    id: product.id,
                                                    name: product.name,
                                                    productType:
                                                        product.productType,
                                                })
                                            }
                                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                            style={{
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                            }}
                                        >
                                            🍳 Receta
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Vista de tabla para desktop/tablet */
                    <div
                        className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700"
                        style={{
                            overflow: "auto",
                            width: "100%",
                            maxWidth: "100%",
                            maxHeight: "min(55vh, 620px)",
                            minHeight: "200px",
                            boxSizing: "border-box",
                            WebkitOverflowScrolling: "touch",
                            borderRadius: "8px",
                        }}
                    >
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: tableFontSize,
                                tableLayout: "fixed",
                                minWidth: 0,
                            }}
                        >
                            <colgroup>
                                <col style={{ width: "10%" }} />
                                <col style={{ width: "14%" }} />
                                <col style={{ width: "11%" }} />
                                <col style={{ width: "11%" }} />
                                <col style={{ width: "15%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "7%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "14%" }} />
                            </colgroup>
                            <thead>
                                <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                                    <th
                                        className={tableThClass}
                                        style={{
                                            padding: isSmall
                                                ? "0.5rem"
                                                : "0.625rem",
                                            textAlign: "center",
                                            fontWeight: 600,
                                            fontSize: tableFontSize,
                                        }}
                                    >
                                        Código
                                    </th>
                                    <th
                                        className={tableThClass}
                                        style={{
                                            padding: isSmall
                                                ? "0.5rem"
                                                : "0.625rem",
                                            textAlign: "center",
                                            fontWeight: 600,
                                            fontSize: tableFontSize,
                                        }}
                                    >
                                        Nombre
                                    </th>
                                    <th
                                        className={tableThClass}
                                        style={{
                                            padding: isSmall
                                                ? "0.5rem"
                                                : "0.625rem",
                                            textAlign: "center",
                                            fontWeight: 600,
                                            fontSize: tableFontSize,
                                        }}
                                    >
                                        Categoría
                                    </th>
                                    <th
                                        className={tableThClass}
                                        style={{
                                            padding: isSmall
                                                ? "0.5rem"
                                                : "0.625rem",
                                            textAlign: "center",
                                            fontWeight: 600,
                                            fontSize: tableFontSize,
                                        }}
                                    >
                                        Subcategoría
                                    </th>
                                    <th
                                        className={tableThClass}
                                        style={{
                                            padding: isSmall
                                                ? "0.5rem"
                                                : "0.625rem",
                                            textAlign: "center",
                                            fontWeight: 600,
                                            fontSize: tableFontSize,
                                        }}
                                    >
                                        Descripción
                                    </th>
                                    <th
                                        className={tableThClass}
                                        style={{
                                            padding: isSmall
                                                ? "0.5rem"
                                                : "0.625rem",
                                            textAlign: "center",
                                            fontWeight: 600,
                                            fontSize: tableFontSize,
                                        }}
                                    >
                                        Precio
                                    </th>
                                    <th
                                        className={tableThClass}
                                        style={{
                                            padding: isSmall
                                                ? "0.5rem"
                                                : "0.625rem",
                                            textAlign: "center",
                                            fontWeight: 600,
                                            fontSize: tableFontSize,
                                        }}
                                    >
                                        Tiempo
                                    </th>
                                    <th
                                        className={tableThClass}
                                        style={{
                                            padding: isSmall
                                                ? "0.5rem"
                                                : "0.625rem",
                                            textAlign: "center",
                                            fontWeight: 600,
                                            fontSize: tableFontSize,
                                        }}
                                    >
                                        Estado
                                    </th>
                                    <th
                                        className={tableThClass}
                                        style={{
                                            padding: isSmall
                                                ? "0.5rem"
                                                : "0.625rem",
                                            textAlign: "center",
                                            fontWeight: 600,
                                            fontSize: tableFontSize,
                                        }}
                                    >
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedProducts.map((product) => (
                                    <tr
                                        key={product.id}
                                        className="border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"
                                    >
                                        <td
                                            className="text-slate-800 dark:text-slate-100"
                                            style={{
                                                padding: isSmall
                                                    ? "0.375rem"
                                                    : "0.5rem",
                                                textAlign: "center",
                                                fontFamily: "monospace",
                                                fontSize: tableFontSize,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {product.code}
                                        </td>
                                        <td
                                            style={{
                                                padding: isSmall
                                                    ? "0.375rem"
                                                    : "0.5rem",
                                                verticalAlign: "top",
                                            }}
                                        >
                                            <div
                                                className="text-slate-800 dark:text-slate-100"
                                                style={{
                                                    fontSize: tableFontSize,
                                                    overflow: "hidden",
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 5,
                                                    WebkitBoxOrient:
                                                        "vertical" as "vertical",
                                                    wordBreak: "break-word",
                                                    whiteSpace: "normal",
                                                    lineHeight: 1.4,
                                                }}
                                            >
                                                {product.name}{" "}
                                                {product.productType === "PROMOTION" && (
                                                    <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded font-semibold align-middle">
                                                        COMBO
                                                    </span>
                                                )}
                                                {product.productType === "PROMOTION" &&
                                                    !product.asPromotion && (
                                                        <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-semibold align-middle">
                                                            SIN VINCULAR
                                                        </span>
                                                    )}
                                            </div>
                                        </td>
                                        <td
                                            style={{
                                                padding: isSmall
                                                    ? "0.375rem"
                                                    : "0.5rem",
                                                verticalAlign: "top",
                                            }}
                                        >
                                            <div
                                                className="text-slate-600 dark:text-slate-300"
                                                style={{
                                                    fontSize: tableFontSize,
                                                    overflow: "hidden",
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 3,
                                                    WebkitBoxOrient:
                                                        "vertical" as "vertical",
                                                    wordBreak: "break-word",
                                                    whiteSpace: "normal",
                                                    lineHeight: 1.35,
                                                    textAlign: "center",
                                                }}
                                            >
                                                {getProductCategoryName(
                                                    product,
                                                )}
                                            </div>
                                        </td>
                                        <td
                                            style={{
                                                padding: isSmall
                                                    ? "0.375rem"
                                                    : "0.5rem",
                                                verticalAlign: "top",
                                            }}
                                        >
                                            <div
                                                className="text-slate-600 dark:text-slate-300"
                                                style={{
                                                    fontSize: tableFontSize,
                                                    overflow: "hidden",
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 3,
                                                    WebkitBoxOrient:
                                                        "vertical" as "vertical",
                                                    wordBreak: "break-word",
                                                    whiteSpace: "normal",
                                                    lineHeight: 1.35,
                                                    textAlign: "center",
                                                }}
                                            >
                                                {getProductSubcategoryName(
                                                    product,
                                                )}
                                            </div>
                                        </td>
                                        <td
                                            style={{
                                                padding: isSmall
                                                    ? "0.375rem"
                                                    : "0.5rem",
                                                verticalAlign: "top",
                                            }}
                                        >
                                            <div
                                                className="text-slate-500 dark:text-slate-400"
                                                style={{
                                                    fontSize: tableFontSize,
                                                    overflow: "hidden",
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 5,
                                                    WebkitBoxOrient:
                                                        "vertical" as "vertical",
                                                    wordBreak: "break-word",
                                                    whiteSpace: "normal",
                                                    lineHeight: 1.4,
                                                }}
                                            >
                                                {product.description || "-"}
                                            </div>
                                        </td>
                                        <td
                                            className="text-slate-800 dark:text-slate-100"
                                            style={{
                                                padding: isSmall
                                                    ? "0.375rem"
                                                    : "0.5rem",
                                                textAlign: "center",
                                                fontWeight: 600,
                                                fontSize: tableFontSize,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {currencyFormatter.format(
                                                product.salePrice,
                                            )}
                                        </td>
                                        <td
                                            className="text-slate-500 dark:text-slate-400"
                                            style={{
                                                padding: isSmall
                                                    ? "0.375rem"
                                                    : "0.5rem",
                                                textAlign: "center",
                                                fontSize: tableFontSize,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {product.preparationTime || "-"}
                                        </td>
                                        <td
                                            style={{
                                                padding: isSmall
                                                    ? "0.375rem"
                                                    : "0.5rem",
                                                textAlign: "center",
                                            }}
                                        >
                                            <span
                                                className={
                                                    product.isActive
                                                        ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-700"
                                                        : "bg-red-100 text-red-800 ring-1 ring-red-200 dark:bg-red-900/40 dark:text-red-200 dark:ring-red-800"
                                                }
                                                style={{
                                                    padding: isSmall
                                                        ? "0.25rem 0.5rem"
                                                        : isMedium
                                                          ? "0.25rem 0.625rem"
                                                          : isSmallDesktop
                                                            ? "0.25rem 0.625rem"
                                                            : "0.25rem 0.75rem",
                                                    borderRadius: "9999px",
                                                    fontSize: badgeFontSize,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {product.isActive
                                                    ? "Activo"
                                                    : "Inactivo"}
                                            </span>
                                        </td>
                                        <td
                                            style={{
                                                padding: isSmall
                                                    ? "0.375rem"
                                                    : "0.5rem",
                                                textAlign: "center",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    gap: isSmall
                                                        ? "0.25rem"
                                                        : "0.375rem",
                                                    justifyContent: "center",
                                                    flexWrap: "nowrap",
                                                    alignItems: "center",
                                                }}
                                            >
                                                <button
                                                    onClick={() =>
                                                        onEdit(product)
                                                    }
                                                    title="Editar producto"
                                                    className="rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                                    style={{
                                                        padding: isSmall
                                                            ? "0.375rem 0.5rem"
                                                            : isMedium
                                                              ? "0.4375rem 0.625rem"
                                                              : "0.5rem 0.75rem",
                                                        
                                                        borderRadius: "6px",
                                                        fontWeight: 500,
                                                        cursor: "pointer",
                                                        fontSize: isSmall
                                                            ? "0.75rem"
                                                            : isMedium
                                                              ? "0.8125rem"
                                                              : "0.875rem",
                                                        transition: "all 0.2s",
                                                        whiteSpace: "nowrap",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    ✏️ Editar
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setSelectedProductForRecipe(
                                                            {
                                                                id: product.id,
                                                                name: product.name,
                                                                productType:
                                                                    product.productType,
                                                            },
                                                        )
                                                    }
                                                    title="Ver receta"
                                                    className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                                    style={{
                                                        padding: isSmall
                                                            ? "0.375rem 0.5rem"
                                                            : isMedium
                                                              ? "0.4375rem 0.625rem"
                                                              : "0.5rem 0.75rem",
                                                        
                                                        borderRadius: "6px",
                                                        fontWeight: 500,
                                                        cursor: "pointer",
                                                        fontSize: isSmall
                                                            ? "0.75rem"
                                                            : isMedium
                                                              ? "0.8125rem"
                                                              : "0.875rem",
                                                        transition: "all 0.2s",
                                                        whiteSpace: "nowrap",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    🍳 Receta
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Controles de paginación (visible con cualquier cantidad de productos) */}
                {products.length > 0 && (
                    <div
                        className="border-t border-slate-200 dark:border-slate-700"
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: isXs
                                ? "0.35rem"
                                : isSmall
                                  ? "0.5rem"
                                  : "0.75rem",
                            marginTop: isXs ? "0.75rem" : "1.5rem",
                            paddingTop: isXs ? "0.75rem" : "1.5rem",
                            flexWrap: "wrap",
                        }}
                    >
                        <button
                            onClick={() =>
                                setCurrentPage((prev) => Math.max(1, prev - 1))
                            }
                            disabled={currentPage === 1}
                            className="rounded-lg border border-indigo-300 bg-indigo-600 text-white disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-indigo-700 dark:bg-indigo-500 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                            style={{
                                padding: buttonPadding,
                                borderRadius: "8px",
                                fontWeight: 600,
                                cursor:
                                    currentPage === 1
                                        ? "not-allowed"
                                        : "pointer",
                                fontSize: buttonFontSize,
                                transition: "all 0.2s",
                                minHeight: isXs ? "36px" : "auto",
                            }}
                        >
                            {isXs ? "←" : "← Anterior"}
                        </button>

                        {/* Números de página */}
                        <div
                            style={{
                                display: "flex",
                                gap: isXs ? "0.15rem" : "0.25rem",
                                alignItems: "center",
                                flexWrap: "wrap",
                                justifyContent: "center",
                            }}
                        >
                            {Array.from(
                                { length: totalPages },
                                (_, i) => i + 1,
                            ).map((page) => {
                                // Mostrar solo algunas páginas alrededor de la actual
                                const showPage =
                                    page === 1 ||
                                    page === totalPages ||
                                    (page >= currentPage - (isXs ? 1 : 2) &&
                                        page <= currentPage + (isXs ? 1 : 2));

                                if (!showPage) {
                                    if (
                                        page === currentPage - (isXs ? 2 : 3) ||
                                        page === currentPage + (isXs ? 2 : 3)
                                    ) {
                                        return (
                                            <span
                                                key={page}
                                                style={{
                                                    padding: "0 0.25rem",
                                                    color: "#94a3b8",
                                                    fontSize: buttonFontSize,
                                                }}
                                            >
                                                ...
                                            </span>
                                        );
                                    }
                                    return null;
                                }

                                return (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`${page === currentPage ? "border-indigo-500 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500" : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"} rounded-lg border`}
                                        style={{
                                            minWidth: isXs
                                                ? "1.85rem"
                                                : "2.25rem",
                                            height: isXs
                                                ? "1.85rem"
                                                : "2.25rem",
                                            padding: "0",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            borderRadius: "8px",
                                            fontWeight:
                                                page === currentPage
                                                    ? 700
                                                    : 500,
                                            cursor: "pointer",
                                            fontSize: buttonFontSize,
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() =>
                                setCurrentPage((prev) =>
                                    Math.min(totalPages, prev + 1),
                                )
                            }
                            disabled={currentPage === totalPages}
                            className="rounded-lg border border-indigo-300 bg-indigo-600 text-white disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-indigo-700 dark:bg-indigo-500 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                            style={{
                                padding: buttonPadding,
                                borderRadius: "8px",
                                fontWeight: 600,
                                cursor:
                                    currentPage === totalPages
                                        ? "not-allowed"
                                        : "pointer",
                                fontSize: buttonFontSize,
                                transition: "all 0.2s",
                                minHeight: isXs ? "36px" : "auto",
                            }}
                        >
                            {isXs ? "→" : "Siguiente →"}
                        </button>
                    </div>
                )}
            </div>

            {/* Modal de receta */}
            {selectedProductForRecipe && (
                <RecipeModal
                    productId={selectedProductForRecipe.id}
                    productName={selectedProductForRecipe.name}
                    productType={selectedProductForRecipe.productType}
                    onClose={() => setSelectedProductForRecipe(null)}
                />
            )}
        </div>
    );
};

export default ListProduct;
