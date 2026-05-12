import React from "react";
import type { Table } from "../types/table";

export type RestrictedModalPayload = {
    table: Table;
    kind: "session_lock" | "order_occupied";
};

const FOOTER_EXACT_REFERENCE =
    "Solo el usuario que creó la orden puede acceder a esta mesa.";

/** Textos iguales a la maqueta móvil: candado sesión vs orden de otro mozo comparten bastidor visual. */
export function getRestrictedModalCopy(payload: RestrictedModalPayload): {
    mainMessage: string;
    ocupadoLine: string;
    footerNote: string;
} {
    const { table, kind } = payload;
    const holderName =
        kind === "session_lock"
            ? (table.sessionLockedByName || "").trim() || "Otro usuario"
            : (table.userName || "").trim() || "Otro usuario";
    const mainMessage = `La mesa "${table.name}" está ocupada por otro usuario.`;
    const ocupadoLine = `Mesa en uso por ${holderName}`;
    return {
        mainMessage,
        ocupadoLine,
        footerNote: FOOTER_EXACT_REFERENCE,
    };
}

export function RestrictedTableAccessModal(props: {
    payload: RestrictedModalPayload;
    onClose: () => void;
}): React.ReactElement {
    const copy = getRestrictedModalCopy(props.payload);
    return (
        <div
            className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restricted-access-title"
        >
            <div className="w-full max-w-sm rounded-2xl border border-slate-700/80 bg-slate-900 px-5 pb-5 pt-6 shadow-2xl">
                <div className="mb-4 flex justify-center">
                    <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-red-600 shadow-[0_0_28px_rgba(220,38,38,0.55)] ring-2 ring-red-500/30">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-9 w-9 text-white"
                            aria-hidden
                        >
                            <path
                                fillRule="evenodd"
                                d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3A5.25 5.25 0 0 0 12 1.5ZM8.25 9.75v-3a3.75 3.75 0 1 1 7.5 0v3h-7.5Z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </div>
                </div>

                <h2
                    id="restricted-access-title"
                    className="mb-3 text-center text-xl font-bold tracking-tight text-white"
                >
                    Acceso Restringido
                </h2>

                <p className="mb-4 text-center text-[15px] leading-snug text-slate-100">
                    {copy.mainMessage}
                </p>

                <div className="mb-4 rounded-xl border border-red-900/50 bg-red-950/35 px-3 py-3">
                    <p className="mb-1.5 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                        Ocupada por:
                    </p>
                    <div className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 text-red-400" aria-hidden>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="h-5 w-5"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </span>
                        <p className="min-w-0 flex-1 text-left text-sm font-semibold leading-snug text-red-300">
                            {copy.ocupadoLine}
                        </p>
                    </div>
                </div>

                <p className="mb-5 text-center text-xs leading-relaxed text-slate-400">
                    {copy.footerNote}
                </p>

                <button
                    type="button"
                    onClick={props.onClose}
                    className="w-full rounded-xl bg-gradient-to-b from-red-500 to-red-600 px-4 py-3.5 text-center text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-red-900/40 transition hover:from-red-600 hover:to-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                >
                    Entendido
                </button>
            </div>
        </div>
    );
}
