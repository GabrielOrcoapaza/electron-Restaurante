import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../hooks/useResponsive";
import { useToast } from "../../context/ToastContext";
import { CREATE_SALE_CARRY_OUT } from "../../graphql/mutations";
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
} from "../../graphql/queries";
import { CREATE_PERSON } from "../../graphql/mutations";
import ModalObservation from "./modalObservation";
import PayDeliveryModal, { type DeliveryPaymentLine } from "./payDelivery";
import CategoryIcon from "../../components/CategoryIcon";
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
import type { IPromotion } from "../../types/promotions";
import { productStockLabel } from "../../utils/productStockDisplay";
import { ComboSelectorModal } from "../../components/ComboSelectorModal";
import type { DocumentPreviewAction } from "../../utils/issuedDocumentPrintWithPreview";
import { DocumentPrintPreviewModal } from "../../components/DocumentPrintPreviewModal";
import { invokeLocalIssuedDocumentPrint } from "../../utils/localDocumentPrint";

const roundMoney2 = (n: number): number =>
    Math.round((Number(n) || 0) * 100) / 100;

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
};

// Tipo para cliente
type Person = {
    id: string;
    name: string;
    documentType: string;
    documentNumber: string;
};

const Delivery: React.FC = () => {
    const { companyData, user, deviceId, getDeviceId, getMacAddress } =
        useAuth();
    const { showToast } = useToast();
    const { breakpoint } = useResponsive();

    // Responsive: sm 640-767, md 768-1023, lg 1024-1279, xl 1280-1535, 2xl >=1536
    const isSmall = breakpoint === "sm";
    const isMedium = breakpoint === "md";
    // Valores adaptativos
    const gridMinCol = isSmall ? "110px" : isMedium ? "125px" : "140px";

    // IGV de la sucursal
    const igvPercentageFromBranch =
        Number(companyData?.branch?.igvPercentage) || 10.5;

    // Estados
    const [selectedCategory, setSelectedCategory] = useState<string | null>(
        null,
    );
    const [selectedSubcategory, setSelectedSubcategory] = useState<
        string | null
    >(null);
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [searchByCodeOnly, setSearchByCodeOnly] = useState<boolean>(false);
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
    // Modal de información de pago (se abre al hacer click en Procesar Venta)
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [deliveryDocPreview, setDeliveryDocPreview] = useState<{
        title: string;
    } | null>(null);
    const deliveryDocPreviewResolverRef = useRef<
        ((action: DocumentPreviewAction) => void) | null
    >(null);

    // Estados para combos y promociones
    const { data: promotionsData } = useQuery(GET_ACTIVE_PROMOTIONS, {
        variables: { branchId: companyData?.branch?.id },
        skip: !companyData?.branch?.id,
        fetchPolicy: "network-only",
    });
    const [activePromotions, setActivePromotions] = useState<IPromotion[]>([]);
    const [giftMessage, setGiftMessage] = useState<string | null>(null);
    const [showComboModal, setShowComboModal] = useState(false);
    const [pendingComboProduct, setPendingComboProduct] = useState<any>(null);

    useEffect(() => {
        if (promotionsData?.activePromotions) {
            setActivePromotions(promotionsData.activePromotions);
        }
    }, [promotionsData]);

    // Mutación para crear venta
    const [createSaleCarryOutMutation] = useMutation(CREATE_SALE_CARRY_OUT);

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
                const freeSet = computeNxMFreeSet(lines, nxmPromos);
                freeSet.forEach(({ promoName, freeUnits }, idx) => {
                    // ✅ NUEVO: Solo aplicar si no tiene descuento
                    if ((updated[idx].discount ?? 0) === 0) {
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
        products = productsByBranchData?.productsByBranch;
        productsLoading = productsByBranchLoading;
    }

    let productsList = products || [];

    // Flags de navegación para la grilla
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

    // Función para agregar producto al carrito (permite precio cero y productos con precio)
    const handleAddProduct = (productIdToAdd?: string, qtyToAdd?: number) => {
        const productId = productIdToAdd || selectedProduct;
        if (!productId) return;

        const product = productsList.find((p: any) => p.id === productId);
        if (!product) return;

        // Si es un combo (tipo PROMOTION), abrir modal de selección de componentes
        if (product.productType === "PROMOTION" && product.asPromotion) {
            setPendingComboProduct(product);
            setShowComboModal(true);
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
                quantity: qty,
                total: productPrice * qty,
                notes: "",
                subcategoryId: product.subcategoryId,
                product: product,
                discount: 0,
                promotionName: null,
            };
            setCartItems([...cartItems, newItem]);
        }

        setSearchTerm("");
        if (!productIdToAdd) {
            setSelectedProduct(null);
        }
    };

    // Handler para cuando el usuario confirma el combo desde el modal
    const handleAddCombo = (comboProduct: any, selections: any[]) => {
        const newItem: CartItem = {
            id: `combo-${comboProduct.id}-${Date.now()}`,
            productId: comboProduct.id,
            name: comboProduct.name,
            price: comboProduct.salePrice,
            quantity: 1,
            total: comboProduct.salePrice,
            notes: "",
            product: comboProduct,
            discount: 0,
            promotionName: null,
            isCombo: true,
            comboComponents: selections,
        };
        setCartItems([...cartItems, newItem]);
        setShowComboModal(false);
        setPendingComboProduct(null);
    };

    // Función para actualizar cantidad
    const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            handleRemoveItem(itemId);
            return;
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
        if (!showPaymentModal) return;
        setPaymentLines([
            {
                id: "1",
                method: "CASH",
                amount: roundMoney2(cartTotal),
                referenceNumber: "",
            },
        ]);
    }, [showPaymentModal]);

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
            const igvRate = igvPercentageFromBranch / 100;

            const items = itemsSource.map((item) => {
                const unitPrice = parseFloat(
                    (Math.round(item.price * 100) / 100).toFixed(2),
                );
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const unitValue = parseFloat(
                    (
                        Math.round((unitPrice / (1 + igvRate)) * 100) / 100
                    ).toFixed(2),
                );
                const notes =
                    typeof item.notes === "string" ? item.notes.trim() : "";

                return {
                    productId: String(item.productId),
                    quantity,
                    unitValue,
                    unitPrice,
                    notes,
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
            // Obtener deviceId o MAC address
            let resolvedDeviceId: string;
            if (deviceId) {
                resolvedDeviceId = deviceId;
            } else {
                try {
                    resolvedDeviceId = await getMacAddress();
                } catch (error) {
                    console.error("Error al obtener MAC address:", error);
                    resolvedDeviceId = getDeviceId();
                }
            }

            // Asegurar que los montos no tengan demasiados decimales (que podrían exceder la longitud de texto en el backend)
            const cleanCartTotal = parseFloat(cartTotal.toFixed(2));
            const cleanSubtotal = parseFloat(subtotal.toFixed(2));
            const cleanIgvAmount = parseFloat(igvAmount.toFixed(2));
            const cleanTotalDiscount = parseFloat(totalDiscount.toFixed(2));

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
                globalDiscount: cleanTotalDiscount,
                globalDiscountPercent: parseFloat(
                    (Number(discountPercent) || 0).toFixed(2),
                ),
                totalDiscount: cleanTotalDiscount,
                globalDiscountOnTotal: cleanTotalDiscount,
                igvPercent: parseFloat(igvPercentageFromBranch.toFixed(2)),
                igvAmount: cleanIgvAmount,
                totalTaxable: cleanSubtotal,
                totalUnaffected: 0,
                totalExempt: 0,
                totalFree: 0,
                totalAmount: cleanCartTotal,
                items,
                payments: paymentsPayload,
                notes: "",
                deviceId: resolvedDeviceId, // No truncar, el backend ya se encarga
                shouldPrint,
            };

            if (selectedPerson) {
                variables.personId = selectedPerson.id;
            }

            const result = await createSaleCarryOutMutation({ variables });

            if (result.data?.createSaleCarryOut?.success) {
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
                        },
                    );

                    if (printLocallyFlag && !localPrintOk) {
                        showToast(
                            "La venta se registró, pero no se pudo imprimir en la impresora local.",
                            "warning",
                        );
                    }
                }

                showToast("Venta procesada exitosamente", "success");
                setShowPaymentModal(false);

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
                setSearchTerm("");
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
                setSelectedPerson({
                    id: person.id,
                    name: person.name || "",
                    documentType: person.documentType || documentType,
                    documentNumber: person.documentNumber || term,
                });
                setPersonSearchTerm(person.name || "");
                const { data: refetched } = await refetchClients();
                const updated = (refetched?.personsByBranch || []).find(
                    (p: any) => p.id === person.id,
                );
                if (updated?.name) {
                    setPersonSearchTerm(updated.name);
                    setSelectedPerson((prev) =>
                        prev ? { ...prev, name: updated.name } : null,
                    );
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
                setSelectedPerson({
                    id: newPerson.id,
                    name: newPerson.name || "",
                    documentType: newPerson.documentType || documentType,
                    documentNumber: newPerson.documentNumber || term,
                });
                setPersonSearchTerm(newPerson.name || "");
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

    return (
        <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50 p-2 transition-colors duration-200 dark:bg-slate-950 md:flex-row md:gap-4 md:p-4">
            {/* Panel izquierdo - Productos */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-4">
                {/* Búsqueda */}
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900 md:p-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
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
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder={
                                    searchByCodeOnly
                                        ? "Código del producto..."
                                        : "Buscar productos..."
                                }
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
                                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:text-base"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setSearchByCodeOnly((v) => !v)}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all duration-200 md:px-4 md:text-sm ${
                                searchByCodeOnly
                                    ? "border-indigo-500 bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                        >
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
                                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                                />
                            </svg>
                            <span className="hidden sm:inline">
                                Solo código
                            </span>
                            <span className="sm:hidden">Código</span>
                        </button>
                        <button
                            onClick={() => setShowComboModal(true)}
                            className="flex items-center gap-2 rounded-xl border border-orange-500 bg-orange-500 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-all duration-200 md:px-4 md:text-sm"
                        >
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
                                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                />
                            </svg>
                            <span className="hidden sm:inline">Combos</span>
                        </button>
                    </div>
                </div>

                {/* Banner de regalo disponible */}
                {giftMessage && (
                    <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm dark:border-amber-900/50 dark:bg-amber-900/20">
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

                {/* Área de navegación y Lista de items */}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
                    {/* Header de navegación / Breadcrumbs */}
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-3 transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900/50 md:p-4">
                        <div className="flex flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap pb-1 md:gap-3">
                            {isSearching ? (
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 md:text-base">
                                    Resultados de búsqueda
                                </h3>
                            ) : (
                                <>
                                    <button
                                        onClick={() => {
                                            setSelectedCategory(null);
                                            setSelectedSubcategory(null);
                                        }}
                                        className={`inline-flex items-center gap-2 justify-center rounded-xl border px-4 py-2 text-sm font-bold transition-all duration-150 ${
                                            !selectedCategory
                                                ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-300"
                                                : "border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                                        }`}
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
                                            <span className="text-slate-300 dark:text-slate-700">
                                                /
                                            </span>
                                            <button
                                                onClick={() =>
                                                    setSelectedSubcategory(null)
                                                }
                                                className={`inline-flex max-w-[12rem] items-center gap-2 justify-center truncate rounded-xl border px-4 py-2 text-sm font-bold transition-all duration-150 ${
                                                    !selectedSubcategory
                                                        ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-300"
                                                        : "border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                                                }`}
                                            >
                                                <CategoryIcon
                                                    iconId={
                                                        categories.find(
                                                            (c: any) =>
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
                                                )?.name || "Categoría"}
                                            </button>
                                        </>
                                    )}
                                    {selectedSubcategory && (
                                        <>
                                            <span className="text-slate-300 dark:text-slate-700">
                                                /
                                            </span>
                                            <span className="inline-flex max-w-[12rem] items-center gap-2 justify-center truncate rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                                                <CategoryIcon
                                                    iconId={
                                                        subcategoriesOfCategory.find(
                                                            (s: any) =>
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
                                                )?.name || "Subcategoría"}
                                            </span>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Grid de items */}
                    <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 md:p-6">
                        {productsLoading && showProductsInGrid ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500"></div>
                                <p className="text-sm">Cargando productos...</p>
                            </div>
                        ) : (
                            <div
                                className="grid gap-3 md:gap-4"
                                style={{
                                    gridTemplateColumns: `repeat(auto-fill, minmax(${gridMinCol}, 1fr))`,
                                }}
                            >
                                {/* Render Categorías */}
                                {showCategoriesInGrid &&
                                    (categoriesLoading ? (
                                        <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400">
                                            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500"></div>
                                            <p className="text-sm">
                                                Cargando categorías...
                                            </p>
                                        </div>
                                    ) : (
                                        categories.map((category: any) => (
                                            <div
                                                key={category.id}
                                                onClick={() => {
                                                    setSelectedCategory(
                                                        category.id,
                                                    );
                                                    setSelectedSubcategory(
                                                        null,
                                                    );
                                                }}
                                                className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/50 dark:hover:bg-slate-800/50"
                                                style={{
                                                    minHeight: isSmall
                                                        ? "100px"
                                                        : "130px",
                                                }}
                                            >
                                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 transition-colors duration-200 group-hover:bg-indigo-50 dark:bg-slate-800 dark:group-hover:bg-indigo-900/20 md:h-16 md:w-16">
                                                    <CategoryIcon
                                                        iconId={category.icon}
                                                        type="category"
                                                        size={
                                                            isSmall
                                                                ? "1.25rem"
                                                                : "1.75rem"
                                                        }
                                                    />
                                                </div>
                                                <div className="text-xs font-bold text-slate-800 transition-colors duration-200 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400 md:text-sm">
                                                    {category.name}
                                                </div>
                                            </div>
                                        ))
                                    ))}

                                {/* Render Subcategorías */}
                                {showSubcategoriesInGrid &&
                                    (subcategoriesLoading ? (
                                        <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400">
                                            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500"></div>
                                            <p className="text-sm">
                                                Cargando subcategorías...
                                            </p>
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
                                                    className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-center transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/50 dark:hover:bg-slate-800/50"
                                                    style={{
                                                        minHeight: isSmall
                                                            ? "90px"
                                                            : "110px",
                                                    }}
                                                >
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 transition-colors duration-200 group-hover:bg-indigo-50 dark:bg-slate-800 dark:group-hover:bg-indigo-900/20 md:h-12 md:w-12">
                                                        <CategoryIcon
                                                            iconId={sub.icon}
                                                            type="subcategory"
                                                            size={
                                                                isSmall
                                                                    ? "1.1rem"
                                                                    : "1.25rem"
                                                            }
                                                        />
                                                    </div>
                                                    <div className="text-xs font-semibold text-slate-700 transition-colors duration-200 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-400">
                                                        {sub.name}
                                                    </div>
                                                </div>
                                            ),
                                        )
                                    ))}

                                {/* Render Productos */}
                                {showProductsInGrid &&
                                    (productsList.length === 0 ? (
                                        <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400">
                                            No se encontraron productos
                                        </div>
                                    ) : (
                                        productsList.map((product: any) => {
                                            const promoBadge =
                                                findBadgePromotion(
                                                    product,
                                                    activePromotions,
                                                );
                                            return (
                                                <div
                                                    key={product.id}
                                                    onClick={() =>
                                                        handleAddProduct(
                                                            product.id,
                                                            1,
                                                        )
                                                    }
                                                    className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/50"
                                                >
                                                    {promoBadge && (
                                                        <div className="absolute left-2 top-2 z-10">
                                                            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                                                                {promotionBadgeLabel(
                                                                    promoBadge,
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {product.imageBase64 ? (
                                                        <div className="aspect-square w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                                                            <img
                                                                src={`data:image/jpeg;base64,${product.imageBase64}`}
                                                                alt={
                                                                    product.name
                                                                }
                                                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-slate-50 text-2xl transition-colors duration-200 group-hover:bg-indigo-50 dark:bg-slate-800 dark:group-hover:bg-indigo-900/20">
                                                            🍽️
                                                        </div>
                                                    )}
                                                    <div className="mt-3 flex flex-1 flex-col gap-1">
                                                        <h4 className="line-clamp-2 text-xs font-bold leading-tight text-slate-800 dark:text-slate-100 md:text-sm">
                                                            {product.name}
                                                        </h4>
                                                        {productStockLabel(
                                                            product,
                                                        ) && (
                                                            <span className="text-[0.65rem] font-semibold text-slate-500 dark:text-slate-400 md:text-xs">
                                                                {productStockLabel(
                                                                    product,
                                                                )}
                                                            </span>
                                                        )}
                                                        {Number(
                                                            product.preparationTime,
                                                        ) > 0 && (
                                                            <span className="text-[0.65rem] font-medium text-slate-500 dark:text-slate-400 md:text-xs">
                                                                ⏱️{" "}
                                                                {
                                                                    product.preparationTime
                                                                }{" "}
                                                                min
                                                            </span>
                                                        )}
                                                        <div className="mt-auto flex items-center justify-between pt-1">
                                                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 md:text-sm">
                                                                S/{" "}
                                                                {parseFloat(
                                                                    product.salePrice ||
                                                                        0,
                                                                ).toFixed(2)}
                                                            </span>
                                                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors duration-200 group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-900/30 dark:text-indigo-400 dark:group-hover:bg-indigo-500 dark:group-hover:text-white">
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
                                                                        strokeWidth={
                                                                            3
                                                                        }
                                                                        d="M12 4v16m8-8H4"
                                                                    />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Panel derecho - Carrito y Pago */}
            <div className="flex w-full flex-col gap-4 overflow-hidden md:w-[380px] lg:w-[420px]">
                {/* Carrito */}
                <div className="flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
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
                                                    : isMedium
                                                      ? "8px"
                                                      : "10px",
                                                padding: isSmall
                                                    ? "0.2rem"
                                                    : isMedium
                                                      ? "0.3rem"
                                                      : "0.35rem",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
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
                                                {/* Controles de cantidad */}
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: isSmall
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
                                                        disabled={!isEditable}
                                                        className="border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-100"
                                                        style={{
                                                            width: isSmall
                                                                ? "20px"
                                                                : isMedium
                                                                  ? "24px"
                                                                  : "28px",
                                                            height: isSmall
                                                                ? "20px"
                                                                : isMedium
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
                                                                : isMedium
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
                                                                : isMedium
                                                                  ? "32px"
                                                                  : "38px",
                                                            textAlign: "center",
                                                            borderRadius:
                                                                isSmall
                                                                    ? "4px"
                                                                    : "6px",
                                                            padding: isSmall
                                                                ? "0.1rem"
                                                                : isMedium
                                                                  ? "0.15rem"
                                                                  : "0.2rem",
                                                            fontWeight: 700,
                                                            fontSize: isSmall
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
                                                        disabled={!isEditable}
                                                        className="border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-100"
                                                        style={{
                                                            width: isSmall
                                                                ? "16px"
                                                                : isMedium
                                                                  ? "18px"
                                                                  : "25px",
                                                            height: isSmall
                                                                ? "16px"
                                                                : isMedium
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
                                                                : isMedium
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

                                                {/* Nombre del producto */}
                                                <div
                                                    style={{
                                                        flex: "1",
                                                        minWidth: 0,
                                                        paddingLeft: "4px",
                                                        paddingRight: "4px",
                                                    }}
                                                >
                                                    <div
                                                        className="text-slate-800 dark:text-slate-100"
                                                        style={{
                                                            fontWeight: 700,
                                                            fontSize: isSmall
                                                                ? "0.7rem"
                                                                : isMedium
                                                                  ? "0.75rem"
                                                                  : "0.8125rem",
                                                            overflow: "hidden",
                                                            whiteSpace:
                                                                "normal",
                                                            wordBreak:
                                                                "break-word",
                                                            lineHeight: "1.2",
                                                            display: "flex",
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

                                                {/* Precio total */}
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: isSmall
                                                            ? "0.2rem"
                                                            : isMedium
                                                              ? "0.3rem"
                                                              : "0.35rem",
                                                        flexShrink: 0,
                                                        minWidth: isSmall
                                                            ? "55px"
                                                            : isMedium
                                                              ? "65px"
                                                              : "75px",
                                                        marginLeft: "auto",
                                                    }}
                                                >
                                                    <div
                                                        className="text-slate-800 dark:text-slate-100"
                                                        style={{
                                                            fontWeight: 700,
                                                            fontSize: isSmall
                                                                ? "0.7rem"
                                                                : isMedium
                                                                  ? "0.75rem"
                                                                  : "0.8125rem",
                                                            textAlign: "right",
                                                        }}
                                                    >
                                                        S/{" "}
                                                        {item.total.toFixed(2)}
                                                    </div>
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
                                                            : isMedium
                                                              ? "0.15rem 0.4rem"
                                                              : "0.15rem 0.45rem",
                                                        borderRadius: 999,
                                                        fontSize: isSmall
                                                            ? "0.7rem"
                                                            : isMedium
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
                                                            : isMedium
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
                    {/* Descuento */}
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                Dscto (S/)
                            </label>
                            <div
                                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 transition-all duration-200 ${pct > 0 ? "bg-slate-50 opacity-40 dark:bg-slate-800/50" : "border-slate-200 bg-white focus-within:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-indigo-500"}`}
                            >
                                <span className="text-xs font-bold text-slate-400">
                                    S/
                                </span>
                                <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={discountAmount || ""}
                                    disabled={pct > 0}
                                    onChange={(e) => {
                                        const v = Math.max(
                                            0,
                                            parseFloat(e.target.value) || 0,
                                        );
                                        setDiscountAmount(v);
                                        if (v > 0) setDiscountPercent(0);
                                    }}
                                    placeholder="0.00"
                                    className="w-full border-none bg-transparent text-xs font-bold text-slate-800 outline-none dark:text-slate-100"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                Dscto (%)
                            </label>
                            <div
                                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 transition-all duration-200 ${(Number(discountAmount) || 0) > 0 ? "bg-slate-50 opacity-40 dark:bg-slate-800/50" : "border-slate-200 bg-white focus-within:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-indigo-500"}`}
                            >
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    value={discountPercent || ""}
                                    disabled={(Number(discountAmount) || 0) > 0}
                                    onChange={(e) => {
                                        const v = Math.max(
                                            0,
                                            Math.min(
                                                100,
                                                parseFloat(e.target.value) || 0,
                                            ),
                                        );
                                        setDiscountPercent(v);
                                        if (v > 0) setDiscountAmount(0);
                                    }}
                                    placeholder="0"
                                    className="w-full border-none bg-transparent text-xs font-bold text-slate-800 outline-none dark:text-slate-100"
                                />
                                <span className="text-xs font-bold text-slate-400">
                                    %
                                </span>
                            </div>
                        </div>
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
                </div>

                {/* Botón procesar */}
                <button
                    onClick={() => setShowPaymentModal(true)}
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
            </div>

            {/* Modal Información de Pago */}
            {showPaymentModal && (
                <PayDeliveryModal
                    isOpen={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    cartTotal={cartTotal}
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
                    showToast={showToast}
                    documents={documents}
                    selectedDocument={selectedDocument}
                    setSelectedDocument={setSelectedDocument}
                    serials={serials}
                    selectedSerial={selectedSerial}
                    setSelectedSerial={setSelectedSerial}
                    cashRegisters={cashRegisters}
                    selectedCashRegister={selectedCashRegister}
                    setSelectedCashRegister={setSelectedCashRegister}
                    paymentLines={paymentLines}
                    onAddPayment={addDeliveryPayment}
                    onRemovePayment={removeDeliveryPayment}
                    onUpdatePayment={updateDeliveryPayment}
                    canAddPayment={canAddDeliveryPayment}
                    paymentsCoverDebt={paymentsCoverDebt}
                    totalPaymentsAmount={totalPaymentsAmount}
                    changeDue={changeDue}
                    onConfirm={handleProcessSale}
                />
            )}

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
