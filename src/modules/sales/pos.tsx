import React, {
    useState,
    useEffect,
    useMemo,
    useCallback,
    useRef,
} from "react";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { useUserPermissions } from "../../hooks/useUserPermissions";
import { useToast } from "../../context/ToastContext";
import {
    getBranchIgvPercentage,
    getBranchTaxAffectationType,
} from "../../utils/getBranchIgvPercentage";
import { CREATE_SALE_CARRY_OUT, CREATE_PERSON } from "../../graphql/mutations";
import {
    GET_CATEGORIES_BY_BRANCH_LIGHT,
    GET_SUBCATEGORIES_BY_CATEGORY,
    GET_PRODUCTS_BY_CATEGORY,
    GET_PRODUCTS_BY_BRANCH,
    SEARCH_PRODUCTS,
    GET_DOCUMENTS_WITH_SERIALS,
    GET_CASH_REGISTERS_BY_BRANCH,
    GET_PERSONS_BY_BRANCH,
    SEARCH_PERSON_BY_DOCUMENT,
    GET_ACTIVE_PROMOTIONS,
    GET_DEVICE_PRINT_CONFIGS_BY_BRANCH,
} from "../../graphql/queries";
import {
    type DeliveryPaymentLine,
    SALE_PAYMENT_METHODS,
    paymentMethodNeedsReference,
} from "./payDelivery";
import ClientSearchBar, {
    type ClientSearchPerson,
    type EditClientForModal,
} from "../../components/ClientSearchBar";
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
import { getFullImageUrl } from "../../utils/getFullImageUrl";
import {
    buildCartStockUsage,
    canAddMoreProduct,
    canAddProductQuantity,
    isStockWarningMessage,
} from "../../utils/operationStock";
import { resolveClientDeviceIdForPrint } from "../../utils/deviceIdForPrint";
import { getLocalTicketPrinterStorage } from "../../utils/localPrinterPreference";
import {
    roundMoney2,
    unitValueFromInclusivePrice,
} from "../../utils/taxAmounts";
import { invokeLocalIssuedDocumentPrint } from "../../utils/localDocumentPrint";
import { DocumentPrintPreviewModal } from "../../components/DocumentPrintPreviewModal";
import type { DocumentPreviewAction } from "../../utils/issuedDocumentPrintWithPreview";

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

type DocAbbrev = "NV" | "B" | "F";

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

const documentToAbbrev = (doc: any): DocAbbrev => {
    if (doc?.code === "01") return "F";
    if (doc?.code === "03") return "B";
    return "NV";
};

const docAbbrevToPrintType = (abbrev: DocAbbrev): string => {
    if (abbrev === "F") return "FACTURA";
    if (abbrev === "B") return "BOLETA";
    return "CUENTA";
};

const findDocumentByAbbrev = (
    docs: any[],
    abbrev: DocAbbrev,
): any | undefined => {
    if (abbrev === "F") return docs.find((d) => d.code === "01");
    if (abbrev === "B") return docs.find((d) => d.code === "03");
    return (
        docs.find((d) => d.code !== "01" && d.code !== "03") ??
        docs.find((d) =>
            (d.description || "").toUpperCase().includes("NOTA"),
        )
    );
};

const getProductQtyInCart = (cartItems: CartItem[], productId: string) =>
    cartItems
        .filter((i) => String(i.productId) === String(productId))
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

