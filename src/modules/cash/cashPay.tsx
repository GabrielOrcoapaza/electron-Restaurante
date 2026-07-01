import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    useQuery,
    useMutation,
    useLazyQuery,
    useApolloClient,
} from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { useUserPermissions } from "../../hooks/useUserPermissions";
import { useWebSocket } from "../../context/WebSocketContext";
import { useToast } from "../../context/ToastContext";
import { useResponsive } from "../../hooks/useResponsive";
import type { Table } from "../../types/table";
import {
    CREATE_ISSUED_DOCUMENT,
    CHANGE_OPERATION_TABLE,
    CHANGE_OPERATION_USER,
    TRANSFER_ITEMS,
    CANCEL_OPERATION_DETAIL,
    UPDATE_TABLE_STATUS,
    CANCEL_OPERATION,
    PRINT_PARTIAL_PRECUENTA,
    CREATE_PERSON,
    RELEASE_TABLE_SESSION_LOCK,
} from "../../graphql/mutations";
import {
    GET_DOCUMENTS,
    GET_CASH_REGISTERS,
    GET_SERIALS_BY_DOCUMENT,
    GET_OPERATION_BY_ID_FOR_CASH,
    GET_FLOORS_BY_BRANCH,
    GET_TABLES_BY_FLOOR,
    GET_PERSONS_BY_BRANCH,
    GET_USERS_BY_BRANCH_LIGHT,
    SEARCH_PERSON_BY_DOCUMENT,
    GET_ACTIVE_PROMOTIONS,
} from "../../graphql/queries";
import CreateClient from "../user/createClient";
import EditClient from "../user/editClient";
import {
    formatLocalDateYYYYMMDD,
    formatLocalTimeHHMMSS,
    formatInstantISO,
} from "../../utils/localDateTime";
import { invokeLocalIssuedDocumentPrint } from "../../utils/localDocumentPrint";
import { unitValueFromInclusivePrice } from "../../utils/taxAmounts";
import {
    promotionBadgeLabel,
    findBadgePromotion,
} from "../../utils/promotionUtils";
import type { IPromotion } from "../../types/promotions";
import type { DocumentPreviewAction } from "../../utils/issuedDocumentPrintWithPreview";
import { DocumentPrintPreviewModal } from "../../components/DocumentPrintPreviewModal";
import { isElectronRenderer } from "../../utils/electronPrint";
import {
    useTableSessionLock,
    isTableSessionLockApiEnabled,
    releaseTableSessionLockImmediately,
} from "../../hooks/useTableSessionLock";
import { fetchSystemPrinters } from "../../utils/systemPrinters";
import {
    getIntegratedPrinterCashUiEnabled,
    getLocalTicketPrinterStorage,
} from "../../utils/localPrinterPreference";
import { normalizeGraphQLId } from "../../utils/sanitizeGraphQLVariables";
import { resolveClientDeviceIdForPrint } from "../../utils/deviceIdForPrint";

type CashPayProps = {
    table: Table | null;
    onBack: () => void;
    onPaymentSuccess?: () => void;
    onTableChange?: (newTable: Table) => void;
};

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

/** Evita artefactos de punto flotante (ej. 9.560000000000002) en montos de pago. */
const roundMoney2 = (n: number): number =>
    Math.round((Number(n) || 0) * 100) / 100;

const parsePromoInfo = (
    promoInfo: string | null | undefined,
): { discount: number; promotionName: string | null } => {
    if (!promoInfo) return { discount: 0, promotionName: null };
    try {
        const parsed = JSON.parse(promoInfo);
        return {
            discount: typeof parsed.discount === "number" ? parsed.discount : 0,
            promotionName: parsed.promotionName || null,
        };
    } catch {
        return { discount: 0, promotionName: null };
    }
};

/** Descuento de la línea prorrateado según cantidad visible (pagos parciales / split). */
const getDetailLineDiscount = (detail: any): number => {
    const { discount } = parsePromoInfo(detail?.promoInfo);
    if (!discount) return 0;
    const originalQty =
        Number(detail?.originalQuantity ?? detail?.quantity) || 0;
    const currentQty = Number(detail?.quantity) || 0;
    if (originalQty <= 0 || currentQty <= 0) return 0;
    return roundMoney2((discount * currentQty) / originalQty);
};

const getDetailPromotionName = (detail: any): string | null =>
    parsePromoInfo(detail?.promoInfo).promotionName;

/** Coincide con PAYMENT_METHODS en backend (Django). */
const PAYMENT_METHODS: { value: string; label: string }[] = [
    { value: "CASH", label: "Efectivo" },
    { value: "YAPE", label: "Yape" },
    { value: "PLIN", label: "Plin" },
    { value: "CARD", label: "Tarjeta" },
    { value: "TRANSFER", label: "Transferencia Bancaria" },
    { value: "OTROS", label: "Otros" },
];

const paymentMethodSendsReference = (method: string): boolean =>
    method === "YAPE" ||
    method === "PLIN" ||
    method === "TRANSFER" ||
    method === "OTROS";

