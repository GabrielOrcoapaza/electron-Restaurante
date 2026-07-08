import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client";
import {
    GET_DOCUMENTS,
    GET_SERIALS_BY_DOCUMENT,
    GET_PERSONS_BY_BRANCH,
    SEARCH_PERSON_BY_DOCUMENT,
} from "../../graphql/queries";
import { CONVERT_DOCUMENT, CREATE_PERSON } from "../../graphql/mutations";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import CreateClient from "../user/createClient";
import EditClient from "../user/editClient";
import {
    formatLocalDateYYYYMMDD,
    formatLocalTimeHHMMSS,
} from "../../utils/localDateTime";

interface SelectedClient {
    id: string;
    name: string;
    documentType?: string;
    documentNumber?: string;
}

interface SourceDocument {
    id: string;
    serial: string;
    number: string | number;
    document: {
        id: string;
        code: string;
        description: string;
    };
    person?: {
        id: string;
        name: string;
        documentNumber: string;
        documentType: string;
    } | null;
    totalAmount?: number;
    branch?: {
        igvPercentage?: number;
    };
}

interface ConvertDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceDocument: SourceDocument;
    onSuccess: () => void;
}

const ConvertDocumentModal: React.FC<ConvertDocumentModalProps> = ({
    isOpen,
    onClose,
    sourceDocument,
    onSuccess,
}) => {
    const { companyData, user } = useAuth();
    const branchId = companyData?.branch?.id;
    const { showToast } = useToast();

    const [targetDocumentId, setTargetDocumentId] = useState("");
    const [targetSerial, setTargetSerial] = useState("");
    const [selectedClient, setSelectedClient] = useState<SelectedClient | null>(
        null,
    );
    const [clientSearchTerm, setClientSearchTerm] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [showCreateClientModal, setShowCreateClientModal] = useState(false);
    const [showEditClientModal, setShowEditClientModal] = useState(false);

    const { data: documentsData } = useQuery(GET_DOCUMENTS, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const { data: serialsData } = useQuery(GET_SERIALS_BY_DOCUMENT, {
        variables: { documentId: targetDocumentId },
        skip: !targetDocumentId,
        fetchPolicy: "network-only",
    });

    const { data: clientsData, loading: clientsLoading, refetch: refetchClients } =
        useQuery(GET_PERSONS_BY_BRANCH, {
            variables: { branchId: branchId! },
            skip: !branchId,
            fetchPolicy: "network-only",
        });

    const [searchPersonByDocument, { loading: sunatSearchLoading }] =
        useLazyQuery(SEARCH_PERSON_BY_DOCUMENT, {
            fetchPolicy: "network-only",
        });

    const [createPersonMutation] = useMutation(CREATE_PERSON);
    const [convertDocument, { loading: converting }] =
        useMutation(CONVERT_DOCUMENT);

    useEffect(() => {
        if (!isOpen) return;
        setTargetDocumentId("");
        setTargetSerial("");
        if (sourceDocument.person?.id) {
            setSelectedClient({
                id: sourceDocument.person.id,
                name: sourceDocument.person.name || "",
                documentType: sourceDocument.person.documentType,
                documentNumber: sourceDocument.person.documentNumber,
            });
            setClientSearchTerm(sourceDocument.person.name || "");
        } else {
            setSelectedClient(null);
            setClientSearchTerm("");
        }
        setError(null);
        setSuccessMsg(null);
    }, [isOpen, sourceDocument?.id, sourceDocument.person]);

    useEffect(() => {
        if (serialsData?.serialsByDocument?.length > 0) {
            setTargetSerial(serialsData.serialsByDocument[0].serial);
        } else {
            setTargetSerial("");
        }
    }, [serialsData]);

    const targetDocuments = useMemo(() => {
        return (documentsData?.documentsByBranch || []).filter(
            (doc: { id: string; isActive: boolean }) =>
                doc.isActive && doc.id !== sourceDocument.document.id,
        );
    }, [documentsData, sourceDocument.document.id]);

    const selectedTargetDoc = targetDocuments.find(
        (d: { id: string }) => d.id === targetDocumentId,
    );
    const isFactura = selectedTargetDoc?.code === "01";

    const handleSearchSunat = async () => {
        const term = (clientSearchTerm || "").trim().replace(/\s/g, "");
        if (!/^\d+$/.test(term) || !companyData?.branch?.id) return;
        const isRuc = term.length === 11;
        const isDni = term.length === 8;
        if (isFactura && !isRuc) return;
        if (!isRuc && !isDni) return;
        const documentType = isRuc ? "RUC" : "DNI";
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
                showToast(
                    "No se encontr? el documento en SUNAT ni en el sistema.",
                    "error",
                );
                return;
            }
            const person = result.person;
            const applySelectedClient = (client: SelectedClient) => {
                setSelectedClient(client);
                setClientSearchTerm(client.name || "");
            };

            if (person.id && result.foundLocally) {
                applySelectedClient({
                    id: person.id,
                    name: person.name || "",
                    documentType: person.documentType || documentType,
                    documentNumber: person.documentNumber || term,
                });
                const { data: refetched } = await refetchClients();
                const updated = (refetched?.personsByBranch || []).find(
                    (p: { id: string }) => p.id === person.id,
                );
                if (updated?.name) {
                    applySelectedClient({
                        id: person.id,
                        name: updated.name,
                        documentType:
                            updated.documentType ||
                            person.documentType ||
                            documentType,
                        documentNumber:
                            updated.documentNumber ||
                            person.documentNumber ||
                            term,
                    });
                }
                return;
            }
            const { data: createData } = await createPersonMutation({
                variables: {
                    branchId: companyData.branch.id,
                    documentType: person.documentType || documentType,
                    documentNumber: person.documentNumber || term,
                    name:
                        person.name ||
                        (documentType === "RUC" ? "Empresa" : "Cliente"),
                    address: person.address || undefined,
                    phone: person.phone || undefined,
                    email: person.email || undefined,
                    isCustomer: true,
                    isSupplier: false,
                },
            });
            if (
                createData?.createPerson?.success &&
                createData?.createPerson?.person
            ) {
                const newPerson = createData.createPerson.person;
                applySelectedClient({
                    id: newPerson.id,
                    name: newPerson.name || "",
                    documentType: newPerson.documentType || documentType,
                    documentNumber: newPerson.documentNumber || term,
                });
                await refetchClients();
            } else {
                showToast(
                    createData?.createPerson?.message ||
                        "Error al registrar el cliente.",
                    "error",
                );
            }
        } catch (err: unknown) {
            const msg =
                err instanceof Error ? err.message : "Error al buscar en SUNAT.";
            showToast(msg, "error");
        }
    };

    const filteredClients = useMemo(() => {
        const clients = (clientsData?.personsByBranch || []).filter(
            (person: {
                isSupplier?: boolean;
                isActive?: boolean;
            }) => !person.isSupplier && person.isActive !== false,
        );
        if (!clientSearchTerm) return clients.slice(0, 50);
        const lower = clientSearchTerm.toLowerCase();
        return clients
            .filter((c: { documentType?: string; name?: string; documentNumber?: string }) => {
                if (
                    isFactura &&
                    (c.documentType || "").toUpperCase() !== "RUC"
                )
                    return false;
                return (
                    (c.name || "").toLowerCase().includes(lower) ||
                    (c.documentNumber || "").includes(lower)
                );
            })
            .slice(0, 50);
    }, [clientsData, clientSearchTerm, isFactura]);

    const handleConvert = async () => {
        setError(null);
        setSuccessMsg(null);

        if (!targetDocumentId || !targetSerial) {
            setError("Seleccione tipo de documento y serie");
            return;
        }

        if (isFactura) {
            if (!selectedClient?.id) {
                setError("Debe seleccionar un cliente con RUC para Factura");
                return;
            }
            if ((selectedClient.documentType || "").toUpperCase() !== "RUC") {
                setError("El cliente para Factura debe tener RUC");
                return;
            }
        }

        if (!user?.id || !branchId) {
            setError("No se encontr? el usuario o la sucursal activa");
            return;
        }

        try {
            const result = await convertDocument({
                variables: {
                    issuedDocumentId: sourceDocument.id,
                    newDocumentId: targetDocumentId,
                    serial: targetSerial,
                    personId: selectedClient?.id || null,
                    userId: user.id,
                    emissionDate: formatLocalDateYYYYMMDD(),
                    emissionTime: formatLocalTimeHHMMSS(),
                },
            });

            const payload = result.data?.convertDocument;
            if (!payload?.success) {
                throw new Error(
                    payload?.message || "No se pudo convertir el documento.",
                );
            }

            setSuccessMsg(
                payload.message || "Documento convertido correctamente",
            );
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : "Error al convertir documento";
            setError(msg);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-[32px] bg-white shadow-2xl dark:bg-slate-900 max-h-[90vh] flex flex-col">
                <div className="bg-emerald-600 p-8 text-white flex-shrink-0">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 mb-4">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-10 w-10"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                            />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-black">Convertir Documento</h3>
                    <p className="mt-1 text-sm font-bold opacity-80">
                        Se convertir? el comprobante actual al tipo seleccionado
                        en un solo paso. Los pagos se mantienen vinculados.
                    </p>
                    <p className="mt-2 text-xs font-bold opacity-70">
                        Origen: {sourceDocument.document.description}{" "}
                        {sourceDocument.serial}-{sourceDocument.number}
                    </p>
                </div>

                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                    {error && (
                        <div className="mb-6 p-4 rounded-2xl border border-rose-100 bg-rose-50 text-sm font-bold text-rose-600 dark:border-rose-900/20 dark:bg-rose-900/10">
                            {error}
                        </div>
                    )}
                    {successMsg && (
                        <div className="mb-6 p-4 rounded-2xl border border-emerald-100 bg-emerald-50 text-sm font-bold text-emerald-600 dark:border-emerald-900/20 dark:bg-emerald-900/10">
                            {successMsg}
                        </div>
                    )}

                    {targetDocuments.length === 0 ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-950/30">
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                                No hay otro tipo de documento disponible para
                                convertir.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                    <div>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                            Actual
                                        </span>
                                        <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                                            {sourceDocument.document.description}
                                        </p>
                                        <p className="text-xs font-bold text-slate-400">
                                            {sourceDocument.serial}-
                                            {sourceDocument.number}
                                        </p>
                                    </div>
                                    <span className="text-emerald-500 font-black">
                                        ?
                                    </span>
                                    <div className="text-right">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">
                                            Nuevo
                                        </span>
                                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                            {selectedTargetDoc?.description ||
                                                "Sin seleccionar"}
                                        </p>
                                        {targetSerial && (
                                            <p className="text-xs font-bold text-emerald-500/70">
                                                {targetSerial}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 mb-6">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Tipo destino
                                </label>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {targetDocuments.map(
                                        (doc: {
                                            id: string;
                                            description: string;
                                            code: string;
                                        }) => {
                                            const selected =
                                                targetDocumentId === doc.id;
                                            return (
                                                <button
                                                    key={doc.id}
                                                    type="button"
                                                    onClick={() =>
                                                        setTargetDocumentId(
                                                            doc.id,
                                                        )
                                                    }
                                                    className={`rounded-2xl border p-4 text-left transition-all ${
                                                        selected
                                                            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                                                            : "border-slate-100 bg-white hover:border-emerald-200 dark:border-slate-800 dark:bg-slate-900"
                                                    }`}
                                                >
                                                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                                                        {doc.description}
                                                    </span>
                                                    <span className="mt-1 block text-[10px] font-bold text-slate-400">
                                                        C?digo {doc.code}
                                                    </span>
                                                </button>
                                            );
                                        },
                                    )}
                                </div>
                            </div>

                            {targetDocumentId && (
                                <div className="flex flex-col gap-2 mb-6">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Serie
                                    </label>
                                    <select
                                        value={targetSerial}
                                        onChange={(e) =>
                                            setTargetSerial(e.target.value)
                                        }
                                        className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-sm font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200"
                                    >
                                        {(serialsData?.serialsByDocument || []).map(
                                            (s: { id: string; serial: string }) => (
                                                <option
                                                    key={s.id}
                                                    value={s.serial}
                                                >
                                                    {s.serial}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </div>
                            )}

                            {(isFactura || selectedTargetDoc?.code === "03") && (
                                <div className="flex flex-col gap-3 mb-6">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Cliente{" "}
                                            {isFactura && "(Requerido RUC)"}
                                        </label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowCreateClientModal(true)
                                                }
                                                className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all dark:bg-emerald-900/20"
                                            >
                                                + Nuevo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowEditClientModal(true)
                                                }
                                                disabled={!selectedClient?.id}
                                                className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all dark:bg-indigo-900/20 disabled:opacity-30"
                                            >
                                                Editar
                                            </button>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <div className="flex overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                                            <input
                                                type="text"
                                                placeholder={
                                                    isFactura
                                                        ? "Buscar por RUC o Raz?n Social..."
                                                        : "Buscar por DNI, RUC o Nombre..."
                                                }
                                                value={clientSearchTerm}
                                                onChange={(e) => {
                                                    setClientSearchTerm(
                                                        e.target.value,
                                                    );
                                                    setSelectedClient(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        handleSearchSunat();
                                                    }
                                                }}
                                                className="flex-1 bg-transparent py-3.5 px-4 text-sm font-bold text-slate-700 outline-none dark:text-slate-200"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleSearchSunat}
                                                disabled={
                                                    clientsLoading ||
                                                    sunatSearchLoading
                                                }
                                                className="flex items-center justify-center px-4 bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
                                            >
                                                {sunatSearchLoading ? (
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                ) : (
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-5 w-5"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                                        />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>

                                        {clientSearchTerm &&
                                            !selectedClient?.id &&
                                            filteredClients.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 z-50 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 custom-scrollbar">
                                                    {!isFactura && (
                                                        <div
                                                            onClick={() => {
                                                                setSelectedClient(
                                                                    null,
                                                                );
                                                                setClientSearchTerm(
                                                                    "",
                                                                );
                                                            }}
                                                            className="flex cursor-pointer items-center rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border-b border-slate-50 dark:border-slate-800 mb-1"
                                                        >
                                                            <span className="text-sm font-bold text-slate-500">
                                                                Consumidor final
                                                            </span>
                                                        </div>
                                                    )}
                                                    {filteredClients.map(
                                                        (client: {
                                                            id: string;
                                                            name: string;
                                                            documentType: string;
                                                            documentNumber: string;
                                                        }) => (
                                                            <div
                                                                key={client.id}
                                                                onClick={() => {
                                                                    setSelectedClient(
                                                                        {
                                                                            id: client.id,
                                                                            name: client.name,
                                                                            documentType:
                                                                                client.documentType,
                                                                            documentNumber:
                                                                                client.documentNumber,
                                                                        },
                                                                    );
                                                                    setClientSearchTerm(
                                                                        client.name,
                                                                    );
                                                                }}
                                                                className="flex cursor-pointer items-center rounded-xl p-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all"
                                                            >
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                                        {
                                                                            client.name
                                                                        }
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-slate-400">
                                                                        {
                                                                            client.documentNumber
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                    </div>

                                    {selectedClient?.id && (
                                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                            Cliente seleccionado:{" "}
                                            {selectedClient.name}
                                            {selectedClient.documentNumber
                                                ? ` (${selectedClient.documentNumber})`
                                                : ""}
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    <div className="mt-4 flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={converting}
                            className="flex-1 h-14 rounded-2xl bg-white border border-slate-100 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                        >
                            Regresar
                        </button>
                        <button
                            onClick={handleConvert}
                            disabled={
                                converting ||
                                targetDocuments.length === 0 ||
                                !targetDocumentId ||
                                !targetSerial
                            }
                            className="flex-[2] h-14 rounded-2xl bg-emerald-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 disabled:opacity-50 dark:shadow-none"
                        >
                            {converting ? "Procesando..." : "Confirmar Conversi?n"}
                        </button>
                    </div>
                </div>
            </div>

            {showCreateClientModal && (
                <CreateClient
                    onSuccess={async (clientId) => {
                        setShowCreateClientModal(false);
                        const result = await refetchClients();
                        const persons = result.data?.personsByBranch || [];
                        const newClient = persons.find(
                            (p: {
                                id: string;
                                name?: string;
                                documentType?: string;
                                documentNumber?: string;
                            }) => p.id === clientId,
                        );
                        if (newClient) {
                            setSelectedClient({
                                id: newClient.id,
                                name: newClient.name || "",
                                documentType: newClient.documentType,
                                documentNumber: newClient.documentNumber,
                            });
                            if (newClient.name)
                                setClientSearchTerm(newClient.name);
                        }
                    }}
                    onClose={() => setShowCreateClientModal(false)}
                />
            )}

            {showEditClientModal &&
                selectedClient?.id &&
                (() => {
                    const selectedClientRow = (
                        clientsData?.personsByBranch || []
                    ).find(
                        (c: { id: string }) => c.id === selectedClient.id,
                    );
                    return selectedClientRow ? (
                        <EditClient
                            client={selectedClientRow}
                            onSuccess={async () => {
                                const result = await refetchClients();
                                const updated = (
                                    result.data?.personsByBranch || []
                                ).find(
                                    (c: {
                                        id: string;
                                        name?: string;
                                        documentType?: string;
                                        documentNumber?: string;
                                    }) => c.id === selectedClient.id,
                                );
                                if (updated) {
                                    setSelectedClient({
                                        id: updated.id,
                                        name: updated.name || "",
                                        documentType: updated.documentType,
                                        documentNumber: updated.documentNumber,
                                    });
                                    if (updated.name)
                                        setClientSearchTerm(updated.name);
                                }
                                setShowEditClientModal(false);
                            }}
                            onClose={() => setShowEditClientModal(false)}
                        />
                    ) : null;
                })()}
        </div>
    );
};

export default ConvertDocumentModal;
