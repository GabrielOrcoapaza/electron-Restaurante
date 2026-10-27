import React, { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
    GET_PENDING_WAREHOUSE_TRANSFERS_BY_BRANCH,
    GET_WAREHOUSE_TRANSFER_IN_NOTES_BY_BRANCH,
    GET_WAREHOUSE_TRANSFER_OUT_NOTES_BY_BRANCH,
} from "../../graphql/queries";
import {
    CANCEL_WAREHOUSE_TRANSFER,
    RECEIVE_WAREHOUSE_TRANSFER,
} from "../../graphql/mutations";
import SendTransferModal from "./SendTransferModal";
import { downloadTransferNotePdf } from "../../utils/downloadTransferNotePdf";
import type { TransferNoteData } from "../../utils/transferNoteHtml";

interface Transfer {
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
    masterIngredient: { id: string; name: string; unitMeasure: string };
    fromWarehouse: { id: string; name: string; branch: { id: string; name: string } };
    toWarehouse: { id: string; name: string; branch: { id: string; name: string } };
    fromProduct: { id: string; code: string; name: string };
    toProduct: { id: string; code: string; name: string };
    sentBy?: { id: string; fullName: string } | null;
    receivedBy?: { id: string; fullName: string } | null;
    cancelledBy?: { id: string; fullName: string } | null;
    note?: {
        id: string;
        folio: string;
        motive?: string | null;
        driverName?: string | null;
        vehiclePlate?: string | null;
        notes?: string | null;
        sentAt?: string;
        sentBy?: { id: string; fullName: string } | null;
        fromBranch?: { id: string; name: string } | null;
    } | null;
    inNote?: { id: string; folio: string } | null;
}

/** Forma mínima que necesita el modal de confirmar cancelación/rechazo de un ítem. */
interface CancelableItem {
    id: string;
    masterIngredient: { id: string; name: string; unitMeasure: string };
    quantitySent: number;
}

interface NoteBranchRef {
    id: string;
    name: string;
    address?: string | null;
    phone?: string | null;
}

interface NoteCompanyRef {
    id: string;
    denomination?: string | null;
    commercialName?: string | null;
    ruc?: string | null;
    logo?: string | null;
}

interface NoteItem {
    id: string;
    status: Transfer["status"];
    quantitySent: number;
    quantityReceived?: number | null;
    notesSent?: string | null;
    notesReceived?: string | null;
    notesCancelled?: string | null;
    masterIngredient: { id: string; name: string; unitMeasure: string };
    fromProduct?: { id: string; code: string; name: string; unitMeasure?: string | null } | null;
    toProduct?: { id: string; code: string; name: string; unitMeasure?: string | null } | null;
    fromWarehouse?: { id: string; name: string } | null;
    toWarehouse?: { id: string; name: string } | null;
    sentBy?: { id: string; fullName: string } | null;
    receivedBy?: { id: string; fullName: string } | null;
}

/** Nota de salida (folio TR-XXXX). */
interface OutNote {
    id: string;
    folio: string;
    motive?: string | null;
    driverName?: string | null;
    vehiclePlate?: string | null;
    notes?: string | null;
    sentAt: string;
    createdAt: string;
    company: NoteCompanyRef;
    fromBranch: NoteBranchRef;
    toBranch: NoteBranchRef;
    sentBy?: { id: string; fullName: string } | null;
    inNote?: {
        id: string;
        folio: string;
        receivedAt: string;
        receivedBy?: { id: string; fullName: string } | null;
    } | null;
    transfers: NoteItem[];
}

