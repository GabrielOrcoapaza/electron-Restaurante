export type KitchenNotificationPayload = Record<string, unknown>;

export type KitchenNotificationItem = {
    id: string;
    message: string;
    createdAt: string;
    isPending?: boolean;
};

const STORAGE_PREFIX = "kitchenSeenNotifications";
const LAST_PREPARED_PREFIX = "kitchenLastPrepared";
const MAX_STORED_KEYS = 500;

const normalizeId = (value: unknown): string =>
    value == null || value === "" ? "" : String(value).trim();

const normalizeText = (value: unknown): string =>
    value == null ? "" : String(value).trim();

const parseQuantity = (value: unknown): number | null => {
    if (value == null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const quantityToString = (value: number | null): string =>
    value == null ? "" : String(value);

const extractPayload = (
    notification: KitchenNotificationPayload,
): KitchenNotificationPayload => {
    const nested =
        notification.data ??
        notification.payload ??
        notification.notification;
    return nested && typeof nested === "object"
        ? (nested as KitchenNotificationPayload)
        : notification;
};

const lastPreparedStorageKey = (branchId: string, detailId: string) =>
    `${LAST_PREPARED_PREFIX}:${normalizeId(branchId)}:${normalizeId(detailId)}`;

const readLastPreparedQuantity = (
    branchId: string,
    detailId: string,
): number => {
    try {
        const raw = localStorage.getItem(
            lastPreparedStorageKey(branchId, detailId),
        );
        if (!raw) return 0;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    } catch {
        return 0;
    }
};

export const saveLastPreparedQuantity = (
    branchId: string,
    detailId: string,
    preparedCumulative: number,
) => {
    try {
        localStorage.setItem(
            lastPreparedStorageKey(branchId, detailId),
            String(preparedCumulative),
        );
    } catch {
        /* noop */
    }
};

const extractDetailId = (payload: KitchenNotificationPayload): string => {
    const direct = normalizeId(
        payload.operation_detail_id ??
            payload.detail_id ??
            payload.detailId ??
            payload.operationDetailId,
    );
    if (direct) return direct;

    const nested = payload.operation_detail ?? payload.operationDetail;
    if (nested != null && typeof nested === "object") {
        const nestedId = (nested as KitchenNotificationPayload).id;
        if (nestedId != null) return normalizeId(nestedId);
    }
    if (typeof nested === "string" || typeof nested === "number") {
        return normalizeId(nested);
    }
    return "";
};

const getDetailTrackingId = (
    payload: KitchenNotificationPayload,
): string => {
    const detailId = extractDetailId(payload);
    if (detailId) return detailId;

    const productName = normalizeText(
        payload.product_name ?? payload.productName,
    );
    const operationRef = normalizeText(
        payload.operation_id ??
            payload.operationId ??
            payload.operation_number ??
            payload.operationNumber,
    );
    if (productName && operationRef) {
        return `op:${operationRef}|p:${productName}`;
    }
    return "";
};

const parseOrderLineQuantity = (
    payload: KitchenNotificationPayload,
): number | null =>
    parseQuantity(
        payload.order_quantity ??
            payload.orderQuantity ??
            payload.total_quantity ??
            payload.totalQuantity ??
            payload.original_quantity ??
            payload.originalQuantity ??
            payload.line_quantity ??
            payload.lineQuantity,
    );

const parseExplicitReadyQuantity = (
    payload: KitchenNotificationPayload,
): number | null => {
    const fields = [
        payload.ready_quantity,
        payload.readyQuantity,
        payload.quantity_ready,
        payload.quantityReady,
        payload.notified_quantity,
        payload.notifiedQuantity,
        payload.marked_quantity,
        payload.markedQuantity,
        payload.delta_quantity,
        payload.deltaQuantity,
        payload.prepared_now,
        payload.preparedNow,
    ];
    for (const field of fields) {
        const parsed = parseQuantity(field);
        if (parsed != null && parsed > 0) return parsed;
    }
    return null;
};

const resolveOrderTotalQuantity = (
    payload: KitchenNotificationPayload,
): number | null => {
    const orderLineQuantity = parseOrderLineQuantity(payload);
    const wsQuantity = parseQuantity(payload.quantity);
    return orderLineQuantity ?? wsQuantity;
};

const isLikelyOrderTotalQuantity = (
    candidate: number,
    orderTotal: number | null,
    lastPrepared: number,
): boolean =>
    orderTotal != null &&
    candidate === orderTotal &&
    lastPrepared > 0;

const resolveFirstEventQuantity = (
    preparedValue: number | null,
    orderTotal: number | null,
): number => {
    if (preparedValue != null && preparedValue > 0) {
        if (orderTotal != null && preparedValue <= orderTotal) {
            return preparedValue;
        }
        return preparedValue;
    }

    if (orderTotal == null || orderTotal <= 1) {
        return orderTotal ?? 1;
    }

    // Sin prepared_quantity: markItemPrepared envió todo el lote restante.
    return orderTotal;
};

/** Cantidad marcada en ESTE aviso (no la cantidad total del pedido). */
export const resolveReadyEventQuantity = (
    notification: KitchenNotificationPayload,
    branchId?: string | null,
): number => {
    const payload = extractPayload(notification);
    const trackingId = getDetailTrackingId(payload);
    const scopeBranchId =
        branchId ?? resolveKitchenNotificationScope().branchId ?? "";
    const orderTotal = resolveOrderTotalQuantity(payload);
    const lastPrepared =
        trackingId && scopeBranchId
            ? readLastPreparedQuantity(scopeBranchId, trackingId)
            : 0;

    const preparedCumulative = parseQuantity(
        payload.prepared_quantity ?? payload.preparedQuantity,
    );

    const explicitEventQty = parseExplicitReadyQuantity(payload);
    if (explicitEventQty != null) {
        if (isLikelyOrderTotalQuantity(explicitEventQty, orderTotal, lastPrepared)) {
            if (lastPrepared > 0 && orderTotal != null && orderTotal > lastPrepared) {
                return orderTotal - lastPrepared;
            }
            return resolveFirstEventQuantity(preparedCumulative, orderTotal);
        }
        return explicitEventQty;
    }

    // prepared_quantity menor o igual a lo guardado → el backend mandó un delta.
    if (
        preparedCumulative != null &&
        preparedCumulative > 0 &&
        lastPrepared > 0 &&
        preparedCumulative <= lastPrepared
    ) {
        return preparedCumulative;
    }

    if (
        preparedCumulative != null &&
        preparedCumulative > lastPrepared
    ) {
        return preparedCumulative - lastPrepared;
    }

    if (lastPrepared > 0 && orderTotal != null && orderTotal > lastPrepared) {
        return orderTotal - lastPrepared;
    }

    if (lastPrepared > 0) {
        return 1;
    }

    if (preparedCumulative != null && preparedCumulative > 0) {
        if (isLikelyOrderTotalQuantity(preparedCumulative, orderTotal, lastPrepared)) {
            return resolveFirstEventQuantity(preparedCumulative, orderTotal);
        }
        return preparedCumulative;
    }

    if (orderTotal != null && orderTotal > 1) {
        return resolveFirstEventQuantity(null, orderTotal);
    }

    return orderTotal ?? 1;
};

/** Prefijo de cantidad para el mensaje (2x, 3x...). */
export const formatReadyQuantityPrefix = (
    eventQty: number,
    _orderQty: number | null,
): string => (eventQty > 1 ? `${eventQty}x ` : "");

export const extractKitchenNotificationEntries = (
    notification: KitchenNotificationPayload,
): KitchenNotificationPayload[] => {
    const payload = extractPayload(notification);
    const nestedLists = [
        payload.items,
        payload.products,
        payload.details,
        payload.operation_details,
        payload.operationDetails,
    ];

    for (const list of nestedLists) {
        if (!Array.isArray(list) || list.length === 0) continue;
        return list
            .filter((entry) => entry != null && typeof entry === "object")
            .map((entry) => ({
                ...payload,
                ...(entry as KitchenNotificationPayload),
            }));
    }

    return [payload];
};

export const extractKitchenNotificationFields = (
    notification: KitchenNotificationPayload,
) => {
    const payload = extractPayload(notification);
    const detailId = extractDetailId(payload);
    const trackingId = getDetailTrackingId(payload);
    const branchIdForTracking =
        resolveKitchenNotificationScope().branchId ?? "";
    const tableRef = normalizeText(
        payload.table_id ??
            payload.tableId ??
            payload.table_name ??
            payload.tableName,
    );
    const productName = normalizeText(
        payload.product_name ?? payload.productName,
    );
    const operationRef = normalizeText(
        payload.operation_id ??
            payload.operationId ??
            payload.operation_number ??
            payload.operationNumber,
    );
    const isPending = Boolean(payload.is_pending ?? payload.isPending);
    const orderQuantity = parseOrderLineQuantity(payload) ?? parseQuantity(payload.quantity);
    const preparedCumulative = parseQuantity(
        payload.prepared_quantity ?? payload.preparedQuantity,
    );
    const lastPrepared =
        trackingId && branchIdForTracking
            ? readLastPreparedQuantity(branchIdForTracking, trackingId)
            : 0;
    const eventQty = isPending
        ? null
        : resolveReadyEventQuantity(notification, branchIdForTracking);
    const quantity = quantityToString(
        isPending
            ? orderQuantity
            : (preparedCumulative ??
                  (eventQty != null ? lastPrepared + eventQty : orderQuantity)),
    );
    const wsId = normalizeId(
        payload.id ??
            payload.notification_id ??
            payload.notificationId ??
            payload.kitchen_notification_id,
    );
    const backendMessage = normalizeText(payload.message);

    return {
        payload,
        detailId,
        tableRef,
        productName,
        operationRef,
        quantity,
        orderQuantity,
        preparedCumulative,
        isPending,
        wsId,
        backendMessage,
    };
};

export const isKitchenPendingEvent = (
    notification: KitchenNotificationPayload,
): boolean => extractKitchenNotificationFields(notification).isPending;

export const buildKitchenNotificationMessage = (
    notification: KitchenNotificationPayload,
    branchId?: string | null,
): string => {
    const {
        payload,
        backendMessage,
        productName,
        tableRef,
        operationRef,
        isPending,
    } = extractKitchenNotificationFields(notification);

    if (isPending) {
        if (backendMessage) return backendMessage;
        return `Nuevo pedido: ${payload.product_name} para ${payload.table_name}`;
    }

    if (productName.startsWith("Orden #")) {
        return (
            backendMessage ||
            `${productName} lista para ${tableRef}, preparada por ${payload.prepared_by}`
        );
    }

    const eventQty = resolveReadyEventQuantity(notification, branchId);
    const orderQty =
        parseOrderLineQuantity(payload) ?? parseQuantity(payload.quantity);
    const quantityText = formatReadyQuantityPrefix(eventQty, orderQty);
    const orderLabel =
        operationRef ||
        payload.operation_number ||
        payload.operationNumber ||
        "";
    return `${quantityText}${productName} listo para ${tableRef} (Orden #${orderLabel})`;
};

export const mapKitchenNotificationItem = (
    notification: KitchenNotificationPayload,
    branchId?: string | null,
): KitchenNotificationItem | null => {
    const fields = extractKitchenNotificationFields(notification);
    const message = buildKitchenNotificationMessage(notification, branchId);
    if (!message) return null;

    const createdAt = normalizeText(
        fields.payload.created_at ?? fields.payload.createdAt,
    );

    return {
        id: getKitchenNotificationStorageId(notification, branchId),
        message,
        createdAt: createdAt || new Date().toISOString(),
        isPending: fields.isPending,
    };
};

/** Un evento WebSocket puede traer varios platos (p. ej. markGroupPrepared). */
export const mapKitchenNotificationItems = (
    notification: KitchenNotificationPayload,
    branchId?: string | null,
): KitchenNotificationItem[] => {
    const entries = extractKitchenNotificationEntries(notification);
    if (entries.length <= 1) {
        const single = mapKitchenNotificationItem(notification, branchId);
        return single ? [single] : [];
    }

    const createdAt = normalizeText(
        extractPayload(notification).created_at ??
            extractPayload(notification).createdAt,
    );
    const timestamp = createdAt || new Date().toISOString();

    const items: KitchenNotificationItem[] = [];
    for (const entry of entries) {
        const item = mapKitchenNotificationItem(entry, branchId);
        if (!item) continue;
        items.push({
            ...item,
            createdAt: item.createdAt || timestamp,
        });
    }
    return items;
};

export const getKitchenNotificationStorageId = (
    notification: KitchenNotificationPayload,
    branchId?: string | null,
): string => {
    const {
        wsId,
        detailId,
        tableRef,
        productName,
        operationRef,
        quantity,
        isPending,
    } = extractKitchenNotificationFields(notification);
    const message = buildKitchenNotificationMessage(notification, branchId);

    if (wsId) return `id:${wsId}`;
    if (detailId) {
        return `${isPending ? "pending" : "ready"}:${detailId}:${quantity}`;
    }
    if (message) return `msg:${message}`;

    return [
        isPending ? "pending" : "ready",
        tableRef,
        productName,
        operationRef,
        quantity,
    ]
        .filter(Boolean)
        .join("|");
};

const storageKey = (branchId: string, userId: string) =>
    `${STORAGE_PREFIX}:${normalizeId(branchId)}:${normalizeId(userId)}`;

export const loadKitchenNotificationSeenKeys = (
    branchId: string,
    userId: string,
): string[] => {
    try {
        const raw = localStorage.getItem(storageKey(branchId, userId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((key): key is string => typeof key === "string")
            : [];
    } catch {
        return [];
    }
};

const saveKitchenNotificationSeenKeys = (
    branchId: string,
    userId: string,
    keys: string[],
) => {
    try {
        localStorage.setItem(
            storageKey(branchId, userId),
            JSON.stringify(keys.slice(-MAX_STORED_KEYS)),
        );
    } catch {
        /* noop */
    }
};

export const buildKitchenNotificationSeenKeys = (
    notification: KitchenNotificationPayload,
    branchId?: string | null,
): string[] => {
    const {
        wsId,
        detailId,
        tableRef,
        productName,
        operationRef,
        quantity,
        isPending,
    } = extractKitchenNotificationFields(notification);
    const message = buildKitchenNotificationMessage(notification, branchId);
    const keys = new Set<string>();

    if (wsId) keys.add(`id:${wsId}`);

    if (isPending) {
        if (message) keys.add(`msg:${message}`);
        if (detailId) {
            keys.add(`known:${detailId}`);
            keys.add(`pending:${detailId}:${quantity}`);
        }
        if (tableRef && productName && operationRef) {
            keys.add(`scope:${tableRef}|${productName}|${operationRef}`);
        }
        if (tableRef && productName) {
            keys.add(
                `pending|t:${tableRef}|p:${productName}|q:${quantity}|o:${operationRef}`,
            );
        }
        return [...keys];
    }

    if (detailId && quantity) {
        keys.add(`ready:${detailId}:${quantity}`);
    } else if (detailId) {
        keys.add(`ready:${detailId}`);
    }

    if (tableRef && productName) {
        keys.add(
            `ready|t:${tableRef}|p:${productName}|q:${quantity}|o:${operationRef}`,
        );
    }

    if (message && !detailId && !quantity) {
        keys.add(`msg:${message}`);
    }

    return [...keys];
};

export const buildKitchenPendingSuppressionKeys = (
    notification: KitchenNotificationPayload,
): string[] => {
    const { detailId, tableRef, productName, operationRef } =
        extractKitchenNotificationFields(notification);
    const keys = new Set<string>();
    if (detailId) keys.add(`known:${detailId}`);
    if (tableRef && productName && operationRef) {
        keys.add(`scope:${tableRef}|${productName}|${operationRef}`);
    }
    return [...keys];
};

export const isKitchenNotificationAlreadySeen = (
    branchId: string,
    userId: string,
    notification: KitchenNotificationPayload,
): boolean => {
    const stored = new Set(loadKitchenNotificationSeenKeys(branchId, userId));
    const {
        wsId,
        detailId,
        tableRef,
        productName,
        operationRef,
        quantity,
        isPending,
    } = extractKitchenNotificationFields(notification);

    if (isPending) {
        const message = buildKitchenNotificationMessage(notification, branchId);
        if (message && stored.has(`msg:${message}`)) return true;
        if (detailId && stored.has(`known:${detailId}`)) return true;
        if (
            tableRef &&
            productName &&
            operationRef &&
            stored.has(`scope:${tableRef}|${productName}|${operationRef}`)
        ) {
            return true;
        }
        if (tableRef && productName) {
            const pendingPrefix = `pending|t:${tableRef}|p:${productName}|`;
            for (const key of stored) {
                if (key.startsWith(pendingPrefix)) return true;
            }
        }
        return buildKitchenNotificationSeenKeys(notification, branchId).some(
            (key) => stored.has(key),
        );
    }

    if (wsId && stored.has(`id:${wsId}`)) return true;
    if (detailId && quantity && stored.has(`ready:${detailId}:${quantity}`)) {
        return true;
    }
    if (
        tableRef &&
        productName &&
        stored.has(
            `ready|t:${tableRef}|p:${productName}|q:${quantity}|o:${operationRef}`,
        )
    ) {
        return true;
    }
    if (detailId && !quantity && stored.has(`ready:${detailId}`)) {
        return true;
    }

    const message = buildKitchenNotificationMessage(notification, branchId);
    if (message && !detailId && !quantity && stored.has(`msg:${message}`)) {
        return true;
    }

    return false;
};

export const markKitchenNotificationSeen = (
    branchId: string,
    userId: string,
    notification: KitchenNotificationPayload,
) => {
    const { isPending } = extractKitchenNotificationFields(notification);

    const keys = [
        ...buildKitchenNotificationSeenKeys(notification, branchId),
        ...(!isPending
            ? buildKitchenPendingSuppressionKeys(notification)
            : []),
    ];
    const stored = loadKitchenNotificationSeenKeys(branchId, userId);
    const merged = [...stored];
    for (const key of keys) {
        if (!merged.includes(key)) merged.push(key);
    }
    saveKitchenNotificationSeenKeys(branchId, userId, merged);

    if (!isPending) {
        const payload = extractPayload(notification);
        const trackingId = getDetailTrackingId(payload);
        if (!trackingId) return;

        const eventQty = resolveReadyEventQuantity(notification, branchId);
        const preparedCumulative = parseQuantity(
            payload.prepared_quantity ?? payload.preparedQuantity,
        );
        const cumulative =
            preparedCumulative ??
            readLastPreparedQuantity(branchId, trackingId) + eventQty;
        saveLastPreparedQuantity(branchId, trackingId, cumulative);
    }
};

export const resolveKitchenNotificationScope = (): {
    branchId: string | null;
    userId: string | null;
} => {
    try {
        const companyRaw = localStorage.getItem("companyData");
        const userRaw = localStorage.getItem("userData");
        const company = companyRaw ? JSON.parse(companyRaw) : null;
        const user = userRaw ? JSON.parse(userRaw) : null;

        return {
            branchId: normalizeId(company?.branch?.id) || null,
            userId: normalizeId(user?.id) || null,
        };
    } catch {
        return { branchId: null, userId: null };
    }
};
