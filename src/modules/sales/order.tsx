import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../hooks/useResponsive";
import { useUserPermissions } from "../../hooks/useUserPermissions";
import { useWebSocket } from "../../context/WebSocketContext";
import { useToast } from "../../context/ToastContext";
import {
    shouldDenyTableEntryForSessionLock,
    type Table,
} from "../../types/table";
import {
    RestrictedTableAccessModal,
    type RestrictedModalPayload,
} from "../../components/RestrictedTableAccessModal";
import { resolveClientDeviceIdForPrint } from "../../utils/deviceIdForPrint";
import {
    CREATE_OPERATION,
    ADD_ITEMS_TO_OPERATION,
    UPDATE_TABLE_STATUS,
    PRINT_PRECUENTA,
    RELEASE_TABLE_SESSION_LOCK,
} from "../../graphql/mutations";
import {
    GET_CATEGORIES_BY_BRANCH_LIGHT,
    GET_SUBCATEGORIES_BY_CATEGORY,
    GET_PRODUCTS_BY_CATEGORY,
    GET_OPERATION_BY_TABLE,
    GET_OPERATION_BY_ID,
    SEARCH_PRODUCTS,
    GET_PRODUCT_BY_CODE,
    GET_MODIFIERS_BY_SUBCATEGORY,
    GET_ACTIVE_PROMOTIONS,
} from "../../graphql/queries";
import ModalObservation from "./modalObservation";
import CategoryIcon from "../../components/CategoryIcon";
import { ComboSelectorModal } from "../../components/ComboSelectorModal";
import VirtualKeyboard from "../../components/VirtualKeyboard";
import {
    useTableSessionLock,
    isTableSessionLockApiEnabled,
    releaseTableSessionLockImmediately,
} from "../../hooks/useTableSessionLock";
import { invokeLocalIssuedDocumentPrint } from "../../utils/localDocumentPrint";
import { getLocalTicketPrinterStorage } from "../../utils/localPrinterPreference";
import {
    findBestDiscountPromotion,
    calculateLineDiscount,
    computeNxMFreeSet,
    findBadgePromotion,
    promotionBadgeLabel,
    type CartLine,
} from "../../utils/promotionUtils";
import type { IPromotion } from "../../types/promotions";
import { productStockLabel } from "../../utils/productStockDisplay";
import {
    buildCartStockUsage,
    canAddComboQuantity,
    canAddMoreProduct,
    canAddProductQuantity,
    canSetItemQuantity,
    isStockWarningMessage,
} from "../../utils/operationStock";

export type OrderSuccessPayload = {
    operationId: string | number;
    operationDate?: string | null;
};

type OrderProps = {
    table: Table;
    onClose: () => void;
    onSuccess?: (payload?: OrderSuccessPayload) => void;
    onOpenCash?: (table: Table) => void;
};

// Tipo para los ítems de la orden
type OrderItem = {
    id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
    isNew: boolean;
    notes: string;
    subcategoryId?: string;
    isPrinted?: boolean;
    printedAt?: string;
    // NUEVO: campo producto completo (necesario para evaluar promociones)
    product?: any;
    // NUEVO: descuento calculado automáticamente por recalculatePromotions
    discount?: number;
    promotionName?: string | null;
    // NUEVO: solo para productos tipo PROMOTION (combo)
    isCombo?: boolean;
    comboComponents?: any[];
};

const GIFT_ITEM_ID = "gift-item-unique-id";

function buildGiftOrderItem(promo: IPromotion): OrderItem | null {
    const giftProduct = promo.giftProduct;
    if (!giftProduct) return null;
    return {
        id: GIFT_ITEM_ID,
        productId: String(giftProduct.id),
        name: giftProduct.name,
        price: 0,
        quantity: parseInt(String(promo.giftQuantity || "1"), 10),
        total: 0,
        isNew: true,
        notes: `Regalo: ${promo.name}`,
        subcategoryId: (giftProduct as { subcategoryId?: string }).subcategoryId,
        product: giftProduct,
        discount: 0,
        promotionName: promo.name,
    };
}

/** Recalcula descuentos y regalo en un solo paso (sin setState). */
function applyPromotionsToOrder(
    items: OrderItem[],
    promotions: IPromotion[],
    subcategoriesOfCategoryParam?: any[],
    selectedCategoryParam?: string | null,
): { items: OrderItem[]; giftMessage: string | null } {
    const nonGiftItems = items.filter((item) => item.id !== GIFT_ITEM_ID);

    if (promotions.length === 0) {
        return { items: nonGiftItems, giftMessage: null };
    }

    const cartTotal = nonGiftItems.reduce(
        (sum, it) => sum + it.price * it.quantity - (it.discount ?? 0),
        0,
    );

    let updated = nonGiftItems.map((item) => {
        if ((item.discount ?? 0) > 0 && !item.isNew) {
            return item;
        }
        if (item.isCombo || item.isPrinted) {
            return { ...item, discount: 0, promotionName: null };
        }
        const promo = findBestDiscountPromotion(
            item.product,
            promotions,
            cartTotal,
            subcategoriesOfCategoryParam,
            selectedCategoryParam,
        );
        if (promo) {
            const disc = calculateLineDiscount(
                item.price,
                item.quantity,
                promo,
            );
            return {
                ...item,
                discount: disc,
                promotionName: promo.name,
            };
        }
        return { ...item, discount: 0, promotionName: null };
    });

    const nxmPromos = promotions.filter((p) => p.promotionType === "NXM");
    if (nxmPromos.length > 0) {
        const lines: CartLine[] = updated
            .map((item, idx) =>
                item.product
                    ? {
                          index: idx,
                          product: item.product,
                          unitPrice: item.price,
                          quantity: item.quantity,
                          isGift: false,
                      }
                    : null,
            )
            .filter(Boolean) as CartLine[];

        const freeSet = computeNxMFreeSet(
            lines,
            nxmPromos,
            subcategoriesOfCategoryParam,
            selectedCategoryParam,
        );
        freeSet.forEach(({ promoName, freeUnits }, idx) => {
            if (!updated[idx].isPrinted) {
                updated[idx] = {
                    ...updated[idx],
                    discount:
                        Math.round(updated[idx].price * freeUnits * 100) /
                        100,
                    promotionName: promoName,
                };
            }
        });
    }

    const newTotal = updated.reduce(
        (sum, it) => sum + it.price * it.quantity - (it.discount ?? 0),
        0,
    );
    const giftPromo = promotions.find(
        (p) =>
            p.promotionType === "GIFT" &&
            newTotal >= (p.minPurchaseAmount || 0) &&
            p.giftProduct,
    );
    const giftMessage = giftPromo
        ? `¡Regalo disponible! ${giftPromo.giftProduct?.name} × ${giftPromo.giftQuantity ?? 1} — ${giftPromo.name}`
        : null;

    if (giftPromo) {
        const giftItem = buildGiftOrderItem(giftPromo);
        if (giftItem) {
            return { items: [...updated, giftItem], giftMessage };
        }
    }

    return { items: updated, giftMessage };
}

function orderItemsPromoSnapshot(items: OrderItem[]): string {
    return items
        .map(
            (i) =>
                `${i.id}:${i.quantity}:${i.price}:${i.discount ?? 0}:${i.promotionName ?? ""}`,
        )
        .join("|");
}

/** Referencias estables: evitan que el modal de observaciones re-sincronice en cada render del padre (|| [] y new Set() nuevos pisaban la selección). */
const EMPTY_OBSERVATION_OPTIONS: any[] = [];
const EMPTY_SELECTED_OBSERVATION_IDS = new Set<string>();

/** Solo platos y bebidas activos (venta en salón; coincide con search_products sin ingredientes). */
function isOrderSearchProduct(p: {
    productType?: string | null;
    isActive?: boolean | null;
}) {
    if (p.isActive === false) return false;
    const t = p.productType;
    return t === "DISH" || t === "BEVERAGE" || t === "PROMOTION";
}