/** Nota de entrada (folio TRE-XXXX). */
interface InNote {
    id: string;
    folio: string;
    receivedAt: string;
    notes?: string | null;
    company: NoteCompanyRef;
    receivedBy?: { id: string; fullName: string } | null;
    outNote: {
        id: string;
        folio: string;
        motive?: string | null;
        driverName?: string | null;
        vehiclePlate?: string | null;
        notes?: string | null;
        sentAt: string;
        company: NoteCompanyRef;
        fromBranch: NoteBranchRef;
        toBranch: NoteBranchRef;
        sentBy?: { id: string; fullName: string } | null;
        transfers: NoteItem[];
    };
    transfers: NoteItem[];
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

/** Estado del ítem tal como se imprime en el PDF de la nota. */
const itemStatusLabel = (
    status: Transfer["status"],
    notesCancelled?: string | null,
) => {
    const base =
        status === "RECEIVED"
            ? "Recibida"
            : status === "CANCELLED"
              ? "Cancelada"
              : "Enviada";
    const reason = (notesCancelled || "").trim();
    return reason ? `${base} — Motivo: ${reason}` : base;
};

/** Ítems que imprime la nota de entrada: todo lo que el destino ya procesó
 *  (recibido o rechazado). Los rechazados no quedan ligados a la nota de
 *  entrada, por eso se toman del despacho completo (outNote) y se excluyen
 *  los que todavía siguen pendientes (SENT). */
const inNoteDispatchItems = (note: InNote): NoteItem[] =>
    note.outNote.transfers.filter((t) => t.status !== "SENT");

/** Estado global de una nota de salida a partir de sus ítems. */
const noteStateBadge = (note: OutNote) => {
    const total = note.transfers.length;
    const received = note.transfers.filter((t) => t.status === "RECEIVED").length;
    const cancelled = note.transfers.filter((t) => t.status === "CANCELLED").length;

    let label = "Enviada";
    let cls =
        "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400";
    if (total > 0 && received === total) {
        label = "Recibida";
        cls =
            "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400";
    } else if (total > 0 && cancelled === total) {
        label = "Cancelada";
        cls = "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400";
    } else if (received > 0) {
        label = `Parcial ${received}/${total}`;
    }
    return (
        <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${cls}`}
        >
            {label}
        </span>
    );
};

/** Un envío (nota TR-XXXX, o un ítem suelto sin nota en transferencias muy antiguas)
 * agrupado con todos sus ítems todavía pendientes de recibir. */
interface PendingGroup {
    key: string;
    folio: string | null;
    fromBranchName: string;
    sentAt: string;
    sentByName: string;
    motive?: string | null;
    driverName?: string | null;
    vehiclePlate?: string | null;
    notes?: string | null;
    items: Transfer[];
}

const groupPendingByShipment = (items: Transfer[]): PendingGroup[] => {
    const order: string[] = [];
    const map = new Map<string, PendingGroup>();
    for (const t of items) {
        const key = t.note?.id ? `note-${t.note.id}` : `item-${t.id}`;
        if (!map.has(key)) {
            order.push(key);
            map.set(key, {
                key,
                folio: t.note?.folio || null,
                fromBranchName:
                    t.note?.fromBranch?.name || t.fromWarehouse.branch.name,
                sentAt: t.note?.sentAt || t.sentAt,
                sentByName:
                    t.note?.sentBy?.fullName || t.sentBy?.fullName || "—",
                motive: t.note?.motive,
                driverName: t.note?.driverName,
                vehiclePlate: t.note?.vehiclePlate,
                notes: t.note?.notes,
                items: [],
            });
        }
        map.get(key)!.items.push(t);
    }
    return order.map((k) => map.get(k)!);
};

const WarehouseTransfersTab: React.FC<{ branchId: string }> = ({
    branchId,
}) => {
    const [showSendModal, setShowSendModal] = useState(false);
    const [receivingGroup, setReceivingGroup] = useState<PendingGroup | null>(
        null,
    );
    const [cancelingNoteId, setCancelingNoteId] = useState<string | null>(
        null,
    );
    const [actionItem, setActionItem] = useState<{
        item: CancelableItem;
        variant: "cancel" | "reject";
    } | null>(null);
    const [pdfMessage, setPdfMessage] = useState("");
    const [downloadingNoteId, setDownloadingNoteId] = useState<string | null>(
        null,
    );
    const [downloadingInNoteId, setDownloadingInNoteId] = useState<
        string | null
    >(null);

    const {
        data: pendingData,
        loading: pendingLoading,
        refetch: refetchPending,
    } = useQuery(GET_PENDING_WAREHOUSE_TRANSFERS_BY_BRANCH, {
        variables: { branchId },
        skip: !branchId,
        fetchPolicy: "network-only",
    });
    const pending: Transfer[] =
        pendingData?.pendingWarehouseTransfersByBranch || [];
    const pendingGroups = groupPendingByShipment(pending);

    const {
        data: outNotesData,
        loading: outNotesLoading,
        refetch: refetchOutNotes,
    } = useQuery(GET_WAREHOUSE_TRANSFER_OUT_NOTES_BY_BRANCH, {
        variables: { branchId },
        skip: !branchId,
        fetchPolicy: "network-only",
    });
    const outNotes: OutNote[] =
        outNotesData?.warehouseTransferOutNotesByBranch || [];

    const {
        data: inNotesData,
        loading: inNotesLoading,
        refetch: refetchInNotes,
    } = useQuery(GET_WAREHOUSE_TRANSFER_IN_NOTES_BY_BRANCH, {
        variables: { branchId },
        skip: !branchId,
        fetchPolicy: "network-only",
    });
    const inNotes: InNote[] =
        inNotesData?.warehouseTransferInNotesByBranch || [];
    const activeCancelNote =
        outNotes.find((n) => n.id === cancelingNoteId) || null;

    const refetchAll = async () => {
        await Promise.all([
            refetchPending(),
            refetchOutNotes(),
            refetchInNotes(),
        ]);
    };

    // Regenera el PDF de una nota de salida del historial con los datos actuales
    // (incluye si ya fue recibida y quién la recibió).
    const handleDownloadOutNotePdf = async (note: OutNote) => {
        setDownloadingNoteId(note.id);
        setPdfMessage("");
        const data: TransferNoteData = {
            folio: note.folio,
            kind: "OUT",
            companyName:
                note.company?.denomination ||
                note.company?.commercialName ||
                "",
            companyRuc: note.company?.ruc || "",
            companyLogo: note.company?.logo || null,
            issuedAt: note.sentAt,
            sentAt: note.sentAt,
            origin: {
                branchName: note.fromBranch.name,
                manager: note.sentBy?.fullName || "",
                address: note.fromBranch.address || "",
                phone: note.fromBranch.phone || "",
            },
            destination: {
                branchName: note.toBranch.name,
                manager:
                    note.inNote?.receivedBy?.fullName ||
                    // Notas viejas (antes de la nota de entrada): el ítem ya
                    // guarda quién recibió, aunque la cabecera TRE- no exista.
                    note.transfers.find((t) => t.receivedBy)?.receivedBy
                        ?.fullName ||
                    "Pendiente de recepción",
                address: note.toBranch.address || "",
                phone: note.toBranch.phone || "",
            },
            motive: note.motive || "",
            driverName: note.driverName || "",
            vehiclePlate: note.vehiclePlate || "",
            items: note.transfers.map((t) => ({
                code: t.fromProduct?.code || "",
                description: t.fromProduct?.name || "",
                unit: t.fromProduct?.unitMeasure || "",
                quantity: Number(t.quantitySent) || 0,
                status: itemStatusLabel(t.status, t.notesCancelled),
            })),
            notes: note.notes || "",
        };
        const result = await downloadTransferNotePdf(data);
        setDownloadingNoteId(null);
        setPdfMessage(
            result.ok
                ? result.message || `PDF de ${note.folio} generado`
                : result.message || "No se pudo generar el PDF",
        );
    };

    // Genera el PDF de la nota de ENTRADA (folio TRE-XXXX) — tanto desde el botón
    // manual de "Notas de entrada" como automáticamente al terminar de recibir
    // un envío en ReceiveShipmentModal.
    const handleDownloadInNotePdf = async (note: InNote) => {
        setDownloadingInNoteId(note.id);
        setPdfMessage("");
        const data: TransferNoteData = {
            folio: note.folio,
            kind: "IN",
            companyName:
                note.company?.denomination ||
                note.company?.commercialName ||
                "",
            companyRuc: note.company?.ruc || "",
            companyLogo: note.company?.logo || null,
            issuedAt: note.receivedAt,
            sentAt: note.outNote.sentAt,
            origin: {
                branchName: note.outNote.fromBranch.name,
                manager: note.outNote.sentBy?.fullName || "",
                address: note.outNote.fromBranch.address || "",
                phone: note.outNote.fromBranch.phone || "",
            },
            destination: {
                branchName: note.outNote.toBranch.name,
                manager: note.receivedBy?.fullName || "",
                address: note.outNote.toBranch.address || "",
                phone: note.outNote.toBranch.phone || "",
            },
            motive: note.outNote.motive || "",
            driverName: note.outNote.driverName || "",
            vehiclePlate: note.outNote.vehiclePlate || "",
            items: inNoteDispatchItems(note).map((t) => ({
                code: t.toProduct?.code || t.fromProduct?.code || "",
                description: t.toProduct?.name || t.fromProduct?.name || "",
                unit:
                    t.toProduct?.unitMeasure ||
                    t.fromProduct?.unitMeasure ||
                    "",
                quantity: Number(t.quantityReceived ?? t.quantitySent) || 0,
                status: itemStatusLabel(t.status, t.notesCancelled),
            })),
            notes: note.notes || "",
        };
        const result = await downloadTransferNotePdf(data);
        setDownloadingInNoteId(null);
        setPdfMessage(
            result.ok
                ? result.message || `PDF de ${note.folio} generado`
                : result.message || "No se pudo generar el PDF",
        );
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                    Transferencias entre Sucursales
                </h2>
                <button
                    onClick={() => setShowSendModal(true)}
                    className="flex h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-4 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-all hover:bg-indigo-700"
                >
                    Enviar transferencia
                </button>
            </div>

            {pdfMessage && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[11px] font-bold text-indigo-600 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-300">
                    {pdfMessage}
                </div>
            )}

            {/* Pendientes por recibir, agrupadas por envío (nota TR-XXXX) */}
            <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-50 p-6 dark:border-slate-800/50">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                        Pendientes por recibir
                    </h3>
                    {pendingGroups.length > 0 && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                            {pendingGroups.length}
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
                    ) : pendingGroups.length === 0 ? (
                        <p className="p-6 text-center text-sm font-bold text-slate-400">
                            No hay transferencias pendientes de recibir
                        </p>
                    ) : (
                        pendingGroups.map((g) => (
                            <div
                                key={g.key}
                                className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {g.folio && (
                                            <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[9px] font-black text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
                                                {g.folio}
                                            </span>
                                        )}
                                        <span className="font-black text-slate-700 dark:text-slate-200">
                                            {g.fromBranchName}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {g.items.length} ítem(s)
                                        </span>
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400">
                                        {formatDate(g.sentAt)} ·{" "}
                                        {g.sentByName}
                                        {g.motive ? ` · ${g.motive}` : ""}
                                        {g.vehiclePlate
                                            ? ` · Placa ${g.vehiclePlate}`
                                            : ""}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setReceivingGroup(g)}
                                    className="whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-emerald-700"
                                >
                                    Ver envío
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Notas de salida (documento con folio TR-XXXX) */}
            <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-50 p-6 dark:border-slate-800/50">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                            Notas de salida
                        </h3>
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                            Documentos despachados desde esta sucursal (folio
                            TR-XXXX). Puede volver a descargar el PDF.
                        </p>
                    </div>
                    {outNotes.length > 0 && (
                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
                            {outNotes.length}
                        </span>
                    )}
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {outNotesLoading ? (
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
                    ) : outNotes.length === 0 ? (
                        <p className="p-6 text-center text-sm font-bold text-slate-400">
                            Todavía no se han despachado notas desde esta
                            sucursal
                        </p>
                    ) : (
                        outNotes.map((note) => (
                            <div
                                key={note.id}
                                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
                                            {note.folio}
                                        </span>
                                        {noteStateBadge(note)}
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {note.transfers.length} ítem(s)
                                        </span>
                                        {note.inNote && (
                                            <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
                                                Entrada {note.inNote.folio}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 font-black text-slate-700 dark:text-slate-200">
                                        {note.fromBranch.name} →{" "}
                                        {note.toBranch.name}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400">
                                        {formatDate(note.sentAt)} ·{" "}
                                        {note.sentBy?.fullName || "—"}
                                        {note.motive
                                            ? ` · ${note.motive}`
                                            : ""}
                                        {note.vehiclePlate
                                            ? ` · Placa ${note.vehiclePlate}`
                                            : ""}
                                    </div>
                                </div>
                                <div className="flex flex-shrink-0 gap-2">
                                    <button
                                        onClick={() =>
                                            handleDownloadOutNotePdf(note)
                                        }
                                        disabled={
                                            downloadingNoteId === note.id
                                        }
                                        className="whitespace-nowrap rounded-xl border border-indigo-200 px-4 py-2 text-xs font-black uppercase tracking-wider text-indigo-600 transition-all hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:hover:bg-indigo-900/20"
                                    >
                                        {downloadingNoteId === note.id
                                            ? "Generando..."
                                            : "PDF"}
                                    </button>
                                    {note.transfers.some(
                                        (it) => it.status === "SENT",
                                    ) && (
                                        <button
                                            onClick={() =>
                                                setCancelingNoteId(note.id)
                                            }
                                            className="whitespace-nowrap rounded-xl border border-rose-200 px-4 py-2 text-xs font-black uppercase tracking-wider text-rose-500 transition-all hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-900/20"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Notas de entrada (documento con folio TRE-XXXX) */}
            <div className="flex flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-50 p-6 dark:border-slate-800/50">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                            Notas de entrada
                        </h3>
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                            Documentos de recepción (folio TRE-XXXX) que
                            respaldan lo recibido y lo rechazado en esta
                            sucursal.
                        </p>
                    </div>
                    {inNotes.length > 0 && (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
                            {inNotes.length}
                        </span>
                    )}
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {inNotesLoading ? (
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
                    ) : inNotes.length === 0 ? (
                        <p className="p-6 text-center text-sm font-bold text-slate-400">
                            Todavía no se han recibido notas en esta sucursal
                        </p>
                    ) : (
                        inNotes.map((note) => {
                            const items = inNoteDispatchItems(note);
                            const cancelled = items.filter(
                                (it) => it.status === "CANCELLED",
                            ).length;
                            return (
                            <div
                                key={note.id}
                                className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
                                            {note.folio}
                                        </span>
                                        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                            de {note.outNote.folio}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {items.length} ítem(s)
                                            {cancelled > 0
                                                ? ` · ${cancelled} cancelado(s)`
                                                : ""}
                                        </span>
                                    </div>
                                    <div className="mt-1 font-black text-slate-700 dark:text-slate-200">
                                        {note.outNote.fromBranch.name} →{" "}
                                        {note.outNote.toBranch.name}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400">
                                        Recibida {formatDate(note.receivedAt)}{" "}
                                        por {note.receivedBy?.fullName || "—"}
                                        {note.outNote.motive
                                            ? ` · ${note.outNote.motive}`
                                            : ""}
                                    </div>
                                </div>
                                <button
                                    onClick={() =>
                                        handleDownloadInNotePdf(note)
                                    }
                                    disabled={
                                        downloadingInNoteId === note.id
                                    }
                                    className="flex-shrink-0 whitespace-nowrap rounded-xl border border-emerald-200 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-600 transition-all hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20"
                                >
                                    {downloadingInNoteId === note.id
                                        ? "Generando..."
                                        : "PDF"}
                                </button>
                            </div>
                            );
                        })
                    )}
                </div>
            </div>

            {showSendModal && (
                <SendTransferModal
                    branchId={branchId}
                    onClose={() => setShowSendModal(false)}
                    onSent={async () => {
                        setShowSendModal(false);
                        await refetchAll();
                    }}
                />
            )}

            {receivingGroup && (
                <ReceiveShipmentModal
                    group={receivingGroup}
                    refetchInNotes={refetchInNotes}
                    downloadInNotePdf={handleDownloadInNotePdf}
                    onClose={async () => {
                        setReceivingGroup(null);
                        await refetchAll();
                    }}
                    onChanged={refetchAll}
                />
            )}

            {activeCancelNote && (
                <CancelShipmentModal
                    note={activeCancelNote}
                    onClose={() => setCancelingNoteId(null)}
                    onPickItem={(it) =>
                        setActionItem({ item: it, variant: "cancel" })
                    }
                />
            )}

            {actionItem && (
                <CancelTransferModal
                    item={actionItem.item}
                    variant={actionItem.variant}
                    onClose={() => setActionItem(null)}
                    onCancelled={async () => {
                        setActionItem(null);
                        await refetchAll();
                    }}
                />
            )}
        </div>
    );
};

/** Modal de "Pendientes por recibir": detalla todos los ítems de UN envío, con
 * un checkbox por ítem (y "seleccionar todos") para recibirlos de una sola vez,
 * y la opción de Rechazar un ítem puntual. Al terminar de recibir, descarga
 * automáticamente el PDF de la nota de entrada (folio TRE-XXXX) resultante. */
const ReceiveShipmentModal: React.FC<{
    group: PendingGroup;
    refetchInNotes: () => Promise<{ data?: { warehouseTransferInNotesByBranch?: InNote[] } }>;
    downloadInNotePdf: (note: InNote) => Promise<void>;
    onClose: () => void;
    onChanged: () => Promise<void>;
}> = ({ group, refetchInNotes, downloadInNotePdf, onClose, onChanged }) => {
    const [items, setItems] = useState<Transfer[]>(group.items);
    const [selected, setSelected] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(group.items.map((it) => [it.id, true])),
    );
    const [quantities, setQuantities] = useState<Record<string, string>>(() =>
        Object.fromEntries(
            group.items.map((it) => [it.id, String(it.quantitySent)]),
        ),
    );
    const [results, setResults] = useState<
        Record<string, { success: boolean; message: string }>
    >({});
    const [rejectingItem, setRejectingItem] = useState<CancelableItem | null>(
        null,
    );
    const [submitting, setSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [error, setError] = useState("");
    const [receiveWarehouseTransfer] = useMutation(RECEIVE_WAREHOUSE_TRANSFER);

    const allSelected =
        items.length > 0 && items.every((it) => selected[it.id]);
    const selectedCount = items.filter((it) => selected[it.id]).length;

    const toggleAll = () => {
        const next = !allSelected;
        setSelected(Object.fromEntries(items.map((it) => [it.id, next])));
    };

    const handleReceiveSelected = async () => {
        setError("");
        const toProcess = items.filter((it) => selected[it.id]);
        if (toProcess.length === 0) {
            setError("Seleccione al menos un ítem para recibir");
            return;
        }
        setSubmitting(true);
        const newResults: Record<
            string,
            { success: boolean; message: string }
        > = {};
        let lastInNoteId: string | null = null;
        for (const it of toProcess) {
            const qty = Number(quantities[it.id]);
            if (!qty || qty <= 0) {
                newResults[it.id] = {
                    success: false,
                    message: "Cantidad inválida",
                };
                continue;
            }
            try {
                const { data } = await receiveWarehouseTransfer({
                    variables: { transferId: it.id, quantityReceived: qty },
                });
                const res = data?.receiveWarehouseTransfer;
                if (res?.success) {
                    newResults[it.id] = {
                        success: true,
                        message: "Recibido",
                    };
                    lastInNoteId = res.transfer?.inNote?.id || lastInNoteId;
                } else {
                    newResults[it.id] = {
                        success: false,
                        message: res?.message || "No se pudo recibir",
                    };
                }
            } catch (err) {
                newResults[it.id] = {
                    success: false,
                    message: getErrorMessage(err, "Error al recibir"),
                };
            }
        }
        const mergedResults = { ...results, ...newResults };
        setResults(mergedResults);
        setSubmitting(false);

        if (lastInNoteId) {
            setStatusMessage("Generando PDF de la nota de entrada...");
            const { data } = await refetchInNotes();
            const note = (
                data?.warehouseTransferInNotesByBranch || []
            ).find((n) => n.id === lastInNoteId);
            if (note) {
                await downloadInNotePdf(note);
            }
            setStatusMessage("");
        }

        // Si ya no queda ningún ítem sin recibir en el envío, se cierra solo
        // (onClose ya refresca "Pendientes por recibir" en el padre).
        const allReceived = items.every((it) => mergedResults[it.id]?.success);
        if (allReceived) {
            await onClose();
        } else {
            await onChanged();
        }
    };

    const handleRejected = async () => {
        if (!rejectingItem) return;
        setItems((prev) => prev.filter((it) => it.id !== rejectingItem.id));
        setRejectingItem(null);
        await onChanged();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900">
                <h2 className="mb-1 text-lg font-black text-slate-800 dark:text-slate-100">
                    {group.folio || "Envío"} — {group.fromBranchName}
                </h2>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Enviado {formatDate(group.sentAt)} por {group.sentByName}
                    {group.motive ? ` · ${group.motive}` : ""}
                    {group.vehiclePlate ? ` · Placa ${group.vehiclePlate}` : ""}
                </p>

                {items.length === 0 ? (
                    <p className="p-6 text-center text-sm font-bold text-slate-400">
                        Ya no quedan ítems pendientes en este envío
                    </p>
                ) : (
                    <>
                        <label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={toggleAll}
                                className="h-4 w-4 rounded border-slate-300"
                            />
                            Seleccionar todos
                        </label>
                        <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
                            {items.map((it) => {
                                const result = results[it.id];
                                return (
                                    <div
                                        key={it.id}
                                        className="flex flex-col gap-2 rounded-2xl border border-slate-100 p-4 dark:border-slate-800/60 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={!!selected[it.id]}
                                                onChange={(e) =>
                                                    setSelected((prev) => ({
                                                        ...prev,
                                                        [it.id]:
                                                            e.target.checked,
                                                    }))
                                                }
                                                className="mt-1 h-4 w-4 rounded border-slate-300"
                                            />
                                            <div>
                                                <div className="font-black text-slate-700 dark:text-slate-200">
                                                    {it.masterIngredient.name}{" "}
                                                    — enviado{" "}
                                                    {formatQty(
                                                        it.quantitySent,
                                                    )}{" "}
                                                    {
                                                        it.masterIngredient
                                                            .unitMeasure
                                                    }
                                                </div>
                                                {it.notesSent && (
                                                    <div className="text-[10px] italic text-slate-400">
                                                        "{it.notesSent}"
                                                    </div>
                                                )}
                                                {result && (
                                                    <div
                                                        className={`text-[10px] font-bold ${
                                                            result.success
                                                                ? "text-emerald-600"
                                                                : "text-rose-500"
                                                        }`}
                                                    >
                                                        {result.message}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-shrink-0 items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={quantities[it.id]}
                                                onChange={(e) =>
                                                    setQuantities((prev) => ({
                                                        ...prev,
                                                        [it.id]:
                                                            e.target.value,
                                                    }))
                                                }
                                                disabled={!selected[it.id]}
                                                className="w-20 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-700 outline-none disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                            />
                                            <button
                                                onClick={() =>
                                                    setRejectingItem(it)
                                                }
                                                className="rounded-xl border border-rose-200 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-rose-500 transition-all hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-900/20"
                                            >
                                                Rechazar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {error && (
                            <p className="mt-3 text-xs font-bold text-rose-500">
                                {error}
                            </p>
                        )}
                        {statusMessage && (
                            <p className="mt-3 text-xs font-bold text-indigo-500">
                                {statusMessage}
                            </p>
                        )}
                    </>
                )}

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                        Cerrar
                    </button>
                    {items.length > 0 && (
                        <button
                            onClick={handleReceiveSelected}
                            disabled={submitting || selectedCount === 0}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {submitting
                                ? "Recibiendo..."
                                : `Confirmar recepción (${selectedCount})`}
                        </button>
                    )}
                </div>
            </div>

            {rejectingItem && (
                <CancelTransferModal
                    item={rejectingItem}
                    variant="reject"
                    onClose={() => setRejectingItem(null)}
                    onCancelled={handleRejected}
                />
            )}
        </div>
    );
};

/** Modal del lado emisor: lista los ítems todavía SENT de una nota de salida
 * para elegir cuál cancelar (el resto del envío sigue su curso). */
const CancelShipmentModal: React.FC<{
    note: OutNote;
    onClose: () => void;
    onPickItem: (it: CancelableItem) => void;
}> = ({ note, onClose, onPickItem }) => {
    const pendingItems = note.transfers.filter((t) => t.status === "SENT");
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900">
                <h2 className="mb-1 text-lg font-black text-slate-800 dark:text-slate-100">
                    Cancelar ítem de {note.folio}
                </h2>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Elija cuál ítem cancelar. El resto del envío sigue
                    pendiente o recibido como esté.
                </p>
                <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
                    {pendingItems.length === 0 ? (
                        <p className="p-4 text-center text-sm font-bold text-slate-400">
                            Ya no quedan ítems pendientes de cancelar en este
                            envío
                        </p>
                    ) : (
                        pendingItems.map((it) => (
                            <div
                                key={it.id}
                                className="flex flex-col gap-2 rounded-2xl border border-slate-100 p-4 dark:border-slate-800/60 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="font-black text-slate-700 dark:text-slate-200">
                                    {it.masterIngredient.name} —{" "}
                                    {formatQty(it.quantitySent)}{" "}
                                    {it.masterIngredient.unitMeasure}
                                </div>
                                <button
                                    onClick={() => onPickItem(it)}
                                    className="whitespace-nowrap rounded-xl border border-rose-200 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-rose-500 transition-all hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-900/20"
                                >
                                    Cancelar este ítem
                                </button>
                            </div>
                        ))
                    )}
                </div>
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

const CancelTransferModal: React.FC<{
    item: CancelableItem;
    variant?: "cancel" | "reject";
    onClose: () => void;
    onCancelled: () => void;
}> = ({ item, variant = "cancel", onClose, onCancelled }) => {
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [cancelWarehouseTransfer, { loading }] = useMutation(
        CANCEL_WAREHOUSE_TRANSFER,
    );
    const isReject = variant === "reject";

    const handleSubmit = async () => {
        try {
            const { data } = await cancelWarehouseTransfer({
                variables: { transferId: item.id, reason: reason || undefined },
            });
            if (data?.cancelWarehouseTransfer?.success) {
                onCancelled();
            } else {
                setError(
                    data?.cancelWarehouseTransfer?.message ||
                        `No se pudo ${isReject ? "rechazar" : "cancelar"} la transferencia`,
                );
            }
        } catch (err: unknown) {
            setError(
                getErrorMessage(
                    err,
                    `Error al ${isReject ? "rechazar" : "cancelar"} la transferencia`,
                ),
            );
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900">
                <h2 className="mb-1 text-lg font-black text-slate-800 dark:text-slate-100">
                    {isReject ? "Rechazar envío" : "Cancelar transferencia"}
                </h2>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {item.masterIngredient.name} —{" "}
                    {formatQty(item.quantitySent)}{" "}
                    {item.masterIngredient.unitMeasure}. El stock vuelve
                    al almacén de origen.
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
                    <p className="mt-2 text-xs font-bold text-rose-500">
                        {error}
                    </p>
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
                        {loading
                            ? isReject
                                ? "Rechazando..."
                                : "Cancelando..."
                            : isReject
                              ? "Confirmar rechazo"
                              : "Confirmar cancelación"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WarehouseTransfersTab;
