// Interfaz para los colores de estado de una mesa (formato exacto del método get_status_colors() de Django)
export interface TableStatusColors {
  color: string;                    // Color principal del borde
  background_color: string;          // Color de fondo
  text_color: string;               // Color del texto
}

// Interfaz para los colores procesados que se usan en el frontend
export interface ProcessedTableColors {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  badgeColor: string;
  badgeTextColor: string;
}

// Tipos de estado de mesa (coinciden con TABLE_STATUS del modelo Django)
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'TO_PAY' | 'IN_PROCESS' | 'MAINTENANCE';

// Tipos para las formas de mesa (coinciden con TABLE_SHAPES del modelo Django)
export  type TableShape = 'ROUND' | 'SQUARE' | 'CIRCLE' | 'RECTANGLE';

// Tipos para las mesas
export interface Table {
  id: string;
  name: string;
  shape: TableShape; // ROUND y SQUARE del modelo Django, CIRCLE y RECTANGLE para compatibilidad
  positionX: number;
  positionY: number;
  capacity: number;
  status: TableStatus;
  /** Legado / caché local; ya no se solicita en GraphQL (colores = mapa por estado en el plano). */
  statusColors?: string | TableStatusColors;
  currentOperationId?: number;
  /** Nombre del piso (p. ej. rellenado al abrir la orden desde Floor). */
  floorName?: string;
  /** Resumen de la operación activa (p. ej. desde tablesByFloor → currentOperation). */
  currentOperation?: {
    id?: string;
    operationDate?: string | null;
  } | null;
  occupiedById?: number;
  userName?: string;
  /** Candado de sesión (pantalla abierta); no sustituye occupiedBy / estado de negocio. */
  sessionLockedById?: string | number | null;
  sessionLockExpiresAt?: string | null;
  sessionLockedByName?: string | null;
  /** Si es false, la mesa no se muestra en el piso de ventas. */
  isActive?: boolean;
}

/**
 * Igual que SumApp Android (`ITable.hasVisibleSessionLock`): mostrar candado en el plano
 * si hay titular por id o nombre, sin comparar con el usuario actual.
 * Quién puede abrir la mesa lo define el servidor en `claimTableSessionLock` (`useTableSessionLock`).
 */
export function hasVisibleTableSessionLock(
    table: Pick<Table, "sessionLockedById" | "sessionLockedByName">,
): boolean {
    const id = table.sessionLockedById;
    if (id != null && String(id).trim() !== "") {
        return true;
    }
    const name = table.sessionLockedByName;
    return name != null && String(name).trim() !== "";
}

/**
 * ¿Bloquear abrir esta mesa porque el candado lo tiene otro usuario?
 * Alineado con el backend (solo `session_locked_by` + expiración).
 *
 * Si solo llega nombre (sin `sessionLockedById`), se usa `currentDisplayName`
 * (`user.fullName` en el cliente) para no penalizar al titular; el resto ven modal en el plano.
 */
export function shouldDenyTableEntryForSessionLock(
    table: Pick<
        Table,
        | "sessionLockedById"
        | "sessionLockedByName"
        | "sessionLockExpiresAt"
    >,
    currentUserId: string | number | undefined | null,
    /** p. ej. `user.fullName` o `"Nombre Apellido"` del usuario logueado */
    currentDisplayName?: string | null,
): boolean {
    if (!hasVisibleTableSessionLock(table)) {
        return false;
    }
    const exp = table.sessionLockExpiresAt;
    if (exp) {
        const t = new Date(exp).getTime();
        if (!Number.isNaN(t) && t <= Date.now()) {
            return false;
        }
    }
    const sidRaw = table.sessionLockedById;
    const lockerId =
        sidRaw != null && String(sidRaw).trim() !== ""
            ? String(sidRaw).trim()
            : null;

    if (lockerId != null) {
        if (currentUserId == null) {
            return true;
        }
        return lockerId !== String(currentUserId);
    }

    const holderName = (table.sessionLockedByName || "").trim();
    const viewerLabel = (currentDisplayName || "").trim();

    // Candado visible sin id (p.ej. sólo nombre en overlay): mejor bloquear que abrir orden y hacer toast por claim fallido.
    if (!holderName) {
        return true;
    }
    if (!viewerLabel) {
        return true;
    }
    return (
        normalizeSessionLockPersonLabel(holderName) !==
        normalizeSessionLockPersonLabel(viewerLabel)
    );
}

function normalizeSessionLockPersonLabel(s: string): string {
    try {
        return s
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    } catch {
        return s.toLowerCase().replace(/\s+/g, " ").trim();
    }
}

export type TableSessionLockOverlay = Pick<
    Table,
    "sessionLockedById" | "sessionLockExpiresAt" | "sessionLockedByName"
>;

function readSessionLockFieldsFromMessage(message: Record<string, unknown>): {
    sid: unknown;
    exp: unknown;
    name: unknown;
} {
    return {
        sid:
            message.session_locked_by_user_id ??
            message.session_locked_by_id ??
            message.sessionLockedByUserId ??
            message.sessionLockedById ??
            null,
        exp:
            message.session_lock_expires_at ?? message.sessionLockExpiresAt ?? null,
        name:
            message.session_locked_by_name ?? message.sessionLockedByName ?? null,
    };
}

