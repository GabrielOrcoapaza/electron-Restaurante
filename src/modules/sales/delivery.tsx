import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { useUserPermissions } from "../../hooks/useUserPermissions";
import { useResponsive } from "../../hooks/useResponsive";
import { useToast } from "../../context/ToastContext";
import {
    getBranchIgvPercentage,
    getBranchTaxAffectationType,
} from "../../utils/getBranchIgvPercentage";
import {
    CREATE_SALE_CARRY_OUT,
    GET_OR_CREATE_DELIVERY_PRODUCT,
} from "../../graphql/mutations";
import {
    GET_CATEGORIES_BY_BRANCH_LIGHT,
    GET_SUBCATEGORIES_BY_CATEGORY,
    GET_PRODUCTS_BY_CATEGORY,
    GET_PRODUCTS_BY_BRANCH,
    SEARCH_PRODUCTS,
    GET_PRODUCT_BY_CODE,
    GET_DOCUMENTS_WITH_SERIALS,
    GET_CASH_REGISTERS_BY_BRANCH,
    GET_PERSONS_BY_BRANCH,
    GET_MODIFIERS_BY_SUBCATEGORY,
    SEARCH_PERSON_BY_DOCUMENT,
    GET_ACTIVE_PROMOTIONS,
    GET_ACTIVE_COMBOS,
    GET_USERS_BY_BRANCH_ROLE,
} from "../../graphql/queries";
import { CREATE_PERSON } from "../../graphql/mutations";
import ModalObservation from "./modalObservation";
import PayDeliveryCheckout, {
    type DeliveryPaymentLine,
    type EditClientForModal,
} from "./payDelivery";
import { PosProductCard } from "../../components/PosProductCard";
import {
    formatLocalDateYYYYMMDD,
    formatLocalTimeHHMMSS,
    formatInstantISO,
} from "../../utils/localDateTime";
import {
    findBestDiscountPromotion,
    calculateLineDiscount,
    computeNxMFreeSet,
    findBadgePromotion,
    promotionBadgeLabel,
    type CartLine,
} from "../../utils/promotionUtils";
import type { ComboProduct, IPromotion } from "../../types/promotions";
import { productStockLabel } from "../../utils/productStockDisplay";
import { getFullImageUrl } from "../../utils/getFullImageUrl";
import {
    buildCartStockUsage,
    canAddComboQuantity,
    canAddMoreProduct,
    canAddProductQuantity,
    canSetItemQuantity,
    isStockWarningMessage,
} from "../../utils/operationStock";
import { ComboSelectorModal } from "../../components/ComboSelectorModal";
import type { DocumentPreviewAction } from "../../utils/issuedDocumentPrintWithPreview";
import { DocumentPrintPreviewModal } from "../../components/DocumentPrintPreviewModal";
import { invokeLocalIssuedDocumentPrint } from "../../utils/localDocumentPrint";
import { resolveClientDeviceIdForPrint } from "../../utils/deviceIdForPrint";
import { getLocalTicketPrinterStorage } from "../../utils/localPrinterPreference";
import {
    roundMoney2,
    unitValueFromInclusivePrice,
} from "../../utils/taxAmounts";
import {
    buildQuickAddComponents,
    canDeliveryQuickAddCombo,
    comboSelectionsMatch,
    isDeliveryQuickAddCombo,
} from "../../utils/comboQuickAdd";

type CartItem = {
    id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
    notes: string;
    subcategoryId?: string;
    product?: any;
    discount?: number;
    promotionName?: string | null;
    isCombo?: boolean;
    comboComponents?: any[];
    originalPrice?: number;
    manualPriceEdited?: boolean;
};

// Tipo para cliente
type Person = {
    id: string;
    name: string;
    documentType: string;
    documentNumber: string;
};

const getProductQtyInCart = (cartItems: CartItem[], productId: string) =>
    cartItems
        .filter(
            (i) =>
                String(i.productId) === String(productId) &&
                !i.isCombo &&
                !i.notes,
        )
        .reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

const SearchIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
    </svg>
);

const ChevronLeft = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
        />
    </svg>
);

const ChevronRight = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
        />
    </svg>
);

