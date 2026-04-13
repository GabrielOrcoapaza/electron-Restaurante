import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useWebSocket } from '../../context/WebSocketContext';
import { useToast } from '../../context/ToastContext';
import { useResponsive } from '../../hooks/useResponsive';
import type { Table } from '../../types/table';
import { CREATE_ISSUED_DOCUMENT, CHANGE_OPERATION_TABLE, CHANGE_OPERATION_USER, TRANSFER_ITEMS, CANCEL_OPERATION_DETAIL, UPDATE_TABLE_STATUS, CANCEL_OPERATION, PRINT_PARTIAL_PRECUENTA, CREATE_PERSON } from '../../graphql/mutations';
import { GET_DOCUMENTS, GET_CASH_REGISTERS, GET_SERIALS_BY_DOCUMENT, GET_OPERATION_BY_ID, GET_FLOORS_BY_BRANCH, GET_TABLES_BY_FLOOR, GET_PERSONS_BY_BRANCH, GET_USERS_BY_BRANCH, SEARCH_PERSON_BY_DOCUMENT } from '../../graphql/queries';
import CreateClient from '../user/createClient';
import EditClient from '../user/editClient';
import { formatLocalDateYYYYMMDD, formatLocalTimeHHMMSS, formatInstantISO } from '../../utils/localDateTime';

type CashPayProps = {
  table: Table | null;
  onBack: () => void;
  onPaymentSuccess?: () => void;
  onTableChange?: (newTable: Table) => void;
};

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

/** Evita artefactos de punto flotante (ej. 9.560000000000002) en montos de pago. */
const roundMoney2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/** Coincide con PAYMENT_METHODS en backend (Django). */
const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'YAPE', label: 'Yape' },
  { value: 'PLIN', label: 'Plin' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia Bancaria' },
  { value: 'OTROS', label: 'Otros' }
];

const paymentMethodSendsReference = (method: string): boolean =>
  method === 'YAPE' || method === 'PLIN' || method === 'TRANSFER' || method === 'OTROS';

