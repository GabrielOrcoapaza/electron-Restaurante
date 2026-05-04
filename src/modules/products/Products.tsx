import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../hooks/useResponsive";
import CreateProduct from "./createProduct";
import EditProduct from "./editProduct";
import ListProduct from "./listProduct";

interface Product {
    id: string;
    code: string;
    name: string;
    description?: string;
    salePrice: number;
    imageBase64?: string;
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
}

const Products: React.FC = () => {
    const { companyData } = useAuth();
    const { breakpoint } = useResponsive();
    const branchId = companyData?.branch?.id;
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(
        null,
    );
    const [refreshKey, setRefreshKey] = useState(0);

    // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
    const isXs = breakpoint === "xs"; // < 640px
    const isSmall = breakpoint === "sm"; // 640px - 767px
    const isMedium = breakpoint === "md"; // 768px - 1023px

    // Tamaños adaptativos
    const containerPadding = isXs
        ? "0.75rem"
        : isSmall
          ? "1rem"
          : isMedium
            ? "1.25rem"
            : "1.5rem";
    const containerGap = isXs
        ? "0.75rem"
        : isSmall
          ? "1rem"
          : isMedium
            ? "1.5rem"
            : "2rem";
    const titleFontSize = isXs
        ? "1rem"
        : isSmall
          ? "1.125rem"
          : isMedium
            ? "1.25rem"
            : "1.5rem";
    const subtitleFontSize = isXs
        ? "0.7rem"
        : isSmall
          ? "0.75rem"
          : isMedium
            ? "0.8125rem"
            : "0.875rem";
    const buttonPadding = isXs
        ? "0.5rem 0.875rem"
        : isSmall
          ? "0.5625rem 1rem"
          : isMedium
            ? "0.625rem 1.25rem"
            : "0.75rem 1.5rem";
    const buttonFontSize = isXs
        ? "0.7rem"
        : isSmall
          ? "0.75rem"
          : isMedium
            ? "0.8125rem"
            : "0.875rem";

    const handleEdit = (product: Product) => {
        setSelectedProduct(product);
    };

    const handleCloseEditModal = () => {
        setSelectedProduct(null);
    };

    const handleProductCreated = () => {
        setShowCreateModal(false);
        setRefreshKey((prev) => prev + 1);
    };

    const handleProductUpdated = () => {
        setSelectedProduct(null);
        setRefreshKey((prev) => prev + 1);
    };

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

    return (
        <div
            className="relative flex w-full max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            style={{
                flexShrink: 0,
                minHeight: "100%",
                width: "100%",
                maxWidth: "100%",
                display: "flex",
                flexDirection: "column",
                gap: containerGap,
                padding: containerPadding,
                position: "relative",
                overflow: "hidden",
                boxSizing: "border-box",
            }}
        >
            {/* Contenido principal */}
            <div style={{ position: "relative", zIndex: 1 }}>
                {/* Header */}
                <div
                    className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: isXs || isSmall ? "flex-start" : "center",
                        flexDirection: isXs || isSmall ? "column" : "row",
                        marginBottom: 0,
                        flexWrap:
                            isXs || isSmall || isMedium ? "wrap" : "nowrap",
                        gap: isXs || isSmall || isMedium ? "1rem" : "0.75rem",
                    }}
                >
                    <div>
                        <h2
                            className="text-slate-800 dark:text-slate-100"
                            style={{
                                margin: 0,
                                fontSize: titleFontSize,
                                fontWeight: 700,
                            }}
                        >
                            Gestion de Productos
                        </h2>
                        <p
                            className="text-slate-500 dark:text-slate-400"
                            style={{
                                margin: "0.25rem 0 0",
                                fontSize: subtitleFontSize,
                            }}
                        >
                            Administra los productos de tu menú
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-600 text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-indigo-500 dark:border-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                        style={{
                            padding: buttonPadding,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: buttonFontSize,
                        }}
                    >
                        + Nuevo Producto
                    </button>
                </div>

                {/* Lista de productos */}
                <ListProduct onEdit={handleEdit} refreshKey={refreshKey} />
            </div>

            {/* Modal de creación */}
            {showCreateModal && (
                <CreateProduct
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={handleProductCreated}
                />
            )}

            {/* Modal de edición */}
            {selectedProduct && (
                <EditProduct
                    product={selectedProduct}
                    onClose={handleCloseEditModal}
                    onSuccess={handleProductUpdated}
                />
            )}
        </div>
    );
};

export default Products;