const CashPay: React.FC<CashPayProps> = ({
    table,
    onBack,
    onPaymentSuccess,
    onTableChange,
}) => {
    const {
        companyData,
        user,
        getDeviceId,
        getMacAddress,
        updateTableInContext,
    } = useAuth();
    const { hasPermission } = useUserPermissions();
    const canVoidInCashPay =
        hasPermission("cash.view") || hasPermission("cash.void");
    const { sendMessage, subscribe } = useWebSocket();
    const apolloClient = useApolloClient();
    const { showToast } = useToast();
    const { breakpoint } = useResponsive();

    useTableSessionLock({
        tableId: table?.id,
        userId: user?.id ? String(user.id) : undefined,
        enabled: Boolean(table?.id && user?.id),
        onLockDenied: (msg) => {
            showToast(msg, "error");
            onBack();
        },
    });

    const isXs = breakpoint === "xs";
    const isSmall = breakpoint === "sm";
    const isMedium = breakpoint === "md";
    const isNarrow = isXs || isSmall || isMedium;
    const isElectron = isElectronRenderer();

    const cashModalOverlayClass =
        "fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4";
    const cashModalPanelClass =
        "w-full max-w-[300px] rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
    const cashModalPanelWideClass =
        "w-full max-w-[380px] rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
    const cashModalTitleClass =
        "mb-3 text-base font-semibold text-slate-900 dark:text-slate-100";
    const cashModalTextClass =
        "mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400";
    const cashModalLabelClass =
        "mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300";
    const cashModalSelectClass =
        "mb-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
    const cashModalTextareaClass =
        "mb-4 w-full min-h-[72px] resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";
    const cashModalActionsClass = "flex gap-2";
    const cashModalBtnSecondaryClass =
        "flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";
    const cashModalBtnPrimaryClass =
        "flex-1 rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500";
    const cashModalBtnDangerClass =
        "flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-600";

    /**
     * device_id para impresión/backend: MAC en Electron (SumApp), getDeviceId() como respaldo.
     */
    const getDeviceIdOrMac = async (): Promise<string> =>
        resolveClientDeviceIdForPrint({
            getMacAddress,
            getDeviceId,
            logPrefix: "[PAGO]",
        });

    // Solo para diferentes tamaños de pantalla de PC (desktop)
    // lg: 1024px-1279px, xl: 1280px-1535px, 2xl: >=1536px
    const isSmallDesktop = breakpoint === "lg"; // 1024px - 1279px

    const [selectedCashRegisterId, setSelectedCashRegisterId] =
        useState<string>("");
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [showCreateClientModal, setShowCreateClientModal] = useState(false);
    const [showEditClientModal, setShowEditClientModal] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useState("");
    /** Evita cargar toda la lista de personas al abrir caja (suele ser la query más pesada). */
    const [enableBranchClientsQuery, setEnableBranchClientsQuery] =
        useState(false);

    // Estado para múltiples pagos
    type Payment = {
        id: string;
        method: string;
        amount: number;
        referenceNumber: string;
    };
    const [payments, setPayments] = useState<Payment[]>([
        { id: "1", method: "CASH", amount: 0, referenceNumber: "" },
    ]);

    const [isProcessing, setIsProcessing] = useState(false);
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [discountPercent, setDiscountPercent] = useState<number>(0);
    const isProcessingRef = useRef(false);
    const isPrintPreviewOpenRef = useRef(false);
    const [cashDocPreview, setCashDocPreview] = useState<{
        title: string;
    } | null>(null);
    const cashDocPreviewResolverRef = useRef<
        ((action: DocumentPreviewAction) => void) | null
    >(null);
    const [itemAssignments, setItemAssignments] = useState<
        Record<string, boolean>
    >({});
    const [modifiedDetails, setModifiedDetails] = useState<any[]>([]);
    const [showChangeTableModal, setShowChangeTableModal] = useState(false);
    const [selectedFloorId, setSelectedFloorId] = useState<string>("");
    const [selectedTableId, setSelectedTableId] = useState<string>("");
    const [showChangeUserModal, setShowChangeUserModal] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [showTransferPlatesModal, setShowTransferPlatesModal] =
        useState(false);
    const [selectedTransferFloorId, setSelectedTransferFloorId] =
        useState<string>("");
    const [selectedTransferTableId, setSelectedTransferTableId] =
        useState<string>("");
    const [showCancelOperationModal, setShowCancelOperationModal] =
        useState(false);
    const [cancellationReason, setCancellationReason] = useState<string>("");
    const [detailCancellationReason, setDetailCancellationReason] =
        useState<string>("");
    const [pendingDeleteItem, setPendingDeleteItem] = useState<{
        detailId: string;
        originalId: string;
        isSplit: boolean;
        productLabel: string;
        /** Varios renglones de UI comparten el mismo detalle de BD (divisiones) o fila hija: solo quitar la cantidad de esta fila */
        removalIsPartial: boolean;
        rowQuantity: number;
    } | null>(null);
    const [isRemovingItem, setIsRemovingItem] = useState(false);

    /** Impresora del equipo para ticket cuando el backend devuelve print_locally (nombre `name` de Chromium). */
    const [selectedLocalPrinterName] = useState(() =>
        getLocalTicketPrinterStorage(),
    );

    /**
     * Preferencia solo en este equipo (localStorage). Actívala en Configuración → Impresoras locales
     * si esta caja usa impresora USB/integrada; no requiere cambios en el backend.
     */
    const [showLocalPrinterPicker, setShowLocalPrinterPicker] = useState(() =>
        getIntegratedPrinterCashUiEnabled(),
    );

    useEffect(() => {
        const sync = () =>
            setShowLocalPrinterPicker(getIntegratedPrinterCashUiEnabled());
        window.addEventListener("sumapp-integrated-printer-cash-ui", sync);
        window.addEventListener("storage", sync);
        return () => {
            window.removeEventListener(
                "sumapp-integrated-printer-cash-ui",
                sync,
            );
            window.removeEventListener("storage", sync);
        };
    }, []);

    useEffect(() => {
        if (!showLocalPrinterPicker || !table?.currentOperationId) return;
        (async () => {
            try {
                await fetchSystemPrinters();
            } catch (e) {
                console.warn("Error fetching printers", e);
            }
        })();
    }, [table?.currentOperationId, showLocalPrinterPicker]);

    const operationIdFromTable = normalizeGraphQLId(table?.currentOperationId);

    const { data: dataOperation, refetch } = useQuery(
        GET_OPERATION_BY_ID_FOR_CASH,
        {
            variables: {
                operationId: operationIdFromTable as string,
            },
            skip: !operationIdFromTable,
            fetchPolicy: "cache-and-network",
        },
    );

    const branchId = normalizeGraphQLId(companyData?.branch?.id);

    const { data: documentsData } = useQuery(GET_DOCUMENTS, {
        variables: { branchId: branchId as string },
        skip: !branchId,
        fetchPolicy: "cache-and-network",
    });

    const { data: cashRegistersData } = useQuery(GET_CASH_REGISTERS, {
        variables: { branchId: branchId as string },
        skip: !branchId,
        fetchPolicy: "cache-and-network",
    });

    const { data: floorsData } = useQuery(GET_FLOORS_BY_BRANCH, {
        variables: { branchId: branchId as string },
        skip: !branchId || !showChangeTableModal,
        fetchPolicy: "network-only",
    });

    const { data: tablesData } = useQuery(GET_TABLES_BY_FLOOR, {
        variables: { floorId: selectedFloorId },
        skip: !normalizeGraphQLId(selectedFloorId),
        fetchPolicy: "network-only",
    });

    const { data: transferFloorsData } = useQuery(GET_FLOORS_BY_BRANCH, {
        variables: { branchId: branchId as string },
        skip: !branchId || !showTransferPlatesModal,
        fetchPolicy: "network-only",
    });

    const { data: transferTablesData } = useQuery(GET_TABLES_BY_FLOOR, {
        variables: { floorId: selectedTransferFloorId },
        skip: !normalizeGraphQLId(selectedTransferFloorId),
        fetchPolicy: "network-only",
    });

    const { data: clientsData, refetch: refetchClients } = useQuery(
        GET_PERSONS_BY_BRANCH,
        {
            variables: { branchId: branchId as string },
            skip: !branchId || !enableBranchClientsQuery,
            fetchPolicy: "cache-and-network",
        },
    );

    const { data: usersData } = useQuery(GET_USERS_BY_BRANCH_LIGHT, {
        variables: {
            branchId: branchId as string,
            includeInactive: false,
        },
        skip: !branchId || !showChangeUserModal,
        fetchPolicy: "network-only",
    });

    const [searchPersonByDocument, { loading: sunatSearchLoading }] =
        useLazyQuery(SEARCH_PERSON_BY_DOCUMENT, {
            fetchPolicy: "network-only",
        });
    const [fetchSerialsForDocument] = useLazyQuery(GET_SERIALS_BY_DOCUMENT, {
        fetchPolicy: "network-only",
    });
    const [createPersonMutation] = useMutation(CREATE_PERSON);
    const [createIssuedDocumentMutation] = useMutation(CREATE_ISSUED_DOCUMENT);
    const [changeOperationTableMutation] = useMutation(CHANGE_OPERATION_TABLE);
    const [changeOperationUserMutation] = useMutation(CHANGE_OPERATION_USER);
    const { data: promotionsData } = useQuery(GET_ACTIVE_PROMOTIONS, {
        variables: { branchId: branchId as string },
        skip: !branchId,
        fetchPolicy: "cache-and-network",
    });
    const [transferItemsMutation] = useMutation(TRANSFER_ITEMS);
    const [releaseTableSessionLockMutation] = useMutation(
        RELEASE_TABLE_SESSION_LOCK,
    );

    const releaseOriginTableSessionLock = async (
        tableId?: string | number | null,
    ) => {
        const tid =
            tableId != null && String(tableId).trim() !== ""
                ? String(tableId)
                : table?.id
                  ? String(table.id)
                  : null;
        const uid = user?.id ? String(user.id) : undefined;
        if (!tid || !uid || !isTableSessionLockApiEnabled()) return;
        try {
            await releaseTableSessionLockImmediately(
                releaseTableSessionLockMutation,
                tid,
                uid,
            );
        } catch (error) {
            console.error("Error al liberar candado de mesa origen:", error);
        }
    };

    const notifyTableStatusUpdate = (updatedTable: {
        id: string | number;
        status?: string | null;
        currentOperationId?: string | number | null;
        occupiedById?: string | number | null;
        userName?: string | null;
    }) => {
        sendMessage({
            type: "table_status_update",
            table_id: updatedTable.id,
            status: updatedTable.status ?? "AVAILABLE",
            current_operation_id: updatedTable.currentOperationId ?? null,
            occupied_by_user_id: updatedTable.occupiedById ?? null,
            waiter_name: updatedTable.userName ?? null,
        });
        setTimeout(() => {
            sendMessage({ type: "table_update_request" });
        }, 500);
    };
    const [cancelOperationDetailMutation] = useMutation(
        CANCEL_OPERATION_DETAIL,
    );
    const [updateTableStatusMutation] = useMutation(UPDATE_TABLE_STATUS);
    const [cancelOperationMutation] = useMutation(CANCEL_OPERATION);
    const [printPartialPrecuentaMutation] = useMutation(
        PRINT_PARTIAL_PRECUENTA,
    );

    const notifyTableUpdate = (
        tableId: string,
        status: string,
        currentOperationId?: string | number | null,
        occupiedById?: string | number | null,
        waiterName?: string | null,
    ) => {
        setTimeout(() => {
            sendMessage({
                type: "table_status_update",
                table_id: tableId,
                status: status,
                current_operation_id: currentOperationId || null,
                occupied_by_user_id: occupiedById || null,
                waiter_name: waiterName || null,
            });
            setTimeout(() => {
                sendMessage({ type: "table_update_request" });
            }, 500);
        }, 300);
    };

    const operation = dataOperation?.operationById;

    useEffect(() => {
        const unsubscribeOperationCancelled = subscribe(
            "operation_cancelled",
            (message: any) => {
                if (message.operation_id === operation?.id) refetch();
            },
        );
        const unsubscribeOperationStatusUpdate = subscribe(
            "operation_status_update",
            (message: any) => {
                if (message.operation_id === operation?.id) refetch();
            },
        );
        return () => {
            unsubscribeOperationCancelled();
            unsubscribeOperationStatusUpdate();
        };
    }, [subscribe, operation?.id, refetch]);

    const documents = (documentsData?.documentsByBranch || []).filter(
        (doc: any) => doc.isActive !== false,
    );

    // Derive promotion categories
    const activePromotions = (promotionsData?.activePromotions ||
        []) as IPromotion[];
    const allClients = (clientsData?.personsByBranch || []).filter(
        (person: any) => !person.isSupplier && person.isActive !== false,
    );

    const selectedClient = allClients.find(
        (c: any) => c.id === selectedClientId,
    );

    /** Orden: nota / otros, boleta (03), factura (01) — coincide con el flujo típico de caja. */
    const payDocumentsOrdered = useMemo(() => {
        const weight = (d: any) =>
            String(d.code) === "01" ? 3 : String(d.code) === "03" ? 2 : 1;
        return [...documents].sort((a, b) => weight(a) - weight(b));
    }, [documents]);

    const payDocumentButtonLabel = (doc: any) => {
        const c = String(doc.code || "").trim();
        if (c === "01") return "Factura";
        if (c === "03") return "Boleta";
        return doc.description || "Documento";
    };

    const filteredClients = allClients
        .filter((client: any) => {
            if (!clientSearchTerm) return true;
            const search = clientSearchTerm.toLowerCase();
            const name = (client.name || "").toLowerCase();
            const documentNumber = (client.documentNumber || "").toLowerCase();
            return name.includes(search) || documentNumber.includes(search);
        })
        .slice(0, 50);

    const cashRegisters = cashRegistersData?.cashRegistersByBranch || [];

    const igvPercentage = Number(companyData?.branch?.igvPercentage) || 10.5;

    const getFacturedItemsFromStorage = (
        operationId: string,
    ): Map<string, number> => {
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
        } catch (error) {
            console.warn(error);
        }
        return new Map<string, number>();
    };

    const saveFacturedItemsToStorage = (
        operationId: string,
        facturedItemsMap: Map<string, number>,
    ) => {
        try {
            const storageKey = `factured_items_${operationId}`;
            const existingData = getFacturedItemsFromStorage(operationId);
            facturedItemsMap.forEach((quantity, detailId) => {
                const existingQty = existingData.get(detailId) || 0;
                existingData.set(detailId, existingQty + quantity);
            });
            const dataToStore: Record<string, number> = {};
            existingData.forEach((value, key) => {
                dataToStore[key] = value;
            });
            sessionStorage.setItem(storageKey, JSON.stringify(dataToStore));
        } catch (error) {
            console.warn(error);
        }
    };

    /** Comprobantes que ya no deben restar cantidad “facturada” (reapertura tras anulación, etc.). */
    const isIssuedItemActiveForDebt = (item: any): boolean => {
        const st = item?.issuedDocument?.billingStatus;
        if (st == null) return true;
        const excluded = new Set([
            "CANCELLED",
            "PROCESSING_CANCELLATION",
            "CANCELLATION_PENDING",
            "CANCELLATION_ERROR",
            "REJECTED",
            "ERROR",
        ]);
        return !excluded.has(String(st).toUpperCase());
    };

    const filterCanceledDetails = (details: any[], operationId?: string) => {
        if (!details || !Array.isArray(details)) return [];
        const facturedItemsMap = operationId
            ? getFacturedItemsFromStorage(operationId)
            : new Map<string, number>();
        const adjustedDetails: any[] = [];
        details.forEach((detail: any) => {
            const isCanceled =
                detail.isCanceled === true ||
                detail.isCanceled === 1 ||
                String(detail.isCanceled).toLowerCase() === "true";
            if (isCanceled) return;
            const detailId = String(detail.id);
            const originalQuantity = Number(detail.quantity) || 0;
            const paidFromStorage = facturedItemsMap.get(detailId);
            const quantityFacturedBackend = (detail.issuedItems || [])
                .filter(isIssuedItemActiveForDebt)
                .reduce(
                    (sum: number, item: any) =>
                        sum + (Number(item.quantity) || 0),
                    0,
                );
            let remainingQty: number;
            if (detailId.includes("-split-")) {
                remainingQty = originalQuantity;
            } else if (paidFromStorage !== undefined) {
                remainingQty = originalQuantity - paidFromStorage;
            } else {
                remainingQty = originalQuantity - quantityFacturedBackend;
            }
            if (remainingQty <= 0) return;
            adjustedDetails.push({
                ...detail,
                quantity: remainingQty,
                remainingQuantity: remainingQty,
                originalQuantity,
            });
        });
        return adjustedDetails;
    };

    const getRealOperationDetailId = (detail: any): string | null => {
        if (!detail) return null;
        let realId: string | null = null;
        if (detail.originalDetailId) {
            realId = String(detail.originalDetailId);
        } else if (String(detail.id).includes("-split-")) {
            realId = String(detail.id).split("-split-")[0];
        } else {
            realId = String(detail.id);
        }
        if (realId && !/^\d+$/.test(realId)) {
            console.error(
                `getRealOperationDetailId: ID no numérico: "${realId}"`,
            );
            return null;
        }
        return realId;
    };

    const detailsToUse =
        modifiedDetails.length > 0
            ? modifiedDetails
            : filterCanceledDetails(operation?.details || [], operation?.id);
    const selectedDetailIds = Object.keys(itemAssignments).filter(
        (id) => itemAssignments[id],
    );
    const detailsForTotal =
        selectedDetailIds.length > 0
            ? detailsToUse.filter((detail: any) =>
                  selectedDetailIds.includes(String(detail.id)),
              )
            : detailsToUse;

    // Optimize expensive calculations by moving them out of render path
    const calculatedValues = useMemo(() => {
        const grossTotal = detailsForTotal.reduce((sum: number, detail: any) => {
            const quantity = Number(detail.quantity) || 0;
            const unitPrice = Number(detail.unitPrice) || 0;
            return sum + quantity * unitPrice;
        }, 0);
        const itemsPromoDiscount = roundMoney2(
            detailsForTotal.reduce(
                (sum: number, detail: any) => sum + getDetailLineDiscount(detail),
                0,
            ),
        );
        const totalAfterItemDiscount = Math.max(0, grossTotal - itemsPromoDiscount);
        const discountPct = Number(discountPercent) || 0;
        const globalDiscount = Math.max(
            0,
            discountPct > 0
                ? roundMoney2((totalAfterItemDiscount * discountPct) / 100)
                : Number(discountAmount) || 0,
        );
        const totalToPay = Math.max(0, totalAfterItemDiscount - globalDiscount);
        const igvDecimal = igvPercentage / 100;
        const subtotal = parseFloat(
            (Math.round((totalToPay / (1 + igvDecimal)) * 100) / 100).toFixed(2),
        );
        const igvAmount = parseFloat(
            (Math.round((totalToPay - subtotal) * 100) / 100).toFixed(2),
        );

        return {
            itemsPromoDiscount,
            discountPct,
            globalDiscount,
            totalToPay,
            subtotal,
            igvAmount
        };
    }, [detailsForTotal, discountAmount, discountPercent, igvPercentage]);

    // Destructure calculated values for use in the component
    const {
        itemsPromoDiscount,
        discountPct,
        globalDiscount,
        totalToPay,
        subtotal,
        igvAmount
    } = calculatedValues;

    const addPayment = () => {
        const currentTotalPaid = payments.reduce(
            (sum, p) => sum + (Number(p.amount) || 0),
            0,
        );
        if (
            roundMoney2(totalToPay) <= 0.01 ||
            roundMoney2(currentTotalPaid) >= roundMoney2(totalToPay)
        ) {
            return;
        }
        const remainingAmount = roundMoney2(
            Math.max(0, totalToPay - currentTotalPaid),
        );
        setPayments([
            ...payments,
            {
                id: String(Date.now()),
                method: "CASH",
                amount: remainingAmount,
                referenceNumber: "",
            },
        ]);
    };
    const removePayment = (id: string) => {
        if (payments.length > 1)
            setPayments(payments.filter((p) => p.id !== id));
    };
    const updatePayment = (
        id: string,
        field: keyof Payment,
        value: string | number,
    ) => {
        setPayments(
            payments.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
        );
    };
    const totalPaid = payments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0,
    );
    const remaining = totalToPay - totalPaid;
    const vuelto = remaining < 0 ? Math.abs(remaining) : 0;
    /** Misma tolerancia que al enviar el pago (totalPaymentsAmount >= paymentTotal - 0.01). */
    const paymentsCoverDebt =
        roundMoney2(totalToPay) <= 0.01 ||
        roundMoney2(totalPaid) >= roundMoney2(totalToPay) - 0.01;
    /** Solo permitir otro método si la suma de pagos es menor que la deuda (DEUDA). */
    const canAddPaymentMethod =
        roundMoney2(totalToPay) > 0.01 &&
        roundMoney2(totalPaid) < roundMoney2(totalToPay);

    useEffect(() => {
        if (payments.length === 1 && payments[0].amount === 0)
            setPayments([{ ...payments[0], amount: roundMoney2(totalToPay) }]);
    }, [totalToPay, operation?.id]);

    useEffect(() => {
        if (payments.length === 0) return;
        setPayments((prev) =>
            prev.map((p, i) =>
                i === 0
                    ? { ...p, amount: roundMoney2(totalToPay) }
                    : { ...p, amount: 0 },
            ),
        );
    }, [totalToPay]);

    useEffect(() => {
        setDiscountAmount(0);
        setDiscountPercent(0);
    }, [operation?.id]);

    useEffect(() => {
        if (cashRegisters.length > 0 && !selectedCashRegisterId)
            setSelectedCashRegisterId(cashRegisters[0].id);
    }, [cashRegisters, selectedCashRegisterId]);

    const handleSearchSunat = async () => {
        const term = (clientSearchTerm || "").trim().replace(/\s/g, "");
        if (!/^\d+$/.test(term) || !companyData?.branch?.id) return;
        const documentType = term.length === 11 ? "RUC" : "DNI";
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
                showToast("No se encontró el documento.", "error");
                return;
            }
            const person = result.person;
            if (person.id && result.foundLocally) {
                setSelectedClientId(person.id);
                setClientSearchTerm(person.name || "");
                return;
            }
            const { data: createData } = await createPersonMutation({
                variables: {
                    branchId: companyData.branch.id,
                    documentType: person.documentType || documentType,
                    documentNumber: person.documentNumber || term,
                    name: person.name || "Cliente",
                    isCustomer: true,
                    isSupplier: false,
                },
            });
            if (createData?.createPerson?.success) {
                setEnableBranchClientsQuery(true);
                const newPerson = createData.createPerson.person;
                setSelectedClientId(newPerson.id);
                setClientSearchTerm(newPerson.name || "");
                queueMicrotask(() => {
                    void refetchClients();
                });
            }
        } catch (err: any) {
            showToast(err?.message, "error");
        }
    };

    /** Reset filas locales al cambiar mesa u operación (debe ir ANTES del efecto que marca checkboxes). */
    useEffect(() => {
        if (table?.id) {
            setItemAssignments({});
            setModifiedDetails([]);
        }
    }, [table?.id, table?.currentOperationId]);

    useEffect(() => {
        if (operation?.details && operation?.id) {
            const nonCanceledDetails = filterCanceledDetails(
                operation.details,
                operation.id,
            );
            setModifiedDetails([...nonCanceledDetails]);
            if (Object.keys(itemAssignments).length === 0) {
                const initialAssignments: Record<string, boolean> = {};
                nonCanceledDetails.forEach((detail: any) => {
                    if (detail.id) initialAssignments[String(detail.id)] = true;
                });
                setItemAssignments(initialAssignments);
            }
        }
    }, [operation?.details, operation?.id]);

    const handleSplitItem = (detailId: string) => {
        const idx = modifiedDetails.findIndex(
            (d: any) => String(d.id) === String(detailId),
        );
        if (idx === -1) return;
        const d = modifiedDetails[idx];
        const q = Number(d.quantity) || 0;
        if (q <= 1) {
            showToast(
                "No se puede dividir: la cantidad debe ser mayor a 1.",
                "warning",
            );
            return;
        }
        const splitDetailId = `${detailId}-split-${Date.now()}`;
        const productLabel = d.productName || "Producto";
        showToast(
            `Se separó 1 unidad de "${productLabel}" para cobrar aparte.`,
            "info",
        );
        setModifiedDetails((prev) => {
            const i = prev.findIndex(
                (row: any) => String(row.id) === String(detailId),
            );
            if (i === -1) return prev;
            const row = prev[i];
            const qty = Number(row.quantity) || 0;
            if (qty <= 1) return prev;
            const next = [...prev];
            next[i] = { ...row, quantity: qty - 1, remainingQuantity: qty - 1 };
            next.splice(i + 1, 0, {
                ...row,
                id: splitDetailId,
                originalDetailId: detailId,
                quantity: 1,
                remainingQuantity: 1,
            });
            setItemAssignments((p) => ({
                ...p,
                [detailId]: true,
                [splitDetailId]: true,
            }));
            return next;
        });
    };

    const handleMergeItem = (splitDetailId: string) => {
        const originalId = splitDetailId.split("-split")[0];
        setModifiedDetails((prev) => {
            const sIdx = prev.findIndex(
                (d: any) => String(d.id) === String(splitDetailId),
            );
            const oIdx = prev.findIndex(
                (d: any) => String(d.id) === String(originalId),
            );
            if (sIdx === -1 || oIdx === -1) return prev;
            const next = [...prev];
            const sD = next[sIdx];
            const oD = next[oIdx];
            next[oIdx] = {
                ...oD,
                quantity:
                    (Number(oD.quantity) || 0) + (Number(sD.quantity) || 0),
            };
            next.splice(sIdx, 1);
            return next;
        });
    };

    const handleToggleItemSelection = (id: string) => {
        setItemAssignments((p) => {
            const n = { ...p };
            if (n[id]) delete n[id];
            else n[id] = true;
            return n;
        });
    };

    const handleSelectAllLineItems = () => {
        const next: Record<string, boolean> = {};
        detailsToUse.forEach((d: any) => {
            if (d.id != null && d.id !== "") next[String(d.id)] = true;
        });
        setItemAssignments(next);
    };

    const handleDeselectAllLineItems = () => {
        setItemAssignments({});
    };

    const handleDeleteItem = (detailId: string) => {
        if (!canVoidInCashPay) {
            showToast(
                "No tienes permiso para quitar ítems de la orden en caja.",
                "error",
            );
            return;
        }
        const isSplit = detailId?.includes("-split");
        const originalId = isSplit ? detailId.split("-split")[0] : detailId;
        const row = detailsToUse.find(
            (d: any) => String(d.id) === String(detailId),
        );
        const productLabel = row?.productName || "este producto";
        const realId = row ? getRealOperationDetailId(row) : null;
        const sameGroupCount = realId
            ? detailsToUse.filter(
                  (d: any) => getRealOperationDetailId(d) === realId,
              ).length
            : 0;
        // Misma lógica que al confirmar: si hay 2+ filas para el mismo detalle de BD, o fila hija (split), no anular toda la línea en el servidor
        const removalIsPartial = sameGroupCount > 1 || isSplit;
        const rowQuantity = Math.max(0, Number(row?.quantity) || 0) || 1;
        setDetailCancellationReason("");
        setPendingDeleteItem({
            detailId,
            originalId,
            isSplit,
            productLabel,
            removalIsPartial,
            rowQuantity,
        });
    };

    const handleConfirmRemoveItem = async () => {
        if (!pendingDeleteItem || !user?.id) return;
        if (!detailCancellationReason.trim()) {
            showToast("Indica el motivo por el que quitas este ítem.", "error");
            return;
        }
        const { detailId } = pendingDeleteItem;
        const row = detailsToUse.find(
            (d: any) => String(d.id) === String(detailId),
        );
        if (!row) {
            showToast("No se encontró el ítem a quitar.", "error");
            return;
        }
        const realDetailId = getRealOperationDetailId(row);
        if (!realDetailId) {
            showToast("No se pudo identificar el detalle a anular.", "error");
            return;
        }
        const sameGroup = detailsToUse.filter(
            (d: any) => getRealOperationDetailId(d) === realDetailId,
        );
        const q = Number(row.quantity) || 0;
        // Varias filas de UI = mismo detalle de BD: solo cancelar la cantidad de ESTA fila. La fila "padre" (id sin -split) antes anulaba todo el detalle.
        const usePartial =
            sameGroup.length > 1 || String(detailId).includes("-split");
        const quantity = usePartial ? (q > 0 ? q : 1) : undefined;

        setIsRemovingItem(true);
        try {
            const deviceId = await getDeviceIdOrMac();
            const res = await cancelOperationDetailMutation({
                variables: {
                    detailId: realDetailId,
                    quantity,
                    userId: user.id,
                    deviceId,
                    cancellationReason: detailCancellationReason.trim(),
                },
            });
            if (res.data?.cancelOperationDetail?.success) {
                showToast(
                    quantity != null
                        ? `Se quitó ${quantity} unidad(es) del pedido.`
                        : "Plato quitado del pedido.",
                    "success",
                );
                setDetailCancellationReason("");
                setPendingDeleteItem(null);
                await refetch();
                if (onPaymentSuccess) onPaymentSuccess();
            } else {
                showToast(
                    res.data?.cancelOperationDetail?.message ||
                        "No se pudo quitar el ítem.",
                    "error",
                );
            }
        } catch (e: any) {
            console.error(e);
            showToast(e?.message || "Error al quitar el ítem.", "error");
        } finally {
            setIsRemovingItem(false);
        }
    };

    const closeDeleteItemModal = () => {
        if (!isRemovingItem) {
            setDetailCancellationReason("");
            setPendingDeleteItem(null);
        }
    };

    /** Al pulsar Boleta / Factura / Nota: confirmación y luego el pago. */
    const handleDocumentPayClick = async (documentId: string) => {
        if (
            isProcessingRef.current ||
            isProcessing ||
            isPrintPreviewOpenRef.current
        ) {
            return;
        }

        if (!operation || !documentId || !user?.id) {
            showToast("No se puede procesar el pago", "error");
            return;
        }

        const docForPay = documents.find(
            (doc: any) => String(doc.id) === String(documentId),
        );
        if (!docForPay) {
            showToast("Tipo de documento no válido", "error");
            return;
        }

        const isFacturaDoc = String(docForPay.code) === "01";
        if (isFacturaDoc) {
            if (!selectedClientId) {
                showToast(
                    "Para emitir una FACTURA debe seleccionar un cliente con RUC",
                    "error",
                );
                return;
            }
            if ((selectedClient?.documentType || "").toUpperCase() !== "RUC") {
                showToast(
                    "Para emitir una FACTURA el cliente debe tener un RUC válido",
                    "error",
                );
                return;
            }
        }

        const cashRegisterIdToUse =
            selectedCashRegisterId ||
            (cashRegisters.length > 0 ? cashRegisters[0].id : null);
        if (!cashRegisterIdToUse) {
            showToast("No hay cajas registradoras disponibles", "error");
            return;
        }

        if (!paymentsCoverDebt) {
            showToast(
                "La suma de los pagos debe cubrir el total a pagar",
                "error",
            );
            return;
        }

        if (detailsForTotal.length === 0) {
            showToast("No hay productos para facturar", "error");
            return;
        }

        isPrintPreviewOpenRef.current = true;
        try {
            const previewTitle = payDocumentButtonLabel(docForPay);

            const userAction = await new Promise<DocumentPreviewAction>(
                (resolve) => {
                    cashDocPreviewResolverRef.current = resolve;
                    setCashDocPreview({ title: previewTitle });
                },
            );

            setCashDocPreview(null);
            cashDocPreviewResolverRef.current = null;

            if (userAction === "cancel") {
                return;
            }

            await handleProcessPayment(documentId, userAction === "print");
        } finally {
            isPrintPreviewOpenRef.current = false;
        }
    };

    const handleProcessPayment = async (
        documentId: string,
        shouldPrint: boolean = true,
    ) => {
        // ⚠️ PROTECCIÓN CONTRA DOBLE CLIC - Verificar ref primero (más confiable que estado)
        if (isProcessingRef.current) {
            console.warn(
                "⚠️ Pago ya en proceso (ref check), ignorando solicitud duplicada",
            );
            return;
        }

        // ⚠️ PROTECCIÓN CONTRA DOBLE CLIC - Verificar también estado
        if (isProcessing) {
            console.warn(
                "⚠️ Pago ya en proceso (state check), ignorando solicitud duplicada",
            );
            return;
        }

        if (!operation || !documentId || !user?.id) {
            showToast("No se puede procesar el pago", "error");
            return;
        }

        const docForPay = documents.find(
            (doc: any) => String(doc.id) === String(documentId),
        );
        if (!docForPay) {
            showToast("Tipo de documento no válido", "error");
            return;
        }

        const isFacturaDoc = String(docForPay.code) === "01";

        // ✅ VALIDACIONES SUNAT: Factura requiere cliente con RUC
        if (isFacturaDoc) {
            if (!selectedClientId) {
                showToast(
                    "Para emitir una FACTURA debe seleccionar un cliente con RUC",
                    "error",
                );
                return;
            }
            if ((selectedClient?.documentType || "").toUpperCase() !== "RUC") {
                showToast(
                    "Para emitir una FACTURA el cliente debe tener un RUC válido",
                    "error",
                );
                return;
            }
        }

        // Si no hay caja seleccionada, usar la primera disponible
        const cashRegisterIdToUse =
            selectedCashRegisterId ||
            (cashRegisters.length > 0 ? cashRegisters[0].id : null);

        if (!cashRegisterIdToUse) {
            showToast("No hay cajas registradoras disponibles", "error");
            return;
        }

        // Bloqueo síncrono antes de cualquier await (evita varios createIssuedDocument por doble clic / invocaciones concurrentes)
        isProcessingRef.current = true;
        setIsProcessing(true);

        try {
            let serial: string;
            try {
                const { data: serialsFetched } = await fetchSerialsForDocument({
                    variables: { documentId },
                });
                const serialList = (
                    serialsFetched?.serialsByDocument || []
                ).filter((ser: any) => ser.isActive !== false);
                if (serialList.length === 0) {
                    showToast(
                        "No hay serie activa para este documento",
                        "error",
                    );
                    return;
                }
                serial = serialList[0].serial || "";
            } catch {
                showToast(
                    "No se pudieron cargar las series del documento",
                    "error",
                );
                return;
            }

            // device_id = identificador del equipo cliente (MAC en Electron, getDeviceId en este equipo)
            const resolvedDeviceId = await getDeviceIdOrMac();
            const isMacAddress = resolvedDeviceId.includes(":");
            console.log(
                "📋 [PAGO] device_id final (equipo cliente) enviado en createIssuedDocument:",
                resolvedDeviceId,
                isMacAddress
                    ? "(MAC PC ✓)"
                    : "(id local — en Electron debería ser MAC si hay red)",
            );

            if (!isMacAddress) {
                console.warn(
                    "⚠️ [PAGO] device_id no tiene formato MAC. En escritorio use SumApp/Electron para que sea la MAC de la PC; impresión Raspberry/local puede depender de este valor.",
                );
            }

            const now = new Date();
            const emissionDate = formatLocalDateYYYYMMDD(now);
            const emissionTime = formatLocalTimeHHMMSS(now);

            // Solo lo que el cajero ve en pantalla (como en celular). Nada de mezclar ítems del servidor
            // que aún no se renderizaron: eso inflaba payment Total y fallaba la validación de montos.
            const availableDetails =
                modifiedDetails.length > 0
                    ? modifiedDetails
                    : filterCanceledDetails(
                          operation.details || [],
                          operation?.id,
                      );

            const operationIdForPay =
                normalizeGraphQLId(operation?.id) ||
                normalizeGraphQLId(table?.currentOperationId) ||
                null;
            if (!operationIdForPay) {
                showToast(
                    "No se encontró la operación a pagar. Vuelva al plano de mesas.",
                    "error",
                );
                return;
            }

            const { data: freshPayData } = await apolloClient.query({
                query: GET_OPERATION_BY_ID_FOR_CASH,
                variables: {
                    operationId: String(operationIdForPay),
                },
                fetchPolicy: "no-cache",
            });
            const freshOp = freshPayData?.operationById;
            if (!freshOp) {
                showToast(
                    "No se pudo verificar la orden antes del pago. Intente de nuevo.",
                    "error",
                );
                return;
            }
            if (freshOp.status === "COMPLETED") {
                showToast(
                    "Esta orden ya está completada en el servidor. Vuelva al plano de mesas.",
                    "error",
                );
                return;
            }

            const freshAvailable = filterCanceledDetails(
                freshOp.details || [],
                freshOp.id,
            );
            const visibleRealIds = new Set(
                availableDetails
                    .map((d) => getRealOperationDetailId(d))
                    .filter((id): id is string => Boolean(id)),
            );
            const serverHasUnseenUnpaidLines = freshAvailable.some((fr) => {
                const rid = getRealOperationDetailId(fr);
                return rid && !visibleRealIds.has(rid);
            });

            const payAssignments: Record<string, boolean> = {
                ...itemAssignments,
            };

            const selectedDetailIds = Object.keys(payAssignments).filter(
                (id) => payAssignments[id],
            );

            // Si hay productos seleccionados, filtrar solo esos
            let detailsToPay = availableDetails;
            if (selectedDetailIds.length > 0) {
                detailsToPay = availableDetails.filter((detail: any) => {
                    return selectedDetailIds.includes(String(detail.id));
                });

                if (detailsToPay.length === 0) {
                    showToast(
                        "No hay productos seleccionados para pagar",
                        "error",
                    );
                    return;
                }
            }

            // Parcial si no cubre todo lo visible o en el servidor hay líneas que esta pantalla aún no muestra
            const isPartialPayment =
                (selectedDetailIds.length > 0 &&
                    selectedDetailIds.length < availableDetails.length) ||
                serverHasUnseenUnpaidLines;

            const operationToPay = freshOp;

            // Preparar items para el documento usando los detalles seleccionados
            // Agrupar detalles por ID original (sin el sufijo -split si existe)
            // let items: any[] = [];
            // ==================================================
            // 🔑 PARTE CRÍTICA: AGRUPAR POR ID REAL
            // ==================================================
            const groupedByRealId: Record<
                string,
                {
                    details: any[];
                    totalQuantity: number;
                    totalLineDiscount: number;
                }
            > = {};
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
                        totalQuantity: 0,
                        totalLineDiscount: 0,
                    };
                }

                groupedByRealId[realId].details.push(detail);
                groupedByRealId[realId].totalQuantity +=
                    Number(detail.quantity) || 0;
                groupedByRealId[realId].totalLineDiscount = roundMoney2(
                    groupedByRealId[realId].totalLineDiscount +
                        getDetailLineDiscount(detail),
                );

                console.log(
                    `  ✅ Agregado al grupo ${realId} (qty total: ${groupedByRealId[realId].totalQuantity})`,
                );
            });

            // Validar que no haya items inválidos
            if (invalidDetails.length > 0) {
                console.error(
                    "❌ ITEMS INVÁLIDOS:",
                    invalidDetails.map((d) => d.id),
                );
                showToast(
                    "Error: No se pudieron validar todos los productos.",
                    "error",
                );
                return;
            }

            // ==================================================
            // 🔑 CREAR ITEMS CON IDs REALES
            // ==================================================
            const items = Object.entries(groupedByRealId).map(
                ([realId, group]) => {
                    const firstDetail = group.details[0];

                    const unitPrice = Number(firstDetail.unitPrice) || 0;
                    return {
                        operationDetailId: realId, // ✅ USAR ID REAL, NO EL ID DIVIDIDO
                        quantity: group.totalQuantity,
                        unitValue: unitValueFromInclusivePrice(
                            unitPrice,
                            igvPercentage,
                        ),
                        unitPrice,
                        discount: group.totalLineDiscount || 0,
                        notes: firstDetail.notes || "",
                    };
                },
            );

            console.log("✅ Items a enviar:", items);

            // Calcular totales para el pago (con descuento aplicado)
            // NOTA: Los precios unitarios ya incluyen IGV
            const rawPaymentGross = detailsToPay.reduce(
                (sum: number, detail: any) => {
                    const quantity = Number(detail.quantity) || 0;
                    const unitPrice = Number(detail.unitPrice) || 0;
                    return sum + quantity * unitPrice;
                },
                0,
            );
            const paymentItemsDiscount = roundMoney2(
                detailsToPay.reduce(
                    (sum: number, detail: any) =>
                        sum + getDetailLineDiscount(detail),
                    0,
                ),
            );
            const paymentAfterItemDiscount = Math.max(
                0,
                rawPaymentGross - paymentItemsDiscount,
            );
            const payPct = Number(discountPercent) || 0;
            const paymentGlobalDiscount = Math.max(
                0,
                payPct > 0
                    ? roundMoney2((paymentAfterItemDiscount * payPct) / 100)
                    : Number(discountAmount) || 0,
            );
            const paymentTotalDiscount = roundMoney2(
                paymentItemsDiscount + paymentGlobalDiscount,
            );
            const paymentTotal = Math.max(
                0,
                paymentAfterItemDiscount - paymentGlobalDiscount,
            );
            const igvDecimal = igvPercentage / 100;
            const paymentSubtotal = parseFloat(
                (
                    Math.round((paymentTotal / (1 + igvDecimal)) * 100) / 100
                ).toFixed(2),
            );
            const paymentIgvAmount = parseFloat(
                (
                    Math.round((paymentTotal - paymentSubtotal) * 100) / 100
                ).toFixed(2),
            );

            // Validar que la suma de pagos sea al menos el total a pagar (permite pagar de más y dar vuelto; total 0 no exige montos > 0)
            const totalPaymentsAmount = payments.reduce(
                (sum, p) => sum + (Number(p.amount) || 0),
                0,
            );
            if (
                paymentTotal > 0.01 &&
                totalPaymentsAmount < paymentTotal - 0.01
            ) {
                showToast(
                    `La suma de los pagos (${currencyFormatter.format(totalPaymentsAmount)}) debe ser al menos el total a pagar (${currencyFormatter.format(paymentTotal)})`,
                    "error",
                );
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
                paymentsToSend = [
                    {
                        cashRegisterId: cashRegisterIdToUse,
                        paymentType: "CASH",
                        paymentMethod: payments[0]?.method || "CASH",
                        transactionType: "INCOME",
                        totalAmount: 0,
                        paidAmount: 0,
                        paymentDate: formatInstantISO(now),
                        dueDate: null,
                        referenceNumber: null,
                        notes: null,
                    },
                ];
            } else if (Math.abs(totalPaymentsAmount - paymentTotal) <= 0.01) {
                // Monto exacto: usar los pagos tal cual
                paymentsToSend = payments
                    .filter((p) => Number(p.amount) > 0)
                    .map((p) => ({
                        cashRegisterId: cashRegisterIdToUse,
                        paymentType: "CASH",
                        paymentMethod: p.method,
                        transactionType: "INCOME",
                        totalAmount: Number(p.amount),
                        paidAmount: Number(p.amount),
                        paymentDate: formatInstantISO(now),
                        dueDate: null,
                        referenceNumber: paymentMethodSendsReference(p.method)
                            ? p.referenceNumber || null
                            : null,
                        notes: null,
                    }));
            } else {
                // Cliente pagó de más (habrá vuelto): enviar un solo pago por el monto del documento
                const firstPayment = payments.find((p) => Number(p.amount) > 0);
                paymentsToSend = [
                    {
                        cashRegisterId: cashRegisterIdToUse,
                        paymentType: "CASH",
                        paymentMethod: firstPayment?.method || "CASH",
                        transactionType: "INCOME",
                        totalAmount: paymentTotal,
                        paidAmount: paymentTotal,
                        paymentDate: formatInstantISO(now),
                        dueDate: null,
                        referenceNumber: null,
                        notes: null,
                    },
                ];
            }

            if (paymentsToSend.length === 0) {
                showToast(
                    "Debe agregar al menos un pago con monto mayor a 0",
                    "error",
                );
                return;
            }

            // Igual que SumApp Android (CashViewModel): siempre enviar tableId de la mesa.
            // El backend solo libera la mesa si is_fully_paid(); no usar null en parciales en web.
            const payOperationId = normalizeGraphQLId(operationToPay.id);
            if (!payOperationId) {
                showToast(
                    "La operación no tiene un identificador válido. Vuelva al plano de mesas.",
                    "error",
                );
                return;
            }

            const payBranchId = normalizeGraphQLId(companyData?.branch?.id);
            const payUserId = normalizeGraphQLId(user.id);
            const payDocumentIdValue = normalizeGraphQLId(documentId);
            if (!payBranchId || !payUserId || !payDocumentIdValue) {
                showToast(
                    "Faltan datos de sucursal, usuario o documento para el pago.",
                    "error",
                );
                return;
            }

            const payCashRegisterId = normalizeGraphQLId(cashRegisterIdToUse);
            if (!payCashRegisterId) {
                showToast("La caja registradora seleccionada no es válida.", "error");
                return;
            }

            const sanitizedItems = items.filter((item) =>
                Boolean(normalizeGraphQLId(item.operationDetailId)),
            );
            if (sanitizedItems.length === 0) {
                showToast(
                    "No hay líneas válidas para facturar. Revise los productos.",
                    "error",
                );
                return;
            }

            const tableIdForPayment = normalizeGraphQLId(table?.id) || null;

            const variables = {
                operationId: payOperationId,
                branchId: payBranchId,
                documentId: payDocumentIdValue,
                serial: serial,
                personId: normalizeGraphQLId(selectedClientId) || null,
                userId: payUserId,
                emissionDate: emissionDate,
                emissionTime: emissionTime,
                currency: "PEN",
                exchangeRate: 1.0,
                itemsTotalDiscount: paymentItemsDiscount,
                globalDiscount: paymentGlobalDiscount,
                globalDiscountPercent: Number(discountPercent) || 0,
                totalDiscount: paymentTotalDiscount,
                globalDiscountOnTotal: paymentGlobalDiscount,
                igvPercent: igvPercentage,
                igvAmount: paymentIgvAmount,
                totalTaxable: paymentSubtotal,
                totalUnaffected: 0.0,
                totalExempt: 0.0,
                totalFree: 0.0,
                totalAmount: paymentTotal,
                items: sanitizedItems.map((item) => ({
                    ...item,
                    operationDetailId: normalizeGraphQLId(
                        item.operationDetailId,
                    ) as string,
                })),
                payments: paymentsToSend.map((payment) => ({
                    ...payment,
                    cashRegisterId: payCashRegisterId,
                })),
                notes: null,
                tableId: tableIdForPayment,
                deviceId: resolvedDeviceId,
                shouldPrint,
            };

            // 🧪 LOG COMPLETO ANTES DEL PAGO - ESPECIALMENTE PARA PAGOS PARCIALES
            console.log(
                "═══════════════════════════════════════════════════════════",
            );
            console.log(
                `💰 ${isPartialPayment ? "PAGO PARCIAL" : "PAGO COMPLETO"}`,
            );
            console.log(
                "═══════════════════════════════════════════════════════════",
            );
            console.log("📋 INFORMACIÓN DE LA OPERACIÓN:");
            console.log(`   - ID de Operación: ${operationToPay.id}`);
            console.log(
                `   - Tipo de pago: ${isPartialPayment ? "PARCIAL" : "COMPLETO"}`,
            );
            console.log(`   - Mesa ID: ${table?.id || "N/A"}`);
            console.log(
                `   - TableId para pago (siempre si hay mesa, como Android): ${tableIdForPayment || "null"}`,
            );
            console.log("");
            console.log("📄 INFORMACIÓN DEL DOCUMENTO:");
            // ✅ Obtener información completa del documento seleccionado
            const selectedDocument = documents.find(
                (doc: any) => String(doc.id) === String(documentId),
            );
            const documentCode = selectedDocument?.code || "N/A";
            const documentDescription = selectedDocument?.description || "N/A";
            const isBillableDocument =
                documentCode === "01" || documentCode === "03"; // FACTURA o BOLETA
            console.log(`   - ID de Documento: ${documentId}`);
            console.log(
                `   - Código de Documento: ${documentCode} (${documentDescription})`,
            );
            console.log(
                `   - Es documento facturable (01/FACTURA o 03/BOLETA): ${isBillableDocument ? "SÍ ✅" : "NO ⚠️"}`,
            );
            console.log(
                `   - Facturación habilitada en sucursal: ${companyData?.branch?.isBilling ? "SÍ ✅" : "NO ⚠️"}`,
            );
            if (isBillableDocument && companyData?.branch?.isBilling) {
                console.log(
                    `   ✅ Este documento será enviado a SUNAT automáticamente`,
                );
            } else {
                if (!isBillableDocument) {
                    console.log(
                        `   ⚠️ Documento con código '${documentCode}' NO se enviará a SUNAT (solo se envían 01/FACTURA y 03/BOLETA)`,
                    );
                }
                if (!companyData?.branch?.isBilling) {
                    console.log(
                        `   ⚠️ Facturación electrónica deshabilitada en esta sucursal`,
                    );
                }
            }
            console.log(`   - Serie: ${serial}`);
            console.log(`   - ID de Sucursal: ${companyData?.branch.id}`);
            console.log(`   - ID de Usuario: ${user.id}`);
            console.log(`   - Fecha de Emisión: ${emissionDate}`);
            console.log(`   - Hora de Emisión: ${emissionTime}`);
            console.log("");
            console.log("📊 CÁLCULOS Y TOTALES:");
            console.log(`   - Porcentaje de IGV: ${igvPercentage}%`);
            console.log(
                `   - Subtotal: ${currencyFormatter.format(paymentSubtotal)}`,
            );
            console.log(
                `   - Monto de IGV: ${currencyFormatter.format(paymentIgvAmount)}`,
            );
            console.log(
                `   - Monto Total: ${currencyFormatter.format(paymentTotal)}`,
            );
            console.log("");
            console.log("📦 ITEMS A PAGAR:");
            console.log(`   - Cantidad de items: ${items.length}`);
            items.forEach((item, index) => {
                console.log(
                    `   ${index + 1}. ID de Detalle de Operación: ${item.operationDetailId}`,
                );
                console.log(`      - Cantidad: ${item.quantity}`);
                console.log(
                    `      - Valor Unitario: ${currencyFormatter.format(item.unitValue)}`,
                );
                console.log(
                    `      - Precio Unitario: ${currencyFormatter.format(item.unitPrice)}`,
                );
                console.log(
                    `      - Subtotal del Item: ${currencyFormatter.format(item.quantity * item.unitPrice)}`,
                );
                if (item.notes) {
                    console.log(`      - Notas: ${item.notes}`);
                }
            });
            console.log("");
            console.log("💳 INFORMACIÓN DE PAGO:");
            paymentsToSend.forEach((payment, index) => {
                console.log(`   Pago ${index + 1}:`);
                console.log(
                    `      - ID de Caja Registradora: ${payment.cashRegisterId}`,
                );
                console.log(`      - Tipo de Pago: ${payment.paymentType}`);
                console.log(`      - Método de Pago: ${payment.paymentMethod}`);
                console.log(
                    `      - Tipo de Transacción: ${payment.transactionType}`,
                );
                console.log(
                    `      - Monto Total: ${currencyFormatter.format(payment.totalAmount)}`,
                );
                console.log(
                    `      - Monto Pagado: ${currencyFormatter.format(payment.paidAmount)}`,
                );
                if (payment.referenceNumber) {
                    console.log(
                        `      - Número de Referencia: ${payment.referenceNumber}`,
                    );
                }
            });
            console.log("");
            console.log("🖨️ IMPRESIÓN (device_id = equipo PC cliente):");
            console.log(
                `   - deviceId (PC / esta máquina): ${resolvedDeviceId || "No disponible"}`,
            );
            console.log(`   - ID de Impresora: No especificado`);
            console.log("");
            if (isPartialPayment) {
                console.log("⚠️ PAGO PARCIAL DETECTADO:");
                console.log(
                    `   - Productos seleccionados para pagar: ${selectedDetailIds.length}`,
                );
                console.log(
                    `   - Productos totales disponibles: ${availableDetails.length}`,
                );
                console.log(
                    `   - Productos que quedan por pagar: ${availableDetails.length - selectedDetailIds.length}`,
                );
                console.log(`   - TableId será null (mesa NO se liberará)`);
            }
            console.log(
                "═══════════════════════════════════════════════════════════",
            );
            console.log("📤 Enviando mutación CREATE_ISSUED_DOCUMENT...");
            console.log(
                "═══════════════════════════════════════════════════════════",
            );
            console.log("");

            // ⚠️ GUARDAR información de items facturados ANTES de enviar (para usar después del refetch)
            // Esto nos permite calcular remainingQuantity localmente si el backend no lo devuelve
            const facturedItemsMap = new Map<string, number>(); // operationDetailId (string) -> cantidad facturada
            items.forEach((item: any) => {
                const detailId = String(item.operationDetailId); // Asegurar que sea string
                const qty = Number(item.quantity) || 0;
                const existingQty = facturedItemsMap.get(detailId) || 0;
                facturedItemsMap.set(detailId, existingQty + qty);
            });

            console.log("✅ Enviando mutación al backend...");
            console.log(
                "   - Items facturados (para cálculo local):",
                Array.from(facturedItemsMap.entries()).map(
                    ([id, qty]) => `ID:${id}=${qty}`,
                ),
            );

            const result = await createIssuedDocumentMutation({
                variables,
            });

            if (result.data?.createIssuedDocument?.success) {
                // El documento (boleta/factura) se ha creado exitosamente
                // El backend debería haber impreso el documento si deviceId estaba disponible

                const issuedDocResult = result.data
                    .createIssuedDocument as typeof result.data.createIssuedDocument & {
                    print_locally?: boolean;
                    print_via_bluetooth?: boolean;
                    document_data?: string | null;
                };
                if (shouldPrint) {
                    const printLocallyFlag =
                        issuedDocResult?.printLocally === true ||
                        issuedDocResult?.print_locally === true;

                    const localPrintOk = await invokeLocalIssuedDocumentPrint(
                        {
                            printLocally:
                                issuedDocResult?.printLocally ??
                                issuedDocResult?.print_locally,
                            printViaBluetooth:
                                issuedDocResult?.printViaBluetooth ??
                                issuedDocResult?.print_via_bluetooth,
                            documentData:
                                issuedDocResult?.documentData ??
                                issuedDocResult?.document_data ??
                                null,
                        },
                        {
                            label: isPartialPayment
                                ? "pago parcial"
                                : "pago completo",
                            operationId: variables.operationId,
                            deviceId: variables.deviceId ?? null,
                            localPrinterName:
                                getLocalTicketPrinterStorage().trim() ||
                                selectedLocalPrinterName.trim() ||
                                null,
                        },
                    );

                    if (printLocallyFlag && !localPrintOk) {
                        showToast(
                            "El pago se registró, pero no se pudo imprimir en la impresora local. Recompile SumApp (npm run build-electron), revise el nombre de la impresora o use la predeterminada de Windows.",
                            "warning",
                        );
                    }
                }

                // ✅ VERIFICAR SI EL DOCUMENTO SERÁ ENVIADO A SUNAT
                const selectedDocumentOk = documents.find(
                    (doc: any) => String(doc.id) === String(documentId),
                );
                const documentCode = selectedDocumentOk?.code || "";
                const documentDescription =
                    selectedDocumentOk?.description || "";
                const isBillableDocument =
                    documentCode === "01" || documentCode === "03"; // FACTURA o BOLETA
                const isBranchBillingEnabled =
                    companyData?.branch?.isBilling || false;

                if (isBillableDocument && isBranchBillingEnabled) {
                    console.log(
                        "✅ SUNAT: El documento será enviado a facturación electrónica",
                    );
                    console.log(
                        `  - Tipo: ${documentDescription} (Código: ${documentCode})`,
                    );
                    console.log(
                        `  - Serial: ${result.data?.createIssuedDocument?.issuedDocument?.serial || "N/A"}`,
                    );
                    console.log(
                        `  - Número: ${result.data?.createIssuedDocument?.issuedDocument?.number || "N/A"}`,
                    );
                    console.log(
                        `  - Proceso: ${isPartialPayment ? "PAGO PARCIAL" : "PAGO COMPLETO"}`,
                    );
                } else {
                    if (!isBillableDocument) {
                        console.log(
                            `ℹ️ SUNAT: Documento "${documentDescription}" (Código: ${documentCode}) no se enviará a SUNAT`,
                        );
                        console.log(
                            "   - Solo se envían FACTURAS (01) y BOLETAS (03)",
                        );
                    }
                    if (!isBranchBillingEnabled) {
                        console.log(
                            "ℹ️ SUNAT: La sucursal no tiene facturación electrónica habilitada",
                        );
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
                    fetchPolicy: "network-only",
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
                        refetchResult.data.operationById.id,
                    );
                    setModifiedDetails(freshDetails);

                    // Calcular el nuevo total restante
                    const newTotal = freshDetails.reduce(
                        (sum: number, detail: any) => {
                            const quantity = Number(detail.quantity) || 0;
                            const unitPrice = Number(detail.unitPrice) || 0;
                            return sum + quantity * unitPrice;
                        },
                        0,
                    );

                    // Actualizar el monto del pago para reflejar lo que falta pagar
                    setPayments([
                        {
                            id: String(Date.now()),
                            method: "CASH",
                            amount: roundMoney2(newTotal),
                            referenceNumber: "",
                        },
                    ]);

                    console.log(
                        "✅ Pago parcial completado - Detalles actualizados desde el backend:",
                        freshDetails.length,
                    );
                    console.log(
                        "💰 Monto actualizado para el siguiente pago:",
                        newTotal,
                    );
                } else {
                    // Pago que en la UI se interpretó como "completo" (todos los checks).
                    // Liberar mesa en UI solo si el backend lo indicó (como LaunchedEffect en Android).
                    const wasTableFreedFlag =
                        result.data?.createIssuedDocument?.wasTableFreed ===
                        true;
                    const wasCompletedFlag =
                        result.data?.createIssuedDocument?.wasCompleted ===
                        true;
                    const refetchedOperation =
                        refetchResult.data?.operationById;

                    if (
                        (wasTableFreedFlag || wasCompletedFlag) &&
                        table?.id &&
                        updateTableInContext
                    ) {
                        const freedTable =
                            result.data?.createIssuedDocument?.table;
                        updateTableInContext({
                            id: table.id,
                            status: freedTable?.status || "AVAILABLE",
                            currentOperationId: null,
                            occupiedById: null,
                            userName: null,
                        });
                        notifyTableUpdate(
                            table.id,
                            freedTable?.status || "AVAILABLE",
                            null,
                            null,
                            null,
                        );
                        console.log(
                            "✅ Mesa liberada (wasTableFreed/wasCompleted del backend) - mesa:",
                            table.id,
                        );
                    } else if (
                        !refetchedOperation &&
                        table?.id &&
                        updateTableInContext
                    ) {
                        updateTableInContext({
                            id: table.id,
                            status: "AVAILABLE",
                            currentOperationId: null,
                            occupiedById: null,
                            userName: null,
                        });
                        notifyTableUpdate(
                            table.id,
                            "AVAILABLE",
                            null,
                            null,
                            null,
                        );
                        console.log(
                            "✅ Mesa liberada - operación ya no existe para mesa:",
                            table.id,
                        );
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
                showToast(
                    result.data?.createIssuedDocument?.message ||
                        "Error al procesar el pago",
                    "error",
                );
            }
        } catch (err: any) {
            console.error("❌ ERROR:", err);
            console.error("Error procesando pago:", err);
            showToast(err.message || "Error al procesar el pago", "error");
        } finally {
            // ⚠️ Siempre resetear ambos flags al finalizar
            isProcessingRef.current = false;
            setIsProcessing(false);
        }
    };

    const handlePrecuenta = async () => {
        const logPp = (msg: string, extra?: unknown) => {
            if (extra !== undefined) {
                console.log(`[PrintPartialPrecuenta] ${msg}`, extra);
            } else {
                console.log(`[PrintPartialPrecuenta] ${msg}`);
            }
        };

        if (!operation || !table?.id || !companyData?.branch.id || !user?.id) {
            logPp("abort: faltan operation, mesa, sucursal o usuario");
            showToast("No hay orden", "error");
            return;
        }
        if (operation.status === "COMPLETED") {
            logPp("abort: operación COMPLETED", { operationId: operation.id });
            showToast("Orden completada", "error");
            return;
        }
        setIsProcessing(true);
        try {
            const resolvedDeviceId = await getDeviceIdOrMac();
            if (!resolvedDeviceId?.trim()) {
                logPp("abort: sin deviceId");
                showToast("No se pudo identificar el equipo", "error");
                return;
            }
            const selectedDetailIds = Object.keys(itemAssignments).filter(
                (id) => itemAssignments[id],
            );
            logPp("filas UI seleccionadas (itemAssignments)", {
                count: selectedDetailIds.length,
                rowIds: selectedDetailIds,
            });
            if (selectedDetailIds.length === 0) {
                showToast("Selecciona ítems para precuenta", "error");
                return;
            }

            const qtyByRealDetailId = new Map<string, number>();
            for (const rowId of selectedDetailIds) {
                const row = detailsToUse.find(
                    (d: any) => String(d.id) === String(rowId),
                );
                if (!row) continue;
                const realId = getRealOperationDetailId(row);
                if (!realId) continue;
                const q = Number(row.quantity) || 0;
                if (q <= 0) continue;
                qtyByRealDetailId.set(
                    realId,
                    (qtyByRealDetailId.get(realId) || 0) + q,
                );
            }
            const detailItems = Array.from(qtyByRealDetailId.entries()).map(
                ([id, quantity]) => ({ id, quantity }),
            );
            logPp(
                "payload para backend detailItems (id BD + cantidad agregada)",
                detailItems,
            );
            if (detailItems.length === 0) {
                logPp("abort: detailItems vacío tras agregar por detalle real");
                showToast("No hay cantidades válidas para precuenta", "error");
                return;
            }

            const variables = {
                operationId: normalizeGraphQLId(operation.id) as string,
                detailItems,
                tableId: normalizeGraphQLId(table.id) as string,
                branchId: normalizeGraphQLId(companyData.branch.id) as string,
                userId: normalizeGraphQLId(user.id) as string,
                deviceId: resolvedDeviceId,
            };
            logPp("mutación printPartialPrecuenta variables", variables);

            const res = await printPartialPrecuentaMutation({
                variables,
            });
            if (res.errors?.length) {
                logPp("respuesta con errores GraphQL", res.errors);
            }
            logPp("respuesta GraphQL (raw)", res.data?.printPartialPrecuenta);

            if (res.data?.printPartialPrecuenta?.success) {
                const partialRes = res.data
                    .printPartialPrecuenta as typeof res.data.printPartialPrecuenta & {
                    print_locally?: boolean;
                    printLocally?: boolean;
                    document_data?: string | null;
                    documentData?: string | null;
                };
                const printLocallyFlag =
                    partialRes?.printLocally === true ||
                    partialRes?.print_locally === true;
                const docData =
                    partialRes?.documentData ??
                    partialRes?.document_data ??
                    null;
                logPp("éxito servidor", {
                    message: partialRes?.message,
                    printLocally: printLocallyFlag,
                    documentDataChars:
                        docData != null && String(docData).trim() !== ""
                            ? String(docData).length
                            : 0,
                    tableStatus: partialRes?.table?.status,
                });

                const localPrintOk = await invokeLocalIssuedDocumentPrint(
                    {
                        printLocally:
                            partialRes?.printLocally ??
                            partialRes?.print_locally,
                        documentData: docData,
                    },
                    {
                        label: "precuenta parcial",
                        operationId: operation.id,
                        deviceId: resolvedDeviceId,
                        localPrinterName:
                            getLocalTicketPrinterStorage().trim() ||
                            selectedLocalPrinterName.trim() ||
                            null,
                    },
                );
                logPp("impresión local (invokeLocalIssuedDocumentPrint)", {
                    printLocallyFlag,
                    localPrintOk,
                });

                if (printLocallyFlag && !localPrintOk) {
                    showToast(
                        "La precuenta se registró, pero no se pudo imprimir en la impresora local. Revise la impresora o SumApp Electron.",
                        "warning",
                    );
                }

                const t = res.data.printPartialPrecuenta.table || table;
                try {
                    await updateTableStatusMutation({
                        variables: {
                            tableId: table.id,
                            status: "TO_PAY",
                            userId: user.id,
                        },
                    });
                } catch (e) {}
                updateTableInContext?.({
                    id: t.id,
                    status: "TO_PAY",
                    currentOperationId: t.currentOperationId,
                    occupiedById: t.occupiedById,
                    userName: t.userName,
                });
                notifyTableUpdate(
                    t.id,
                    "TO_PAY",
                    t.currentOperationId,
                    t.occupiedById,
                    t.userName,
                );
                if (onTableChange)
                    onTableChange({ ...table, status: "TO_PAY" });
                await refetch();
                if (onPaymentSuccess) onPaymentSuccess();
                logPp("flujo OK: mesa TO_PAY, refetch hecho");
                showToast("Precuenta enviada exitosamente", "success");
            } else {
                logPp("error lógico (success=false)", {
                    message: res.data?.printPartialPrecuenta?.message,
                    data: res.data?.printPartialPrecuenta,
                });
                showToast(
                    res.data?.printPartialPrecuenta?.message ||
                        "Error al enviar precuenta",
                    "error",
                );
            }
        } catch (e: any) {
            console.error("[PrintPartialPrecuenta] excepción", e);
            showToast(e.message, "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelOperation = async () => {
        if (!canVoidInCashPay) {
            showToast(
                "No tienes permiso para anular la orden en caja.",
                "error",
            );
            return;
        }
        if (!cancellationReason.trim()) {
            showToast("Indica el motivo de la anulación.", "error");
            return;
        }
        setIsProcessing(true);
        try {
            const deviceId = await getDeviceIdOrMac();
            const res = await cancelOperationMutation({
                variables: {
                    operationId: operation?.id,
                    branchId: companyData?.branch.id,
                    userId: user?.id,
                    cancellationReason: cancellationReason.trim(),
                    deviceId,
                },
            });
            if (res.data?.cancelOperation?.success) {
                setCancellationReason("");
                setShowCancelOperationModal(false);
                updateTableInContext?.({
                    id: table?.id || "",
                    status: "AVAILABLE",
                    currentOperationId: null,
                    occupiedById: null,
                    userName: null,
                });
                onBack();
            }
        } catch (e: any) {
            showToast(e.message, "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTransferPlates = async () => {
        if (!selectedTransferTableId) {
            showToast("Selecciona mesa destino", "error");
            return;
        }
        setIsProcessing(true);
        try {
            const res = await transferItemsMutation({
                variables: {
                    fromOperationId: operation?.id,
                    toTableId: selectedTransferTableId,
                    detailIds: selectedDetailIds,
                    branchId: companyData?.branch.id,
                },
            });
            if (res.data?.transferItems?.success) {
                const transferData = res.data.transferItems;
                const oldTable = transferData.oldTable;
                const fromOperation = transferData.fromOperation;
                const remainingDetails = (fromOperation?.details ?? []).filter(
                    (d: { isCanceled?: boolean }) => !d.isCanceled,
                );
                const originTableFreed =
                    oldTable?.status === "AVAILABLE" ||
                    oldTable?.currentOperationId == null ||
                    remainingDetails.length === 0;

                await refetch();
                setShowTransferPlatesModal(false);

                if (originTableFreed) {
                    await releaseOriginTableSessionLock(
                        oldTable?.id ?? table?.id,
                    );
                    if (oldTable && updateTableInContext) {
                        updateTableInContext({
                            id: oldTable.id,
                            status: oldTable.status,
                            currentOperationId:
                                oldTable.currentOperationId ?? null,
                            occupiedById: oldTable.occupiedById ?? null,
                            userName: oldTable.userName ?? null,
                        });
                    }
                    notifyTableStatusUpdate(
                        oldTable ?? {
                            id: table?.id ?? "",
                            status: "AVAILABLE",
                            currentOperationId: null,
                            occupiedById: null,
                            userName: null,
                        },
                    );
                    onBack();
                }
            }
        } catch (e: any) {
            showToast(e.message, "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleChangeTable = async () => {
        setIsProcessing(true);
        try {
            const res = await changeOperationTableMutation({
                variables: {
                    operationId: operation?.id,
                    newTableId: selectedTableId,
                    branchId: companyData?.branch.id,
                },
            });
            if (res.data?.changeOperationTable?.success) {
                const changeData = res.data.changeOperationTable;
                const oldTable = changeData.oldTable;
                await releaseOriginTableSessionLock(oldTable?.id ?? table?.id);
                if (oldTable && updateTableInContext) {
                    updateTableInContext({
                        id: oldTable.id,
                        status: oldTable.status,
                        currentOperationId: null,
                        occupiedById: null,
                        userName: null,
                    });
                }
                notifyTableStatusUpdate(
                    oldTable ?? {
                        id: table?.id ?? "",
                        status: "AVAILABLE",
                        currentOperationId: null,
                        occupiedById: null,
                        userName: null,
                    },
                );
                onBack();
            }
        } catch (e: any) {
            showToast(e.message, "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleChangeUser = async () => {
        setIsProcessing(true);
        try {
            const res = await changeOperationUserMutation({
                variables: {
                    operationId: operation?.id,
                    newUserId: selectedUserId,
                    branchId: companyData?.branch.id,
                },
            });
            if (res.data?.changeOperationUser?.success) {
                await refetch();
                setShowChangeUserModal(false);
            }
        } catch (e: any) {
            showToast(e.message, "error");
        } finally {
            setIsProcessing(false);
        }
    };

    // Obtener lista de mozos disponibles: del servidor cuando el modal está abierto (evita caché al agregar empleados)
    const serverUsers = (usersData?.usersByBranch || []).filter(
        (u: any) => u.isActive !== false,
    );
    const contextUsers = (companyData?.branch?.users || []).filter(
        (u: any) => u.isActive !== false,
    );
    const availableUsers = showChangeUserModal
        ? serverUsers.length > 0
            ? serverUsers
            : contextUsers
        : contextUsers;

    const resolvedFloorName = useMemo(() => {
        if (!table) return null;
        if (table.floorName) return table.floorName;
        const floors = companyData?.branch?.floors;
        if (!floors?.length) return null;
        for (const f of floors) {
            if (f.tables?.some((t: any) => String(t.id) === String(table.id)))
                return f.name;
        }
        return null;
    }, [table, companyData?.branch?.floors]);

    /** Mozo asignado a la operación (API) o nombre en contexto de mesa (floor). */
    const resolvedWaiterName = useMemo(() => {
        const u = operation?.user as
            | {
                  fullName?: string | null;
                  firstName?: string | null;
                  lastName?: string | null;
              }
            | null
            | undefined;
        if (u) {
            const fn =
                (u.fullName && String(u.fullName).trim()) ||
                [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
            if (fn) return fn;
        }
        if (table?.userName && String(table.userName).trim())
            return String(table.userName).trim();
        return null;
    }, [operation?.user, table?.userName]);

    if (!table) return null;

    return (
        <div
            style={{
                height: "100%",
                maxHeight: "100%",
                display: "flex",
                flexDirection: "column",
                background: "#f8fafc",
                overflow: "hidden",
                fontFamily: "'Inter', sans-serif",
            }}
        >
            <header
                className="border-b border-slate-200 bg-white/95 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
                style={{
                    flexShrink: 0,
                    padding: isNarrow ? "0.5rem" : "0.65rem 1rem",
                    display: "flex",
                    flexDirection: isNarrow ? "column" : "row",
                    justifyContent: "space-between",
                    alignItems: isNarrow ? "stretch" : "center",
                    gap: isNarrow ? "0.75rem" : "1rem",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        gap: "1rem",
                        alignItems: "center",
                    }}
                >
                    <button
                        onClick={onBack}
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        style={{
                            padding: "0.45rem 0.55rem",
                            cursor: "pointer",
                            fontSize: "1.125rem",
                            lineHeight: 1,
                        }}
                        aria-label="Volver"
                    >
                        ←
                    </button>
                    <div style={{ minWidth: 0 }}>
                        <div
                            className="text-slate-600 dark:text-slate-300"
                            style={{
                                fontSize: "0.8125rem",
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: "0.4rem 0.95rem",
                                lineHeight: 1.4,
                            }}
                        >
                            <span>
                                <span style={{ fontWeight: 700 }}>Piso:</span>{" "}
                                {resolvedFloorName ?? "—"}
                            </span>
                            <span aria-hidden>·</span>
                            <span>
                                <span style={{ fontWeight: 700 }}>Mozo:</span>{" "}
                                {resolvedWaiterName ?? "—"}
                            </span>
                        </div>
                        <div
                            className="text-slate-900 dark:text-slate-100"
                            style={{
                                fontWeight: 800,
                                fontSize: "1.2rem",
                                marginTop: "0.15rem",
                                letterSpacing: "0.01em",
                            }}
                        >
                            {table.name}
                        </div>
                    </div>
                </div>
                <div
                    style={{
                        display: isNarrow ? "grid" : "flex",
                        gridTemplateColumns: isXs
                            ? "repeat(2, 1fr)"
                            : isNarrow
                              ? "repeat(3, 1fr)"
                              : "none",
                        gap: isNarrow ? "0.4rem" : "0.5rem",
                    }}
                >
                    <button
                        onClick={() => setShowChangeTableModal(true)}
                        className="rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/45"
                        style={{
                            padding: isNarrow
                                ? "0.5rem 0.35rem"
                                : "0.45rem 0.6rem",
                            fontSize: isNarrow ? "0.65rem" : "0.7rem",
                            borderRadius: "6px",
                            cursor: "pointer",
                            width: isNarrow ? "auto" : "150px",
                            fontWeight: 600,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            lineHeight: 1.15,
                            textAlign: "center",
                        }}
                    >
                        <span>Cambiar</span>
                        <span>Mesa</span>
                    </button>
                    <button
                        onClick={() => setShowTransferPlatesModal(true)}
                        className="rounded-lg border border-slate-300 bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        style={{
                            padding: isNarrow
                                ? "0.5rem 0.35rem"
                                : "0.45rem 0.6rem",
                            fontSize: isNarrow ? "0.65rem" : "0.7rem",
                            borderRadius: "6px",
                            cursor: "pointer",
                            width: isNarrow ? "auto" : "150px",
                            fontWeight: 600,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            lineHeight: 1.15,
                            textAlign: "center",
                        }}
                    >
                        <span>Pasar</span>
                        <span>Platos</span>
                    </button>
                    <button
                        onClick={() => setShowChangeUserModal(true)}
                        className="rounded-lg border border-orange-200 bg-orange-50 text-orange-700 transition-colors hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/45"
                        style={{
                            padding: isNarrow
                                ? "0.6rem 0.4rem"
                                : "0.4rem 0.8rem",
                            fontSize: isNarrow ? "0.7rem" : "0.75rem",
                            borderRadius: "6px",
                            cursor: "pointer",
                            width: isNarrow ? "auto" : "150px",
                            fontWeight: 600,
                        }}
                    >
                        Mozo
                    </button>
                    <button
                        onClick={handlePrecuenta}
                        disabled={
                            !operation ||
                            operation.status === "COMPLETED" ||
                            isProcessing
                        }
                        className="rounded-lg border border-amber-200 bg-amber-50 text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/45"
                        style={{
                            padding: isNarrow
                                ? "0.6rem 0.4rem"
                                : "0.4rem 0.8rem",
                            fontSize: isNarrow ? "0.7rem" : "0.75rem",
                            borderRadius: "6px",
                            cursor: "pointer",
                            width: isNarrow ? "auto" : "150px",
                            fontWeight: 600,
                            opacity:
                                !operation ||
                                operation.status === "COMPLETED" ||
                                isProcessing
                                    ? 0.6
                                    : 1,
                        }}
                    >
                        Precuenta
                    </button>
                    <button
                        onClick={() => refetch()}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/45"
                        style={{
                            padding: "0.4rem 0.8rem",
                            fontSize: "0.75rem",
                            borderRadius: "4px",
                            cursor: "pointer",
                        }}
                    >
                        Refrescar
                    </button>
                </div>
            </header>

            <section
                className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                style={{
                    flexShrink: 0,
                    padding: isNarrow ? "0.5rem" : "0.5rem 1rem",
                    display: "flex",
                    flexDirection: isXs ? "column" : "row",
                    gap: isNarrow ? "0.5rem" : "1rem",
                    alignItems: isNarrow ? "stretch" : "center",
                }}
            >
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        gap: "0.4rem",
                        position: "relative",
                    }}
                >
                    <div
                        className="overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                        style={{
                            flex: 1,
                            display: "flex",
                            height: isNarrow ? "44px" : "50px",
                        }}
                    >
                        <input
                            type="text"
                            placeholder={
                                isXs
                                    ? "DNI/RUC..."
                                    : "Buscar cliente (DNI/RUC)..."
                            }
                            value={clientSearchTerm}
                            onFocus={() => setEnableBranchClientsQuery(true)}
                            onChange={(e) => {
                                setClientSearchTerm(e.target.value);
                                setSelectedClientId("");
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSearchSunat();
                                }
                            }}
                            className="bg-transparent text-slate-900 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                            style={{
                                flex: 1,
                                padding: "0.3rem 0.75rem",
                                border: "none",
                                fontSize: isNarrow ? "0.9rem" : "0.75rem",
                                outline: "none",
                            }}
                        />
                        <button
                            onClick={handleSearchSunat}
                            disabled={sunatSearchLoading}
                            title="Buscar en SUNAT"
                            className="border-l border-slate-300 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/45"
                            style={{
                                padding: "0 1rem",
                                cursor: sunatSearchLoading
                                    ? "not-allowed"
                                    : "pointer",
                            }}
                        >
                            🔍
                        </button>
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                            type="button"
                            onClick={() => setShowEditClientModal(true)}
                            disabled={!selectedClientId}
                            title="Editar Cliente"
                            className="rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/45"
                            style={{
                                padding: isNarrow ? "0 1rem" : "0.3rem 0.6rem",
                                fontSize: isNarrow ? "1.1rem" : "0.75rem",
                                borderRadius: "6px",
                                height: isNarrow ? "44px" : "auto",
                                cursor: !selectedClientId
                                    ? "not-allowed"
                                    : "pointer",
                                opacity: !selectedClientId ? 0.6 : 1,
                            }}
                        >
                            ✏️
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setEnableBranchClientsQuery(true);
                                setShowCreateClientModal(true);
                            }}
                            title="Nuevo Cliente"
                            className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/45"
                            style={{
                                padding: isNarrow ? "0 1rem" : "0.3rem 0.6rem",
                                fontSize: isNarrow ? "1.1rem" : "0.75rem",
                                borderRadius: "6px",
                                height: isNarrow ? "44px" : "auto",
                                cursor: "pointer",
                            }}
                        >
                            ➕
                        </button>
                    </div>

                    {clientSearchTerm &&
                        !selectedClientId &&
                        filteredClients.length > 0 && (
                            <div
                                className="rounded-md border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900"
                                style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    marginTop: "0.2rem",
                                    width: "250px",
                                    maxHeight: "200px",
                                    overflowY: "auto",
                                    zIndex: 100,
                                }}
                            >
                                <div
                                    onClick={() => {
                                        setSelectedClientId("");
                                        setClientSearchTerm("");
                                    }}
                                    className="cursor-pointer border-b border-slate-100 px-2 py-2 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                                    style={{
                                        fontSize: "0.75rem",
                                    }}
                                >
                                    Sin cliente (Consumidor final)
                                </div>
                                {filteredClients.map((client: any) => (
                                    <div
                                        key={client.id}
                                        onClick={() => {
                                            setSelectedClientId(client.id);
                                            setClientSearchTerm(
                                                client.name || "",
                                            );
                                        }}
                                        className="cursor-pointer border-b border-slate-100 px-2 py-2 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                                        style={{}}
                                    >
                                        <div
                                            className="text-slate-800 dark:text-slate-100"
                                            style={{
                                                fontSize: "0.75rem",
                                                fontWeight: 700,
                                            }}
                                        >
                                            {client.name}
                                        </div>
                                        <div
                                            className="text-slate-500 dark:text-slate-400"
                                            style={{
                                                fontSize: "0.65rem",
                                            }}
                                        >
                                            {client.documentType || "DNI"}:{" "}
                                            {client.documentNumber}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                </div>
            </section>

            <main
                className="bg-slate-50 dark:bg-slate-950"
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: isNarrow ? "column" : "row",
                    minHeight: 0,
                    overflowY: isNarrow ? "auto" : "hidden",
                    padding: isNarrow ? "0.25rem" : "0.5rem",
                    gap: isNarrow ? "0.75rem" : "0.5rem",
                }}
            >
                <section
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                    style={{
                        flex: isSmallDesktop ? "65%" : "70%",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <div
                        className="border-b border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        style={{
                            display: "grid",
                            gridTemplateColumns: isNarrow
                                ? "40px 40px 1fr 90px"
                                : "40px 40px 1fr 80px 80px 100px",
                            padding: isNarrow ? "0.6rem 0.4rem" : "0.5rem",
                            fontWeight: 800,
                            fontSize: isNarrow ? "0.75rem" : "0.7rem",
                        }}
                    >
                        <div>SEL</div>
                        <div>CANT</div>
                        <div>PRODUCTO</div>
                        <div style={{ textAlign: "right" }}>
                            {isNarrow ? "TOTAL" : "UNIT"}
                        </div>
                        {!isNarrow && (
                            <div style={{ textAlign: "right" }}>TOTAL</div>
                        )}
                        {!isNarrow && (
                            <div style={{ textAlign: "center" }}>OPC</div>
                        )}
                    </div>
                    <div
                        className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80"
                        style={{
                            padding: "0.35rem 0.5rem",
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: "0.5rem 0.75rem",
                            fontSize: "0.7rem",
                        }}
                    >
                        <span
                            className="text-slate-500 dark:text-slate-400"
                            style={{ fontWeight: 600 }}
                        >
                            Selección:
                        </span>

                        <label
                            className="inline-flex cursor-pointer items-center gap-1.5 text-slate-700 dark:text-slate-200"
                            style={{ userSelect: "none" }}
                        >
                            <input
                                type="checkbox"
                                checked={
                                    detailsToUse.length > 0 &&
                                    detailsToUse.every(
                                        (d: any) =>
                                            !!itemAssignments[String(d.id)],
                                    )
                                }
                                ref={(el) => {
                                    if (!el) return;
                                    const anyChecked = detailsToUse.some(
                                        (d: any) =>
                                            !!itemAssignments[String(d.id)],
                                    );
                                    const allChecked =
                                        detailsToUse.length > 0 &&
                                        detailsToUse.every(
                                            (d: any) =>
                                                !!itemAssignments[String(d.id)],
                                        );
                                    el.indeterminate =
                                        anyChecked && !allChecked;
                                }}
                                onChange={() => {
                                    const allOn =
                                        detailsToUse.length > 0 &&
                                        detailsToUse.every(
                                            (d: any) =>
                                                !!itemAssignments[String(d.id)],
                                        );
                                    if (allOn) handleDeselectAllLineItems();
                                    else handleSelectAllLineItems();
                                }}
                                disabled={
                                    !operation ||
                                    operation.status === "COMPLETED" ||
                                    detailsToUse.length === 0 ||
                                    isProcessing
                                }
                                style={{
                                    width: "16px",
                                    height: "16px",
                                    accentColor: "#4f46e5",
                                }}
                            />
                            Marcar todo
                        </label>
                        <label
                            className="inline-flex cursor-pointer items-center gap-1.5 text-slate-700 dark:text-slate-200"
                            style={{ userSelect: "none" }}
                        >
                            <input
                                type="checkbox"
                                checked={false}
                                onChange={() => {
                                    handleDeselectAllLineItems();
                                }}
                                disabled={
                                    !operation ||
                                    operation.status === "COMPLETED" ||
                                    detailsToUse.length === 0 ||
                                    isProcessing
                                }
                                style={{
                                    width: "16px",
                                    height: "16px",
                                    accentColor: "#64748b",
                                }}
                            />
                            Desmarcar todo
                        </label>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto" }}>
                        {detailsToUse.map((d: any) => {
                            const lineDiscount = getDetailLineDiscount(d);
                            const promotionName = getDetailPromotionName(d);
                            const lineGross =
                                (Number(d.quantity) || 0) *
                                (Number(d.unitPrice) || 0);
                            const lineNet = roundMoney2(
                                lineGross - lineDiscount,
                            );
                            const badgePromo = findBadgePromotion(
                                { id: d.productId, name: d.productName, ...d },
                                activePromotions,
                            );

                            return (
                                <div
                                    key={d.id}
                                    className={`${itemAssignments[d.id] ? "bg-sky-50 dark:bg-sky-900/20" : "bg-white dark:bg-slate-900"} border-b border-slate-100 dark:border-slate-800`}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: isNarrow
                                            ? "40px 40px 1fr 90px"
                                            : "40px 40px 1fr 80px 80px 100px",
                                        padding: isNarrow
                                            ? "0.75rem 0.4rem"
                                            : "0.5rem",
                                        fontSize: isNarrow
                                            ? "0.9rem"
                                            : "0.8rem",
                                        alignItems: "center",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={!!itemAssignments[d.id]}
                                        onChange={() =>
                                            handleToggleItemSelection(d.id)
                                        }
                                        style={{
                                            width: "20px",
                                            height: "20px",
                                            accentColor: "#4f46e5",
                                        }}
                                    />
                                    <div
                                        className="text-slate-800 dark:text-slate-100"
                                        style={{ fontWeight: 800 }}
                                    >
                                        {d.quantity}
                                    </div>
                                    <div className="text-slate-700 dark:text-slate-200">
                                        <div
                                            style={{
                                                fontWeight: 600,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.35rem",
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <span>{d.productName}</span>
                                            {badgePromo && (
                                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                                    {promotionBadgeLabel(
                                                        badgePromo,
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                        {lineDiscount > 0 && (
                                            <div className="mt-0.5 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                                <span>
                                                    Descuento: -
                                                    {currencyFormatter.format(
                                                        lineDiscount,
                                                    )}
                                                </span>
                                                {promotionName && (
                                                    <span className="text-slate-400 dark:text-slate-500">
                                                        ({promotionName})
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {d.productType === "PROMOTION" &&
                                            d.comboComponents?.length > 0 && (
                                                <div className="mt-1 space-y-0.5">
                                                    {d.comboComponents.map(
                                                        (
                                                            comp: any,
                                                            ci: number,
                                                        ) => (
                                                            <div
                                                                key={ci}
                                                                className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-300"
                                                            >
                                                                <span>•</span>
                                                                <span>
                                                                    {
                                                                        comp.productName
                                                                    }
                                                                </span>
                                                                {Number(
                                                                    comp.quantity,
                                                                ) > 1 && (
                                                                    <span className="text-slate-400 dark:text-slate-500">
                                                                        ×
                                                                        {
                                                                            comp.quantity
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                        {d.notes && (
                                            <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                                                {d.notes}
                                            </div>
                                        )}
                                        {isNarrow && (
                                            <div
                                                className="text-slate-500 dark:text-slate-400"
                                                style={{
                                                    fontSize: "0.7rem",
                                                    marginTop: "2px",
                                                }}
                                            >
                                                PU:{" "}
                                                {currencyFormatter.format(
                                                    d.unitPrice,
                                                )}
                                                {d.quantity > 1 &&
                                                    !String(d.id).includes(
                                                        "-split",
                                                    ) && (
                                                        <button
                                                            onClick={() =>
                                                                handleSplitItem(
                                                                    d.id,
                                                                )
                                                            }
                                                            className="ml-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                                            style={{
                                                                background:
                                                                    "none",
                                                                border: "none",
                                                                padding: 0,
                                                            }}
                                                        >
                                                            Dividir
                                                        </button>
                                                    )}
                                                {String(d.id).includes(
                                                    "-split",
                                                ) && (
                                                    <button
                                                        onClick={() =>
                                                            handleMergeItem(
                                                                d.id,
                                                            )
                                                        }
                                                        className="ml-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                                        style={{
                                                            background: "none",
                                                            border: "none",
                                                            padding: 0,
                                                        }}
                                                    >
                                                        Unir
                                                    </button>
                                                )}
                                                {canVoidInCashPay && (
                                                    <button
                                                        onClick={() =>
                                                            handleDeleteItem(
                                                                d.id,
                                                            )
                                                        }
                                                        className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                                        style={{
                                                            background: "none",
                                                            border: "none",
                                                            padding: 0,
                                                        }}
                                                    >
                                                        Quitar
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {isNarrow && (
                                        <div
                                            style={{
                                                textAlign: "right",
                                                fontWeight: 700,
                                            }}
                                        >
                                            {lineDiscount > 0 && (
                                                <div className="text-[0.65rem] font-normal text-slate-400 line-through dark:text-slate-500">
                                                    {currencyFormatter.format(
                                                        lineGross,
                                                    )}
                                                </div>
                                            )}
                                            {currencyFormatter.format(lineNet)}
                                        </div>
                                    )}
                                    {!isNarrow && (
                                        <>
                                            <div style={{ textAlign: "right" }}>
                                                {currencyFormatter.format(
                                                    d.unitPrice,
                                                )}
                                            </div>
                                            <div
                                                style={{
                                                    textAlign: "right",
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {lineDiscount > 0 && (
                                                    <div className="text-[0.65rem] font-normal text-slate-400 line-through dark:text-slate-500">
                                                        {currencyFormatter.format(
                                                            lineGross,
                                                        )}
                                                    </div>
                                                )}
                                                {currencyFormatter.format(
                                                    lineNet,
                                                )}
                                            </div>
                                            <div
                                                style={{ textAlign: "center" }}
                                            >
                                                {d.quantity > 1 &&
                                                    !String(d.id).includes(
                                                        "-split",
                                                    ) && (
                                                        <button
                                                            onClick={() =>
                                                                handleSplitItem(
                                                                    d.id,
                                                                )
                                                            }
                                                            className="text-lg"
                                                        >
                                                            ✂️
                                                        </button>
                                                    )}
                                                {String(d.id).includes(
                                                    "-split",
                                                ) && (
                                                    <button
                                                        onClick={() =>
                                                            handleMergeItem(
                                                                d.id,
                                                            )
                                                        }
                                                        className="text-lg"
                                                    >
                                                        🔗
                                                    </button>
                                                )}
                                                {canVoidInCashPay && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleDeleteItem(
                                                                d.id,
                                                            )
                                                        }
                                                        className="text-lg"
                                                        title="Quitar ítem"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div
                        className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                        style={{
                            padding: "0.5rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-end",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                            }}
                        >
                            <div
                                className="text-slate-500 dark:text-slate-400"
                                style={{
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                }}
                            >
                                Descuentos:
                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    gap: "0.5rem",
                                    flexWrap: "wrap",
                                }}
                            >
                                <input
                                    type="number"
                                    placeholder="Desc S/"
                                    min={0}
                                    step={0.01}
                                    value={discountAmount || ""}
                                    disabled={discountPct > 0}
                                    onChange={(e) => {
                                        const v = Math.max(
                                            0,
                                            parseFloat(e.target.value) || 0,
                                        );
                                        setDiscountAmount(v);
                                        if (v > 0) setDiscountPercent(0);
                                    }}
                                    className="rounded-md border border-slate-300 bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
                                    style={{
                                        width: isNarrow ? "100px" : "80px",
                                        padding: "0.4rem",
                                        fontSize: isNarrow
                                            ? "0.9rem"
                                            : "0.75rem",
                                        borderRadius: "6px",
                                    }}
                                />
                                <input
                                    type="number"
                                    placeholder="Desc %"
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    value={discountPercent || ""}
                                    disabled={discountAmount > 0}
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
                                    className="rounded-md border border-slate-300 bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
                                    style={{
                                        width: isNarrow ? "100px" : "80px",
                                        padding: "0.4rem",
                                        fontSize: isNarrow
                                            ? "0.9rem"
                                            : "0.75rem",
                                        borderRadius: "6px",
                                    }}
                                />
                            </div>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                gap: "0.2rem",
                            }}
                        >
                            <div
                                className="text-slate-500 dark:text-slate-400"
                                style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                }}
                            >
                                Subtotal: {currencyFormatter.format(subtotal)}
                            </div>
                            <div
                                className="text-slate-500 dark:text-slate-400"
                                style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                }}
                            >
                                IGV ({igvPercentage}%):{" "}
                                {currencyFormatter.format(igvAmount)}
                            </div>
                            {itemsPromoDiscount > 0 && (
                                <div
                                    className="text-green-600 dark:text-green-400"
                                    style={{
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                    }}
                                >
                                    Desc. promoción: -
                                    {currencyFormatter.format(
                                        itemsPromoDiscount,
                                    )}
                                </div>
                            )}
                            {globalDiscount > 0 && (
                                <div
                                    className="text-red-600 dark:text-red-400"
                                    style={{
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                    }}
                                >
                                    Descuento manual: -
                                    {currencyFormatter.format(globalDiscount)}
                                </div>
                            )}
                            <div
                                className="text-slate-500 dark:text-slate-400"
                                style={{
                                    fontSize: isNarrow ? "1.1rem" : "0.9rem",
                                }}
                            >
                                Total:{" "}
                                {currencyFormatter.format(subtotal + igvAmount)}
                            </div>
                            <div
                                className="text-slate-900 dark:text-slate-100"
                                style={{
                                    fontSize: isNarrow ? "1.5rem" : "1.2rem",
                                    fontWeight: 900,
                                }}
                            >
                                Pagar: {currencyFormatter.format(totalToPay)}
                            </div>
                        </div>
                    </div>
                </section>

                <section
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                    style={{
                        flex: isNarrow
                            ? "auto"
                            : isSmallDesktop
                              ? "35%"
                              : "30%",
                        padding: isNarrow ? "0.75rem" : "1rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                    }}
                >
                    <div
                        className="rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200"
                        style={{
                            padding: "0.5rem",
                            textAlign: "center",
                            borderRadius: "4px",
                        }}
                    >
                        <div style={{ fontSize: "0.7rem" }}>DEUDA</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 900 }}>
                            {currencyFormatter.format(totalToPay)}
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto" }}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: "0.3rem",
                                alignItems: "center",
                            }}
                        >
                            <span
                                className="text-slate-700 dark:text-slate-200"
                                style={{ fontSize: "0.8rem", fontWeight: 800 }}
                            >
                                PAGOS
                            </span>
                            <button
                                type="button"
                                onClick={addPayment}
                                disabled={!canAddPaymentMethod}
                                className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                style={{
                                    fontSize: "1.0rem",
                                    padding: "0.5rem",
                                    opacity: canAddPaymentMethod ? 1 : 0.45,
                                    cursor: canAddPaymentMethod
                                        ? "pointer"
                                        : "not-allowed",
                                }}
                            >
                                + Pago
                            </button>
                        </div>
                        {payments.map((p) => (
                            <div
                                key={p.id}
                                className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                                style={{
                                    padding: "0.4rem",
                                    marginBottom: "0.4rem",
                                    borderRadius: "4px",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginBottom: "0.2rem",
                                    }}
                                >
                                    <select
                                        value={p.method}
                                        onChange={(e) =>
                                            updatePayment(
                                                p.id,
                                                "method",
                                                e.target.value,
                                            )
                                        }
                                        className="rounded-md border border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                        style={{
                                            flex: 1,
                                            marginRight: "0.4rem",
                                            padding: "0.75rem",
                                            fontSize: "1rem",
                                            borderRadius: "6px",
                                        }}
                                    >
                                        {PAYMENT_METHODS.map(
                                            ({ value, label }) => (
                                                <option
                                                    key={value}
                                                    value={value}
                                                >
                                                    {label}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                    {payments.length > 1 && (
                                        <button
                                            onClick={() => removePayment(p.id)}
                                            className="rounded-md border border-red-300 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/45"
                                            style={{
                                                padding: "0 1rem",
                                                borderRadius: "6px",
                                                cursor: "pointer",
                                                fontWeight: 900,
                                                fontSize: "1.2rem",
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={p.amount === 0 ? "" : p.amount}
                                    onChange={(e) =>
                                        updatePayment(
                                            p.id,
                                            "amount",
                                            Number(e.target.value),
                                        )
                                    }
                                    className="rounded-md border border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                    style={{
                                        width: "100%",
                                        fontWeight: 800,
                                        padding: "0.75rem",
                                        fontSize: "1.2rem",
                                        borderRadius: "6px",
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <div
                        className="border-t border-slate-200 pt-2 dark:border-slate-700"
                        style={{
                            paddingTop: "0.5rem",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.8rem",
                                fontWeight: 800,
                                marginBottom: "0.5rem",
                            }}
                            className="text-slate-700 dark:text-slate-200"
                        >
                            <span>
                                RESTA: {currencyFormatter.format(remaining)}
                            </span>
                            {vuelto > 0 && (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                    Vuelto: {currencyFormatter.format(vuelto)}
                                </span>
                            )}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: isNarrow ? "0.75rem" : "0.5rem",
                            }}
                        >
                            <div
                                className="text-slate-500 dark:text-slate-400"
                                style={{
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                }}
                            >
                                {isElectron ? "Cobrar e imprimir" : "Cobrar"}
                            </div>
                            {!isElectron && (
                                <div
                                    className="rounded-md border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                    style={{
                                        fontSize: "0.6rem",
                                        marginBottom: "0.2rem",
                                        fontWeight: 600,
                                        padding: "0.3rem",
                                        borderRadius: "4px",
                                    }}
                                >
                                    ⚠️ La impresión física directa solo está
                                    disponible en la versión de escritorio.
                                </div>
                            )}
                            {payDocumentsOrdered.length === 0 ? (
                                <div
                                    className="text-slate-400 dark:text-slate-500"
                                    style={{
                                        fontSize: "0.75rem",
                                        padding: "0.5rem 0",
                                    }}
                                >
                                    No hay tipos de documento configurados en la
                                    sucursal.
                                </div>
                            ) : (
                                <div
                                    style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "0.4rem",
                                    }}
                                >
                                    {payDocumentsOrdered.map((d: any) => {
                                        const code = String(
                                            d.code || "",
                                        ).trim();
                                        const bg =
                                            code === "01"
                                                ? "#4f46e5"
                                                : code === "03"
                                                  ? "#059669"
                                                  : "#475569";
                                        const disabled =
                                            isProcessing || !paymentsCoverDebt;
                                        return (
                                            <button
                                                key={d.id}
                                                type="button"
                                                onClick={() =>
                                                    void handleDocumentPayClick(
                                                        String(d.id),
                                                    )
                                                }
                                                disabled={disabled}
                                                title={d.description}
                                                className="rounded-md border border-transparent bg-slate-600 text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                                                style={{
                                                    flex: "1 1 calc(33.33% - 0.4rem)",
                                                    minWidth: "5.5rem",
                                                    padding: "0.65rem 0.35rem",
                                                    background: disabled
                                                        ? "#cbd5e0"
                                                        : bg,
                                                    color: "white",
                                                    borderRadius: "6px",
                                                    fontWeight: 800,
                                                    fontSize: "0.72rem",
                                                    cursor: disabled
                                                        ? "not-allowed"
                                                        : "pointer",
                                                    lineHeight: 1.2,
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
                                onClick={() => {
                                    setCancellationReason("");
                                    setShowCancelOperationModal(true);
                                }}
                                className="w-full rounded-md border border-red-300 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/45"
                                style={{
                                    width: "100%",
                                    marginTop: "0.8rem",
                                    padding: "0.5rem",
                                    borderRadius: "6px",
                                    fontSize: "0.75rem",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                }}
                            >
                                Anular Orden
                            </button>
                        )}
                        
                    </div>
                </section>
            </main>

            {showChangeTableModal && (
                <div className={cashModalOverlayClass}>
                    <div className={cashModalPanelClass}>
                        <h3 className={cashModalTitleClass}>Cambiar Mesa</h3>
                        <select
                            value={selectedFloorId}
                            onChange={(e) => setSelectedFloorId(e.target.value)}
                            className={cashModalSelectClass}
                        >
                            <option value="">Piso...</option>
                            {floorsData?.floorsByBranch.map((f: any) => (
                                <option key={f.id} value={f.id}>
                                    {f.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedTableId}
                            onChange={(e) => setSelectedTableId(e.target.value)}
                            className={`${cashModalSelectClass} mb-4`}
                        >
                            <option value="">Mesa...</option>
                            {tablesData?.tablesByFloor.map((t: any) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                        <div className={cashModalActionsClass}>
                            <button
                                type="button"
                                onClick={() => setShowChangeTableModal(false)}
                                className={cashModalBtnSecondaryClass}
                            >
                                Volver
                            </button>
                            <button
                                type="button"
                                onClick={handleChangeTable}
                                className={cashModalBtnPrimaryClass}
                            >
                                Cambiar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showTransferPlatesModal && (
                <div className={cashModalOverlayClass}>
                    <div className={cashModalPanelClass}>
                        <h3 className={cashModalTitleClass}>Transferir Platos</h3>
                        <select
                            value={selectedTransferFloorId}
                            onChange={(e) =>
                                setSelectedTransferFloorId(e.target.value)
                            }
                            className={cashModalSelectClass}
                        >
                            <option value="">Piso...</option>
                            {transferFloorsData?.floorsByBranch.map(
                                (f: any) => (
                                    <option key={f.id} value={f.id}>
                                        {f.name}
                                    </option>
                                ),
                            )}
                        </select>
                        <select
                            value={selectedTransferTableId}
                            onChange={(e) =>
                                setSelectedTransferTableId(e.target.value)
                            }
                            className={`${cashModalSelectClass} mb-4`}
                        >
                            <option value="">Mesa destino...</option>
                            {transferTablesData?.tablesByFloor.map((t: any) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                        <div className={cashModalActionsClass}>
                            <button
                                type="button"
                                onClick={() =>
                                    setShowTransferPlatesModal(false)
                                }
                                className={cashModalBtnSecondaryClass}
                            >
                                Cerrar
                            </button>
                            <button
                                type="button"
                                onClick={handleTransferPlates}
                                className={cashModalBtnPrimaryClass}
                            >
                                Transferir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showChangeUserModal && (
                <div className={cashModalOverlayClass}>
                    <div className={cashModalPanelClass}>
                        <h3 className={cashModalTitleClass}>Cambiar Mozo</h3>
                        <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className={`${cashModalSelectClass} mb-4`}
                        >
                            <option value="">Mozo...</option>
                            {availableUsers.map((u: any) => (
                                <option key={u.id} value={u.id}>
                                    {u.firstName} {u.lastName}
                                </option>
                            ))}
                        </select>
                        <div className={cashModalActionsClass}>
                            <button
                                type="button"
                                onClick={() => setShowChangeUserModal(false)}
                                className={cashModalBtnSecondaryClass}
                            >
                                Cerrar
                            </button>
                            <button
                                type="button"
                                onClick={handleChangeUser}
                                className={cashModalBtnPrimaryClass}
                            >
                                Cambiar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pendingDeleteItem && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-item-modal-title"
                    className={cashModalOverlayClass}
                    onClick={closeDeleteItemModal}
                >
                    <div
                        className={cashModalPanelWideClass}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3
                            id="delete-item-modal-title"
                            className={cashModalTitleClass}
                        >
                            Quitar producto
                        </h3>
                        <p className={cashModalTextClass}>
                            {pendingDeleteItem.removalIsPartial ? (
                                <>
                                    ¿Quitar{" "}
                                    <strong className="text-slate-800 dark:text-slate-200">
                                        {pendingDeleteItem.rowQuantity === 1
                                            ? "1 unidad"
                                            : `${pendingDeleteItem.rowQuantity} unidades`}
                                    </strong>{" "}
                                    de «{pendingDeleteItem.productLabel}» de la
                                    orden?
                                </>
                            ) : (
                                <>
                                    ¿Quitar por completo «
                                    <strong className="text-slate-800 dark:text-slate-200">
                                        {pendingDeleteItem.productLabel}
                                    </strong>
                                    » de la orden?
                                </>
                            )}
                        </p>
                        <label
                            htmlFor="delete-item-reason"
                            className={cashModalLabelClass}
                        >
                            Motivo (obligatorio)
                        </label>
                        <textarea
                            id="delete-item-reason"
                            value={detailCancellationReason}
                            onChange={(e) =>
                                setDetailCancellationReason(e.target.value)
                            }
                            placeholder="Describe el motivo (obligatorio)…"
                            required
                            aria-required="true"
                            disabled={isRemovingItem}
                            rows={3}
                            className={cashModalTextareaClass}
                        />
                        <div className={cashModalActionsClass}>
                            <button
                                type="button"
                                onClick={closeDeleteItemModal}
                                disabled={isRemovingItem}
                                className={cashModalBtnSecondaryClass}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmRemoveItem}
                                disabled={isRemovingItem}
                                className={cashModalBtnDangerClass}
                            >
                                {isRemovingItem ? "Quitando…" : "Quitar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCancelOperationModal && (
                <div className={cashModalOverlayClass}>
                    <div className={cashModalPanelWideClass}>
                        <h3 className={cashModalTitleClass}>Anular orden</h3>
                        <p className={cashModalTextClass}>
                            Debes indicar por qué se anula la orden.
                        </p>
                        <label
                            htmlFor="cancel-operation-reason"
                            className={cashModalLabelClass}
                        >
                            Motivo (obligatorio)
                        </label>
                        <textarea
                            id="cancel-operation-reason"
                            placeholder="Describe el motivo (obligatorio)…"
                            value={cancellationReason}
                            onChange={(e) =>
                                setCancellationReason(e.target.value)
                            }
                            required
                            aria-required="true"
                            disabled={isProcessing}
                            rows={3}
                            className={cashModalTextareaClass}
                        />
                        <div className={cashModalActionsClass}>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCancelOperationModal(false);
                                    setCancellationReason("");
                                }}
                                disabled={isProcessing}
                                className={cashModalBtnSecondaryClass}
                            >
                                Cerrar
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelOperation}
                                disabled={isProcessing}
                                className={cashModalBtnDangerClass}
                            >
                                {isProcessing ? "Anulando…" : "Anular"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCreateClientModal && (
                <CreateClient
                    onSuccess={() => {
                        setEnableBranchClientsQuery(true);
                        queueMicrotask(() => {
                            void refetchClients();
                        });
                    }}
                    onClose={() => setShowCreateClientModal(false)}
                />
            )}
            {showEditClientModal && (
                <EditClient
                    client={selectedClient}
                    onSuccess={() => setShowEditClientModal(false)}
                    onClose={() => setShowEditClientModal(false)}
                />
            )}

            {cashDocPreview && (
                <DocumentPrintPreviewModal
                    title={cashDocPreview.title}
                    onPrint={() => {
                        cashDocPreviewResolverRef.current?.("print");
                    }}
                    onContinuePay={() => {
                        cashDocPreviewResolverRef.current?.("continue");
                    }}
                    onCancel={() => {
                        cashDocPreviewResolverRef.current?.("cancel");
                    }}
                />
            )}
        </div>
    );
};

export default CashPay;
