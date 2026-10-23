import React, { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
    GET_PENDING_WAREHOUSE_TRANSFERS_BY_BRANCH,
    GET_WAREHOUSE_TRANSFER_IN_NOTES_BY_BRANCH,
    GET_WAREHOUSE_TRANSFER_OUT_NOTES_BY_BRANCH,
    GET_WAREHOUSE_TRANSFERS_BY_BRANCH,
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
    note?: { id: string; folio: string } | null;
    inNote?: { id: string; folio: string } | null;
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

const statusBadge = (status: Transfer["status"]) => {
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

/** Estado del ítem tal como se imprime en el PDF de la nota. */
const itemStatusLabel = (status: Transfer["status"]) =>
    status === "RECEIVED"
        ? "Recibida"
        : status === "CANCELLED"
          ? "Cancelada"
          : "Enviada";

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

const WarehouseTransfersTab: React.FC<{ branchId: string }> = ({
    branchId,
}) => {
    const [showSendModal, setShowSendModal] = useState(false);
    const [receivingTransfer, setReceivingTransfer] =
        useState<Transfer | null>(null);
    const [cancelingTransfer, setCancelingTransfer] =
        useState<Transfer | null>(null);
    const [pdfMessage, setPdfMessage] = useState("");
    const [downloadingNoteId, setDownloadingNoteId] = useState<string | null>(
        null,
    );

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

    const {
        data: historyData,
        loading: historyLoading,
        refetch: refetchHistory,
    } = useQuery(GET_WAREHOUSE_TRANSFERS_BY_BRANCH, {
        variables: { branchId },
        skip: !branchId,
        fetchPolicy: "network-only",
    });
    const history: Transfer[] = historyData?.warehouseTransfersByBranch || [];

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

    const refetchAll = async () => {
        await Promise.all([
            refetchPending(),
            refetchHistory(),
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
                code: t.fromProduct?.code || t.toProduct?.code || "",
                description:
                    t.masterIngredient?.name || t.fromProduct?.name || "",
                unit:
                    t.masterIngredient?.unitMeasure ||
                    t.fromProduct?.unitMeasure ||
                    "",
                quantity: Number(t.quantitySent) || 0,
                status: itemStatusLabel(t.status),
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
                        pending.map((t) => (
                            <div
                                key={t.id}
                                className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-black text-slate-700 dark:text-slate-200">
                                            {t.masterIngredient.name} —{" "}
                                            {formatQty(t.quantitySent)}{" "}
                                            {t.masterIngredient.unitMeasure}
                                        </span>
                                        {t.note?.folio && (
                                            <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[9px] font-black text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
                                                {t.note.folio}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400">
                                        Desde {t.fromWarehouse.branch.name} (
                                        {t.fromWarehouse.name}) ·{" "}
                                        {formatDate(t.sentAt)} ·{" "}
                                        {t.sentBy?.fullName || "—"}
                                    </div>
                                    {t.notesSent && (
                                        <div className="text-[10px] italic text-slate-400">
                                            "{t.notesSent}"
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setReceivingTransfer(t)}
                                    className="whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-emerald-700"
                                >
                                    Recibir
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
                                <button
                                    onClick={() =>
                                        handleDownloadOutNotePdf(note)
                                    }
                                    disabled={downloadingNoteId === note.id}
                                    className="whitespace-nowrap rounded-xl border border-indigo-200 px-4 py-2 text-xs font-black uppercase tracking-wider text-indigo-600 transition-all hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:hover:bg-indigo-900/20"
                                >
                                    {downloadingNoteId === note.id
                                        ? "Generando..."
                                        : "PDF"}
                                </button>
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
                            respaldan lo recibido en esta sucursal.
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
                        inNotes.map((note) => (
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
                                            {note.transfers.length} ítem(s)
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
                                    <th className="px-6 py-4">Nota</th>
                                    <th className="px-6 py-4">Origen → Destino</th>
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
                                {history.map((t) => {
                                    const canCancel =
                                        t.status === "SENT" &&
                                        t.fromWarehouse.branch.id === branchId;
                                    return (
                                        <tr
                                            key={t.id}
                                            className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                                        >
                                            <td className="px-6 py-4 font-black text-slate-700 dark:text-slate-200">
                                                {t.masterIngredient.name}
                                            </td>
                                            <td className="px-6 py-4">
                                                {t.note?.folio ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="w-fit rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
                                                            {t.note.folio}
                                                        </span>
                                                        {t.inNote?.folio && (
                                                            <span className="w-fit rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
                                                                {t.inNote.folio}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">
                                                {t.fromWarehouse.branch.name} →{" "}
                                                {t.toWarehouse.branch.name}
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-300">
                                                {formatQty(t.quantitySent)}
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-300">
                                                {t.quantityReceived != null
                                                    ? formatQty(
                                                          t.quantityReceived,
                                                      )
                                                    : "—"}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {statusBadge(t.status)}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-400">
                                                {formatDate(t.sentAt)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {canCancel && (
                                                    <button
                                                        onClick={() =>
                                                            setCancelingTransfer(
                                                                t,
                                                            )
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
                <SendTransferModal
                    branchId={branchId}
                    onClose={() => setShowSendModal(false)}
                    onSent={async () => {
                        setShowSendModal(false);
                        await refetchAll();
                    }}
                />
            )}

            {receivingTransfer && (
                <ReceiveTransferModal
                    transfer={receivingTransfer}
                    onClose={() => setReceivingTransfer(null)}
                    onReceived={async () => {
                        setReceivingTransfer(null);
                        await refetchAll();
                    }}
                />
            )}

            {cancelingTransfer && (
                <CancelTransferModal
                    transfer={cancelingTransfer}
                    onClose={() => setCancelingTransfer(null)}
                    onCancelled={async () => {
                        setCancelingTransfer(null);
                        await refetchAll();
                    }}
                />
            )}
        </div>
    );
};

const ReceiveTransferModal: React.FC<{
    transfer: Transfer;
    onClose: () => void;
    onReceived: () => void;
}> = ({ transfer, onClose, onReceived }) => {
    const [quantity, setQuantity] = useState(String(transfer.quantitySent));
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");
    const [receiveWarehouseTransfer, { loading }] = useMutation(
        RECEIVE_WAREHOUSE_TRANSFER,
    );

    const handleSubmit = async () => {
        const qty = Number(quantity);
        if (!qty || qty <= 0) {
            setError("Ingrese una cantidad válida");
            return;
        }
        try {
            const { data } = await receiveWarehouseTransfer({
                variables: {
                    transferId: transfer.id,
                    quantityReceived: qty,
                    notes: notes || undefined,
                },
            });
            if (data?.receiveWarehouseTransfer?.success) {
                onReceived();
            } else {
                setError(
                    data?.receiveWarehouseTransfer?.message ||
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
                    {transfer.masterIngredient.name} — enviado{" "}
                    {formatQty(transfer.quantitySent)}{" "}
                    {transfer.masterIngredient.unitMeasure}
                </p>
                <div className="flex flex-col gap-4">
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
                        <p className="text-xs font-bold text-rose-500">
                            {error}
                        </p>
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

const CancelTransferModal: React.FC<{
    transfer: Transfer;
    onClose: () => void;
    onCancelled: () => void;
}> = ({ transfer, onClose, onCancelled }) => {
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [cancelWarehouseTransfer, { loading }] = useMutation(
        CANCEL_WAREHOUSE_TRANSFER,
    );

    const handleSubmit = async () => {
        try {
            const { data } = await cancelWarehouseTransfer({
                variables: { transferId: transfer.id, reason: reason || undefined },
            });
            if (data?.cancelWarehouseTransfer?.success) {
                onCancelled();
            } else {
                setError(
                    data?.cancelWarehouseTransfer?.message ||
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
                    {transfer.masterIngredient.name} —{" "}
                    {formatQty(transfer.quantitySent)}{" "}
                    {transfer.masterIngredient.unitMeasure}. El stock vuelve
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
                        {loading ? "Cancelando..." : "Confirmar cancelación"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WarehouseTransfersTab;
