import React, { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import {
    GET_BRANCHES_BY_COMPANY,
    GET_COMPANIES_IN_MY_CONGLOMERATE,
    GET_MASTER_INGREDIENTS_BY_COMPANY,
    GET_PRODUCTS_FOR_MASTER_INGREDIENT_LINK,
    GET_STOCKS_BY_WAREHOUSE,
    GET_WAREHOUSES_BY_BRANCH,
} from "../../graphql/queries";
import { SEND_CONGLOMERATE_TRANSFER } from "../../graphql/mutations";
import SuggestionInput from "../../components/SuggestionInput";
import { BRANCH_TRANSFER_NOTE_SUGGESTIONS } from "../../constants/transferReasonSuggestions";
import { downloadTransferNotePdf } from "../../utils/downloadTransferNotePdf";
import type { TransferNoteData } from "../../utils/transferNoteHtml";

interface CompanyOption {
    id: string;
    denomination?: string | null;
    commercialName?: string | null;
    ruc?: string | null;
}

interface BranchOption {
    id: string;
    name: string;
    address?: string | null;
    phone?: string | null;
}

interface Warehouse {
    id: string;
    name: string;
    isActive: boolean;
    isDefaultPurchase: boolean;
    isDefaultSale: boolean;
}

interface MasterIngredient {
    id: string;
    name: string;
    unitMeasure: string;
    isActive: boolean;
}

interface LinkedChildProduct {
    id: string;
    code?: string | null;
    name: string;
    unitMeasure?: string | null;
    currentStock: number;
    masterIngredient: { id: string } | null;
}

interface WarehouseStockRow {
    currentQuantity: number;
    product: { id: string; masterIngredient: { id: string } | null };
}

interface SendConglomerateTransferModalProps {
    branchId: string;
    onClose: () => void;
    onSent: () => void;
}

interface ItemResult {
    ingredientName: string;
    success: boolean;
    message: string;
}

const getErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error) return err.message;
    return fallback;
};

const companyLabel = (c: CompanyOption) =>
    c.commercialName || c.denomination || `Empresa ${c.id}`;

const SendConglomerateTransferModal: React.FC<
    SendConglomerateTransferModalProps
