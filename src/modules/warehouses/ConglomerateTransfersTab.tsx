import React, { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import {
    GET_CONGLOMERATE_TRANSFER_ITEMS_BY_BRANCH,
    GET_PENDING_CONGLOMERATE_TRANSFERS_BY_BRANCH,
    GET_WAREHOUSES_BY_BRANCH,
} from "../../graphql/queries";
import {
    CANCEL_CONGLOMERATE_TRANSFER_ITEM,
    RECEIVE_CONGLOMERATE_TRANSFER_ITEM,
} from "../../graphql/mutations";
import SendConglomerateTransferModal from "./SendConglomerateTransferModal";

interface CompanyRef {
    id: string;
    denomination?: string | null;
    commercialName?: string | null;
}

interface BranchRef {
    id: string;
    name: string;
}

interface OutNoteRef {
    id: string;
    folio: string;
    motive?: string | null;
    driverName?: string | null;
    vehiclePlate?: string | null;
    notes?: string | null;
    company: CompanyRef;
    toCompany: CompanyRef;
    fromBranch: BranchRef;
    toBranch: BranchRef;
}

interface Item {
    id: string;
    status: "SENT" | "RECEIVED" | "CANCELLED";
    quantitySent: number;
    quantityReceived?: number | null;
    unitCost: number;
    notesSent?: string | null;
    notesReceived?: string | null;
    notesCancelled?: string | null;
    sentAt: string;
    receivedAt?: string | null;
    cancelledAt?: string | null;
    fromMasterIngredient: { id: string; name: string; unitMeasure: string };
    toMasterIngredient?: { id: string; name: string; unitMeasure: string } | null;
    fromProduct: { id: string; code: string; name: string };
    toProduct?: { id: string; code: string; name: string } | null;
    outNote: OutNoteRef;
    sentBy?: { id: string; fullName: string } | null;
    receivedBy?: { id: string; fullName: string } | null;
    cancelledBy?: { id: string; fullName: string } | null;
}

interface Warehouse {
    id: string;
    name: string;
    isActive: boolean;
}

const getErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error) return err.message;
    return fallback;
};

