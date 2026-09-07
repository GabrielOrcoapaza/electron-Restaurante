import React from "react";
import CreateClient from "../modules/user/createClient";
import EditClient from "../modules/user/editClient";

export type ClientSearchPerson = {
    id: string;
    name: string;
    documentType: string;
    documentNumber: string;
};

export type EditClientForModal = {
    id: string;
    name: string;
    documentType: string;
    documentNumber: string;
    email?: string;
    phone?: string;
    address?: string;
};

type ClientSearchBarVariant = "default" | "pos" | "cash";

export type ClientSearchBarProps = {
    searchTerm: string;
    onSearchTermChange: (value: string) => void;
    selectedClient: ClientSearchPerson | null;
    onSelectClient: (client: ClientSearchPerson) => void;
    onClearClient: () => void;
    filteredClients: any[];
    clientsLoading?: boolean;
    sunatSearchLoading?: boolean;
    disabled?: boolean;
    isFactura?: boolean;
    onSearchSunat: () => void;
    onOpenCreateClient: () => void;
    onOpenEditClient: () => void;
    showCreateClientModal: boolean;
    onCloseCreateClientModal: () => void;
    onCreateClientSuccess?: (clientId: string) => void;
    showEditClientModal: boolean;
    editClientForModal: EditClientForModal | null;
    onCloseEditClientModal: () => void;
    onEditClientSuccess: () => void;
    variant?: ClientSearchBarVariant;
    label?: string;
    compactPlaceholder?: boolean;
    onInvalidSunatSearch?: () => void;
    className?: string;
};

const SearchIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        className={className}
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
);

