import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useWebSocket } from '../../context/WebSocketContext';
import { useToast } from '../../context/ToastContext';
import type { Table } from '../../types/table';
import { CREATE_OPERATION, ADD_ITEMS_TO_OPERATION, UPDATE_TABLE_STATUS, PRINT_PRECUENTA } from '../../graphql/mutations';
import { GET_CATEGORIES_BY_BRANCH, GET_PRODUCTS_BY_CATEGORY, GET_PRODUCTS_BY_BRANCH, GET_OPERATION_BY_TABLE, GET_OPERATION_BY_ID, SEARCH_PRODUCTS, GET_PRODUCT_BY_CODE, GET_MODIFIERS_BY_SUBCATEGORY } from '../../graphql/queries';
import ModalObservation from './modalObservation';
import CategoryIcon from '../../components/CategoryIcon';
import VirtualKeyboard from '../../components/VirtualKeyboard';

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
};

const Order: React.FC<OrderProps> = ({ table, onClose, onSuccess, onOpenCash }) => {
	const { companyData, user, deviceId, getDeviceId, getMacAddress, updateTableInContext } = useAuth();
	const { hasPermission } = useUserPermissions();
	const { breakpoint, width: viewportWidth } = useResponsive();
	const { sendMessage } = useWebSocket();
	const { showToast } = useToast();
	const isExistingOrder = Boolean(table?.currentOperationId) || table?.status === 'OCCUPIED' || table?.status === 'TO_PAY';

	const userRoleUpper = user?.role?.toUpperCase() ?? '';
	const canNavigateToCashPay =
		userRoleUpper === 'ADMIN' ||
		userRoleUpper === 'CASHIER' ||
		userRoleUpper === 'CAJA';

	// IGV de la sucursal (float). Por defecto 10.5% para sedes.
	const igvPercentageFromBranch = Number(companyData?.branch?.igvPercentage) || 10.5;

	// Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil en grid)
	const isXs = breakpoint === 'xs';
	const isSmall = breakpoint === 'sm'; // 640px - 767px
	const isMedium = breakpoint === 'md'; // 768px - 1023px
	/** Teclado virtual: compacto en móvil/tablet (&lt; 1024); más denso en pantallas muy estrechas */
	const keyboardCompact = viewportWidth < 1024;
	const keyboardTight = viewportWidth < 480;

	// Valores para grid y breadcrumb (como en delivery.tsx)
	const gridMinCol = isSmall ? '110px' : isMedium ? '125px' : '150px';
	const gridGap = isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem';
	const gridPadding = isSmall ? '0.6rem' : isMedium ? '0.8rem' : '1.25rem';
	const breadcrumbFontSize = isSmall ? '0.75rem' : isMedium ? '0.875rem' : '1rem';
	/** Encabezado de navegación categorías: botones grandes para uso táctil en salón */
	const breadcrumbBtnMinH = isSmall ? 48 : 52;
	const breadcrumbBtnFont = isSmall ? '0.9375rem' : isMedium ? '1.0625rem' : '1.125rem';
	const breadcrumbBtnPadX = isSmall ? '1rem' : '1.25rem';
	const breadcrumbBtnPadY = isSmall ? '0.625rem' : '0.75rem';
	const breadcrumbBtnRadius = isSmall ? '10px' : '12px';
	/** Ancho máximo en migas de pan: nombre largo con puntos suspensivos (ver título al hover) */
	const breadcrumbLabelMaxWidth = isSmall ? '7.5rem' : '11rem';

	// Función para verificar si el usuario puede acceder a esta mesa (por permisos)
	const canAccessTable = (): { canAccess: boolean; reason?: string } => {
		// Quien tiene permiso de cobrar (sales.pay) puede acceder para procesar pagos
		if (hasPermission('sales.pay')) {
			return { canAccess: true };
		}

		// Si la mesa no está ocupada, cualquier usuario puede acceder
		if (!table.currentOperationId || !table.occupiedById) {
			return { canAccess: true };
		}

		// Si la mesa está ocupada, verificar el modo multi-waiter
		const isMultiWaiterEnabled = companyData?.branch?.isMultiWaiterEnabled || false;

		// Si multi-waiter está habilitado, cualquier usuario puede acceder
		if (isMultiWaiterEnabled) {
			return { canAccess: true };
		}

		// Si multi-waiter está deshabilitado, solo el usuario que creó la orden puede acceder
		const tableOccupiedById = String(table.occupiedById);
		const currentUserId = String(user?.id);

		if (tableOccupiedById === currentUserId) {
			return { canAccess: true };
		}

		// El usuario no es el que creó la orden
		return {
			canAccess: false,
			reason: `Esta mesa está siendo atendida por ${table.userName || 'otro usuario'}. Solo el usuario que creó la orden puede acceder a esta mesa.`
		};
	};

	// Verificar acceso al montar el componente
	useEffect(() => {
		const accessCheck = canAccessTable();
		if (!accessCheck.canAccess) {
			showToast(accessCheck.reason || 'No tiene permiso para acceder a esta mesa.', 'error');
			setTimeout(() => onClose(), 3000);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [table.id, table.currentOperationId, table.occupiedById, user?.id, companyData?.branch?.isMultiWaiterEnabled]);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState<string>('');
	const [searchByCodeOnly, setSearchByCodeOnly] = useState<boolean>(false);
	const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
	const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
	const [initializedFromExistingOrder, setInitializedFromExistingOrder] = useState(false);
	const [productObservations, setProductObservations] = useState<Record<string, any[]>>({});
	const [, setLoadingObservations] = useState<Record<string, boolean>>({});
	const [selectedObservations, setSelectedObservations] = useState<Record<string, Set<string>>>({});
	const [, setHideObservationsSection] = useState<Record<string, boolean>>({});
	const [isSaving, setIsSaving] = useState(false);
	const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);
	const [isPrintingPrecuenta, setIsPrintingPrecuenta] = useState(false);
	const [showObservationModal, setShowObservationModal] = useState<string | null>(null);
	const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

	const handleVirtualKeyPress = (key: string) => {
		setSearchTerm(prev => prev + key);
	};

	const handleVirtualBackspace = () => {
		setSearchTerm(prev => prev.slice(0, -1));
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

	// Obtener categorías de la sucursal (siempre del servidor para ver cambios)
	const { data: categoriesData, loading: categoriesLoading } = useQuery(GET_CATEGORIES_BY_BRANCH, {
		variables: { branchId: companyData?.branch.id },
		skip: !companyData?.branch.id,
		fetchPolicy: 'network-only'
	});

	const categories = categoriesData?.categoriesByBranch || [];

	// Búsqueda de productos (si hay término de búsqueda) - siempre del servidor
	// Cuando searchByCodeOnly: usar product_by_code (backend). Si no: searchProducts con 3+ caracteres.
	const searchMinLength = searchByCodeOnly ? 1 : 3;
	const { data: searchData, loading: searchLoading } = useQuery(SEARCH_PRODUCTS, {
		variables: { search: searchTerm.trim(), branchId: companyData?.branch.id, limit: 50 },
		skip: !companyData?.branch.id || searchByCodeOnly || searchTerm.trim().length < searchMinLength,
		errorPolicy: 'ignore',
		fetchPolicy: 'network-only'
	});

	// Búsqueda solo por código: usa product_by_code del backend (insensible a mayúsculas)
	const { data: productByCodeData, loading: productByCodeLoading } = useQuery(GET_PRODUCT_BY_CODE, {
		variables: { branchId: companyData?.branch.id, code: searchTerm.trim() },
		skip: !companyData?.branch.id || !searchByCodeOnly || !searchTerm.trim(),
		errorPolicy: 'ignore',
		fetchPolicy: 'network-only'
	});

	// Obtener productos por categoría (siempre del servidor para ver precios actualizados)
	const { data: productsByCategoryData, loading: productsByCategoryLoading } = useQuery(GET_PRODUCTS_BY_CATEGORY, {
		variables: { categoryId: selectedCategory },
		skip: !selectedCategory || searchByCodeOnly || searchTerm.length >= 3,
		fetchPolicy: 'network-only'
	});

	// Obtener todos los productos de la sucursal (siempre del servidor para precios y productos nuevos)
	const { data: productsByBranchData, loading: productsByBranchLoading } = useQuery(GET_PRODUCTS_BY_BRANCH, {
		variables: { branchId: companyData?.branch.id },
		skip: !companyData?.branch.id,
		fetchPolicy: 'network-only'
	});

	// Query lazy para obtener observaciones de una subcategoría (siempre del servidor)
	const [getObservations] = useLazyQuery(GET_MODIFIERS_BY_SUBCATEGORY, {
		fetchPolicy: 'network-only'
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
		refetch: refetchExistingOperation
	} = useQuery(shouldUseId ? GET_OPERATION_BY_ID : GET_OPERATION_BY_TABLE, {
		variables: shouldUseId
			? { operationId: table.currentOperationId }
			: { tableId: table?.id || '', branchId: companyData?.branch.id || '' },
		skip: !hasSelection,
		fetchPolicy: 'network-only'
	});

	// Determinar qué productos mostrar según la selección
	let products;
	let productsLoading;

	if (searchByCodeOnly && searchTerm.trim().length >= 1) {
		// Búsqueda solo por código: soporta productByCode (camelCase) y product_by_code (snake_case según backend)
		const p = productByCodeData?.productByCode ?? productByCodeData?.product_by_code;
		products = p ? [p] : [];
		productsLoading = productByCodeLoading;
	} else if (searchTerm.length >= 3) {
		// Prioridad 1: Búsqueda avanzada (del servidor)
		products = searchData?.searchProducts;
		productsLoading = searchLoading;

		// Fallback: Si la búsqueda del servidor falla, hacer búsqueda local simple
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
		// Prioridad 2: Categoría seleccionada
		products = productsByCategoryData?.productsByCategory;
		productsLoading = productsByCategoryLoading;
	} else {
		// Prioridad 3: Todos los productos
		products = productsByBranchData?.productsByBranch;
		productsLoading = productsByBranchLoading;
	}

	let productsList = products || [];
	// Filtrar por subcategoría solo cuando se navega por categorías (NO cuando se busca por código)
	if (!(searchByCodeOnly && searchTerm.trim().length >= 1) && selectedCategory && selectedSubcategory && productsList.length > 0) {
		productsList = productsList.filter((p: any) => String(p.subcategoryId) === String(selectedSubcategory));
	}

	// Subcategorías de la categoría seleccionada (solo activas)
	const subcategoriesOfCategory = selectedCategory
		? (categories.find((c: any) => c.id === selectedCategory)?.subcategories?.filter((s: any) => s.isActive) || [])
		: [];

	// Navegación como en delivery: mostrar categorías, subcategorías o productos en el grid
	const isSearching = searchByCodeOnly ? searchTerm.trim().length >= 1 : searchTerm.length >= 3;
	const showCategoriesInGrid = !isSearching && !selectedCategory;
	const showSubcategoriesInGrid = !isSearching && selectedCategory && !selectedSubcategory && subcategoriesOfCategory.length > 0;
	const showProductsInGrid = isSearching || (selectedCategory && (selectedSubcategory || subcategoriesOfCategory.length === 0));

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

	useEffect(() => {
		// Solo cargar items si hay una selección válida y no se ha inicializado ya
		if (!hasSelection || initializedFromExistingOrder) {
			return;
		}

		if (existingOperationLoading) {
			return;
		}

		const operation = existingOperationData?.operationByTable || existingOperationData?.operationById;

		// Si no hay operación, marcar como inicializado pero no cargar items
		if (!operation) {
			setInitializedFromExistingOrder(true);
			return;
		}

		// Solo cargar items si realmente hay una operación existente (isExistingOrder)
		// Esto evita cargar items cuando es una nueva orden
		if (!isExistingOrder) {
			setInitializedFromExistingOrder(true);
			return;
		}

		const mappedItems: OrderItem[] = (operation.details || []).map((detail: any) => {
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
			const product = productsList.find((p: any) => p.id === String(detail.productId));
			const subcategoryId = product?.subcategoryId;

			return {
				id: String(detail.id ?? `${detail.productId}-${Date.now()}-${Math.random()}`),
				productId: String(detail.productId ?? ''),
				name: detail.productName || 'Producto sin nombre',
				price: safeUnitPrice,
				quantity: safeQuantity,
				total: computedTotal,
				isNew: false,
				notes: typeof detail.notes === 'string' ? detail.notes : '',
				subcategoryId: subcategoryId,
				isPrinted: detail.isPrinted,
				printedAt: detail.printedAt
			};
		});

		// Preservar los items nuevos que aún no se han guardado en el servidor
		const newItems = orderItems.filter(item => item.isNew);
		const finalItems = [...mappedItems, ...newItems];

		setOrderItems(finalItems);
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
		productsList
	]);

	const existingOperation = existingOperationData?.operationByTable || existingOperationData?.operationById;
	// Solo mostrar loading si hay selección, hay una orden existente, está cargando y no se ha inicializado
	const isLoadingExistingOrder = hasSelection && isExistingOrder && existingOperationLoading && !initializedFromExistingOrder;

	const resolvedFloorName = useMemo(() => {
		if (table.floorName) return table.floorName;
		const floors = companyData?.branch?.floors;
		if (!floors?.length || !table?.id) return null;
		for (const f of floors) {
			if (f.tables?.some((t) => String(t.id) === String(table.id))) return f.name;
		}
		return null;
	}, [table.floorName, table.id, companyData?.branch?.floors]);

	const waiterDisplayName =
		existingOperation?.user?.fullName ||
		table.userName ||
		(isLoadingExistingOrder ? '...' : null);

	/** Encabezado: orden existente → mozo de la operación; orden nueva → usuario actual o mesa ocupada. */
	const headerWaiterName =
		(isExistingOrder ? waiterDisplayName : user?.fullName || table.userName || null) ?? null;

	// Función para agregar producto a la orden
	const handleAddProduct = (productIdToAdd?: string, qtyToAdd?: number) => {
		const productId = productIdToAdd || selectedProduct;
		if (!productId) return;

		const product = productsList.find((p: any) => p.id === productId);
		if (!product) return;

		// Precio: permite 0 (cortesía/promo); rechaza negativos y no numéricos
		const rawPrice = parseFloat(String(product.salePrice));
		const productPrice = Number.isFinite(rawPrice) ? rawPrice : 0;
		if (productPrice < 0 || (String(product.salePrice ?? '').trim() !== '' && !Number.isFinite(rawPrice))) {
			showToast(`El producto "${product.name}" no tiene un precio válido`, 'error');
			return;
		}

		const qty = qtyToAdd ?? 1;
		const newItem: OrderItem = {
			id: `${product.id}-${Date.now()}`,
			productId: product.id,
			name: product.name,
			price: productPrice,
			quantity: qty,
			total: productPrice * qty,
			isNew: true,
			notes: '',
			subcategoryId: product.subcategoryId
		};

		if (isExistingOrder) {
			// En órdenes existentes:
			// - Si hay un item nuevo (sin guardar) con el mismo producto, aumentar su cantidad
			// - Si solo hay items guardados o no existe, crear una nueva fila
			const existingNewItemIndex = orderItems.findIndex(
				item => item.productId === product.id && item.isNew === true
			);

			if (existingNewItemIndex >= 0) {
				// Si existe un item nuevo con el mismo producto, aumentar su cantidad
				const updatedItems = [...orderItems];
				const existingItem = updatedItems[existingNewItemIndex];
				const validQuantity = Number(existingItem.quantity) + qty;
				const validPrice = Number(existingItem.price) || productPrice;
				updatedItems[existingNewItemIndex].quantity = validQuantity;
				updatedItems[existingNewItemIndex].total = validPrice * validQuantity;
				setOrderItems(updatedItems);
				setLastAddedItemId(existingItem.id);
			} else {
				// Si no hay un item nuevo, crear una nueva fila (no afecta items guardados)
				setOrderItems([...orderItems, newItem]);
				setLastAddedItemId(newItem.id);
			}
		} else {
			// Para nuevas órdenes, agrupar productos por productId (aumentar cantidad si existe)
			const existingItemIndex = orderItems.findIndex(item => item.productId === product.id);

			if (existingItemIndex >= 0) {
				// Si el producto ya existe, aumentar la cantidad
				const updatedItems = [...orderItems];
				const existingItem = updatedItems[existingItemIndex];
				const validQuantity = Number(existingItem.quantity) + qty;
				const validPrice = Number(existingItem.price) || productPrice;
				updatedItems[existingItemIndex].quantity = validQuantity;
				updatedItems[existingItemIndex].total = validPrice * validQuantity;
				updatedItems[existingItemIndex].isNew = true;
				setOrderItems(updatedItems);
				setLastAddedItemId(existingItem.id);
			} else {
				// Si el producto no existe, agregarlo como nueva fila
				setOrderItems([...orderItems, newItem]);
				setLastAddedItemId(newItem.id);
			}
		}

		// Limpiar búsqueda y selección al agregar producto
		setSearchTerm('');
		if (!productIdToAdd) {
			setSelectedProduct(null);
		}
	};

	// Función para cambiar cantidad de un ítem
	const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
		const targetItem = orderItems.find(item => item.id === itemId);
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

		const updatedItems = orderItems.map(item => {
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
		setOrderItems(updatedItems);
	};

	// Función para eliminar ítem
	const handleRemoveItem = (itemId: string) => {
		const targetItem = orderItems.find(item => item.id === itemId);
		if (!targetItem) {
			return;
		}

		if (isExistingOrder && !targetItem.isNew) {
			return;
		}

		setOrderItems(orderItems.filter(item => item.id !== itemId));
	};

	// Función para abrir el modal de observaciones (carga las observaciones si es necesario)
	const handleOpenObservationModal = async (itemId: string) => {
		const item = orderItems.find(i => i.id === itemId);
		if (!item) return;

		// Si hay subcategoryId y no se han cargado las observaciones, cargarlas primero
		if (item.subcategoryId && !productObservations[itemId]) {
			setLoadingObservations(prev => ({ ...prev, [itemId]: true }));
			try {
				const { data } = await getObservations({
					variables: { subcategoryId: item.subcategoryId }
				});
				if (data?.notesBySubcategory) {
					const activeObservations = data.notesBySubcategory.filter((m: any) => m.isActive);
					setProductObservations(prev => ({
						...prev,
						[itemId]: activeObservations
					}));

					// Inicializar observaciones seleccionadas basándose en las notas actuales del item
					if (item.notes) {
						const currentNotes = item.notes.split(', ').map(n => n.trim());
						const selectedIds = new Set<string>();
						activeObservations.forEach((obs: any) => {
							if (currentNotes.includes(obs.note)) {
								selectedIds.add(obs.id);
							}
						});
						if (selectedIds.size > 0) {
							setSelectedObservations(prev => ({
								...prev,
								[itemId]: selectedIds
							}));
						}
					}
				}
			} catch (error) {
				console.error('Error al obtener observaciones:', error);
			} finally {
				setLoadingObservations(prev => ({ ...prev, [itemId]: false }));
			}
		}

		// Abrir el modal
		setShowObservationModal(itemId);
	};

	// Función para aplicar observaciones desde el modal
	const handleApplyObservations = (itemId: string, selectedIds: Set<string>, manualNotes: string) => {
		const item = orderItems.find(i => i.id === itemId);
		if (!item || (isExistingOrder && !item.isNew)) {
			return;
		}

		// Actualizar las observaciones seleccionadas
		setSelectedObservations(prev => ({
			...prev,
			[itemId]: selectedIds
		}));

		// Obtener las observaciones seleccionadas
		const selectedNotes = Array.from(selectedIds)
			.map(id => {
				const obs = productObservations[itemId]?.find((o: any) => o.id === id);
				return obs?.note || '';
			})
			.filter(note => note !== '')
			.join(', ');

		// Limpiar las notas manuales (eliminar espacios extra)
		const cleanManualNotes = manualNotes.trim();

		// Combinar: primero observaciones seleccionadas, luego notas manuales
		let finalNotes = '';
		if (selectedNotes && cleanManualNotes) {
			finalNotes = `${selectedNotes}, ${cleanManualNotes}`;
		} else if (selectedNotes) {
			finalNotes = selectedNotes;
		} else if (cleanManualNotes) {
			finalNotes = cleanManualNotes;
		}

		setOrderItems(items =>
			items.map(i => {
				if (i.id !== itemId) {
					return i;
				}
				return {
					...i,
					notes: finalNotes
				};
			})
		);

		// Ocultar la sección de observaciones cuando se selecciona al menos una
		if (selectedIds.size > 0) {
			setHideObservationsSection(prev => ({
				...prev,
				[itemId]: true
			}));
		} else {
			// Si no hay observaciones seleccionadas, mostrar la sección de nuevo
			setHideObservationsSection(prev => ({
				...prev,
				[itemId]: false
			}));
		}
	};

	// Efecto para hacer scroll automático al agregar un producto
	useEffect(() => {
		if (lastAddedItemId && itemRefs.current[lastAddedItemId] && orderListContainerRef.current) {
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
					if (itemTop < containerTop || itemTop + itemHeight > containerTop + containerHeight) {
						// Hacer scroll suave hasta el item
						itemElement.scrollIntoView({
							behavior: 'smooth',
							block: 'nearest',
							inline: 'nearest'
						});
					}
				}
			}, 100);

			// Limpiar el ID después de hacer scroll
			setTimeout(() => setLastAddedItemId(null), 500);
		}
	}, [lastAddedItemId, orderItems]);

	// Calcular totales
	const orderItemsTotal = orderItems.reduce((sum, item) => {
		const itemTotal = Number(item.total) || 0;
		return sum + itemTotal;
	}, 0);
	const subtotal =
		isExistingOrder && existingOperation && existingOperation.subtotal !== undefined && existingOperation.subtotal !== null
			? Number(existingOperation.subtotal)
			: orderItemsTotal;
	const taxes =
		isExistingOrder && existingOperation && existingOperation.igvAmount !== undefined && existingOperation.igvAmount !== null
			? Number(existingOperation.igvAmount)
			: 0; // Para nuevas órdenes seguimos mostrando 0 hasta calcular
	const total =
		isExistingOrder && existingOperation && existingOperation.total !== undefined && existingOperation.total !== null
			? Number(existingOperation.total)
			: subtotal + taxes;

	// Función para guardar la orden (shouldPrint: true = enviar a imprimir, false = solo enviar a cocina)
	const handleSaveOrder = async (status: string = 'PROCESSING', shouldPrint: boolean = true) => {
		const itemsToProcess = isExistingOrder ? orderItems.filter(item => item.isNew) : orderItems;

		if (itemsToProcess.length === 0) {
			const message = isExistingOrder
				? 'Debe agregar al menos un producto nuevo a la orden'
				: 'Debe agregar al menos un producto a la orden';
			showToast(message, 'error');
			return;
		}

		if (!companyData?.branch.id) {
			showToast('No se encontró información de la sucursal', 'error');
			return;
		}

		setIsSaving(true);

		try {
			const invalidItems = itemsToProcess.filter(item => {
				const p = Number(item.price);
				const q = Number(item.quantity);
				return !Number.isFinite(p) || p < 0 || !Number.isFinite(q) || q <= 0;
			});

			if (invalidItems.length > 0) {
				showToast('Algunos productos tienen valores inválidos. Por favor, verifique los precios y cantidades.', 'error');
				return;
			}

			if (isExistingOrder) {
				const operationId = existingOperation?.id || table?.currentOperationId;
				if (!operationId) {
					showToast('No se encontró la operación activa para esta mesa.', 'error');
					return;
				}

				const igvPercentageValue = typeof existingOperation?.igvPercentage === 'number'
					? existingOperation.igvPercentage
					: igvPercentageFromBranch;
				const igvRate = igvPercentageValue > 0 ? igvPercentageValue / 100 : 0;

				const details = itemsToProcess.map(item => {
					const unitPrice = parseFloat((Math.round(item.price * 100) / 100).toFixed(2));
					const quantity = Math.max(1, Number(item.quantity) || 1);
					const unitValue = igvRate > 0
						? parseFloat((Math.round((unitPrice / (1 + igvRate)) * 100) / 100).toFixed(2))
						: unitPrice;
					const notes = typeof item.notes === 'string' ? item.notes.trim() : '';

					return {
						productId: String(item.productId),
						quantity,
						unitMeasure: 'NIU',
						unitValue,
						unitPrice,
						notes
					};
				});

				// Solo enviar deviceId si debe imprimir; si no, enviar vacío para que no imprima
				let deviceIdForMutation = '';
				if (shouldPrint) {
					if (deviceId) {
						deviceIdForMutation = deviceId;
					} else {
						try {
							deviceIdForMutation = await getMacAddress();
						} catch (error) {
							console.error('Error al obtener MAC address:', error);
							deviceIdForMutation = getDeviceId();
						}
					}
				}

				const result = await addItemsToOperationMutation({
					variables: {
						operationId,
						details,
						deviceId: deviceIdForMutation
					}
				});

				if (result.data?.addItemsToOperation?.success) {
					if (onSuccess) {
						const opId = existingOperation?.id ?? operationId;
						onSuccess({
							operationId: opId,
							operationDate: existingOperation?.operationDate ?? null
						});
					}

					setInitializedFromExistingOrder(false);
					try {
						await refetchExistingOperation();
					} catch (refetchError) {
						console.error('Error al refrescar la operación después de agregar ítems:', refetchError);
					}

					setTimeout(() => {
						onClose();
					}, 500);
				} else {
					throw new Error(result.data?.addItemsToOperation?.message || 'Error al agregar los productos a la orden existente');
				}

				return;
			}

			// Preparar los detalles de la operación para una nueva orden
			const details = itemsToProcess.map(item => {
				const rawPrice = typeof item.price === 'number' ? item.price : parseFloat(String(item.price));
				if (isNaN(rawPrice) || rawPrice < 0) {
					throw new Error(`Precio inválido para el producto: ${item.name}`);
				}
				const unitPrice = parseFloat((Math.round(rawPrice * 100) / 100).toFixed(2));

				const igvRateNew = igvPercentageFromBranch / 100;
				const unitValue = parseFloat((Math.round((unitPrice / (1 + igvRateNew)) * 100) / 100).toFixed(2));

				const rawQuantity = typeof item.quantity === 'number' ? item.quantity : parseInt(String(item.quantity), 10);
				const quantity = (isNaN(rawQuantity) || rawQuantity <= 0) ? 1 : parseInt(String(rawQuantity), 10);

				if (isNaN(unitPrice) || unitPrice < 0 || isNaN(unitValue) || unitValue < 0 || isNaN(quantity) || quantity <= 0) {
					throw new Error(`Valores inválidos para el producto: ${item.name}`);
				}

				const safeQuantity = Number(quantity);
				const safeUnitValue = Number(unitValue);
				const safeUnitPrice = Number(unitPrice);

				if (isNaN(safeQuantity) || isNaN(safeUnitValue) || isNaN(safeUnitPrice)) {
					throw new Error(`Error al convertir valores numéricos para el producto: ${item.name}`);
				}
				const notes = typeof item.notes === 'string' ? item.notes.trim() : '';

				return {
					productId: String(item.productId),
					quantity: safeQuantity,
					unitMeasure: 'NIU',
					unitValue: safeUnitValue,
					unitPrice: safeUnitPrice,
					notes
				};
			});

			const itemsTotal = itemsToProcess.reduce((sum, item) => {
				const itemTotal = Number(item.price) * Number(item.quantity);
				return sum + (isNaN(itemTotal) ? 0 : itemTotal);
			}, 0);

			const igvPercentageDecimal = igvPercentageFromBranch / 100;
			const grossAmount = typeof itemsTotal === 'number' && !isNaN(itemsTotal) ? itemsTotal : 0;
			const calculatedSubtotal = parseFloat((Math.round((grossAmount / (1 + igvPercentageDecimal)) * 100) / 100).toFixed(2));
			const calculatedIgvAmount = parseFloat((Math.round((grossAmount - calculatedSubtotal) * 100) / 100).toFixed(2));
			const validTotal = parseFloat((Math.round(grossAmount * 100) / 100).toFixed(2));

			if (isNaN(calculatedSubtotal) || calculatedSubtotal < 0 ||
				isNaN(calculatedIgvAmount) || calculatedIgvAmount < 0 ||
				isNaN(validTotal) || validTotal < 0) {
				showToast('Error al calcular los totales. Por favor, intente nuevamente.', 'error');
				return;
			}

			const variables: any = {
				branchId: companyData.branch.id,
				operationType: 'SALE',
				serviceType: 'RESTAURANT',
				status: status,
				notes: '',
				details: details,
				subtotal: calculatedSubtotal,
				igvAmount: calculatedIgvAmount,
				igvPercentage: igvPercentageFromBranch,
				total: validTotal,
				operationDate: new Date().toISOString()
			};

			if (table?.id) {
				variables.tableId = table.id;
			}
			if (user?.id) {
				variables.userId = user.id;
			}
			// Solo enviar deviceId cuando debe imprimir; si no, no enviar para que no imprima
			if (shouldPrint) {
				if (deviceId) {
					variables.deviceId = deviceId;
				} else {
					try {
						const macAddress = await getMacAddress();
						variables.deviceId = macAddress;
					} catch (error) {
						console.error('Error al obtener MAC address:', error);
						variables.deviceId = getDeviceId();
					}
				}
			}

			variables.shouldPrint = shouldPrint;

			const cleanVariables: any = {};
			Object.keys(variables).forEach(key => {
				const value = variables[key];
				const numericRequiredFields = ['subtotal', 'igvAmount', 'igvPercentage', 'total'];
				if (numericRequiredFields.includes(key)) {
					const defaultValue = key === 'igvPercentage' ? 10.5 : 0;
					const numValue = (value === null || value === undefined || isNaN(value)) ? defaultValue : Number(value);
					cleanVariables[key] = numValue;
				} else {
					if (value !== null && value !== undefined) {
						cleanVariables[key] = value;
					}
				}
			});

			console.log('📊 Variables limpias a enviar:', JSON.stringify(cleanVariables, null, 2));
			console.log('📊 Details:', JSON.stringify(details, null, 2));

			const numericFields = ['subtotal', 'igvAmount', 'igvPercentage', 'total'];
			for (const field of numericFields) {
				const value = cleanVariables[field];
				if (value === null || value === undefined || isNaN(value)) {
					throw new Error(`Campo numérico inválido: ${field} = ${value}`);
				}
			}

			details.forEach((detail, index) => {
				if (detail.quantity === null || detail.quantity === undefined || isNaN(detail.quantity)) {
					throw new Error(`Detalle ${index} tiene quantity inválido: ${detail.quantity}`);
				}
				if (detail.unitValue === null || detail.unitValue === undefined || isNaN(detail.unitValue)) {
					throw new Error(`Detalle ${index} tiene unitValue inválido: ${detail.unitValue}`);
				}
				if (detail.unitPrice === null || detail.unitPrice === undefined || isNaN(detail.unitPrice)) {
					throw new Error(`Detalle ${index} tiene unitPrice inválido: ${detail.unitPrice}`);
				}
			});

			const result = await createOperationMutation({
				variables: cleanVariables
			});

			if (result.data?.createOperation?.success) {
				// Actualizar el estado de la mesa a OCCUPIED
				try {
					const tableResult = await updateTableStatusMutation({
						variables: {
							tableId: table.id,
							status: 'OCCUPIED',
							userId: user?.id
						}
					});

					if (tableResult.data?.updateTableStatus?.success) {
						// Actualizar la mesa en el contexto local
						const updatedTable = tableResult.data.updateTableStatus.table;
						const currentOperationId = result.data.createOperation.operation?.id || updatedTable.currentOperationId;
						const occupiedById = updatedTable.occupiedById;
						const userName = updatedTable.userName;

						updateTableInContext({
							id: updatedTable.id,
							status: updatedTable.status,
							statusColors: updatedTable.statusColors,
							currentOperationId: currentOperationId,
							occupiedById: occupiedById,
							userName: userName
						});

						// Enviar notificación WebSocket para actualizar en tiempo real
						setTimeout(() => {
							sendMessage({
								type: 'table_status_update',
								table_id: updatedTable.id,
								status: updatedTable.status || 'OCCUPIED',
								current_operation_id: currentOperationId || null,
								occupied_by_user_id: occupiedById || null,
								waiter_name: userName || null
							});
							console.log('📡 Notificación WebSocket enviada para mesa:', updatedTable.id);

							// Solicitar snapshot completo de todas las mesas
							setTimeout(() => {
								sendMessage({
									type: 'table_update_request'
								});
								console.log('📡 Solicitud de snapshot de mesas enviada');
							}, 500);
						}, 300);

						console.log('✅ Estado de mesa actualizado a OCCUPIED');
					}
				} catch (tableError) {
					console.error('⚠️ Error al actualizar estado de mesa:', tableError);
					// Continuar aunque falle la actualización de la mesa
				}

				if (onSuccess) {
					const newOpId = result.data.createOperation.operation?.id;
					if (newOpId != null && newOpId !== '') {
						onSuccess({
							operationId: newOpId,
							operationDate: result.data.createOperation.operation?.operationDate ?? null
						});
					}
				}
				setTimeout(() => {
					onClose();
				}, 500);
			} else {
				showToast(result.data?.createOperation?.message || 'Error al guardar la orden', 'error');
			}
		} catch (error: any) {
			console.error('Error al guardar la orden:', error);
			showToast(error.message || 'Error al guardar la orden', 'error');
		} finally {
			setIsSaving(false);
		}
	};

	// Función para imprimir precuenta
	const handlePrecuenta = async () => {
		if (!existingOperation || !table?.id || !companyData?.branch.id) {
			showToast('No hay una orden disponible para imprimir precuenta', 'error');
			return;
		}

		if (existingOperation.status === 'COMPLETED') {
			showToast('Esta orden ya ha sido completada', 'error');
			return;
		}

		setIsPrintingPrecuenta(true);

		try {
			// Obtener deviceId o MAC address
			// Obtener deviceId o MAC address - Priorizar MAC address para impresión según requerimiento
			let resolvedDeviceId: string;
			try {
				const mac = await getMacAddress();
				if (mac) {
					resolvedDeviceId = mac;
				} else {
					resolvedDeviceId = deviceId || getDeviceId();
				}
			} catch (error) {
				console.error('Error al obtener MAC address:', error);
				resolvedDeviceId = deviceId || getDeviceId();
			}

			const result = await printPrecuentaMutation({
				variables: {
					operationId: existingOperation.id,
					tableId: table.id,
					branchId: companyData.branch.id,
					deviceId: resolvedDeviceId,
					printerId: null
				}
			});

			if (result.data?.printAccount?.success) {
				const resultTable = result.data.printAccount.table;
				const updatedTableId = table.id;
				// Forzar siempre TO_PAY para que la mesa se pinte amarilla
				const updatedStatus = 'TO_PAY';
				const updatedStatusColors = resultTable?.statusColors ?? table?.statusColors;

				try {
					await updateTableStatusMutation({
						variables: {
							tableId: table.id,
							status: 'TO_PAY',
							userId: user?.id
						}
					});
					console.log('✅ Estado de mesa actualizado a TO_PAY mediante mutación');
				} catch (updateError) {
					console.warn('⚠️ No se pudo actualizar el estado mediante mutación, actualizando en contexto:', updateError);
				}

				const finalCurrentOperationId = (table?.currentOperationId || existingOperation?.id) != null
					? (typeof (table?.currentOperationId ?? existingOperation?.id) === 'string'
						? Number(table?.currentOperationId ?? existingOperation?.id)
						: (table?.currentOperationId ?? existingOperation?.id))
					: (existingOperation?.id ? (typeof existingOperation.id === 'string' ? Number(existingOperation.id) : existingOperation.id) : undefined);
				const finalOccupiedById = table?.occupiedById != null ? (typeof table.occupiedById === 'string' ? Number(table.occupiedById) : table.occupiedById) : (user?.id ? Number(user.id) : undefined);
				const finalUserName = table?.userName || user?.fullName;

				if (updateTableInContext) {
					updateTableInContext({
						id: updatedTableId,
						status: updatedStatus,
						statusColors: updatedStatusColors,
						currentOperationId: finalCurrentOperationId,
						occupiedById: finalOccupiedById,
						userName: finalUserName
					});
					console.log(`✅ Mesa ${updatedTableId} actualizada en contexto a estado: ${updatedStatus} (amarillo)`);

					setTimeout(() => {
						sendMessage({
							type: 'table_status_update',
							table_id: updatedTableId,
							status: updatedStatus,
							current_operation_id: finalCurrentOperationId,
							occupied_by_user_id: finalOccupiedById,
							waiter_name: finalUserName
						});
						setTimeout(() => {
							sendMessage({ type: 'table_update_request' });
						}, 500);
					}, 300);
				}

				// Refetch la operación para obtener los datos actualizados (igual que en cashPay.tsx)
				try {
					// Resetear el flag para que el useEffect vuelva a mapear los productos con el nuevo estado isPrinted
					setInitializedFromExistingOrder(false);
					await refetchExistingOperation();
					console.log('✅ Operación refetcheada después de precuenta');
				} catch (refetchError) {
					console.error('❌ Error al hacer refetch de la operación:', refetchError);
				}

				// Llamar callback de éxito si existe
				if (onSuccess) {
					onSuccess();
				}

				// Mostrar mensaje de éxito (sin mencionar liberación de mesa)
				// El mensaje del backend podría decir que liberó la mesa, pero no es correcto para precuenta
				showToast('Precuenta enviada a imprimir exitosamente. Estado de mesa actualizado a TO_PAY', 'success');
			} else {
				showToast(result.data?.printAccount?.message || 'Error al imprimir la precuenta', 'error');
			}
		} catch (err: any) {
			console.error('Error al imprimir precuenta:', err);
			showToast(err.message || 'Error al imprimir la precuenta', 'error');
		} finally {
			setIsPrintingPrecuenta(false);
		}
	};

	const handleOpenCashFromOrder = () => {
		const operationId = existingOperation?.id ?? table.currentOperationId;
		if (operationId == null || operationId === '') {
			showToast('Esta mesa no tiene una orden activa para cobrar.', 'error');
			return;
		}
		if (!onOpenCash) return;
		const coercedId = typeof operationId === 'string' ? Number(operationId) : operationId;
		onOpenCash({
			...table,
			currentOperationId: Number.isFinite(coercedId as number) ? (coercedId as number) : table.currentOperationId
		});
		onClose();
	};

	return (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: '#f8fafc',
			display: 'flex',
			justifyContent: 'center',
			alignItems: 'center',
			zIndex: 1100,
			margin: 0,
			padding: 0
		}}>
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
			<div style={{
				background: 'white',
				width: '100vw',
				height: '100vh',
				overflow: 'hidden',
				display: 'flex',
				flexDirection: 'column',
				position: 'relative'
			}}>
				{/* Header */}
				<div style={{
					background: 'linear-gradient(135deg, #667eea, #764ba2)',
					padding: isSmall ? '0.5rem 0.75rem' : isMedium ? '0.75rem 1rem' : '1rem 1.25rem',
					color: 'white',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					flexWrap: 'wrap',
					gap: isSmall ? '0.5rem' : '0.75rem'
				}}>
					<div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? '0.5rem' : '0.75rem', flexWrap: 'wrap' }}>
						<div style={{
							backgroundColor: 'rgba(255,255,255,0.15)',
							borderRadius: 12,
							padding: '0.35rem 0.75rem',
							fontWeight: 600,
							fontSize: isSmall ? '0.75rem' : isMedium ? '0.875rem' : '1.05rem'
						}}>
							Piso {resolvedFloorName ?? '—'}
						</div>
						<span style={{ opacity: 0.9, fontSize: isSmall ? '0.75rem' : '1.15rem' }}>•</span>
						<div style={{
							backgroundColor: 'rgba(255,255,255,0.15)',
							borderRadius: 12,
							padding: '0.35rem 0.75rem',
							fontWeight: 700,
							fontSize: isSmall ? '0.8rem' : isMedium ? '0.95rem' : '1.1rem'
						}}>
							Mesa {table.name.replace('MESA ', '')}
						</div>
						<span style={{ opacity: 0.9, fontSize: isSmall ? '0.75rem' : '1.15rem' }}>•</span>
						<div style={{
							backgroundColor: 'rgba(255,255,255,0.15)',
							borderRadius: 12,
							padding: '0.35rem 0.75rem',
							fontWeight: 600,
							fontSize: isSmall ? '0.75rem' : isMedium ? '0.875rem' : '1.05rem'
						}}>
							{headerWaiterName ?? '—'}
						</div>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? '0.5rem' : '0.65rem', flexWrap: 'wrap' }}>
						{onOpenCash && canNavigateToCashPay && (
							<button
								type="button"
								onClick={handleOpenCashFromOrder}
								style={{
									background: 'rgba(255,255,255,0.95)',
									border: '1px solid rgba(255,255,255,0.5)',
									color: '#047857',
									padding: isSmall ? '0.4rem 0.75rem' : isMedium ? '0.5rem 1rem' : '0.55rem 1.1rem',
									borderRadius: isSmall ? '8px' : '10px',
									cursor: 'pointer',
									fontWeight: 700,
									fontSize: isSmall ? '0.78rem' : isMedium ? '0.875rem' : '0.95rem',
									display: 'flex',
									alignItems: 'center',
									gap: '0.35rem',
									boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
								}}
								title="Ir a cobrar en Caja"
							>
								<span aria-hidden>💵</span>
								Caja
							</button>
						)}
						<button
							type="button"
							onClick={() => {
								setIsKeyboardVisible(true);
								setTimeout(() => searchInputRef.current?.focus(), 50);
							}}
							style={{
								background: 'rgba(255,255,255,0.95)',
								border: '1px solid rgba(255,255,255,0.5)',
								color: '#4c1d95',
								padding: isSmall ? '0.4rem 0.75rem' : isMedium ? '0.5rem 1rem' : '0.55rem 1.1rem',
								borderRadius: isSmall ? '8px' : '10px',
								cursor: 'pointer',
								fontWeight: 700,
								fontSize: isSmall ? '0.78rem' : isMedium ? '0.875rem' : '0.95rem',
								display: 'flex',
								alignItems: 'center',
								gap: '0.35rem',
								boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
							}}
							title="Mostrar teclado en pantalla"
						>
							<span aria-hidden>⌨️</span>
							Teclado virtual
						</button>
						<button onClick={onClose} style={{
							background: 'rgba(255,255,255,0.15)',
							border: '1px solid rgba(255,255,255,0.35)',
							color: 'white',
							padding: isSmall ? '0.45rem 1rem' : isMedium ? '0.55rem 1.25rem' : '0.65rem 1.5rem',
							borderRadius: isSmall ? '8px' : '10px',
							cursor: 'pointer',
							fontWeight: 700,
							fontSize: isSmall ? '0.875rem' : isMedium ? '1rem' : '1.125rem'
						}}>
							Cerrar
						</button>
					</div>
				</div>

				{/* Body */}
				<div style={{
					display: 'grid',
					gridTemplateColumns: isSmall || isMedium ? '1fr' : '1.5fr 1fr', // Ajustado a 1.5fr y 1fr para mejor balance
					gap: isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1.25rem',
					padding: isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1.25rem',
					flex: 1,
					overflow: 'hidden'
				}}>
					{/* Col izquierda: búsqueda y catálogo (como en delivery.tsx) */}
					<div style={{
						display: 'flex',
						flexDirection: 'column',
						gap: isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem',
						overflow: 'hidden',
						order: isSmall || isMedium ? 2 : 1
					}}>
						{/* Búsqueda */}
						<div style={{
							background: 'white',
							border: '1px solid #e2e8f0',
							borderRadius: isSmall ? '10px' : isMedium ? '12px' : '14px',
							padding: isSmall ? '0.75rem' : isMedium ? '0.85rem' : '1rem',
							flexShrink: 0
						}}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
								<button
									type="button"
									onClick={() => setSearchByCodeOnly((v) => !v)}
									style={{
										padding: isSmall ? '0.35rem 0.6rem' : '0.4rem 0.75rem',
										borderRadius: '8px',
										border: '1px solid #e2e8f0',
										backgroundColor: searchByCodeOnly ? '#3b82f6' : 'white',
										color: searchByCodeOnly ? 'white' : '#64748b',
										fontSize: isSmall ? '0.75rem' : '0.8125rem',
										fontWeight: 600,
										cursor: 'pointer',
										whiteSpace: 'nowrap'
									}}
								>
									Búsqueda solo código
								</button>
								{searchByCodeOnly && (
									<span style={{ fontSize: '0.75rem', color: '#64748b' }}>
										(escribe o escanea el código)
									</span>
								)}
							</div>
							<div style={{ position: 'relative' }}>
								<span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.6, fontSize: '1.2rem' }}>🔎</span>
								<input
									ref={searchInputRef}
									type="text"
									placeholder={searchByCodeOnly ? 'Código del producto...' : 'Buscar producto o escanear código'}
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' && productsList.length > 0) {
											e.preventDefault();
											handleAddProduct(productsList[0].id, 1);
										}
									}}
									style={{
										width: '100%', padding: '0.85rem 1rem 0.85rem 2.75rem',
										border: '1px solid #e2e8f0', borderRadius: 12,
										fontSize: '1.05rem'
									}}
								/>
							</div>
						</div>

						{/* Contenedor con breadcrumb + grid (como delivery) */}
						<div style={{
							flex: 1,
							minHeight: 0,
							background: 'white',
							border: '1px solid #e2e8f0',
							borderRadius: isSmall ? '10px' : isMedium ? '12px' : '14px',
							display: 'flex',
							flexDirection: 'column',
							overflow: 'hidden',
							boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
						}}>
							{/* Header: ruta como botones grandes (fácil de pulsar en salón) + Volver */}
							<div style={{
								padding: isSmall ? '0.75rem' : '1rem',
								borderBottom: '1px solid #f1f5f9',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								gap: '0.75rem',
								flexWrap: 'wrap'
							}}>
								<div role="navigation" aria-label="Ubicación en el menú" style={{ display: 'flex', alignItems: 'center', gap: isSmall ? '0.5rem' : '0.65rem', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
									{isSearching ? (
										<h3 style={{ fontSize: breadcrumbFontSize, fontWeight: '600', color: '#2d3748', margin: 0 }}>
											Resultados de búsqueda
										</h3>
									) : (
										<>
											<button
												type="button"
												onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); }}
												style={{
													minHeight: breadcrumbBtnMinH,
													padding: `${breadcrumbBtnPadY} ${breadcrumbBtnPadX}`,
													background: !selectedCategory ? '#e0e7ff' : '#ffffff',
													border: `2px solid ${!selectedCategory ? '#6366f1' : '#cbd5e1'}`,
													borderRadius: breadcrumbBtnRadius,
													fontSize: breadcrumbBtnFont,
													fontWeight: !selectedCategory ? 700 : 600,
													color: !selectedCategory ? '#312e81' : '#475569',
													cursor: 'pointer',
													whiteSpace: 'nowrap',
													touchAction: 'manipulation',
													boxShadow: !selectedCategory ? '0 2px 0 #4f46e5' : '0 1px 2px rgba(0,0,0,.06)',
													lineHeight: 1.2
												}}
											>
												Categorías
											</button>
											{selectedCategory && (
												<>
													<span style={{ color: '#94a3b8', fontSize: breadcrumbBtnFont, fontWeight: 700, userSelect: 'none' }} aria-hidden>›</span>
													<button
														type="button"
														title={categories.find((c: any) => c.id === selectedCategory)?.name || undefined}
														onClick={() => setSelectedSubcategory(null)}
														style={{
															minHeight: breadcrumbBtnMinH,
															padding: `${breadcrumbBtnPadY} ${breadcrumbBtnPadX}`,
															background: !selectedSubcategory ? '#e0e7ff' : '#ffffff',
															border: `2px solid ${!selectedSubcategory ? '#6366f1' : '#cbd5e1'}`,
															borderRadius: breadcrumbBtnRadius,
															fontSize: breadcrumbBtnFont,
															fontWeight: !selectedSubcategory ? 700 : 600,
															color: !selectedSubcategory ? '#312e81' : '#475569',
															cursor: 'pointer',
															whiteSpace: 'nowrap',
															maxWidth: breadcrumbLabelMaxWidth,
															minWidth: 0,
															overflow: 'hidden',
															textOverflow: 'ellipsis',
															touchAction: 'manipulation',
															boxShadow: !selectedSubcategory ? '0 2px 0 #4f46e5' : '0 1px 2px rgba(0,0,0,.06)',
															lineHeight: 1.2
														}}
													>
														{categories.find((c: any) => c.id === selectedCategory)?.name || 'Categoría'}
													</button>
												</>
											)}
											{selectedSubcategory && (
												<>
													<span style={{ color: '#94a3b8', fontSize: breadcrumbBtnFont, fontWeight: 700, userSelect: 'none' }} aria-hidden>›</span>
													<span
														title={subcategoriesOfCategory.find((s: any) => s.id === selectedSubcategory)?.name || undefined}
														style={{
															minHeight: breadcrumbBtnMinH,
															padding: `${breadcrumbBtnPadY} ${breadcrumbBtnPadX}`,
															display: 'inline-flex',
															alignItems: 'center',
															background: '#f1f5f9',
															border: '2px solid #94a3b8',
															borderRadius: breadcrumbBtnRadius,
															fontSize: breadcrumbBtnFont,
															fontWeight: 700,
															color: '#0f172a',
															whiteSpace: 'nowrap',
															maxWidth: breadcrumbLabelMaxWidth,
															minWidth: 0,
															overflow: 'hidden',
															textOverflow: 'ellipsis',
															boxSizing: 'border-box',
															lineHeight: 1.2
														}}
													>
														{subcategoriesOfCategory.find((s: any) => s.id === selectedSubcategory)?.name || 'Subcategoría'}
													</span>
												</>
											)}
										</>
									)}
								</div>
								
							</div>

							{/* Grid: categorías, subcategorías o productos */}
							<div
								className="order-categories-grid-scroll"
								style={{
								flex: 1,
								minHeight: 0,
								padding: gridPadding,
								overflowY: 'auto',
								overflowX: 'hidden'
							}}>
								{productsLoading && showProductsInGrid ? (
									<div style={{ textAlign: 'center', padding: '2rem', color: '#718096', fontSize: isSmall ? '0.8125rem' : '0.875rem' }}>
										Cargando...
									</div>
								) : (
									<div style={{
										display: 'grid',
										gridTemplateColumns: `repeat(auto-fill, minmax(${gridMinCol}, 1fr))`,
										gap: gridGap
									}}>
										{/* Categorías */}
										{showCategoriesInGrid && (categoriesLoading ? (
											<div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#718096' }}>
												Cargando categorías...
											</div>
										) : (
											categories.map((category: any) => (
												<div
													key={category.id}
													onClick={() => {
														setSelectedCategory(category.id);
														const activeSubcategories = category.subcategories?.filter((s: any) => s.isActive) || [];
														const matchingSub = activeSubcategories.find((s: any) => s.name?.toLowerCase() === category.name?.toLowerCase());
														if (matchingSub) {
															setSelectedSubcategory(matchingSub.id);
														} else {
															setSelectedSubcategory(null);
														}
													}}
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
														e.currentTarget.style.borderColor = category.color || '#667eea';
													}}
													onMouseOut={(e) => {
														e.currentTarget.style.transform = 'translateY(0)';
														e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
														e.currentTarget.style.borderColor = '#e2e8f0';
													}}
												>
													<div style={{ fontSize: isSmall ? '2rem' : '2.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
														<CategoryIcon iconId={category.icon} type="category" size={isSmall ? '2rem' : '2.5rem'} />
													</div>
													<div style={{ fontSize: isSmall ? '0.75rem' : breadcrumbFontSize, fontWeight: '700', color: '#1e293b', textAlign: 'center', lineHeight: 1.25, wordBreak: 'break-word' }}>
														{category.name}
													</div>
												</div>
											))
										))}

										{/* Subcategorías */}
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
													e.currentTarget.style.borderColor = sub.color || '#667eea';
													e.currentTarget.style.backgroundColor = '#f0f4ff';
												}}
												onMouseOut={(e) => {
													e.currentTarget.style.borderColor = '#e2e8f0';
													e.currentTarget.style.backgroundColor = '#ffffff';
												}}
											>
												<div style={{ fontSize: isSmall ? '1.5rem' : '2rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
													<CategoryIcon iconId={sub.icon} type="subcategory" size={isSmall ? '1.5rem' : '2rem'} />
												</div>
												<div style={{ fontSize: isSmall ? '0.75rem' : '0.8125rem', fontWeight: '600', color: '#334155', textAlign: 'center', lineHeight: 1.25, wordBreak: 'break-word' }}>
													{sub.name}
												</div>
											</div>
										))}

										{/* Productos */}
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
															borderRadius: isSmall ? '8px' : '12px',
															padding: isSmall ? '0.5rem' : '0.75rem',
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
																	height: isSmall ? '60px' : isMedium ? '70px' : '80px',
																	objectFit: 'cover',
																	borderRadius: '8px',
																	marginBottom: isSmall ? '0.35rem' : '0.5rem'
																}}
															/>
														) : (
															<div style={{
																width: '100%',
																height: isSmall ? '60px' : isMedium ? '70px' : '80px',
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
															fontSize: isSmall ? '0.8125rem' : '0.875rem',
															fontWeight: '600',
															color: '#1e293b',
															marginBottom: '0.25rem',
															lineHeight: 1.25,
															flex: 1,
															wordBreak: 'break-word'
														}}>
															{product.name}
														</div>
														<div style={{
															fontSize: isSmall ? '0.8125rem' : '0.9375rem',
															fontWeight: '700',
															color: '#4f46e5',
															marginTop: 'auto'
														}}>
															S/ {parseFloat(product.salePrice || 0).toFixed(2)}
														</div>
														{product.preparationTime > 0 && (
															<div style={{
																fontSize: isSmall ? '0.7rem' : '0.8125rem',
																color: '#718096',
																display: 'flex',
																alignItems: 'center',
																justifyContent: 'center',
																gap: '0.25rem',
																marginTop: '0.25rem'
															}}>
																⏱️ {product.preparationTime} min
															</div>
														)}
													</div>
												))
											)
										)}
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Col derecha: resumen de orden */}
					<div style={{
						display: 'flex',
						flexDirection: 'column',
						gap: isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem',
						order: isSmall || isMedium ? 1 : 2,
						overflow: 'hidden',
						minHeight: 0
					}}>
						<div
							ref={orderListContainerRef}
							style={{
								background: 'white',
								border: '1px solid #e2e8f0',
								borderRadius: isSmall ? '10px' : isMedium ? '12px' : '14px',
								padding: isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem',
								flex: '1 1 auto',
								overflowY: 'auto',
								minHeight: 0
							}}>
							<h4 style={{
								margin: `0 0 ${isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem'} 0`,
								color: '#2d3748',
								fontSize: isSmall ? '0.875rem' : isMedium ? '1rem' : '1.25rem'
							}}>Detalle</h4>
							{isLoadingExistingOrder ? (
								<div style={{
									border: '1px dashed #cbd5e0',
									borderRadius: 12,
									padding: '1.25rem',
									textAlign: 'center',
									color: '#718096'
								}}>
									Cargando orden actual...
								</div>
							) : existingOperationError ? (
								<div style={{
									border: '1px solid #fed7d7',
									background: '#fff5f5',
									borderRadius: 12,
									padding: '1.25rem',
									textAlign: 'center',
									color: '#c53030'
								}}>
									Error al cargar la orden activa: {existingOperationError.message}
								</div>
							) : orderItems.length === 0 ? (
								<div style={{
									border: '1px dashed #cbd5e0', borderRadius: 12, padding: '1rem', textAlign: 'center', color: '#718096'
								}}>
									Aquí aparecerán los ítems agregados.
								</div>
							) : (
								<div style={{ display: 'flex', flexDirection: 'column', gap: isSmall ? '0.2rem' : isMedium ? '0.3rem' : '0.4rem' }}>
									{orderItems.map((item) => {
										const isEditable = !isExistingOrder || item.isNew;
										const canEditNotes = !isExistingOrder || item.isNew;
										return (
											<div
												key={item.id}
												ref={(el) => {
													if (el) {
														itemRefs.current[item.id] = el;
													}
												}}
												style={{
													border: '1px solid #e2e8f0',
													borderRadius: isSmall ? '6px' : isMedium ? '8px' : '10px',
													padding: isSmall ? '0.2rem' : isMedium ? '0.3rem' : '0.35rem',
													background: isExistingOrder && !item.isNew ? '#d4edda' : '#f7fafc'
												}}>
												{/* Una sola fila: Cantidad, Producto, Precio + Tachito, Botón notas */}
												<div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? '0.2rem' : isMedium ? '0.3rem' : '0.35rem', justifyContent: 'flex-start', flexWrap: 'nowrap', width: '100%', overflow: 'hidden' }}>
													{/* Controles de cantidad */}
													{/* Controles de cantidad */}
													<div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? '0.1rem' : isMedium ? '0.15rem' : '0.2rem', flexShrink: 0 }}>
														<button
															onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
															disabled={!isEditable}
															style={{
																width: isSmall ? '16px' : isMedium ? '18px' : '20px',
																height: isSmall ? '16px' : isMedium ? '18px' : '20px',
																borderRadius: isSmall ? '4px' : '6px',
																border: '1px solid #cbd5e0',
																background: isEditable ? 'white' : '#edf2f7',
																cursor: isEditable ? 'pointer' : 'not-allowed',
																fontSize: isSmall ? '0.7rem' : isMedium ? '0.75rem' : '0.8rem',
																display: 'flex',
																alignItems: 'center',
																justifyContent: 'center',
																padding: 0,
																flexShrink: 0
															}}
														>
															−
														</button>
														<input
															type="number"
															value={item.quantity}
															onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 0)}
															disabled={!isEditable}
															min="0"
															style={{
																width: isSmall ? '28px' : isMedium ? '32px' : '36px',
																textAlign: 'center',
																border: '1px solid #cbd5e0',
																borderRadius: isSmall ? '4px' : '6px',
																padding: isSmall ? '0.1rem' : isMedium ? '0.15rem' : '0.2rem',
																fontWeight: 600,
																background: isEditable ? 'white' : '#edf2f7',
																color: isEditable ? '#1a202c' : '#a0aec0',
																fontSize: isSmall ? '0.6rem' : isMedium ? '0.65rem' : '0.7rem',
																flexShrink: 0
															}}
														/>
														<button
															onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
															disabled={!isEditable}
															style={{
																width: isSmall ? '16px' : isMedium ? '18px' : '20px',
																height: isSmall ? '16px' : isMedium ? '18px' : '20px',
																borderRadius: isSmall ? '4px' : '6px',
																border: '1px solid #cbd5e0',
																background: isEditable ? 'white' : '#edf2f7',
																cursor: isEditable ? 'pointer' : 'not-allowed',
																fontSize: isSmall ? '0.7rem' : isMedium ? '0.75rem' : '0.8rem',
																display: 'flex',
																alignItems: 'center',
																justifyContent: 'center',
																padding: 0,
																flexShrink: 0
															}}
														>
															+
														</button>
													</div>

													{/* Nombre del producto */}
													<div style={{ flex: '1', minWidth: 0, paddingLeft: '4px', paddingRight: '4px' }}>
														<div style={{
															fontWeight: 700,
															color: '#2d3748',
															fontSize: isSmall ? '0.7rem' : isMedium ? '0.75rem' : '0.8125rem',
															overflow: 'hidden',
															whiteSpace: 'normal',
															wordBreak: 'break-word',
															lineHeight: '1.2',
															display: 'flex',
															alignItems: 'center',
															gap: '4px'
														}}>
															{item.name}
														</div>
													</div>

													{/* Precio total y tachito juntos */}
													<div style={{
														display: 'flex',
														alignItems: 'center',
														gap: isSmall ? '0.2rem' : isMedium ? '0.3rem' : '0.35rem',
														flexShrink: 0,
														minWidth: isSmall ? '55px' : isMedium ? '65px' : '75px',
														marginLeft: 'auto'
													}}>
														<div style={{
															fontWeight: 700,
															color: '#2d3748',
															fontSize: isSmall ? '0.7rem' : isMedium ? '0.75rem' : '0.8125rem',
															textAlign: 'right'
														}}>
															S/ {item.total.toFixed(2)}
														</div>
														<button
															onClick={() => handleRemoveItem(item.id)}
															disabled={!isEditable}
															style={{
																background: 'transparent',
																border: 'none',
																color: isEditable ? '#dc2626' : '#cbd5e0',
																cursor: isEditable ? 'pointer' : 'not-allowed',
																fontSize: isSmall ? '0.75rem' : isMedium ? '0.8rem' : '0.875rem',
																padding: '0.1rem',
																flexShrink: 0,
																display: 'flex',
																alignItems: 'center',
																justifyContent: 'center',
																lineHeight: 1
															}}
														>
															🗑️
														</button>
													</div>

													{/* Icono observaciones - abre el modal para escribir observaciones al plato */}
													<button
														type="button"
														onClick={() => {
															if (canEditNotes) {
																handleOpenObservationModal(item.id);
															}
														}}
														disabled={!canEditNotes}
														style={{
															padding: isSmall ? '0.1rem 0.35rem' : isMedium ? '0.15rem 0.4rem' : '0.15rem 0.45rem',
															borderRadius: 999,
															border: '1px solid #bae6fd',
															background: (item.notes || selectedObservations[item.id]?.size > 0)
																? '#dbeafe'
																: canEditNotes
																	? '#f0f9ff'
																	: '#f1f5f9',
															color: canEditNotes ? '#0369a1' : '#94a3b8',
															fontSize: isSmall ? '0.6rem' : isMedium ? '0.65rem' : '0.65rem',
															fontWeight: 600,
															cursor: canEditNotes ? 'pointer' : 'not-allowed',
															flexShrink: 0,
															lineHeight: 1,
															opacity: canEditNotes ? 1 : 0.6,
															position: 'relative'
														}}
														title={item.notes || (selectedObservations[item.id]?.size > 0)
															? (item.notes ? 'Editar observaciones' : `${selectedObservations[item.id].size} observación(es) seleccionada(s)`)
															: 'Escribir observación al plato'}
													>
														📋
														{(item.notes || (selectedObservations[item.id]?.size > 0)) && (
															<span style={{
																position: 'absolute',
																top: '-4px',
																right: '-4px',
																background: '#3b82f6',
																color: 'white',
																borderRadius: '50%',
																width: '12px',
																height: '12px',
																fontSize: '8px',
																display: 'flex',
																alignItems: 'center',
																justifyContent: 'center',
																fontWeight: 700
															}}>
																{item.notes ? '!' : selectedObservations[item.id]?.size}
															</span>
														)}
													</button>
												</div>
											</div>
										)
									})}
								</div>
							)}
						</div>

						<div style={{
							background: 'linear-gradient(135deg, #667eea, #764ba2)',
							border: '2px solid #667eea',
							borderRadius: isSmall ? '10px' : isMedium ? '12px' : '14px',
							padding: isSmall ? '0.5rem' : isMedium ? '0.625rem' : '0.75rem',
							display: 'grid',
							gap: isSmall ? '0.25rem' : isMedium ? '0.375rem' : '0.5rem',
							boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
							flexShrink: 0
						}}>
							<div style={{
								display: 'flex',
								justifyContent: 'space-between',
								color: 'rgba(255,255,255,0.9)',
								fontSize: isSmall ? '0.75rem' : isMedium ? '0.8125rem' : '0.875rem'
							}}>
								<span>Subtotal</span>
								<b>S/ {subtotal.toFixed(2)}</b>
							</div>
							<div style={{
								display: 'flex',
								justifyContent: 'space-between',
								color: 'rgba(255,255,255,0.9)',
								fontSize: isSmall ? '0.75rem' : isMedium ? '0.8125rem' : '0.875rem'
							}}>
								<span>Impuestos</span>
								<b>S/ {taxes.toFixed(2)}</b>
							</div>
							<div style={{ height: 1, background: 'rgba(255,255,255,0.3)', margin: isSmall ? '0.125rem 0' : isMedium ? '0.25rem 0' : '0.25rem 0' }} />
							<div style={{
								display: 'flex',
								justifyContent: 'space-between',
								color: 'white',
								fontSize: isSmall ? '1rem' : isMedium ? '1.125rem' : '1.25rem',
								fontWeight: 900,
								textShadow: '0 2px 4px rgba(0,0,0,0.2)'
							}}>
								<span>TOTAL</span>
								<span>S/ {total.toFixed(2)}</span>
							</div>
						</div>

						<div style={{
							display: 'grid',
							gridTemplateColumns: (() => {
								const cashCol = onOpenCash && canNavigateToCashPay ? 1 : 0;
								const n = 2 + (isExistingOrder ? 1 : 0) + cashCol;
								if (isSmall) return '1fr';
								if (isMedium) return n <= 2 ? '1fr 1fr' : 'repeat(2, 1fr)';
								return `repeat(${n}, 1fr)`;
							})(),
							gap: isSmall ? '0.5rem' : isMedium ? '0.625rem' : '0.75rem',
							flexShrink: 0
						}}>
							<button
								onClick={() => handleSaveOrder('PROCESSING', true)}
								disabled={isSaving || orderItems.length === 0}
								style={{
									padding: isSmall ? '0.5rem' : isMedium ? '0.625rem' : '0.75rem',
									background: isSaving || orderItems.length === 0 ? '#cbd5e0' : '#edf2ff',
									border: '2px solid #c3dafe',
									color: '#3730a3',
									borderRadius: isSmall ? '8px' : isMedium ? '10px' : '12px',
									cursor: isSaving || orderItems.length === 0 ? 'not-allowed' : 'pointer',
									fontWeight: 800,
									opacity: isSaving || orderItems.length === 0 ? 0.6 : 1,
									fontSize: isSmall ? '0.75rem' : isMedium ? '0.8125rem' : '0.875rem',
									boxShadow: isSaving || orderItems.length === 0 ? 'none' : '0 2px 6px rgba(59, 130, 246, 0.25)',
									transition: 'all 0.2s ease'
								}}
								onMouseEnter={(e) => {
									if (!isSaving && orderItems.length > 0) {
										e.currentTarget.style.transform = 'translateY(-2px)';
										e.currentTarget.style.boxShadow = '0 4px 10px rgba(59, 130, 246, 0.35)';
									}
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.transform = 'translateY(0)';
									e.currentTarget.style.boxShadow = isSaving || orderItems.length === 0 ? 'none' : '0 2px 6px rgba(59, 130, 246, 0.25)';
								}}
							>
								{isSaving ? 'Guardando...' : 'Enviar a cocina'}
							</button>
							<button
								onClick={() => handleSaveOrder('PROCESSING', false)}
								disabled={isSaving || orderItems.length === 0}
								style={{
									padding: isSmall ? '0.5rem' : isMedium ? '0.625rem' : '0.75rem',
									background: isSaving || orderItems.length === 0 ? '#cbd5e0' : '#f0fdf4',
									border: '2px solid #bbf7d0',
									color: '#166534',
									borderRadius: isSmall ? '8px' : isMedium ? '10px' : '12px',
									cursor: isSaving || orderItems.length === 0 ? 'not-allowed' : 'pointer',
									fontWeight: 800,
									opacity: isSaving || orderItems.length === 0 ? 0.6 : 1,
									fontSize: isSmall ? '0.7rem' : isMedium ? '0.75rem' : '0.8125rem',
									boxShadow: isSaving || orderItems.length === 0 ? 'none' : '0 2px 6px rgba(34, 197, 94, 0.25)',
									transition: 'all 0.2s ease'
								}}
								onMouseEnter={(e) => {
									if (!isSaving && orderItems.length > 0) {
										e.currentTarget.style.transform = 'translateY(-2px)';
										e.currentTarget.style.boxShadow = '0 4px 10px rgba(34, 197, 94, 0.35)';
									}
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.transform = 'translateY(0)';
									e.currentTarget.style.boxShadow = isSaving || orderItems.length === 0 ? 'none' : '0 2px 6px rgba(34, 197, 94, 0.25)';
								}}
							>
								{isSaving ? 'Guardando...' : 'Enviar a cocina (sin imprimir)'}
							</button>

							
							{/* Botón de Precuenta - solo visible cuando hay una orden existente */}
							{isExistingOrder && (
								<button
									onClick={handlePrecuenta}
									disabled={!existingOperation || existingOperation.status === 'COMPLETED' || isPrintingPrecuenta || isLoadingExistingOrder}
									style={{
										padding: isSmall ? '0.5rem' : isMedium ? '0.625rem' : '0.75rem',
										background: !existingOperation || existingOperation.status === 'COMPLETED' || isPrintingPrecuenta || isLoadingExistingOrder
											? '#cbd5e0'
											: 'linear-gradient(135deg, rgba(245,158,11,0.9), rgba(217,119,6,0.9))',
										color: 'white',
										border: 'none',
										borderRadius: isSmall ? '8px' : isMedium ? '10px' : '12px',
										cursor: !existingOperation || existingOperation.status === 'COMPLETED' || isPrintingPrecuenta || isLoadingExistingOrder ? 'not-allowed' : 'pointer',
										fontWeight: 800,
										opacity: !existingOperation || existingOperation.status === 'COMPLETED' || isPrintingPrecuenta || isLoadingExistingOrder ? 0.6 : 1,
										fontSize: isSmall ? '0.75rem' : isMedium ? '0.8125rem' : '0.875rem',
										boxShadow: !existingOperation || existingOperation.status === 'COMPLETED' || isPrintingPrecuenta || isLoadingExistingOrder
											? 'none'
											: '0 3px 10px rgba(245,158,11,0.35)',
										transition: 'all 0.2s ease',
										textShadow: '0 1px 2px rgba(0,0,0,0.1)'
									}}
									onMouseEnter={(e) => {
										if (existingOperation && existingOperation.status !== 'COMPLETED' && !isPrintingPrecuenta && !isLoadingExistingOrder) {
											e.currentTarget.style.transform = 'translateY(-2px)';
											e.currentTarget.style.boxShadow = '0 5px 14px rgba(245,158,11,0.45)';
										}
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.transform = 'translateY(0)';
										e.currentTarget.style.boxShadow = !existingOperation || existingOperation.status === 'COMPLETED' || isPrintingPrecuenta || isLoadingExistingOrder
											? 'none'
											: '0 3px 10px rgba(245,158,11,0.35)';
									}}
								>
									{isPrintingPrecuenta ? '🖨️ Imprimiendo...' : '🧾 Precuenta'}
								</button>
							)}
						</div>
					</div>
				</div>

				{/* Footer hints */}
				<div style={{
					padding: isSmall ? '0.375rem 0.5rem' : isMedium ? '0.5rem 0.75rem' : '0.6rem 1rem',
					display: 'flex',
					justifyContent: 'center',
					gap: '1rem',
					borderTop: '1px solid #e2e8f0',
					background: 'rgba(255,255,255,0.85)'
				}}>
					<span style={{
						color: '#718096',
						fontSize: isSmall ? '10px' : isMedium ? '11px' : '12px'
					}}>
						{isSmall || isMedium ? 'Atajos: Esc Cerrar' : 'Atajos: Ctrl+K Buscar • Esc Cerrar'}
					</span>
				</div>
			</div>

			{/* Modal de Observaciones */}
			{showObservationModal && (() => {
				const item = orderItems.find(i => i.id === showObservationModal);
				if (!item) return null;

				const observations = productObservations[showObservationModal] || [];
				const selectedIds = selectedObservations[showObservationModal] || new Set<string>();
				const canEdit = !isExistingOrder || item.isNew;

				return (
					<ModalObservation
						isOpen={true}
						onClose={() => setShowObservationModal(null)}
						observations={observations}
						selectedObservationIds={selectedIds}
						onApply={(selectedIds, manualNotes) => handleApplyObservations(showObservationModal, selectedIds, manualNotes)}
						productName={item.name}
						currentNotes={item.notes || ''}
						canEdit={canEdit}
					/>
				);
			})()}

			{/* Teclado virtual: como login — solo mitad inferior; en escritorio ancho ~50% alineado a la izquierda (columna catálogo) */}
			{isKeyboardVisible && (
				<div
					onMouseDown={(e) => e.preventDefault()}
					style={{
						position: 'absolute',
						bottom: 0,
						left: 0,
						zIndex: 1200,
						width: keyboardCompact ? '100%' : '50%',
						maxWidth: keyboardCompact ? '100%' : 'min(50vw, 720px)',
						maxHeight: 'min(50vh, 50dvh)',
						display: 'flex',
						flexDirection: 'column',
						backgroundColor: '#f8fafc',
						borderTop: '1px solid #e2e8f0',
						borderRight: keyboardCompact ? 'none' : '1px solid #e2e8f0',
						borderTopRightRadius: keyboardCompact ? 0 : isMedium ? 10 : 12,
						boxShadow: '4px -8px 32px rgba(0,0,0,0.08)',
						padding: keyboardTight ? '0.35rem 0.3rem' : isXs || isSmall ? '0.5rem 0.5rem' : isMedium ? '0.65rem 0.85rem' : '0.75rem 1rem',
						paddingBottom: `max(${keyboardTight ? '0.35rem' : '0.5rem'}, env(safe-area-inset-bottom))`,
						animation: 'slideUp 0.3s ease-out',
						boxSizing: 'border-box',
						overflow: 'hidden',
						touchAction: 'manipulation'
					}}
				>
					<div style={{
						width: '100%',
						flex: 1,
						minHeight: 0,
						overflowX: 'hidden',
						overflowY: 'auto',
						WebkitOverflowScrolling: 'touch',
						boxSizing: 'border-box'
					}}>
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
		</div>
	);
};

export default Order;











