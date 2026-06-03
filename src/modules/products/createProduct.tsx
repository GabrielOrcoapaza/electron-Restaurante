import React, { useState, useRef } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useResponsive } from "../../hooks/useResponsive";
import { CREATE_PRODUCT, LINK_PRODUCT_TO_PROMOTION } from "../../graphql/mutations";
import { GET_CATEGORIES_BY_BRANCH } from "../../graphql/queries";
import { ComboPromotionLinkField } from "../../components/ComboPromotionLinkField";
import { useAuth } from "../../hooks/useAuth";
import {
    PRODUCT_UNIT_MEASURE_OPTIONS,
    normalizeProductUnitMeasure,
} from "../../constants/productUnitMeasures";

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

    const labelClass =
        "mb-2 block font-medium text-slate-600 dark:text-slate-300";
    const fieldClass =
        "w-full rounded-lg border border-slate-300 bg-white text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

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
        linkedPromotionId: "",
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

    const [createProduct, { loading }] = useMutation(CREATE_PRODUCT);
    const [linkProductToPromotion] = useMutation(LINK_PRODUCT_TO_PROMOTION);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (!branchId) {
            setMessage({
                type: "error",
                text: "No se encontró información de la sucursal",
            });
            return;
        }

        if (
            formData.productType === "PROMOTION" &&
            !formData.linkedPromotionId
        ) {
            setMessage({
                type: "error",
                text: "Selecciona la promoción COMBO / menú a vincular.",
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

        try {
            const { data } = await createProduct({
                variables: {
                    branchId,
                    code: formData.code,
                    name: formData.name,
                    description: formData.description || null,
                    subcategoryId: formData.subcategoryId || null,
                    productType: formData.productType,
                    salePrice: toFloat(formData.salePrice),
                    purchasePrice: toFloat(formData.purchasePrice),
                    unitMeasure: normalizeProductUnitMeasure(
                        formData.unitMeasure,
                    ),
                    preparationTime: toInt(formData.preparationTime),
                    stockMin: toFloat(formData.stockMin),
                    stockMax: toFloat(formData.stockMax),
                    currentStock: toFloat(formData.currentStock),
                    managesStock: formData.managesStock,
                    imageBase64: imageBase64 || null,
                },
            });

            if (!data?.createProduct?.success) {
                setMessage({
                    type: "error",
                    text: data?.createProduct?.message || "No se pudo crear el producto.",
                });
                return;
            }

            const productId = data.createProduct.product?.id;
            if (
                formData.productType === "PROMOTION" &&
                productId &&
                formData.linkedPromotionId
            ) {
                const { data: linkData } = await linkProductToPromotion({
                    variables: {
                        productId,
                        promotionId: formData.linkedPromotionId,
                    },
                });
                if (!linkData?.linkProductToPromotion?.success) {
                    setMessage({
                        type: "error",
                        text:
                            linkData?.linkProductToPromotion?.message ||
                            "Producto creado, pero no se pudo vincular la promoción.",
                    });
                    return;
                }
            }

            setMessage({
                type: "success",
                text: data.createProduct.message,
            });
            setTimeout(() => {
                onSuccess();
            }, 1000);
        } catch (error: any) {
            setMessage({
                type: "error",
                text: error?.message || "Error al crear el producto.",
            });
        }
    };

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
            style={{
                zIndex: 1000,
            }}
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
                    Nuevo producto
                </h2>

                {/* Mensaje */}
                {message && (
                    <div
                        className={
                            message.type === "success"
                                ? "mb-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                                : "mb-4 rounded-xl border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
                        }
                        style={{
                            padding: "1rem",
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

                        {formData.productType === "PROMOTION" && branchId && (
                            <ComboPromotionLinkField
                                branchId={branchId}
                                value={formData.linkedPromotionId}
                                onChange={(promotionId) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        linkedPromotionId: promotionId,
                                    }))
                                }
                                labelClass={labelClass}
                                fieldClass={fieldClass}
                                labelFontSize={labelFontSize}
                                inputPadding={inputPadding}
                                inputFontSize={inputFontSize}
                            />
                        )}

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

                        {/* Foto del producto (ImageField en backend → imageBase64 en GraphQL) */}
                        <div>
                            <label
                                className={labelClass}
                                style={{ fontSize: labelFontSize }}
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
                                        JPG, PNG, WebP o GIF. Máx. 3 MB.
                                    </p>
                                </div>
                                {imagePreview && (
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

                        {/* Stock */}
                        {formData.productType !== "PROMOTION" && (
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
                                        className={labelClass}
                                        style={{ fontSize: labelFontSize }}
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
                                        className={fieldClass}
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
                                {loading ? "Guardando..." : "Guardar producto"}
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

export default CreateProduct;