> = ({ branchId, onClose, onSent }) => {
    const { companyData, user } = useAuth();
    const usesWarehouses = !!companyData?.company?.usesWarehouses;

    const { data: companiesData, loading: companiesLoading } = useQuery(
        GET_COMPANIES_IN_MY_CONGLOMERATE,
        { fetchPolicy: "network-only" },
    );
    const companies: CompanyOption[] =
        companiesData?.companiesInMyConglomerate || [];

    const [toCompanyId, setToCompanyId] = useState("");
    const [toBranchId, setToBranchId] = useState("");
    const [fromWarehouseId, setFromWarehouseId] = useState("");
    const [quantities, setQuantities] = useState<Record<string, string>>({});
    const [ingredientFilter, setIngredientFilter] = useState("");
    const [motive, setMotive] = useState("");
    const [includeTransportDetails, setIncludeTransportDetails] =
        useState(false);
    const [driverName, setDriverName] = useState("");
    const [vehiclePlate, setVehiclePlate] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");
    const [results, setResults] = useState<ItemResult[] | null>(null);
    const [sentFolio, setSentFolio] = useState<string | null>(null);
    // Nota despachada (folio + datos armados) para poder re-descargar el PDF.
    const [sentNote, setSentNote] = useState<{
        folio: string;
        data: TransferNoteData;
    } | null>(null);
    const [pdfMessage, setPdfMessage] = useState("");

    const { data: destBranchesData, loading: destBranchesLoading } = useQuery(
        GET_BRANCHES_BY_COMPANY,
        {
            variables: { companyId: toCompanyId },
            skip: !toCompanyId,
            fetchPolicy: "network-only",
        },
    );
    const destBranches: BranchOption[] =
        destBranchesData?.branchesByCompany || [];

    const { data: ownWarehousesData } = useQuery(GET_WAREHOUSES_BY_BRANCH, {
        variables: { branchId, includeInactive: false },
        skip: !branchId || !usesWarehouses,
        fetchPolicy: "network-only",
    });
    const ownWarehouses: Warehouse[] =
        ownWarehousesData?.warehousesByBranch || [];

    const { data: ingredientsData } = useQuery(
        GET_MASTER_INGREDIENTS_BY_COMPANY,
        { variables: { includeInactive: false }, fetchPolicy: "network-only" },
    );
    const masterIngredients: MasterIngredient[] =
        ingredientsData?.masterIngredientsByCompany || [];
    const normalizedFilter = ingredientFilter.trim().toLowerCase();
    const filteredIngredients = normalizedFilter
        ? masterIngredients.filter((mi) =>
              mi.name.toLowerCase().includes(normalizedFilter),
          )
        : masterIngredients;

    const {
        data: childrenData,
        loading: childrenLoading,
        refetch: refetchChildren,
    } = useQuery(GET_PRODUCTS_FOR_MASTER_INGREDIENT_LINK, {
        variables: { branchId },
        skip: !branchId,
        fetchPolicy: "network-only",
    });
    const childrenByMaster: Record<string, LinkedChildProduct> = {};
    ((childrenData?.products || []) as LinkedChildProduct[]).forEach((p) => {
        if (p.masterIngredient) {
            childrenByMaster[p.masterIngredient.id] = p;
        }
    });

    const {
        data: fromStocksData,
        loading: fromStocksLoading,
        refetch: refetchFromStocks,
    } = useQuery(GET_STOCKS_BY_WAREHOUSE, {
        variables: { warehouseId: fromWarehouseId },
        skip: !usesWarehouses || !fromWarehouseId,
        fetchPolicy: "network-only",
    });
    const warehouseStockByMaster: Record<string, number> = {};
    ((fromStocksData?.stocksByWarehouse || []) as WarehouseStockRow[]).forEach(
        (row) => {
            if (row.product.masterIngredient) {
                warehouseStockByMaster[row.product.masterIngredient.id] =
                    Number(row.currentQuantity) || 0;
            }
        },
    );

    const [sendConglomerateTransfer, { loading: submitting }] = useMutation(
        SEND_CONGLOMERATE_TRANSFER,
    );

    const toggleItem = (ingredientId: string) => {
        setQuantities((prev) => {
            const next = { ...prev };
            if (ingredientId in next) {
                delete next[ingredientId];
            } else {
                next[ingredientId] = "";
            }
            return next;
        });
    };

    const setItemQuantity = (ingredientId: string, value: string) => {
        setQuantities((prev) => ({ ...prev, [ingredientId]: value }));
    };

    const selectedCount = Object.keys(quantities).length;

    const handleSubmit = async () => {
        setError("");
        setResults(null);
        setSentFolio(null);
        if (!toBranchId) {
            setError("Seleccione la empresa y sucursal destino");
            return;
        }
        if (usesWarehouses && ownWarehouses.length > 1 && !fromWarehouseId) {
            setError("Seleccione el almacén de origen");
            return;
        }
        const entries = Object.entries(quantities);
        if (entries.length === 0) {
            setError("Seleccione al menos un ingrediente");
            return;
        }
        for (const [, qtyStr] of entries) {
            const qty = Number(qtyStr);
            if (!qty || qty <= 0) {
                setError(
                    "Ingrese una cantidad válida en todos los ingredientes marcados",
                );
                return;
            }
        }

        let payload: {
            success?: boolean;
            message?: string;
            folio?: string | null;
            note?: { id: string; folio: string; sentAt: string } | null;
            results?: Array<{
                masterIngredientId: string;
                masterIngredientName?: string | null;
                success: boolean;
                message?: string | null;
            }>;
        } | null = null;
        try {
            const { data } = await sendConglomerateTransfer({
                variables: {
                    toBranchId,
                    fromWarehouseId: fromWarehouseId || undefined,
                    items: entries.map(([masterIngredientId, qtyStr]) => ({
                        masterIngredientId,
                        quantity: Number(qtyStr),
                    })),
                    motive: motive.trim() || undefined,
                    driverName: includeTransportDetails
                        ? driverName.trim() || undefined
                        : undefined,
                    vehiclePlate: includeTransportDetails
                        ? vehiclePlate.trim() || undefined
                        : undefined,
                    notes: notes.trim() || undefined,
                },
            });
            payload = data?.sendConglomerateTransfer ?? null;
        } catch (err: unknown) {
            setResults([
                {
                    ingredientName: "Envío",
                    success: false,
                    message: getErrorMessage(err, "Error al enviar"),
                },
            ]);
            return;
        }

        const rowResults = payload?.results || [];
        const itemResults: ItemResult[] =
            rowResults.length > 0
                ? rowResults.map((r) => ({
                      ingredientName:
                          r.masterIngredientName || r.masterIngredientId,
                      success: Boolean(r.success),
                      message:
                          r.message || (r.success ? "Enviado" : "No se pudo enviar"),
                  }))
                : [
                      {
                          ingredientName: "Envío",
                          success: false,
                          message: payload?.message || "No se pudo enviar",
                      },
                  ];
        setResults(itemResults);
        if (payload?.success && payload.folio) {
            setSentFolio(payload.folio);
        }

        const anySuccess = itemResults.some((r) => r.success);
        if (anySuccess) {
            await refetchChildren();
            if (usesWarehouses && fromWarehouseId) {
                await refetchFromStocks();
            }

            if (payload?.success && payload.folio && payload.note?.sentAt) {
                // Armar y descargar el PDF de la nota de salida (TRC-XXXX) —
                // mismo mecanismo que SendTransferModal, pero cada lado trae
                // su propia empresa (origen y destino son empresas distintas).
                const sentAt = payload.note.sentAt;
                const destCompany = companies.find(
                    (c) => String(c.id) === String(toCompanyId),
                );
                const destBranch = destBranches.find(
                    (b) => String(b.id) === String(toBranchId),
                );
                const okIds = new Set(
                    rowResults
                        .filter((r) => r.success)
                        .map((r) => r.masterIngredientId),
                );
                const noteData: TransferNoteData = {
                    folio: payload.folio,
                    variant: "CONGLOMERATE",
                    kind: "OUT",
                    companyName:
                        companyData?.company?.denomination ||
                        companyData?.company?.commercialName ||
                        "",
                    companyRuc: companyData?.company?.ruc || "",
                    companyLogo:
                        companyData?.company?.logo ||
                        companyData?.branch?.logo ||
                        null,
                    issuedAt: sentAt,
                    sentAt,
                    origin: {
                        branchName: companyData?.branch?.name || "",
                        manager: user?.fullName || "",
                        address: companyData?.branch?.address || "",
                        phone: companyData?.branch?.phone || "",
                        companyName:
                            companyData?.company?.commercialName ||
                            companyData?.company?.denomination ||
                            "",
                        companyRuc: companyData?.company?.ruc || "",
                    },
                    destination: {
                        branchName: destBranch?.name || "",
                        manager: "Pendiente de recepción",
                        address: destBranch?.address || "",
                        phone: destBranch?.phone || "",
                        companyName: destCompany
                            ? companyLabel(destCompany)
                            : "",
                        companyRuc: destCompany?.ruc || "",
                    },
                    motive: motive.trim(),
                    driverName: includeTransportDetails
                        ? driverName.trim()
                        : "",
                    vehiclePlate: includeTransportDetails
                        ? vehiclePlate.trim()
                        : "",
                    items: entries
                        .filter(([miId]) => okIds.has(miId))
                        .map(([miId, qtyStr]) => {
                            const child = childrenByMaster[miId];
                            return {
                                code: child?.code || "",
                                description:
                                    child?.name ||
                                    masterIngredients.find(
                                        (m) => m.id === miId,
                                    )?.name ||
                                    miId,
                                unit:
                                    child?.unitMeasure ||
                                    masterIngredients.find(
                                        (m) => m.id === miId,
                                    )?.unitMeasure ||
                                    "",
                                quantity: Number(qtyStr) || 0,
                                status: "Enviada",
                            };
                        }),
                    notes: notes.trim(),
                };
                setSentNote({ folio: payload.folio, data: noteData });
                const pdf = await downloadTransferNotePdf(noteData);
                setPdfMessage(
                    pdf.ok
                        ? pdf.message || ""
                        : pdf.message || "No se pudo generar el PDF",
                );
            }
        }
        if (itemResults.every((r) => r.success)) {
            onSent();
        }
    };

    const handleDownloadPdf = async () => {
        if (!sentNote) return;
        const pdf = await downloadTransferNotePdf(sentNote.data);
        setPdfMessage(
            pdf.ok
                ? pdf.message || ""
                : pdf.message || "No se pudo descargar el PDF",
        );
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-900">
                <div className="border-b border-slate-100 p-6 dark:border-slate-800">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Enviar transferencia a otra empresa
                    </h2>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        El stock sale de su almacén de inmediato. La empresa
                        destino debe confirmar la recepción e indicar a cuál
                        de sus propios ingredientes corresponde cada uno.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Empresa destino
                                </label>
                                <select
                                    value={toCompanyId}
                                    onChange={(e) => {
                                        setToCompanyId(e.target.value);
                                        setToBranchId("");
                                    }}
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                >
                                    <option value="">
                                        {companiesLoading
                                            ? "Cargando..."
                                            : "Seleccione..."}
                                    </option>
                                    {companies.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {companyLabel(c)}
                                        </option>
                                    ))}
                                </select>
                                {!companiesLoading && companies.length === 0 && (
                                    <p className="mt-1 text-[10px] font-bold text-amber-500">
                                        No hay otras empresas en su
                                        conglomerado
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Sucursal destino
                                </label>
                                <select
                                    value={toBranchId}
                                    onChange={(e) =>
                                        setToBranchId(e.target.value)
                                    }
                                    disabled={!toCompanyId || destBranchesLoading}
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                >
                                    <option value="">
                                        {!toCompanyId
                                            ? "Elija la empresa"
                                            : "Seleccione..."}
                                    </option>
                                    {destBranches.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {usesWarehouses && ownWarehouses.length > 1 && (
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Almacén de origen
                                </label>
                                <select
                                    value={fromWarehouseId}
                                    onChange={(e) => {
                                        setFromWarehouseId(e.target.value);
                                        setIngredientFilter("");
                                    }}
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                >
                                    <option value="">
                                        Almacén de salida por defecto
                                    </option>
                                    {ownWarehouses.map((w) => (
                                        <option key={w.id} value={w.id}>
                                            {w.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Ingredientes a transferir{" "}
                                {selectedCount > 0 &&
                                    `(${selectedCount} marcados)`}
                            </label>
                            <input
                                type="search"
                                value={ingredientFilter}
                                onChange={(e) =>
                                    setIngredientFilter(e.target.value)
                                }
                                placeholder="Filtrar por nombre..."
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none placeholder:font-semibold placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                {masterIngredients.length === 0 ? (
                                    <p className="p-4 text-center text-xs font-bold text-slate-400">
                                        No hay ingredientes maestros activos
                                    </p>
                                ) : filteredIngredients.length === 0 ? (
                                    <p className="p-4 text-center text-xs font-bold text-slate-400">
                                        Ningún ingrediente coincide con el
                                        filtro
                                    </p>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredIngredients.map((mi) => {
                                            const checked =
                                                mi.id in quantities;
                                            const child =
                                                childrenByMaster[mi.id];
                                            let childLine: React.ReactNode;
                                            if (childrenLoading) {
                                                childLine = (
                                                    <span>
                                                        Cargando producto
                                                        vinculado...
                                                    </span>
                                                );
                                            } else if (!child) {
                                                childLine = (
                                                    <span className="text-rose-500">
                                                        Sin producto propio
                                                        vinculado
                                                    </span>
                                                );
                                            } else if (
                                                usesWarehouses &&
                                                fromWarehouseId &&
                                                fromStocksLoading
                                            ) {
                                                childLine = (
                                                    <span>
                                                        {child.name} ·
                                                        Cargando stock del
                                                        almacén...
                                                    </span>
                                                );
                                            } else if (
                                                usesWarehouses &&
                                                fromWarehouseId
                                            ) {
                                                const qty =
                                                    warehouseStockByMaster[
                                                        mi.id
                                                    ] ?? 0;
                                                childLine = (
                                                    <span
                                                        className={
                                                            qty > 0
                                                                ? undefined
                                                                : "text-amber-500"
                                                        }
                                                    >
                                                        {child.name} · stock:{" "}
                                                        {qty.toFixed(2)}
                                                        {qty <= 0
                                                            ? " (sin stock en este almacén)"
                                                            : ""}
                                                    </span>
                                                );
                                            } else {
                                                childLine = (
                                                    <span>
                                                        {child.name} · stock:{" "}
                                                        {Number(
                                                            child.currentStock,
                                                        ).toFixed(2)}
                                                    </span>
                                                );
                                            }
                                            return (
                                                <div
                                                    key={mi.id}
                                                    onClick={() =>
                                                        toggleItem(mi.id)
                                                    }
                                                    className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                        onWheel={(e) =>
                                                            e.currentTarget.blur()
                                                        }
                                                        onChange={() =>
                                                            toggleItem(mi.id)
                                                        }
                                                        className="h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
                                                    />
                                                    <div className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                                                        {mi.name}{" "}
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            ({mi.unitMeasure})
                                                        </span>
                                                        <div className="text-[10px] font-bold text-slate-400">
                                                            {childLine}
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        disabled={!checked}
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                        onWheel={(e) =>
                                                            e.currentTarget.blur()
                                                        }
                                                        onKeyDown={(e) => {
                                                            if (
                                                                e.key ===
                                                                    "ArrowUp" ||
                                                                e.key ===
                                                                    "ArrowDown"
                                                            ) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                        value={
                                                            quantities[mi.id] ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            setItemQuantity(
                                                                mi.id,
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="no-spinner w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-bold text-slate-700 outline-none disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <p className="mt-1 text-[10px] font-bold text-slate-400">
                                La empresa destino recibirá cada ítem e
                                indicará (solo la primera vez) a cuál de sus
                                propios ingredientes corresponde.
                            </p>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Motivo del traslado
                            </label>
                            <SuggestionInput
                                value={motive}
                                onChange={setMotive}
                                suggestions={BRANCH_TRANSFER_NOTE_SUGGESTIONS}
                                placeholder="Elija un motivo o escriba uno propio..."
                                inputClassName="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={includeTransportDetails}
                                    onChange={(e) =>
                                        setIncludeTransportDetails(
                                            e.target.checked,
                                        )
                                    }
                                    className="h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
                                />
                                Incluir conductor y vehículo (información adicional)
                            </label>
                            {includeTransportDetails && (
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Conductor (opcional)
                                        </label>
                                        <input
                                            type="text"
                                            value={driverName}
                                            onChange={(e) =>
                                                setDriverName(e.target.value)
                                            }
                                            placeholder="Nombre completo"
                                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Placa del vehículo (opcional)
                                        </label>
                                        <input
                                            type="text"
                                            value={vehiclePlate}
                                            onChange={(e) =>
                                                setVehiclePlate(e.target.value)
                                            }
                                            placeholder="Ej. ABC-123"
                                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Observaciones (opcional)
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Escriba sus observaciones..."
                                rows={3}
                                className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                        </div>

                        {error && (
                            <p className="text-xs font-bold text-rose-500">
                                {error}
                            </p>
                        )}

                        {results && (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700">
                                {sentFolio && (
                                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                                        <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                                            Nota {sentFolio} enviada
                                        </span>
                                        {sentNote && (
                                            <button
                                                onClick={handleDownloadPdf}
                                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition-all hover:bg-emerald-700"
                                            >
                                                Descargar PDF
                                            </button>
                                        )}
                                    </div>
                                )}
                                {pdfMessage && (
                                    <p className="px-3 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                        {pdfMessage}
                                    </p>
                                )}
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {results.map((r, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold"
                                        >
                                            <span className="text-slate-700 dark:text-slate-200">
                                                {r.ingredientName}
                                            </span>
                                            <span
                                                className={
                                                    r.success
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : "text-rose-500"
                                                }
                                            >
                                                {r.message}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 p-4 dark:border-slate-800">
                    <button
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                        {results ? "Cerrar" : "Cancelar"}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {submitting ? "Enviando..." : "Enviar"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SendConglomerateTransferModal;
