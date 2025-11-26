import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import type { Table } from '../../types/table';
import { CREATE_OPERATION, ADD_ITEMS_TO_OPERATION, UPDATE_TABLE_STATUS } from '../../graphql/mutations';
import { GET_CATEGORIES_BY_BRANCH, GET_PRODUCTS_BY_CATEGORY, GET_PRODUCTS_BY_BRANCH, GET_OPERATION_BY_TABLE, SEARCH_PRODUCTS } from '../../graphql/queries';

type OrderProps = {
	table: Table;
	onClose: () => void;
	onSuccess?: () => void; // Callback opcional para cuando se guarde exitosamente
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
};

const Order: React.FC<OrderProps> = ({ table, onClose, onSuccess }) => {
	const { companyData, user, deviceId, getDeviceId, updateTableInContext } = useAuth();
	const isExistingOrder = Boolean(table?.currentOperationId);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState<string>('');
	const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
	const [quantity, setQuantity] = useState<string>('1');
	const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
	const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
	const [initializedFromExistingOrder, setInitializedFromExistingOrder] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// Mutación para crear la operación
	const [createOperationMutation] = useMutation(CREATE_OPERATION);
	const [addItemsToOperationMutation] = useMutation(ADD_ITEMS_TO_OPERATION);
	const [updateTableStatusMutation] = useMutation(UPDATE_TABLE_STATUS);

	// Obtener categorías de la sucursal
	const { data: categoriesData, loading: categoriesLoading } = useQuery(GET_CATEGORIES_BY_BRANCH, {
		variables: { branchId: companyData?.branch.id },
		skip: !companyData?.branch.id
	});

	const categories = categoriesData?.categoriesByBranch || [];

	// Búsqueda de productos (si hay término de búsqueda)
	const { data: searchData, loading: searchLoading } = useQuery(SEARCH_PRODUCTS, {
		variables: { search: searchTerm, branchId: companyData?.branch.id, limit: 50 },
		skip: !companyData?.branch.id || searchTerm.length < 3,
		errorPolicy: 'ignore'
	});

	// Obtener productos por categoría (si hay una seleccionada y no hay búsqueda)
	const { data: productsByCategoryData, loading: productsByCategoryLoading } = useQuery(GET_PRODUCTS_BY_CATEGORY, {
		variables: { categoryId: selectedCategory },
		skip: !selectedCategory || searchTerm.length >= 3
	});

	// Obtener todos los productos de la sucursal (cargamos siempre para el fallback de búsqueda)
	const { data: productsByBranchData, loading: productsByBranchLoading } = useQuery(GET_PRODUCTS_BY_BRANCH, {
		variables: { branchId: companyData?.branch.id },
		skip: !companyData?.branch.id
	});

	const shouldFetchExistingOrder = Boolean(isExistingOrder && table?.id && companyData?.branch.id);
	const {
		data: existingOperationData,
		loading: existingOperationLoading,
		error: existingOperationError,
		refetch: refetchExistingOperation
	} = useQuery(GET_OPERATION_BY_TABLE, {
		variables: { tableId: table?.id, branchId: companyData?.branch.id || '' },
		skip: !shouldFetchExistingOrder,
		fetchPolicy: 'network-only'
	});

	// Determinar qué productos mostrar según la selección
	let products;
	let productsLoading;
	
	if (searchTerm.length >= 3) {
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
	
	const productsList = products || [];

	useEffect(() => {
		setOrderItems([]);
		setExpandedNotes({});
		setInitializedFromExistingOrder(false);
		// Reiniciar bandera de modificación cuando cambiamos de mesa
	}, [table?.id]);

	useEffect(() => {
		if (!shouldFetchExistingOrder || initializedFromExistingOrder) {
			return;
		}

		if (existingOperationLoading) {
			return;
		}

		const operation = existingOperationData?.operationByTable;

		if (!operation) {
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

			return {
				id: String(detail.id ?? `${detail.productId}-${Date.now()}-${Math.random()}`),
				productId: String(detail.productId ?? ''),
				name: detail.productName || 'Producto sin nombre',
				price: safeUnitPrice,
				quantity: safeQuantity,
				total: computedTotal,
				isNew: false,
				notes: typeof detail.notes === 'string' ? detail.notes : ''
			};
		});

		setOrderItems(mappedItems);
		setExpandedNotes({});
		setInitializedFromExistingOrder(true);
	}, [
		shouldFetchExistingOrder,
		existingOperationData,
		existingOperationLoading,
		initializedFromExistingOrder
	]);

	const existingOperation = existingOperationData?.operationByTable;
	const isLoadingExistingOrder = shouldFetchExistingOrder && existingOperationLoading && !initializedFromExistingOrder;

	// Función para agregar producto a la orden
	const handleAddProduct = (productIdToAdd?: string, qtyToAdd?: number) => {
		const productId = productIdToAdd || selectedProduct;
		if (!productId) return;
		
		const product = productsList.find((p: any) => p.id === productId);
		if (!product) return;

		// Validar que el precio sea un número válido
		const productPrice = parseFloat(product.salePrice) || 0;
		if (productPrice <= 0) {
			setSaveError(`El producto "${product.name}" no tiene un precio válido`);
			setTimeout(() => setSaveError(null), 3000);
			return;
		}

		const qty = qtyToAdd || parseInt(quantity) || 1;
		const newItem: OrderItem = {
			id: `${product.id}-${Date.now()}`,
			productId: product.id,
			name: product.name,
			price: productPrice,
			quantity: qty,
			total: productPrice * qty,
			isNew: true,
			notes: ''
		};

		if (isExistingOrder) {
			// En órdenes existentes, siempre agregamos como una nueva fila
			setOrderItems([...orderItems, newItem]);
		} else {
			// Para nuevas órdenes, mantener el comportamiento de agrupar
			const existingItemIndex = orderItems.findIndex(item => item.productId === product.id);
			
			if (existingItemIndex >= 0) {
				const updatedItems = [...orderItems];
				const existingItem = updatedItems[existingItemIndex];
				const validQuantity = Number(existingItem.quantity) + qty;
				const validPrice = Number(existingItem.price) || productPrice;
				updatedItems[existingItemIndex].quantity = validQuantity;
				updatedItems[existingItemIndex].total = validPrice * validQuantity;
				updatedItems[existingItemIndex].isNew = true;
				setOrderItems(updatedItems);
			} else {
				setOrderItems([...orderItems, newItem]);
			}
		}

		// Limpiar selección solo si fue agregado desde el botón
		if (!productIdToAdd) {
			setSelectedProduct(null);
			setQuantity('1');
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
		setExpandedNotes(prev => {
			if (!prev[itemId]) {
				return prev;
			}
			const updated = { ...prev };
			delete updated[itemId];
			return updated;
		});
	};

	const handleToggleNotes = (itemId: string) => {
		setExpandedNotes(prev => ({
			...prev,
			[itemId]: !prev[itemId]
		}));
	};

	const handleUpdateNotes = (itemId: string, notes: string) => {
		setOrderItems(items =>
			items.map(item => {
				if (item.id !== itemId) {
					return item;
				}
				if (isExistingOrder && !item.isNew) {
					return item;
				}
				return {
					...item,
					notes
				};
			})
		);
	};

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

	// Función para guardar la orden
	const handleSaveOrder = async (status: string = 'PROCESSING') => {
		const itemsToProcess = isExistingOrder ? orderItems.filter(item => item.isNew) : orderItems;

		if (itemsToProcess.length === 0) {
			const message = isExistingOrder
				? 'Debe agregar al menos un producto nuevo a la orden'
				: 'Debe agregar al menos un producto a la orden';
			setSaveError(message);
			setTimeout(() => setSaveError(null), 3000);
			return;
		}

		if (!companyData?.branch.id) {
			setSaveError('No se encontró información de la sucursal');
			setTimeout(() => setSaveError(null), 3000);
			return;
		}

		setIsSaving(true);
		setSaveError(null);

		try {
			const invalidItems = itemsToProcess.filter(item =>
				!item.price || isNaN(item.price) || item.price <= 0 ||
				!item.quantity || isNaN(item.quantity) || item.quantity <= 0
			);

			if (invalidItems.length > 0) {
				setSaveError('Algunos productos tienen valores inválidos. Por favor, verifique los precios y cantidades.');
				setTimeout(() => setSaveError(null), 3000);
				return;
			}

			if (isExistingOrder) {
				const operationId = existingOperation?.id || table?.currentOperationId;
				if (!operationId) {
					setSaveError('No se encontró la operación activa para esta mesa.');
					setTimeout(() => setSaveError(null), 3000);
					return;
				}

				const igvPercentageValue = typeof existingOperation?.igvPercentage === 'number'
					? existingOperation.igvPercentage
					: 10;
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

				const resolvedDeviceId = deviceId || getDeviceId();

				const result = await addItemsToOperationMutation({
					variables: {
						operationId,
						details,
						deviceId: resolvedDeviceId
					}
				});

				if (result.data?.addItemsToOperation?.success) {
					if (onSuccess) {
						onSuccess();
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
				if (isNaN(rawPrice) || rawPrice <= 0) {
					throw new Error(`Precio inválido para el producto: ${item.name}`);
				}
				const unitPrice = parseFloat((Math.round(rawPrice * 100) / 100).toFixed(2));

				const unitValue = parseFloat((Math.round((unitPrice / 1.1) * 100) / 100).toFixed(2));

				const rawQuantity = typeof item.quantity === 'number' ? item.quantity : parseInt(String(item.quantity), 10);
				const quantity = (isNaN(rawQuantity) || rawQuantity <= 0) ? 1 : parseInt(String(rawQuantity), 10);

				if (isNaN(unitPrice) || unitPrice <= 0 || isNaN(unitValue) || unitValue <= 0 || isNaN(quantity) || quantity <= 0) {
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

			const igvPercentageDecimal = 0.10;
			const igvPercentage = 10;
			const grossAmount = typeof itemsTotal === 'number' && !isNaN(itemsTotal) ? itemsTotal : 0;
			const calculatedSubtotal = parseFloat((Math.round((grossAmount / (1 + igvPercentageDecimal)) * 100) / 100).toFixed(2));
			const calculatedIgvAmount = parseFloat((Math.round((grossAmount - calculatedSubtotal) * 100) / 100).toFixed(2));
			const validTotal = parseFloat((Math.round(grossAmount * 100) / 100).toFixed(2));

			if (isNaN(calculatedSubtotal) || calculatedSubtotal < 0 ||
				isNaN(calculatedIgvAmount) || calculatedIgvAmount < 0 ||
				isNaN(validTotal) || validTotal <= 0) {
				setSaveError('Error al calcular los totales. Por favor, intente nuevamente.');
				setTimeout(() => setSaveError(null), 3000);
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
				igvPercentage: igvPercentage,
				total: validTotal,
				operationDate: new Date().toISOString()
			};

			if (table?.id) {
				variables.tableId = table.id;
			}
			if (user?.id) {
				variables.userId = user.id;
			}

			const cleanVariables: any = {};
			Object.keys(variables).forEach(key => {
				const value = variables[key];
				const numericRequiredFields = ['subtotal', 'igvAmount', 'igvPercentage', 'total'];
				if (numericRequiredFields.includes(key)) {
					const defaultValue = key === 'igvPercentage' ? 10 : 0;
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
						updateTableInContext({
							id: updatedTable.id,
							status: updatedTable.status,
							statusColors: updatedTable.statusColors,
							currentOperationId: result.data.createOperation.operation?.id || updatedTable.currentOperationId,
							occupiedById: updatedTable.occupiedById,
							userName: updatedTable.userName
						});
						console.log('✅ Estado de mesa actualizado a OCCUPIED');
					}
				} catch (tableError) {
					console.error('⚠️ Error al actualizar estado de mesa:', tableError);
					// Continuar aunque falle la actualización de la mesa
				}

				if (onSuccess) {
					onSuccess();
				}
				setTimeout(() => {
					onClose();
				}, 500);
			} else {
				setSaveError(result.data?.createOperation?.message || 'Error al guardar la orden');
				setTimeout(() => setSaveError(null), 3000);
			}
		} catch (error: any) {
			console.error('Error al guardar la orden:', error);
			setSaveError(error.message || 'Error al guardar la orden');
			setTimeout(() => setSaveError(null), 3000);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: 'linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.15))',
			backdropFilter: 'blur(6px)',
			display: 'flex',
			justifyContent: 'center',
			alignItems: 'center',
			zIndex: 1100,
			padding: '1rem'
		}}>
			<div style={{
				background: 'rgba(255,255,255,0.9)',
				borderRadius: '16px',
				width: '100%',
				maxWidth: '1400px',
				height: '92vh',
				boxShadow: '0 25px 80px rgba(0,0,0,0.20)',
				overflow: 'hidden',
				border: '1px solid rgba(226,232,240,0.8)',
				display: 'flex',
				flexDirection: 'column'
			}}>
				{/* Header */}
				<div style={{
					background: 'linear-gradient(135deg, #667eea, #764ba2)',
					padding: '1rem 1.25rem',
					color: 'white',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between'
				}}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
						<div style={{
							backgroundColor: 'rgba(255,255,255,0.15)',
							borderRadius: 12,
							padding: '0.35rem 0.6rem',
							fontWeight: 700
						}}>
							{isExistingOrder ? '🍽️ Orden Actual' : '🍽️ Nueva Orden'}
						</div>
						<h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Mesa {table.name.replace('MESA ','')}</h3>
						<span style={{ opacity: 0.9 }}>•</span>
						<div style={{
							backgroundColor: 'rgba(255,255,255,0.15)',
							borderRadius: 12,
							padding: '0.35rem 0.6rem',
							fontWeight: 600
						}}>
							Capacidad {table.capacity}
						</div>
						{isExistingOrder && (
							<>
								<span style={{ opacity: 0.9 }}>•</span>
								<div style={{
									backgroundColor: 'rgba(255,255,255,0.15)',
									borderRadius: 12,
									padding: '0.35rem 0.6rem',
									fontWeight: 600
								}}>
									Orden #{existingOperation?.order ?? (isLoadingExistingOrder ? '...' : '—')}
								</div>
								<span style={{ opacity: 0.9 }}>•</span>
								<div style={{
									backgroundColor: 'rgba(255,255,255,0.15)',
									borderRadius: 12,
									padding: '0.35rem 0.6rem',
									fontWeight: 600
								}}>
									Estado {existingOperation?.status ?? (isLoadingExistingOrder ? '...' : '—')}
								</div>
							</>
						)}
					</div>
					<button onClick={onClose} style={{
						background: 'rgba(255,255,255,0.15)',
						border: '1px solid rgba(255,255,255,0.35)',
						color: 'white',
						padding: '0.45rem 0.9rem',
						borderRadius: 10,
						cursor: 'pointer',
						fontWeight: 600
					}}>
						Cerrar
					</button>
				</div>

				{/* Body */}
				<div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem', padding: '1rem', flex: 1, overflow: 'hidden' }}>
					{/* Col izquierda: búsqueda y catálogo */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
						<div style={{
							background: 'white',
							border: '1px solid #e2e8f0',
							borderRadius: 14,
							padding: '0.85rem 0.9rem',
							flexShrink: 0
						}}>
							<div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '0.75rem' }}>
								<div style={{ position: 'relative' }}>
									<span style={{ position: 'absolute', left: 10, top: 10, opacity: 0.6 }}>🔎</span>
									<input 
										type="text"
										placeholder="Buscar producto o escanear código"
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										style={{
											width: '100%', padding: '0.65rem 0.85rem 0.65rem 2rem',
											border: '1px solid #e2e8f0', borderRadius: 10
										}} 
									/>
								</div>
								<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
									<input 
										type="number" 
										placeholder="Cant." 
										value={quantity}
										onChange={(e) => setQuantity(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter' && selectedProduct) {
												handleAddProduct();
											}
										}}
										min="1"
										style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.65rem 0.75rem' }} 
									/>
									<button 
										onClick={() => handleAddProduct()}
										disabled={!selectedProduct}
										style={{
											background: selectedProduct ? '#667eea' : '#cbd5e0', 
											color: 'white', 
											border: 'none', 
											borderRadius: 10,
											fontWeight: 700, 
											cursor: selectedProduct ? 'pointer' : 'not-allowed',
											opacity: selectedProduct ? 1 : 0.6
										}}
									>
										Agregar
									</button>
								</div>
							</div>
							<div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
								{/* Opción "Todos" */}
								<span 
									onClick={() => {
										setSelectedCategory(null);
										setSearchTerm('');
									}}
									key="todos"
									style={{
										padding: '0.35rem 0.7rem',
										border: '1px solid #e2e8f0',
										borderRadius: 9999,
										background: selectedCategory === null ? '#667eea' : '#f8fafc',
										color: selectedCategory === null ? 'white' : '#4a5568',
										fontSize: 12,
										fontWeight: 600,
										cursor: 'pointer',
										transition: 'all 0.2s ease'
									}}
								>
									Todos
								</span>
								{/* Categorías dinámicas */}
								{categoriesLoading ? (
									<span style={{ padding: '0.35rem 0.7rem', fontSize: 12, color: '#718096' }}>
										Cargando categorías...
									</span>
								) : (
									categories.map((category: any) => (
										<span
											key={category.id}
											onClick={() => {
												setSelectedCategory(category.id);
												setSearchTerm('');
											}}
											style={{
												padding: '0.35rem 0.7rem',
												border: `1px solid ${selectedCategory === category.id ? category.color || '#667eea' : '#e2e8f0'}`,
												borderRadius: 9999,
												background: selectedCategory === category.id 
													? category.color || '#667eea' 
													: '#f8fafc',
												color: selectedCategory === category.id ? 'white' : '#4a5568',
												fontSize: 12,
												fontWeight: 600,
												cursor: 'pointer',
												transition: 'all 0.2s ease',
												display: 'flex',
												alignItems: 'center',
												gap: '0.3rem'
											}}
										>
											{category.icon && <span>{category.icon}</span>}
											{category.name}
										</span>
									))
								)}
							</div>
						</div>

						{/* Grid de productos */}
						<div style={{
							display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem',
							overflowY: 'auto', maxHeight: '100%'
						}}>
							{productsLoading ? (
								<div style={{
									gridColumn: '1 / -1',
									textAlign: 'center',
									padding: '2rem',
									color: '#718096'
								}}>
									Cargando productos...
								</div>
							) : productsList.length === 0 ? (
								<div style={{
									gridColumn: '1 / -1',
									textAlign: 'center',
									padding: '2rem',
									color: '#718096'
								}}>
									No hay productos disponibles
								</div>
							) : (
								productsList.map((product: any) => (
									<div
										key={product.id}
										onClick={() => handleAddProduct(product.id, 1)}
										style={{
											background: 'white',
											border: '1px solid #e2e8f0',
											borderRadius: 14,
											padding: '0.75rem',
											cursor: 'pointer',
											transition: 'transform 120ms ease',
											display: 'grid',
											gap: '0.35rem',
											textAlign: 'center'
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.transform = 'scale(1.02)';
											e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.transform = 'scale(1)';
											e.currentTarget.style.boxShadow = 'none';
										}}
									>
										{product.imageBase64 ? (
											<img
												src={`data:image/jpeg;base64,${product.imageBase64}`}
												alt={product.name}
												style={{
													width: '100%',
													height: '100px',
													objectFit: 'cover',
													borderRadius: '8px',
													backgroundColor: '#f7fafc'
												}}
											/>
										) : (
											<div style={{
												fontSize: '2rem',
												height: '100px',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												backgroundColor: '#f7fafc',
												borderRadius: '8px'
											}}>
												🍽️
											</div>
										)}
										<div style={{ fontWeight: 700, color: '#2d3748', fontSize: '0.9rem' }}>
											{product.name}
										</div>
										<div style={{ fontWeight: 700, color: '#667eea', fontSize: '1rem' }}>
											$ {parseFloat(product.salePrice).toFixed(2)}
										</div>
										{product.preparationTime > 0 && (
											<div style={{
												fontSize: '0.75rem',
												color: '#718096',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												gap: '0.25rem'
											}}>
												⏱️ {product.preparationTime} min
											</div>
										)}
									</div>
								))
							)}
						</div>
					</div>

					{/* Col derecha: resumen de orden */}
					<div style={{ display: 'grid', gap: '1rem' }}>
						<div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
							<h4 style={{ margin: '0 0 0.75rem 0', color: '#2d3748' }}>Detalle</h4>
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
								<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
									{orderItems.map((item) => {
										const isEditable = !isExistingOrder || item.isNew;
										const canEditNotes = !isExistingOrder || item.isNew;
										return (
										<div key={item.id} style={{
											border: '1px solid #e2e8f0',
											borderRadius: 12,
											padding: '0.75rem',
											background: '#f7fafc'
										}}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
												<div style={{ flex: 1 }}>
													<div style={{ fontWeight: 700, color: '#2d3748', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
														{item.name}
													</div>
													<div style={{ fontWeight: 700, color: '#667eea', fontSize: '0.9rem' }}>
														$ {item.price.toFixed(2)}
													</div>
													<div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
														<button
															type="button"
															onClick={() => handleToggleNotes(item.id)}
															style={{
																padding: '0.25rem 0.65rem',
																borderRadius: 999,
																border: '1px solid #cbd5e0',
																background: expandedNotes[item.id]
																	? '#e0e7ff'
																	: canEditNotes
																		? '#edf2f7'
																		: '#f1f5f9',
																color: canEditNotes ? '#3730a3' : '#64748b',
																fontSize: '0.75rem',
																fontWeight: 600,
																cursor: 'pointer'
															}}
														>
															Notas {item.notes ? '•' : ''}
														</button>
														{item.notes && !expandedNotes[item.id] && (
															<span style={{
																fontSize: '0.75rem',
																color: '#4a5568',
																background: '#e2e8f0',
																padding: '0.2rem 0.5rem',
																borderRadius: 999,
																maxWidth: '220px',
																whiteSpace: 'nowrap',
																overflow: 'hidden',
																textOverflow: 'ellipsis'
															}}>
																{item.notes}
															</span>
														)}
													</div>
													{expandedNotes[item.id] && (
														<div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
															<textarea
																value={item.notes}
																onChange={(e) => handleUpdateNotes(item.id, e.target.value)}
																disabled={!canEditNotes}
																placeholder="Agregar nota u observación (ej: sin ají, bien cocido)"
																style={{
																	width: '100%',
																	minHeight: '60px',
																	borderRadius: 8,
																	border: '1px solid #cbd5e0',
																	padding: '0.5rem',
																	fontSize: '0.85rem',
																	resize: 'vertical',
																	background: canEditNotes ? 'white' : '#edf2f7',
																	color: canEditNotes ? '#1a202c' : '#718096'
																}}
															/>
															{!canEditNotes && item.notes && (
																<span style={{ fontSize: '0.7rem', color: '#a0aec0' }}>
																	Notas registradas anteriormente
																</span>
															)}
														</div>
													)}
													{isExistingOrder && (
														<div style={{ marginTop: '0.35rem' }}>
															<span style={{
																padding: '0.2rem 0.6rem',
																borderRadius: '999px',
																fontSize: '0.7rem',
																fontWeight: 600,
																backgroundColor: item.isNew ? '#c6f6d5' : '#e2e8f0',
																color: item.isNew ? '#22543d' : '#4a5568'
															}}>
																{item.isNew ? 'Nuevo (sin guardar)' : 'Registrado'}
															</span>
														</div>
													)}
												</div>
												<button
													onClick={() => handleRemoveItem(item.id)}
													disabled={!isEditable}
													style={{
														background: 'transparent',
														border: 'none',
														color: isEditable ? '#dc2626' : '#cbd5e0',
														cursor: isEditable ? 'pointer' : 'not-allowed',
														fontSize: '1.2rem',
														padding: '0.25rem'
													}}
												>
													🗑️
												</button>
											</div>
											<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
												<button
													onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
													disabled={!isEditable}
													style={{
														width: '28px',
														height: '28px',
														borderRadius: '6px',
														border: '1px solid #cbd5e0',
														background: isEditable ? 'white' : '#edf2f7',
														cursor: isEditable ? 'pointer' : 'not-allowed',
														fontSize: '1.1rem',
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center'
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
														width: '60px',
														textAlign: 'center',
														border: '1px solid #cbd5e0',
														borderRadius: '6px',
														padding: '0.35rem',
														fontWeight: 600,
														background: isEditable ? 'white' : '#edf2f7',
														color: isEditable ? '#1a202c' : '#a0aec0'
													}}
												/>
												<button
													onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
													disabled={!isEditable}
													style={{
														width: '28px',
														height: '28px',
														borderRadius: '6px',
														border: '1px solid #cbd5e0',
														background: isEditable ? 'white' : '#edf2f7',
														cursor: isEditable ? 'pointer' : 'not-allowed',
														fontSize: '1.1rem',
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center'
													}}
												>
													+
												</button>
												<div style={{ marginLeft: 'auto', fontWeight: 700, color: '#2d3748', fontSize: '1rem' }}>
													$ {item.total.toFixed(2)}
												</div>
											</div>
										</div>
									)})}
								</div>
							)}
						</div>

						<div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '1rem', display: 'grid', gap: '0.5rem' }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', color: '#4a5568' }}>
								<span>Subtotal</span>
								<b>$ {subtotal.toFixed(2)}</b>
							</div>
							<div style={{ display: 'flex', justifyContent: 'space-between', color: '#4a5568' }}>
								<span>Impuestos</span>
								<b>$ {taxes.toFixed(2)}</b>
							</div>
							<div style={{ height: 1, background: '#e2e8f0', margin: '0.25rem 0' }} />
							<div style={{ display: 'flex', justifyContent: 'space-between', color: '#2d3748', fontSize: 18, fontWeight: 800 }}>
								<span>Total</span>
								<span>$ {total.toFixed(2)}</span>
							</div>
						</div>

						<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
							<button 
								onClick={() => handleSaveOrder('PROCESSING')}
								disabled={isSaving || orderItems.length === 0}
								style={{ 
									padding: '0.85rem', 
									background: isSaving || orderItems.length === 0 ? '#cbd5e0' : '#f7fafc', 
									border: '1px solid #e2e8f0', 
									borderRadius: 12, 
									cursor: isSaving || orderItems.length === 0 ? 'not-allowed' : 'pointer', 
									fontWeight: 700, 
									color: '#4a5568',
									opacity: isSaving || orderItems.length === 0 ? 0.6 : 1
								}}
							>
								{isSaving ? 'Cambiando...' : 'Cambiar de mesa'}
							</button>
							<button 
								onClick={() => handleSaveOrder('PROCESSING')}
								disabled={isSaving || orderItems.length === 0}
								style={{ 
									padding: '0.85rem', 
									background: isSaving || orderItems.length === 0 ? '#cbd5e0' : '#edf2ff', 
									border: '1px solid #c3dafe', 
									color: '#3730a3', 
									borderRadius: 12, 
									cursor: isSaving || orderItems.length === 0 ? 'not-allowed' : 'pointer', 
									fontWeight: 800,
									opacity: isSaving || orderItems.length === 0 ? 0.6 : 1
								}}
							>
								{isSaving ? 'Guardando...' : 'Enviar a cocina'}
							</button>
							<button 
								onClick={() => handleSaveOrder('TO_PAY')}
								disabled={isSaving || orderItems.length === 0}
								style={{ 
									padding: '0.85rem', 
									background: isSaving || orderItems.length === 0 ? '#cbd5e0' : 'linear-gradient(135deg,#667eea,#764ba2)', 
									color: 'white', 
									border: 'none', 
									borderRadius: 12, 
									cursor: isSaving || orderItems.length === 0 ? 'not-allowed' : 'pointer', 
									fontWeight: 800,
									opacity: isSaving || orderItems.length === 0 ? 0.6 : 1
								}}
							>
								{isSaving ? 'Cancelando...' : 'Cancelar Orden'}
							</button>
						</div>
						{saveError && (
							<div style={{
								marginTop: '0.5rem',
								padding: '0.75rem',
								background: '#fed7d7',
								border: '1px solid #feb2b2',
								borderRadius: 12,
								color: '#742a2a',
								fontSize: '0.875rem',
								fontWeight: 600
							}}>
								❌ {saveError}
							</div>
						)}
					</div>
				</div>

				{/* Footer hints */}
				<div style={{
					padding: '0.6rem 1rem', display: 'flex', justifyContent: 'center', gap: '1rem', borderTop: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.85)'
				}}>
					<span style={{ color: '#718096', fontSize: 12 }}>Atajos: ⏎ Agregar • Ctrl+K Buscar • Esc Cerrar</span>
				</div>
			</div>
		</div>
	);
};

export default Order;