function normalizeSessionLockOverlay(
    sid: unknown,
    exp: unknown,
    name: unknown,
): TableSessionLockOverlay {
    return {
        sessionLockedById:
            sid === "" || sid === undefined || sid === null
                ? null
                : (sid as string | number),
        sessionLockExpiresAt:
            exp === "" || exp === undefined || exp === null
                ? null
                : String(exp),
        sessionLockedByName:
            name === "" || name === undefined || name === null
                ? null
                : String(name),
    };
}

/**
 * Alineado con SumApp Android:
 * - `table_session_update`: sustituye el slice de candado (puede ser liberación con todo null).
 * - `table_update`: solo si viene algún campo de candado; mezcla con el overlay previo (no borra campos no enviados).
 */
export function applySessionLockToOverlayMap(
    prev: Record<string, TableSessionLockOverlay>,
    message: Record<string, unknown>,
    source: "table_session_update" | "table_update",
): Record<string, TableSessionLockOverlay> {
    const tid = message.table_id ?? message.tableId;
    if (tid == null || tid === "") return prev;
    const idStr = String(tid);
    const { sid, exp, name } = readSessionLockFieldsFromMessage(message);
    const overlay = normalizeSessionLockOverlay(sid, exp, name);

    if (source === "table_session_update") {
        const old = prev[idStr];
        if (old && JSON.stringify(old) === JSON.stringify(overlay)) {
            return prev;
        }
        return { ...prev, [idStr]: overlay };
    }

    const hasAny =
        overlay.sessionLockedById != null ||
        overlay.sessionLockedByName != null ||
        overlay.sessionLockExpiresAt != null;
    if (!hasAny) return prev;

    const old = prev[idStr];
    const merged: TableSessionLockOverlay = {
        sessionLockedById:
            overlay.sessionLockedById ?? old?.sessionLockedById ?? null,
        sessionLockedByName:
            overlay.sessionLockedByName ?? old?.sessionLockedByName ?? null,
        sessionLockExpiresAt:
            overlay.sessionLockExpiresAt ?? old?.sessionLockExpiresAt ?? null,
    };
    if (old && JSON.stringify(old) === JSON.stringify(merged)) {
        return prev;
    }
    return { ...prev, [idStr]: merged };
}

/** Parsea el body de `table_session_update` (snake_case del backend o camelCase). */
export function tableSessionLockOverlayFromWs(
    message: Record<string, unknown>,
): { tableId: string; overlay: TableSessionLockOverlay } | null {
    const tid = message.table_id ?? message.tableId;
    if (tid == null || tid === "") return null;
    const { sid, exp, name } = readSessionLockFieldsFromMessage(message);
    return {
        tableId: String(tid),
        overlay: normalizeSessionLockOverlay(sid, exp, name),
    };
}

function overlaySessionLockIsFullyCleared(
    overlay: TableSessionLockOverlay,
): boolean {
    const id = overlay.sessionLockedById;
    const name = overlay.sessionLockedByName;
    const exp = overlay.sessionLockExpiresAt;
    return (
        (id == null || String(id).trim() === "") &&
        (name == null || String(name).trim() === "") &&
        (exp == null || String(exp).trim() === "")
    );
}

/**
 * La query `tablesByFloor` aún refleja candado activo (id/nombre y expiración no vencida).
 * Evita que un `table_session_update` “vacío” por carrera/Strict Mode pise la snapshot del servidor.
 */
function serverTableSnapshotSuggestsActiveSessionLock(table: Table): boolean {
    if (!hasVisibleTableSessionLock(table)) {
        return false;
    }
    const exp = table.sessionLockExpiresAt;
    if (exp == null || String(exp).trim() === "") {
        return true;
    }
    const t = new Date(exp).getTime();
    if (Number.isNaN(t)) {
        return true;
    }
    return t > Date.now();
}

/**
 * Mezcla overlay WS + fila GraphQL. Si el overlay borra el candado pero el servidor
 * aún muestra uno vigente, se conserva la fila del servidor hasta el próximo refetch coherente.
 */
export function mergeTableSessionOverlay(
    table: Table,
    overlay: TableSessionLockOverlay | undefined,
): Table {
    if (!overlay) return table;
    if (
        overlaySessionLockIsFullyCleared(overlay) &&
        serverTableSnapshotSuggestsActiveSessionLock(table)
    ) {
        return table;
    }
    return {
        ...table,
        sessionLockedById: overlay.sessionLockedById,
        sessionLockExpiresAt: overlay.sessionLockExpiresAt,
        sessionLockedByName: overlay.sessionLockedByName,
    };
}

// Opciones de estado para las mesas (coinciden con el modelo Django)
export interface TableStatusOption {
  value: TableStatus;
  label: string;
  color: string;
}

// Respuesta de la mutación de actualización de estado
export interface UpdateTableStatusResponse {
  success: boolean;
  message: string;
  table?: Table;
}

// Variables para la mutación de actualización de estado
export interface UpdateTableStatusVariables {
  tableId: string;
  status: string;
  userId?: string;
}