const CashPay: React.FC<CashPayProps> = ({ table, onBack, onPaymentSuccess, onTableChange }) => {
  const { companyData, user, deviceId, getMacAddress, updateTableInContext } = useAuth();
  const { hasPermission } = useUserPermissions();
  const canVoidInCashPay = hasPermission('cash.view') || hasPermission('cash.void');
  const { sendMessage, subscribe } = useWebSocket();
  const { showToast } = useToast();
  const { breakpoint } = useResponsive();

  // Solo para diferentes tamaños de pantalla de PC (desktop)
  // lg: 1024px-1279px, xl: 1280px-1535px, 2xl: >=1536px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px

  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  // Estado para múltiples pagos
  type Payment = {
    id: string;
    method: string;
    amount: number;
    referenceNumber: string;
  };
  const [payments, setPayments] = useState<Payment[]>([
    { id: '1', method: 'CASH', amount: 0, referenceNumber: '' }
  ]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const isProcessingRef = useRef(false);
  const [itemAssignments, setItemAssignments] = useState<Record<string, boolean>>({});
  const [modifiedDetails, setModifiedDetails] = useState<any[]>([]);
  const [showChangeTableModal, setShowChangeTableModal] = useState(false);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [showChangeUserModal, setShowChangeUserModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [showTransferPlatesModal, setShowTransferPlatesModal] = useState(false);
  const [selectedTransferFloorId, setSelectedTransferFloorId] = useState<string>('');
  const [selectedTransferTableId, setSelectedTransferTableId] = useState<string>('');
  const [showCancelOperationModal, setShowCancelOperationModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [detailCancellationReason, setDetailCancellationReason] = useState<string>('');
  const [pendingDeleteItem, setPendingDeleteItem] = useState<{
    detailId: string;
    originalId: string;
    isSplit: boolean;
    productLabel: string;
  } | null>(null);
  const [isRemovingItem, setIsRemovingItem] = useState(false);

  const {
    data,
    refetch
  } = useQuery(GET_OPERATION_BY_ID, {
    variables: {
      operationId: table?.currentOperationId || ''
    },
    skip: !table?.currentOperationId,
    fetchPolicy: 'network-only'
  });

  const { data: documentsData } = useQuery(GET_DOCUMENTS, {
    variables: { branchId: companyData?.branch.id || '' },
    skip: !companyData?.branch.id,
    fetchPolicy: 'no-cache'
  });

  const { data: cashRegistersData } = useQuery(GET_CASH_REGISTERS, {
    variables: { branchId: companyData?.branch.id || '' },
    skip: !companyData?.branch.id,
    fetchPolicy: 'network-only'
  });

  const { data: floorsData } = useQuery(GET_FLOORS_BY_BRANCH, {
    variables: { branchId: companyData?.branch.id || '' },
    skip: !companyData?.branch.id || !showChangeTableModal,
    fetchPolicy: 'network-only'
  });

  const { data: tablesData } = useQuery(GET_TABLES_BY_FLOOR, {
    variables: { floorId: selectedFloorId },
    skip: !selectedFloorId,
    fetchPolicy: 'network-only'
  });

  const { data: transferFloorsData } = useQuery(GET_FLOORS_BY_BRANCH, {
    variables: { branchId: companyData?.branch.id || '' },
    skip: !companyData?.branch.id || !showTransferPlatesModal,
    fetchPolicy: 'network-only'
  });

  const { data: transferTablesData } = useQuery(GET_TABLES_BY_FLOOR, {
    variables: { floorId: selectedTransferFloorId },
    skip: !selectedTransferFloorId,
    fetchPolicy: 'network-only'
  });

  const { data: clientsData, refetch: refetchClients } = useQuery(GET_PERSONS_BY_BRANCH, {
    variables: { branchId: companyData?.branch.id || '' },
    skip: !companyData?.branch.id,
    fetchPolicy: 'network-only'
  });

  const { data: usersData } = useQuery(GET_USERS_BY_BRANCH, {
    variables: { branchId: companyData?.branch.id || '' },
    skip: !companyData?.branch.id || !showChangeUserModal,
    fetchPolicy: 'network-only'
  });

  const [searchPersonByDocument, { loading: sunatSearchLoading }] = useLazyQuery(SEARCH_PERSON_BY_DOCUMENT, {
    fetchPolicy: 'network-only'
  });
  const [fetchSerialsForDocument] = useLazyQuery(GET_SERIALS_BY_DOCUMENT, { fetchPolicy: 'network-only' });
  const [createPersonMutation] = useMutation(CREATE_PERSON);
  const [createIssuedDocumentMutation] = useMutation(CREATE_ISSUED_DOCUMENT);
  const [changeOperationTableMutation] = useMutation(CHANGE_OPERATION_TABLE);
  const [changeOperationUserMutation] = useMutation(CHANGE_OPERATION_USER);
  const [transferItemsMutation] = useMutation(TRANSFER_ITEMS);
  const [cancelOperationDetailMutation] = useMutation(CANCEL_OPERATION_DETAIL);
  const [updateTableStatusMutation] = useMutation(UPDATE_TABLE_STATUS);
  const [cancelOperationMutation] = useMutation(CANCEL_OPERATION);
  const [printPartialPrecuentaMutation] = useMutation(PRINT_PARTIAL_PRECUENTA);

  const notifyTableUpdate = (tableId: string, status: string, currentOperationId?: string | number | null, occupiedById?: string | number | null, waiterName?: string | null) => {
    setTimeout(() => {
      sendMessage({
        type: 'table_status_update',
        table_id: tableId,
        status: status,
        current_operation_id: currentOperationId || null,
        occupied_by_user_id: occupiedById || null,
        waiter_name: waiterName || null
      });
      setTimeout(() => {
        sendMessage({ type: 'table_update_request' });
      }, 500);
    }, 300);
  };

  const operation = data?.operationById;

  useEffect(() => {
    const unsubscribeOperationCancelled = subscribe('operation_cancelled', (message: any) => {
      if (message.operation_id === operation?.id) refetch();
    });
    const unsubscribeOperationStatusUpdate = subscribe('operation_status_update', (message: any) => {
      if (message.operation_id === operation?.id) refetch();
    });
    return () => {
      unsubscribeOperationCancelled();
      unsubscribeOperationStatusUpdate();
    };
  }, [subscribe, operation?.id, refetch]);

  const documents = (documentsData?.documentsByBranch || []).filter((doc: any) => doc.isActive !== false);
  const allClients = (clientsData?.personsByBranch || []).filter((person: any) => !person.isSupplier && person.isActive !== false);

  const selectedClient = allClients.find((c: any) => c.id === selectedClientId);

  /** Orden: nota / otros, boleta (03), factura (01) — coincide con el flujo típico de caja. */
  const payDocumentsOrdered = useMemo(() => {
    const weight = (d: any) => (String(d.code) === '01' ? 3 : String(d.code) === '03' ? 2 : 1);
    return [...documents].sort((a, b) => weight(a) - weight(b));
  }, [documents]);

  const payDocumentButtonLabel = (doc: any) => {
    const c = String(doc.code || '').trim();
    if (c === '01') return 'Factura';
    if (c === '03') return 'Boleta';
    return doc.description || 'Documento';
  };

  const filteredClients = allClients.filter((client: any) => {
    if (!clientSearchTerm) return true;
    const search = clientSearchTerm.toLowerCase();
    const name = (client.name || '').toLowerCase();
    const documentNumber = (client.documentNumber || '').toLowerCase();
    return name.includes(search) || documentNumber.includes(search);
  }).slice(0, 50);

  const cashRegisters = cashRegistersData?.cashRegistersByBranch || [];

  const igvPercentage = Number(companyData?.branch?.igvPercentage) || 10.5;

  const getFacturedItemsFromStorage = (operationId: string): Map<string, number> => {
    try {
      const storageKey = `factured_items_${operationId}`;
      const storedData = sessionStorage.getItem(storageKey);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        const map = new Map<string, number>();
        Object.entries(parsed).forEach(([key, value]) => {
          map.set(String(key), Number(value) || 0);
        });
        return map;
      }
    } catch (error) { console.warn(error); }
    return new Map<string, number>();
  };

  const saveFacturedItemsToStorage = (operationId: string, facturedItemsMap: Map<string, number>) => {
    try {
      const storageKey = `factured_items_${operationId}`;
      const existingData = getFacturedItemsFromStorage(operationId);
      facturedItemsMap.forEach((quantity, detailId) => {
        const existingQty = existingData.get(detailId) || 0;
        existingData.set(detailId, existingQty + quantity);
      });
      const dataToStore: Record<string, number> = {};
      existingData.forEach((value, key) => { dataToStore[key] = value; });
      sessionStorage.setItem(storageKey, JSON.stringify(dataToStore));
    } catch (error) { console.warn(error); }
  };

  /** Comprobantes que ya no deben restar cantidad “facturada” (reapertura tras anulación, etc.). */
  const isIssuedItemActiveForDebt = (item: any): boolean => {
    const st = item?.issuedDocument?.billingStatus;
    if (st == null) return true;
    const excluded = new Set([
      'CANCELLED',
      'PROCESSING_CANCELLATION',
      'CANCELLATION_PENDING',
      'CANCELLATION_ERROR',
      'REJECTED',
      'ERROR'
    ]);
    return !excluded.has(String(st).toUpperCase());
  };

  const filterCanceledDetails = (details: any[], operationId?: string) => {
    if (!details || !Array.isArray(details)) return [];
    const facturedItemsMap = operationId ? getFacturedItemsFromStorage(operationId) : new Map<string, number>();
    const adjustedDetails: any[] = [];
    details.forEach((detail: any) => {
      const isCanceled = detail.isCanceled === true || detail.isCanceled === 1 || String(detail.isCanceled).toLowerCase() === "true";
      if (isCanceled) return;
      const detailId = String(detail.id);
      const originalQuantity = Number(detail.quantity) || 0;
      const paidFromStorage = facturedItemsMap.get(detailId);
      const quantityFacturedBackend = (detail.issuedItems || [])
        .filter(isIssuedItemActiveForDebt)
        .reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
      let remainingQty: number;
      if (detailId.includes('-split-')) {
        remainingQty = originalQuantity;
      } else if (paidFromStorage !== undefined) {
        remainingQty = originalQuantity - paidFromStorage;
      } else {
        remainingQty = originalQuantity - quantityFacturedBackend;
      }
      if (remainingQty <= 0) return;
      adjustedDetails.push({ ...detail, quantity: remainingQty, remainingQuantity: remainingQty });
    });
    return adjustedDetails;
  };

  const detailsToUse = modifiedDetails.length > 0 ? modifiedDetails : filterCanceledDetails(operation?.details || [], operation?.id);
  const selectedDetailIds = Object.keys(itemAssignments).filter(id => itemAssignments[id]);
  const detailsForTotal = selectedDetailIds.length > 0 ? detailsToUse.filter((detail: any) => selectedDetailIds.includes(String(detail.id))) : detailsToUse;

  const total = detailsForTotal.reduce((sum: number, detail: any) => {
    const quantity = Number(detail.quantity) || 0;
    const unitPrice = Number(detail.unitPrice) || 0;
    return sum + (quantity * unitPrice);
  }, 0);
  const discountPct = Number(discountPercent) || 0;
  const totalDiscount = Math.max(0, discountPct > 0 ? total * discountPct / 100 : (Number(discountAmount) || 0));
  const totalToPay = Math.max(0, total - totalDiscount);
  const igvDecimal = igvPercentage / 100;
  const subtotal = parseFloat((Math.round((totalToPay / (1 + igvDecimal)) * 100) / 100).toFixed(2));
  const igvAmount = parseFloat((Math.round((totalToPay - subtotal) * 100) / 100).toFixed(2));

  const addPayment = () => {
    const currentTotalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const remainingAmount = roundMoney2(Math.max(0, totalToPay - currentTotalPaid));
    setPayments([...payments, { id: String(Date.now()), method: 'CASH', amount: remainingAmount, referenceNumber: '' }]);
  };
  const removePayment = (id: string) => { if (payments.length > 1) setPayments(payments.filter(p => p.id !== id)); };
  const updatePayment = (id: string, field: keyof Payment, value: string | number) => {
    setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
  };
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = totalToPay - totalPaid;
  const vuelto = remaining < 0 ? Math.abs(remaining) : 0;

  useEffect(() => {
    if (payments.length === 1 && payments[0].amount === 0) setPayments([{ ...payments[0], amount: roundMoney2(totalToPay) }]);
  }, [totalToPay, operation?.id]);

  useEffect(() => {
    if (payments.length === 0) return;
    setPayments(prev =>
      prev.map((p, i) =>
        i === 0 ? { ...p, amount: roundMoney2(totalToPay) } : { ...p, amount: 0 }
      )
    );
  }, [totalToPay]);

  useEffect(() => {
    setDiscountAmount(0); setDiscountPercent(0);
  }, [operation?.id]);

  useEffect(() => {
    if (cashRegisters.length > 0 && !selectedCashRegisterId) setSelectedCashRegisterId(cashRegisters[0].id);
  }, [cashRegisters, selectedCashRegisterId]);

  const handleSearchSunat = async () => {
    const term = (clientSearchTerm || '').trim().replace(/\s/g, '');
    if (!/^\d+$/.test(term) || !companyData?.branch?.id) return;
    const documentType = term.length === 11 ? 'RUC' : 'DNI';
    try {
      const { data } = await searchPersonByDocument({ variables: { documentType, documentNumber: term, branchId: companyData.branch.id } });
      const result = data?.searchPersonByDocument;
      if (!result?.person) { showToast('No se encontró el documento.', 'error'); return; }
      const person = result.person;
      if (person.id && result.foundLocally) {
        setSelectedClientId(person.id); setClientSearchTerm(person.name || '');
        return;
      }
      const { data: createData } = await createPersonMutation({
        variables: {
          branchId: companyData.branch.id, documentType: person.documentType || documentType, documentNumber: person.documentNumber || term,
          name: person.name || 'Cliente', isCustomer: true, isSupplier: false
        }
      });
      if (createData?.createPerson?.success) {
        const newPerson = createData.createPerson.person;
        setSelectedClientId(newPerson.id); setClientSearchTerm(newPerson.name || '');
        await refetchClients();
      }
    } catch (err: any) { showToast(err?.message, 'error'); }
  };

  useEffect(() => {
    if (operation?.details && operation?.id) {
      const nonCanceledDetails = filterCanceledDetails(operation.details, operation.id);
      setModifiedDetails([...nonCanceledDetails]);
      if (Object.keys(itemAssignments).length === 0) {
        const initialAssignments: Record<string, boolean> = {};
        nonCanceledDetails.forEach((detail: any) => { if (detail.id) initialAssignments[String(detail.id)] = true; });
        setItemAssignments(initialAssignments);
      }
    }
  }, [operation?.details, operation?.id]);

  useEffect(() => {
    if (table?.id) {
      setTimeout(() => { refetch(); }, 500);
      setItemAssignments({}); setModifiedDetails([]);
    }
  }, [table?.id]);

  const handleSplitItem = (detailId: string) => {
    const idx = modifiedDetails.findIndex((d: any) => String(d.id) === String(detailId));
    if (idx === -1) return;
    const d = modifiedDetails[idx];
    const q = Number(d.quantity) || 0;
    if (q <= 1) {
      showToast('No se puede dividir: la cantidad debe ser mayor a 1.', 'warning');
      return;
    }
    const splitDetailId = `${detailId}-split-${Date.now()}`;
    const productLabel = d.productName || 'Producto';
    showToast(`Se separó 1 unidad de "${productLabel}" para cobrar aparte.`, 'info');
    setModifiedDetails(prev => {
      const i = prev.findIndex((row: any) => String(row.id) === String(detailId));
      if (i === -1) return prev;
      const row = prev[i];
      const qty = Number(row.quantity) || 0;
      if (qty <= 1) return prev;
      const next = [...prev];
      next[i] = { ...row, quantity: qty - 1, remainingQuantity: qty - 1 };
      next.splice(i + 1, 0, { ...row, id: splitDetailId, originalDetailId: detailId, quantity: 1, remainingQuantity: 1 });
      setItemAssignments(p => ({ ...p, [detailId]: true, [splitDetailId]: true }));
      return next;
    });
  };

  const handleMergeItem = (splitDetailId: string) => {
    const originalId = splitDetailId.split('-split')[0];
    setModifiedDetails(prev => {
      const sIdx = prev.findIndex((d: any) => String(d.id) === String(splitDetailId));
      const oIdx = prev.findIndex((d: any) => String(d.id) === String(originalId));
      if (sIdx === -1 || oIdx === -1) return prev;
      const next = [...prev];
      const sD = next[sIdx];
      const oD = next[oIdx];
      next[oIdx] = { ...oD, quantity: (Number(oD.quantity) || 0) + (Number(sD.quantity) || 0) };
      next.splice(sIdx, 1);
      return next;
    });
  };

  const handleToggleItemSelection = (id: string) => {
    setItemAssignments(p => { const n = { ...p }; if (n[id]) delete n[id]; else n[id] = true; return n; });
  };

  const handleDeleteItem = (detailId: string) => {
    if (!canVoidInCashPay) {
      showToast('No tienes permiso para quitar ítems de la orden en caja.', 'error');
      return;
    }
    const isSplit = detailId?.includes('-split');
    const originalId = isSplit ? detailId.split('-split')[0] : detailId;
    const row = detailsToUse.find((d: any) => String(d.id) === String(detailId));
    const productLabel = row?.productName || 'este producto';
    setDetailCancellationReason('');
    setPendingDeleteItem({ detailId, originalId, isSplit, productLabel });
  };

  const handleConfirmRemoveItem = async () => {
    if (!pendingDeleteItem || !user?.id) return;
    if (!detailCancellationReason.trim()) {
      showToast('Indica el motivo por el que quitas este ítem.', 'error');
      return;
    }
    const { originalId, isSplit } = pendingDeleteItem;
    setIsRemovingItem(true);
    try {
      const mac = await getMacAddress();
      const res = await cancelOperationDetailMutation({
        variables: {
          detailId: originalId,
          quantity: isSplit ? 1 : undefined,
          userId: user.id,
          deviceId: mac,
          cancellationReason: detailCancellationReason.trim()
        }
      });
      if (res.data?.cancelOperationDetail?.success) {
        showToast(isSplit ? 'Se quitó 1 unidad del pedido.' : 'Plato quitado del pedido.', 'success');
        setDetailCancellationReason('');
        setPendingDeleteItem(null);
        await refetch();
        if (onPaymentSuccess) onPaymentSuccess();
      } else {
        showToast(res.data?.cancelOperationDetail?.message || 'No se pudo quitar el ítem.', 'error');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'Error al quitar el ítem.', 'error');
    } finally {
      setIsRemovingItem(false);
    }
  };

  const closeDeleteItemModal = () => {
    if (!isRemovingItem) {
      setDetailCancellationReason('');
      setPendingDeleteItem(null);
    }
  };

  const getDeviceIdOrMac = async (): Promise<string> => {
    console.log('🔍 [PAGO] Obteniendo identificador para impresión...');
    try {
      // Siempre intentar obtener la MAC primero - es el valor requerido
      const macAddress = await getMacAddress();
      if (macAddress && macAddress.trim() !== '') {
        console.log('✅ [PAGO] USANDO MAC ADDRESS:', macAddress);
        return macAddress;
      } else {
        console.warn('⚠️ [PAGO] MAC address obtenida pero está vacía, pasando a deviceId');
      }
    } catch (error) {
      console.error('❌ [PAGO] Error al obtener MAC address:', error);
      console.log('⚠️ [PAGO] Pasando a usar deviceId como fallback');
    }

    // Fallback: usar deviceId del contexto para permitir el pago (impresión puede no funcionar)
    if (deviceId && String(deviceId).trim() !== '') {
      console.log('⚠️ [PAGO] USANDO DEVICE ID (fallback - no es MAC):', deviceId);
      return String(deviceId);
    }
    console.error('❌ [PAGO] No se pudo obtener MAC ni deviceId. Se usará UNKNOWN (impresión puede fallar)');
    return 'UNKNOWN';
  };
  // ============================================================================
  // FUNCIÓN AUXILIAR: Obtener ID real del detalle (agregar ANTES de handleProcessPayment)
  // ============================================================================
  const getRealOperationDetailId = (detail: any): string | null => {
    console.log('🔍 getRealOperationDetailId:', detail.id, detail.productName);

    let realId: string | null = null;

    // PRIORIDAD 1: Si tiene originalDetailId, usar ese
    if (detail.originalDetailId) {
      realId = String(detail.originalDetailId);
      console.log(`  ✅ Usando originalDetailId: ${realId}`);
    }
    // PRIORIDAD 2: Si el ID contiene '-split-', extraer la parte antes
    else if (String(detail.id).includes('-split-')) {
      realId = String(detail.id).split('-split-')[0];
      console.log(`  ✅ Extrayendo de ID dividido: ${realId}`);
    }
    // PRIORIDAD 3: Usar el ID tal cual
    else {
      realId = String(detail.id);
      console.log(`  ✅ Usando ID directo: ${realId}`);
    }

    // Validar que sea numérico
    if (realId && !/^\d+$/.test(realId)) {
      console.error(`  ❌ ERROR: ID no numérico: "${realId}"`);
      return null;
    }

    return realId;
  };

  const handleProcessPayment = async (documentId: string) => {
    // ⚠️ PROTECCIÓN CONTRA DOBLE CLIC - Verificar ref primero (más confiable que estado)
    if (isProcessingRef.current) {
      console.warn('⚠️ Pago ya en proceso (ref check), ignorando solicitud duplicada');
      return;
    }

    // ⚠️ PROTECCIÓN CONTRA DOBLE CLIC - Verificar también estado
    if (isProcessing) {
      console.warn('⚠️ Pago ya en proceso (state check), ignorando solicitud duplicada');
      return;
    }

    if (!operation || !documentId || !user?.id) {
      showToast('No se puede procesar el pago', 'error');
      return;
    }

    const docForPay = documents.find((doc: any) => String(doc.id) === String(documentId));
    if (!docForPay) {
      showToast('Tipo de documento no válido', 'error');
      return;
    }

    const isFacturaDoc = String(docForPay.code) === '01';

    // ✅ VALIDACIONES SUNAT: Factura requiere cliente con RUC
    if (isFacturaDoc) {
      if (!selectedClientId) {
        showToast('Para emitir una FACTURA debe seleccionar un cliente con RUC', 'error');
        return;
      }
      if ((selectedClient?.documentType || '').toUpperCase() !== 'RUC') {
        showToast('Para emitir una FACTURA el cliente debe tener un RUC válido', 'error');
        return;
      }
    }

    // Si no hay caja seleccionada, usar la primera disponible
    const cashRegisterIdToUse = selectedCashRegisterId || (cashRegisters.length > 0 ? cashRegisters[0].id : null);

    if (!cashRegisterIdToUse) {
      showToast('No hay cajas registradoras disponibles', 'error');
      return;
    }

    let serial: string;
    try {
      const { data: serialsFetched } = await fetchSerialsForDocument({ variables: { documentId } });
      const serialList = (serialsFetched?.serialsByDocument || []).filter((ser: any) => ser.isActive !== false);
      if (serialList.length === 0) {
        showToast('No hay serie activa para este documento', 'error');
        return;
      }
      serial = serialList[0].serial || '';
    } catch {
      showToast('No se pudieron cargar las series del documento', 'error');
      return;
    }

    // ⚠️ ESTABLECER flags INMEDIATAMENTE para prevenir doble ejecución
    isProcessingRef.current = true; // Ref se actualiza síncronamente
    setIsProcessing(true); // Estado puede tener delay

    // Obtener MAC address (prioritaria para impresión) o deviceId como fallback
    const resolvedDeviceId = await getDeviceIdOrMac();
    const isMacAddress = resolvedDeviceId.includes(':');
    console.log('📋 [PAGO] Identificador final para backend:', resolvedDeviceId, isMacAddress ? '(es MAC ✓)' : '(NO es MAC - deviceId)');

    // Verificar que sea una MAC válida (formato XX:XX:XX:XX:XX:XX o similar)
    if (!isMacAddress) {
      console.warn('⚠️ [PAGO] El valor no parece ser una MAC address válida. La impresión puede no funcionar.');
    }

    try {
      const now = new Date();
      const emissionDate = formatLocalDateYYYYMMDD(now);
      const emissionTime = formatLocalTimeHHMMSS(now);

      // Preparar items del documento usando los detalles modificados (evitar doble resta si ya están en modifiedDetails)
      const availableDetails = modifiedDetails.length > 0 ? modifiedDetails : filterCanceledDetails(operation.details || [], operation?.id);

      // Obtener los IDs de los productos seleccionados (checkboxes marcados)
      const selectedDetailIds = Object.keys(itemAssignments).filter(id => itemAssignments[id]);

      // Si hay productos seleccionados, filtrar solo esos
      let detailsToPay = availableDetails;
      if (selectedDetailIds.length > 0) {
        detailsToPay = availableDetails.filter((detail: any) => {
          // Verificar si el detail.id está en los seleccionados
          return selectedDetailIds.includes(String(detail.id));
        });

        if (detailsToPay.length === 0) {
          showToast('No hay productos seleccionados para pagar', 'error');
          setIsProcessing(false);
          return;
        }
      }

      // ✅ VERIFICAR SI ES PAGO PARCIAL O COMPLETO
      // Si se están pagando TODOS los productos disponibles, usar la operación existente
      // Si se están pagando SOLO ALGUNOS productos, también usar la operación existente (NO crear nueva)
      // El backend se encargará de manejar el pago parcial correctamente
      const isPartialPayment = selectedDetailIds.length > 0 && selectedDetailIds.length < availableDetails.length;

      // ✅ SIEMPRE usar la operación existente - NO crear nuevas operaciones
      // El backend maneja los pagos parciales a nivel de documento emitido
      const operationToPay = operation;

      // Preparar items para el documento usando los detalles seleccionados
      // Agrupar detalles por ID original (sin el sufijo -split si existe)
      // let items: any[] = [];
      // ==================================================
      // 🔑 PARTE CRÍTICA: AGRUPAR POR ID REAL
      // ==================================================
      const groupedByRealId: Record<string, { details: any[]; totalQuantity: number }> = {};
      const invalidDetails: any[] = [];

      detailsToPay.forEach((detail: any) => {
        console.log(`\n📦 Procesando: ${detail.productName}`);

        // ✅ OBTENER ID REAL VALIDADO
        const realId = getRealOperationDetailId(detail);

        if (!realId) {
          console.error(`  ❌ No se pudo obtener ID real`);
          invalidDetails.push(detail);
          return;
        }

        if (!groupedByRealId[realId]) {
          groupedByRealId[realId] = {
            details: [],
            totalQuantity: 0
          };
        }

        groupedByRealId[realId].details.push(detail);
        groupedByRealId[realId].totalQuantity += Number(detail.quantity) || 0;

        console.log(`  ✅ Agregado al grupo ${realId} (qty total: ${groupedByRealId[realId].totalQuantity})`);
      });

      // Validar que no haya items inválidos
      if (invalidDetails.length > 0) {
        console.error('❌ ITEMS INVÁLIDOS:', invalidDetails.map(d => d.id));
        showToast('Error: No se pudieron validar todos los productos.', 'error');
        isProcessingRef.current = false;
        setIsProcessing(false);
        return;
      }

      // ==================================================
      // 🔑 CREAR ITEMS CON IDs REALES
      // ==================================================
      const items = Object.entries(groupedByRealId).map(([realId, group]) => {
        const firstDetail = group.details[0];

        return {
          operationDetailId: realId,  // ✅ USAR ID REAL, NO EL ID DIVIDIDO
          quantity: group.totalQuantity,
          unitValue: Number(firstDetail.unitPrice) || 0,
          unitPrice: Number(firstDetail.unitPrice) || 0,
          discount: 0,
          notes: firstDetail.notes || ''
        };
      });

      console.log('✅ Items a enviar:', items);

      // Calcular totales para el pago (con descuento aplicado)
      // NOTA: Los precios unitarios ya incluyen IGV
      const rawPaymentTotal = detailsToPay.reduce((sum: number, detail: any) => {
        const quantity = Number(detail.quantity) || 0;
        const unitPrice = Number(detail.unitPrice) || 0;
        return sum + (quantity * unitPrice);
      }, 0);
      const payPct = Number(discountPercent) || 0;
      const paymentTotalDiscount = Math.max(0, payPct > 0 ? rawPaymentTotal * payPct / 100 : (Number(discountAmount) || 0));
      const paymentTotal = Math.max(0, rawPaymentTotal - paymentTotalDiscount);
      const igvDecimal = igvPercentage / 100;
      const paymentSubtotal = parseFloat((Math.round((paymentTotal / (1 + igvDecimal)) * 100) / 100).toFixed(2));
      const paymentIgvAmount = parseFloat((Math.round((paymentTotal - paymentSubtotal) * 100) / 100).toFixed(2));

      // Validar que la suma de pagos sea al menos el total a pagar (permite pagar de más y dar vuelto; total 0 no exige montos > 0)
      const totalPaymentsAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      if (paymentTotal > 0.01 && totalPaymentsAmount < paymentTotal - 0.01) {
        showToast(`La suma de los pagos (${currencyFormatter.format(totalPaymentsAmount)}) debe ser al menos el total a pagar (${currencyFormatter.format(paymentTotal)})`, 'error');
        isProcessingRef.current = false;
        setIsProcessing(false);
        return;
      }

      // Preparar pagos para enviar al backend: siempre enviar exactamente el monto del documento (paymentTotal)
      // Si el cliente pagó de más, el vuelto se da en caja y no se registra en el backend
      let paymentsToSend: Array<{
        cashRegisterId: string;
        paymentType: string;
        paymentMethod: string;
        transactionType: string;
        totalAmount: number;
        paidAmount: number;
        paymentDate: string;
        dueDate: null;
        referenceNumber: string | null;
        notes: null;
      }>;
      if (paymentTotal <= 0.01) {
        paymentsToSend = [{
          cashRegisterId: cashRegisterIdToUse,
          paymentType: 'CASH',
          paymentMethod: payments[0]?.method || 'CASH',
          transactionType: 'INCOME',
          totalAmount: 0,
          paidAmount: 0,
          paymentDate: formatInstantISO(now),
          dueDate: null,
          referenceNumber: null,
          notes: null
        }];
      } else if (Math.abs(totalPaymentsAmount - paymentTotal) <= 0.01) {
        // Monto exacto: usar los pagos tal cual
        paymentsToSend = payments
          .filter(p => Number(p.amount) > 0)
          .map(p => ({
            cashRegisterId: cashRegisterIdToUse,
            paymentType: 'CASH',
            paymentMethod: p.method,
            transactionType: 'INCOME',
            totalAmount: Number(p.amount),
            paidAmount: Number(p.amount),
            paymentDate: formatInstantISO(now),
            dueDate: null,
            referenceNumber: paymentMethodSendsReference(p.method) ? (p.referenceNumber || null) : null,
            notes: null
          }));
      } else {
        // Cliente pagó de más (habrá vuelto): enviar un solo pago por el monto del documento
        const firstPayment = payments.find(p => Number(p.amount) > 0);
        paymentsToSend = [{
          cashRegisterId: cashRegisterIdToUse,
          paymentType: 'CASH',
          paymentMethod: firstPayment?.method || 'CASH',
          transactionType: 'INCOME',
          totalAmount: paymentTotal,
          paidAmount: paymentTotal,
          paymentDate: formatInstantISO(now),
          dueDate: null,
          referenceNumber: null,
          notes: null
        }];
      }

      if (paymentsToSend.length === 0) {
        showToast('Debe agregar al menos un pago con monto mayor a 0', 'error');
        isProcessingRef.current = false;
        setIsProcessing(false);
        return;
      }

      // Para pagos parciales: NO pasar table_id si hay productos restantes
      // Esto evita que el backend libere la mesa cuando todavía hay productos por pagar
      // Solo pasamos tableId si se está pagando toda la operación (no hay productos restantes)
      const hasRemainingProducts = isPartialPayment;
      const tableIdForPayment = hasRemainingProducts ? null : (table?.id || null);

      const variables = {
        operationId: operationToPay.id,
        branchId: companyData?.branch.id,
        documentId: documentId,
        serial: serial,
        personId: selectedClientId || null,
        userId: user.id,
        emissionDate: emissionDate,
        emissionTime: emissionTime,
        currency: 'PEN',
        exchangeRate: 1.0,
        itemsTotalDiscount: 0.0,
        globalDiscount: paymentTotalDiscount,
        globalDiscountPercent: Number(discountPercent) || 0,
        totalDiscount: paymentTotalDiscount,
        globalDiscountOnTotal: paymentTotalDiscount,
        igvPercent: igvPercentage,
        igvAmount: paymentIgvAmount,
        totalTaxable: paymentSubtotal,
        totalUnaffected: 0.0,
        totalExempt: 0.0,
        totalFree: 0.0,
        totalAmount: paymentTotal,
        items: items,
        payments: paymentsToSend,
        notes: null,
        tableId: tableIdForPayment,
        deviceId: resolvedDeviceId,
        printerId: null // Opcional: se puede agregar selección de impresora si es necesario
      };

      // 🧪 LOG COMPLETO ANTES DEL PAGO - ESPECIALMENTE PARA PAGOS PARCIALES
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`💰 ${isPartialPayment ? 'PAGO PARCIAL' : 'PAGO COMPLETO'}`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📋 INFORMACIÓN DE LA OPERACIÓN:');
      console.log(`   - ID de Operación: ${operationToPay.id}`);
      console.log(`   - Tipo de pago: ${isPartialPayment ? 'PARCIAL' : 'COMPLETO'}`);
      console.log(`   - Mesa ID: ${table?.id || 'N/A'}`);
      console.log(`   - TableId para pago: ${tableIdForPayment || 'null (no liberar mesa)'}`);
      console.log('');
      console.log('📄 INFORMACIÓN DEL DOCUMENTO:');
      // ✅ Obtener información completa del documento seleccionado
      const selectedDocument = documents.find((doc: any) => String(doc.id) === String(documentId));
      const documentCode = selectedDocument?.code || 'N/A';
      const documentDescription = selectedDocument?.description || 'N/A';
      const isBillableDocument = documentCode === '01' || documentCode === '03'; // FACTURA o BOLETA
      console.log(`   - ID de Documento: ${documentId}`);
      console.log(`   - Código de Documento: ${documentCode} (${documentDescription})`);
      console.log(`   - Es documento facturable (01/FACTURA o 03/BOLETA): ${isBillableDocument ? 'SÍ ✅' : 'NO ⚠️'}`);
      console.log(`   - Facturación habilitada en sucursal: ${companyData?.branch?.isBilling ? 'SÍ ✅' : 'NO ⚠️'}`);
      if (isBillableDocument && companyData?.branch?.isBilling) {
        console.log(`   ✅ Este documento será enviado a SUNAT automáticamente`);
      } else {
        if (!isBillableDocument) {
          console.log(`   ⚠️ Documento con código '${documentCode}' NO se enviará a SUNAT (solo se envían 01/FACTURA y 03/BOLETA)`);
        }
        if (!companyData?.branch?.isBilling) {
          console.log(`   ⚠️ Facturación electrónica deshabilitada en esta sucursal`);
        }
      }
      console.log(`   - Serie: ${serial}`);
      console.log(`   - ID de Sucursal: ${companyData?.branch.id}`);
      console.log(`   - ID de Usuario: ${user.id}`);
      console.log(`   - Fecha de Emisión: ${emissionDate}`);
      console.log(`   - Hora de Emisión: ${emissionTime}`);
      console.log('');
      console.log('📊 CÁLCULOS Y TOTALES:');
      console.log(`   - Porcentaje de IGV: ${igvPercentage}%`);
      console.log(`   - Subtotal: ${currencyFormatter.format(paymentSubtotal)}`);
      console.log(`   - Monto de IGV: ${currencyFormatter.format(paymentIgvAmount)}`);
      console.log(`   - Monto Total: ${currencyFormatter.format(paymentTotal)}`);
      console.log('');
      console.log('📦 ITEMS A PAGAR:');
      console.log(`   - Cantidad de items: ${items.length}`);
      items.forEach((item, index) => {
        console.log(`   ${index + 1}. ID de Detalle de Operación: ${item.operationDetailId}`);
        console.log(`      - Cantidad: ${item.quantity}`);
        console.log(`      - Valor Unitario: ${currencyFormatter.format(item.unitValue)}`);
        console.log(`      - Precio Unitario: ${currencyFormatter.format(item.unitPrice)}`);
        console.log(`      - Subtotal del Item: ${currencyFormatter.format(item.quantity * item.unitPrice)}`);
        if (item.notes) {
          console.log(`      - Notas: ${item.notes}`);
        }
      });
      console.log('');
      console.log('💳 INFORMACIÓN DE PAGO:');
      paymentsToSend.forEach((payment, index) => {
        console.log(`   Pago ${index + 1}:`);
        console.log(`      - ID de Caja Registradora: ${payment.cashRegisterId}`);
        console.log(`      - Tipo de Pago: ${payment.paymentType}`);
        console.log(`      - Método de Pago: ${payment.paymentMethod}`);
        console.log(`      - Tipo de Transacción: ${payment.transactionType}`);
        console.log(`      - Monto Total: ${currencyFormatter.format(payment.totalAmount)}`);
        console.log(`      - Monto Pagado: ${currencyFormatter.format(payment.paidAmount)}`);
        if (payment.referenceNumber) {
          console.log(`      - Número de Referencia: ${payment.referenceNumber}`);
        }
      });
      console.log('');
      console.log('🖨️ IMPRESIÓN:');
      console.log(`   - ID del Dispositivo: ${resolvedDeviceId || 'No disponible'}`);
      console.log(`   - ID de Impresora: No especificado`);
      console.log('');
      if (isPartialPayment) {
        console.log('⚠️ PAGO PARCIAL DETECTADO:');
        console.log(`   - Productos seleccionados para pagar: ${selectedDetailIds.length}`);
        console.log(`   - Productos totales disponibles: ${availableDetails.length}`);
        console.log(`   - Productos que quedan por pagar: ${availableDetails.length - selectedDetailIds.length}`);
        console.log(`   - TableId será null (mesa NO se liberará)`);
      }
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📤 Enviando mutación CREATE_ISSUED_DOCUMENT...');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');

      // ⚠️ VERIFICACIÓN FINAL: Usar ref en lugar de estado (más confiable - actualización síncrona)
      if (!isProcessingRef.current) {
        console.warn('⚠️ isProcessingRef cambiado, abortando pago');
        // Ya se reseteó, solo asegurar estado
        setIsProcessing(false);
        return;
      }

      // ⚠️ GUARDAR información de items facturados ANTES de enviar (para usar después del refetch)
      // Esto nos permite calcular remainingQuantity localmente si el backend no lo devuelve
      const facturedItemsMap = new Map<string, number>(); // operationDetailId (string) -> cantidad facturada
      items.forEach((item: any) => {
        const detailId = String(item.operationDetailId); // Asegurar que sea string
        const qty = Number(item.quantity) || 0;
        const existingQty = facturedItemsMap.get(detailId) || 0;
        facturedItemsMap.set(detailId, existingQty + qty);
      });

      console.log('✅ Enviando mutación al backend...');
      console.log('   - Items facturados (para cálculo local):', Array.from(facturedItemsMap.entries()).map(([id, qty]) => `ID:${id}=${qty}`));

      const result = await createIssuedDocumentMutation({
        variables
      });

      if (result.data?.createIssuedDocument?.success) {
        // El documento (boleta/factura) se ha creado exitosamente
        // El backend debería haber impreso el documento si deviceId estaba disponible

        // ✅ VERIFICAR SI EL DOCUMENTO SERÁ ENVIADO A SUNAT
        const selectedDocumentOk = documents.find((doc: any) => String(doc.id) === String(documentId));
        const documentCode = selectedDocumentOk?.code || '';
        const documentDescription = selectedDocumentOk?.description || '';
        const isBillableDocument = documentCode === '01' || documentCode === '03'; // FACTURA o BOLETA
        const isBranchBillingEnabled = companyData?.branch?.isBilling || false;

        if (isBillableDocument && isBranchBillingEnabled) {
          console.log('✅ SUNAT: El documento será enviado a facturación electrónica');
          console.log(`  - Tipo: ${documentDescription} (Código: ${documentCode})`);
          console.log(`  - Serial: ${result.data?.createIssuedDocument?.issuedDocument?.serial || 'N/A'}`);
          console.log(`  - Número: ${result.data?.createIssuedDocument?.issuedDocument?.number || 'N/A'}`);
          console.log(`  - Proceso: ${isPartialPayment ? 'PAGO PARCIAL' : 'PAGO COMPLETO'}`);
        } else {
          if (!isBillableDocument) {
            console.log(`ℹ️ SUNAT: Documento "${documentDescription}" (Código: ${documentCode}) no se enviará a SUNAT`);
            console.log('   - Solo se envían FACTURAS (01) y BOLETAS (03)');
          }
          if (!isBranchBillingEnabled) {
            console.log('ℹ️ SUNAT: La sucursal no tiene facturación electrónica habilitada');
          }
        }

        // ✅ GUARDAR información de facturación en sessionStorage para pago parcial
        if (isPartialPayment && operation?.id) {
          saveFacturedItemsToStorage(operation.id, facturedItemsMap);
        } else if (!isPartialPayment && operation?.id) {
          // Si es pago total, limpiar la memoria de esta operación
          sessionStorage.removeItem(`factured_items_${operation.id}`);
        }

        // Refetch para obtener la operación actualizada
        // Usar fetchPolicy: 'network-only' para forzar la actualización
        const refetchResult = await refetch({
          fetchPolicy: 'network-only'
        });

        // Limpiar selecciones y descuento después del pago
        setItemAssignments({});
        setDiscountAmount(0);
        setDiscountPercent(0);

        if (isPartialPayment && refetchResult.data?.operationById) {
          // ✅ Después de un pago parcial exitoso y refetch, limpiamos la memoria local 
          // para que el sistema use la cantidad que devuelva el servidor (la verdad de la BD)
          const opId = refetchResult.data.operationById.id;
          sessionStorage.removeItem(`factured_items_${opId}`);

          // Actualizar detalles manualmente con los datos frescos del backend
          const freshDetails = filterCanceledDetails(
            refetchResult.data.operationById.details,
            refetchResult.data.operationById.id
          );
          setModifiedDetails(freshDetails);

          // Calcular el nuevo total restante
          const newTotal = freshDetails.reduce((sum: number, detail: any) => {
            const quantity = Number(detail.quantity) || 0;
            const unitPrice = Number(detail.unitPrice) || 0;
            return sum + (quantity * unitPrice);
          }, 0);

          // Actualizar el monto del pago para reflejar lo que falta pagar
          setPayments([{
            id: String(Date.now()),
            method: 'CASH',
            amount: roundMoney2(newTotal),
            referenceNumber: ''
          }]);

          console.log('✅ Pago parcial completado - Detalles actualizados desde el backend:', freshDetails.length);
          console.log('💰 Monto actualizado para el siguiente pago:', newTotal);
        } else {
          // Pago completo (toda la operación): liberar mesa en UI y volver al piso
          const wasTableFreed = result.data?.createIssuedDocument?.wasTableFreed;
          const refetchedOperation = refetchResult.data?.operationById;

          // Si el backend indicó que liberó la mesa, usar su respuesta para estado/colores
          if (tableIdForPayment && table?.id && updateTableInContext) {
            updateTableInContext({
              id: table.id,
              status: 'AVAILABLE',
              statusColors: null,
              currentOperationId: null,
              occupiedById: null,
              userName: null
            });
            notifyTableUpdate(table.id, 'AVAILABLE', null, null, null);
            console.log('✅ Mesa liberada (pago completo con tableId) - mesa:', table.id);
          }
          // Siempre que fue pago completo (enviamos tableId), marcar mesa como libre en la UI
          // (el backend a veces no retorna wasTableFreed p. ej. cuando hay descuento y is_fully_paid() es false)
          else if (wasTableFreed && result.data?.createIssuedDocument?.table && table?.id && updateTableInContext) {
            const freedTable = result.data.createIssuedDocument.table;
            updateTableInContext({
              id: table.id,
              status: freedTable.status || 'AVAILABLE',
              statusColors: freedTable.statusColors || null,
              currentOperationId: null,
              occupiedById: null,
              userName: null
            });
            notifyTableUpdate(table.id, freedTable.status || 'AVAILABLE', null, null, null);
            console.log('✅ Mesa liberada (wasTableFreed del backend) - mesa:', table.id);
          }
          // Operación ya no existe: asegurar mesa libre
          else if (!refetchedOperation && table?.id && updateTableInContext) {
            updateTableInContext({
              id: table.id,
              status: 'AVAILABLE',
              statusColors: null,
              currentOperationId: null,
              occupiedById: null,
              userName: null
            });
            notifyTableUpdate(table.id, 'AVAILABLE', null, null, null);
            console.log('✅ Mesa liberada - operación ya no existe para mesa:', table.id);
          }

          if (onPaymentSuccess) onPaymentSuccess();
          setTimeout(() => onBack(), 1500);
        }

        // Llamar callback de éxito si existe
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }

        // Limpiar errores
      } else {
        showToast(result.data?.createIssuedDocument?.message || 'Error al procesar el pago', 'error');
      }
    } catch (err: any) {
      console.error('❌ ERROR:', err);
      console.error('Error procesando pago:', err);
      showToast(err.message || 'Error al procesar el pago', 'error');
    } finally {
      // ⚠️ Siempre resetear ambos flags al finalizar
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handlePrecuenta = async () => {
    if (!operation || !table?.id || !companyData?.branch.id || !user?.id) { showToast('No hay orden', 'error'); return; }
    if (operation.status === 'COMPLETED') { showToast('Orden completada', 'error'); return; }
    setIsProcessing(true);
    try {
      const mac = await getMacAddress();
      if (!mac) { showToast('Error MAC', 'error'); return; }
      const selectedDetailIds = Object.keys(itemAssignments).filter(id => itemAssignments[id]);
      if (selectedDetailIds.length === 0) { showToast('Selecciona ítems para precuenta', 'error'); return; }
      const res = await printPartialPrecuentaMutation({
        variables: { operationId: operation.id, detailIds: selectedDetailIds, tableId: table.id, branchId: companyData.branch.id, userId: user.id, deviceId: mac, printerId: null }
      });
      if (res.data?.printPartialPrecuenta?.success) {
        const t = res.data.printPartialPrecuenta.table || table;
        try { await updateTableStatusMutation({ variables: { tableId: table.id, status: 'TO_PAY', userId: user.id } }); } catch (e) {}
        updateTableInContext?.({ id: t.id, status: 'TO_PAY', currentOperationId: t.currentOperationId, occupiedById: t.occupiedById, userName: t.userName });
        notifyTableUpdate(t.id, 'TO_PAY', t.currentOperationId, t.occupiedById, t.userName);
        if (onTableChange) onTableChange({ ...table, status: 'TO_PAY' });
        await refetch();
        if (onPaymentSuccess) onPaymentSuccess();
        showToast('Precuenta enviada exitosamente', 'success');
      } else showToast(res.data?.printPartialPrecuenta?.message || 'Error al enviar precuenta', 'error');
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setIsProcessing(false); }
  };

  const handleCancelOperation = async () => {
    if (!canVoidInCashPay) {
      showToast('No tienes permiso para anular la orden en caja.', 'error');
      return;
    }
    if (!cancellationReason.trim()) {
      showToast('Indica el motivo de la anulación.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const mac = await getMacAddress();
      const res = await cancelOperationMutation({
        variables: {
          operationId: operation?.id,
          branchId: companyData?.branch.id,
          userId: user?.id,
          cancellationReason: cancellationReason.trim(),
          deviceId: mac
        }
      });
      if (res.data?.cancelOperation?.success) {
        setCancellationReason('');
        setShowCancelOperationModal(false);
        updateTableInContext?.({ id: table?.id || '', status: 'AVAILABLE', currentOperationId: null, occupiedById: null, userName: null });
        onBack();
      }
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setIsProcessing(false); }
  };

  const handleTransferPlates = async () => {
    if (!selectedTransferTableId) { showToast('Selecciona mesa destino', 'error'); return; }
    setIsProcessing(true);
    try {
      const res = await transferItemsMutation({
        variables: { fromOperationId: operation?.id, toTableId: selectedTransferTableId, detailIds: selectedDetailIds, branchId: companyData?.branch.id }
      });
      if (res.data?.transferItems?.success) { await refetch(); setShowTransferPlatesModal(false); }
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setIsProcessing(false); }
  };

  const handleChangeTable = async () => {
    setIsProcessing(true);
    try {
      const res = await changeOperationTableMutation({ variables: { operationId: operation?.id, newTableId: selectedTableId, branchId: companyData?.branch.id } });
      if (res.data?.changeOperationTable?.success) onBack();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setIsProcessing(false); }
  };

  const handleChangeUser = async () => {
    setIsProcessing(true);
    try {
      const res = await changeOperationUserMutation({ variables: { operationId: operation?.id, newUserId: selectedUserId, branchId: companyData?.branch.id } });
      if (res.data?.changeOperationUser?.success) { await refetch(); setShowChangeUserModal(false); }
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setIsProcessing(false); }
  };

  // Obtener lista de mozos disponibles: del servidor cuando el modal está abierto (evita caché al agregar empleados)
  const serverUsers = (usersData?.usersByBranch || []).filter((u: any) => u.isActive !== false);
  const contextUsers = (companyData?.branch?.users || []).filter((u: any) => u.isActive !== false);
  const availableUsers = showChangeUserModal ? (serverUsers.length > 0 ? serverUsers : contextUsers) : contextUsers;

  const resolvedFloorName = useMemo(() => {
    if (!table) return null;
    if (table.floorName) return table.floorName;
    const floors = companyData?.branch?.floors;
    if (!floors?.length) return null;
    for (const f of floors) {
      if (f.tables?.some((t: any) => String(t.id) === String(table.id))) return f.name;
    }
    return null;
  }, [table, companyData?.branch?.floors]);

  if (!table) return null;

  return (
    <div style={{ height: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      <header style={{ flexShrink: 0, background: '#1e293b', color: 'white', padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.4rem', borderRadius: '4px', cursor: 'pointer' }}>←</button>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Piso: {resolvedFloorName ?? '—'}</div>
            <div style={{ fontWeight: 800 }}>{table.name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setShowChangeTableModal(true)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: '#00BFFF', color: 'white', border: 'none', borderRadius: '4px', width: '150px' }}>Cambio de  Mesa</button>
          <button onClick={() => setShowTransferPlatesModal(true)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: '#808080', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '150px' }}>Transferir platos</button>
          <button onClick={() => setShowChangeUserModal(true)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: '#E9967A', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '150px' }}>Cambio deMozo</button>
          <button onClick={handlePrecuenta} disabled={!operation || operation.status === 'COMPLETED' || isProcessing} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '150px', opacity: (!operation || operation.status === 'COMPLETED' || isProcessing) ? 0.6 : 1 }}>Precuenta</button>
          <button onClick={() => refetch()} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Refrescar</button>
        </div>
      </header>

      <section style={{ flexShrink: 0, background: 'white', padding: '0.5rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', gap: '0.4rem', position: 'relative' }}>
          <div style={{ flex: 1, display: 'flex', border: '1px solid #cbd5e0', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'white', height:'50px' }}>
            <input 
              type="text" 
              placeholder="Buscar cliente (DNI/RUC). Factura: selecciona cliente con RUC antes de cobrar."
              value={clientSearchTerm} 
              onChange={e => { setClientSearchTerm(e.target.value); setSelectedClientId(''); }} 
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchSunat(); } }}
              style={{ flex: 1, padding: '0.3rem 0.5rem', border: 'none', fontSize: '0.75rem', outline: 'none' }} 
            />
            <button onClick={handleSearchSunat} disabled={sunatSearchLoading} title="Buscar en SUNAT" style={{ padding: '0 0.6rem', background: '#0ea5e9', color: 'white', border: 'none', cursor: sunatSearchLoading ? 'not-allowed' : 'pointer' }}>
              🔍
            </button>
          </div>
          <button type="button" onClick={() => setShowEditClientModal(true)} disabled={!selectedClientId} title="Editar Cliente" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: !selectedClientId ? '#94a3b8' : '#6366f1', color: 'white', border: 'none', borderRadius: '4px', cursor: !selectedClientId ? 'not-allowed' : 'pointer', opacity: !selectedClientId ? 0.6 : 1 }}>
            ✏️
          </button>
          <button type="button" onClick={() => setShowCreateClientModal(true)} title="Nuevo Cliente" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            ➕
          </button>
          
          {clientSearchTerm && !selectedClientId && filteredClients.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '0.2rem', width: '250px', maxHeight: '200px', overflowY: 'auto', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 100 }}>
              <div onClick={() => { setSelectedClientId(''); setClientSearchTerm(''); }} style={{ padding: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                Sin cliente (Consumidor final)
              </div>
              {filteredClients.map((client: any) => (
                <div key={client.id} onClick={() => { setSelectedClientId(client.id); setClientSearchTerm(client.name || ''); }} style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{client.name}</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{client.documentType || 'DNI'}: {client.documentNumber}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <main style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', padding: '0.5rem', gap: '0.5rem' }}>
        <section style={{ flex: isSmallDesktop ? '65%' : '70%', background: 'white', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 40px 1fr 80px 80px 100px', background: '#f1f5f9', padding: '0.5rem', fontWeight: 800, fontSize: '0.7rem' }}>
            <div>SEL</div><div>CANT</div><div>PRODUCTO</div><div style={{ textAlign: 'right' }}>UNIT</div><div style={{ textAlign: 'right' }}>TOTAL</div><div style={{ textAlign: 'center' }}>OPC</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {detailsToUse.map((d: any) => (
              <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '40px 40px 1fr 80px 80px 100px', padding: '0.5rem', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', background: itemAssignments[d.id] ? '#f0f9ff' : 'none' }}>
                <input type="checkbox" checked={!!itemAssignments[d.id]} onChange={() => handleToggleItemSelection(d.id)} />
                <div style={{ fontWeight: 800 }}>{d.quantity}</div>
                <div>{d.productName}</div>
                <div style={{ textAlign: 'right' }}>{currencyFormatter.format(d.unitPrice)}</div>
                <div style={{ textAlign: 'right', fontWeight: 700 }}>{currencyFormatter.format(d.quantity * d.unitPrice)}</div>
                <div style={{ textAlign: 'center' }}>
                  {d.quantity > 1 && !String(d.id).includes('-split') && <button onClick={() => handleSplitItem(d.id)} style={{ fontSize: '1.1rem' }}>✂️</button>}
                  {String(d.id).includes('-split') && <button onClick={() => handleMergeItem(d.id)} style={{ fontSize: '0.6rem' }}>🔗</button>}
                  {canVoidInCashPay && (
                    <button type="button" onClick={() => handleDeleteItem(d.id)} style={{ fontSize: '1.1rem' }} title="Quitar ítem">🗑️</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>Descuentos:</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  placeholder="Desc S/" 
                  min={0}
                  step={0.01}
                  value={discountAmount || ''}
                  disabled={discountPct > 0}
                  onChange={e => {
                    const v = Math.max(0, parseFloat(e.target.value) || 0);
                    setDiscountAmount(v);
                    if (v > 0) setDiscountPercent(0);
                  }}
                  style={{
                    width: '200px',
                    padding: '0.3rem',
                    fontSize: '0.8rem',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    opacity: discountPct > 0 ? 0.55 : 1,
                    cursor: discountPct > 0 ? 'not-allowed' : 'text',
                    background: discountPct > 0 ? '#f1f5f9' : 'white'
                  }}
                  title={discountPct > 0 ? 'Quite el descuento (%) para usar monto en soles' : 'Descuento fijo (S/)'}
                />
                <input
                  type="number"
                  placeholder="Desc %"
                  min={0}
                  max={100}
                  step={0.5}
                  value={discountPercent || ''}
                  disabled={(Number(discountAmount) || 0) > 0}
                  onChange={e => {
                    const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                    setDiscountPercent(v);
                    if (v > 0) setDiscountAmount(0);
                  }}
                  style={{
                    width: '200px',
                    padding: '0.3rem',
                    fontSize: '0.8rem',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    opacity: (Number(discountAmount) || 0) > 0 ? 0.55 : 1,
                    cursor: (Number(discountAmount) || 0) > 0 ? 'not-allowed' : 'text',
                    background: (Number(discountAmount) || 0) > 0 ? '#f1f5f9' : 'white'
                  }}
                  title={(Number(discountAmount) || 0) > 0 ? 'Quite el descuento en soles para usar porcentaje' : 'Descuento porcentual (%)'}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Subtotal: {currencyFormatter.format(subtotal)}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>IGV ({igvPercentage}%): {currencyFormatter.format(igvAmount)}</div>
              {totalDiscount > 0 && <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>Descuento: -{currencyFormatter.format(totalDiscount)}</div>}
              <div style={{ fontWeight: 900, fontSize: '1.1rem', marginTop: '0.2rem', color: '#0f172a' }}>TOTAL: {currencyFormatter.format(totalToPay)}</div>
            </div>
          </div>
        </section>

        <section style={{ flex: isSmallDesktop ? '35%' : '30%', background: 'white', padding: '0.5rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#0ea5e9', color: 'white', padding: '0.5rem', textAlign: 'center', borderRadius: '4px', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem' }}>DEUDA</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{currencyFormatter.format(totalToPay)}</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}><span style={{ fontSize: '0.8rem', fontWeight: 800 }}>PAGOS</span><button onClick={addPayment} style={{ fontSize: '1.0rem' }}>+ Pago</button></div>
            {payments.map(p => (
              <div key={p.id} style={{ border: '1px solid #e2e8f0', padding: '0.4rem', marginBottom: '0.4rem', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <select value={p.method} onChange={e => updatePayment(p.id, 'method', e.target.value)} style={{ flex: 1, marginRight: '0.4rem', padding: '0.2rem' }}>
                    {PAYMENT_METHODS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  {payments.length > 1 && (
                    <button onClick={() => removePayment(p.id)} style={{ padding: '0 0.4rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 900 }}>✕</button>
                  )}
                </div>
                <input type="number" step="0.01" value={p.amount === 0 ? '' : p.amount} onChange={e => updatePayment(p.id, 'amount', Number(e.target.value))} style={{ width: '100%', fontWeight: 800, padding: '0.3rem' }} />
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              <span>RESTA: {currencyFormatter.format(remaining)}</span>
              {vuelto > 0 && <span style={{ color: 'green' }}>Vuelto: {currencyFormatter.format(vuelto)}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>Cobrar e imprimir</div>
              {payDocumentsOrdered.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0.5rem 0' }}>No hay tipos de documento configurados en la sucursal.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {payDocumentsOrdered.map((d: any) => {
                    const code = String(d.code || '').trim();
                    const bg =
                      code === '01' ? '#4f46e5' : code === '03' ? '#059669' : '#475569';
                    const disabled = isProcessing || remaining > 0.05;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleProcessPayment(String(d.id))}
                        disabled={disabled}
                        title={d.description}
                        style={{
                          flex: '1 1 calc(33.33% - 0.4rem)',
                          minWidth: '5.5rem',
                          padding: '0.65rem 0.35rem',
                          background: disabled ? '#cbd5e0' : bg,
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          lineHeight: 1.2
                        }}
                      >
                        {payDocumentButtonLabel(d)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {canVoidInCashPay && (
              <button
                type="button"
                onClick={() => { setCancellationReason(''); setShowCancelOperationModal(true); }}
                style={{ width: '100%', marginTop: '0.8rem', padding: '0.5rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Anular Orden
              </button>
            )}
          </div>
        </section>
      </main>

      {showChangeTableModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', width: '300px' }}>
            <h3>Cambiar Mesa</h3>
            <select value={selectedFloorId} onChange={e => setSelectedFloorId(e.target.value)} style={{ width: '100%', marginBottom: '0.5rem' }}>
              <option value="">Piso...</option>
              {floorsData?.floorsByBranch.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={selectedTableId} onChange={e => setSelectedTableId(e.target.value)} style={{ width: '100%', marginBottom: '1rem' }}>
              <option value="">Mesa...</option>
              {tablesData?.tablesByFloor.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setShowChangeTableModal(false)} style={{ flex: 1 }}>Volver</button>
              <button onClick={handleChangeTable} style={{ flex: 1 }}>Cambiar</button>
            </div>
          </div>
        </div>
      )}

      {showTransferPlatesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', width: '300px' }}>
            <h3>Transferir Platos</h3>
            <select value={selectedTransferFloorId} onChange={e => setSelectedTransferFloorId(e.target.value)} style={{ width: '100%', marginBottom: '0.5rem' }}>
              <option value="">Piso...</option>
              {transferFloorsData?.floorsByBranch.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={selectedTransferTableId} onChange={e => setSelectedTransferTableId(e.target.value)} style={{ width: '100%', marginBottom: '1rem' }}>
              <option value="">Mesa destino...</option>
              {transferTablesData?.tablesByFloor.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setShowTransferPlatesModal(false)} style={{ flex: 1 }}>Cerrar</button>
              <button onClick={handleTransferPlates} style={{ flex: 1 }}>Transferir</button>
            </div>
          </div>
        </div>
      )}

      {showChangeUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', width: '300px' }}>
            <h3>Cambiar Mozo</h3>
            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} style={{ width: '100%', marginBottom: '1rem' }}>
              <option value="">Mozo...</option>
              {availableUsers.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setShowChangeUserModal(false)} style={{ flex: 1 }}>Cerrar</button>
              <button onClick={handleChangeUser} style={{ flex: 1 }}>Cambiar</button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-item-modal-title"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={closeDeleteItemModal}
        >
          <div
            style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', width: 'min(380px, calc(100vw - 2rem))', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 id="delete-item-modal-title" style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f172a' }}>Quitar producto</h3>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', lineHeight: 1.5, color: '#475569' }}>
              {pendingDeleteItem.isSplit ? (
                <>¿Quitar <strong>1 unidad</strong> de «{pendingDeleteItem.productLabel}» de la orden?</>
              ) : (
                <>¿Quitar por completo «<strong>{pendingDeleteItem.productLabel}</strong>» de la orden?</>
              )}
            </p>
            <label htmlFor="delete-item-reason" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Motivo (obligatorio)
            </label>
            <textarea
              id="delete-item-reason"
              value={detailCancellationReason}
              onChange={e => setDetailCancellationReason(e.target.value)}
              placeholder="Describe el motivo (obligatorio)…"
              required
              aria-required="true"
              disabled={isRemovingItem}
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: '1rem',
                padding: '0.5rem 0.65rem',
                fontSize: '0.875rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                resize: 'vertical',
                minHeight: '72px'
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={closeDeleteItemModal}
                disabled={isRemovingItem}
                style={{ flex: 1, padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', cursor: isRemovingItem ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveItem}
                disabled={isRemovingItem}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: 'none',
                  borderRadius: '6px',
                  background: isRemovingItem ? '#94a3b8' : '#dc2626',
                  color: 'white',
                  cursor: isRemovingItem ? 'not-allowed' : 'pointer',
                  fontWeight: 700
                }}
              >
                {isRemovingItem ? 'Quitando…' : 'Quitar'}
              </button>
            </div>
          </div>
        </div>
      )}

     {showCancelOperationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', width: 'min(380px, calc(100vw - 2rem))' }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>Anular orden</h3>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#64748b' }}>Debes indicar por qué se anula la orden.</p>
            <label htmlFor="cancel-operation-reason" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Motivo (obligatorio)
            </label>
            <textarea
              id="cancel-operation-reason"
              placeholder="Describe el motivo (obligatorio)…"
              value={cancellationReason}
              onChange={e => setCancellationReason(e.target.value)}
              required
              aria-required="true"
              disabled={isProcessing}
              style={{ width: '100%', height: '88px', marginBottom: '1rem', padding: '0.5rem 0.65rem', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => { setShowCancelOperationModal(false); setCancellationReason(''); }} disabled={isProcessing} style={{ flex: 1 }}>
                Cerrar
              </button>
              <button type="button" onClick={handleCancelOperation} disabled={isProcessing} style={{ flex: 1, background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
                {isProcessing ? 'Anulando…' : 'Anular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateClientModal && <CreateClient onSuccess={() => setShowCreateClientModal(false)} onClose={() => setShowCreateClientModal(false)} />}
      {showEditClientModal && <EditClient client={selectedClient} onSuccess={() => setShowEditClientModal(false)} onClose={() => setShowEditClientModal(false)} />}
    </div>
  );
};

export default CashPay;
