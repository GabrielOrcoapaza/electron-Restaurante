import React, { useState, useRef } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { UPDATE_PRODUCT } from "../../graphql/mutations";
import { GET_CATEGORIES_BY_BRANCH } from "../../graphql/queries";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../hooks/useResponsive";
import { useToast } from "../../context/ToastContext";
import {
    PRODUCT_UNIT_MEASURE_OPTIONS,
    normalizeProductUnitMeasure,
} from "../../constants/productUnitMeasures";

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
    stockMin?: number;
    stockMax?: number;
    currentStock?: number;
    isActive?: boolean;
    managesStock?: boolean;
}

interface EditProductProps {
    product: Product;
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

const EditProduct: React.FC<EditProductProps> = ({
    product,
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

    const labelClass =
        "mb-2 block font-medium text-slate-600 dark:text-slate-300";
    const fieldClass =
        "w-full rounded-lg border border-slate-300 bg-white text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

    const [formData, setFormData] = useState({
        categoryId: "",
        subcategoryId: "",
        code: product.code,
        name: product.name,
        description: product.description || "",
        productType: product.productType || "DISH",
        salePrice: product.salePrice?.toString() || "0",
        purchasePrice: product.purchasePrice?.toString() || "0",
        unitMeasure: normalizeProductUnitMeasure(product.unitMeasure),
        preparationTime: product.preparationTime?.toString() || "0",
        stockMin: product.stockMin?.toString() || "0",
        stockMax: product.stockMax?.toString() || "0",
        currentStock: product.currentStock?.toString() || "0",
        isActive: product.isActive !== undefined ? product.isActive : true,
        managesStock: product.managesStock ?? false,
    });
    const [enableStockEdit, setEnableStockEdit] = useState(false);
    const [newImageBase64, setNewImageBase64] = useState<string | null>(null);
    const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
    const [imageRemoved, setImageRemoved] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const existingImageDataUrl =
        product.imageBase64 && !imageRemoved
            ? product.imageBase64.startsWith("data:")
                ? product.imageBase64
                : `data:image/jpeg;base64,${product.imageBase64}`
            : null;
    const displayImageSrc = newImagePreview ?? existingImageDataUrl;

    const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

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

    const [updateProduct, { loading }] = useMutation(UPDATE_PRODUCT, {
        onCompleted: (data) => {
            if (data.updateProduct.success) {
                showToast(data.updateProduct.message, "success");
                setTimeout(() => {
                    onSuccess();
                }, 1000);
            } else {
                showToast(data.updateProduct.message, "error");
            }
        },
        onError: (error) => {
            showToast(error.message, "error");
        },
    });

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            showToast("El archivo debe ser una imagen", "error");
            e.target.value = "";
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            showToast("La imagen no debe superar 3 MB", "error");
            e.target.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const comma = dataUrl.indexOf(",");
            const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
            setNewImageBase64(b64);
            setNewImagePreview(dataUrl);
            setImageRemoved(false);
        };
        reader.readAsDataURL(file);
    };

