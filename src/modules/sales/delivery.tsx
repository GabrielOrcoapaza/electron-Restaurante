import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { useToast } from '../../context/ToastContext';
import { CREATE_SALE_CARRY_OUT } from '../../graphql/mutations';
import {
    GET_CATEGORIES_BY_BRANCH,
    GET_PRODUCTS_BY_CATEGORY,
    GET_PRODUCTS_BY_BRANCH,
    SEARCH_PRODUCTS,
    GET_DOCUMENTS_WITH_SERIALS,
    GET_CASH_REGISTERS_BY_BRANCH,
    GET_PERSONS_BY_BRANCH,
    GET_MODIFIERS_BY_SUBCATEGORY,
    SEARCH_PERSON_BY_DOCUMENT
} from '../../graphql/queries';
import { CREATE_PERSON } from '../../graphql/mutations';
import ModalObservation from './modalObservation';
import PayDeliveryModal from './payDelivery';

// Tipo para los ítems del carrito
type CartItem = {
    id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
    notes: string;
    subcategoryId?: string;
};

// Tipo para cliente
type Person = {
    id: string;
    name: string;
    documentType: string;
    documentNumber: string;
};

const Delivery: React.FC = () => {
    const { companyData, user, deviceId, getDeviceId, getMacAddress } = useAuth();
    const { showToast } = useToast();
    const { breakpoint } = useResponsive();

    // Responsive: sm 640-767, md 768-1023, lg 1024-1279, xl 1280-1535, 2xl >=1536
    const isSmall = breakpoint === 'sm';
    const isMedium = breakpoint === 'md';
    const isNarrow = isSmall || isMedium;

    // Valores adaptativos
    const mainGap = isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem';
    const mainPadding = isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem';
    const searchPadding = isSmall ? '0.6rem' : isMedium ? '0.7rem' : '1rem';
    const searchFontSize = isSmall ? '0.8125rem' : '0.875rem';
    const gridMinCol = isSmall ? '100px' : isMedium ? '115px' : '130px';
    const gridGap = isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem';
    const gridPadding = isSmall ? '0.6rem' : isMedium ? '0.8rem' : '1rem';
    const breadcrumbFontSize = isSmall ? '0.75rem' : '0.875rem';
    const cartMinWidth = isNarrow ? undefined : '320px';
    const panelLeftFlex = isSmall ? 1 : isMedium ? 1.2 : 1.4;
    const panelRightFlex = isSmall ? 1 : isMedium ? 1.1 : 1.25;
    const cardPadding = isSmall ? '0.75rem' : isMedium ? '1rem' : '1.25rem';
    const cartItemFontSize = isSmall ? '0.8125rem' : '0.875rem';
    const cartItemPadding = isSmall ? '0.35rem 0.5rem' : isMedium ? '0.45rem 0.55rem' : '0.6rem 0.75rem';

    // IGV de la sucursal
    const igvPercentageFromBranch = Number(companyData?.branch?.igvPercentage) || 10.5;

    // Estados
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Estados para el pago
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [personSearchTerm, setPersonSearchTerm] = useState<string>('');
    const [selectedDocument, setSelectedDocument] = useState<string>('');
    const [showObservationModal, setShowObservationModal] = useState<string | null>(null);
    const [productObservations, setProductObservations] = useState<Record<string, any[]>>({});
    const [selectedObservations, setSelectedObservations] = useState<Record<string, Set<string>>>({});
    const [selectedSerial, setSelectedSerial] = useState<string>('');
    const [selectedCashRegister, setSelectedCashRegister] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
    const [paidAmount, setPaidAmount] = useState<string>('');
    // Descuento: monto fijo (S/) y/o porcentaje (%)
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [discountPercent, setDiscountPercent] = useState<number>(0);
    // Modal de información de pago (se abre al hacer click en Procesar Venta)
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Mutación para crear venta
    const [createSaleCarryOutMutation] = useMutation(CREATE_SALE_CARRY_OUT);

    // Obtener categorías (siempre del servidor para ver cambios)
    const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
        variables: { branchId: companyData?.branch.id },
        skip: !companyData?.branch.id,
        fetchPolicy: 'network-only'
    });

    const categories = categoriesData?.categoriesByBranch || [];

    // Búsqueda de productos (siempre del servidor)
    const { data: searchData, loading: searchLoading } = useQuery(SEARCH_PRODUCTS, {
        variables: { search: searchTerm, branchId: companyData?.branch.id, limit: 50 },
        skip: !companyData?.branch.id || searchTerm.length < 3,
        errorPolicy: 'ignore',
        fetchPolicy: 'network-only'
    });

    // Obtener productos por categoría (siempre del servidor para precios actualizados)
    const { data: productsByCategoryData, loading: productsByCategoryLoading } = useQuery(GET_PRODUCTS_BY_CATEGORY, {
        variables: { categoryId: selectedCategory },
        skip: !selectedCategory || searchTerm.length >= 3,
        fetchPolicy: 'network-only'
    });

    // Obtener todos los productos (siempre del servidor para precios y productos nuevos)
    const { data: productsByBranchData, loading: productsByBranchLoading } = useQuery(GET_PRODUCTS_BY_BRANCH, {
        variables: { branchId: companyData?.branch.id },
        skip: !companyData?.branch.id,
        fetchPolicy: 'network-only'
    });

    // Obtener documentos con sus series
    const { data: documentsData } = useQuery(GET_DOCUMENTS_WITH_SERIALS, {
        variables: { branchId: companyData?.branch.id },
        skip: !companyData?.branch.id
    });

    const documents = documentsData?.documentsByBranch || [];

    // Obtener cajas registradoras
    const { data: cashRegistersData } = useQuery(GET_CASH_REGISTERS_BY_BRANCH, {
        variables: { branchId: companyData?.branch.id },
        skip: !companyData?.branch.id
    });

    const cashRegisters = cashRegistersData?.cashRegistersByBranch || [];

    // Personas (clientes) de la sucursal - siempre del servidor para ver clientes nuevos
    const { data: clientsData, loading: clientsLoading, refetch: refetchClients } = useQuery(GET_PERSONS_BY_BRANCH, {
        variables: { branchId: companyData?.branch.id },
        skip: !companyData?.branch.id,
        fetchPolicy: 'network-only'
    });

    // Búsqueda por documento en SUNAT / local
    const [searchPersonByDocument, { loading: sunatSearchLoading }] = useLazyQuery(SEARCH_PERSON_BY_DOCUMENT, {
        fetchPolicy: 'network-only'
    });
    const [createPersonMutation] = useMutation(CREATE_PERSON);

    // Factura (código 01) exige cliente con RUC
    const selectedDoc = documents.find((d: any) => d.id === selectedDocument);
    const isFactura = selectedDoc?.code === '01';

    const filteredClients = useMemo(() => {
        let clients = (clientsData?.personsByBranch || []).filter((c: any) =>
            !c.isSupplier && c.isActive !== false
        );
        if (isFactura) {
            clients = clients.filter((c: any) => (c.documentType || '').toUpperCase() === 'RUC');
        }
        if (!personSearchTerm) return clients.slice(0, 50);
        const lower = personSearchTerm.toLowerCase();
        return clients.filter((c: any) =>
            (c.name || '').toLowerCase().includes(lower) ||
            (c.documentNumber || '').includes(lower)
        ).slice(0, 50);
    }, [clientsData, personSearchTerm, isFactura]);

    // Determinar qué productos mostrar
    let products;
    let productsLoading;

    const isSearching = searchTerm.length >= 3;

    if (isSearching) {
        products = searchData?.searchProducts;
        productsLoading = searchLoading;

        if (!products || products.length === 0) {
            const allProducts = productsByBranchData?.productsByBranch || [];
            const searchLower = searchTerm.toLowerCase();
            products = allProducts.filter((p: any) =>
                p.name?.toLowerCase().includes(searchLower) ||
                p.code?.toLowerCase().includes(searchLower) ||
                p.description?.toLowerCase().includes(searchLower)
            );
        }
    } else if (selectedCategory) {
        products = productsByCategoryData?.productsByCategory;
        productsLoading = productsByCategoryLoading;
    } else {
        products = productsByBranchData?.productsByBranch;
        productsLoading = productsByBranchLoading;
    }

    let productsList = products || [];

    // Subcategorías de la categoría seleccionada
    const subcategoriesOfCategory = selectedCategory
        ? (categories.find((c: any) => c.id === selectedCategory)?.subcategories?.filter((s: any) => s.isActive) || [])
        : [];

    // Flags de navegación para la grilla
    const showCategoriesInGrid = !isSearching && !selectedCategory;
    const showSubcategoriesInGrid = !isSearching && selectedCategory && !selectedSubcategory && subcategoriesOfCategory.length > 0;
    const showProductsInGrid = isSearching || (selectedCategory && (selectedSubcategory || subcategoriesOfCategory.length === 0));

    // Filtrar productos por subcategoría si no estamos buscando
    if (!isSearching && selectedCategory && selectedSubcategory && productsList.length > 0) {
        productsList = productsList.filter((p: any) => String(p.subcategoryId) === String(selectedSubcategory));
    }

    // Función para agregar producto al carrito (permite precio cero y productos con precio)
    const handleAddProduct = (productIdToAdd?: string, qtyToAdd?: number) => {
        const productId = productIdToAdd || selectedProduct;
        if (!productId) return;

        const product = productsList.find((p: any) => p.id === productId);
        if (!product) return;

        const productPrice = parseFloat(product.salePrice) || 0;
        if (productPrice < 0) {
            showToast(`El producto "${product.name}" no tiene un precio válido`, 'error');
            return;
        }

        const qty = qtyToAdd ?? 1;
        const existingItemIndex = cartItems.findIndex(item => item.productId === product.id);

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
                notes: '',
                subcategoryId: product.subcategoryId
            };
            setCartItems([...cartItems, newItem]);
        }

        setSearchTerm('');
        if (!productIdToAdd) {
            setSelectedProduct(null);
        }
    };

    // Función para actualizar cantidad
    const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            handleRemoveItem(itemId);
            return;
        }

        const updatedItems = cartItems.map(item => {
            if (item.id === itemId) {
                const validQuantity = Number(newQuantity) || 1;
                const validPrice = Number(item.price) || 0;
                return {
                    ...item,
                    quantity: validQuantity,
                    total: validPrice * validQuantity
                };
            }
            return item;
        });
        setCartItems(updatedItems);
    };

    // Función para eliminar ítem
    const handleRemoveItem = (itemId: string) => {
        setCartItems(cartItems.filter(item => item.id !== itemId));
    };

    const [getObservations] = useLazyQuery(GET_MODIFIERS_BY_SUBCATEGORY, { fetchPolicy: 'network-only' });

    const handleOpenObservationModal = async (itemId: string) => {
        const item = cartItems.find(i => i.id === itemId);
        if (!item) return;
        if (item.subcategoryId && !productObservations[itemId]) {
            try {
                const { data } = await getObservations({ variables: { subcategoryId: item.subcategoryId } });
                if (data?.notesBySubcategory) {
                    const activeObservations = data.notesBySubcategory.filter((m: any) => m.isActive);
                    setProductObservations(prev => ({ ...prev, [itemId]: activeObservations }));
                    if (item.notes) {
                        const currentNotes = item.notes.split(', ').map((n: string) => n.trim());
                        const selectedIds = new Set<string>();
                        activeObservations.forEach((obs: any) => {
                            if (currentNotes.includes(obs.note)) selectedIds.add(obs.id);
                        });
                        if (selectedIds.size > 0) {
                            setSelectedObservations(prev => ({ ...prev, [itemId]: selectedIds }));
                        }
                    }
                }
            } catch (error) {
                console.error('Error al obtener observaciones:', error);
            }
        }
        setShowObservationModal(itemId);
    };

    const handleApplyObservations = (itemId: string, selectedIds: Set<string>, manualNotes: string) => {
        const item = cartItems.find(i => i.id === itemId);
        if (!item) return;
        setSelectedObservations(prev => ({ ...prev, [itemId]: selectedIds }));
        const selectedNotes = (productObservations[itemId] || [])
            .filter((o: any) => selectedIds.has(o.id))
            .map((o: any) => o.note)
            .filter(Boolean)
            .join(', ');
        const cleanManual = (manualNotes || '').trim();
        let finalNotes = '';
        if (selectedNotes && cleanManual) finalNotes = `${selectedNotes}, ${cleanManual}`;
        else if (selectedNotes) finalNotes = selectedNotes;
        else if (cleanManual) finalNotes = cleanManual;
        setCartItems(prev =>
            prev.map(i => (i.id !== itemId ? i : { ...i, notes: finalNotes }))
        );
        setShowObservationModal(null);
    };

    // Calcular totales (con descuento: monto fijo + porcentaje)
    const cartTotalRaw = cartItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const totalDiscount = Math.max(0, (Number(discountAmount) || 0) + (cartTotalRaw * (Number(discountPercent) || 0) / 100));
    const cartTotal = Math.max(0, cartTotalRaw - totalDiscount);
    const igvPercentageDecimal = igvPercentageFromBranch / 100;
    const subtotal = parseFloat((cartTotal / (1 + igvPercentageDecimal)).toFixed(2));
    const igvAmount = parseFloat((cartTotal - subtotal).toFixed(2));

    // Función para procesar la venta
    const handleProcessSale = async () => {
        if (cartItems.length === 0) {
            showToast('Debe agregar al menos un producto al carrito', 'error');
            return;
        }

        if (!selectedDocument) {
            showToast('Debe seleccionar un tipo de documento', 'error');
            return;
        }

        if (!selectedSerial) {
            showToast('Debe seleccionar una serie', 'error');
            return;
        }

        // Factura (código 01) solo permite cliente con RUC; Boleta permite DNI o RUC
        if (isFactura) {
            if (!selectedPerson) {
                showToast('Para emitir una FACTURA debe seleccionar un cliente con RUC', 'error');
                return;
            }
            if ((selectedPerson.documentType || '').toUpperCase() !== 'RUC') {
                showToast('Para emitir una FACTURA el cliente debe tener un RUC válido', 'error');
                return;
            }
        }

        if (!selectedCashRegister) {
            showToast('Debe seleccionar una caja registradora', 'error');
            return;
        }

        const paidAmountNum = parseFloat(paidAmount) || 0;
        if (paidAmountNum < cartTotal) {
            showToast('El monto pagado debe ser mayor o igual al total', 'error');
            return;
        }

        setIsSaving(true);

        try {
            const igvRate = igvPercentageFromBranch / 100;

            const items = cartItems.map(item => {
                const unitPrice = parseFloat((Math.round(item.price * 100) / 100).toFixed(2));
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const unitValue = parseFloat((Math.round((unitPrice / (1 + igvRate)) * 100) / 100).toFixed(2));
                const notes = typeof item.notes === 'string' ? item.notes.trim() : '';

                return {
                    productId: String(item.productId),
                    quantity,
                    unitValue,
                    unitPrice,
                    notes,
                    discount: 0
                };
            });

            const now = new Date();
            const emissionDate = now.toISOString().split('T')[0]; // YYYY-MM-DD (10 chars)
            // CORRECCIÓN: emission_time debe ser solo HH:MM:SS (8 caracteres)
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const emissionTime = `${hours}:${minutes}:${seconds}`; // Formato HH:MM:SS (8 chars)
            // Obtener deviceId o MAC address
            let resolvedDeviceId: string;
            if (deviceId) {
                resolvedDeviceId = deviceId;
            } else {
                try {
                    resolvedDeviceId = await getMacAddress();
                } catch (error) {
                    console.error('Error al obtener MAC address:', error);
                    resolvedDeviceId = getDeviceId();
                }
            }

            // Asegurar que los montos no tengan demasiados decimales (que podrían exceder la longitud de texto en el backend)
            const cleanCartTotal = parseFloat(cartTotal.toFixed(2));
            const cleanSubtotal = parseFloat(subtotal.toFixed(2));
            const cleanIgvAmount = parseFloat(igvAmount.toFixed(2));
            const cleanPaidAmount = parseFloat(paidAmountNum.toFixed(2));
            const cleanTotalDiscount = parseFloat(totalDiscount.toFixed(2));

            const variables: any = {
                branchId: companyData?.branch.id,
                userId: user?.id,
                documentId: selectedDocument,
                serial: selectedSerial,
                emissionDate, //YYYY-MM-DD
                emissionTime, // HH:MM:SS
                currency: 'PEN',
                exchangeRate: 1.0,
                itemsTotalDiscount: 0,
                globalDiscount: cleanTotalDiscount,
                globalDiscountPercent: parseFloat((Number(discountPercent) || 0).toFixed(2)),
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
                payments: [
                    {
                        cashRegisterId: selectedCashRegister,
                        paymentType: 'CASH',
                        paymentMethod,
                        transactionType: 'INCOME',
                        paymentDate: now.toISOString(),
                        totalAmount: cleanCartTotal,
                        paidAmount: cleanPaidAmount,
                        notes: ''
                    }
                ],
                notes: '',
                deviceId: resolvedDeviceId // No truncar, el backend ya se encarga
            };

            if (selectedPerson) {
                variables.personId = selectedPerson.id;
            }

            const result = await createSaleCarryOutMutation({ variables });

            if (result.data?.createSaleCarryOut?.success) {
                showToast('Venta procesada exitosamente', 'success');
                setShowPaymentModal(false);

                // Limpiar formulario
                setCartItems([]);
                setSelectedPerson(null);
                setPersonSearchTerm('');
                setSelectedDocument('');
                setSelectedSerial('');
                setPaidAmount('');
                setDiscountAmount(0);
                setDiscountPercent(0);
                setSelectedCategory(null);
                setSelectedSubcategory(null);
                setSearchTerm('');

            } else {
                throw new Error(result.data?.createSaleCarryOut?.message || 'Error al procesar la venta');
            }
        } catch (error: any) {
            console.error('Error al procesar venta:', error);
            showToast(error.message || 'Error al procesar la venta', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Al cambiar a Factura, quitar cliente si no tiene RUC
    useEffect(() => {
        const doc = documents.find((d: any) => d.id === selectedDocument);
        if (doc?.code === '01' && selectedPerson && (selectedPerson.documentType || '').toUpperCase() !== 'RUC') {
            setSelectedPerson(null);
            setPersonSearchTerm('');
        }
    }, [selectedDocument, documents, selectedPerson]);

    // Buscar cliente por documento en SUNAT o local (como en cashPay)
    const handleSearchSunat = async () => {
        const term = (personSearchTerm || '').trim().replace(/\s/g, '');
        if (!/^\d+$/.test(term) || !companyData?.branch?.id) return;
        const isRuc = term.length === 11;
        const isDni = term.length === 8;
        if (isFactura && !isRuc) return;
        if (!isRuc && !isDni) return;
        const documentType = isRuc ? 'RUC' : 'DNI';
        try {
            const { data } = await searchPersonByDocument({
                variables: { documentType, documentNumber: term, branchId: companyData.branch.id }
            });
            const result = data?.searchPersonByDocument;
            if (!result?.person) {
                showToast('No se encontró el documento en SUNAT ni en el sistema.', 'error');
                return;
            }
            const person = result.person;
            if (person.id && result.foundLocally) {
                setSelectedPerson({
                    id: person.id,
                    name: person.name || '',
                    documentType: person.documentType || documentType,
                    documentNumber: person.documentNumber || term
                });
                setPersonSearchTerm(person.name || '');
                const { data: refetched } = await refetchClients();
                const updated = (refetched?.personsByBranch || []).find((p: any) => p.id === person.id);
                if (updated?.name) {
                    setPersonSearchTerm(updated.name);
                    setSelectedPerson(prev => prev ? { ...prev, name: updated.name } : null);
                }
                return;
            }
            // Encontrado en SUNAT (o datos para crear): crear cliente y seleccionar
            const { data: createData } = await createPersonMutation({
                variables: {
                    branchId: companyData.branch.id,
                    documentType: person.documentType || documentType,
                    documentNumber: person.documentNumber || term,
                    name: person.name || (documentType === 'RUC' ? 'Empresa' : 'Cliente'),
                    address: person.address || undefined,
                    phone: person.phone || undefined,
                    email: person.email || undefined,
                    isCustomer: true,
                    isSupplier: false
                }
            });
            if (createData?.createPerson?.success && createData?.createPerson?.person) {
                const newPerson = createData.createPerson.person;
                setSelectedPerson({
                    id: newPerson.id,
                    name: newPerson.name || '',
                    documentType: newPerson.documentType || documentType,
                    documentNumber: newPerson.documentNumber || term
                });
                setPersonSearchTerm(newPerson.name || '');
            } else {
                showToast(createData?.createPerson?.message || 'Error al registrar el cliente.', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error al buscar en SUNAT.', 'error');
        }
    };

    // Obtener seriales del documento seleccionado
    const selectedDocumentData = documents.find((d: any) => d.id === selectedDocument);
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
        <div style={{
            height: '100%',
            minHeight: 0,
            width: '100%',
            display: 'flex',
            flexDirection: isNarrow ? 'column' : 'row',
            gap: mainGap,
            padding: mainPadding,
            boxSizing: 'border-box',
            overflowY: isNarrow ? 'auto' : 'hidden',
            overflowX: 'hidden'
        }}>
            {/* Panel izquierdo - Productos */}
            <div style={{
                flex: isNarrow ? '1 1 50%' : panelLeftFlex,
                minWidth: 0,
                minHeight: isNarrow ? '200px' : 0,
                display: 'flex',
                flexDirection: 'column',
                gap: mainGap,
                overflow: 'hidden'
            }}>
                {/* Búsqueda */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: isSmall ? '10px' : '12px',
                    padding: searchPadding,
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}>
                    <input
                        type="text"
                        placeholder="Buscar productos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: isSmall ? '0.5rem 0.6rem' : '0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: searchFontSize,
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* Área de navegación y Lista de items */}
                <div style={{
                    flex: 1,
                    minHeight: 0,
                    backgroundColor: 'white',
                    borderRadius: isSmall ? '10px' : '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden'
                }}>
                    {/* Header de navegación / Breadcrumbs */}
                    <div style={{
                        padding: isSmall ? '0.6rem 0.75rem' : '1rem',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
                            {isSearching ? (
                                <h3 style={{ fontSize: breadcrumbFontSize, fontWeight: '600', color: '#2d3748', margin: 0 }}>
                                    Resultados de búsqueda
                                </h3>
                            ) : (
                                <>
                                    <button
                                        onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); }}
                                        style={{
                                            padding: isSmall ? '0.2rem 0.4rem' : '0.25rem 0.5rem',
                                            background: !selectedCategory ? '#f1f5f9' : 'transparent',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: breadcrumbFontSize,
                                            fontWeight: !selectedCategory ? '700' : '500',
                                            color: !selectedCategory ? '#1e293b' : '#64748b',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        Categorías
                                    </button>
                                    {selectedCategory && (
                                        <>
                                            <span style={{ color: '#94a3b8' }}>/</span>
                                            <button
                                                onClick={() => setSelectedSubcategory(null)}
                                                style={{
                                                    padding: isSmall ? '0.2rem 0.4rem' : '0.25rem 0.5rem',
                                                    background: !selectedSubcategory ? '#f1f5f9' : 'transparent',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: breadcrumbFontSize,
                                                    fontWeight: !selectedSubcategory ? '700' : '500',
                                                    color: !selectedSubcategory ? '#1e293b' : '#64748b',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {categories.find((c: any) => c.id === selectedCategory)?.name || 'Categoría'}
                                            </button>
                                        </>
                                    )}
                                    {selectedSubcategory && (
                                        <>
                                            <span style={{ color: '#94a3b8' }}>/</span>
                                            <span style={{
                                                padding: isSmall ? '0.2rem 0.4rem' : '0.25rem 0.5rem',
                                                background: '#f1f5f9',
                                                borderRadius: '6px',
                                                fontSize: breadcrumbFontSize,
                                                fontWeight: '700',
                                                color: '#1e293b',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {subcategoriesOfCategory.find((s: any) => s.id === selectedSubcategory)?.name || 'Subcategoría'}
                                            </span>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {(selectedCategory || isSearching) && (
                            <button
                                onClick={() => {
                                    if (isSearching) setSearchTerm('');
                                    else if (selectedSubcategory) setSelectedSubcategory(null);
                                    else setSelectedCategory(null);
                                }}
                                style={{
                                    padding: isSmall ? '0.3rem 0.5rem' : '0.375rem 0.75rem',
                                    backgroundColor: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: isSmall ? '0.7rem' : '0.75rem',
                                    fontWeight: '600',
                                    color: '#475569',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}
                            >
                                ⬅ Volver
                            </button>
                        )}
                    </div>

                    {/* Grid de items - scroll en pantallas pequeñas */}
                    <div style={{
                        flex: 1,
                        minHeight: 0,
                        maxHeight: '100%',
                        padding: gridPadding,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'thin'
                    } as React.CSSProperties}>
                        {productsLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#718096', fontSize: isSmall ? '0.8125rem' : '0.875rem' }}>
                                Cargando...
                            </div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(auto-fill, minmax(${gridMinCol}, 1fr))`,
                                gap: gridGap
                            }}>
                                {/* Render Categorías */}
                                {showCategoriesInGrid && categories.map((category: any) => (
                                    <div
                                        key={category.id}
                                        onClick={() => setSelectedCategory(category.id)}
                                        style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: isSmall ? '10px' : '12px',
                                            padding: gridPadding,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minHeight: isSmall ? '90px' : isMedium ? '105px' : '120px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                                            e.currentTarget.style.borderColor = '#667eea';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                        }}
                                    >
                                        <div style={{ fontSize: isSmall ? '2rem' : '2.5rem', marginBottom: '0.5rem' }}>
                                            {category.icon || '📁'}
                                        </div>
                                        <div style={{
                                            fontSize: isSmall ? '0.75rem' : breadcrumbFontSize,
                                            fontWeight: '700',
                                            color: '#1e293b',
                                            textAlign: 'center'
                                        }}>
                                            {category.name}
                                        </div>
                                    </div>
                                ))}

                                {/* Render Subcategorías */}
                                {showSubcategoriesInGrid && subcategoriesOfCategory.map((sub: any) => (
                                    <div
                                        key={sub.id}
                                        onClick={() => setSelectedSubcategory(sub.id)}
                                        style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: isSmall ? '10px' : '12px',
                                            padding: gridPadding,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minHeight: isSmall ? '80px' : isMedium ? '90px' : '100px',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.borderColor = '#667eea';
                                            e.currentTarget.style.backgroundColor = '#f0f4ff';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                            e.currentTarget.style.backgroundColor = '#ffffff';
                                        }}
                                    >
                                        <div style={{ fontSize: isSmall ? '1.5rem' : '2rem', marginBottom: '0.25rem' }}>📂</div>
                                        <div style={{
                                            fontSize: isSmall ? '0.75rem' : '0.8125rem',
                                            fontWeight: '600',
                                            color: '#334155',
                                            textAlign: 'center'
                                        }}>
                                            {sub.name}
                                        </div>
                                    </div>
                                ))}

                                {/* Render Productos */}
                                {showProductsInGrid && (
                                    productsList.length === 0 ? (
                                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                            No se encontraron productos
                                        </div>
                                    ) : (
                                        productsList.map((product: any) => (
                                            <div
                                                key={product.id}
                                                onClick={() => handleAddProduct(product.id, 1)}
                                                style={{
                                                    backgroundColor: '#f8fafc',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: isSmall ? '8px' : '10px',
                                                    padding: isSmall ? '0.4rem' : '0.5rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    textAlign: 'center',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    height: '100%'
                                                }}
                                                onMouseOver={(e) => {
                                                    e.currentTarget.style.borderColor = '#667eea';
                                                    e.currentTarget.style.backgroundColor = '#f0f4ff';
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                                    e.currentTarget.style.backgroundColor = '#f8fafc';
                                                }}
                                            >
                                                {product.imageBase64 ? (
                                                    <img
                                                        src={`data:image/jpeg;base64,${product.imageBase64}`}
                                                        alt={product.name}
                                                        style={{
                                                            width: '100%',
                                                            height: isSmall ? '60px' : '80px',
                                                            objectFit: 'cover',
                                                            borderRadius: '8px',
                                                            marginBottom: isSmall ? '0.35rem' : '0.5rem'
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        width: '100%',
                                                        height: isSmall ? '60px' : '80px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: '#f1f5f9',
                                                        borderRadius: '8px',
                                                        marginBottom: isSmall ? '0.35rem' : '0.5rem',
                                                        fontSize: isSmall ? '1.5rem' : '2rem'
                                                    }}>
                                                        🍽️
                                                    </div>
                                                )}
                                                <div style={{
                                                    fontSize: isSmall ? '0.7rem' : '0.75rem',
                                                    fontWeight: '600',
                                                    color: '#1e293b',
                                                    marginBottom: '0.25rem',
                                                    lineHeight: '1.2',
                                                    flex: 1,
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical' as const,
                                                    overflow: 'hidden'
                                                }}>
                                                    {product.name}
                                                </div>
                                                <div style={{
                                                    fontSize: isSmall ? '0.75rem' : '0.8125rem',
                                                    fontWeight: '700',
                                                    color: '#4f46e5',
                                                    marginTop: 'auto'
                                                }}>
                                                    S/ {parseFloat(product.salePrice || 0).toFixed(2)}
                                                </div>
                                            </div>
                                        ))
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Panel derecho - Carrito y Pago */}
            <div style={{
                flex: isNarrow ? '0 0 auto' : panelRightFlex,
                width: isNarrow ? '100%' : 'auto',
                minWidth: cartMinWidth,
                display: 'flex',
                flexDirection: 'column',
                gap: mainGap,
                overflow: isNarrow ? 'visible' : 'hidden',
                maxHeight: isNarrow ? 'none' : '100%',
                backgroundColor: isNarrow ? 'transparent' : '#f8fafc' // Fondo ligero para separar
            }}>
                {/* Carrito */}
                <div style={{
                    flex: isNarrow ? 'none' : '1.5 1 0%', // Aumentar prioridad de espacio al carrito
                    minHeight: isNarrow ? '300px' : '250px',
                    maxHeight: isNarrow ? '450px' : 'none',
                    backgroundColor: 'white',
                    borderRadius: isSmall ? '10px' : '12px',
                    padding: cardPadding,
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        flex: 1,
                        minHeight: 0,
                        overflow: 'auto',
                        marginBottom: isSmall ? '0.75rem' : '1rem'
                    }}>
                        {cartItems.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: isSmall ? '1.5rem' : '2rem', color: '#718096', fontSize: cartItemFontSize }}>
                                El carrito está vacío
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: isSmall ? '0.35rem' : '0.5rem' }}>
                                {cartItems.map((item) => (
                                    <div
                                        key={item.id}
                                        style={{
                                            backgroundColor: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            padding: cartItemPadding
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            justifyContent: 'flex-start',
                                            flexWrap: 'nowrap',
                                            width: '100%',
                                            overflow: 'hidden'
                                        }}>
                                            {/* Controles de cantidad */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                                                <button
                                                    onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                                    style={{
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #cbd5e0',
                                                        background: 'white',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        padding: 0
                                                    }}
                                                >
                                                    −
                                                </button>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 0)}
                                                    min="1"
                                                    style={{
                                                        width: '28px',
                                                        textAlign: 'center',
                                                        border: '1px solid #cbd5e0',
                                                        borderRadius: '4px',
                                                        padding: '0.1rem',
                                                        fontWeight: 700,
                                                        fontSize: '0.75rem',
                                                        background: 'white',
                                                        color: '#1a202c'
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                                    style={{
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #cbd5e0',
                                                        background: 'white',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        padding: 0
                                                    }}
                                                >
                                                    +
                                                </button>
                                            </div>

                                            {/* Nombre del producto */}
                                            <div style={{ flex: '1', minWidth: 0 }}>
                                                <div style={{
                                                    fontWeight: 600,
                                                    color: '#2d3748',
                                                    fontSize: cartItemFontSize,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    lineHeight: '1.2'
                                                }}>
                                                    {item.name}
                                                </div>
                                                {item.notes && (
                                                    <div style={{
                                                        fontSize: '0.625rem',
                                                        color: '#64748b',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {item.notes}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Precio total */}
                                            <div style={{
                                                fontWeight: 700,
                                                color: '#2d3748',
                                                fontSize: '0.75rem',
                                                flexShrink: 0,
                                                minWidth: '55px',
                                                textAlign: 'right'
                                            }}>
                                                S/ {item.total.toFixed(2)}
                                            </div>

                                            {/* Acciones */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenObservationModal(item.id)}
                                                    style={{
                                                        padding: '0.2rem 0.4rem',
                                                        borderRadius: '6px',
                                                        border: '1px solid #bae6fd',
                                                        background: item.notes ? '#dbeafe' : '#f0f9ff',
                                                        color: '#0369a1',
                                                        fontSize: '0.75rem',
                                                        cursor: 'pointer',
                                                        lineHeight: 1
                                                    }}
                                                    title="Notas"
                                                >
                                                    📋
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    style={{
                                                        padding: '0.2rem 0.4rem',
                                                        background: 'white',
                                                        border: '1px solid #fed7d7',
                                                        borderRadius: '6px',
                                                        color: '#dc2626',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem',
                                                        lineHeight: 1
                                                    }}
                                                    title="Eliminar"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Descuento (S/) y (%) */}
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginTop: '0.5rem',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ flex: 1, minWidth: '70px' }}>
                            <label style={{ fontSize: '0.65rem', color: '#718096', display: 'block', marginBottom: '0.15rem' }}>Descuento (S/)</label>
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={discountAmount || ''}
                                onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                                placeholder="0"
                                style={{
                                    width: '100%',
                                    padding: '0.35rem 0.4rem',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: '70px' }}>
                            <label style={{ fontSize: '0.65rem', color: '#718096', display: 'block', marginBottom: '0.15rem' }}>Descuento (%)</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={discountPercent || ''}
                                onChange={(e) => setDiscountPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                                placeholder="0"
                                style={{
                                    width: '100%',
                                    padding: '0.35rem 0.4rem',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>
                    {/* Totales */}
                    <div style={{
                        borderTop: '1px solid #e2e8f0',
                        paddingTop: '0.75rem'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '0.5rem'
                        }}>
                            <span style={{ fontSize: '0.75rem', color: '#718096' }}>Subtotal:</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>S/ {subtotal.toFixed(2)}</span>
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '0.5rem'
                        }}>
                            <span style={{ fontSize: '0.75rem', color: '#718096' }}>IGV ({igvPercentageFromBranch}%):</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>S/ {igvAmount.toFixed(2)}</span>
                        </div>
                        {totalDiscount > 0 && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '0.5rem',
                                color: '#059669',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                            }}>
                                <span>Descuento</span>
                                <span>- S/ {totalDiscount.toFixed(2)}</span>
                            </div>
                        )}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            paddingTop: '0.5rem',
                            borderTop: '1px solid #e2e8f0'
                        }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#2d3748' }}>Total:</span>
                            <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#667eea' }}>S/ {cartTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Botón procesar: abre modal de información de pago */}
                <button
                    onClick={() => setShowPaymentModal(true)}
                    disabled={isSaving || cartItems.length === 0}
                    style={{
                        width: '100%',
                        padding: isMedium ? '0.75rem' : '1rem',
                        backgroundColor: isSaving || cartItems.length === 0 ? '#cbd5e0' : '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: isMedium ? '0.875rem' : '1rem',
                        fontWeight: '700',
                        cursor: isSaving || cartItems.length === 0 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 6px rgba(102, 126, 234, 0.25)',
                        flexShrink: 0
                    }}
                >
                    {isSaving ? 'Procesando...' : 'Procesar Venta'}
                </button>
            </div>

            {/* Modal Información de Pago - componente en payDelivery.tsx */}
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
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    paidAmount={paidAmount}
                    setPaidAmount={setPaidAmount}
                    onConfirm={handleProcessSale}
                />
            )}

            {showObservationModal && (() => {
                const item = cartItems.find(i => i.id === showObservationModal);
                if (!item) return null;
                const observations = productObservations[showObservationModal] || [];
                const selectedIds = selectedObservations[showObservationModal] || new Set<string>();
                return (
                    <ModalObservation
                        isOpen={true}
                        onClose={() => setShowObservationModal(null)}
                        observations={observations}
                        selectedObservationIds={selectedIds}
                        onApply={(ids, manualNotes) => handleApplyObservations(showObservationModal, ids, manualNotes)}
                        productName={item.name}
                        currentNotes={item.notes || ''}
                        canEdit={true}
                    />
                );
            })()}
        </div>
    );
};

export default Delivery;