const Delivery: React.FC = () => {
    const { companyData, user, getDeviceId, getMacAddress } =
        useAuth();
    const { showToast } = useToast();
    const { hasPermission } = useUserPermissions();
    const { breakpoint, isPosTouchScreen } = useResponsive();
    const canEditPrice = hasPermission("products.edit_prices_delivery");

    // Responsive: sm 640-767, md 768-1023, lg 1024-1279, xl 1280-1535, 2xl >=1536
    const isSmall = breakpoint === "sm";
    const isMedium = breakpoint === "md";
    const isCompactPos = isMedium || isPosTouchScreen;

    // IGV de la sucursal
    const igvPercentageFromBranch = getBranchIgvPercentage(companyData);
    const branchTaxAffectationType = getBranchTaxAffectationType(companyData);

    // Estados
    const [selectedCategory, setSelectedCategory] = useState<string | null>(
        null,
    );
    const [selectedSubcategory, setSelectedSubcategory] = useState<
        string | null
    >(null);
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [searchByCodeOnly, setSearchByCodeOnly] = useState<boolean>(false);
    const [showSearch, setShowSearch] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Estados para el pago
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [personSearchTerm, setPersonSearchTerm] = useState<string>("");
    const [selectedDocument, setSelectedDocument] = useState<string>("");
    const [showObservationModal, setShowObservationModal] = useState<
        string | null
    >(null);
    const [productObservations, setProductObservations] = useState<
        Record<string, any[]>
    >({});
    const [selectedObservations, setSelectedObservations] = useState<
        Record<string, Set<string>>
    >({});
    const [selectedSerial, setSelectedSerial] = useState<string>("");
    const [selectedCashRegister, setSelectedCashRegister] =
        useState<string>("");
    const [paymentLines, setPaymentLines] = useState<DeliveryPaymentLine[]>([
        { id: "1", method: "CASH", amount: 0, referenceNumber: "" },
    ]);
    // Descuento: solo uno a la vez — monto fijo (S/) o porcentaje (%)
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [discountPercent, setDiscountPercent] = useState<number>(0);

    // Delivery: motorizado asignado y costo de envío (se agrega al carrito como detalle de venta)
    const [selectedDriverId, setSelectedDriverId] = useState<string>("");
    const [deliveryCost, setDeliveryCost] = useState<number>(0);
    const [deliveryProductId, setDeliveryProductId] = useState<string | null>(
        null,
    );
    // Observación general de la venta (opcional)
    const [saleObservation, setSaleObservation] = useState<string>("");
    // Vista de cobro (se muestra al hacer click en Procesar Venta)
    const [showCheckout, setShowCheckout] = useState(false);
    const [showCreateClientModal, setShowCreateClientModal] = useState(false);
    const [showEditClientModal, setShowEditClientModal] = useState(false);
    const [editClientForModal, setEditClientForModal] =
        useState<EditClientForModal | null>(null);
    const [deliveryDocPreview, setDeliveryDocPreview] = useState<{
        title: string;
    } | null>(null);
    const deliveryDocPreviewResolverRef = useRef<
        ((action: DocumentPreviewAction) => void) | null
    >(null);
    const categoryScrollRef = useRef<HTMLDivElement>(null);

    // Estados para combos y promociones
    const { data: promotionsData } = useQuery(GET_ACTIVE_PROMOTIONS, {
        variables: { branchId: companyData?.branch?.id },
        skip: !companyData?.branch?.id,
        fetchPolicy: "network-only",
    });
    const [activePromotions, setActivePromotions] = useState<IPromotion[]>([]);
    const [giftMessage, setGiftMessage] = useState<string | null>(null);
    const [showComboModal, setShowComboModal] = useState(false);
    const [showCombosPanel, setShowCombosPanel] = useState(false);
    const [pendingComboProduct, setPendingComboProduct] = useState<any>(null);

    const { data: combosData, loading: combosLoading } = useQuery(
        GET_ACTIVE_COMBOS,
        {
            variables: { branchId: companyData?.branch?.id },
            skip: !companyData?.branch?.id,
            fetchPolicy: "network-only",
        },
    );
    const activeCombos: ComboProduct[] = combosData?.activeCombos ?? [];

    useEffect(() => {
        if (promotionsData?.activePromotions) {
            setActivePromotions(promotionsData.activePromotions);
        }
    }, [promotionsData]);

    // Mutación para crear venta
    const [createSaleCarryOutMutation] = useMutation(CREATE_SALE_CARRY_OUT);

    // Motorizados de la sede (rol MOTORIZADO) para el selector de delivery.
    // network-only: si no, Apollo devuelve la lista cacheada y un motorizado recién
    // registrado en "Empleados" no aparece hasta reiniciar la app.
    const { data: driversData } = useQuery(GET_USERS_BY_BRANCH_ROLE, {
        variables: {
            branchId: companyData?.branch?.id,
            role: "MOTORIZADO",
        },
        skip: !companyData?.branch?.id,
        fetchPolicy: "network-only",
    });
    const drivers = driversData?.usersByBranch ?? [];

    // Producto de servicio "Delivery" (se crea automáticamente si no existe en la sede)
    const [getOrCreateDeliveryProduct] = useMutation(
        GET_OR_CREATE_DELIVERY_PRODUCT,
    );
    useEffect(() => {
        if (!companyData?.branch?.id || deliveryProductId) return;
        getOrCreateDeliveryProduct({
            variables: { branchId: companyData.branch.id },
        })
            .then((res) => {
                const product = res.data?.getOrCreateDeliveryProduct?.product;
                if (product?.id) setDeliveryProductId(String(product.id));
            })
            .catch((e) =>
                console.error("[Delivery] getOrCreateDeliveryProduct:", e),
            );
    }, [companyData?.branch?.id, deliveryProductId, getOrCreateDeliveryProduct]);

    // Sincroniza el costo de delivery como un ítem del carrito (detalle de venta)
    const DELIVERY_ITEM_ID = "__delivery_service__";
    useEffect(() => {
        setCartItems((prev) => {
            const withoutDelivery = prev.filter(
                (i) => i.id !== DELIVERY_ITEM_ID,
            );
            if (deliveryCost > 0 && deliveryProductId) {
                return [
                    ...withoutDelivery,
                    {
                        id: DELIVERY_ITEM_ID,
                        productId: deliveryProductId,
                        name: "Delivery",
                        price: deliveryCost,
                        quantity: 1,
                        total: deliveryCost,
                        notes: "",
                        discount: 0,
                    },
                ];
            }
            return withoutDelivery;
        });
    }, [deliveryCost, deliveryProductId]);

    // Categorías sin subcategorías anidadas (menos peso al abrir delivery)
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

    // Búsqueda de productos (siempre del servidor)
    // Cuando searchByCodeOnly: usar product_by_code. Si no: searchProducts con 3+ caracteres.
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

    // Búsqueda solo por código: usa product_by_code del backend (insensible a mayúsculas/minúsculas)
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

    const subcategoriesOfCategory = selectedCategory
        ? (subcategoriesData?.subcategoriesByCategory || []).filter(
              (s: any) => s.isActive !== false,
          )
        : [];

    /** Hay subs pero el usuario aún no eligió una: mostrar grid de subs, no productos. */
    const awaitingSubcategoryPick =
        Boolean(selectedCategory) &&
        !subcategoriesLoading &&
        subcategoriesOfCategory.length > 0 &&
        !selectedSubcategory;

    // Obtener productos por categoría (siempre del servidor para precios actualizados)
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

    // Obtener todos los productos (siempre del servidor para precios y productos nuevos)
    const { data: productsByBranchData, loading: productsByBranchLoading } =
        useQuery(GET_PRODUCTS_BY_BRANCH, {
            variables: { branchId: companyData?.branch.id },
            skip: !companyData?.branch.id,
            fetchPolicy: "network-only",
        });

    const allBranchProducts = useMemo(() => {
        const all = productsByBranchData?.productsByBranch || [];
        return all.filter(
            (p: any) =>
                p.isActive !== false &&
                (p.productType === "DISH" ||
                    p.productType === "BEVERAGE" ||
                    p.productType === "PROMOTION"),
        );
    }, [productsByBranchData?.productsByBranch]);

    // Obtener documentos con sus series (siempre del servidor, no caché)
    const { data: documentsData } = useQuery(GET_DOCUMENTS_WITH_SERIALS, {
        variables: { branchId: companyData?.branch.id },
        skip: !companyData?.branch.id,
        fetchPolicy: "network-only",
    });

    const documents = documentsData?.documentsByBranch || [];

    // Obtener cajas registradoras (siempre del servidor, no caché)
    const { data: cashRegistersData } = useQuery(GET_CASH_REGISTERS_BY_BRANCH, {
        variables: { branchId: companyData?.branch.id },
        skip: !companyData?.branch.id,
        fetchPolicy: "network-only",
    });

    const cashRegisters = cashRegistersData?.cashRegistersByBranch || [];

    // Personas (clientes) de la sucursal - siempre del servidor para ver clientes nuevos
    const {
        data: clientsData,
        loading: clientsLoading,
        refetch: refetchClients,
    } = useQuery(GET_PERSONS_BY_BRANCH, {
        variables: { branchId: companyData?.branch.id },
        skip: !companyData?.branch.id,
        fetchPolicy: "network-only",
    });

    const allClients = useMemo(
        () =>
            (clientsData?.personsByBranch || []).filter(
                (person: any) =>
                    !person.isSupplier && person.isActive !== false,
            ),
        [clientsData],
    );

    // Búsqueda por documento en SUNAT / local
    const [searchPersonByDocument, { loading: sunatSearchLoading }] =
        useLazyQuery(SEARCH_PERSON_BY_DOCUMENT, {
            fetchPolicy: "network-only",
        });
    const [createPersonMutation] = useMutation(CREATE_PERSON);

    // Factura (código 01) exige cliente con RUC; 01 y 03 se envían a SUNAT (misma regla que cashPay)
    const selectedDoc = documents.find((d: any) => d.id === selectedDocument);
    const isFactura = selectedDoc?.code === "01";
    const isSunatBillableDocument =
        selectedDoc?.code === "01" || selectedDoc?.code === "03";

    const getCartLineTotal = (item: CartItem) =>
        Number(item.total) ||
        (Number(item.price) || 0) * (Number(item.quantity) || 0);

    const recalculatePromotions = useCallback(
        (items: CartItem[], promotions: IPromotion[]) => {
            if (promotions.length === 0) return items;
            const cartTotal = items.reduce(
                (sum, it) => sum + it.price * it.quantity - (it.discount ?? 0),
                0,
            );

            let updated = items.map((item) => {
                if (item.manualPriceEdited) {
                    return { ...item, discount: 0, promotionName: null };
                }
                // ✅ NUEVO: Si ya tiene descuento, mantenerlo
                if ((item.discount ?? 0) > 0) {
                    return item;
                }
                if (item.isCombo || !item.product)
                    return { ...item, discount: 0, promotionName: null };
                const promo = findBestDiscountPromotion(
                    item.product,
                    promotions,
                    cartTotal,
                );
                if (promo) {
                    return {
                        ...item,
                        discount: calculateLineDiscount(
                            item.price,
                            item.quantity,
                            promo,
                        ),
                        promotionName: promo.name,
                    };
                }
                return { ...item, discount: 0, promotionName: null };
            });

            // NxM - los más baratos del grupo quedan gratis
            const nxmPromos = promotions.filter(
                (p) => p.promotionType === "NXM",
            );
            if (nxmPromos.length > 0) {
                const lines: CartLine[] = updated
                    .map((item, idx) =>
                        item.product && !item.manualPriceEdited
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
                const freeSet = computeNxMFreeSet(lines, nxmPromos);
                freeSet.forEach(({ promoName, freeUnits }, idx) => {
                    if (
                        (updated[idx].discount ?? 0) === 0 &&
                        !updated[idx].manualPriceEdited
                    ) {
                        updated[idx] = {
                            ...updated[idx],
                            discount:
                                Math.round(
                                    updated[idx].price * freeUnits * 100,
                                ) / 100,
                            promotionName: promoName,
                        };
                    }
                });
            }

            // GIFT notification
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
            setGiftMessage(
                giftPromo
                    ? `¡Regalo disponible! ${giftPromo.giftProduct?.name} × ${
                          giftPromo.giftQuantity ?? 1
                      } — ${giftPromo.name}`
                    : null,
            );

            return updated;
        },
        [],
    );
    useEffect(() => {
        // Verificar si ya hay items con descuento
        const hasExistingDiscounts = cartItems.some(
            (item) => (item.discount ?? 0) > 0,
        );

        if (
            activePromotions.length > 0 &&
            cartItems.length > 0 &&
            !hasExistingDiscounts
        ) {
            console.log(
                "[Delivery] Recalculando promociones - sin descuentos existentes",
            );
            setCartItems((prev) =>
                recalculatePromotions(prev, activePromotions),
            );
        } else if (hasExistingDiscounts) {
            console.log(
                "[Delivery] Saltando recálculo - ya hay descuentos existentes",
            );
        }
    }, [activePromotions, cartItems.length, recalculatePromotions]);

    const filteredClients = useMemo(() => {
        let clients = (clientsData?.personsByBranch || []).filter(
            (c: any) => !c.isSupplier && c.isActive !== false,
        );
        if (isFactura) {
            clients = clients.filter(
                (c: any) => (c.documentType || "").toUpperCase() === "RUC",
            );
        }
        if (!personSearchTerm) return clients.slice(0, 50);
        const lower = personSearchTerm.toLowerCase();
        return clients
            .filter(
                (c: any) =>
                    (c.name || "").toLowerCase().includes(lower) ||
                    (c.documentNumber || "").includes(lower),
            )
            .slice(0, 50);
    }, [clientsData, personSearchTerm, isFactura]);

    // Determinar qué productos mostrar
    let products;
    let productsLoading;

    const isSearching = searchByCodeOnly
        ? searchTerm.trim().length >= 1
        : searchTerm.length >= 3;

    if (searchByCodeOnly && searchTerm.trim().length >= 1) {
        // Búsqueda solo por código: usa product_by_code del backend (insensible a mayúsculas)
        const found = productByCodeData?.productByCode;
        products = found ? [found] : [];
        productsLoading = productByCodeLoading;
    } else if (isSearching) {
        products = searchData?.searchProducts;
        productsLoading = searchLoading;

        if (!products || products.length === 0) {
            const allProducts = productsByBranchData?.productsByBranch || [];
            const searchLower = searchTerm.toLowerCase();
            products = allProducts.filter(
                (p: any) =>
                    p.name?.toLowerCase().includes(searchLower) ||
                    p.code?.toLowerCase().includes(searchLower) ||
                    p.description?.toLowerCase().includes(searchLower),
            );
        }
    } else if (selectedCategory) {
        if (subcategoriesLoading || awaitingSubcategoryPick) {
            products = [];
            productsLoading = subcategoriesLoading || productsByCategoryLoading;
        } else {
            products = productsByCategoryData?.productsByCategory;
            productsLoading = productsByCategoryLoading;
        }
    } else {
        products = allBranchProducts;
        productsLoading = productsByBranchLoading;
    }

    let productsList = products || [];

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

    // Filtrar productos por subcategoría si no estamos buscando
    if (
        !isSearching &&
        selectedCategory &&
        selectedSubcategory &&
        productsList.length > 0
    ) {
        productsList = productsList.filter(
            (p: any) => String(p.subcategoryId) === String(selectedSubcategory),
        );
    }

    if (!showCombosPanel) {
        productsList = productsList.filter(
            (p: any) => p.productType !== "PROMOTION",
        );
    }

    // Función para agregar producto al carrito
    const handleAddProduct = (productIdToAdd?: string, qtyToAdd?: number) => {
        const productId = productIdToAdd || selectedProduct;
        if (!productId) return;

        const product = productsList.find((p: any) => p.id === productId);
        if (!product) return;

        // Combo de bebidas / productos fijos → agregar directo; menú → modal de elección
        if (product.productType === "PROMOTION" && product.asPromotion) {
            if (isDeliveryQuickAddCombo(product)) {
                handleAddCombo(product, buildQuickAddComponents(product));
            } else {
                setPendingComboProduct(product);
                setShowComboModal(true);
            }
            setSearchTerm("");
            if (!productIdToAdd) {
                setSelectedProduct(null);
            }
            return;
        }

        const productPrice = parseFloat(product.salePrice) || 0;
        if (productPrice < 0) {
            showToast(
                `El producto "${product.name}" no tiene un precio válido`,
                "error",
            );
            return;
        }

        const qty = qtyToAdd ?? 1;

        const stockRunning = buildCartStockUsage(cartItems);
        const stockCheck = canAddProductQuantity(product, qty, stockRunning);
        if (!stockCheck.ok) {
            showToast(stockCheck.message ?? "Sin stock disponible", "error");
            return;
        }

        const existingItemIndex = cartItems.findIndex(
            (item) => item.productId === product.id,
        );

        if (existingItemIndex >= 0) {
            const updatedItems = [...cartItems];
            const existingItem = updatedItems[existingItemIndex];
            const validQuantity = Number(existingItem.quantity) + qty;
            const validPrice = Number(existingItem.price) || productPrice;
            updatedItems[existingItemIndex].quantity = validQuantity;
            updatedItems[existingItemIndex].total = validPrice * validQuantity;
            setCartItems(updatedItems);
        } else {
            const newItem: CartItem = {
                id: `${product.id}-${Date.now()}`,
                productId: product.id,
                name: product.name,
                price: productPrice,
                originalPrice: productPrice,
                quantity: qty,
                total: productPrice * qty,
                notes: "",
                subcategoryId: product.subcategoryId,
                product: product,
                discount: 0,
                promotionName: null,
                manualPriceEdited: false,
            };
            setCartItems([...cartItems, newItem]);
        }

        setSearchTerm("");
        if (!productIdToAdd) {
            setSelectedProduct(null);
        }
    };

    const handleRemoveProduct = (productId: string) => {
        const idx = cartItems.findIndex(
            (item) =>
                String(item.productId) === String(productId) &&
                !item.isCombo &&
                !item.notes,
        );
        if (idx < 0) return;
        const item = cartItems[idx];
        if (item.quantity <= 1) {
            setCartItems(cartItems.filter((_, i) => i !== idx));
        } else {
            const updated = [...cartItems];
            updated[idx] = {
                ...item,
                quantity: item.quantity - 1,
                total: item.price * (item.quantity - 1),
            };
            setCartItems(updated);
        }
    };

    // Handler para cuando el usuario confirma el combo desde el modal
    const handleAddCombo = (comboProduct: any, selections: any[]) => {
        const stockRunning = buildCartStockUsage(cartItems);
        const stockCheck = canAddComboQuantity(
            comboProduct.name ?? "Combo",
            selections.map((c: any) => ({
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

        const comboPrice = Number(comboProduct.salePrice) || 0;
        const existingItemIndex = cartItems.findIndex(
            (item) =>
                item.isCombo &&
                String(item.productId) === String(comboProduct.id) &&
                comboSelectionsMatch(item.comboComponents, selections),
        );

        if (existingItemIndex >= 0) {
            const updatedItems = [...cartItems];
            const existingItem = updatedItems[existingItemIndex];
            const newQuantity = Number(existingItem.quantity) + 1;
            const price = Number(existingItem.price) || comboPrice;
            updatedItems[existingItemIndex] = {
                ...existingItem,
                quantity: newQuantity,
                total: price * newQuantity,
            };
            setCartItems(updatedItems);
        } else {
            const newItem: CartItem = {
                id: `combo-${comboProduct.id}-${Date.now()}`,
                productId: comboProduct.id,
                name: comboProduct.name,
                price: comboPrice,
                originalPrice: comboPrice,
                quantity: 1,
                total: comboPrice,
                notes: "",
                product: comboProduct,
                discount: 0,
                promotionName: null,
                isCombo: true,
                comboComponents: selections,
                manualPriceEdited: false,
            };
            setCartItems([...cartItems, newItem]);
        }
        setShowComboModal(false);
        setPendingComboProduct(null);
    };

    const handleComboGridClick = (combo: ComboProduct) => {
        if (isDeliveryQuickAddCombo(combo)) {
            handleAddCombo(combo, buildQuickAddComponents(combo));
            return;
        }
        setPendingComboProduct(combo);
        setShowComboModal(true);
    };

    const toggleCombosPanel = () => {
        setShowCombosPanel((active) => {
            const next = !active;
            if (next) {
                setSearchTerm("");
                setSelectedCategory(null);
                setSelectedSubcategory(null);
            }
            return next;
        });
    };

    // Función para actualizar cantidad
    const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            handleRemoveItem(itemId);
            return;
        }

        const targetItem = cartItems.find((item) => item.id === itemId);
        if (targetItem) {
            const stockCheck = canSetItemQuantity(
                targetItem,
                newQuantity,
                cartItems,
            );
            if (!stockCheck.ok) {
                showToast(stockCheck.message ?? "Sin stock disponible", "error");
                return;
            }
        }

        const updatedItems = cartItems.map((item) => {
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
        setCartItems(updatedItems);
    };

    const handleUpdatePrice = (itemId: string, newPrice: number) => {
        if (!canEditPrice) {
            showToast(
                "No tiene permiso para editar el precio del ítem en Delivery",
                "warning",
            );
            return;
        }
        const price = Math.max(0, roundMoney2(Number(newPrice) || 0));
        const updatedItems = cartItems.map((item) => {
            if (item.id !== itemId) return item;
            const validQuantity = Number(item.quantity) || 1;
            const originalPrice = roundMoney2(
                Number(item.originalPrice ?? item.price) || 0,
            );
            const manualPriceEdited = price !== originalPrice;
            return {
                ...item,
                price,
                total: roundMoney2(price * validQuantity),
                discount: 0,
                promotionName: null,
                manualPriceEdited,
            };
        });
        setCartItems(updatedItems);
    };

    // Función para eliminar ítem
    const handleRemoveItem = (itemId: string) => {
        setCartItems(cartItems.filter((item) => item.id !== itemId));
    };

    const [getObservations] = useLazyQuery(GET_MODIFIERS_BY_SUBCATEGORY, {
        fetchPolicy: "network-only",
    });

    const handleOpenObservationModal = async (itemId: string) => {
        const item = cartItems.find((i) => i.id === itemId);
        if (!item) return;
        if (item.subcategoryId && !productObservations[itemId]) {
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
                    if (item.notes) {
                        const currentNotes = item.notes
                            .split(", ")
                            .map((n: string) => n.trim());
                        const selectedIds = new Set<string>();
                        activeObservations.forEach((obs: any) => {
                            if (currentNotes.includes(obs.note))
                                selectedIds.add(obs.id);
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
            }
        }
        setShowObservationModal(itemId);
    };

    const handleApplyObservations = (
        itemId: string,
        selectedIds: Set<string>,
        manualNotes: string,
    ) => {
        const item = cartItems.find((i) => i.id === itemId);
        if (!item) return;
        setSelectedObservations((prev) => ({ ...prev, [itemId]: selectedIds }));

        // En el nuevo flujo de ModalObservation, manualNotes ya contiene el texto completo
        // (incluyendo las etiquetas seleccionadas y notas manuales) debidamente formateado.
        const finalNotes = manualNotes.trim();

        setCartItems((prev) =>
            prev.map((i) =>
                i.id !== itemId ? i : { ...i, notes: finalNotes },
            ),
        );
        setShowObservationModal(null);
    };

    // Calcular totales CON descuentos aplicados por item
    const cartItemsTotal = cartItems.reduce((sum, item) => {
        const itemTotal = Number(item.total) || 0;
        const itemDiscount = Number(item.discount) || 0;
        return sum + (itemTotal - itemDiscount);
    }, 0);

    // Descuento global (manual) - si existe, aplicarlo sobre el total con descuentos por item
    const pct = Number(discountPercent) || 0;
    const manualDiscount = Math.max(
        0,
        pct > 0 ? (cartItemsTotal * pct) / 100 : Number(discountAmount) || 0,
    );
    const cartTotal = Math.max(0, cartItemsTotal - manualDiscount);
    const totalDiscount =
        manualDiscount +
        cartItems.reduce((sum, item) => sum + (item.discount || 0), 0);

    // Calcular IGV basado en el total final
    const igvPercentageDecimal = igvPercentageFromBranch / 100;
    const subtotal = parseFloat(
        (cartTotal / (1 + igvPercentageDecimal)).toFixed(2),
    );
    const igvAmount = parseFloat((cartTotal - subtotal).toFixed(2));

    const totalPaymentsAmount = paymentLines.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0,
    );
    const paymentsCoverDebt =
        roundMoney2(cartTotal) <= 0.01 ||
        roundMoney2(totalPaymentsAmount) >= roundMoney2(cartTotal) - 0.01;
    const remainingToPay =
        roundMoney2(cartTotal) - roundMoney2(totalPaymentsAmount);
    const changeDue = remainingToPay < 0 ? Math.abs(remainingToPay) : 0;
    const canAddDeliveryPayment =
        roundMoney2(cartTotal) > 0.01 &&
        roundMoney2(totalPaymentsAmount) < roundMoney2(cartTotal);

    const addDeliveryPayment = () => {
        if (!canAddDeliveryPayment) return;
        const remaining = roundMoney2(
            Math.max(0, cartTotal - totalPaymentsAmount),
        );
        setPaymentLines((prev) => [
            ...prev,
            {
                id: String(Date.now()),
                method: "CASH",
                amount: remaining,
                referenceNumber: "",
            },
        ]);
    };

    const removeDeliveryPayment = (id: string) => {
        setPaymentLines((prev) =>
            prev.length > 1 ? prev.filter((p) => p.id !== id) : prev,
        );
    };

    const updateDeliveryPayment = (
        id: string,
        field: keyof DeliveryPaymentLine,
        value: string | number,
    ) => {
        setPaymentLines((prev) =>
            prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
        );
    };

    useEffect(() => {
        if (!showCheckout) return;
        setPaymentLines([
            {
                id: "1",
                method: "CASH",
                amount: roundMoney2(cartTotal),
                referenceNumber: "",
            },
        ]);
    }, [showCheckout, cartTotal]);

    // Función para procesar la venta
    const handleProcessSale = async () => {
        if (cartItems.length === 0) {
            showToast("Debe agregar al menos un producto al carrito", "error");
            return;
        }

        if (!selectedDocument) {
            showToast("Debe seleccionar un tipo de documento", "error");
            return;
        }

        if (!selectedSerial) {
            showToast("Debe seleccionar una serie", "error");
            return;
        }

        // Factura (código 01) solo permite cliente con RUC; Boleta permite DNI o RUC
        if (isFactura) {
            if (!selectedPerson) {
                showToast(
                    "Para emitir una FACTURA debe seleccionar un cliente con RUC",
                    "error",
                );
                return;
            }
            if ((selectedPerson.documentType || "").toUpperCase() !== "RUC") {
                showToast(
                    "Para emitir una FACTURA el cliente debe tener un RUC válido",
                    "error",
                );
                return;
            }
        }

        if (!selectedCashRegister) {
            showToast("Debe seleccionar una caja registradora", "error");
            return;
        }

        const totalPaidCheck = paymentLines.reduce(
            (sum, p) => sum + (Number(p.amount) || 0),
            0,
        );
        if (cartTotal > 0.01 && totalPaidCheck < cartTotal - 0.01) {
            showToast(
                `La suma de los pagos debe ser al menos el total a pagar (${cartTotal.toFixed(2)}).`,
                "error",
            );
            return;
        }

        const itemsSource = isSunatBillableDocument
            ? cartItems.filter((item) => getCartLineTotal(item) > 0)
            : cartItems;

        if (
            itemsSource.some((item) => item.manualPriceEdited) &&
            !canEditPrice
        ) {
            showToast(
                "No tiene permiso para editar el precio del ítem en Delivery",
                "error",
            );
            return;
        }

        if (isSunatBillableDocument && itemsSource.length === 0) {
            showToast(
                "No se puede emitir factura o boleta solo con productos de precio cero. SUNAT exige líneas con importe mayor a cero, o use otro tipo de comprobante.",
                "error",
            );
            return;
        }

        const docForPay = documents.find(
            (d: any) => String(d.id) === String(selectedDocument),
        );
        if (!docForPay) {
            showToast("Tipo de documento no válido", "error");
            return;
        }

        const previewTitle =
            docForPay.description?.trim() || "Comprobante";

        const userAction = await new Promise<DocumentPreviewAction>(
            (resolve) => {
                deliveryDocPreviewResolverRef.current = resolve;
                setDeliveryDocPreview({ title: previewTitle });
            },
        );

        setDeliveryDocPreview(null);
        deliveryDocPreviewResolverRef.current = null;

        if (userAction === "cancel") {
            return;
        }

        const shouldPrint = userAction === "print";

        setIsSaving(true);

        try {
            const items = itemsSource.map((item) => {
                const unitPrice = parseFloat(
                    (Math.round(item.price * 100) / 100).toFixed(2),
                );
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const unitValue = unitValueFromInclusivePrice(
                    unitPrice,
                    igvPercentageFromBranch,
                );
                const notes =
                    typeof item.notes === "string" ? item.notes.trim() : "";

                return {
                    productId: String(item.productId),
                    quantity,
                    unitValue,
                    unitPrice,
                    notes,
                    isManualPrice: Boolean(item.manualPriceEdited),
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
                };
            });

            const now = new Date();
            const emissionDate = formatLocalDateYYYYMMDD(now);
            const emissionTime = formatLocalTimeHHMMSS(now);
            const resolvedDeviceId = await resolveClientDeviceIdForPrint({
                getMacAddress,
                getDeviceId,
                logPrefix: "[Delivery/venta]",
            });

            // Asegurar que los montos no tengan demasiados decimales (que podrían exceder la longitud de texto en el backend)
            const cleanCartTotal = parseFloat(cartTotal.toFixed(2));
            const cleanSubtotal = parseFloat(subtotal.toFixed(2));
            const cleanIgvAmount = parseFloat(igvAmount.toFixed(2));
            const cleanTotalDiscount = parseFloat(totalDiscount.toFixed(2));
            // Sunat exige el descuento global sobre la base imponible (sin IGV);
            // totalDiscount está expresado con IGV (mismo monto que ve el cliente en pantalla).
            const globalDiscountOnBase = parseFloat(
                (totalDiscount / (1 + igvPercentageDecimal)).toFixed(2),
            );
            
            const paymentsSum = paymentLines.reduce(
                (sum, p) => sum + (Number(p.amount) || 0),
                0,
            );
            const paymentsSumRounded = roundMoney2(paymentsSum);

            let paymentsPayload: Array<{
                cashRegisterId: string;
                paymentType: string;
                paymentMethod: string;
                transactionType: string;
                totalAmount: number;
                paidAmount: number;
                paymentDate: string;
                notes: string | null;
                referenceNumber?: string | null;
            }>;

            if (cleanCartTotal <= 0.01) {
                paymentsPayload = [
                    {
                        cashRegisterId: selectedCashRegister,
                        paymentType: "CASH",
                        paymentMethod: paymentLines[0]?.method || "CASH",
                        transactionType: "INCOME",
                        paymentDate: formatInstantISO(now),
                        totalAmount: 0,
                        paidAmount: 0,
                        notes: null,
                        referenceNumber: null,
                    },
                ];
            } else if (Math.abs(paymentsSumRounded - cleanCartTotal) <= 0.01) {
                paymentsPayload = paymentLines
                    .filter((p) => Number(p.amount) > 0)
                    .map((p) => ({
                        cashRegisterId: selectedCashRegister,
                        paymentType: "CASH",
                        paymentMethod: p.method,
                        transactionType: "INCOME" as const,
                        paymentDate: formatInstantISO(now),
                        totalAmount: roundMoney2(Number(p.amount)),
                        paidAmount: roundMoney2(Number(p.amount)),
                        notes: null,
                        referenceNumber:
                            (p.referenceNumber || "").trim() || null,
                    }));
            } else {
                const first = paymentLines.find((p) => Number(p.amount) > 0);
                paymentsPayload = [
                    {
                        cashRegisterId: selectedCashRegister,
                        paymentType: "CASH",
                        paymentMethod: first?.method || "CASH",
                        transactionType: "INCOME",
                        paymentDate: formatInstantISO(now),
                        totalAmount: cleanCartTotal,
                        paidAmount: cleanCartTotal,
                        notes: null,
                        referenceNumber: null,
                    },
                ];
            }

            if (paymentsPayload.length === 0) {
                showToast(
                    "Agregue al menos un pago con monto mayor a 0",
                    "error",
                );
                setIsSaving(false);
                return;
            }

            const variables: any = {
                branchId: companyData?.branch.id,
                userId: user?.id,
                documentId: selectedDocument,
                serial: selectedSerial,
                emissionDate, //YYYY-MM-DD
                emissionTime, // HH:MM:SS
                currency: "PEN",
                exchangeRate: 1.0,
                itemsTotalDiscount: 0,
                globalDiscount: globalDiscountOnBase,
                globalDiscountPercent: parseFloat(
                    (Number(discountPercent) || 0).toFixed(2),
                ),
                totalDiscount: cleanTotalDiscount,
                globalDiscountOnTotal: cleanTotalDiscount,
                igvPercent: parseFloat(igvPercentageFromBranch.toFixed(2)),
                igvAmount: cleanIgvAmount,
                // Catálogo SUNAT 07: el neto va al casillero según el tipo de afectación de la sucursal
                totalTaxable:
                    branchTaxAffectationType === "10" ? cleanSubtotal : 0,
                totalUnaffected:
                    branchTaxAffectationType === "30" ? cleanSubtotal : 0,
                totalExempt:
                    branchTaxAffectationType === "20" ? cleanSubtotal : 0,
                totalFree: 0,
                totalAmount: cleanCartTotal,
                items,
                payments: paymentsPayload,
                notes: saleObservation.trim(),
                deviceId: resolvedDeviceId, // No truncar, el backend ya se encarga
                shouldPrint,
            };

            if (selectedPerson) {
                variables.personId = selectedPerson.id;
            }
            if (selectedDriverId) {
                variables.driverId = selectedDriverId;
            }

            const result = await createSaleCarryOutMutation({ variables });

            if (result.data?.createSaleCarryOut?.success) {
                const carryOutMsg = result.data?.createSaleCarryOut?.message;
                if (isStockWarningMessage(carryOutMsg)) {
                    showToast(carryOutMsg!, "warning");
                }

                if (shouldPrint) {
                    const carryOutResult = result.data
                        .createSaleCarryOut as typeof result.data.createSaleCarryOut & {
                        print_locally?: boolean;
                        print_via_bluetooth?: boolean;
                        document_data?: string | null;
                    };
                    const printLocallyFlag =
                        carryOutResult?.printLocally === true ||
                        carryOutResult?.print_locally === true;

                    const localPrintOk = await invokeLocalIssuedDocumentPrint(
                        {
                            printLocally:
                                carryOutResult?.printLocally ??
                                carryOutResult?.print_locally,
                            printViaBluetooth:
                                carryOutResult?.printViaBluetooth ??
                                carryOutResult?.print_via_bluetooth,
                            documentData:
                                carryOutResult?.documentData ??
                                carryOutResult?.document_data ??
                                null,
                        },
                        {
                            label: "venta para llevar",
                            operationId:
                                carryOutResult?.operation?.id ?? null,
                            deviceId: resolvedDeviceId ?? null,
                            localPrinterName:
                                getLocalTicketPrinterStorage().trim() || null,
                        },
                    );

                    if (printLocallyFlag && !localPrintOk) {
                        showToast(
                            "La venta se registró, pero no se pudo imprimir en la impresora local. Revise la impresora USB en Configuración o el nombre en impresoras locales.",
                            "warning",
                        );
                    }
                }

                showToast("Venta procesada exitosamente", "success");
                setShowCheckout(false);

                // Limpiar formulario
                setCartItems([]);
                setSelectedPerson(null);
                setPersonSearchTerm("");
                setSelectedDocument("");
                setSelectedSerial("");
                setPaymentLines([
                    {
                        id: "1",
                        method: "CASH",
                        amount: 0,
                        referenceNumber: "",
                    },
                ]);
                setDiscountAmount(0);
                setDiscountPercent(0);
                setSelectedCategory(null);
                setSelectedSubcategory(null);
                setShowCombosPanel(false);
                setSearchTerm("");
                setSelectedDriverId("");
                setDeliveryCost(0);
                setSaleObservation("");
            } else {
                throw new Error(
                    result.data?.createSaleCarryOut?.message ||
                        "Error al procesar la venta",
                );
            }
        } catch (error: any) {
            console.error("Error al procesar venta:", error);
            showToast(error.message || "Error al procesar la venta", "error");
        } finally {
            setIsSaving(false);
        }
    };

    // Al cambiar a Factura, quitar cliente si no tiene RUC
    useEffect(() => {
        const doc = documents.find((d: any) => d.id === selectedDocument);
        if (
            doc?.code === "01" &&
            selectedPerson &&
            (selectedPerson.documentType || "").toUpperCase() !== "RUC"
        ) {
            setSelectedPerson(null);
            setPersonSearchTerm("");
        }
    }, [selectedDocument, documents, selectedPerson]);

    const selectPersonFromClient = (client: {
        id: string;
        name?: string | null;
        documentType?: string | null;
        documentNumber?: string | null;
        address?: string | null;
        phone?: string | null;
    }) => {
        setSelectedPerson({
            id: client.id,
            name: client.name || "",
            documentType: client.documentType || "",
            documentNumber: client.documentNumber || "",
        });
        setPersonSearchTerm(client.name || "");
    };

    // Buscar cliente por documento en SUNAT o local (como en cashPay)
    const handleSearchSunat = async () => {
        const term = (personSearchTerm || "").trim().replace(/\s/g, "");
        if (!/^\d+$/.test(term) || !companyData?.branch?.id) return;
        const isRuc = term.length === 11;
        const isDni = term.length === 8;
        if (isFactura && !isRuc) return;
        if (!isRuc && !isDni) return;
        const documentType = isRuc ? "RUC" : "DNI";
        try {
            const { data } = await searchPersonByDocument({
                variables: {
                    documentType,
                    documentNumber: term,
                    branchId: companyData.branch.id,
                },
            });
            const result = data?.searchPersonByDocument;
            if (!result?.person) {
                showToast(
                    "No se encontró el documento en SUNAT ni en el sistema.",
                    "error",
                );
                return;
            }
            const person = result.person;
            if (person.id && result.foundLocally) {
                selectPersonFromClient({
                    id: person.id,
                    name: person.name || "",
                    documentType: person.documentType || documentType,
                    documentNumber: person.documentNumber || term,
                    address: person.address,
                    phone: person.phone,
                });
                const { data: refetched } = await refetchClients();
                const updated = (refetched?.personsByBranch || []).find(
                    (p: any) => p.id === person.id,
                );
                if (updated) {
                    selectPersonFromClient(updated);
                }
                return;
            }
            // Encontrado en SUNAT (o datos para crear): crear cliente y seleccionar
            const { data: createData } = await createPersonMutation({
                variables: {
                    branchId: companyData.branch.id,
                    documentType: person.documentType || documentType,
                    documentNumber: person.documentNumber || term,
                    name:
                        person.name ||
                        (documentType === "RUC" ? "Empresa" : "Cliente"),
                    address: person.address || undefined,
                    phone: person.phone || undefined,
                    email: person.email || undefined,
                    isCustomer: true,
                    isSupplier: false,
                },
            });
            if (
                createData?.createPerson?.success &&
                createData?.createPerson?.person
            ) {
                const newPerson = createData.createPerson.person;
                selectPersonFromClient({
                    id: newPerson.id,
                    name: newPerson.name || "",
                    documentType: newPerson.documentType || documentType,
                    documentNumber: newPerson.documentNumber || term,
                    address: newPerson.address || person.address,
                    phone: newPerson.phone || person.phone,
                });
            } else {
                showToast(
                    createData?.createPerson?.message ||
                        "Error al registrar el cliente.",
                    "error",
                );
            }
        } catch (err: any) {
            showToast(err?.message || "Error al buscar en SUNAT.", "error");
        }
    };

    const handleOpenEditClient = async () => {
        if (!selectedPerson?.id) return;
        let row = allClients.find(
            (c: any) => c.id === selectedPerson.id,
        ) as EditClientForModal | undefined;
        if (!row) {
            const result = await refetchClients();
            row = (result.data?.personsByBranch || []).find(
                (c: any) => c.id === selectedPerson.id,
            ) as EditClientForModal | undefined;
        }
        if (!row) {
            showToast(
                "No se pudo cargar el cliente para editar.",
                "warning",
            );
            return;
        }
        setEditClientForModal({
            id: row.id,
            name: row.name || "",
            documentType: row.documentType || "",
            documentNumber: row.documentNumber || "",
            email: row.email || undefined,
            phone: row.phone || undefined,
            address: row.address || undefined,
        });
        setShowEditClientModal(true);
    };

    const handleCreateClientSuccess = async (clientId: string) => {
        setShowCreateClientModal(false);
        const result = await refetchClients();
        const newClient = (result.data?.personsByBranch || []).find(
            (p: any) => p.id === clientId,
        );
        if (newClient) {
            selectPersonFromClient(newClient);
        }
    };

    const handleEditClientSuccess = async () => {
        if (!editClientForModal?.id) {
            setShowEditClientModal(false);
            return;
        }
        const result = await refetchClients();
        const updated = (result.data?.personsByBranch || []).find(
            (c: any) => c.id === editClientForModal.id,
        );
        if (updated) {
            selectPersonFromClient(updated);
        }
        setShowEditClientModal(false);
        setEditClientForModal(null);
    };

    // Obtener seriales del documento seleccionado
    const selectedDocumentData = documents.find(
        (d: any) => d.id === selectedDocument,
    );
    const serials = selectedDocumentData?.serials || [];

    // Por defecto: primer tipo de documento (ej. Nota de venta) y primera caja en información de pago
    useEffect(() => {
        if (documents.length > 0 && !selectedDocument) {
            setSelectedDocument(documents[0].id);
        }
    }, [documents, selectedDocument]);
    useEffect(() => {
        if (serials.length > 0 && selectedDocument && !selectedSerial) {
            setSelectedSerial(serials[0].serial);
        }
    }, [serials, selectedDocument, selectedSerial]);
    useEffect(() => {
        if (cashRegisters.length > 0 && !selectedCashRegister) {
            setSelectedCashRegister(cashRegisters[0].id);
        }
    }, [cashRegisters, selectedCashRegister]);

    const scrollCategories = useCallback((direction: "left" | "right") => {
        categoryScrollRef.current?.scrollBy({
            left: direction === "left" ? -200 : 200,
            behavior: "smooth",
        });
    }, []);

    return (
        <div className="flex h-full w-full flex-col overflow-hidden bg-white md:flex-row">
            {/* Catálogo — estilo POS */}
            <div className="flex min-h-0 flex-[2] flex-col border-r border-slate-200 bg-white">
                <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3">
                    <h2 className="shrink-0 text-base font-semibold text-slate-800">
                        Delivery
                    </h2>
                    {showSearch && (
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (
                                    e.key === "Enter" &&
                                    productsList.length > 0
                                ) {
                                    e.preventDefault();
                                    handleAddProduct(productsList[0].id, 1);
                                }
                            }}
                            placeholder={
                                searchByCodeOnly
                                    ? "Código del producto..."
                                    : "Buscar productos..."
                            }
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-[#3b82f6]"
                            autoFocus
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => setSearchByCodeOnly((v) => !v)}
                        className={`shrink-0 rounded-lg border px-2.5 py-2 text-[11px] font-semibold ${
                            searchByCodeOnly
                                ? "border-[#3b82f6] bg-[#3b82f6] text-white"
                                : "border-slate-200 bg-white text-slate-600"
                        }`}
                    >
                        Código
                    </button>
                    <button
                        type="button"
                        onClick={toggleCombosPanel}
                        className={`shrink-0 rounded-lg border px-2.5 py-2 text-[11px] font-bold ${
                            showCombosPanel
                                ? "border-orange-500 bg-orange-500 text-white"
                                : "border-orange-500 bg-white text-orange-600"
                        }`}
                    >
                        Combos
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setShowSearch((v) => {
                                if (v) setSearchTerm("");
                                return !v;
                            });
                        }}
                        className={`ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            showSearch
                                ? "bg-[#3b82f6] text-white"
                                : "text-slate-600 hover:bg-slate-100"
                        }`}
                        aria-label="Buscar productos"
                    >
                        <SearchIcon />
                    </button>
                </div>

                {giftMessage && (
                    <div className="mx-3 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                        {giftMessage}
                    </div>
                )}

                {!showCombosPanel && (
                    <>
                        <div className="flex shrink-0 items-center gap-1 border-b border-slate-100 px-2 py-2.5">
                            <button
                                type="button"
                                onClick={() => scrollCategories("left")}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                            >
                                <ChevronLeft />
                            </button>
                            <div
                                ref={categoryScrollRef}
                                className="flex flex-1 gap-2 overflow-x-auto"
                                style={{ scrollbarWidth: "none" }}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategory(null);
                                        setSelectedSubcategory(null);
                                    }}
                                    className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide ${
                                        !selectedCategory
                                            ? "border-[#3b82f6] bg-[#3b82f6] text-white"
                                            : "border-slate-300 bg-white text-slate-700"
                                    }`}
                                >
                                    Todos
                                </button>
                                {categories.map((cat: any) => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedCategory(String(cat.id));
                                            setSelectedSubcategory(null);
                                        }}
                                        className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide ${
                                            String(selectedCategory) ===
                                            String(cat.id)
                                                ? "border-[#3b82f6] bg-[#3b82f6] text-white"
                                                : "border-slate-300 bg-white text-slate-700"
                                        }`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => scrollCategories("right")}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                            >
                                <ChevronRight />
                            </button>
                        </div>

                        {subcategoriesOfCategory.length > 1 && (
                            <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-100 px-3 py-2">
                                {subcategoriesOfCategory.map((sub: any) => (
                                    <button
                                        key={sub.id}
                                        type="button"
                                        onClick={() =>
                                            setSelectedSubcategory(String(sub.id))
                                        }
                                        className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase ${
                                            String(selectedSubcategory) ===
                                            String(sub.id)
                                                ? "border-slate-600 bg-slate-700 text-white"
                                                : "border-slate-200 bg-white text-slate-600"
                                        }`}
                                    >
                                        {sub.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {showCombosPanel ? (
                        combosLoading ? (
                            <div className="flex h-full items-center justify-center text-sm text-slate-400">
                                Cargando combos...
                            </div>
                        ) : activeCombos.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-sm text-slate-400">
                                No hay combos disponibles
                            </div>
                        ) : (
                            <div
                                className="grid gap-2"
                                style={{
                                    gridTemplateColumns:
                                        "repeat(auto-fill, minmax(100px, 1fr))",
                                }}
                            >
                                {activeCombos.map((combo) => {
                                    const quickAddBlocked =
                                        isDeliveryQuickAddCombo(combo) &&
                                        !canDeliveryQuickAddCombo(combo);
                                    return (
                                        <button
                                            key={combo.id}
                                            type="button"
                                            onClick={() => {
                                                if (quickAddBlocked) {
                                                    showToast(
                                                        `Sin stock: ${combo.name}`,
                                                        "error",
                                                    );
                                                    return;
                                                }
                                                handleComboGridClick(combo);
                                            }}
                                            disabled={quickAddBlocked}
                                            className="flex flex-col overflow-hidden rounded-lg border border-orange-200 bg-white text-left disabled:opacity-50"
                                        >
                                            <div className="flex aspect-[4/3] items-center justify-center bg-orange-50 text-3xl">
                                                ⭐
                                            </div>
                                            <div className="p-2">
                                                <p className="line-clamp-2 text-[10px] font-semibold uppercase text-slate-800">
                                                    {combo.name}
                                                </p>
                                                <p className="mt-1 text-sm font-bold text-slate-900">
                                                    S/{" "}
                                                    {Number(
                                                        combo.salePrice,
                                                    ).toFixed(2)}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )
                    ) : categoriesLoading || productsLoading ? (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                            Cargando...
                        </div>
                    ) : awaitingSubcategoryPick ? (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                            Seleccione una subcategoría
                        </div>
                    ) : productsList.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                            No hay resultados
                        </div>
                    ) : (
                        <div
                            className="grid gap-2"
                            style={{
                                gridTemplateColumns:
                                    "repeat(auto-fill, minmax(100px, 1fr))",
                            }}
                        >
                            {productsList.map((product: any) => {
                                const qty = getProductQtyInCart(
                                    cartItems,
                                    product.id,
                                );
                                const promoBadge = findBadgePromotion(
                                    product,
                                    activePromotions,
                                );
                                const outOfStock =
                                    product.productType !== "PROMOTION" &&
                                    !canAddMoreProduct(product, cartItems, 1);
                                return (
                                    <PosProductCard
                                        key={product.id}
                                        name={product.name}
                                        price={
                                            parseFloat(product.salePrice) || 0
                                        }
                                        imageUrl={getFullImageUrl(product.image)}
                                        quantity={qty}
                                        badge={
                                            promoBadge
                                                ? promotionBadgeLabel(promoBadge)
                                                : undefined
                                        }
                                        disabled={outOfStock}
                                        onAdd={() =>
                                            handleAddProduct(product.id, 1)
                                        }
                                        onRemove={() =>
                                            handleRemoveProduct(product.id)
                                        }
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Panel derecho - Carrito y Pago */}
            <div className="flex w-full flex-col gap-4 overflow-hidden md:w-[380px] lg:w-[420px]">
                {/* Carrito */}
                <div className="flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
                    {!showCheckout ? (
                    <>
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-indigo-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                                />
                            </svg>
                            Pedido
                        </h3>
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                            {cartItems.length} ítems
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                        {cartItems.length === 0 ? (
                            <></>
                        ) : (
                            <div className="flex flex-col gap-2.5">
                                {cartItems.map((item) => {
                                    const isEditable = true;
                                    const hasObservationContent = Boolean(
                                        item.notes?.trim(),
                                    );

                                    return (
                                        <div
                                            key={item.id}
                                            className="border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                                            style={{
                                                borderWidth: "1px",
                                                borderStyle: "solid",
                                                borderRadius: isSmall
                                                    ? "6px"
                                                    : isCompactPos
                                                      ? "8px"
                                                      : "10px",
                                                padding: isSmall
                                                    ? "0.2rem"
                                                    : isCompactPos
                                                      ? "0.3rem"
                                                      : "0.35rem",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "flex-start",
                                                    gap: isSmall
                                                        ? "0.2rem"
                                                        : isCompactPos
                                                          ? "0.3rem"
                                                          : "0.35rem",
                                                    justifyContent:
                                                        "flex-start",
                                                    flexWrap: "nowrap",
                                                    width: "100%",
                                                }}
                                            >
                                                {/* Controles de cantidad */}
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: isSmall
                                                            ? "0.1rem"
                                                            : isCompactPos
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
                                                        disabled={!isEditable}
                                                        className="border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-100"
                                                        style={{
                                                            width: isSmall
                                                                ? "20px"
                                                                : isCompactPos
                                                                  ? "24px"
                                                                  : "28px",
                                                            height: isSmall
                                                                ? "20px"
                                                                : isCompactPos
                                                                  ? "24px"
                                                                  : "28px",
                                                            borderRadius:
                                                                isSmall
                                                                    ? "4px"
                                                                    : "6px",
                                                            cursor: isEditable
                                                                ? "pointer"
                                                                : "not-allowed",
                                                            fontSize: isSmall
                                                                ? "0.75rem"
                                                                : isCompactPos
                                                                  ? "0.85rem"
                                                                  : "0.95rem",
                                                            display: "flex",
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
                                                        value={item.quantity}
                                                        onChange={(e) =>
                                                            handleUpdateQuantity(
                                                                item.id,
                                                                parseInt(
                                                                    e.target
                                                                        .value,
                                                                ) || 0,
                                                            )
                                                        }
                                                        disabled={!isEditable}
                                                        min="0"
                                                        className="border border-slate-300 bg-white text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-100"
                                                        style={{
                                                            width: isSmall
                                                                ? "28px"
                                                                : isCompactPos
                                                                  ? "32px"
                                                                  : "38px",
                                                            textAlign: "center",
                                                            borderRadius:
                                                                isSmall
                                                                    ? "4px"
                                                                    : "6px",
                                                            padding: isSmall
                                                                ? "0.1rem"
                                                                : isCompactPos
                                                                  ? "0.15rem"
                                                                  : "0.2rem",
                                                            fontWeight: 700,
                                                            fontSize: isSmall
                                                                ? "0.65rem"
                                                                : isCompactPos
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
                                                        disabled={!isEditable}
                                                        className="border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-100"
                                                        style={{
                                                            width: isSmall
                                                                ? "16px"
                                                                : isCompactPos
                                                                  ? "18px"
                                                                  : "25px",
                                                            height: isSmall
                                                                ? "16px"
                                                                : isCompactPos
                                                                  ? "18px"
                                                                  : "25px",
                                                            borderRadius:
                                                                isSmall
                                                                    ? "4px"
                                                                    : "6px",
                                                            cursor: isEditable
                                                                ? "pointer"
                                                                : "not-allowed",
                                                            fontSize: isSmall
                                                                ? "0.7rem"
                                                                : isCompactPos
                                                                  ? "0.75rem"
                                                                  : "0.8rem",
                                                            display: "flex",
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

                                                {/* Nombre del producto + precio */}
                                                <div
                                                    className="min-w-0 flex-1"
                                                    style={{
                                                        paddingLeft: "4px",
                                                        paddingRight: "4px",
                                                    }}
                                                >
                                                    <div className="flex min-w-0 items-center gap-1.5">
                                                        <div
                                                            className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100"
                                                            style={{
                                                                fontWeight: 700,
                                                                fontSize: isSmall
                                                                    ? "0.7rem"
                                                                    : isCompactPos
                                                                      ? "0.75rem"
                                                                      : "0.8125rem",
                                                                lineHeight: "1.2",
                                                            }}
                                                            title={item.name}
                                                        >
                                                            {item.name}
                                                        </div>
                                                        {canEditPrice ? (
                                                            <div className="inline-flex shrink-0 items-center overflow-hidden rounded-md border border-indigo-200 bg-white dark:border-indigo-700 dark:bg-slate-900">
                                                                <span className="border-r border-indigo-100 px-1 py-0.5 text-[9px] font-bold leading-none text-slate-400 dark:border-indigo-800">
                                                                    S/
                                                                </span>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min={0}
                                                                    value={
                                                                        item.price === 0
                                                                            ? ""
                                                                            : item.price
                                                                    }
                                                                    onFocus={(e) => e.target.select()}
                                                                    onChange={(e) =>
                                                                        handleUpdatePrice(
                                                                            item.id,
                                                                            parseFloat(
                                                                                e.target
                                                                                    .value,
                                                                            ) || 0,
                                                                        )
                                                                    }
                                                                    className="w-11 border-none bg-transparent py-0.5 pl-1 pr-1 text-right text-[10px] font-bold text-slate-900 outline-none dark:text-slate-100"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span
                                                                className="shrink-0 font-bold text-slate-700 dark:text-slate-200"
                                                                style={{
                                                                    fontSize: isSmall
                                                                        ? "0.7rem"
                                                                        : isCompactPos
                                                                          ? "0.75rem"
                                                                          : "0.8125rem",
                                                                }}
                                                            >
                                                                S/{" "}
                                                                {item.price.toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.product &&
                                                        productStockLabel(
                                                            item.product,
                                                        ) && (
                                                            <div className="text-[0.65rem] font-semibold text-slate-500 dark:text-slate-400">
                                                                (
                                                                {productStockLabel(
                                                                    item.product,
                                                                )}
                                                                )
                                                            </div>
                                                        )}
                                                    {/* Descuento en el carrito */}
                                                    {(item.discount ?? 0) >
                                                        0 && (
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
                                                    {/* Componentes del combo */}
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

                                                {/* Icono observaciones */}
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
                                                        padding: isSmall
                                                            ? "0.1rem 0.35rem"
                                                            : isCompactPos
                                                              ? "0.15rem 0.4rem"
                                                              : "0.15rem 0.45rem",
                                                        borderRadius: 999,
                                                        fontSize: isSmall
                                                            ? "0.7rem"
                                                            : isCompactPos
                                                              ? "0.85rem"
                                                              : "1.1rem",
                                                        fontWeight: 600,
                                                        cursor: "pointer",
                                                        flexShrink: 0,
                                                        lineHeight: 1,
                                                        opacity: 1,
                                                        position: "relative",
                                                    }}
                                                    title={
                                                        hasObservationContent
                                                            ? item.notes
                                                                ? "Editar observaciones"
                                                                : "Ver observaciones"
                                                            : "Escribir observación al plato"
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
                                                                fontSize: "8px",
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                justifyContent:
                                                                    "center",
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {item.notes
                                                                ? "!"
                                                                : (selectedObservations[
                                                                      item.id
                                                                  ]?.size ?? 0)}
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
                                                    disabled={!isEditable}
                                                    className="text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-red-400 dark:hover:text-red-300 dark:disabled:text-slate-600"
                                                    style={{
                                                        background:
                                                            "transparent",
                                                        border: "none",
                                                        cursor: isEditable
                                                            ? "pointer"
                                                            : "not-allowed",
                                                        fontSize: isSmall
                                                            ? "0.85rem"
                                                            : isCompactPos
                                                              ? "0.95rem"
                                                              : "1.15rem",
                                                        padding: "0.15rem",
                                                        flexShrink: 0,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                        lineHeight: 1,
                                                    }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {/* Delivery: motorizado + costo de envío */}
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                Motorizado
                            </label>
                            <select
                                value={selectedDriverId}
                                onChange={(e) =>
                                    setSelectedDriverId(e.target.value)
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-500"
                            >
                                <option value="">Sin asignar</option>
                                {drivers.map((d: any) => (
                                    <option key={d.id} value={d.id}>
                                        {d.fullName ||
                                            `${d.firstName} ${d.lastName}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                Costo delivery (S/)
                            </label>
                            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition-all duration-200 focus-within:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-indigo-500">
                                <span className="text-xs font-bold text-slate-400">
                                    S/
                                </span>
                                <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={deliveryCost || ""}
                                    onChange={(e) =>
                                        setDeliveryCost(
                                            Math.max(
                                                0,
                                                parseFloat(e.target.value) ||
                                                    0,
                                            ),
                                        )
                                    }
                                    placeholder="0.00"
                                    className="w-full border-none bg-transparent text-xs font-bold text-slate-800 outline-none dark:text-slate-100"
                                />
                            </div>
                        </div>
                    </div>
                    {/* Observación de la venta (opcional) */}
                    <div className="mt-4 flex flex-col gap-1.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Observación (opcional)
                        </label>
                        <input
                            type="text"
                            value={saleObservation}
                            onChange={(e) =>
                                setSaleObservation(e.target.value)
                            }
                            placeholder="Ej: dejar en recepción, sin ají, referencia de la dirección..."
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-500"
                        />
                    </div>
                    {/* Totales */}
                    <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-slate-50 p-3 transition-colors duration-200 dark:bg-slate-800/50">
                        <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                            <span>Subtotal</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                S/ {subtotal.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                            <span>IGV ({igvPercentageFromBranch}%)</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                S/ {igvAmount.toFixed(2)}
                            </span>
                        </div>
                        {totalDiscount > 0 && (
                            <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                <span>Descuento</span>
                                <span>- S/ {totalDiscount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 transition-colors duration-200 dark:border-slate-700">
                            <span className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                                Total a pagar
                            </span>
                            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                                S/ {cartTotal.toFixed(2)}
                            </span>
                        </div>
                    </div>

                {/* Botón procesar */}
                <button
                    onClick={() => setShowCheckout(true)}
                    disabled={isSaving || cartItems.length === 0}
                    className={`flex items-center justify-center gap-3 rounded-2xl py-4 text-base font-black uppercase tracking-widest transition-all duration-300 shadow-lg ${
                        isSaving || cartItems.length === 0
                            ? "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 shadow-none"
                            : "bg-indigo-600 text-white shadow-indigo-600/30 hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-indigo-600/40 active:translate-y-0"
                    }`}
                >
                    {isSaving ? (
                        <>
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                            <span>Procesando...</span>
                        </>
                    ) : (
                        <>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                            </svg>
                            <span>Procesar Venta</span>
                        </>
                    )}
                </button>
                    </>
                    ) : (
                        <PayDeliveryCheckout
                            onBack={() => setShowCheckout(false)}
                            cartTotal={cartTotal}
                            subtotal={subtotal}
                            igvAmount={igvAmount}
                            igvPercentage={igvPercentageFromBranch}
                            isFactura={isFactura}
                            personSearchTerm={personSearchTerm}
                            setPersonSearchTerm={setPersonSearchTerm}
                            selectedPerson={selectedPerson}
                            setSelectedPerson={setSelectedPerson}
                            filteredClients={filteredClients}
                            clientsLoading={clientsLoading}
                            sunatSearchLoading={sunatSearchLoading}
                            isSaving={isSaving}
                            onSearchSunat={handleSearchSunat}
                            onOpenCreateClient={() => setShowCreateClientModal(true)}
                            onOpenEditClient={handleOpenEditClient}
                            showCreateClientModal={showCreateClientModal}
                            onCloseCreateClientModal={() =>
                                setShowCreateClientModal(false)
                            }
                            onCreateClientSuccess={handleCreateClientSuccess}
                            showEditClientModal={showEditClientModal}
                            editClientForModal={editClientForModal}
                            onCloseEditClientModal={() => {
                                setShowEditClientModal(false);
                                setEditClientForModal(null);
                            }}
                            onEditClientSuccess={handleEditClientSuccess}
                            showToast={showToast}
                            documents={documents}
                            selectedDocument={selectedDocument}
                            setSelectedDocument={setSelectedDocument}
                            setSelectedSerial={setSelectedSerial}
                            paymentLines={paymentLines}
                            onAddPayment={addDeliveryPayment}
                            onRemovePayment={removeDeliveryPayment}
                            onUpdatePayment={updateDeliveryPayment}
                            canAddPayment={canAddDeliveryPayment}
                            paymentsCoverDebt={paymentsCoverDebt}
                            totalPaymentsAmount={totalPaymentsAmount}
                            changeDue={changeDue}
                            discountAmount={discountAmount}
                            setDiscountAmount={setDiscountAmount}
                            discountPercent={discountPercent}
                            setDiscountPercent={setDiscountPercent}
                            totalDiscount={totalDiscount}
                            onConfirm={handleProcessSale}
                        />
                    )}
                </div>
            </div>

            {showObservationModal &&
                (() => {
                    const item = cartItems.find(
                        (i) => i.id === showObservationModal,
                    );
                    if (!item) return null;
                    const observations =
                        productObservations[showObservationModal] || [];
                    const selectedIds =
                        selectedObservations[showObservationModal] ||
                        new Set<string>();
                    return (
                        <ModalObservation
                            isOpen={true}
                            onClose={() => setShowObservationModal(null)}
                            observations={observations}
                            selectedObservationIds={selectedIds}
                            onApply={(ids, manualNotes) =>
                                handleApplyObservations(
                                    showObservationModal,
                                    ids,
                                    manualNotes,
                                )
                            }
                            productName={item.name}
                            currentNotes={item.notes || ""}
                            canEdit={true}
                        />
                    );
                })()}

            {/* Modal de selección de combos */}
            {showComboModal && companyData?.branch?.id && (
                <ComboSelectorModal
                    branchId={companyData.branch.id}
                    onClose={() => {
                        setShowComboModal(false);
                        setPendingComboProduct(null);
                    }}
                    onConfirm={handleAddCombo}
                    initialProduct={pendingComboProduct}
                    enableQuickAdd
                />
            )}

            {deliveryDocPreview && (
                <DocumentPrintPreviewModal
                    title={deliveryDocPreview.title}
                    onPrint={() => {
                        deliveryDocPreviewResolverRef.current?.("print");
                    }}
                    onContinuePay={() => {
                        deliveryDocPreviewResolverRef.current?.("continue");
                    }}
                    onCancel={() => {
                        deliveryDocPreviewResolverRef.current?.("cancel");
                    }}
                />
            )}
        </div>
    );
};

export default Delivery;