const ClientSearchBar: React.FC<ClientSearchBarProps> = ({
    searchTerm,
    onSearchTermChange,
    selectedClient,
    onSelectClient,
    onClearClient,
    filteredClients,
    clientsLoading = false,
    sunatSearchLoading = false,
    disabled = false,
    isFactura = false,
    onSearchSunat,
    onOpenCreateClient,
    onOpenEditClient,
    showCreateClientModal,
    onCloseCreateClientModal,
    onCreateClientSuccess,
    showEditClientModal,
    editClientForModal,
    onCloseEditClientModal,
    onEditClientSuccess,
    variant = "default",
    label,
    compactPlaceholder = false,
    onInvalidSunatSearch,
    className = "",
}) => {
    const isDisabled = disabled || clientsLoading;

    const handleSearchSunatClick = () => {
        const term = (searchTerm || "").trim().replace(/\s/g, "");
        const canSearch =
            /^\d{11}$/.test(term) || (/^\d{8}$/.test(term) && !isFactura);
        if (canSearch) {
            onSearchSunat();
        } else {
            onInvalidSunatSearch?.();
        }
    };

    const handleInputChange = (value: string) => {
        onSearchTermChange(value);
    };

    const placeholder =
        variant === "cash"
            ? compactPlaceholder
                ? "DNI/RUC..."
                : "Buscar cliente (DNI/RUC)..."
            : isFactura
              ? "Buscar cliente (solo RUC)..."
              : variant === "default"
                ? "Buscar cliente (DNI/RUC)..."
                : "Buscar cliente";

    const showDropdown =
        Boolean(searchTerm) &&
        !selectedClient &&
        filteredClients.length > 0;

    const showEmptyState =
        Boolean(searchTerm) &&
        !selectedClient &&
        !clientsLoading &&
        filteredClients.length === 0;

    const inputShellClass =
        variant === "default"
            ? "flex min-w-0 flex-1 items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900"
            : variant === "pos"
              ? "flex min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white"
              : "flex min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900";

    const inputClass =
        variant === "default"
            ? "w-full bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none dark:text-slate-100 disabled:cursor-not-allowed"
            : variant === "pos"
              ? "w-full bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none disabled:opacity-60"
              : "w-full bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500";

    const sunatButtonClass =
        variant === "default"
            ? `flex shrink-0 items-center justify-center px-4 transition-all ${
                  sunatSearchLoading || isDisabled
                      ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                      : "bg-teal-600 text-white hover:bg-teal-700 active:scale-95"
              }`
            : variant === "pos"
              ? "flex shrink-0 items-center justify-center rounded-lg bg-teal-600 px-3 py-2.5 text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
              : "flex shrink-0 items-center justify-center border-l border-slate-300 bg-sky-50 px-4 text-sky-700 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/45";

    const editButtonClass =
        variant === "default"
            ? "flex shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-base text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/45"
            : variant === "pos"
              ? "flex shrink-0 items-center justify-center rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm disabled:opacity-40"
              : "flex shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/45";

    const createButtonClass =
        variant === "default"
            ? "flex shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-base text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/45"
            : variant === "pos"
              ? "flex shrink-0 items-center justify-center rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm disabled:opacity-40"
              : "flex shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/45";

    const dropdownClass =
        variant === "cash"
            ? "absolute left-0 top-full z-[100] mt-0.5 max-h-[200px] w-[250px] overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900"
            : variant === "pos"
              ? "absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
              : "absolute left-0 right-0 top-full z-10 mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900";

    return (
        <>
            <div className={`relative ${className}`}>
                {label && (
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {label}
                    </label>
                )}

                <div
                    className={
                        variant === "cash"
                            ? "flex gap-1.5"
                            : "flex items-stretch gap-1.5"
                    }
                >
                    {variant === "cash" ? (
                        <div className={`${inputShellClass} h-[50px]`}>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) =>
                                    handleInputChange(e.target.value)
                                }
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleSearchSunatClick();
                                    }
                                }}
                                placeholder={placeholder}
                                disabled={isDisabled}
                                className={inputClass}
                            />
                            <button
                                type="button"
                                onClick={handleSearchSunatClick}
                                disabled={sunatSearchLoading || isDisabled}
                                title="Buscar en SUNAT"
                                className={sunatButtonClass}
                            >
                                {sunatSearchLoading ? "…" : "🔍"}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className={inputShellClass}>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) =>
                                        handleInputChange(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleSearchSunatClick();
                                        }
                                    }}
                                    placeholder={placeholder}
                                    disabled={isDisabled}
                                    className={inputClass}
                                />
                                {variant === "default" && (
                                    <button
                                        type="button"
                                        onClick={handleSearchSunatClick}
                                        disabled={
                                            sunatSearchLoading || isDisabled
                                        }
                                        title="Buscar en SUNAT"
                                        className={sunatButtonClass}
                                    >
                                        {sunatSearchLoading ? (
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        ) : (
                                            <SearchIcon className="h-5 w-5" />
                                        )}
                                    </button>
                                )}
                            </div>
                            {variant === "pos" && (
                                <button
                                    type="button"
                                    onClick={handleSearchSunatClick}
                                    disabled={
                                        sunatSearchLoading || isDisabled
                                    }
                                    title="Buscar en SUNAT"
                                    className={sunatButtonClass}
                                >
                                    {sunatSearchLoading ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    ) : (
                                        <SearchIcon className="h-4 w-4 text-white" />
                                    )}
                                </button>
                            )}
                        </>
                    )}

                    <button
                        type="button"
                        onClick={onOpenEditClient}
                        disabled={!selectedClient?.id || isDisabled}
                        title="Editar cliente"
                        className={editButtonClass}
                    >
                        ✏️
                    </button>
                    <button
                        type="button"
                        onClick={onOpenCreateClient}
                        disabled={isDisabled}
                        title="Nuevo cliente"
                        className={createButtonClass}
                    >
                        ➕
                    </button>
                </div>

                {showDropdown && (
                    <div className={dropdownClass}>
                        {!isFactura && (
                            <button
                                type="button"
                                onClick={onClearClient}
                                className={`w-full border-b border-slate-100 px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50 ${
                                    variant === "cash" ? "cursor-pointer" : ""
                                }`}
                            >
                                Sin cliente (Consumidor final)
                            </button>
                        )}
                        {filteredClients.map((client: any) => (
                            <button
                                key={client.id}
                                type="button"
                                onClick={() =>
                                    onSelectClient({
                                        id: client.id,
                                        name: client.name || "",
                                        documentType:
                                            client.documentType || "",
                                        documentNumber:
                                            client.documentNumber || "",
                                    })
                                }
                                className="w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                            >
                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {client.name}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-500">
                                    {client.documentType}:{" "}
                                    {client.documentNumber}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {showEmptyState && (
                    <div
                        className={
                            variant === "cash"
                                ? "mt-1 rounded-md bg-slate-50 p-2 dark:bg-slate-900/50"
                                : variant === "pos"
                                  ? "mt-1 rounded-lg bg-slate-50 p-2.5"
                                  : "mt-2 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50"
                        }
                    >
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-500">
                            {isFactura
                                ? "No hay clientes con RUC registrados"
                                : "No se encontraron clientes registrados"}
                        </p>
                        {(() => {
                            const term = (searchTerm || "")
                                .trim()
                                .replace(/\s/g, "");
                            const canSearchSunat =
                                (/^\d{8}$/.test(term) && !isFactura) ||
                                /^\d{11}$/.test(term);
                            if (canSearchSunat) {
                                return (
                                    <button
                                        type="button"
                                        onClick={onSearchSunat}
                                        disabled={
                                            sunatSearchLoading || isDisabled
                                        }
                                        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-50 px-2 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100 disabled:opacity-50 dark:bg-teal-900/20 dark:text-teal-400 dark:hover:bg-teal-900/30"
                                    >
                                        {sunatSearchLoading
                                            ? "Buscando..."
                                            : "Buscar en SUNAT"}
                                    </button>
                                );
                            }
                            return (
                                <p className="mt-1 text-[10px] leading-tight text-slate-400">
                                    Ingrese DNI (8 dígitos) o RUC (11 dígitos) y
                                    use la lupa.
                                </p>
                            );
                        })()}
                    </div>
                )}
            </div>

            {showCreateClientModal && (
                <div className="fixed inset-0 z-[1100]">
                    <CreateClient
                        onSuccess={onCreateClientSuccess}
                        onClose={onCloseCreateClientModal}
                    />
                </div>
            )}

            {showEditClientModal && editClientForModal && (
                <div className="fixed inset-0 z-[1100]">
                    <EditClient
                        client={editClientForModal}
                        onSuccess={onEditClientSuccess}
                        onClose={onCloseEditClientModal}
                    />
                </div>
            )}
        </>
    );
};

export default ClientSearchBar;
