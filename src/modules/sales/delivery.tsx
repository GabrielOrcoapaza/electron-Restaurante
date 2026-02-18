import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
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
    GET_MODIFIERS_BY_SUBCATEGORY
} from '../../graphql/queries';
import ModalObservation from './modalObservation';

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

    // IGV de la sucursal
    const igvPercentageFromBranch = Number(companyData?.branch?.igvPercentage) || 10.5;

    // Estados
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

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

    // Mutación para crear venta
    const [createSaleCarryOutMutation] = useMutation(CREATE_SALE_CARRY_OUT);

    // Obtener categorías
    const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
        variables: { branchId: companyData?.branch.id },
        skip: !companyData?.branch.id
    });

    const categories = categoriesData?.categoriesByBranch || [];

    // Búsqueda de productos
    const { data: searchData, loading: searchLoading } = useQuery(SEARCH_PRODUCTS, {
        variables: { search: searchTerm, branchId: companyData?.branch.id, limit: 50 },
        skip: !companyData?.branch.id || searchTerm.length < 3,
        errorPolicy: 'ignore'
    });

    // Obtener productos por categoría
    const { data: productsByCategoryData, loading: productsByCategoryLoading } = useQuery(GET_PRODUCTS_BY_CATEGORY, {
        variables: { categoryId: selectedCategory },
        skip: !selectedCategory || searchTerm.length >= 3
    });

    // Obtener todos los productos
    const { data: productsByBranchData, loading: productsByBranchLoading } = useQuery(GET_PRODUCTS_BY_BRANCH, {
        variables: { branchId: companyData?.branch.id },
        skip: !companyData?.branch.id
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

    // Personas (clientes) de la sucursal - filtrado local como en convertDocumentModal
    const { data: clientsData } = useQuery(GET_PERSONS_BY_BRANCH, {
        variables: { branchId: companyData?.branch.id },
        skip: !companyData?.branch.id
    });

    // Factura (código 01) exige cliente con RUC
    const selectedDoc = documents.find((d: any) => d.id === selectedDocument);
    const isFactura = selectedDoc?.code === '01';

    const filteredClients = useMemo(() => {
        let clients = clientsData?.personsByBranch || [];
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

    // Función para agregar producto al carrito
    const handleAddProduct = (productIdToAdd?: string, qtyToAdd?: number) => {
        const productId = productIdToAdd || selectedProduct;
        if (!productId) return;

        const product = productsList.find((p: any) => p.id === productId);
        if (!product) return;

        const productPrice = parseFloat(product.salePrice) || 0;
        if (productPrice <= 0) {
            setSaveError(`El producto "${product.name}" no tiene un precio válido`);
            setTimeout(() => setSaveError(null), 3000);
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

    const [getObservations] = useLazyQuery(GET_MODIFIERS_BY_SUBCATEGORY, { fetchPolicy: 'cache-and-network' });

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
            setSaveError('Debe agregar al menos un producto al carrito');
            setTimeout(() => setSaveError(null), 3000);
            return;
        }

        if (!selectedDocument) {
            setSaveError('Debe seleccionar un tipo de documento');
            setTimeout(() => setSaveError(null), 3000);
            return;
        }

        if (!selectedSerial) {
            setSaveError('Debe seleccionar una serie');
            setTimeout(() => setSaveError(null), 3000);
            return;
        }

        if (!selectedCashRegister) {
            setSaveError('Debe seleccionar una caja registradora');
            setTimeout(() => setSaveError(null), 3000);
            return;
        }

        const paidAmountNum = parseFloat(paidAmount) || 0;
        if (paidAmountNum < cartTotal) {
            setSaveError('El monto pagado debe ser mayor o igual al total');
            setTimeout(() => setSaveError(null), 3000);
            return;
        }

        setIsSaving(true);
        setSaveError(null);

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

                setTimeout(() => {
                    setSaveError(null);
                }, 500);
            } else {
                throw new Error(result.data?.createSaleCarryOut?.message || 'Error al procesar la venta');
            }
        } catch (error: any) {
            console.error('Error al procesar venta:', error);
            setSaveError(error.message || 'Error al procesar la venta');
            setTimeout(() => setSaveError(null), 5000);
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

    // Obtener seriales del documento seleccionado
    const selectedDocumentData = documents.find((d: any) => d.id === selectedDocument);
    const serials = selectedDocumentData?.serials || [];

    return (
        <div style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            gap: '1rem',
            padding: '1rem',
            boxSizing: 'border-box',
            overflow: 'hidden'
        }}>
            {/* Panel izquierdo - Productos (reducido para dar más espacio al carrito/pago) */}
            <div style={{
                flex: 1.4,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                overflow: 'hidden'
            }}>
                {/* Búsqueda */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '1rem',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}>
                    <input
                        type="text"
                        placeholder="Buscar productos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* Área de navegación y Lista de items */}
                <div style={{
                    flex: 1,
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden'
                }}>
                    {/* Header de navegación / Breadcrumbs */}
                    <div style={{
                        padding: '1rem',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                            {isSearching ? (
                                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#2d3748', margin: 0 }}>
                                    Resultados de búsqueda
                                </h3>
                            ) : (
                                <>
                                    <button
                                        onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); }}
                                        style={{
                                            padding: '0.25rem 0.5rem',
                                            background: !selectedCategory ? '#f1f5f9' : 'transparent',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '0.875rem',
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
                                                    padding: '0.25rem 0.5rem',
                                                    background: !selectedSubcategory ? '#f1f5f9' : 'transparent',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '0.875rem',
                                                    fontWeight: !selectedSubcategory ? '700' : '500',
                                                    color: !selectedSubcategory ? '#1e293b' : '#64748b',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: '120px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
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
                                                padding: '0.25rem 0.5rem',
                                                background: '#f1f5f9',
                                                borderRadius: '6px',
                                                fontSize: '0.875rem',
                                                fontWeight: '700',
                                                color: '#1e293b',
                                                whiteSpace: 'nowrap',
                                                maxWidth: '120px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
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
                                    padding: '0.375rem 0.75rem',
                                    backgroundColor: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
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

                    {/* Grid de items */}
                    <div style={{
                        flex: 1,
                        padding: '1rem',
                        overflow: 'auto'
                    }}>
                        {productsLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                                Cargando...
                            </div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                                gap: '1rem'
                            }}>
                                {/* Render Categorías */}
                                {showCategoriesInGrid && categories.map((category: any) => (
                                    <div
                                        key={category.id}
                                        onClick={() => setSelectedCategory(category.id)}
                                        style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '12px',
                                            padding: '1rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minHeight: '120px',
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
                                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                                            {category.icon || '📁'}
                                        </div>
                                        <div style={{
                                            fontSize: '0.875rem',
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
                                            borderRadius: '12px',
                                            padding: '1rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minHeight: '100px',
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
                                        <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>📂</div>
                                        <div style={{
                                            fontSize: '0.8125rem',
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
                                                    borderRadius: '10px',
                                                    padding: '0.5rem',
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
                                                            height: '80px',
                                                            objectFit: 'cover',
                                                            borderRadius: '8px',
                                                            marginBottom: '0.5rem'
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        width: '100%',
                                                        height: '80px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: '#f1f5f9',
                                                        borderRadius: '8px',
                                                        marginBottom: '0.5rem',
                                                        fontSize: '2rem'
                                                    }}>
                                                        🍽️
                                                    </div>
                                                )}
                                                <div style={{
                                                    fontSize: '0.75rem',
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
                                                    fontSize: '0.8125rem',
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
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                overflow: 'hidden'
            }}>
                {/* Carrito */}
                <div style={{
                    flex: 1,
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '1rem',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    <h3 style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#2d3748',
                        marginBottom: '0.75rem'
                    }}>
                        Carrito ({cartItems.length})
                    </h3>
                    <div style={{
                        flex: 1,
                        overflow: 'auto',
                        marginBottom: '1rem'
                    }}>
                        {cartItems.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                                El carrito está vacío
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {cartItems.map((item) => (
                                    <div
                                        key={item.id}
                                        style={{
                                            backgroundColor: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            padding: '0.4rem'
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
                                                    fontSize: '0.75rem',
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

                {/* Formulario de pago */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '1rem',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    overflow: 'auto'
                }}>
                    <h3 style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#2d3748',
                        marginBottom: '0.75rem'
                    }}>
                        Información de Pago
                    </h3>

                    {/* Cliente */}
                    <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            color: '#4a5568',
                            display: 'block',
                            marginBottom: '0.25rem'
                        }}>
                            Cliente (opcional)
                        </label>
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={personSearchTerm}
                            onChange={(e) => {
                                setPersonSearchTerm(e.target.value);
                                setSelectedPerson(null);
                            }}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                boxSizing: 'border-box'
                            }}
                        />
                        {personSearchTerm && !selectedPerson && filteredClients.length > 0 && (
                            <div style={{
                                marginTop: '0.25rem',
                                maxHeight: '150px',
                                overflowY: 'auto',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                backgroundColor: 'white'
                            }}>
                                {filteredClients.map((client: any) => (
                                    <div
                                        key={client.id}
                                        onClick={() => {
                                            setSelectedPerson(client);
                                            setPersonSearchTerm(client.name);
                                        }}
                                        style={{
                                            padding: '0.5rem',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #f1f5f9',
                                            fontSize: '0.75rem'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f7fafc'}
                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                    >
                                        <div style={{ fontWeight: '600' }}>{client.name}</div>
                                        <div style={{ color: '#718096', fontSize: '0.6875rem' }}>
                                            {client.documentType}: {client.documentNumber}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Documento */}
                    <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            color: '#4a5568',
                            display: 'block',
                            marginBottom: '0.25rem'
                        }}>
                            Tipo de Documento *
                        </label>
                        <select
                            value={selectedDocument}
                            onChange={(e) => {
                                setSelectedDocument(e.target.value);
                                setSelectedSerial('');
                            }}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                boxSizing: 'border-box'
                            }}
                        >
                            <option value="">Seleccionar...</option>
                            {documents.map((doc: any) => (
                                <option key={doc.id} value={doc.id}>
                                    {doc.description}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Serie */}
                    {selectedDocument && (
                        <div style={{ marginBottom: '0.75rem' }}>
                            <label style={{
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                color: '#4a5568',
                                display: 'block',
                                marginBottom: '0.25rem'
                            }}>
                                Serie *
                            </label>
                            <select
                                value={selectedSerial}
                                onChange={(e) => setSelectedSerial(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <option value="">Seleccionar...</option>
                                {serials.map((serial: any) => (
                                    <option key={serial.id} value={serial.serial}>
                                        {serial.serial}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Caja */}
                    <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            color: '#4a5568',
                            display: 'block',
                            marginBottom: '0.25rem'
                        }}>
                            Caja Registradora *
                        </label>
                        <select
                            value={selectedCashRegister}
                            onChange={(e) => setSelectedCashRegister(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                boxSizing: 'border-box'
                            }}
                        >
                            <option value="">Seleccionar...</option>
                            {cashRegisters.map((cashRegister: any) => (
                                <option key={cashRegister.id} value={cashRegister.id}>
                                    {cashRegister.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Método de pago */}
                    <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            color: '#4a5568',
                            display: 'block',
                            marginBottom: '0.25rem'
                        }}>
                            Método de Pago *
                        </label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                boxSizing: 'border-box'
                            }}
                        >
                            <option value="CASH">Efectivo</option>
                            <option value="CARD">Tarjeta</option>
                            <option value="TRANSFER">Transferencia</option>
                            <option value="YAPE">Yape</option>
                            <option value="PLIN">Plin</option>
                        </select>
                    </div>

                    {/* Monto pagado */}
                    <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            color: '#4a5568',
                            display: 'block',
                            marginBottom: '0.25rem'
                        }}>
                            Monto Pagado *
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={paidAmount}
                            onChange={(e) => setPaidAmount(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                boxSizing: 'border-box'
                            }}
                        />
                        {paidAmount && parseFloat(paidAmount) > cartTotal && (
                            <div style={{
                                marginTop: '0.25rem',
                                fontSize: '0.6875rem',
                                color: '#38a169'
                            }}>
                                Vuelto: S/ {(parseFloat(paidAmount) - cartTotal).toFixed(2)}
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {saveError && (
                        <div style={{
                            backgroundColor: '#fed7d7',
                            color: '#c53030',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            marginBottom: '0.75rem'
                        }}>
                            {saveError}
                        </div>
                    )}

                    {/* Botón procesar */}
                    <button
                        onClick={handleProcessSale}
                        disabled={isSaving || cartItems.length === 0}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: isSaving || cartItems.length === 0 ? '#cbd5e0' : '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            cursor: isSaving || cartItems.length === 0 ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {isSaving ? 'Procesando...' : 'Procesar Venta'}
                    </button>
                </div>
            </div>

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