const PointOfSale: React.FC = () => {
    const { companyData, user, getDeviceId, getMacAddress } = useAuth();
    const { showToast } = useToast();
    const { hasPermission } = useUserPermissions();
    const canEditPrice = hasPermission("products.edit_prices_delivery");

    const igvPercentageFromBranch = getBranchIgvPercentage(companyData);
    const branchTaxAffectationType = getBranchTaxAffectationType(companyData);

    const [selectedCategory, setSelectedCategory] = useState<string | null>(
        null,
    );
    const [selectedSubcategory, setSelectedSubcategory] = useState<
        string | null
    >(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const [selectedPerson, setSelectedPerson] = useState<ClientSearchPerson | null>(
        null,
    );
    const [personSearchTerm, setPersonSearchTerm] = useState("");
    const [selectedDocument, setSelectedDocument] = useState("");
    const [selectedSerial, setSelectedSerial] = useState("");
    const [selectedCashRegister, setSelectedCashRegister] = useState("");
    const [paymentLines, setPaymentLines] = useState<DeliveryPaymentLine[]>([
        { id: "1", method: "CASH", amount: 0, referenceNumber: "" },
    ]);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [activePaymentMethod, setActivePaymentMethod] = useState("CASH");
    const [showCheckout, setShowCheckout] = useState(false);

    const [showCreateClientModal, setShowCreateClientModal] = useState(false);
    const [showEditClientModal, setShowEditClientModal] = useState(false);
    const [editClientForModal, setEditClientForModal] =
        useState<EditClientForModal | null>(null);

    const [activePromotions, setActivePromotions] = useState<IPromotion[]>([]);
    const [giftMessage, setGiftMessage] = useState<string | null>(null);

    const categoryScrollRef = useRef<HTMLDivElement>(null);
    const posDocPreviewResolverRef = useRef<
        ((action: DocumentPreviewAction) => void) | null
    >(null);

    const [posDocPreview, setPosDocPreview] = useState<{
        title: string;
    } | null>(null);

    const [createSaleCarryOutMutation] = useMutation(CREATE_SALE_CARRY_OUT);

    const { data: promotionsData } = useQuery(GET_ACTIVE_PROMOTIONS, {
        variables: { branchId: companyData?.branch?.id },
        skip: !companyData?.branch?.id,
        fetchPolicy: "network-only",
    });

    useEffect(() => {
        if (promotionsData?.activePromotions) {
            setActivePromotions(promotionsData.activePromotions);
        }
    }, [promotionsData]);

    const { data: categoriesData, loading: categoriesLoading } = useQuery(
        GET_CATEGORIES_BY_BRANCH_LIGHT,
        {
            variables: { branchId: companyData?.branch?.id },
            skip: !companyData?.branch?.id,
            fetchPolicy: "network-only",
        },
    );
    const categories = categoriesData?.categoriesByBranch || [];

    const { data: subcategoriesData, loading: subcategoriesLoading } =
        useQuery(GET_SUBCATEGORIES_BY_CATEGORY, {
            variables: { categoryId: selectedCategory || "" },
            skip: !companyData?.branch?.id || !selectedCategory,
            fetchPolicy: "network-only",
        });

    const searchMinLength = 3;
    const { data: searchData, loading: searchLoading } = useQuery(
        SEARCH_PRODUCTS,
        {
            variables: {
                search: searchTerm.trim(),
                branchId: companyData?.branch?.id,
                limit: 50,
            },
            skip:
                !companyData?.branch?.id ||
                searchTerm.trim().length < searchMinLength,
            errorPolicy: "ignore",
            fetchPolicy: "network-only",
        },
    );

    const subcategoriesOfCategory = selectedCategory
        ? (subcategoriesData?.subcategoriesByCategory || []).filter(
              (s: any) => s.isActive !== false,
          )
        : [];

    const awaitingSubcategoryPick =
        Boolean(selectedCategory) &&
        !subcategoriesLoading &&
        subcategoriesOfCategory.length > 0 &&
        !selectedSubcategory;

    const { data: productsByCategoryData, loading: productsByCategoryLoading } =
        useQuery(GET_PRODUCTS_BY_CATEGORY, {
            variables: { categoryId: selectedCategory },
            skip:
                !selectedCategory ||
                searchTerm.length >= searchMinLength ||
                subcategoriesLoading ||
                awaitingSubcategoryPick,
            fetchPolicy: "network-only",
        });

    const { data: productsByBranchData, loading: productsByBranchLoading } =
        useQuery(GET_PRODUCTS_BY_BRANCH, {
            variables: { branchId: companyData?.branch?.id },
            skip: !companyData?.branch?.id,
            fetchPolicy: "network-only",
        });

    const { data: documentsData } = useQuery(GET_DOCUMENTS_WITH_SERIALS, {
        variables: { branchId: companyData?.branch?.id },
        skip: !companyData?.branch?.id,
        fetchPolicy: "network-only",
    });
    const documents = documentsData?.documentsByBranch || [];

    const { data: cashRegistersData } = useQuery(GET_CASH_REGISTERS_BY_BRANCH, {
        variables: { branchId: companyData?.branch?.id },
        skip: !companyData?.branch?.id,
        fetchPolicy: "network-only",
    });
    const cashRegisters = cashRegistersData?.cashRegistersByBranch || [];

    const { data: devicePrintConfigsData } = useQuery(
        GET_DEVICE_PRINT_CONFIGS_BY_BRANCH,
        {
            variables: {
                branchId: companyData?.branch?.id,
                isActive: true,
            },
            skip: !companyData?.branch?.id,
            fetchPolicy: "cache-first",
        },
    );
    const devicePrintConfigs =
        devicePrintConfigsData?.devicePrintConfigsByBranch || [];

    const {
        data: clientsData,
        loading: clientsLoading,
        refetch: refetchClients,
    } = useQuery(GET_PERSONS_BY_BRANCH, {
        variables: { branchId: companyData?.branch?.id },
        skip: !companyData?.branch?.id,
        fetchPolicy: "network-only",
    });

    const [searchPersonByDocument, { loading: sunatSearchLoading }] =
        useLazyQuery(SEARCH_PERSON_BY_DOCUMENT, {
            fetchPolicy: "network-only",
        });
    const [createPersonMutation] = useMutation(CREATE_PERSON);

    const selectedDoc = documents.find((d: any) => d.id === selectedDocument);
    const isFactura = selectedDoc?.code === "01";
    const isSunatBillableDocument =
        selectedDoc?.code === "01" || selectedDoc?.code === "03";

    const docAbbrev: DocAbbrev = selectedDoc
        ? documentToAbbrev(selectedDoc)
        : "NV";

    const getCartLineTotal = (item: CartItem) =>
        Number(item.total) ||
        (Number(item.price) || 0) * (Number(item.quantity) || 0);

    const recalculatePromotions = useCallback(
        (items: CartItem[], promotions: IPromotion[]) => {
            if (promotions.length === 0) return items;
            const cartTotalLocal = items.reduce(
                (sum, it) => sum + it.price * it.quantity - (it.discount ?? 0),
                0,
            );

            let updated = items.map((item) => {
                if (item.manualPriceEdited)
                    return { ...item, discount: 0, promotionName: null };
                if ((item.discount ?? 0) > 0) return item;
                if (item.isCombo || !item.product)
                    return { ...item, discount: 0, promotionName: null };
                const promo = findBestDiscountPromotion(
                    item.product,
                    promotions,
                    cartTotalLocal,
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
        const hasExistingDiscounts = cartItems.some(
            (item) => (item.discount ?? 0) > 0,
        );
        if (
            activePromotions.length > 0 &&
            cartItems.length > 0 &&
            !hasExistingDiscounts
        ) {
            setCartItems((prev) =>
                recalculatePromotions(prev, activePromotions),
            );
        }
    }, [activePromotions, cartItems.length, recalculatePromotions]);

    useEffect(() => {
        if (!selectedCategory || subcategoriesLoading) return;
        const subs = (subcategoriesData?.subcategoriesByCategory || []).filter(
            (s: any) => s.isActive !== false,
        );
        if (subs.length === 1) {
            setSelectedSubcategory(String(subs[0].id));
        } else if (subs.length !== 1) {
            setSelectedSubcategory(null);
        }
    }, [
        selectedCategory,
        subcategoriesLoading,
        subcategoriesData?.subcategoriesByCategory,
    ]);

    useEffect(() => {
        if (documents.length > 0 && !selectedDocument) {
            setSelectedDocument(documents[0].id);
        }
    }, [documents, selectedDocument]);

    useEffect(() => {
        const docData = documents.find((d: any) => d.id === selectedDocument);
        const serials = docData?.serials || [];
        if (serials.length > 0 && !selectedSerial) {
            setSelectedSerial(serials[0].serial);
        }
    }, [documents, selectedDocument, selectedSerial]);

    useEffect(() => {
        if (cashRegisters.length > 0 && !selectedCashRegister) {
            setSelectedCashRegister(cashRegisters[0].id);
        }
    }, [cashRegisters, selectedCashRegister]);

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

    const isSearching = searchTerm.trim().length >= searchMinLength;
    let productsList: any[] = [];
    let productsLoading = false;

    if (isSearching) {
        productsList = searchData?.searchProducts || [];
        productsLoading = searchLoading;
        if (!productsList.length) {
            const all = productsByBranchData?.productsByBranch || [];
            const q = searchTerm.toLowerCase();
            productsList = all.filter(
                (p: any) =>
                    p.name?.toLowerCase().includes(q) ||
                    p.code?.toLowerCase().includes(q),
            );
        }
    } else if (selectedCategory) {
        if (subcategoriesLoading || awaitingSubcategoryPick) {
            productsList = [];
            productsLoading =
                subcategoriesLoading || productsByCategoryLoading;
        } else {
            productsList = productsByCategoryData?.productsByCategory || [];
            productsLoading = productsByCategoryLoading;
        }
    } else {
        productsList = productsByBranchData?.productsByBranch || [];
        productsLoading = productsByBranchLoading;
    }

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

    productsList = productsList.filter(
        (p: any) => p.productType !== "PROMOTION",
    );

    const handleAddProduct = (productId: string, qtyToAdd = 1) => {
        const product = productsList.find((p: any) => p.id === productId);
        if (!product) return;

        if (product.productType === "PROMOTION") {
            return;
        }

        const productPrice = parseFloat(product.salePrice) || 0;
        if (productPrice < 0) {
            showToast(`El producto "${product.name}" no tiene precio válido`, "error");
            return;
        }

        const stockRunning = buildCartStockUsage(cartItems);
        const stockCheck = canAddProductQuantity(product, qtyToAdd, stockRunning);
        if (!stockCheck.ok) {
            showToast(stockCheck.message ?? "Sin stock disponible", "error");
            return;
        }

        const existingItemIndex = cartItems.findIndex(
            (item) =>
                item.productId === product.id &&
                !item.isCombo &&
                !item.notes,
        );

        if (existingItemIndex >= 0) {
            const updatedItems = [...cartItems];
            const existingItem = updatedItems[existingItemIndex];
            const validQuantity = Number(existingItem.quantity) + qtyToAdd;
            const validPrice = Number(existingItem.price) || productPrice;
            updatedItems[existingItemIndex].quantity = validQuantity;
            updatedItems[existingItemIndex].total = validPrice * validQuantity;
            setCartItems(updatedItems);
        } else {
            setCartItems([
                ...cartItems,
                {
                    id: `${product.id}-${Date.now()}`,
                    productId: product.id,
                    name: product.name,
                    price: productPrice,
                    originalPrice: productPrice,
                    quantity: qtyToAdd,
                    total: productPrice * qtyToAdd,
                    notes: "",
                    subcategoryId: product.subcategoryId,
                    product,
                    discount: 0,
                    promotionName: null,
                    manualPriceEdited: false,
                },
            ]);
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

    const handleUpdateCartQuantity = (itemId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            setCartItems((prev) => prev.filter((item) => item.id !== itemId));
            return;
        }

        const item = cartItems.find((i) => i.id === itemId);
        if (!item?.product) {
            setCartItems((prev) =>
                prev.map((i) =>
                    i.id === itemId
                        ? {
                              ...i,
                              quantity: newQuantity,
                              total: i.price * newQuantity,
                          }
                        : i,
                ),
            );
            return;
        }

        const stockRunning = buildCartStockUsage(
            cartItems.filter((i) => i.id !== itemId),
        );
        const stockCheck = canAddProductQuantity(
            item.product,
            newQuantity,
            stockRunning,
        );
        if (!stockCheck.ok) {
            showToast(stockCheck.message ?? "Sin stock disponible", "error");
            return;
        }

        setCartItems((prev) =>
            prev.map((i) =>
                i.id === itemId
                    ? {
                          ...i,
                          quantity: newQuantity,
                          total: i.price * newQuantity,
                      }
                    : i,
            ),
        );
    };

    useEffect(() => {
        if (cartItems.length === 0) {
            setShowCheckout(false);
        }
    }, [cartItems.length]);

    const cartItemsTotal = cartItems.reduce((sum, item) => {
        const itemTotal = Number(item.total) || 0;
        const itemDiscount = Number(item.discount) || 0;
        return sum + (itemTotal - itemDiscount);
    }, 0);

    const manualDiscount = Math.max(0, Number(discountAmount) || 0);
    const cartTotal = Math.max(0, cartItemsTotal - manualDiscount);
    const totalDiscount =
        manualDiscount +
        cartItems.reduce((sum, item) => sum + (item.discount || 0), 0);

    const igvPercentageDecimal = igvPercentageFromBranch / 100;
    const subtotal = parseFloat(
        (cartTotal / (1 + igvPercentageDecimal)).toFixed(2),
    );
    const igvAmount = parseFloat((cartTotal - subtotal).toFixed(2));

    const totalPaymentsAmount = paymentLines.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0,
    );
    const remainingToPay =
        roundMoney2(cartTotal) - roundMoney2(totalPaymentsAmount);
    const changeDue = remainingToPay < 0 ? Math.abs(remainingToPay) : 0;

    const quickAmounts = useMemo(() => {
        const base = Math.ceil(cartTotal);
        const amounts = [
            roundMoney2(cartTotal),
            base,
            base + 5,
            base + 50,
        ].filter((v, i, arr) => arr.indexOf(v) === i);
        return amounts.slice(0, 4);
    }, [cartTotal]);

    useEffect(() => {
        setPaymentLines((prev) => [
            {
                id: "1",
                method: activePaymentMethod,
                amount: roundMoney2(cartTotal),
                referenceNumber: prev[0]?.referenceNumber || "",
            },
        ]);
    }, [cartTotal, activePaymentMethod]);

    const selectDocAbbrev = (abbrev: DocAbbrev) => {
        const doc = findDocumentByAbbrev(documents, abbrev);
        if (doc) {
            setSelectedDocument(doc.id);
            const serials = doc.serials || [];
            setSelectedSerial(serials[0]?.serial || "");
        }
    };

    const selectPersonFromClient = (client: {
        id: string;
        name?: string | null;
        documentType?: string | null;
        documentNumber?: string | null;
    }) => {
        setSelectedPerson({
            id: client.id,
            name: client.name || "",
            documentType: client.documentType || "",
            documentNumber: client.documentNumber || "",
        });
        setPersonSearchTerm(client.name || "");
    };

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
                selectPersonFromClient(person);
                const { data: refetched } = await refetchClients();
                const updated = (refetched?.personsByBranch || []).find(
                    (p: any) => p.id === person.id,
                );
                if (updated) selectPersonFromClient(updated);
                return;
            }
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
                selectPersonFromClient(createData.createPerson.person);
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

    const handleOpenEditClient = async () => {
        if (!selectedPerson?.id) return;
        let row = (clientsData?.personsByBranch || []).find(
            (c: any) => c.id === selectedPerson.id,
        ) as EditClientForModal | undefined;
        if (!row) {
            const result = await refetchClients();
            row = (result.data?.personsByBranch || []).find(
                (c: any) => c.id === selectedPerson.id,
            ) as EditClientForModal | undefined;
        }
        if (!row) {
            showToast("No se pudo cargar el cliente para editar.", "warning");
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
        if (newClient) selectPersonFromClient(newClient);
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
        if (updated) selectPersonFromClient(updated);
        setShowEditClientModal(false);
        setEditClientForModal(null);
    };

    const updatePosPayment = (
        id: string,
        field: keyof DeliveryPaymentLine,
        value: string | number,
    ) => {
        setPaymentLines((prev) =>
            prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
        );
    };

    const getIntegratedPrintCopies = useCallback(
        (deviceId: string, abbrev: DocAbbrev): number => {
            const printType = docAbbrevToPrintType(abbrev);
            const deviceNorm = deviceId.trim().toLowerCase();
            const match = devicePrintConfigs.find(
                (cfg: any) =>
                    cfg.isActive !== false &&
                    cfg.printType === printType &&
                    cfg.useIntegratedPrinter === true &&
                    String(cfg.deviceId || "")
                        .trim()
                        .toLowerCase() === deviceNorm,
            );
            const copies = Number(match?.copies);
            return Number.isFinite(copies) && copies > 0 ? copies : 1;
        },
        [devicePrintConfigs],
    );

    const printCarryOutIssuedDocument = async (
        carryOutResult: {
            printLocally?: boolean | null;
            print_locally?: boolean | null;
            printViaBluetooth?: boolean | null;
            print_via_bluetooth?: boolean | null;
            documentData?: string | null;
            document_data?: string | null;
            operation?: { id?: string | null } | null;
        },
        resolvedDeviceId: string,
        abbrev: DocAbbrev,
    ): Promise<boolean> => {
        const printLocallyFlag =
            carryOutResult?.printLocally === true ||
            carryOutResult?.print_locally === true;
        const documentData =
            carryOutResult?.documentData ??
            carryOutResult?.document_data ??
            null;

        const printPayload = {
            printLocally:
                carryOutResult?.printLocally ?? carryOutResult?.print_locally,
            printViaBluetooth:
                carryOutResult?.printViaBluetooth ??
                carryOutResult?.print_via_bluetooth,
            documentData,
        };
        const printMeta = {
            label: "venta POS",
            operationId: carryOutResult?.operation?.id ?? null,
            deviceId: resolvedDeviceId || null,
            localPrinterName: getLocalTicketPrinterStorage().trim() || null,
        };

        if (printLocallyFlag) {
            const copies = getIntegratedPrintCopies(resolvedDeviceId, abbrev);
            let allOk = true;
            for (let copy = 0; copy < copies; copy++) {
                const ok = await invokeLocalIssuedDocumentPrint(
                    printPayload,
                    printMeta,
                );
                if (!ok) allOk = false;
            }
            return allOk;
        }

        return invokeLocalIssuedDocumentPrint(printPayload, printMeta);
    };

    const handleProcessSale = async () => {
        if (cartItems.length === 0) {
            showToast("Debe agregar al menos un producto", "error");
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
                `La suma de los pagos debe ser al menos el total (${cartTotal.toFixed(2)}).`,
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
                "No tiene permiso para editar el precio del ítem",
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

        const previewTitle = docForPay.description?.trim() || "Comprobante";

        const userAction = await new Promise<DocumentPreviewAction>(
            (resolve) => {
                posDocPreviewResolverRef.current = resolve;
                setPosDocPreview({ title: previewTitle });
            },
        );

        setPosDocPreview(null);
        posDocPreviewResolverRef.current = null;

        if (userAction === "cancel") {
            return;
        }

        const shouldPrint = userAction === "print";

        setIsSaving(true);

        try {
            const now = new Date();
            const items = itemsSource.map((item) => {
                const unitPrice = parseFloat(
                    (Math.round(item.price * 100) / 100).toFixed(2),
                );
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const unitValue = unitValueFromInclusivePrice(
                    unitPrice,
                    igvPercentageFromBranch,
                );
                return {
                    productId: String(item.productId),
                    quantity,
                    unitValue,
                    unitPrice,
                    notes: typeof item.notes === "string" ? item.notes.trim() : "",
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

            const cleanCartTotal = parseFloat(cartTotal.toFixed(2));
            const cleanSubtotal = parseFloat(subtotal.toFixed(2));
            const cleanIgvAmount = parseFloat(igvAmount.toFixed(2));
            const cleanTotalDiscount = parseFloat(totalDiscount.toFixed(2));
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

            const resolvedDeviceId = await resolveClientDeviceIdForPrint({
                getMacAddress,
                getDeviceId,
                logPrefix: "[POS/venta]",
            });

            if (shouldPrint && !resolvedDeviceId?.trim()) {
                showToast(
                    "No se pudo identificar el dispositivo para imprimir. Configure la MAC en SumApp o el ID del equipo.",
                    "warning",
                );
            }

            const variables: any = {
                branchId: companyData?.branch.id,
                userId: user?.id,
                documentId: selectedDocument,
                serial: selectedSerial,
                emissionDate: formatLocalDateYYYYMMDD(now),
                emissionTime: formatLocalTimeHHMMSS(now),
                currency: "PEN",
                exchangeRate: 1.0,
                itemsTotalDiscount: 0,
                globalDiscount: globalDiscountOnBase,
                globalDiscountPercent: 0,
                totalDiscount: cleanTotalDiscount,
                globalDiscountOnTotal: cleanTotalDiscount,
                igvPercent: parseFloat(igvPercentageFromBranch.toFixed(2)),
                igvAmount: cleanIgvAmount,
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
                notes: "",
                deviceId: resolvedDeviceId,
                shouldPrint,
            };

            if (selectedPerson) variables.personId = selectedPerson.id;

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

                    const localPrintOk = await printCarryOutIssuedDocument(
                        carryOutResult,
                        resolvedDeviceId,
                        docAbbrev,
                    );

                    const printLocallyFlag =
                        carryOutResult?.printLocally === true ||
                        carryOutResult?.print_locally === true;

                    if (printLocallyFlag && !localPrintOk) {
                        showToast(
                            "La venta se registró, pero no se pudo imprimir en la impresora local. Revise la impresora USB en Configuración o el nombre en impresoras locales.",
                            "warning",
                        );
                    }
                }

                showToast("Venta procesada exitosamente", "success");
                setCartItems([]);
                setSelectedPerson(null);
                setPersonSearchTerm("");
                setDiscountAmount(0);
                setPaymentLines([
                    {
                        id: "1",
                        method: "CASH",
                        amount: 0,
                        referenceNumber: "",
                    },
                ]);
                setActivePaymentMethod("CASH");
                setShowCheckout(false);
            } else {
                throw new Error(
                    result.data?.createSaleCarryOut?.message ||
                        "Error al procesar la venta",
                );
            }
        } catch (error: any) {
            showToast(error.message || "Error al procesar la venta", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const scrollCategories = useCallback((direction: "left" | "right") => {
        categoryScrollRef.current?.scrollBy({
            left: direction === "left" ? -200 : 200,
            behavior: "smooth",
        });
    }, []);

    const paymentMethodLabel =
        SALE_PAYMENT_METHODS.find((m) => m.value === activePaymentMethod)
            ?.label ?? activePaymentMethod;

    const primaryPaymentLine = paymentLines[0];

    return (
        <>
        <div className="flex h-full w-full flex-col overflow-hidden bg-white md:flex-row">
            {/* Catálogo */}
            <div className="flex min-h-0 flex-[2] flex-col border-r border-slate-200">
                <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3">
                    <h2 className="shrink-0 text-base font-semibold text-slate-800">
                        Venta directa
                    </h2>
                    {showSearch && (
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar productos..."
                                className="min-w-0 flex-1 rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-[#3b82f6]"
                                autoFocus
                            />
                        </div>
                    )}
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
                                    String(selectedCategory) === String(cat.id)
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
                                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold ${
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

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {categoriesLoading || productsLoading ? (
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
                            className="grid gap-2.5"
                            style={{
                                gridTemplateColumns:
                                    "repeat(auto-fill, minmax(140px, 1fr))",
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
                                    <ProductCard
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

            {/* Panel derecho — carrito o cobro */}
            <div className="flex min-h-0 w-full flex-col md:w-[340px] md:shrink-0 lg:w-[400px]">
                {!showCheckout ? (
                    <>
                        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
                            <h2 className="text-base font-bold text-slate-900">
                                Pedido
                            </h2>
                            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#3b82f6]">
                                {cartItems.length}{" "}
                                {cartItems.length === 1 ? "ítem" : "ítems"}
                            </span>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                            {cartItems.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-400">
                                    <span className="text-3xl">🛒</span>
                                    <p>Selecciona productos del catálogo</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {cartItems.map((item) => {
                                        const lineTotal =
                                            getCartLineTotal(item) -
                                            (item.discount || 0);
                                        return (
                                            <div
                                                key={item.id}
                                                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                                            >
                                                <div className="mb-2 flex items-start justify-between gap-2">
                                                    <p className="text-xs font-semibold uppercase leading-tight text-slate-800">
                                                        {item.name}
                                                    </p>
                                                    <p className="shrink-0 text-sm font-bold text-slate-900">
                                                        {currencyFormatter.format(
                                                            lineTotal,
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleUpdateCartQuantity(
                                                                    item.id,
                                                                    item.quantity -
                                                                        1,
                                                                )
                                                            }
                                                            className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-100"
                                                        >
                                                            −
                                                        </button>
                                                        <span className="min-w-[1.5rem] text-center text-sm font-bold text-slate-800">
                                                            {item.quantity}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleUpdateCartQuantity(
                                                                    item.id,
                                                                    item.quantity +
                                                                        1,
                                                                )
                                                            }
                                                            className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-100"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-slate-500">
                                                        {currencyFormatter.format(
                                                            item.price,
                                                        )}{" "}
                                                        c/u
                                                    </p>
                                                </div>
                                                {item.discount ? (
                                                    <p className="mt-1 text-[10px] font-semibold text-emerald-600">
                                                        Desc.{" "}
                                                        {currencyFormatter.format(
                                                            item.discount,
                                                        )}
                                                        {item.promotionName
                                                            ? ` — ${item.promotionName}`
                                                            : ""}
                                                    </p>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 border-t border-slate-100 px-4 py-3">
                            <div className="mb-3 space-y-1.5 text-xs">
                                <div className="flex justify-between text-slate-500">
                                    <span>Subtotal</span>
                                    <span className="font-semibold text-slate-700">
                                        {currencyFormatter.format(subtotal)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                    <span>IGV ({igvPercentageFromBranch}%)</span>
                                    <span className="font-semibold text-slate-700">
                                        {currencyFormatter.format(igvAmount)}
                                    </span>
                                </div>
                                {totalDiscount > 0 && (
                                    <div className="flex justify-between font-semibold text-emerald-600">
                                        <span>Descuento</span>
                                        <span>
                                            -{" "}
                                            {currencyFormatter.format(
                                                totalDiscount,
                                            )}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                                    <span>Total</span>
                                    <span className="text-[#3b82f6]">
                                        {currencyFormatter.format(cartTotal)}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCheckout(true)}
                                disabled={cartItems.length === 0}
                                className="w-full rounded-lg bg-[#3b82f6] py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#2563eb] disabled:opacity-50"
                            >
                                Continuar
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3">
                    <button
                        type="button"
                        onClick={() => setShowCheckout(false)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                        aria-label="Volver al pedido"
                    >
                        <ChevronLeft />
                    </button>
                    <h2 className="text-base font-bold text-slate-900">
                        Monto a cobrar — {currencyFormatter.format(cartTotal)}
                    </h2>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    <div className="mb-4">
                        <p className="mb-2 text-xs font-medium text-slate-600">
                            Tipo de doc:
                        </p>
                        <div className="flex gap-3">
                            {(["NV", "B", "F"] as DocAbbrev[]).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => selectDocAbbrev(type)}
                                    disabled={
                                        !findDocumentByAbbrev(documents, type)
                                    }
                                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors disabled:opacity-30 ${
                                        docAbbrev === type
                                            ? "border-[#3b82f6] bg-[#3b82f6] text-white"
                                            : "border-slate-300 bg-white text-slate-700"
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <ClientSearchBar
                        variant="pos"
                        className="mb-4"
                        searchTerm={personSearchTerm}
                        onSearchTermChange={(value) => {
                            setPersonSearchTerm(value);
                            setSelectedPerson(null);
                        }}
                        selectedClient={selectedPerson}
                        onSelectClient={(client) => {
                            setSelectedPerson(client);
                            setPersonSearchTerm(client.name);
                        }}
                        onClearClient={() => {
                            setSelectedPerson(null);
                            setPersonSearchTerm("");
                        }}
                        filteredClients={filteredClients}
                        clientsLoading={clientsLoading}
                        sunatSearchLoading={sunatSearchLoading}
                        disabled={isSaving}
                        isFactura={isFactura}
                        onSearchSunat={handleSearchSunat}
                        onOpenCreateClient={() =>
                            setShowCreateClientModal(true)
                        }
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
                    />

                    <div className="mb-4 grid grid-cols-2 gap-2">
                        {SALE_PAYMENT_METHODS.map(({ value, label }) => {
                            const isActive = activePaymentMethod === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => {
                                        setActivePaymentMethod(value);
                                        setPaymentLines([
                                            {
                                                id: "1",
                                                method: value,
                                                amount: roundMoney2(
                                                    cartTotal,
                                                ),
                                                referenceNumber: "",
                                            },
                                        ]);
                                    }}
                                    disabled={isSaving}
                                    className={`relative rounded-lg border px-2 py-2.5 text-[11px] font-bold leading-tight transition-colors disabled:opacity-50 ${
                                        isActive
                                            ? "border-[#3b82f6] bg-[#3b82f6] text-white"
                                            : "border-[#3b82f6] bg-white text-[#3b82f6] hover:bg-blue-50"
                                    }`}
                                >
                                    {isActive && (
                                        <span className="absolute right-1.5 top-1.5 text-[10px]">
                                            ✓
                                        </span>
                                    )}
                                    {label.toUpperCase()}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mb-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="radio"
                                checked
                                readOnly
                                className="h-4 w-4 text-[#3b82f6]"
                            />
                            <span className="text-sm font-medium text-slate-700">
                                {paymentMethodLabel}
                            </span>
                            <input
                                type="text"
                                value={
                                    primaryPaymentLine?.amount === 0
                                        ? ""
                                        : String(
                                              primaryPaymentLine?.amount ??
                                                  "",
                                          )
                                }
                                onChange={(e) =>
                                    updatePosPayment(
                                        "1",
                                        "amount",
                                        Number(e.target.value) || 0,
                                    )
                                }
                                disabled={isSaving}
                                className="ml-auto w-24 rounded border border-slate-200 px-2 py-1 text-right text-sm font-semibold outline-none focus:border-[#3b82f6]"
                            />
                        </div>
                        {paymentMethodNeedsReference(
                            activePaymentMethod,
                        ) && (
                            <input
                                type="text"
                                value={
                                    primaryPaymentLine?.referenceNumber ||
                                    ""
                                }
                                onChange={(e) =>
                                    updatePosPayment(
                                        "1",
                                        "referenceNumber",
                                        e.target.value,
                                    )
                                }
                                disabled={isSaving}
                                placeholder="Nº operación / referencia"
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#3b82f6]"
                            />
                        )}
                        <div className="flex gap-2">
                            {quickAmounts.map((amount) => (
                                <button
                                    key={amount}
                                    type="button"
                                    onClick={() =>
                                        updatePosPayment(
                                            "1",
                                            "amount",
                                            amount,
                                        )
                                    }
                                    disabled={isSaving}
                                    className={`flex-1 rounded-lg border py-1.5 text-sm font-bold disabled:opacity-50 ${
                                        roundMoney2(
                                            primaryPaymentLine?.amount ||
                                                0,
                                        ) === amount
                                            ? "border-[#3b82f6] bg-[#3b82f6] text-white"
                                            : "border-[#3b82f6] bg-white text-[#3b82f6]"
                                    }`}
                                >
                                    {amount}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-4 flex items-center gap-3">
                        <span className="text-sm text-slate-600">vuelto</span>
                        <input
                            type="text"
                            readOnly
                            value={changeDue.toFixed(2)}
                            className="w-20 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-sm"
                        />
                    </div>

                    <div className="mb-4 hidden">
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                            Caja
                        </label>
                        <select
                            value={selectedCashRegister}
                            onChange={(e) =>
                                setSelectedCashRegister(e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        >
                            {cashRegisters.map((cr: any) => (
                                <option key={cr.id} value={cr.id}>
                                    {cr.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                            Descuento general
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                                S/
                            </span>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={discountAmount === 0 ? "" : discountAmount}
                                onChange={(e) =>
                                    setDiscountAmount(
                                        Math.max(
                                            0,
                                            Number(e.target.value) || 0,
                                        ),
                                    )
                                }
                                className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-10 text-sm outline-none focus:border-[#3b82f6]"
                            />
                            <button
                                type="button"
                                onClick={() => setDiscountAmount(0)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                            >
                                ↺
                            </button>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 border-t border-slate-100 p-4">
                    <button
                        type="button"
                        onClick={handleProcessSale}
                        disabled={isSaving || cartItems.length === 0}
                        className="w-full rounded-lg bg-[#3b82f6] py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#2563eb] disabled:opacity-50"
                    >
                        {isSaving ? "Procesando..." : "Aceptar y Crear"}
                    </button>
                </div>
                    </>
                )}
            </div>
        </div>

            {posDocPreview && (
                <DocumentPrintPreviewModal
                    title={posDocPreview.title}
                    onPrint={() => {
                        posDocPreviewResolverRef.current?.("print");
                    }}
                    onContinuePay={() => {
                        posDocPreviewResolverRef.current?.("continue");
                    }}
                    onCancel={() => {
                        posDocPreviewResolverRef.current?.("cancel");
                    }}
                />
            )}
        </>
    );
};

type ProductCardProps = {
    name: string;
    price: number;
    imageUrl?: string;
    quantity: number;
    badge?: string;
    disabled?: boolean;
    onAdd: () => void;
    onRemove: () => void;
};

const ProductCard: React.FC<ProductCardProps> = ({
    name,
    price,
    imageUrl,
    quantity,
    badge,
    disabled,
    onAdd,
    onRemove,
}) => {
    const hasQty = quantity > 0;

    return (
        <div
            className={`relative flex flex-col overflow-hidden rounded-lg border bg-white ${
                hasQty
                    ? "border-[#3b82f6] shadow-md shadow-blue-100"
                    : "border-slate-200"
            } ${disabled ? "opacity-50" : ""}`}
        >
            {badge && (
                <div className="absolute left-0 top-0 z-10">
                    <span className="block origin-top-left -rotate-45 bg-emerald-500 px-6 py-0.5 text-[9px] font-bold text-white">
                        {badge}
                    </span>
                </div>
            )}

            {hasQty && (
                <>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        className="absolute left-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white"
                    >
                        −
                    </button>
                    <span className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[#3b82f6] text-xs font-bold text-white">
                        {quantity}
                    </span>
                </>
            )}

            <button
                type="button"
                disabled={disabled}
                onClick={onAdd}
                className="relative aspect-[4/3] w-full overflow-hidden disabled:cursor-not-allowed"
            >
                {hasQty && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3b82f6] text-2xl font-light text-white">
                            +
                        </span>
                    </div>
                )}
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-50 text-3xl">
                        🍽️
                    </div>
                )}
            </button>

            <div className="flex flex-1 flex-col gap-1 p-2.5">
                <p className="line-clamp-2 text-[10px] font-semibold uppercase leading-tight text-slate-800">
                    {name}
                </p>
                <p className="mt-auto text-sm font-bold text-slate-900">
                    {currencyFormatter.format(price)}
                </p>
            </div>
        </div>
    );
};

export default PointOfSale;