const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatQty = (value: unknown) => {
    const n = Number(value);
    if (isNaN(n)) return "—";
    return n.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const companyLabel = (c?: CompanyRef | null) =>
    c ? c.commercialName || c.denomination || `Empresa ${c.id}` : "—";

const statusBadge = (status: Item["status"]) => {
    const map: Record<string, { label: string; cls: string }> = {
        SENT: {
            label: "Enviado",
            cls: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
        },
        RECEIVED: {
            label: "Recibido",
            cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
        },
        CANCELLED: {
            label: "Cancelado",
            cls: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
        },
    };
    const s = map[status] || map.SENT;
    return (
        <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${s.cls}`}
        >
            {s.label}
        </span>
    );
};

const ConglomerateTransfersTab: React.FC<{ branchId: string }> = ({
    branchId,
}) => {
    const [showSendModal, setShowSendModal] = useState(false);
    const [receivingItem, setReceivingItem] = useState<Item | null>(null);
    const [cancelingItem, setCancelingItem] = useState<Item | null>(null);

    const {
        data: pendingData,
        loading: pendingLoading,
        refetch: refetchPending,
    } = useQuery(GET_PENDING_CONGLOMERATE_TRANSFERS_BY_BRANCH, {
        variables: { branchId },
        skip: !branchId,
        fetchPolicy: "network-only",
    });
    const pending: Item[] =
        pendingData?.pendingConglomerateTransfersByBranch || [];

    const {
        data: historyData,
        loading: historyLoading,
        refetch: refetchHistory,
    } = useQuery(GET_CONGLOMERATE_TRANSFER_ITEMS_BY_BRANCH, {
        variables: { branchId },
        skip: !branchId,
        fetchPolicy: "network-only",
    });
    const history: Item[] =
        historyData?.conglomerateTransferItemsByBranch || [];

    const refetchAll = async () => {
        await Promise.all([refetchPending(), refetchHistory()]);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                    Transferencias entre Empresas (Conglomerado)
                </h2>
                <button
                    onClick={() => setShowSendModal(true)}
                    className="flex h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-4 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-all hover:bg-indigo-700"
                >
                    Enviar a otra empresa
                </button>
            </div>

            {/* Pendientes por recibir */}
            <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-50 p-6 dark:border-slate-800/50">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                        Pendientes por recibir
                    </h3>
                    {pending.length > 0 && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                            {pending.length}
                        </span>
                    )}
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {pendingLoading ? (
                        <div className="flex flex-col gap-3 p-4">
                            {Array(2)
                                .fill(0)
                                .map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-16 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/50"
                                    />
                                ))}
                        </div>
                    ) : pending.length === 0 ? (
                        <p className="p-6 text-center text-sm font-bold text-slate-400">
                            No hay transferencias pendientes de recibir
                        </p>
                    ) : (
                        pending.map((it) => (
                            <div
                                key={it.id}
                                className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div>
                                    <div className="font-black text-slate-700 dark:text-slate-200">
                                        {it.fromMasterIngredient.name} —{" "}
                                        {formatQty(it.quantitySent)}{" "}
                                        {it.fromMasterIngredient.unitMeasure}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400">
                                        Desde {companyLabel(it.outNote.company)}{" "}
                                        ({it.outNote.fromBranch.name}) · nota{" "}
                                        {it.outNote.folio} ·{" "}
                                        {formatDate(it.sentAt)} ·{" "}
                                        {it.sentBy?.fullName || "—"}
                                    </div>
                                    {it.notesSent && (
                                        <div className="text-[10px] italic text-slate-400">
                                            "{it.notesSent}"
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setReceivingItem(it)}
                                    className="whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-emerald-700"
                                >
                                    Recibir
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Historial */}
            <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="border-b border-slate-50 p-6 dark:border-slate-800/50">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                        Historial
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    {historyLoading ? (
                        <div className="flex flex-col gap-3 p-4">
                            {Array(4)
                                .fill(0)
                                .map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-12 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/50"
                                    />
                                ))}
                        </div>
                    ) : history.length === 0 ? (
                        <p className="p-6 text-center text-sm font-bold text-slate-400">
                            Todavía no hay transferencias registradas
                        </p>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-50 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/30">
                                    <th className="px-6 py-4">Ingrediente</th>
                                    <th className="px-6 py-4">
                                        Empresa origen → destino
                                    </th>
                                    <th className="px-6 py-4 text-center">
                                        Enviado
                                    </th>
                                    <th className="px-6 py-4 text-center">
                                        Recibido
                                    </th>
                                    <th className="px-6 py-4 text-center">
                                        Estado
                                    </th>
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4 text-right">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {history.map((it) => {
                                    const canCancel =
                                        it.status === "SENT" &&
                                        it.outNote.fromBranch.id === branchId;
                                    return (
                                        <tr
                                            key={it.id}
                                            className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                                        >
                                            <td className="px-6 py-4 font-black text-slate-700 dark:text-slate-200">
                                                {it.fromMasterIngredient.name}
                                                {it.toMasterIngredient &&
                                                    it.toMasterIngredient.name !==
                                                        it.fromMasterIngredient
                                                            .name && (
                                                        <div className="text-[10px] font-bold text-slate-400">
                                                            → {it.toMasterIngredient.name}
                                                        </div>
                                                    )}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">
                                                {companyLabel(it.outNote.company)} →{" "}
                                                {companyLabel(it.outNote.toCompany)}
                                                <div className="text-[10px] text-slate-400">
                                                    nota {it.outNote.folio}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-300">
                                                {formatQty(it.quantitySent)}
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-300">
                                                {it.quantityReceived != null
                                                    ? formatQty(it.quantityReceived)
                                                    : "—"}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {statusBadge(it.status)}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-400">
                                                {formatDate(it.sentAt)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {canCancel && (
                                                    <button
                                                        onClick={() =>
                                                            setCancelingItem(it)
                                                        }
                                                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-500 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-900/20"
                                                    >
                                                        Cancelar
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showSendModal && (
                <SendConglomerateTransferModal
                    branchId={branchId}
                    onClose={() => setShowSendModal(false)}
                    onSent={async () => {
                        setShowSendModal(false);
                        await refetchAll();
                    }}
                />
            )}

            {receivingItem && (
                <ReceiveConglomerateItemModal
                    branchId={branchId}
                    item={receivingItem}
                    onClose={() => setReceivingItem(null)}
                    onReceived={async () => {
                        setReceivingItem(null);
                        await refetchAll();
                    }}
                />
            )}

            {cancelingItem && (
                <CancelConglomerateItemModal
                    item={cancelingItem}
                    onClose={() => setCancelingItem(null)}
                    onCancelled={async () => {
                        setCancelingItem(null);
                        await refetchAll();
                    }}
                />
            )}
        </div>
    );
};

const ReceiveConglomerateItemModal: React.FC<{
    branchId: string;
    item: Item;
    onClose: () => void;
    onReceived: () => void;
}> = ({ branchId, item, onClose, onReceived }) => {
    const { companyData } = useAuth();
    const usesWarehouses = !!companyData?.company?.usesWarehouses;

    const [quantity, setQuantity] = useState(String(item.quantitySent));
    const [warehouseId, setWarehouseId] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");

    const { data: warehousesData } = useQuery(GET_WAREHOUSES_BY_BRANCH, {
        variables: { branchId, includeInactive: false },
        skip: !usesWarehouses,
        fetchPolicy: "network-only",
    });
    const myWarehouses: Warehouse[] = warehousesData?.warehousesByBranch || [];

    const [receiveItem, { loading }] = useMutation(
        RECEIVE_CONGLOMERATE_TRANSFER_ITEM,
    );

    const handleSubmit = async () => {
        setError("");
        const qty = Number(quantity);
        if (!qty || qty <= 0) {
            setError("Ingrese una cantidad válida");
            return;
        }
        try {
            const { data } = await receiveItem({
                variables: {
                    itemId: item.id,
                    quantityReceived: qty,
                    warehouseId:
                        usesWarehouses && warehouseId ? warehouseId : undefined,
                    notes: notes || undefined,
                },
            });
            if (data?.receiveConglomerateTransferItem?.success) {
                onReceived();
            } else {
                setError(
                    data?.receiveConglomerateTransferItem?.message ||
                        "No se pudo confirmar la recepción",
                );
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Error al confirmar la recepción"));
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900">
                <h2 className="mb-1 text-lg font-black text-slate-800 dark:text-slate-100">
                    Confirmar recepción
                </h2>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {item.fromMasterIngredient.name} — enviado{" "}
                    {formatQty(item.quantitySent)}{" "}
                    {item.fromMasterIngredient.unitMeasure} desde{" "}
                    {companyLabel(item.outNote.company)}
                </p>
                <div className="flex flex-col gap-4">
                    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            El producto de esta sucursal se detecta automáticamente
                            por el catálogo del conglomerado. Si la recepción indica
                            que no hay un ingrediente maestro vinculado, pida al
                            administrador de la empresa master que lo vincule.
                        </p>
                    </div>
                    {usesWarehouses && myWarehouses.length > 1 && (
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Almacén que recibe
                            </label>
                            <select
                                value={warehouseId}
                                onChange={(e) => setWarehouseId(e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            >
                                <option value="">
                                    Almacén de entrada por defecto
                                </option>
                                {myWarehouses.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Cantidad recibida
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        />
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                            Si llegó menos de lo enviado, ingrese la cantidad
                            real: la diferencia queda registrada.
                        </p>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Notas (opcional)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        />
                    </div>
                    {error && (
                        <p className="text-xs font-bold text-rose-500">{error}</p>
                    )}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {loading ? "Confirmando..." : "Confirmar recepción"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CancelConglomerateItemModal: React.FC<{
    item: Item;
    onClose: () => void;
    onCancelled: () => void;
}> = ({ item, onClose, onCancelled }) => {
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [cancelItem, { loading }] = useMutation(
        CANCEL_CONGLOMERATE_TRANSFER_ITEM,
    );

    const handleSubmit = async () => {
        try {
            const { data } = await cancelItem({
                variables: { itemId: item.id, reason: reason || undefined },
            });
            if (data?.cancelConglomerateTransferItem?.success) {
                onCancelled();
            } else {
                setError(
                    data?.cancelConglomerateTransferItem?.message ||
                        "No se pudo cancelar la transferencia",
                );
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Error al cancelar la transferencia"));
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900">
                <h2 className="mb-1 text-lg font-black text-slate-800 dark:text-slate-100">
                    Cancelar transferencia
                </h2>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {item.fromMasterIngredient.name} —{" "}
                    {formatQty(item.quantitySent)}{" "}
                    {item.fromMasterIngredient.unitMeasure}. El stock vuelve
                    a su almacén de origen.
                </p>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Motivo (opcional)
                </label>
                <input
                    type="text"
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                {error && (
                    <p className="mt-2 text-xs font-bold text-rose-500">{error}</p>
                )}
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                        Volver
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-rose-700 disabled:opacity-50"
                    >
                        {loading ? "Cancelando..." : "Confirmar cancelación"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConglomerateTransfersTab;
