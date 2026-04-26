import React, { useState, useRef } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useResponsive } from "../../hooks/useResponsive";
import { CREATE_PRODUCT } from "../../graphql/mutations";
import { GET_CATEGORIES_BY_BRANCH } from "../../graphql/queries";
import { useAuth } from "../../hooks/useAuth";

interface CreateProductProps {
    onClose: () => void;
    onSuccess: () => void;
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

const CreateProduct: React.FC<CreateProductProps> = ({
    onClose,
    onSuccess,
}) => {
    const { companyData } = useAuth();
    const { breakpoint } = useResponsive();
    const branchId = companyData?.branch?.id;

    // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
    const isXs = breakpoint === "xs"; // < 640px
    const isSmall = breakpoint === "sm"; // 640px - 767px
    const isMedium = breakpoint === "md"; // 768px - 1023px
    const isSmallDesktop = breakpoint === "lg"; // 1024px - 1279px

    // Tamaños adaptativos (Compactados)
    const modalPadding = isXs
        ? "1rem"
        : isSmall
          ? "1.25rem"
          : isMedium
            ? "1.5rem"
            : "1.5rem";
    const modalMaxWidth = isXs
        ? "98%"
        : isSmall
          ? "95%"
          : isMedium
            ? "550px"
            : isSmallDesktop
              ? "600px"
              : "700px";
    const labelFontSize = isXs ? "0.75rem" : isSmall ? "0.8rem" : "0.8rem";
    const inputFontSize = isXs ? "0.875rem" : isSmall ? "0.8rem" : "0.8rem";
    const inputPadding = isXs
        ? "0.625rem 0.75rem"
        : isSmall
          ? "0.5rem 0.625rem"
          : "0.625rem 0.75rem";
    const buttonPadding = isXs
        ? "0.75rem 1rem"
        : isSmall
          ? "0.625rem 1rem"
          : "0.75rem 1.25rem";
    const buttonFontSize = isXs ? "0.875rem" : isSmall ? "0.8rem" : "0.8rem";
    const gapSize = isXs ? "0.75rem" : isSmall ? "0.875rem" : "1rem";
    const titleFontSize = isXs ? "1.125rem" : isSmall ? "1.2rem" : "1.25rem";

    const [formData, setFormData] = useState({
        categoryId: "",
        subcategoryId: "",
        code: "",
        name: "",
        description: "",
        productType: "DISH",
        salePrice: "",
        purchasePrice: "",
        unitMeasure: "NIU",
        preparationTime: "",
        stockMin: "",
        stockMax: "",
        currentStock: "",
        managesStock: false,
    });
    const [message, setMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const categories: Category[] = categoriesData?.categoriesByBranch || [];
    const selectedCategory = categories.find(
        (cat) => cat.id === formData.categoryId,
    );
    const availableSubcategories =
        selectedCategory?.subcategories?.filter((sub) => sub.isActive) || [];

    const [createProduct, { loading }] = useMutation(CREATE_PRODUCT, {
        onCompleted: (data) => {
            if (data.createProduct.success) {
                setMessage({
                    type: "success",
                    text: data.createProduct.message,
                });
                setTimeout(() => {
                    onSuccess();
                }, 1000);
            } else {
                setMessage({ type: "error", text: data.createProduct.message });
            }
        },
        onError: (error) => {
            setMessage({ type: "error", text: error.message });
        },
    });

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            const newData = { ...prev, [name]: value };
            // Si cambia la categoría, limpiar la subcategoría seleccionada
            if (name === "categoryId") {
                newData.subcategoryId = "";
            }
            return newData;
        });
    };

    const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setMessage({
                type: "error",
                text: "El archivo debe ser una imagen",
            });
            e.target.value = "";
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            setMessage({
                type: "error",
                text: "La imagen no debe superar 3 MB",
            });
            e.target.value = "";
            return;
        }
        setMessage(null);
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const comma = dataUrl.indexOf(",");
            const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
            setImageBase64(b64);
            setImagePreview(dataUrl);
        };
        reader.readAsDataURL(file);
    };

    const handleClearImage = () => {
        setImageBase64(null);
        setImagePreview(null);
        if (imageInputRef.current) {
            imageInputRef.current.value = "";
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (!branchId) {
            setMessage({
                type: "error",
                text: "No se encontró información de la sucursal",
            });
            return;
        }

        // Helper para convertir a número (0 si está vacío, ya que el modelo tiene default=0)
        const toFloat = (value: string): number => {
            if (!value || value.trim() === "") return 0;
            const num = parseFloat(value.trim());
            if (isNaN(num)) return 0;
            // Asegurar que es un número primitivo para GraphQL
            return +num;
        };

        const toInt = (value: string): number => {
            if (!value || value.trim() === "") return 0;
            const num = parseInt(value.trim(), 10);
            if (isNaN(num)) return 0;
            // Asegurar que es un número primitivo para GraphQL
            return +num;
        };

        createProduct({
            variables: {
                branchId,
                code: formData.code,
                name: formData.name,
                description: formData.description || null,
                subcategoryId: formData.subcategoryId || null,
                productType: formData.productType,
                salePrice: toFloat(formData.salePrice),
                purchasePrice: toFloat(formData.purchasePrice),
                unitMeasure: formData.unitMeasure,
                preparationTime: toInt(formData.preparationTime),
                stockMin: toFloat(formData.stockMin),
                stockMax: toFloat(formData.stockMax),
                currentStock: toFloat(formData.currentStock),
                managesStock: formData.managesStock,
                imageBase64: imageBase64 || null,
            },
        });
    };

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: "1rem",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: "white",
                    borderRadius: "20px",
                    padding: modalPadding,
                    maxWidth: modalMaxWidth,
                    width: "100%",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                    position: "relative",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Botón cerrar */}
                <button
                    onClick={onClose}
                    style={{
                        position: "absolute",
                        top: "1rem",
                        right: "1rem",
                        background: "none",
                        border: "none",
                        fontSize: "1.5rem",
                        cursor: "pointer",
                        color: "#64748b",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#f1f5f9")
                    }
                    onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                    }
                >
                    ✕
                </button>

                <h2
                    style={{
                        margin: "0 0 1rem",
                        fontSize: titleFontSize,
                        fontWeight: 700,
                        color: "#1e293b",
                    }}
                >
                    🆕 Nuevo Producto
                </h2>

                {/* Mensaje */}
                {message && (
                    <div
                        style={{
                            padding: "1rem",
                            borderRadius: "10px",
                            marginBottom: "1rem",
                            backgroundColor:
                                message.type === "success"
                                    ? "#dcfce7"
                                    : "#fee2e2",
                            color:
                                message.type === "success"
                                    ? "#166534"
                                    : "#991b1b",
                            border: `1px solid ${message.type === "success" ? "#86efac" : "#fecaca"}`,
                        }}
                    >
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.625rem",
                        }}
                    >
                        {/* Categoría y Subcategoría */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    isXs || isSmall ? "1fr" : "1fr 1fr",
                                gap: gapSize,
                            }}
                        >
                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: 500,
                                        fontSize: labelFontSize,
                                        color: "#475569",
                                    }}
                                >
                                    Categoría
                                </label>
                                <select
                                    name="categoryId"
                                    value={formData.categoryId}
                                    onChange={handleChange}
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
                                    <option value="">
                                        Seleccionar categoría
                                    </option>
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

                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: 500,
                                        fontSize: labelFontSize,
                                        color: "#475569",
                                    }}
                                >
                                    Subcategoría
                                </label>
                                <select
                                    name="subcategoryId"
                                    value={formData.subcategoryId}
                                    onChange={handleChange}
                                    disabled={!formData.categoryId}
                                    style={{
                                        width: "100%",
                                        padding: inputPadding,
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                        backgroundColor: formData.categoryId
                                            ? "white"
                                            : "#f1f5f9",
                                    }}
                                >
                                    <option value="">
                                        Seleccionar subcategoría
                                    </option>
                                    {availableSubcategories.map(
                                        (subcategory) => (
                                            <option
                                                key={subcategory.id}
                                                value={subcategory.id}
                                            >
                                                {subcategory.name}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </div>
                        </div>

                        {/* Tipo de Producto */}
                        <div>
                            <label
                                style={{
                                    display: "block",
                                    marginBottom: "0.5rem",
                                    fontWeight: 500,
                                    fontSize: labelFontSize,
                                    color: "#475569",
                                }}
                            >
                                Tipo de Producto *
                            </label>
                            <select
                                name="productType"
                                value={formData.productType}
                                onChange={handleChange}
                                required
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
                                <option value="DISH">Plato</option>
                                <option value="BEVERAGE">Bebida</option>
                                <option value="INGREDIENT">Ingrediente</option>
                            </select>
                        </div>

                        {/* Código y Nombre */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    isXs || isSmall ? "1fr" : "1fr 2fr",
                                gap: gapSize,
                            }}
                        >
                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: 500,
                                        fontSize: labelFontSize,
                                        color: "#475569",
                                    }}
                                >
                                    Código *
                                </label>
                                <input
                                    type="text"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleChange}
                                    required
                                    placeholder="PROD001"
                                    style={{
                                        width: "100%",
                                        padding: inputPadding,
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>

                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: 500,
                                        fontSize: labelFontSize,
                                        color: "#475569",
                                    }}
                                >
                                    Nombre *
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    placeholder="Nombre del producto"
                                    style={{
                                        width: "100%",
                                        padding: inputPadding,
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>
                        </div>

                        {/* Descripción */}
                        <div>
                            <label
                                style={{
                                    display: "block",
                                    marginBottom: "0.5rem",
                                    fontWeight: 500,
                                    fontSize: labelFontSize,
                                    color: "#475569",
                                }}
                            >
                                Descripción
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Descripción del producto"
                                rows={2}
                                style={{
                                    width: "100%",
                                    padding: inputPadding,
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "8px",
                                    fontSize: inputFontSize,
                                    boxSizing: "border-box",
                                    resize: "vertical",
                                    fontFamily: "inherit",
                                }}
                            />
                        </div>

                        {/* Foto del producto (ImageField en backend → imageBase64 en GraphQL) */}
                        <div>
                            <label
                                style={{
                                    display: "block",
                                    marginBottom: "0.5rem",
                                    fontWeight: 500,
                                    fontSize: labelFontSize,
                                    color: "#475569",
                                }}
                            >
                                Foto del producto (opcional)
                            </label>
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "flex-start",
                                    gap: "0.75rem",
                                }}
                            >
                                {imagePreview && (
                                    <div
                                        style={{
                                            position: "relative",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <img
                                            src={imagePreview}
                                            alt="Vista previa"
                                            style={{
                                                width:
                                                    isXs || isSmall
                                                        ? "72px"
                                                        : "88px",
                                                height:
                                                    isXs || isSmall
                                                        ? "72px"
                                                        : "88px",
                                                objectFit: "cover",
                                                borderRadius: "10px",
                                                border: "1px solid #e2e8f0",
                                            }}
                                        />
                                    </div>
                                )}
                                <div
                                    style={{
                                        flex: "1",
                                        minWidth:
                                            isXs || isSmall ? "100%" : "160px",
                                    }}
                                >
                                    <input
                                        ref={imageInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                        onChange={handleImageChange}
                                        style={{
                                            width: "100%",
                                            padding:
                                                isXs || isSmall
                                                    ? "0.35rem"
                                                    : "0.4rem",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "8px",
                                            fontSize: inputFontSize,
                                            boxSizing: "border-box",
                                            backgroundColor: "white",
                                        }}
                                    />
                                    <p
                                        style={{
                                            margin: "0.35rem 0 0",
                                            fontSize: "0.65rem",
                                            color: "#94a3b8",
                                        }}
                                    >
                                        JPG, PNG, WebP o GIF. Máx. 3 MB.
                                    </p>
                                </div>
                                {imagePreview && (
                                    <button
                                        type="button"
                                        onClick={handleClearImage}
                                        style={{
                                            padding: "0.4rem 0.65rem",
                                            fontSize: inputFontSize,
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "8px",
                                            background: "#f8fafc",
                                            color: "#64748b",
                                            cursor: "pointer",
                                            fontWeight: 500,
                                            alignSelf: "center",
                                        }}
                                    >
                                        Quitar foto
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Precios */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    isXs || isSmall ? "1fr" : "1fr 1fr",
                                gap: gapSize,
                            }}
                        >
                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: 500,
                                        fontSize: labelFontSize,
                                        color: "#475569",
                                    }}
                                >
                                    Precio de Venta
                                </label>
                                <input
                                    type="number"
                                    name="salePrice"
                                    value={formData.salePrice}
                                    onChange={handleChange}
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    style={{
                                        width: "100%",
                                        padding: inputPadding,
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>

                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: 500,
                                        fontSize: labelFontSize,
                                        color: "#475569",
                                    }}
                                >
                                    Precio de Compra
                                </label>
                                <input
                                    type="number"
                                    name="purchasePrice"
                                    value={formData.purchasePrice}
                                    onChange={handleChange}
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    style={{
                                        width: "100%",
                                        padding: inputPadding,
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>
                        </div>

                        {/* Unidad de Medida y Tiempo de preparación */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    isXs || isSmall ? "1fr" : "1fr 1fr",
                                gap: gapSize,
                            }}
                        >
                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: 500,
                                        fontSize: labelFontSize,
                                        color: "#475569",
                                    }}
                                >
                                    Unidad de Medida
                                </label>
                                <select
                                    name="unitMeasure"
                                    value={formData.unitMeasure}
                                    onChange={handleChange}
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
                                    <option value="NIU">NIU - Unidad</option>
                                    <option value="KG">KG - Kilogramo</option>
                                    <option value="LTR">LTR - Litro</option>
                                    <option value="MTR">MTR - Metro</option>
                                </select>
                            </div>

                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: 500,
                                        fontSize: labelFontSize,
                                        color: "#475569",
                                    }}
                                >
                                    Tiempo de Preparación (min)
                                </label>
                                <input
                                    type="number"
                                    name="preparationTime"
                                    value={formData.preparationTime}
                                    onChange={handleChange}
                                    min="0"
                                    placeholder="0"
                                    style={{
                                        width: "100%",
                                        padding: inputPadding,
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>
                        </div>

                        {/* Stock */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    isXs || isSmall
                                        ? "1fr"
                                        : isMedium
                                          ? "1fr 1fr"
                                          : "1fr 1fr 1fr",
                                gap: gapSize,
                            }}
                        >
                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: 500,
                                        fontSize: labelFontSize,
                                        color: "#475569",
                                    }}
                                >
                                    Stock Mínimo
                                </label>
                                <input
                                    type="number"
                                    name="stockMin"
                                    value={formData.stockMin}
                                    onChange={handleChange}
                                    min="0"
                                    step="0.01"
                                    placeholder="0"
                                    style={{
                                        width: "100%",
                                        padding: inputPadding,
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>

                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: 500,
                                        fontSize: labelFontSize,
                                        color: "#475569",
                                    }}
                                >
                                    Stock Máximo
                                </label>
                                <input
                                    type="number"
                                    name="stockMax"
                                    value={formData.stockMax}
                                    onChange={handleChange}
                                    min="0"
                                    step="0.01"
                                    placeholder="0"
                                    style={{
                                        width: "100%",
                                        padding: inputPadding,
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>

                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: 500,
                                        fontSize: labelFontSize,
                                        color: "#475569",
                                    }}
                                >
                                    Stock Inicial
                                </label>
                                <input
                                    type="number"
                                    name="currentStock"
                                    value={formData.currentStock}
                                    onChange={handleChange}
                                    min="0"
                                    step="0.01"
                                    placeholder="0"
                                    style={{
                                        width: "100%",
                                        padding: inputPadding,
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>
                        </div>

                        {/* Manejo de Stock - Solo para Bebidas e Ingredientes */}
                        {(formData.productType === "BEVERAGE" ||
                            formData.productType === "INGREDIENT") && (
                            <div
                                style={{
                                    padding: "0.75rem",
                                    borderRadius: "8px",
                                    backgroundColor: formData.managesStock
                                        ? "#eff6ff"
                                        : "#f8fafc",
                                    border: `1px solid ${formData.managesStock ? "#bfdbfe" : "#e2e8f0"}`,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.75rem",
                                    cursor: "pointer",
                                }}
                                onClick={() =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        managesStock: !prev.managesStock,
                                    }))
                                }
                            >
                                <input
                                    type="checkbox"
                                    name="managesStock"
                                    checked={formData.managesStock}
                                    onChange={(e) => {
                                        // Evitar propagación para no disparar el onClick del contenedor
                                        e.stopPropagation();
                                        setFormData((prev) => ({
                                            ...prev,
                                            managesStock: e.target.checked,
                                        }));
                                    }}
                                    style={{
                                        width: "18px",
                                        height: "18px",
                                        cursor: "pointer",
                                    }}
                                />
                                <div>
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            fontSize: labelFontSize,
                                            color: "#1e40af",
                                        }}
                                    >
                                        Manejar Stock e Inventario
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "0.7rem",
                                            color: "#64748b",
                                        }}
                                    >
                                        Si se activa, este producto generará
                                        movimientos en el Kardex. Una vez
                                        guardado con esta opción activa, no se
                                        podrá desactivar.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Botones */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection:
                                    isXs || isSmall ? "column" : "row",
                                gap: "0.75rem",
                                marginTop: "1rem",
                            }}
                        >
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    flex: 1,
                                    padding: buttonPadding,
                                    background: loading
                                        ? "#94a3b8"
                                        : "linear-gradient(135deg, #667eea, #764ba2)",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "10px",
                                    fontWeight: 600,
                                    cursor: loading ? "not-allowed" : "pointer",
                                    fontSize: buttonFontSize,
                                }}
                            >
                                {loading
                                    ? "Guardando..."
                                    : "💾 Guardar Producto"}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    padding: buttonPadding,
                                    background: "#f1f5f9",
                                    color: "#475569",
                                    border: "none",
                                    borderRadius: "10px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontSize: buttonFontSize,
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateProduct;
