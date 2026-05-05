import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { SEND_BROADCAST_MESSAGE } from "../../graphql/mutations";

type MessageProps = {
    onBack?: () => void;
    onSuccess?: () => void;
};

// Opciones de destinatarios según el modelo
const RECIPIENT_OPTIONS = [
    { value: "ALL", label: "Todos" },
    { value: "WAITERS", label: "Mozos" },
    { value: "COOKS", label: "Cocineros" },
    { value: "CASHIERS", label: "Cajeros" },
    { value: "ADMINS", label: "Administradores" },
];

const Message: React.FC<MessageProps> = ({ onBack, onSuccess }) => {
    const { companyData, user } = useAuth();

    const [messageText, setMessageText] = useState<string>("");
    const [selectedRecipient, setSelectedRecipient] = useState<string>("ALL");
    const [isSending, setIsSending] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [sendBroadcastMessageMutation] = useMutation(SEND_BROADCAST_MESSAGE);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!messageText.trim()) {
            setError("Por favor, escribe un mensaje");
            return;
        }

        if (!companyData?.branch.id || !user?.id) {
            setError(
                "No se pudo obtener la información de la sucursal o usuario",
            );
            return;
        }

        setIsSending(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const result = await sendBroadcastMessageMutation({
                variables: {
                    branchId: companyData.branch.id,
                    senderId: user.id,
                    message: messageText.trim(),
                    recipients: selectedRecipient,
                },
            });

            if (result.data?.sendBroadcastMessage?.success) {
                setSuccessMessage(
                    result.data.sendBroadcastMessage.message ||
                        "Mensaje enviado exitosamente",
                );
                setMessageText("");
                setSelectedRecipient("ALL");

                if (onSuccess) {
                    setTimeout(() => {
                        onSuccess();
                    }, 1500);
                }
            } else {
                setError(
                    result.data?.sendBroadcastMessage?.message ||
                        "Error al enviar el mensaje",
                );
            }
        } catch (err: any) {
            console.error("Error enviando mensaje broadcast:", err);
            setError(
                err.message ||
                    "Error al enviar el mensaje. Por favor, intenta nuevamente.",
            );
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex h-full flex-col gap-6 p-1 transition-colors duration-200 md:p-0">
            {/* Header */}
            <div className="flex items-center justify-between px-2 md:px-0">
                <div className="flex flex-col gap-1">
                    <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 md:text-2xl">
                        Comunicación Interna
                    </h1>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 md:text-sm">
                        Envía avisos rápidos a cocina, mozos u otros
                        departamentos.
                    </p>
                </div>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/50"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                            />
                        </svg>
                        Volver
                    </button>
                )}
            </div>

            {/* Main Content Card */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 p-6 dark:border-slate-800/50">
                    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                            />
                        </svg>
                        Nuevo Mensaje Broadcast
                    </h3>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 animate-in fade-in slide-in-from-top-2 duration-300 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">
                            <div className="h-2 w-2 rounded-full bg-rose-500" />
                            {error}
                        </div>
                    )}

                    {successMessage && (
                        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 animate-in fade-in slide-in-from-top-2 duration-300 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            {successMessage}
                        </div>
                    )}

                    <form
                        onSubmit={handleSendMessage}
                        className="flex flex-col gap-6"
                    >
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            <div className="flex flex-col gap-2 md:col-span-1">
                                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                    Destinatarios
                                </label>
                                <select
                                    value={selectedRecipient}
                                    onChange={(e) =>
                                        setSelectedRecipient(e.target.value)
                                    }
                                    disabled={isSending}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
                                >
                                    {RECIPIENT_OPTIONS.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-2 md:col-span-3">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                        Contenido del Mensaje
                                    </label>
                                    <span
                                        className={`text-[10px] font-bold ${messageText.length > 450 ? "text-rose-500" : "text-slate-400"}`}
                                    >
                                        {messageText.length} / 500
                                    </span>
                                </div>
                                <textarea
                                    value={messageText}
                                    onChange={(e) =>
                                        setMessageText(e.target.value)
                                    }
                                    disabled={isSending}
                                    placeholder="Escribe aquí las instrucciones o avisos para el personal..."
                                    rows={6}
                                    maxLength={500}
                                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={isSending || !messageText.trim()}
                                className="flex min-w-[200px] items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-8 py-3.5 font-bold text-white transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                            >
                                {isSending ? (
                                    <>
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        <span>Enviando Aviso...</span>
                                    </>
                                ) : (
                                    <>
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
                                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                            />
                                        </svg>
                                        <span>Enviar Broadcast</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Decorative Tips */}
            <div className="grid grid-cols-1 gap-4 px-2 md:grid-cols-2 md:px-0">
                <div className="flex items-start gap-3 rounded-2xl bg-indigo-50/50 p-4 dark:bg-indigo-900/10">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
                            Consejo de uso
                        </p>
                        <p className="text-[11px] text-indigo-700 dark:text-indigo-400/80">
                            Los mensajes enviados aparecerán como notificaciones
                            push en los dispositivos del personal seleccionado.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Message;
