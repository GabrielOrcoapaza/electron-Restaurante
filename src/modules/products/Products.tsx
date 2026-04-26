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

    return (
        <div
            style={{
                flexShrink: 0,
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
                        alignItems: isXs || isSmall ? "flex-start" : "center",
                        flexDirection: isXs || isSmall ? "column" : "row",
                        marginBottom:
                            isXs || isSmall
                                ? "1rem"
                                : isMedium
                                  ? "1.5rem"
                                  : "2rem",
                        flexWrap:
                            isXs || isSmall || isMedium ? "wrap" : "nowrap",
                        gap: isXs || isSmall || isMedium ? "1rem" : "0",
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
                            🍽️ Gestión de Productos
                        </h2>
                        <p
                            style={{
                                margin: "0.25rem 0 0",
                                color: "#64748b",
                                fontSize: subtitleFontSize,
                            }}
                        >
                            Administra los productos de tu menú
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        style={{
                            padding: buttonPadding,
                            background:
                                "linear-gradient(135deg, #667eea, #764ba2)",
                            color: "white",
                            border: "none",
                            borderRadius: "10px",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: buttonFontSize,
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            transition: "all 0.2s ease",
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