const Order: React.FC<OrderProps> = ({
    table,
    onClose,
    onSuccess,
    onOpenCash,
}) => {
    const {
        companyData,
        user,
        getDeviceId,
        getMacAddress,
        updateTableInContext,
        logout,
    } = useAuth();
    const { hasPermission } = useUserPermissions();
    const { breakpoint, width: viewportWidth } = useResponsive();
    const { sendMessage, disconnect } = useWebSocket();
    const { showToast } = useToast();
    const navigate = useNavigate();
    /** Claim fallido en servidor → mismo modal que en el plano (sin toast rojo). */
    const [claimSessionDenied, setClaimSessionDenied] = useState(false);
    const isExistingOrder =
        Boolean(table?.currentOperationId) ||
        table?.status === "OCCUPIED" ||
        table?.status === "TO_PAY";

    const userRoleUpper = user?.role?.toUpperCase() ?? "";
    const isMozo = userRoleUpper === "WAITER";
    const canNavigateToCashPay =
        userRoleUpper === "ADMIN" ||
        userRoleUpper === "CASHIER" ||
        userRoleUpper === "CAJA";

    // IGV de la sucursal (float). Por defecto 10.5% para sedes.
    const igvPercentageFromBranch =
        Number(companyData?.branch?.igvPercentage) || 10.5;

    // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil en grid)
    const isXs = breakpoint === "xs";
    const isSmall = breakpoint === "sm"; // 640px - 767px
    const isMobile = isXs || isSmall;
    const isMedium = breakpoint === "md"; // 768px - 1023px
    /** Teclado virtual: compacto en móvil/tablet (&lt; 1024); más denso en pantallas muy estrechas */
    const keyboardCompact = viewportWidth < 1024;
    const keyboardTight = viewportWidth < 480;

    // Valores para grid y breadcrumb (como en delivery.tsx)
    // Valores para grid y breadcrumb
    const gridMinCol = isXs
        ? "100px"
        : isSmall
          ? "110px"
          : isMedium
            ? "125px"
            : "150px";
    const gridGap = isXs
        ? "0.4rem"
        : isSmall
          ? "0.5rem"
          : isMedium
            ? "0.75rem"
            : "1rem";
    const gridPadding = isXs
        ? "0.5rem"
        : isSmall
          ? "0.6rem"
          : isMedium
            ? "0.8rem"
            : "1.25rem";
    const breadcrumbFontSize = isXs
        ? "0.7rem"
        : isSmall
          ? "0.75rem"
          : isMedium
            ? "0.875rem"
            : "1rem";
    /** Encabezado de navegación categorías: botones grandes para uso táctil en salón */
    const breadcrumbBtnMinH = isXs ? 44 : isSmall ? 48 : 52;
    const breadcrumbBtnFont = isXs
        ? "0.8rem"
        : isSmall
          ? "0.85rem"
          : "0.875rem";
    const breadcrumbBtnPadX = isXs ? "0.75rem" : isSmall ? "1rem" : "1.25rem";
    const breadcrumbBtnPadY = isXs
        ? "0.5rem"
        : isSmall
          ? "0.625rem"
          : "0.75rem";
    const breadcrumbBtnRadius = isXs ? "8px" : isSmall ? "10px" : "12px";
    /** Ancho máximo en migas de pan: más flexible para evitar recortes agresivos */
    const breadcrumbLabelMaxWidth = isXs
        ? "9rem"
        : isSmall
          ? "12rem"
          : isMedium
            ? "16rem"
            : "22rem";

    const sessionLockViewerDisplay = useMemo(
        () =>
            (user?.fullName || "").trim() ||
            `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
        [user?.firstName, user?.fullName, user?.lastName],
    );

    const orderRestrictedPayload =
        useMemo((): RestrictedModalPayload | null => {
            if (!user?.id || !table?.id) return null;

            // 1. Candado de sesión (prioridad técnica para evitar colisiones)
            if (
                shouldDenyTableEntryForSessionLock(
                    table,
                    user.id,
                    sessionLockViewerDisplay,
                )
            ) {
                return { table, kind: "session_lock" };
            }

            // 2. Si tiene permiso de pago, ignora la ocupación por otro mozo
            if (hasPermission("sales.pay")) return null;

            // 3. Ocupación por otro mozo
            if (!table.currentOperationId || !table.occupiedById) {
                return null;
            }

            const isMultiWaiterEnabled =
                companyData?.branch?.isMultiWaiterEnabled || false;
            if (isMultiWaiterEnabled) return null;

            if (String(table.occupiedById) === String(user.id)) return null;

            return { table, kind: "order_occupied" };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [
            companyData?.branch?.isMultiWaiterEnabled,
            sessionLockViewerDisplay,
            table,
            user?.id,
        ]);

    const tableAccessOk =
        Boolean(user?.id && table?.id) &&
        (hasPermission("sales.pay") || orderRestrictedPayload == null);

    useTableSessionLock({
        tableId: table?.id,
        userId: user?.id ? String(user.id) : undefined,
        enabled: Boolean(user?.id && table?.id && tableAccessOk),
        onLockDenied: () => setClaimSessionDenied(true),
    });

    const [selectedCategory, setSelectedCategory] = useState<string | null>(
        null,
    );
    const [selectedSubcategory, setSelectedSubcategory] = useState<
        string | null
    >(null);
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [searchByCodeOnly, setSearchByCodeOnly] = useState<boolean>(false);
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [initializedFromExistingOrder, setInitializedFromExistingOrder] =
        useState(false);
    const [productObservations, setProductObservations] = useState<
        Record<string, any[]>
    >({});
    const [, setLoadingObservations] = useState<Record<string, boolean>>({});
    const [selectedObservations, setSelectedObservations] = useState<
        Record<string, Set<string>>
    >({});
    const [, setHideObservationsSection] = useState<Record<string, boolean>>(
        {},
    );
    const [isSaving, setIsSaving] = useState(false);
    const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);
    const [isPrintingPrecuenta, setIsPrintingPrecuenta] = useState(false);
    const [showObservationModal, setShowObservationModal] = useState<
        string | null
    >(null);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    // NUEVO: Estados para promociones y combos
    const { data: promotionsData } = useQuery(GET_ACTIVE_PROMOTIONS, {
        variables: { branchId: companyData?.branch?.id },
        skip: !companyData?.branch?.id,
        fetchPolicy: "network-only",
    });

    const [activePromotions, setActivePromotions] = useState<IPromotion[]>([]);
    const [giftMessage, setGiftMessage] = useState<string | null>(null);
    const [showComboModal, setShowComboModal] = useState(false);
    const [pendingComboProduct, setPendingComboProduct] = useState<any>(null);

    const handleVirtualKeyPress = (key: string) => {
        setSearchTerm((prev) => prev + key);
    };

    const handleVirtualBackspace = () => {
        setSearchTerm((prev) => prev.slice(0, -1));
    };
    const orderListContainerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const lastTableIdRef = useRef<string | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Mutación para crear la operación
    const [createOperationMutation] = useMutation(CREATE_OPERATION);
    const [addItemsToOperationMutation] = useMutation(ADD_ITEMS_TO_OPERATION);
    const [updateTableStatusMutation] = useMutation(UPDATE_TABLE_STATUS);
    const [printPrecuentaMutation] = useMutation(PRINT_PRECUENTA);
    const [releaseTableSessionLockMutation] = useMutation(
        RELEASE_TABLE_SESSION_LOCK,
    );

    const completeOrderSave = useCallback(
        async (payload?: OrderSuccessPayload) => {
            if (onSuccess) {
                onSuccess(payload);
            }

            if (isMozo) {
                const tableId = table?.id;
                const userId = user?.id ? String(user.id) : undefined;
                if (tableId && userId && isTableSessionLockApiEnabled()) {
                    try {
                        await releaseTableSessionLockImmediately(
                            releaseTableSessionLockMutation,
                            tableId,
                            userId,
                        );
                    } catch (error) {
                        console.error(
                            "Error al liberar candado de mesa del mozo:",
                            error,
                        );
                    }
                }
                onClose();
                disconnect();
                logout();
                navigate("/login-employee", { replace: true });
                return;
            }

            setTimeout(() => {
                onClose();
            }, 500);
        },
        [
            onSuccess,
            onClose,
            isMozo,
            table?.id,
            user?.id,
            releaseTableSessionLockMutation,
            disconnect,
            logout,
            navigate,
        ],
    );

    // Categorías sin subcategorías anidadas (menos peso al abrir mesa)
    const { data: categoriesData, loading: categoriesLoading } = useQuery(
        GET_CATEGORIES_BY_BRANCH_LIGHT,
        {
            variables: { branchId: companyData?.branch.id },
            skip: !companyData?.branch.id,
            fetchPolicy: "network-only",
        },
    );

    const categories = categoriesData?.categoriesByBranch || [];

    const { data: subcategoriesData, loading: subcategoriesLoading } = useQuery(
        GET_SUBCATEGORIES_BY_CATEGORY,
        {
            variables: { categoryId: selectedCategory || "" },
            skip: !companyData?.branch.id || !selectedCategory,
            fetchPolicy: "network-only",
        },
    );

    const subcategoriesOfCategory = useMemo(
        () =>
            selectedCategory
                ? (subcategoriesData?.subcategoriesByCategory || []).filter(
                      (s: any) => s.isActive !== false,
                  )
                : [],
        [selectedCategory, subcategoriesData?.subcategoriesByCategory],
    );

    const promotionRecalcKey = useMemo(
        () =>
            [
                activePromotions.map((p) => p.id).join(","),
                selectedCategory ?? "",
                subcategoriesOfCategory.map((s: any) => s.id).join(","),
            ].join("|"),
        [activePromotions, selectedCategory, subcategoriesOfCategory],
    );

    const lastPromotionRecalcKeyRef = useRef("");

    const commitOrderItems = useCallback(
        (items: OrderItem[]) => {
            const { items: nextItems, giftMessage: nextGiftMessage } =
                applyPromotionsToOrder(
                    items,
                    activePromotions,
                    subcategoriesOfCategory,
                    selectedCategory,
                );
            setGiftMessage(nextGiftMessage);
            setOrderItems((prev) => {
                if (
                    orderItemsPromoSnapshot(prev) ===
                    orderItemsPromoSnapshot(nextItems)
                ) {
                    return prev;
                }
                return nextItems;
            });
        },
        [activePromotions, subcategoriesOfCategory, selectedCategory],
    );

    /** Hay subs pero el usuario aún no eligió una: mostrar grid de subs, no productos. */
    const awaitingSubcategoryPick =
        Boolean(selectedCategory) &&
        !subcategoriesLoading &&
        subcategoriesOfCategory.length > 0 &&
        !selectedSubcategory;

    // Búsqueda de productos (si hay término de búsqueda) - siempre del servidor
    // Cuando searchByCodeOnly: usar product_by_code (backend). Si no: searchProducts con 3+ caracteres.
    const searchMinLength = searchByCodeOnly ? 1 : 3;
    const { data: searchData, loading: searchLoading } = useQuery(
        SEARCH_PRODUCTS,
        {
            variables: {
                search: searchTerm.trim(),
                branchId: companyData?.branch.id,
                limit: 50,
            },
            skip:
                !companyData?.branch.id ||
                searchByCodeOnly ||
                searchTerm.trim().length < searchMinLength,
            errorPolicy: "ignore",
            fetchPolicy: "network-only",
        },
    );

    // Búsqueda solo por código: usa product_by_code del backend (insensible a mayúsculas)
    const { data: productByCodeData, loading: productByCodeLoading } = useQuery(
        GET_PRODUCT_BY_CODE,
        {
            variables: {
                branchId: companyData?.branch.id,
                code: searchTerm.trim(),
            },
            skip:
                !companyData?.branch.id ||
                !searchByCodeOnly ||
                !searchTerm.trim(),
            errorPolicy: "ignore",
            fetchPolicy: "network-only",
        },
    );

    // Obtener productos por categoría (siempre del servidor para ver precios actualizados)
    const { data: productsByCategoryData, loading: productsByCategoryLoading } =
        useQuery(GET_PRODUCTS_BY_CATEGORY, {
            variables: { categoryId: selectedCategory },
            skip:
                !selectedCategory ||
                searchByCodeOnly ||
                searchTerm.length >= 3 ||
                subcategoriesLoading ||
                awaitingSubcategoryPick,
            fetchPolicy: "network-only",
        });

    // Query lazy para obtener observaciones de una subcategoría (siempre del servidor)
    const [getObservations] = useLazyQuery(GET_MODIFIERS_BY_SUBCATEGORY, {
        fetchPolicy: "network-only",
    });

    // Cambiar la lógica para que sea como en cashPay.tsx: solo depende de mesa y branch, NO de currentOperationId
    // Esto permite que el refetch funcione correctamente después de actualizar la mesa
    const hasSelection = Boolean(table?.id && companyData?.branch.id);

    // Si no hay currentOperationId en la mesa pero el estado es OCCUPIED o TO_PAY,
    // intentamos buscar por mesa
    const shouldUseId = Boolean(table?.currentOperationId);

    const {
        data: existingOperationData,
        loading: existingOperationLoading,
        error: existingOperationError,
        refetch: refetchExistingOperation,
    } = useQuery(shouldUseId ? GET_OPERATION_BY_ID : GET_OPERATION_BY_TABLE, {
        variables: shouldUseId
            ? { operationId: table.currentOperationId }
            : {
                  tableId: table?.id || "",
                  branchId: companyData?.branch.id || "",
              },
        skip: !hasSelection,
        fetchPolicy: "network-only",
    });

    // Determinar qué productos mostrar según la selección
    let products;
    let productsLoading;

    if (searchByCodeOnly && searchTerm.trim().length >= 1) {
        // Búsqueda solo por código: soporta productByCode (camelCase) y product_by_code (snake_case según backend)
        const p =
            productByCodeData?.productByCode ??
            productByCodeData?.product_by_code;
        products = p && isOrderSearchProduct(p) ? [p] : [];
        productsLoading = productByCodeLoading;
    } else if (searchTerm.length >= 3) {
        // Prioridad 1: Búsqueda avanzada (del servidor): solo platos/bebidas activos
        const raw = searchData?.searchProducts;
        products = Array.isArray(raw) ? raw.filter(isOrderSearchProduct) : raw;
        productsLoading = searchLoading;
    } else if (selectedCategory) {
        if (subcategoriesLoading || awaitingSubcategoryPick) {
            products = [];
            productsLoading = subcategoriesLoading || productsByCategoryLoading;
        } else {
            products = productsByCategoryData?.productsByCategory;
            productsLoading = productsByCategoryLoading;
        }
    } else {
        products = [];
        productsLoading = false;
    }

    // Misma regla que en búsqueda: solo platos/bebidas activos (navegación por categoría antes no filtraba isActive)
    let productsList = (products || []).filter(isOrderSearchProduct);
    // Filtrar por subcategoría solo cuando se navega por categorías (NO cuando se busca por código)
    if (
        !(searchByCodeOnly && searchTerm.trim().length >= 1) &&
        selectedCategory &&
        selectedSubcategory &&
        productsList.length > 0
    ) {
        productsList = productsList.filter(
            (p: any) => String(p.subcategoryId) === String(selectedSubcategory),
        );
    }

    // Subcategorías ya vienen de GET_SUBCATEGORIES_BY_CATEGORY (subcategoriesOfCategory arriba)

    // Navegación como en delivery: mostrar categorías, subcategorías o productos en el grid
    const isSearching = searchByCodeOnly
        ? searchTerm.trim().length >= 1
        : searchTerm.length >= 3;
    const showCategoriesInGrid = !isSearching && !selectedCategory;
    const showSubcategoriesInGrid =
        !isSearching &&
        selectedCategory &&
        !selectedSubcategory &&
        (subcategoriesLoading || subcategoriesOfCategory.length > 0);
    const showProductsInGrid =
        isSearching ||
        (selectedCategory &&
            !subcategoriesLoading &&
            !awaitingSubcategoryPick &&
            (selectedSubcategory || subcategoriesOfCategory.length === 0));
    // Función para parsear promoInfo y extraer discount y promotionName
    const parsePromoInfo = (
        promoInfo: string | null | undefined,
    ): { discount: number; promotionName: string | null } => {
        console.log("[parsePromoInfo] Input promoInfo:", promoInfo);
        if (!promoInfo) {
            console.log("[parsePromoInfo] No promoInfo, returning default");
            return { discount: 0, promotionName: null };
        }
        try {
            const parsed = JSON.parse(promoInfo);
            console.log("[parsePromoInfo] Parsed successfully:", parsed);
            return {
                discount:
                    typeof parsed.discount === "number" ? parsed.discount : 0,
                promotionName: parsed.promotionName || null,
            };
        } catch (e) {
            console.warn("Error parsing promoInfo:", e);
            return { discount: 0, promotionName: null };
        }
    };
    /** Una sola sub activa → pasar directo a productos filtrados por esa sub */
    useEffect(() => {
        if (!selectedCategory || subcategoriesLoading) return;
        const subs = (subcategoriesData?.subcategoriesByCategory || []).filter(
            (s: any) => s.isActive !== false,
        );
        if (subs.length === 1) {
            setSelectedSubcategory(String(subs[0].id));
        }
    }, [
        selectedCategory,
        subcategoriesLoading,
        subcategoriesData?.subcategoriesByCategory,
    ]);

    useEffect(() => {
        // Solo resetear si realmente es una mesa diferente
        if (table?.id && lastTableIdRef.current !== table.id) {
            // Resetear todo cuando cambia la mesa
            setOrderItems([]);
            setInitializedFromExistingOrder(false);
            setProductObservations({});
            setSelectedObservations({});
            setHideObservationsSection({});
            lastTableIdRef.current = table.id;
        }
    }, [table?.id]);

    // Efecto adicional para resetear cuando se abre la orden de nuevo (cuando cambia currentOperationId)
    useEffect(() => {
        if (isExistingOrder && table?.currentOperationId) {
            // Si hay una orden existente, resetear el flag para que se carguen los productos
            setInitializedFromExistingOrder(false);
        }
    }, [table?.currentOperationId, isExistingOrder]);

    // NUEVO: Cargar promociones activas
    useEffect(() => {
        if (promotionsData?.activePromotions) {
            setActivePromotions(promotionsData.activePromotions);
        }
    }, [promotionsData]);

    // Recalcular carrito solo cuando cambian promociones / categoría (no en cada render)
    useEffect(() => {
        if (lastPromotionRecalcKeyRef.current === promotionRecalcKey) {
            return;
        }
        lastPromotionRecalcKeyRef.current = promotionRecalcKey;

        if (activePromotions.length === 0) {
            setGiftMessage(null);
            setOrderItems((prev) => {
                if (!prev.some((item) => item.id === GIFT_ITEM_ID)) {
                    return prev;
                }
                return prev.filter((item) => item.id !== GIFT_ITEM_ID);
            });
            return;
        }

        setOrderItems((prev) => {
            if (prev.length === 0) return prev;
            const { items, giftMessage: nextGiftMessage } =
                applyPromotionsToOrder(
                    prev,
                    activePromotions,
                    subcategoriesOfCategory,
                    selectedCategory,
                );
            setGiftMessage(nextGiftMessage);
            if (
                orderItemsPromoSnapshot(prev) ===
                orderItemsPromoSnapshot(items)
            ) {
                return prev;
            }
            return items;
        });
    }, [
        promotionRecalcKey,
        activePromotions,
        subcategoriesOfCategory,
        selectedCategory,
    ]);

    useEffect(() => {
        // Solo cargar items si hay una selección válida y no se ha inicializado ya
        if (!hasSelection || initializedFromExistingOrder) {
            return;
        }

        if (existingOperationLoading) {
            return;
        }

        // // ✅ LOG: Ver qué query se usó y qué datos llegaron
        // console.log("[Order] ========== EXISTING OPERATION DATA ==========");
        // console.log("[Order] shouldUseId:", shouldUseId);
        // console.log(
        //     "[Order] table.currentOperationId:",
        //     table.currentOperationId,
        // );
        // console.log(
        //     "[Order] existingOperationData:",
        //     JSON.stringify(existingOperationData, null, 2),
        // );

        const operation =
            existingOperationData?.operationByTable ||
            existingOperationData?.operationById;

        // console.log(
        //     "[Order] Extracted operation:",
        //     operation
        //         ? {
        //               id: operation.id,
        //               order: operation.order,
        //               status: operation.status,
        //               detailsCount: operation.details?.length || 0,
        //           }
        //         : "NO OPERATION FOUND",
        // );

        // Si no hay operación, marcar como inicializado pero no cargar items
        if (!operation) {
            // console.log("[Order] No operation found, marking as initialized");
            setInitializedFromExistingOrder(true);
            return;
        }
        // console.log("[Order] isExistingOrder:", isExistingOrder);
        // Solo cargar items si realmente hay una operación existente (isExistingOrder)
        // Esto evita cargar items cuando es una nueva orden
        if (!isExistingOrder) {
            // console.log(
            //     "[Order] Not an existing order (isExistingOrder false), skipping item load",
            // );
            setInitializedFromExistingOrder(true);
            return;
        }

        // console.log(
        //     "[Order] Processing",
        //     operation.details?.length,
        //     "details from operation",
        // );

        // // ✅ LOG: Mostrar el primer detalle para ver si tiene promoInfo
        // if (operation.details && operation.details.length > 0) {
        //     console.log(
        //         "[Order] First detail sample:",
        //         JSON.stringify(operation.details[0], null, 2),
        //     );
        //     console.log(
        //         "[Order] promoInfo in first detail:",
        //         operation.details[0].promoInfo,
        //     );
        // }

        const mappedItems: OrderItem[] = (operation.details || []).map(
            (detail: any) => {
                // console.log(
                //     `[Order] 🔍 MAPPING DETAIL ${detail.id}:`,
                //     detail.productName,
                // );

                const rawQuantity = Number(detail.quantity) || 0;
                const safeQuantity = rawQuantity > 0 ? rawQuantity : 1;
                const rawTotal = Number(detail.total) || 0;
                let unitPrice = Number(detail.unitPrice);
                if (!unitPrice && rawTotal && safeQuantity) {
                    unitPrice = rawTotal / safeQuantity;
                }
                const safeUnitPrice = unitPrice || 0;
                const computedTotal = rawTotal || safeUnitPrice * safeQuantity;

                // Intentar obtener el subcategoryId del producto desde la lista de productos cargados
                const fullProduct = productsList.find(
                    (p: any) => p.id === String(detail.productId),
                );
                // ENRIQUECER EL PRODUCTO CON SU CATEGORÍA (incl. stock desde la operación)
                let enrichedProduct = fullProduct
                    ? { ...fullProduct }
                    : detail.product
                      ? { ...detail.product }
                      : detail.productId
                        ? {
                              id: String(detail.productId),
                              name: detail.productName,
                              productType: detail.productType,
                          }
                        : null;
                if (enrichedProduct && detail.product) {
                    enrichedProduct.currentStock =
                        detail.product.currentStock ??
                        enrichedProduct.currentStock;
                    enrichedProduct.managesStock =
                        detail.product.managesStock ??
                        enrichedProduct.managesStock;
                }
                if (
                    enrichedProduct &&
                    enrichedProduct.subcategoryId &&
                    !enrichedProduct.subcategory
                ) {
                    // Buscar la subcategoría completa
                    const subcategory = subcategoriesOfCategory.find(
                        (s: any) => s.id === enrichedProduct.subcategoryId,
                    );
                    if (subcategory) {
                        enrichedProduct.subcategory = subcategory;
                        // También añadir categoryId directamente para fácil acceso
                        if (subcategory.category) {
                            enrichedProduct.categoryId =
                                subcategory.category.id;
                        }
                    }
                }
                const subcategoryId = fullProduct?.subcategoryId;
                // Extraer descuento de promoInfo
                const { discount, promotionName } = parsePromoInfo(
                    detail.promoInfo,
                );

                // ✅ LOG CRÍTICO: Ver qué se está extrayendo
                console.log(
                    `[Order] 📊 Detail ${detail.id} (${detail.productName}):`,
                    {
                        promoInfoRaw: detail.promoInfo,
                        parsedDiscount: discount,
                        parsedPromotionName: promotionName,
                    },
                );

                // Verificar si es un ítem de regalo
                const isGiftFromBackend =
                    promotionName &&
                    (promotionName.includes("REGALO") ||
                        (safeUnitPrice === 0 && total === 0));
                const mappedItem = {
                    id: isGiftFromBackend
                        ? GIFT_ITEM_ID
                        : String(
                              detail.id ??
                                  `${detail.productId}-${Date.now()}-${Math.random()}`,
                          ),
                    productId: String(detail.productId ?? ""),
                    name: detail.productName || "Producto sin nombre",
                    price: safeUnitPrice,
                    quantity: safeQuantity,
                    total: computedTotal,
                    isNew: false,
                    notes: typeof detail.notes === "string" ? detail.notes : "",
                    subcategoryId: subcategoryId,
                    isPrinted: detail.isPrinted,
                    printedAt: detail.printedAt,
                    discount: discount,
                    promotionName: promotionName,
                    isCombo: detail.productType === "PROMOTION",
                    comboComponents:
                        detail.comboComponents?.length > 0
                            ? detail.comboComponents.map((comp: any) => ({
                                  scopeId: comp.id,
                                  product: comp.product
                                      ? { ...comp.product }
                                      : {
                                            id: comp.productId,
                                            name: comp.productName,
                                        },
                                  quantity: comp.quantity,
                              }))
                            : undefined,
                    product: fullProduct,
                };

                console.log(`[Order] ✅ Mapped item ${detail.id}:`, {
                    name: mappedItem.name,
                    discount: mappedItem.discount,
                    promotionName: mappedItem.promotionName,
                });

                return mappedItem;
            },
        );

        console.log(
            "[Order] Mapped items with discounts from backend:",
            mappedItems.map((i) => ({
                name: i.name,
                discount: i.discount,
                promotionName: i.promotionName,
            })),
        );

        // Preservar los items nuevos que aún no se han guardado en el servidor
        const newItems = orderItems.filter((item) => item.isNew);
        const finalItems = [...mappedItems, ...newItems];

        commitOrderItems(finalItems);
        setInitializedFromExistingOrder(true);
        // Ocultar las observaciones por defecto cuando se carga una orden existente
        const hideObservations: Record<string, boolean> = {};
        mappedItems.forEach((item) => {
            if (item.id) {
                hideObservations[item.id] = true;
            }
        });
        setHideObservationsSection(hideObservations);
        setProductObservations({});
        setSelectedObservations({});
    }, [
        hasSelection,
        isExistingOrder,
        existingOperationData,
        existingOperationLoading,
        initializedFromExistingOrder,
        orderItems,
        productsList,
    ]);

    const existingOperation =
        existingOperationData?.operationByTable ||
        existingOperationData?.operationById;
    // Solo mostrar loading si hay selección, hay una orden existente, está cargando y no se ha inicializado
    const isLoadingExistingOrder =
        hasSelection &&
        isExistingOrder &&
        existingOperationLoading &&
        !initializedFromExistingOrder;

    const resolvedFloorName = useMemo(() => {
        if (table.floorName) return table.floorName;
        const floors = companyData?.branch?.floors;
        if (!floors?.length || !table?.id) return null;
        for (const f of floors) {
            if (f.tables?.some((t) => String(t.id) === String(table.id)))
                return f.name;
        }
        return null;
    }, [table.floorName, table.id, companyData?.branch?.floors]);

    const waiterDisplayName =
        existingOperation?.user?.fullName ||
        table.userName ||
        (isLoadingExistingOrder ? "..." : null);

    /** Encabezado: orden existente → mozo de la operación; orden nueva → usuario actual o mesa ocupada. */
    const headerWaiterName =
        (isExistingOrder
            ? waiterDisplayName
            : user?.fullName || table.userName || null) ?? null;

    // Función para agregar producto a la orden
    const handleAddProduct = (productIdToAdd?: string, qtyToAdd?: number) => {
        const productId = productIdToAdd || selectedProduct;
        if (!productId) return;

        const product = productsList.find((p: any) => p.id === productId);
        if (!product) return;

        // NUEVO: Si es un combo (PROMOTION), abrir modal para seleccionar componentes
        if (product.productType === "PROMOTION" && product.asPromotion) {
            setPendingComboProduct(product);
            setShowComboModal(true);
            return;
        }

        // Precio: permite 0 (cortesía/promo); rechaza negativos y no numéricos
        const rawPrice = parseFloat(String(product.salePrice));
        const productPrice = Number.isFinite(rawPrice) ? rawPrice : 0;
        if (
            productPrice < 0 ||
            (String(product.salePrice ?? "").trim() !== "" &&
                !Number.isFinite(rawPrice))
        ) {
            showToast(
                `El producto "${product.name}" no tiene un precio válido`,
                "error",
            );
            return;
        }

        const qty = qtyToAdd ?? 1;

        const stockRunning = buildCartStockUsage(orderItems);
        const stockCheck = canAddProductQuantity(product, qty, stockRunning);
        if (!stockCheck.ok) {
            showToast(stockCheck.message ?? "Sin stock disponible", "error");
            return;
        }

        // ENRIQUECER EL PRODUCTO CON SU CATEGORÍA
        let enrichedProduct = { ...product };
        if (enrichedProduct.subcategoryId && !enrichedProduct.subcategory) {
            // Buscar la subcategoría en subcategoriesOfCategory
            const subcategory = subcategoriesOfCategory.find(
                (s: any) => s.id === enrichedProduct.subcategoryId,
            );
            if (subcategory) {
                enrichedProduct.subcategory = subcategory;
                if (subcategory.category) {
                    enrichedProduct.categoryId = subcategory.category.id;
                }
            }
        }
        const newItem: OrderItem = {
            id: `${product.id}-${Date.now()}`,
            productId: product.id,
            name: product.name,
            price: productPrice,
            quantity: qty,
            total: productPrice * qty,
            isNew: true,
            notes: "",
            subcategoryId: product.subcategoryId,
            product: enrichedProduct, // Usar el producto enriquecido
        };

        if (isExistingOrder) {
            // En órdenes existentes:
            // - Si hay un item nuevo (sin guardar) con el mismo producto, aumentar su cantidad
            // - Si solo hay items guardados o no existe, crear una nueva fila
            const existingNewItemIndex = orderItems.findIndex(
                (item) => item.productId === product.id && item.isNew === true,
            );

            if (existingNewItemIndex >= 0) {
                // Si existe un item nuevo con el mismo producto, aumentar su cantidad
                const updatedItems = [...orderItems];
                const existingItem = updatedItems[existingNewItemIndex];
                const validQuantity = Number(existingItem.quantity) + qty;
                const validPrice = Number(existingItem.price) || productPrice;
                updatedItems[existingNewItemIndex].quantity = validQuantity;
                updatedItems[existingNewItemIndex].total =
                    validPrice * validQuantity;
                commitOrderItems(updatedItems);
                setLastAddedItemId(existingItem.id);
            } else {
                // Si no hay un item nuevo, crear una nueva fila (no afecta items guardados)
                commitOrderItems([...orderItems, newItem]);
                setLastAddedItemId(newItem.id);
            }
        } else {
            // Para nuevas órdenes, agrupar productos por productId (aumentar cantidad si existe)
            const existingItemIndex = orderItems.findIndex(
                (item) => item.productId === product.id,
            );

            if (existingItemIndex >= 0) {
                // Si el producto ya existe, aumentar la cantidad
                const updatedItems = [...orderItems];
                const existingItem = updatedItems[existingItemIndex];
                const validQuantity = Number(existingItem.quantity) + qty;
                const validPrice = Number(existingItem.price) || productPrice;
                updatedItems[existingItemIndex].quantity = validQuantity;
                updatedItems[existingItemIndex].total =
                    validPrice * validQuantity;
                updatedItems[existingItemIndex].isNew = true;
                commitOrderItems(updatedItems);
                setLastAddedItemId(existingItem.id);
            } else {
                // Si el producto no existe, agregarlo como nueva fila
                commitOrderItems([...orderItems, newItem]);
                setLastAddedItemId(newItem.id);
            }
        }

        // Limpiar búsqueda y selección al agregar producto
        setSearchTerm("");
        if (!productIdToAdd) {
            setSelectedProduct(null);
        }
    };

    // Función para cambiar cantidad de un ítem
    const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
        const targetItem = orderItems.find((item) => item.id === itemId);
        if (!targetItem) {
            return;
        }

        if (isExistingOrder && !targetItem.isNew) {
            return;
        }

        if (newQuantity <= 0) {
            handleRemoveItem(itemId);
            return;
        }

        const stockCheck = canSetItemQuantity(targetItem, newQuantity, orderItems);
        if (!stockCheck.ok) {
            showToast(stockCheck.message ?? "Sin stock disponible", "error");
            return;
        }

        const updatedItems = orderItems.map((item) => {
            if (item.id === itemId) {
                const validQuantity = Number(newQuantity) || 1;
                const validPrice = Number(item.price) || 0;
                return {
                    ...item,
                    quantity: validQuantity,
                    total: validPrice * validQuantity,
                };
            }
            return item;
        });
        commitOrderItems(updatedItems);
    };

    // Función para eliminar ítem
    const handleRemoveItem = (itemId: string) => {
        const targetItem = orderItems.find((item) => item.id === itemId);
        if (!targetItem) {
            return;
        }

        if (isExistingOrder && !targetItem.isNew) {
            return;
        }

        commitOrderItems(orderItems.filter((item) => item.id !== itemId));
    };

    // NUEVO: Handler para agregar combos
    const handleAddCombo = (combo: any, components: any[]) => {
        const stockRunning = buildCartStockUsage(orderItems);
        const stockCheck = canAddComboQuantity(
            combo.name ?? "Combo",
            components.map((c: any) => ({
                product: c.product,
                quantity: c.quantity,
            })),
            1,
            stockRunning,
        );
        if (!stockCheck.ok) {
            showToast(stockCheck.message ?? "Sin stock disponible", "error");
            return;
        }

        const newItem: OrderItem = {
            id: `combo-${combo.id}-${Date.now()}`,
            productId: combo.id,
            name: combo.name,
            price: combo.salePrice,
            quantity: 1,
            total: combo.salePrice,
            isNew: true,
            notes: "",
            subcategoryId: undefined,
            product: combo,
            isCombo: true,
            comboComponents: components,
            discount: 0,
        };
        commitOrderItems([...orderItems, newItem]);
        setShowComboModal(false);
        setPendingComboProduct(null);
    };

    // Función para abrir el modal de observaciones (carga las observaciones si es necesario)
    const handleOpenObservationModal = async (itemId: string) => {
        const item = orderItems.find((i) => i.id === itemId);
        if (!item) return;

        // Si hay subcategoryId y no se han cargado las observaciones, cargarlas primero
        if (item.subcategoryId && !productObservations[itemId]) {
            setLoadingObservations((prev) => ({ ...prev, [itemId]: true }));
            try {
                const { data } = await getObservations({
                    variables: { subcategoryId: item.subcategoryId },
                });
                if (data?.notesBySubcategory) {
                    const activeObservations = data.notesBySubcategory.filter(
                        (m: any) => m.isActive,
                    );
                    setProductObservations((prev) => ({
                        ...prev,
                        [itemId]: activeObservations,
                    }));

                    // Inicializar observaciones seleccionadas basándose en las notas actuales del item
                    if (item.notes) {
                        const currentNotes = item.notes
                            .split(", ")
                            .map((n) => n.trim());
                        const selectedIds = new Set<string>();
                        activeObservations.forEach((obs: any) => {
                            if (currentNotes.includes(obs.note)) {
                                selectedIds.add(obs.id);
                            }
                        });
                        if (selectedIds.size > 0) {
                            setSelectedObservations((prev) => ({
                                ...prev,
                                [itemId]: selectedIds,
                            }));
                        }
                    }
                }
            } catch (error) {
                console.error("Error al obtener observaciones:", error);
            } finally {
                setLoadingObservations((prev) => ({
                    ...prev,
                    [itemId]: false,
                }));
            }
        }

        // Abrir el modal
        setShowObservationModal(itemId);
    };

    // Función para aplicar observaciones desde el modal
    const handleApplyObservations = (
        itemId: string,
        selectedIds: Set<string>,
        manualNotes: string,
    ) => {
        const item = orderItems.find((i) => i.id === itemId);
        if (!item || (isExistingOrder && !item.isNew)) {
            return;
        }

        // Actualizar las observaciones seleccionadas
        setSelectedObservations((prev) => ({
            ...prev,
            [itemId]: selectedIds,
        }));

        // En el nuevo flujo de ModalObservation, manualNotes ya contiene el texto completo
        // (incluyendo las etiquetas seleccionadas y notas manuales) debidamente formateado.
        const finalNotes = manualNotes.trim();

        setOrderItems((items) =>
            items.map((i) => {
                if (i.id !== itemId) {
                    return i;
                }
                return {
                    ...i,
                    notes: finalNotes,
                };
            }),
        );

        // Ocultar la sección de observaciones cuando se selecciona al menos una
        if (selectedIds.size > 0) {
            setHideObservationsSection((prev) => ({
                ...prev,
                [itemId]: true,
            }));
        } else {
            // Si no hay observaciones seleccionadas, mostrar la sección de nuevo
            setHideObservationsSection((prev) => ({
                ...prev,
                [itemId]: false,
            }));
        }
    };

    // Efecto para hacer scroll automático al agregar un producto
    useEffect(() => {
        if (
            lastAddedItemId &&
            itemRefs.current[lastAddedItemId] &&
            orderListContainerRef.current
        ) {
            const itemElement = itemRefs.current[lastAddedItemId];
            const container = orderListContainerRef.current;

            // Pequeño delay para asegurar que el DOM se haya actualizado
            setTimeout(() => {
                if (itemElement && container) {
                    const itemTop = itemElement.offsetTop;
                    const itemHeight = itemElement.offsetHeight;
                    const containerTop = container.scrollTop;
                    const containerHeight = container.clientHeight;

                    // Verificar si el item está fuera de la vista
                    if (
                        itemTop < containerTop ||
                        itemTop + itemHeight > containerTop + containerHeight
                    ) {
                        // Hacer scroll suave hasta el item
                        itemElement.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                            inline: "nearest",
                        });
                    }
                }
            }, 100);

            // Limpiar el ID después de hacer scroll
            setTimeout(() => setLastAddedItemId(null), 500);
        }
    }, [lastAddedItemId, orderItems]);

    // Calcular totales CON descuentos aplicados
    const orderItemsTotal = orderItems.reduce((sum, item) => {
        const itemTotal = Number(item.total) || 0;
        const itemDiscount = Number(item.discount) || 0;
        // El total del item ya incluye el precio × cantidad, pero el descuento es aparte
        // Restamos el descuento para obtener el monto real a pagar por ese item
        return sum + (itemTotal - itemDiscount);
    }, 0);

    // Calcular IGV basado en el total con descuento
    const igvPercentageDecimal = igvPercentageFromBranch / 100;
    const calculatedSubtotal = parseFloat(
        (
            Math.round((orderItemsTotal / (1 + igvPercentageDecimal)) * 100) /
            100
        ).toFixed(2),
    );
    const calculatedIgvAmount = parseFloat(
        (
            Math.round((orderItemsTotal - calculatedSubtotal) * 100) / 100
        ).toFixed(2),
    );

    // Para órdenes existentes, usar los valores calculados (con descuento) en lugar de los del backend
    const subtotal = calculatedSubtotal;
    const taxes = calculatedIgvAmount;
    const total = orderItemsTotal;

    // Función para guardar la orden (shouldPrint: true = enviar a imprimir, false = solo enviar a cocina)
    const handleSaveOrder = async (
        status: string = "PROCESSING",
        shouldPrint: boolean = true,
    ) => {
        const itemsToProcess = isExistingOrder
            ? orderItems.filter((item) => item.isNew)
            : orderItems;

        if (itemsToProcess.length === 0) {
            const message = isExistingOrder
                ? "Debe agregar al menos un producto nuevo a la orden"
                : "Debe agregar al menos un producto a la orden";
            showToast(message, "error");
            return;
        }

        if (!companyData?.branch.id) {
            showToast("No se encontró información de la sucursal", "error");
            return;
        }

        setIsSaving(true);

        try {
            const invalidItems = itemsToProcess.filter((item) => {
                const p = Number(item.price);
                const q = Number(item.quantity);
                return (
                    !Number.isFinite(p) ||
                    p < 0 ||
                    !Number.isFinite(q) ||
                    q <= 0
                );
            });

            if (invalidItems.length > 0) {
                showToast(
                    "Algunos productos tienen valores inválidos. Por favor, verifique los precios y cantidades.",
                    "error",
                );
                return;
            }

            if (isExistingOrder) {
                const operationId =
                    existingOperation?.id || table?.currentOperationId;
                if (!operationId) {
                    showToast(
                        "No se encontró la operación activa para esta mesa.",
                        "error",
                    );
                    return;
                }

                const igvPercentageValue =
                    typeof existingOperation?.igvPercentage === "number"
                        ? existingOperation.igvPercentage
                        : igvPercentageFromBranch;
                const igvRate =
                    igvPercentageValue > 0 ? igvPercentageValue / 100 : 0;

                const details = itemsToProcess.map((item) => {
                    const unitPrice = parseFloat(
                        (Math.round(item.price * 100) / 100).toFixed(2),
                    );
                    const quantity = Math.max(1, Number(item.quantity) || 1);
                    const unitValue =
                        igvRate > 0
                            ? parseFloat(
                                  (
                                      Math.round(
                                          (unitPrice / (1 + igvRate)) * 100,
                                      ) / 100
                                  ).toFixed(2),
                              )
                            : unitPrice;
                    const notes =
                        typeof item.notes === "string" ? item.notes.trim() : "";

                    return {
                        productId: String(item.productId),
                        quantity,
                        unitMeasure: "NIU",
                        unitValue,
                        unitPrice,
                        promoInfo:
                            item.promotionName || (item.discount ?? 0) > 0
                                ? JSON.stringify({
                                      discount: item.discount ?? 0,
                                      promotionName: item.promotionName ?? null,
                                  })
                                : null,
                        comboComponents:
                            item.isCombo && item.comboComponents
                                ? item.comboComponents.map((comp: any) => ({
                                      productId: comp.product.id,
                                      quantity: comp.quantity,
                                  }))
                                : undefined,
                        notes,
                    };
                });

                let deviceIdForMutation = "";
                if (shouldPrint) {
                    deviceIdForMutation = await resolveClientDeviceIdForPrint({
                        getMacAddress,
                        getDeviceId,
                        logPrefix: "[Order/addItems]",
                    });
                }

                const addItemsVariables = {
                    operationId,
                    details,
                    deviceId: deviceIdForMutation,
                    userId: user?.id ? String(user.id) : null,
                };
                console.log("[AddItemsToOperation] resumen:", {
                    operationId: addItemsVariables.operationId,
                    userId: addItemsVariables.userId,
                    userIdEnviado: addItemsVariables.userId != null,
                    cantidadDetalles: details.length,
                    deviceIdPresente: Boolean(
                        String(addItemsVariables.deviceId || "").trim(),
                    ),
                });

                const result = await addItemsToOperationMutation({
                    variables: addItemsVariables,
                });

                if (result.data?.addItemsToOperation?.success) {
                    const addMsg =
                        result.data?.addItemsToOperation?.message;
                    if (isStockWarningMessage(addMsg)) {
                        showToast(addMsg!, "warning");
                    }

                    setInitializedFromExistingOrder(false);
                    try {
                        await refetchExistingOperation();
                    } catch (refetchError) {
                        console.error(
                            "Error al refrescar la operación después de agregar ítems:",
                            refetchError,
                        );
                    }

                    await completeOrderSave({
                        operationId: existingOperation?.id ?? operationId,
                        operationDate:
                            existingOperation?.operationDate ?? null,
                    });
                } else {
                    throw new Error(
                        result.data?.addItemsToOperation?.message ||
                            "Error al agregar los productos a la orden existente",
                    );
                }

                return;
            }

            // Preparar los detalles de la operación para una nueva orden
            const details = itemsToProcess.map((item) => {
                const rawPrice =
                    typeof item.price === "number"
                        ? item.price
                        : parseFloat(String(item.price));
                if (isNaN(rawPrice) || rawPrice < 0) {
                    throw new Error(
                        `Precio inválido para el producto: ${item.name}`,
                    );
                }
                const unitPrice = parseFloat(
                    (Math.round(rawPrice * 100) / 100).toFixed(2),
                );

                const igvRateNew = igvPercentageFromBranch / 100;
                const unitValue = parseFloat(
                    (
                        Math.round((unitPrice / (1 + igvRateNew)) * 100) / 100
                    ).toFixed(2),
                );

                const rawQuantity =
                    typeof item.quantity === "number"
                        ? item.quantity
                        : parseInt(String(item.quantity), 10);
                const quantity =
                    isNaN(rawQuantity) || rawQuantity <= 0
                        ? 1
                        : parseInt(String(rawQuantity), 10);

                if (
                    isNaN(unitPrice) ||
                    unitPrice < 0 ||
                    isNaN(unitValue) ||
                    unitValue < 0 ||
                    isNaN(quantity) ||
                    quantity <= 0
                ) {
                    throw new Error(
                        `Valores inválidos para el producto: ${item.name}`,
                    );
                }

                const safeQuantity = Number(quantity);
                const safeUnitValue = Number(unitValue);
                const safeUnitPrice = Number(unitPrice);

                if (
                    isNaN(safeQuantity) ||
                    isNaN(safeUnitValue) ||
                    isNaN(safeUnitPrice)
                ) {
                    throw new Error(
                        `Error al convertir valores numéricos para el producto: ${item.name}`,
                    );
                }
                const notes =
                    typeof item.notes === "string" ? item.notes.trim() : "";

                return {
                    productId: String(item.productId),
                    quantity: safeQuantity,
                    unitMeasure: "NIU",
                    unitValue: safeUnitValue,
                    unitPrice: safeUnitPrice,
                    promoInfo:
                        item.promotionName || (item.discount ?? 0) > 0
                            ? JSON.stringify({
                                  discount: item.discount ?? 0,
                                  promotionName: item.promotionName ?? null,
                              })
                            : null,
                    comboComponents:
                        item.isCombo && item.comboComponents
                            ? item.comboComponents.map((comp: any) => ({
                                  productId: comp.product.id,
                                  quantity: comp.quantity,
                              }))
                            : undefined,
                    notes,
                };
            });

            const itemsTotal = itemsToProcess.reduce((sum, item) => {
                const itemTotal = Number(item.price) * Number(item.quantity);
                return sum + (isNaN(itemTotal) ? 0 : itemTotal);
            }, 0);

            const igvPercentageDecimal = igvPercentageFromBranch / 100;
            const grossAmount =
                typeof itemsTotal === "number" && !isNaN(itemsTotal)
                    ? itemsTotal
                    : 0;
            const calculatedSubtotal = parseFloat(
                (
                    Math.round(
                        (grossAmount / (1 + igvPercentageDecimal)) * 100,
                    ) / 100
                ).toFixed(2),
            );
            const calculatedIgvAmount = parseFloat(
                (
                    Math.round((grossAmount - calculatedSubtotal) * 100) / 100
                ).toFixed(2),
            );
            const validTotal = parseFloat(
                (Math.round(grossAmount * 100) / 100).toFixed(2),
            );

            if (
                isNaN(calculatedSubtotal) ||
                calculatedSubtotal < 0 ||
                isNaN(calculatedIgvAmount) ||
                calculatedIgvAmount < 0 ||
                isNaN(validTotal) ||
                validTotal < 0
            ) {
                showToast(
                    "Error al calcular los totales. Por favor, intente nuevamente.",
                    "error",
                );
                return;
            }

            const variables: any = {
                branchId: companyData.branch.id,
                operationType: "SALE",
                serviceType: "RESTAURANT",
                status: status,
                notes: "",
                details: details,
                subtotal: calculatedSubtotal,
                igvAmount: calculatedIgvAmount,
                igvPercentage: igvPercentageFromBranch,
                total: validTotal,
                operationDate: new Date().toISOString(),
            };

            if (table?.id) {
                variables.tableId = table.id;
            }
            if (user?.id) {
                variables.userId = user.id;
            }
            if (shouldPrint) {
                variables.deviceId = await resolveClientDeviceIdForPrint({
                    getMacAddress,
                    getDeviceId,
                    logPrefix: "[Order/createOperation]",
                });
            }

            variables.shouldPrint = shouldPrint;

            const cleanVariables: any = {};
            Object.keys(variables).forEach((key) => {
                const value = variables[key];
                const numericRequiredFields = [
                    "subtotal",
                    "igvAmount",
                    "igvPercentage",
                    "total",
                ];
                if (numericRequiredFields.includes(key)) {
                    const defaultValue = key === "igvPercentage" ? 10.5 : 0;
                    const numValue =
                        value === null || value === undefined || isNaN(value)
                            ? defaultValue
                            : Number(value);
                    cleanVariables[key] = numValue;
                } else {
                    if (value !== null && value !== undefined) {
                        cleanVariables[key] = value;
                    }
                }
            });

            console.log(
                "📊 Variables limpias a enviar:",
                JSON.stringify(cleanVariables, null, 2),
            );
            console.log("📊 Details:", JSON.stringify(details, null, 2));

            const numericFields = [
                "subtotal",
                "igvAmount",
                "igvPercentage",
                "total",
            ];
            for (const field of numericFields) {
                const value = cleanVariables[field];
                if (value === null || value === undefined || isNaN(value)) {
                    throw new Error(
                        `Campo numérico inválido: ${field} = ${value}`,
                    );
                }
            }

            details.forEach((detail, index) => {
                if (
                    detail.quantity === null ||
                    detail.quantity === undefined ||
                    isNaN(detail.quantity)
                ) {
                    throw new Error(
                        `Detalle ${index} tiene quantity inválido: ${detail.quantity}`,
                    );
                }
                if (
                    detail.unitValue === null ||
                    detail.unitValue === undefined ||
                    isNaN(detail.unitValue)
                ) {
                    throw new Error(
                        `Detalle ${index} tiene unitValue inválido: ${detail.unitValue}`,
                    );
                }
                if (
                    detail.unitPrice === null ||
                    detail.unitPrice === undefined ||
                    isNaN(detail.unitPrice)
                ) {
                    throw new Error(
                        `Detalle ${index} tiene unitPrice inválido: ${detail.unitPrice}`,
                    );
                }
            });

            const result = await createOperationMutation({
                variables: cleanVariables,
            });

            if (result.data?.createOperation?.success) {
                const createMsg = result.data?.createOperation?.message;
                if (isStockWarningMessage(createMsg)) {
                    showToast(createMsg!, "warning");
                }

                // Actualizar el estado de la mesa a OCCUPIED
                try {
                    const tableResult = await updateTableStatusMutation({
                        variables: {
                            tableId: table.id,
                            status: "OCCUPIED",
                            userId: user?.id,
                        },
                    });

                    if (tableResult.data?.updateTableStatus?.success) {
                        // Actualizar la mesa en el contexto local
                        const updatedTable =
                            tableResult.data.updateTableStatus.table;
                        const currentOperationId =
                            result.data.createOperation.operation?.id ||
                            updatedTable.currentOperationId;
                        const occupiedById = updatedTable.occupiedById;
                        const userName = updatedTable.userName;

                        updateTableInContext({
                            id: updatedTable.id,
                            status: updatedTable.status,
                            currentOperationId: currentOperationId,
                            occupiedById: occupiedById,
                            userName: userName,
                        });

                        // Enviar notificación WebSocket para actualizar en tiempo real
                        setTimeout(() => {
                            sendMessage({
                                type: "table_status_update",
                                table_id: updatedTable.id,
                                status: updatedTable.status || "OCCUPIED",
                                current_operation_id:
                                    currentOperationId || null,
                                occupied_by_user_id: occupiedById || null,
                                waiter_name: userName || null,
                            });
                            console.log(
                                "📡 Notificación WebSocket enviada para mesa:",
                                updatedTable.id,
                            );

                            // Solicitar snapshot completo de todas las mesas
                            setTimeout(() => {
                                sendMessage({
                                    type: "table_update_request",
                                });
                                console.log(
                                    "📡 Solicitud de snapshot de mesas enviada",
                                );
                            }, 500);
                        }, 300);

                        console.log("✅ Estado de mesa actualizado a OCCUPIED");
                    }
                } catch (tableError) {
                    console.error(
                        "⚠️ Error al actualizar estado de mesa:",
                        tableError,
                    );
                    // Continuar aunque falle la actualización de la mesa
                }

                const newOpId = result.data.createOperation.operation?.id;
                if (newOpId != null && newOpId !== "") {
                    await completeOrderSave({
                        operationId: newOpId,
                        operationDate:
                            result.data.createOperation.operation
                                ?.operationDate ?? null,
                    });
                } else {
                    await completeOrderSave();
                }
            } else {
                showToast(
                    result.data?.createOperation?.message ||
                        "Error al guardar la orden",
                    "error",
                );
            }
        } catch (error: any) {
            console.error("Error al guardar la orden:", error);
            showToast(error.message || "Error al guardar la orden", "error");
        } finally {
            setIsSaving(false);
        }
    };

    // Función para imprimir precuenta
    const handlePrecuenta = async () => {
        if (!existingOperation || !table?.id || !companyData?.branch.id) {
            showToast(
                "No hay una orden disponible para imprimir precuenta",
                "error",
            );
            return;
        }

        if (existingOperation.status === "COMPLETED") {
            showToast("Esta orden ya ha sido completada", "error");
            return;
        }

        setIsPrintingPrecuenta(true);

        try {
            const resolvedDeviceId = await resolveClientDeviceIdForPrint({
                getMacAddress,
                getDeviceId,
                logPrefix: "[Order/precuenta]",
            });

            const result = await printPrecuentaMutation({
                variables: {
                    operationId: existingOperation.id,
                    tableId: table.id,
                    branchId: companyData.branch.id,
                    deviceId: resolvedDeviceId,
                },
            });

            if (result.data?.printAccount?.success) {
                const pa = result.data
                    .printAccount as typeof result.data.printAccount & {
                    print_locally?: boolean;
                    printLocally?: boolean;
                    document_data?: string | null;
                    documentData?: string | null;
                };
                const printLocallyFlag =
                    pa?.printLocally === true || pa?.print_locally === true;
                const docData = pa?.documentData ?? pa?.document_data ?? null;
                const localPrintOk = await invokeLocalIssuedDocumentPrint(
                    {
                        printLocally: pa?.printLocally ?? pa?.print_locally,
                        documentData: docData,
                    },
                    {
                        label: "precuenta",
                        operationId: existingOperation.id,
                        deviceId: resolvedDeviceId,
                        localPrinterName:
                            getLocalTicketPrinterStorage().trim() || null,
                    },
                );
                if (printLocallyFlag && !localPrintOk) {
                    showToast(
                        "La precuenta se registró, pero no se pudo imprimir en la impresora local. Revise la impresora o SumApp Electron.",
                        "warning",
                    );
                }

                const updatedTableId = table.id;
                // Forzar siempre TO_PAY para que la mesa se pinte amarilla
                const updatedStatus = "TO_PAY";

                try {
                    await updateTableStatusMutation({
                        variables: {
                            tableId: table.id,
                            status: "TO_PAY",
                            userId: user?.id,
                        },
                    });
                    console.log(
                        "✅ Estado de mesa actualizado a TO_PAY mediante mutación",
                    );
                } catch (updateError) {
                    console.warn(
                        "⚠️ No se pudo actualizar el estado mediante mutación, actualizando en contexto:",
                        updateError,
                    );
                }

                const finalCurrentOperationId =
                    (table?.currentOperationId || existingOperation?.id) != null
                        ? typeof (
                              table?.currentOperationId ?? existingOperation?.id
                          ) === "string"
                            ? Number(
                                  table?.currentOperationId ??
                                      existingOperation?.id,
                              )
                            : (table?.currentOperationId ??
                              existingOperation?.id)
                        : existingOperation?.id
                          ? typeof existingOperation.id === "string"
                              ? Number(existingOperation.id)
                              : existingOperation.id
                          : undefined;
                const finalOccupiedById =
                    table?.occupiedById != null
                        ? typeof table.occupiedById === "string"
                            ? Number(table.occupiedById)
                            : table.occupiedById
                        : user?.id
                          ? Number(user.id)
                          : undefined;
                const finalUserName = table?.userName || user?.fullName;

                if (updateTableInContext) {
                    updateTableInContext({
                        id: updatedTableId,
                        status: updatedStatus,
                        currentOperationId: finalCurrentOperationId,
                        occupiedById: finalOccupiedById,
                        userName: finalUserName,
                    });
                    console.log(
                        `✅ Mesa ${updatedTableId} actualizada en contexto a estado: ${updatedStatus} (amarillo)`,
                    );

                    setTimeout(() => {
                        sendMessage({
                            type: "table_status_update",
                            table_id: updatedTableId,
                            status: updatedStatus,
                            current_operation_id: finalCurrentOperationId,
                            occupied_by_user_id: finalOccupiedById,
                            waiter_name: finalUserName,
                        });
                        setTimeout(() => {
                            sendMessage({ type: "table_update_request" });
                        }, 500);
                    }, 300);
                }

                // Refetch la operación para obtener los datos actualizados (igual que en cashPay.tsx)
                try {
                    // Resetear el flag para que el useEffect vuelva a mapear los productos con el nuevo estado isPrinted
                    setInitializedFromExistingOrder(false);
                    await refetchExistingOperation();
                    console.log(
                        "✅ Operación refetcheada después de precuenta",
                    );
                } catch (refetchError) {
                    console.error(
                        "❌ Error al hacer refetch de la operación:",
                        refetchError,
                    );
                }

                // Llamar callback de éxito si existe
                if (onSuccess) {
                    onSuccess();
                }

                // Mostrar mensaje de éxito (sin mencionar liberación de mesa)
                // El mensaje del backend podría decir que liberó la mesa, pero no es correcto para precuenta
                showToast(
                    "Precuenta enviada a imprimir exitosamente. Estado de mesa actualizado a TO_PAY",
                    "success",
                );
                setTimeout(() => {
                    onClose();
                }, 500);
            } else {
                showToast(
                    result.data?.printAccount?.message ||
                        "Error al imprimir la precuenta",
                    "error",
                );
            }
        } catch (err: any) {
            console.error("Error al imprimir precuenta:", err);
            showToast(err.message || "Error al imprimir la precuenta", "error");
        } finally {
            setIsPrintingPrecuenta(false);
        }
    };

    const handleOpenCashFromOrder = () => {
        const operationId = existingOperation?.id ?? table.currentOperationId;
        if (operationId == null || operationId === "") {
            showToast(
                "Esta mesa no tiene una orden activa para cobrar.",
                "error",
            );
            return;
        }
        if (!onOpenCash) return;
        const coercedId =
            typeof operationId === "string" ? Number(operationId) : operationId;
        onOpenCash({
            ...table,
            currentOperationId: Number.isFinite(coercedId as number)
                ? (coercedId as number)
                : table.currentOperationId,
        });
        onClose();
    };

    const restrictedOverlayPayload =
        orderRestrictedPayload ??
        (claimSessionDenied ? { table, kind: "session_lock" as const } : null);

    return (
        <>
            {restrictedOverlayPayload && (
                <RestrictedTableAccessModal
                    payload={restrictedOverlayPayload}
                    onClose={() => {
                        setClaimSessionDenied(false);
                        onClose();
                    }}
                />
            )}
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "#f8fafc",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 1100,
                    margin: 0,
                    padding: 0,
                }}
            >
                <style>{`
				.order-categories-grid-scroll {
					scrollbar-width: auto;
				}
				.order-categories-grid-scroll::-webkit-scrollbar {
					width: 22px;
				}
				.order-categories-grid-scroll::-webkit-scrollbar-track {
					background: #f1f5f9;
					border-radius: 10px;
				}
				.order-categories-grid-scroll::-webkit-scrollbar-thumb {
					background: #94a3b8;
					border-radius: 10px;
					border: 3px solid #f1f5f9;
				}
				.order-categories-grid-scroll::-webkit-scrollbar-thumb:hover {
					background: #64748b;
				}
			`}</style>
                <div className="flex h-full w-full flex-col overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                    {/* Header */}
                    <div
                        className={`flex ${isXs ? "flex-col items-start gap-4" : "items-center justify-between gap-4"} border-b border-slate-200 bg-white ${isXs ? "px-4 py-3" : "px-6 py-4"} text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100`}
                    >
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <div
                                className={`flex items-center gap-2 rounded-xl bg-slate-100 ${isXs ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200`}
                            >
                                Piso {resolvedFloorName ?? "—"}
                            </div>
                            <span className="text-slate-400 dark:text-slate-500">
                                •
                            </span>
                            <div
                                className={`flex items-center gap-2 rounded-xl bg-indigo-50 ${isXs ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-base"} font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300`}
                            >
                                Mesa {table.name.replace("MESA ", "")}
                            </div>
                            <span className="text-slate-400 dark:text-slate-500">
                                •
                            </span>
                            <div
                                className={`flex items-center gap-2 rounded-xl bg-slate-100 ${isXs ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200`}
                            >
                                {headerWaiterName ?? "—"}
                            </div>
                        </div>
                        <div
                            className={`flex items-center gap-3 ${isXs ? "w-full justify-between" : ""}`}
                        >
                            {/* NUEVO: Botón de combos */}
                            <button
                                type="button"
                                onClick={() => {
                                    setPendingComboProduct(null);
                                    setShowComboModal(true);
                                }}
                                className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-orange-600"
                            >
                                ⭐ Combos
                            </button>
                            {onOpenCash && canNavigateToCashPay && (
                                <button
                                    type="button"
                                    onClick={handleOpenCashFromOrder}
                                    className={`flex items-center gap-2 rounded-xl bg-emerald-50 ${isXs ? "flex-1 justify-center px-3 py-2" : "px-4 py-2.5"} text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30`}
                                    title="Ir a cobrar en Caja"
                                >
                                    <span>💵</span>
                                    Caja
                                </button>
                            )}
                            {!isMobile && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsKeyboardVisible(true);
                                        setTimeout(
                                            () =>
                                                searchInputRef.current?.focus(),
                                            50,
                                        );
                                    }}
                                    className="flex items-center gap-2 rounded-xl bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 transition-all hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
                                    title="Mostrar teclado en pantalla"
                                >
                                    <span>⌨️</span>
                                    Teclado virtual
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className={`rounded-xl border border-slate-200 bg-slate-50 ${isXs ? "flex-1 px-3 py-2" : "px-6 py-2.5"} text-sm font-bold text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>

                    {/* Banner de regalo disponible */}
                    {giftMessage && (
                        <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm dark:border-amber-900/50 dark:bg-amber-900/20">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                                    />
                                </svg>
                            </div>
                            <p className="flex-1 text-sm font-semibold text-amber-800 dark:text-amber-200">
                                {giftMessage}
                            </p>
                        </div>
                    )}

                    {/* Body */}
                    <div
                        className="grid flex-1 gap-4 overflow-hidden p-4"
                        style={{
                            gridTemplateColumns:
                                isXs || isSmall || isMedium
                                    ? "1fr"
                                    : "1.5fr 1fr",
                        }}
                    >
                        {/* Col izquierda: búsqueda y catálogo */}
                        <div
                            className="flex flex-col overflow-hidden"
                            style={{
                                order: isXs || isSmall || isMedium ? 2 : 1,
                            }}
                        >
                            {/* Búsqueda */}
                            <div className="mb-4 flex-shrink-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSearchByCodeOnly((v) => !v)
                                        }
                                        className={`flex items-center gap-2 rounded-xl border px-4 py-3.5 text-sm font-semibold transition-all duration-200 ${
                                            searchByCodeOnly
                                                ? "border-blue-500 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500"
                                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                                        }`}
                                    >
                                        Búsqueda solo código
                                    </button>
                                    <div className="relative flex-1 min-w-0">
                                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg opacity-60">
                                            🔎
                                        </span>
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            placeholder={
                                                searchByCodeOnly
                                                    ? "Código del producto..."
                                                    : "Buscar producto o escanear código"
                                            }
                                            value={searchTerm}
                                            onChange={(e) =>
                                                setSearchTerm(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                if (
                                                    e.key === "Enter" &&
                                                    productsList.length > 0
                                                ) {
                                                    e.preventDefault();
                                                    handleAddProduct(
                                                        productsList[0].id,
                                                        1,
                                                    );
                                                }
                                            }}
                                            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-base text-slate-900 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Contenedor con breadcrumb + grid (como delivery) */}
                            <div
                                className="border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                                style={{
                                    flex: 1,
                                    minHeight: 0,
                                    borderRadius: isSmall
                                        ? "10px"
                                        : isMedium
                                          ? "12px"
                                          : "14px",
                                    display: "flex",
                                    flexDirection: "column",
                                    overflow: "hidden",
                                }}
                            >
                                {/* Header: ruta como botones grandes (fácil de pulsar en salón) + Volver */}
                                <div
                                    className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/70"
                                    style={{
                                        padding: isSmall ? "0.75rem" : "1rem",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: "0.75rem",
                                        flexWrap: "nowrap",
                                    }}
                                >
                                    <div
                                        role="navigation"
                                        aria-label="Ubicación en el menú"
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: isSmall ? "0.5rem" : "0.65rem",
                                            flexWrap: "nowrap",
                                            minWidth: 0,
                                            flex: 1,
                                            overflowX: "auto",
                                            overflowY: "hidden",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {isSearching ? (
                                            <h3
                                                className="text-slate-700 dark:text-slate-200"
                                                style={{
                                                    fontSize:
                                                        breadcrumbFontSize,
                                                    fontWeight: "600",
                                                    margin: 0,
                                                }}
                                            >
                                                Resultados de búsqueda
                                            </h3>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedCategory(
                                                            null,
                                                        );
                                                        setSelectedSubcategory(
                                                            null,
                                                        );
                                                    }}
                                                    className={`inline-flex items-center gap-2 justify-center border text-center transition-all duration-150 ${
                                                        !selectedCategory
                                                            ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-200"
                                                            : "border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-200"
                                                    }`}
                                                    style={{
                                                        minHeight:
                                                            breadcrumbBtnMinH,
                                                        padding: `${breadcrumbBtnPadY} ${breadcrumbBtnPadX}`,
                                                        borderWidth: "1.5px",
                                                        borderRadius:
                                                            breadcrumbBtnRadius,
                                                        fontSize:
                                                            breadcrumbBtnFont,
                                                        fontWeight: 700,
                                                        cursor: "pointer",
                                                        whiteSpace: "nowrap",
                                                        touchAction:
                                                            "manipulation",
                                                        lineHeight: 1.2,
                                                    }}
                                                >
                                                    <CategoryIcon
                                                        iconId="grid_view"
                                                        type="category"
                                                        size="1.1rem"
                                                    />
                                                    Categorías
                                                </button>
                                                {selectedCategory && (
                                                    <>
                                                        <span
                                                            className="text-slate-400 dark:text-slate-500"
                                                            style={{
                                                                fontSize:
                                                                    breadcrumbBtnFont,
                                                                fontWeight: 700,
                                                                userSelect:
                                                                    "none",
                                                            }}
                                                            aria-hidden
                                                        >
                                                            ›
                                                        </span>
                                                        <button
                                                            type="button"
                                                            title={
                                                                categories.find(
                                                                    (c: any) =>
                                                                        c.id ===
                                                                        selectedCategory,
                                                                )?.name ||
                                                                undefined
                                                            }
                                                            onClick={() =>
                                                                setSelectedSubcategory(
                                                                    null,
                                                                )
                                                            }
                                                            className={`inline-flex items-center gap-2 justify-center border text-center transition-all duration-150 ${
                                                                !selectedSubcategory
                                                                    ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-200"
                                                                    : "border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-200"
                                                            }`}
                                                            style={{
                                                                minHeight:
                                                                    breadcrumbBtnMinH,
                                                                padding: `${breadcrumbBtnPadY} ${breadcrumbBtnPadX}`,
                                                                borderWidth:
                                                                    "1.5px",
                                                                borderRadius:
                                                                    breadcrumbBtnRadius,
                                                                fontSize:
                                                                    breadcrumbBtnFont,
                                                                fontWeight: 700,
                                                                cursor: "pointer",
                                                                whiteSpace:
                                                                    "nowrap",
                                                                maxWidth:
                                                                    breadcrumbLabelMaxWidth,
                                                                minWidth: 0,
                                                                overflow:
                                                                    "hidden",
                                                                touchAction:
                                                                    "manipulation",
                                                                lineHeight: 1.2,
                                                                textAlign:
                                                                    "center",
                                                                textOverflow:
                                                                    "ellipsis",
                                                            }}
                                                        >
                                                            <CategoryIcon
                                                                iconId={
                                                                    categories.find(
                                                                        (
                                                                            c: any,
                                                                        ) =>
                                                                            c.id ===
                                                                            selectedCategory,
                                                                    )?.icon
                                                                }
                                                                type="category"
                                                                size="1.1rem"
                                                            />
                                                            {categories.find(
                                                                (c: any) =>
                                                                    c.id ===
                                                                    selectedCategory,
                                                            )?.name ||
                                                                "Categoría"}
                                                        </button>
                                                    </>
                                                )}
                                                {selectedSubcategory && (
                                                    <>
                                                        <span
                                                            className="text-slate-400 dark:text-slate-500"
                                                            style={{
                                                                fontSize:
                                                                    breadcrumbBtnFont,
                                                                fontWeight: 700,
                                                                userSelect:
                                                                    "none",
                                                            }}
                                                            aria-hidden
                                                        >
                                                            ›
                                                        </span>
                                                        <span
                                                            title={
                                                                subcategoriesOfCategory.find(
                                                                    (s: any) =>
                                                                        s.id ===
                                                                        selectedSubcategory,
                                                                )?.name ||
                                                                undefined
                                                            }
                                                            className="inline-flex items-center gap-2 border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                                            style={{
                                                                minHeight:
                                                                    breadcrumbBtnMinH,
                                                                padding: `${breadcrumbBtnPadY} ${breadcrumbBtnPadX}`,
                                                                borderWidth:
                                                                    "1.5px",
                                                                borderRadius:
                                                                    breadcrumbBtnRadius,
                                                                fontSize:
                                                                    breadcrumbBtnFont,
                                                                fontWeight: 700,
                                                                whiteSpace:
                                                                    "nowrap",
                                                                maxWidth:
                                                                    breadcrumbLabelMaxWidth,
                                                                minWidth: 0,
                                                                overflow:
                                                                    "hidden",
                                                                boxSizing:
                                                                    "border-box",
                                                                lineHeight: 1.2,
                                                                textAlign:
                                                                    "center",
                                                                textOverflow:
                                                                    "ellipsis",
                                                            }}
                                                        >
                                                            <CategoryIcon
                                                                iconId={
                                                                    subcategoriesOfCategory.find(
                                                                        (
                                                                            s: any,
                                                                        ) =>
                                                                            s.id ===
                                                                            selectedSubcategory,
                                                                    )?.icon
                                                                }
                                                                type="subcategory"
                                                                size="1.1rem"
                                                            />
                                                            {subcategoriesOfCategory.find(
                                                                (s: any) =>
                                                                    s.id ===
                                                                    selectedSubcategory,
                                                            )?.name ||
                                                                "Subcategoría"}
                                                        </span>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (selectedSubcategory) {
                                                setSelectedSubcategory(null);
                                                return;
                                            }
                                            if (selectedCategory) {
                                                setSelectedCategory(null);
                                                setSelectedSubcategory(null);
                                            }
                                        }}
                                        disabled={
                                            isSearching ||
                                            (!selectedCategory &&
                                                !selectedSubcategory)
                                        }
                                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-all duration-150 hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-indigo-200"
                                        style={{ flexShrink: 0 }}
                                    >
                                        Volver
                                    </button>
                                </div>

                                {/* Grid: categorías, subcategorías o productos */}
                                <div
                                    className="order-categories-grid-scroll"
                                    style={{
                                        flex: 1,
                                        minHeight: 0,
                                        padding: gridPadding,
                                        overflowY: "auto",
                                        overflowX: "hidden",
                                    }}
                                >
                                    {productsLoading && showProductsInGrid ? (
                                        <div
                                            className="rounded-xl border border-slate-200 bg-white/80 px-4 py-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400"
                                            style={{
                                                fontSize: isSmall
                                                    ? "0.8125rem"
                                                    : "0.875rem",
                                            }}
                                        >
                                            Cargando...
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: `repeat(auto-fill, minmax(${gridMinCol}, 1fr))`,
                                                gap: gridGap,
                                            }}
                                        >
                                            {/* Categorías */}
                                            {showCategoriesInGrid &&
                                                (categoriesLoading ? (
                                                    <div className="col-span-full py-8 text-center text-slate-500 dark:text-slate-400">
                                                        Cargando categorías...
                                                    </div>
                                                ) : (
                                                    categories.map(
                                                        (category: any) => (
                                                            <div
                                                                key={
                                                                    category.id
                                                                }
                                                                onClick={() => {
                                                                    setSelectedCategory(
                                                                        category.id,
                                                                    );
                                                                    setSelectedSubcategory(
                                                                        null,
                                                                    );
                                                                }}
                                                                className="group flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-500 dark:hover:bg-slate-800"
                                                            >
                                                                <div className="mb-2 flex items-center justify-center">
                                                                    <CategoryIcon
                                                                        iconId={
                                                                            category.icon
                                                                        }
                                                                        type="category"
                                                                        size={
                                                                            isXs
                                                                                ? "1.25rem"
                                                                                : isSmall
                                                                                  ? "1.5rem"
                                                                                  : "1.75rem"
                                                                        }
                                                                    />
                                                                </div>
                                                                <div className="text-xs font-bold leading-tight text-slate-800 dark:text-slate-100 md:text-sm">
                                                                    {
                                                                        category.name
                                                                    }
                                                                </div>
                                                            </div>
                                                        ),
                                                    )
                                                ))}

                                            {/* Subcategorías */}
                                            {showSubcategoriesInGrid &&
                                                (subcategoriesLoading &&
                                                subcategoriesOfCategory.length ===
                                                    0 ? (
                                                    <div className="col-span-full py-8 text-center text-slate-500 dark:text-slate-400">
                                                        Cargando
                                                        subcategorías...
                                                    </div>
                                                ) : (
                                                    subcategoriesOfCategory.map(
                                                        (sub: any) => (
                                                            <div
                                                                key={sub.id}
                                                                onClick={() =>
                                                                    setSelectedSubcategory(
                                                                        sub.id,
                                                                    )
                                                                }
                                                                className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/70 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/10"
                                                            >
                                                                <div className="mb-1 flex items-center justify-center">
                                                                    <CategoryIcon
                                                                        iconId={
                                                                            sub.icon
                                                                        }
                                                                        type="subcategory"
                                                                        size={
                                                                            isSmall
                                                                                ? "1.1rem"
                                                                                : "1.25rem"
                                                                        }
                                                                    />
                                                                </div>
                                                                <div className="text-xs font-semibold leading-tight text-slate-700 dark:text-slate-200">
                                                                    {sub.name}
                                                                </div>
                                                            </div>
                                                        ),
                                                    )
                                                ))}

                                            {/* Productos */}
                                            {showProductsInGrid &&
                                                (productsList.length === 0 ? (
                                                    <div className="col-span-full py-8 text-center text-slate-500 dark:text-slate-400">
                                                        No se encontraron
                                                        productos
                                                    </div>
                                                ) : (
                                                    productsList.map(
                                                        (product: any) => {
                                                            const outOfStock =
                                                                product.productType !==
                                                                    "PROMOTION" &&
                                                                !canAddMoreProduct(
                                                                    product,
                                                                    orderItems,
                                                                    1,
                                                                );
                                                            return (
                                                            <div
                                                                key={product.id}
                                                                onClick={() => {
                                                                    if (outOfStock) {
                                                                        showToast(
                                                                            `Sin stock: ${product.name}`,
                                                                            "error",
                                                                        );
                                                                        return;
                                                                    }
                                                                    handleAddProduct(
                                                                        product.id,
                                                                        1,
                                                                    );
                                                                }}
                                                                className={`flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3 text-center transition-all duration-200 dark:border-slate-700 dark:bg-slate-900 relative ${
                                                                    outOfStock
                                                                        ? "cursor-not-allowed opacity-50"
                                                                        : "cursor-pointer hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/60 hover:shadow-sm dark:hover:border-indigo-500 dark:hover:bg-indigo-500/10"
                                                                }`}
                                                            >
                                                                {/* NUEVO: Badge de promoción */}
                                                                {(() => {
                                                                    const badge =
                                                                        findBadgePromotion(
                                                                            product,
                                                                            activePromotions,
                                                                        );
                                                                    if (!badge)
                                                                        return null;
                                                                    return (
                                                                        <span className="absolute top-1 right-1 z-10 rounded bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
                                                                            {promotionBadgeLabel(
                                                                                badge,
                                                                            )}
                                                                        </span>
                                                                    );
                                                                })()}
                                                                {product.imageBase64 ? (
                                                                    <img
                                                                        src={`data:image/jpeg;base64,${product.imageBase64}`}
                                                                        alt={
                                                                            product.name
                                                                        }
                                                                        style={{
                                                                            width: "100%",
                                                                            height: isSmall
                                                                                ? "60px"
                                                                                : isMedium
                                                                                  ? "70px"
                                                                                  : "80px",
                                                                            objectFit:
                                                                                "cover",
                                                                            borderRadius:
                                                                                "10px",
                                                                            marginBottom:
                                                                                isSmall
                                                                                    ? "0.35rem"
                                                                                    : "0.5rem",
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        className="bg-slate-100 dark:bg-slate-800"
                                                                        style={{
                                                                            width: "100%",
                                                                            height: isSmall
                                                                                ? "60px"
                                                                                : isMedium
                                                                                  ? "70px"
                                                                                  : "80px",
                                                                            display:
                                                                                "flex",
                                                                            alignItems:
                                                                                "center",
                                                                            justifyContent:
                                                                                "center",
                                                                            borderRadius:
                                                                                "10px",
                                                                            marginBottom:
                                                                                isSmall
                                                                                    ? "0.35rem"
                                                                                    : "0.5rem",
                                                                            fontSize:
                                                                                isSmall
                                                                                    ? "1.5rem"
                                                                                    : "2rem",
                                                                        }}
                                                                    >
                                                                        🍽️
                                                                    </div>
                                                                )}
                                                                <div
                                                                    className="text-xs font-bold text-slate-700 dark:text-slate-200 md:text-sm"
                                                                    style={{
                                                                        marginBottom:
                                                                            "0.25rem",
                                                                        lineHeight: 1.25,
                                                                        flex: 1,
                                                                        wordBreak:
                                                                            "break-word",
                                                                    }}
                                                                >
                                                                    {
                                                                        product.name
                                                                    }
                                                                </div>
                                                                {productStockLabel(
                                                                    product,
                                                                ) && (
                                                                    <div
                                                                        className="text-[0.65rem] font-semibold text-slate-500 dark:text-slate-400 md:text-xs"
                                                                        style={{
                                                                            marginBottom:
                                                                                "0.2rem",
                                                                        }}
                                                                    >
                                                                        {productStockLabel(
                                                                            product,
                                                                        )}
                                                                    </div>
                                                                )}
                                                                <div
                                                                    style={{
                                                                        fontSize:
                                                                            isSmall
                                                                                ? "0.8125rem"
                                                                                : "0.9375rem",
                                                                        fontWeight:
                                                                            "700",
                                                                        color: "#4338ca",
                                                                        marginTop:
                                                                            "auto",
                                                                    }}
                                                                    className="dark:text-indigo-300"
                                                                >
                                                                    S/{" "}
                                                                    {parseFloat(
                                                                        product.salePrice ||
                                                                            0,
                                                                    ).toFixed(
                                                                        2,
                                                                    )}
                                                                </div>
                                                                {product.preparationTime >
                                                                    0 && (
                                                                    <div
                                                                        style={{
                                                                            fontSize:
                                                                                isSmall
                                                                                    ? "0.7rem"
                                                                                    : "0.8125rem",
                                                                            color: "#64748b",
                                                                            display:
                                                                                "flex",
                                                                            alignItems:
                                                                                "center",
                                                                            justifyContent:
                                                                                "center",
                                                                            gap: "0.25rem",
                                                                            marginTop:
                                                                                "0.25rem",
                                                                        }}
                                                                        className="dark:text-slate-400"
                                                                    >
                                                                        ⏱️{" "}
                                                                        {
                                                                            product.preparationTime
                                                                        }{" "}
                                                                        min
                                                                    </div>
                                                                )}
                                                                {outOfStock && (
                                                                    <div className="absolute inset-x-2 bottom-2 rounded-lg bg-red-500/90 px-2 py-0.5 text-[0.65rem] font-bold text-white">
                                                                        Sin stock
                                                                    </div>
                                                                )}
                                                            </div>
                                                            );
                                                        },
                                                    )
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Col derecha: resumen de orden */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: isXs
                                    ? "0.4rem"
                                    : isSmall
                                      ? "0.5rem"
                                      : isMedium
                                        ? "0.75rem"
                                        : "1rem",
                                order: isXs || isSmall || isMedium ? 1 : 2,
                                overflow: "hidden",
                                minHeight: 0,
                            }}
                        >
                            <div
                                ref={orderListContainerRef}
                                className="border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                                style={{
                                    borderRadius: isXs
                                        ? "8px"
                                        : isSmall
                                          ? "10px"
                                          : isMedium
                                            ? "12px"
                                            : "14px",
                                    padding: isXs
                                        ? "0.4rem"
                                        : isSmall
                                          ? "0.5rem"
                                          : isMedium
                                            ? "0.75rem"
                                            : "1rem",
                                    flex: "1 1 auto",
                                    overflowY: "auto",
                                    minHeight: 0,
                                }}
                            >
                                <h4
                                    className="text-slate-800 dark:text-slate-100"
                                    style={{
                                        margin: `0 0 ${isXs ? "0.4rem" : isSmall ? "0.5rem" : isMedium ? "0.75rem" : "1rem"} 0`,
                                        fontSize: isXs
                                            ? "0.8rem"
                                            : isSmall
                                              ? "0.875rem"
                                              : isMedium
                                                ? "1rem"
                                                : "1.25rem",
                                    }}
                                >
                                    Detalle
                                </h4>
                                {isLoadingExistingOrder ? (
                                    <div
                                        className="rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-400"
                                        style={{
                                            borderRadius: 12,
                                            padding: "1.25rem",
                                            textAlign: "center",
                                        }}
                                    >
                                        Cargando orden actual...
                                    </div>
                                ) : existingOperationError ? (
                                    <div
                                        className="rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300"
                                        style={{
                                            borderRadius: 12,
                                            padding: "1.25rem",
                                            textAlign: "center",
                                        }}
                                    >
                                        Error al cargar la orden activa:{" "}
                                        {existingOperationError.message}
                                    </div>
                                ) : orderItems.length === 0 ? (
                                    <div
                                        className="rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-400"
                                        style={{
                                            borderRadius: 12,
                                            padding: "1rem",
                                            textAlign: "center",
                                        }}
                                    >
                                        Aquí aparecerán los ítems agregados.
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: isSmall
                                                ? "0.2rem"
                                                : isMedium
                                                  ? "0.3rem"
                                                  : "0.4rem",
                                        }}
                                    >
                                        {orderItems.map((item) => {
                                            const isGift =
                                                item.id === GIFT_ITEM_ID;
                                            const isEditable =
                                                !isGift &&
                                                (!isExistingOrder ||
                                                    item.isNew);
                                            const canEditNotes =
                                                !isGift &&
                                                (!isExistingOrder ||
                                                    item.isNew);
                                            const hasObservationContent =
                                                !isGift &&
                                                Boolean(
                                                    item.notes?.trim() ||
                                                    (selectedObservations[
                                                        item.id
                                                    ]?.size ?? 0) > 0,
                                                );
                                            return (
                                                <div
                                                    key={item.id}
                                                    ref={(el) => {
                                                        if (el) {
                                                            itemRefs.current[
                                                                item.id
                                                            ] = el;
                                                        }
                                                    }}
                                                    className={`${isGift ? "border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20" : isExistingOrder && !item.isNew ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-900/20" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"}`}
                                                    style={{
                                                        borderWidth: "1px",
                                                        borderStyle: "solid",
                                                        borderRadius: isXs
                                                            ? "8px"
                                                            : isSmall
                                                              ? "6px"
                                                              : isMedium
                                                                ? "8px"
                                                                : "10px",
                                                        padding: isXs
                                                            ? "0.5rem"
                                                            : isSmall
                                                              ? "0.2rem"
                                                              : isMedium
                                                                ? "0.3rem"
                                                                : "0.35rem",
                                                    }}
                                                >
                                                    {/* Una sola fila: Cantidad (solo si no es regalo), Producto, Precio + Tachito (solo si no es regalo), Botón notas (solo si no es regalo) */}
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: isSmall
                                                                ? "0.2rem"
                                                                : isMedium
                                                                  ? "0.3rem"
                                                                  : "0.35rem",
                                                            justifyContent:
                                                                "flex-start",
                                                            flexWrap: "nowrap",
                                                            width: "100%",
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        {!isGift && (
                                                            <>
                                                                {/* Controles de cantidad */}
                                                                <div
                                                                    style={{
                                                                        display:
                                                                            "flex",
                                                                        alignItems:
                                                                            "center",
                                                                        gap: isXs
                                                                            ? "0.4rem"
                                                                            : isSmall
                                                                              ? "0.1rem"
                                                                              : isMedium
                                                                                ? "0.15rem"
                                                                                : "0.2rem",
                                                                        flexShrink: 0,
                                                                    }}
                                                                >
                                                                    <button
                                                                        onClick={() =>
                                                                            handleUpdateQuantity(
                                                                                item.id,
                                                                                item.quantity -
                                                                                    1,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            !isEditable
                                                                        }
                                                                        className="border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-100"
                                                                        style={{
                                                                            width: isXs
                                                                                ? "34px"
                                                                                : isSmall
                                                                                  ? "20px"
                                                                                  : isMedium
                                                                                    ? "24px"
                                                                                    : "28px",
                                                                            height: isXs
                                                                                ? "34px"
                                                                                : isSmall
                                                                                  ? "20px"
                                                                                  : isMedium
                                                                                    ? "24px"
                                                                                    : "28px",
                                                                            borderRadius:
                                                                                isXs
                                                                                    ? "8px"
                                                                                    : isSmall
                                                                                      ? "4px"
                                                                                      : "6px",
                                                                            cursor: isEditable
                                                                                ? "pointer"
                                                                                : "not-allowed",
                                                                            fontSize:
                                                                                isXs
                                                                                    ? "1.1rem"
                                                                                    : isSmall
                                                                                      ? "0.75rem"
                                                                                      : isMedium
                                                                                        ? "0.85rem"
                                                                                        : "0.95rem",
                                                                            display:
                                                                                "flex",
                                                                            alignItems:
                                                                                "center",
                                                                            justifyContent:
                                                                                "center",
                                                                            padding: 0,
                                                                            flexShrink: 0,
                                                                        }}
                                                                    >
                                                                        −
                                                                    </button>
                                                                    <input
                                                                        type="number"
                                                                        value={
                                                                            item.quantity
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            handleUpdateQuantity(
                                                                                item.id,
                                                                                parseInt(
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                ) ||
                                                                                    0,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            !isEditable
                                                                        }
                                                                        min="0"
                                                                        className="border border-slate-300 bg-white text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-100"
                                                                        style={{
                                                                            width: isXs
                                                                                ? "44px"
                                                                                : isSmall
                                                                                  ? "28px"
                                                                                  : isMedium
                                                                                    ? "32px"
                                                                                    : "38px",
                                                                            textAlign:
                                                                                "center",
                                                                            borderRadius:
                                                                                isXs
                                                                                    ? "8px"
                                                                                    : isSmall
                                                                                      ? "4px"
                                                                                      : "6px",
                                                                            padding:
                                                                                isXs
                                                                                    ? "0.4rem"
                                                                                    : isSmall
                                                                                      ? "0.1rem"
                                                                                      : isMedium
                                                                                        ? "0.15rem"
                                                                                        : "0.2rem",
                                                                            fontWeight: 700,
                                                                            fontSize:
                                                                                isXs
                                                                                    ? "1rem"
                                                                                    : isSmall
                                                                                      ? "0.65rem"
                                                                                      : isMedium
                                                                                        ? "0.75rem"
                                                                                        : "0.85rem",
                                                                            flexShrink: 0,
                                                                        }}
                                                                    />
                                                                    <button
                                                                        onClick={() =>
                                                                            handleUpdateQuantity(
                                                                                item.id,
                                                                                item.quantity +
                                                                                    1,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            !isEditable
                                                                        }
                                                                        className="border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-100"
                                                                        style={{
                                                                            width: isXs
                                                                                ? "32px"
                                                                                : isSmall
                                                                                  ? "16px"
                                                                                  : isMedium
                                                                                    ? "18px"
                                                                                    : "25px",
                                                                            height: isXs
                                                                                ? "32px"
                                                                                : isSmall
                                                                                  ? "16px"
                                                                                  : isMedium
                                                                                    ? "18px"
                                                                                    : "25px",
                                                                            borderRadius:
                                                                                isXs
                                                                                    ? "6px"
                                                                                    : isSmall
                                                                                      ? "4px"
                                                                                      : "6px",
                                                                            cursor: isEditable
                                                                                ? "pointer"
                                                                                : "not-allowed",
                                                                            fontSize:
                                                                                isXs
                                                                                    ? "1rem"
                                                                                    : isSmall
                                                                                      ? "0.7rem"
                                                                                      : isMedium
                                                                                        ? "0.75rem"
                                                                                        : "0.8rem",
                                                                            display:
                                                                                "flex",
                                                                            alignItems:
                                                                                "center",
                                                                            justifyContent:
                                                                                "center",
                                                                            padding: 0,
                                                                            flexShrink: 0,
                                                                        }}
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}

                                                        {/* Nombre del producto */}
                                                        <div
                                                            style={{
                                                                flex: "1",
                                                                minWidth: 0,
                                                                paddingLeft:
                                                                    "4px",
                                                                paddingRight:
                                                                    "4px",
                                                            }}
                                                        >
                                                            <div
                                                                className="text-slate-800 dark:text-slate-100"
                                                                style={{
                                                                    fontWeight: 700,
                                                                    fontSize:
                                                                        isSmall
                                                                            ? "0.7rem"
                                                                            : isMedium
                                                                              ? "0.75rem"
                                                                              : "0.8125rem",
                                                                    overflow:
                                                                        "hidden",
                                                                    whiteSpace:
                                                                        "normal",
                                                                    wordBreak:
                                                                        "break-word",
                                                                    lineHeight:
                                                                        "1.2",
                                                                    display:
                                                                        "flex",
                                                                    alignItems:
                                                                        "center",
                                                                    gap: "4px",
                                                                }}
                                                            >
                                                                {item.name}
                                                                {item.product &&
                                                                    productStockLabel(
                                                                        item.product,
                                                                    ) && (
                                                                        <span className="shrink-0 text-[0.65rem] font-semibold text-slate-500 dark:text-slate-400">
                                                                            (
                                                                            {productStockLabel(
                                                                                item.product,
                                                                            )}
                                                                            )
                                                                        </span>
                                                                    )}
                                                            </div>
                                                            {/* NUEVO: Descuento en el carrito */}
                                                            {(item.discount ??
                                                                0) > 0 && (
                                                                <div className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                                                    <span>
                                                                        -S/{" "}
                                                                        {item.discount!.toFixed(
                                                                            2,
                                                                        )}
                                                                    </span>
                                                                    {item.promotionName && (
                                                                        <span className="text-gray-400">
                                                                            (
                                                                            {
                                                                                item.promotionName
                                                                            }
                                                                            )
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {/* NUEVO: Componentes del combo */}
                                                            {item.isCombo &&
                                                                item.comboComponents && (
                                                                    <div className="mt-1 space-y-0.5 text-xs text-orange-600 dark:text-orange-300">
                                                                        {item.comboComponents.map(
                                                                            (
                                                                                comp: any,
                                                                            ) => (
                                                                                <div
                                                                                    key={
                                                                                        comp.scopeId
                                                                                    }
                                                                                >
                                                                                    •{" "}
                                                                                    {
                                                                                        comp
                                                                                            .product
                                                                                            .name
                                                                                    }
                                                                                </div>
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                )}
                                                        </div>

                                                        {/* Precio total */}
                                                        {/* Agregamos un icono de regalo si es un ítem de regalo */}
                                                        {isGift && (
                                                            <div
                                                                className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                                                                style={{
                                                                    flexShrink: 0,
                                                                }}
                                                            >
                                                                🎁
                                                            </div>
                                                        )}
                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: isXs
                                                                    ? "0.5rem"
                                                                    : isSmall
                                                                      ? "0.2rem"
                                                                      : isMedium
                                                                        ? "0.3rem"
                                                                        : "0.35rem",
                                                                flexShrink: 0,
                                                                minWidth: isXs
                                                                    ? "70px"
                                                                    : isSmall
                                                                      ? "55px"
                                                                      : isMedium
                                                                        ? "65px"
                                                                        : "75px",
                                                                marginLeft:
                                                                    isGift
                                                                        ? "0"
                                                                        : "auto",
                                                            }}
                                                        >
                                                            <div
                                                                className="text-slate-800 dark:text-slate-100"
                                                                style={{
                                                                    fontWeight: 700,
                                                                    fontSize:
                                                                        isXs
                                                                            ? "0.85rem"
                                                                            : isSmall
                                                                              ? "0.7rem"
                                                                              : isMedium
                                                                                ? "0.75rem"
                                                                                : "0.8125rem",
                                                                    textAlign:
                                                                        "right",
                                                                }}
                                                            >
                                                                S/{" "}
                                                                {item.total.toFixed(
                                                                    2,
                                                                )}
                                                            </div>
                                                        </div>

                                                        {!isGift && (
                                                            <>
                                                                {/* Icono observaciones - abre el modal para escribir observaciones al plato */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleOpenObservationModal(
                                                                            item.id,
                                                                        )
                                                                    }
                                                                    className={`border ${
                                                                        hasObservationContent
                                                                            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                                                            : "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                                                    }`}
                                                                    style={{
                                                                        padding:
                                                                            isSmall
                                                                                ? "0.1rem 0.35rem"
                                                                                : isMedium
                                                                                  ? "0.15rem 0.4rem"
                                                                                  : "0.15rem 0.45rem",
                                                                        borderRadius: 999,
                                                                        fontSize:
                                                                            isXs
                                                                                ? "1.25rem"
                                                                                : isSmall
                                                                                  ? "0.7rem"
                                                                                  : isMedium
                                                                                    ? "0.85rem"
                                                                                    : "1.1rem",
                                                                        fontWeight: 600,
                                                                        cursor: "pointer",
                                                                        flexShrink: 0,
                                                                        lineHeight: 1,
                                                                        opacity: 1,
                                                                        position:
                                                                            "relative",
                                                                    }}
                                                                    title={
                                                                        canEditNotes
                                                                            ? hasObservationContent
                                                                                ? item.notes
                                                                                    ? "Editar observaciones"
                                                                                    : `${selectedObservations[item.id]?.size ?? 0} observación(es) seleccionada(s)`
                                                                                : "Escribir observación al plato"
                                                                            : hasObservationContent
                                                                              ? "Ver observaciones (solo lectura)"
                                                                              : "Ver observaciones (solo lectura; sin notas registradas)"
                                                                    }
                                                                >
                                                                    📋
                                                                    {hasObservationContent && (
                                                                        <span
                                                                            style={{
                                                                                position:
                                                                                    "absolute",
                                                                                top: "-4px",
                                                                                right: "-4px",
                                                                                background:
                                                                                    "#3b82f6",
                                                                                color: "white",
                                                                                borderRadius:
                                                                                    "50%",
                                                                                width: "12px",
                                                                                height: "12px",
                                                                                fontSize:
                                                                                    "8px",
                                                                                display:
                                                                                    "flex",
                                                                                alignItems:
                                                                                    "center",
                                                                                justifyContent:
                                                                                    "center",
                                                                                fontWeight: 700,
                                                                            }}
                                                                        >
                                                                            {item.notes
                                                                                ? "!"
                                                                                : selectedObservations[
                                                                                      item
                                                                                          .id
                                                                                  ]
                                                                                      ?.size}
                                                                        </span>
                                                                    )}
                                                                </button>

                                                                {/* Icono tachito */}
                                                                <button
                                                                    onClick={() =>
                                                                        handleRemoveItem(
                                                                            item.id,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        !isEditable
                                                                    }
                                                                    className="text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-red-400 dark:hover:text-red-300 dark:disabled:text-slate-600"
                                                                    style={{
                                                                        background:
                                                                            "transparent",
                                                                        border: "none",
                                                                        cursor: isEditable
                                                                            ? "pointer"
                                                                            : "not-allowed",
                                                                        fontSize:
                                                                            isXs
                                                                                ? "1.35rem"
                                                                                : isSmall
                                                                                  ? "0.85rem"
                                                                                  : isMedium
                                                                                    ? "0.95rem"
                                                                                    : "1.15rem",
                                                                        padding:
                                                                            isXs
                                                                                ? "0.5rem"
                                                                                : "0.15rem",
                                                                        flexShrink: 0,
                                                                        display:
                                                                            "flex",
                                                                        alignItems:
                                                                            "center",
                                                                        justifyContent:
                                                                            "center",
                                                                        lineHeight: 1,
                                                                    }}
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div
                                className="border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                                style={{
                                    borderRadius: isSmall
                                        ? "10px"
                                        : isMedium
                                          ? "12px"
                                          : "14px",
                                    borderWidth: "1px",
                                    borderStyle: "solid",
                                    padding: isSmall
                                        ? "0.5rem"
                                        : isMedium
                                          ? "0.625rem"
                                          : "0.75rem",
                                    display: "grid",
                                    gap: isSmall
                                        ? "0.25rem"
                                        : isMedium
                                          ? "0.375rem"
                                          : "0.5rem",
                                    flexShrink: 0,
                                }}
                            >
                                <div
                                    className="text-slate-600 dark:text-slate-300"
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                    }}
                                >
                                    <span>Subtotal</span>
                                    <b>S/ {subtotal.toFixed(2)}</b>
                                </div>
                                <div
                                    className="text-slate-600 dark:text-slate-300"
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                    }}
                                >
                                    <span>Impuestos</span>
                                    <b>S/ {taxes.toFixed(2)}</b>
                                </div>
                                <div
                                    className="bg-slate-200 dark:bg-slate-700"
                                    style={{
                                        height: 1,
                                        margin: isSmall
                                            ? "0.125rem 0"
                                            : isMedium
                                              ? "0.25rem 0"
                                              : "0.25rem 0",
                                    }}
                                />
                                <div
                                    className="text-slate-900 dark:text-slate-100"
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: isSmall
                                            ? "1rem"
                                            : isMedium
                                              ? "1.125rem"
                                              : "1.25rem",
                                        fontWeight: 900,
                                    }}
                                >
                                    <span>TOTAL</span>
                                    <span>S/ {total.toFixed(2)}</span>
                                </div>
                            </div>

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: (() => {
                                        const cashCol =
                                            onOpenCash && canNavigateToCashPay
                                                ? 1
                                                : 0;
                                        const n =
                                            2 +
                                            (isExistingOrder ? 1 : 0) +
                                            cashCol;
                                        if (isSmall) return "1fr";
                                        if (isMedium)
                                            return n <= 2
                                                ? "1fr 1fr"
                                                : "repeat(2, 1fr)";
                                        return `repeat(${n}, 1fr)`;
                                    })(),
                                    gap: isSmall
                                        ? "0.5rem"
                                        : isMedium
                                          ? "0.625rem"
                                          : "0.75rem",
                                    flexShrink: 0,
                                }}
                            >
                                <button
                                    onClick={() =>
                                        handleSaveOrder("PROCESSING", true)
                                    }
                                    disabled={
                                        isSaving || orderItems.length === 0
                                    }
                                    className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 font-bold text-indigo-700 transition-all duration-150 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/45 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                                    style={{
                                        padding: isSmall
                                            ? "0.5rem"
                                            : isMedium
                                              ? "0.625rem"
                                              : "0.75rem",
                                        borderRadius: isSmall
                                            ? "8px"
                                            : isMedium
                                              ? "10px"
                                              : "12px",
                                        fontWeight: 800,
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                    }}
                                >
                                    {isSaving ? "Guardando..." : "Enviar orden"}
                                </button>
                                <button
                                    onClick={() =>
                                        handleSaveOrder("PROCESSING", false)
                                    }
                                    disabled={
                                        isSaving || orderItems.length === 0
                                    }
                                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 font-bold text-emerald-700 transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/45 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                                    style={{
                                        padding: isSmall
                                            ? "0.5rem"
                                            : isMedium
                                              ? "0.625rem"
                                              : "0.75rem",
                                        borderRadius: isSmall
                                            ? "8px"
                                            : isMedium
                                              ? "10px"
                                              : "12px",
                                        fontWeight: 800,
                                        fontSize: isSmall
                                            ? "0.7rem"
                                            : isMedium
                                              ? "0.75rem"
                                              : "0.8125rem",
                                    }}
                                >
                                    {isSaving
                                        ? "Guardando..."
                                        : "Enviar orden (sin imprimir)"}
                                </button>
                         
                                {/* Botón de Precuenta - solo visible cuando hay una orden existente */}
                                {isExistingOrder && (
                                    <button
                                        onClick={handlePrecuenta}
                                        disabled={
                                            !existingOperation ||
                                            existingOperation.status ===
                                                "COMPLETED" ||
                                            isPrintingPrecuenta ||
                                            isLoadingExistingOrder
                                        }
                                        className="rounded-xl border border-amber-200 bg-amber-50 px-3 font-bold text-amber-700 transition-all duration-150 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:border-amber-600 dark:hover:bg-amber-900/45 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                                        style={{
                                            padding: isSmall
                                                ? "0.5rem"
                                                : isMedium
                                                  ? "0.625rem"
                                                  : "0.75rem",
                                            borderRadius: isSmall
                                                ? "8px"
                                                : isMedium
                                                  ? "10px"
                                                  : "12px",
                                            fontWeight: 800,
                                            fontSize: isSmall
                                                ? "0.75rem"
                                                : isMedium
                                                  ? "0.8125rem"
                                                  : "0.875rem",
                                        }}
                                    >
                                        {isPrintingPrecuenta
                                            ? "🖨️ Imprimiendo..."
                                            : "🧾 Precuenta"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal de Observaciones */}
                {showObservationModal &&
                    (() => {
                        const item = orderItems.find(
                            (i) => i.id === showObservationModal,
                        );
                        if (!item) return null;

                        const observations =
                            productObservations[showObservationModal] ??
                            EMPTY_OBSERVATION_OPTIONS;
                        const selectedIds =
                            selectedObservations[showObservationModal] ??
                            EMPTY_SELECTED_OBSERVATION_IDS;
                        const canEdit = !isExistingOrder || item.isNew;

                        return (
                            <ModalObservation
                                key={showObservationModal}
                                isOpen={true}
                                onClose={() => setShowObservationModal(null)}
                                observations={observations}
                                selectedObservationIds={selectedIds}
                                onApply={(selectedIds, manualNotes) =>
                                    handleApplyObservations(
                                        showObservationModal,
                                        selectedIds,
                                        manualNotes,
                                    )
                                }
                                productName={item.name}
                                currentNotes={item.notes || ""}
                                canEdit={canEdit}
                            />
                        );
                    })()}

                {/* Teclado virtual: como login — solo mitad inferior; en escritorio ancho ~50% alineado a la izquierda (columna catálogo) */}
                {isKeyboardVisible && (
                    <div
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            zIndex: 1200,
                            width: keyboardCompact ? "100%" : "50%",
                            maxWidth: keyboardCompact
                                ? "100%"
                                : "min(50vw, 720px)",
                            maxHeight: "min(50vh, 50dvh)",
                            display: "flex",
                            flexDirection: "column",
                            backgroundColor: "#f8fafc",
                            borderTop: "1px solid #e2e8f0",
                            borderRight: keyboardCompact
                                ? "none"
                                : "1px solid #e2e8f0",
                            borderTopRightRadius: keyboardCompact
                                ? 0
                                : isMedium
                                  ? 10
                                  : 12,
                            boxShadow: "4px -8px 32px rgba(0,0,0,0.08)",
                            padding: keyboardTight
                                ? "0.35rem 0.3rem"
                                : isXs || isSmall
                                  ? "0.5rem 0.5rem"
                                  : isMedium
                                    ? "0.65rem 0.85rem"
                                    : "0.75rem 1rem",
                            paddingBottom: `max(${keyboardTight ? "0.35rem" : "0.5rem"}, env(safe-area-inset-bottom))`,
                            animation: "slideUp 0.3s ease-out",
                            boxSizing: "border-box",
                            overflow: "hidden",
                            touchAction: "manipulation",
                        }}
                    >
                        <div
                            style={{
                                width: "100%",
                                flex: 1,
                                minHeight: 0,
                                overflowX: "hidden",
                                overflowY: "auto",
                                WebkitOverflowScrolling: "touch",
                                boxSizing: "border-box",
                            }}
                        >
                            <VirtualKeyboard
                                onKeyPress={handleVirtualKeyPress}
                                onBackspace={handleVirtualBackspace}
                                compact
                                tight={keyboardTight}
                                onClose={() => setIsKeyboardVisible(false)}
                                onEnter={() => {
                                    if (productsList.length > 0) {
                                        handleAddProduct(productsList[0].id, 1);
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* NUEVO: Modal de selección de combos */}
                {showComboModal && companyData?.branch?.id && (
                    <ComboSelectorModal
                        branchId={companyData.branch.id}
                        initialProduct={pendingComboProduct}
                        onConfirm={handleAddCombo}
                        onClose={() => {
                            setShowComboModal(false);
                            setPendingComboProduct(null);
                        }}
                    />
                )}
            </div>
        </>
    );
};

export default React.memo(Order);