    const handleClearImage = () => {
        if (newImageBase64 !== null) {
            setNewImageBase64(null);
            setNewImagePreview(null);
            if (imageInputRef.current) imageInputRef.current.value = "";
            return;
        }
        if (product.imageBase64) {
            setImageRemoved(true);
        }
        if (imageInputRef.current) imageInputRef.current.value = "";
    };

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
    ) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData((prev) => {
            const newData = {
                ...prev,
                [name]: type === "checkbox" ? checked : value,
            };
            // Si cambia la categoría, limpiar la subcategoría seleccionada
            if (name === "categoryId") {
                newData.subcategoryId = "";
            }
            return newData;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const variables: any = {
            productId: product.id,
            code: formData.code,
            name: formData.name,
            description: formData.description || null,
            productType: formData.productType,
            salePrice: formData.salePrice
                ? parseFloat(formData.salePrice)
                : undefined,
            purchasePrice: formData.purchasePrice
                ? parseFloat(formData.purchasePrice)
                : undefined,
            unitMeasure: normalizeProductUnitMeasure(formData.unitMeasure),
            preparationTime: formData.preparationTime
                ? parseInt(formData.preparationTime)
                : undefined,
            stockMin: formData.stockMin
                ? parseFloat(formData.stockMin)
                : undefined,
            stockMax: formData.stockMax
                ? parseFloat(formData.stockMax)
                : undefined,
            isActive: formData.isActive,
            managesStock: formData.managesStock,
        };

        // Solo enviar el stock si la edición está habilitada y ha cambiado respecto al valor original
        if (enableStockEdit) {
            const currentStockFloat = formData.currentStock
                ? parseFloat(formData.currentStock)
                : 0;
            if (currentStockFloat !== (product.currentStock || 0)) {
                variables.currentStock = currentStockFloat;
            }
        }

        // Solo incluir subcategoryId si se seleccionó una
        if (formData.subcategoryId) {
            variables.subcategoryId = formData.subcategoryId;
        }

        let imageMutation: string | null | undefined = undefined;
        if (newImageBase64 !== null) {
            imageMutation = newImageBase64;
        } else if (imageRemoved && product.imageBase64) {
            imageMutation = null;
        }

        // Solo incluir los campos que tienen valores
        Object.keys(variables).forEach((key) => {
            if (variables[key] === undefined || variables[key] === null) {
                delete variables[key];
            }
        });

        if (imageMutation !== undefined) {
            variables.imageBase64 = imageMutation;
        }

        updateProduct({ variables });
    };

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
            style={{ zIndex: 1000 }}
            onClick={onClose}
        >
            <div
                className="relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                style={{
                    padding: modalPadding,
                    maxWidth: modalMaxWidth,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Botón cerrar */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    style={{
                        background: "none",
                        border: "none",
                        fontSize: "1.5rem",
                        cursor: "pointer",
                    }}
                >
                    ✕
                </button>

                <h2
                    className="text-slate-800 dark:text-slate-100"
                    style={{
                        margin: "0 0 1rem",
                        fontSize: titleFontSize,
                        fontWeight: 700,
                    }}
                >
                    Editar producto
                </h2>

                <form onSubmit={handleSubmit} className="text-slate-700 dark:text-slate-200">
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
                                    className={labelClass}
                                    style={{ fontSize: labelFontSize }}
                                >
                                    Categoría
                                </label>
                                <select
                                    name="categoryId"
                                    value={formData.categoryId}
                                    onChange={handleChange}
                                    className={fieldClass}
                                    style={{
                                        padding: inputPadding,
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                >
                                    <option value="">
                                        Mantener categoría actual
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
                                    className={labelClass}
                                    style={{ fontSize: labelFontSize }}
                                >
                                    Subcategoría
                                </label>
                                <select
                                    name="subcategoryId"
                                    value={formData.subcategoryId}
                                    onChange={handleChange}
                                    disabled={!formData.categoryId}
                                    className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-70 ${
                                        formData.categoryId
                                            ? ""
                                            : "bg-slate-100 dark:bg-slate-900"
                                    }`}
                                    style={{
                                        padding: inputPadding,
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                >
                                    <option value="">
                                        Mantener subcategoría actual
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
                                className={labelClass}
                                style={{ fontSize: labelFontSize }}
                            >
                                Tipo de Producto *
                            </label>
                            <select
                                name="productType"
                                value={formData.productType}
                                onChange={handleChange}
                                required
                                className={fieldClass}
                                style={{
                                    padding: inputPadding,
                                    fontSize: inputFontSize,
                                    boxSizing: "border-box",
                                }}
                            >
                                <option value="DISH">Plato</option>
                                <option value="BEVERAGE">Bebida</option>
                                <option value="INGREDIENT">Ingrediente</option>
                                <option value="PROMOTION">
                                    Promoción / Combo
                                </option>
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
                                    className={labelClass}
                                    style={{ fontSize: labelFontSize }}
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
                                    className={fieldClass}
                                    style={{
                                        padding: inputPadding,
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>

                            <div>
                                <label
                                    className={labelClass}
                                    style={{ fontSize: labelFontSize }}
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
                                    className={fieldClass}
                                    style={{
                                        padding: inputPadding,
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>
                        </div>

                        {/* Descripción */}
                        <div>
                            <label
                                className={labelClass}
                                style={{ fontSize: labelFontSize }}
                            >
                                Descripción
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Descripción del producto"
                                rows={2}
                                className={`${fieldClass} resize-y font-inherit`}
                                style={{
                                    padding: inputPadding,
                                    fontSize: inputFontSize,
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>

                        {/* Foto del producto */}
                        <div>
                            <label
                                className={labelClass}
                                style={{ fontSize: labelFontSize }}
                            >
                                Foto del producto
                            </label>
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "flex-start",
                                    gap: "0.75rem",
                                }}
                            >
                                {displayImageSrc ? (
                                    <img
                                        src={displayImageSrc}
                                        alt="Producto"
                                        className="rounded-[10px] border border-slate-200 dark:border-slate-600"
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
                                        }}
                                    />
                                ) : (
                                    <div
                                        className="flex items-center justify-center rounded-[10px] border border-dashed border-slate-300 bg-slate-50 text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500"
                                        style={{
                                            width:
                                                isXs || isSmall
                                                    ? "72px"
                                                    : "88px",
                                            height:
                                                isXs || isSmall
                                                    ? "72px"
                                                    : "88px",
                                            fontSize: "1.5rem",
                                        }}
                                    >
                                        🖼️
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
                                        className={fieldClass}
                                        style={{
                                            padding:
                                                isXs || isSmall
                                                    ? "0.35rem"
                                                    : "0.4rem",
                                            fontSize: inputFontSize,
                                            boxSizing: "border-box",
                                        }}
                                    />
                                    <p className="mt-1 text-[0.65rem] text-slate-400 dark:text-slate-500">
                                        JPG, PNG, WebP o GIF. Máx. 3 MB. Guardar
                                        envía la nueva imagen o quita la actual.
                                    </p>
                                </div>
                                {(displayImageSrc ||
                                    newImageBase64 !== null) && (
                                    <button
                                        type="button"
                                        onClick={handleClearImage}
                                        className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                        style={{
                                            fontSize: inputFontSize,
                                            cursor: "pointer",
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
                                    className={labelClass}
                                    style={{ fontSize: labelFontSize }}
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
                                    className={fieldClass}
                                    style={{
                                        padding: inputPadding,
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>

                            {formData.productType !== "PROMOTION" && (
                                <div>
                                    <label
                                        className={labelClass}
                                        style={{ fontSize: labelFontSize }}
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
                                        className={fieldClass}
                                        style={{
                                            padding: inputPadding,
                                            fontSize: inputFontSize,
                                            boxSizing: "border-box",
                                        }}
                                    />
                                </div>
                            )}
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
                                    className={labelClass}
                                    style={{ fontSize: labelFontSize }}
                                >
                                    Unidad de Medida
                                </label>
                                <select
                                    name="unitMeasure"
                                    value={formData.unitMeasure}
                                    onChange={handleChange}
                                    className={fieldClass}
                                    style={{
                                        padding: inputPadding,
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                >
                                    {PRODUCT_UNIT_MEASURE_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label
                                    className={labelClass}
                                    style={{ fontSize: labelFontSize }}
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
                                    className={fieldClass}
                                    style={{
                                        padding: inputPadding,
                                        fontSize: inputFontSize,
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>
                        </div>

                        {/* Stock - Solo visible para Bebidas e Ingredientes */}
                        {(formData.productType === "BEVERAGE" ||
                            formData.productType === "INGREDIENT") && (
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
                                        className={labelClass}
                                        style={{ fontSize: labelFontSize }}
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
                                        className={fieldClass}
                                        style={{
                                            padding: inputPadding,
                                            fontSize: inputFontSize,
                                            boxSizing: "border-box",
                                        }}
                                    />
                                </div>

                                <div>
                                    <label
                                        className={labelClass}
                                        style={{ fontSize: labelFontSize }}
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
                                        className={fieldClass}
                                        style={{
                                            padding: inputPadding,
                                            fontSize: inputFontSize,
                                            boxSizing: "border-box",
                                        }}
                                    />
                                </div>

                                <div>
                                    <label
                                        className="mb-2 flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300"
                                        style={{ fontSize: labelFontSize }}
                                    >
                                        Stock Actual
                                        <input
                                            type="checkbox"
                                            checked={enableStockEdit}
                                            onChange={(e) => {
                                                const checked =
                                                    e.target.checked;
                                                setEnableStockEdit(checked);
                                                if (checked) {
                                                    showToast(
                                                        "Advertencia: Cambiar el stock afectará tu Kardex y generará un ajuste.",
                                                        "warning",
                                                    );
                                                }
                                            }}
                                            title="Habilitar edición de stock"
                                            className="h-3.5 w-3.5 cursor-pointer accent-indigo-600"
                                        />
                                    </label>
                                    <input
                                        type="number"
                                        name="currentStock"
                                        value={formData.currentStock}
                                        onChange={handleChange}
                                        disabled={!enableStockEdit}
                                        min="0"
                                        step="0.01"
                                        placeholder="0"
                                        className={`${fieldClass} disabled:cursor-not-allowed ${
                                            enableStockEdit
                                                ? ""
                                                : "bg-slate-100 dark:bg-slate-900"
                                        }`}
                                        style={{
                                            padding: inputPadding,
                                            fontSize: inputFontSize,
                                            boxSizing: "border-box",
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Manejo de Stock - Solo para Bebidas e Ingredientes */}
                        {(formData.productType === "BEVERAGE" ||
                            formData.productType === "INGREDIENT") && (
                            <div
                                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                                    formData.managesStock
                                        ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/25"
                                        : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                                }`}
                                onClick={() => {
                                    setFormData((prev) => ({
                                        ...prev,
                                        managesStock: !prev.managesStock,
                                    }));
                                }}
                            >
                                <input
                                    type="checkbox"
                                    name="managesStock"
                                    checked={formData.managesStock}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        setFormData((prev) => ({
                                            ...prev,
                                            managesStock: e.target.checked,
                                        }));
                                    }}
                                    className="h-[18px] w-[18px] cursor-pointer accent-indigo-600"
                                />
                                <div>
                                    <div
                                        className="font-semibold text-indigo-800 dark:text-indigo-200"
                                        style={{
                                            fontSize: labelFontSize,
                                        }}
                                    >
                                        Manejar Stock e Inventario
                                    </div>
                                    <div className="text-[0.7rem] text-slate-500 dark:text-slate-400">
                                        Si se activa, este producto generará
                                        movimientos en el Kardex. Una vez
                                        guardado con esta opción activa, no se
                                        podrá desactivar.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Estado Activo */}
                        <div>
                            <label
                                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors ${
                                    formData.isActive
                                        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35"
                                        : "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/35"
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    name="isActive"
                                    checked={formData.isActive}
                                    onChange={handleChange}
                                    className="h-[18px] w-[18px] cursor-pointer accent-indigo-600"
                                />
                                <span
                                    className={`font-medium ${
                                        formData.isActive
                                            ? "text-emerald-800 dark:text-emerald-200"
                                            : "text-red-800 dark:text-red-200"
                                    }`}
                                    style={{ fontSize: labelFontSize }}
                                >
                                    {formData.isActive
                                        ? "Producto activo"
                                        : "Producto inactivo"}
                                </span>
                            </label>
                        </div>

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
                                className="flex-1 rounded-lg border border-indigo-300 bg-indigo-600 font-semibold text-white transition-all duration-150 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 dark:border-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-700"
                                style={{
                                    padding: buttonPadding,
                                    fontSize: buttonFontSize,
                                }}
                            >
                                {loading
                                    ? "Guardando..."
                                    : "Guardar cambios"}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg border border-slate-300 bg-slate-100 font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                style={{
                                    padding: buttonPadding,
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

export default EditProduct;
