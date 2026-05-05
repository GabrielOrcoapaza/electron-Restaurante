import React, { useState, useEffect } from "react";
import { useMutation } from "@apollo/client";
import { CREATE_MANUAL_TRANSACTION } from "../../graphql/mutations";

interface ManualTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    cashRegisters: any[];
    userId: string;
    branchId: string;
    /** Si es false, el método de pago queda fijo en efectivo (permiso cash.change_payment_method). Por defecto true. */
    allowChangePaymentMethod?: boolean;
}

const ManualTransactionModal: React.FC<ManualTransactionModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    cashRegisters,
    userId,
    branchId,
    allowChangePaymentMethod = true,
}) => {
    const [cashRegisterId, setCashRegisterId] = useState("");
    const [transactionType, setTransactionType] = useState("INCOME");
    const [amount, setAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("CASH");
    const [referenceNumber, setReferenceNumber] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");

    const [createManualTransaction, { loading }] = useMutation(
        CREATE_MANUAL_TRANSACTION,
    );

    useEffect(() => {
        if (isOpen && cashRegisters.length > 0 && !cashRegisterId) {
            setCashRegisterId(cashRegisters[0].id);
        }
    }, [isOpen, cashRegisters, cashRegisterId]);

    useEffect(() => {
        if (!allowChangePaymentMethod) {
            setPaymentMethod("CASH");
        }
    }, [allowChangePaymentMethod, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!cashRegisterId) {
            setError("Seleccione una caja");
            return;
        }

        if (!amount || Number(amount) <= 0) {
            setError("El monto debe ser mayor a 0");
            return;
        }

        try {
            const now = new Date().toISOString();
            const paymentInput = {
                cashRegisterId,
                paymentType: paymentMethod,
                transactionType,
                paidAmount: Number(amount),
                paymentDate: now,
                paymentMethod,
                totalAmount: Number(amount),
                referenceNumber: referenceNumber || null,
            };

            const result = await createManualTransaction({
                variables: {
                    cashRegisterId,
                    transactionType,
                    payments: [paymentInput],
                    notes: notes || null,
                    userId,
                    branchId,
                },
            });

            if (result.data?.createManualTransaction?.success) {
                setAmount("");
                setReferenceNumber("");
                setNotes("");
                onSuccess();
                onClose();
            } else {
                setError(
                    result.data?.createManualTransaction?.message ||
                        "Error al crear la transacción",
                );
            }
        } catch (err: any) {
            console.error("Error creating manual transaction:", err);
            setError(err.message || "Error al crear la transacción");
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800/50">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                            Registrar Movimiento
                        </h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Ingresos o egresos manuales de caja
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
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
                                strokeWidth={2.5}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="flex flex-col gap-6">
                        {error && (
                            <div className="flex items-start gap-3 rounded-2xl bg-rose-50 p-4 text-rose-600 dark:bg-rose-900/10 dark:text-rose-400">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 shrink-0"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                <p className="text-sm font-bold">{error}</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Seleccionar Caja
                            </label>
                            <select
                                value={cashRegisterId}
                                onChange={(e) =>
                                    setCashRegisterId(e.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                required
                            >
                                <option value="">Seleccionar caja</option>
                                {cashRegisters.map((cash) => (
                                    <option key={cash.id} value={cash.id}>
                                        {cash.name} (
                                        {cash.cashType === "MAIN"
                                            ? "Principal"
                                            : cash.cashType === "CASH" || cash.cashType === "SECONDARY"
                                                ? "Secundaria"
                                                : cash.cashType}
                                        )
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-3">
                            <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Tipo de Movimiento
                            </label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setTransactionType("INCOME")}
                                    className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 py-4 transition-all ${
                                        transactionType === "INCOME"
                                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                            : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200 dark:border-slate-800 dark:bg-slate-800/50"
                                    }`}
                                >
                                    <div
                                        className={`flex h-8 w-8 items-center justify-center rounded-full ${transactionType === "INCOME" ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-700"}`}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-5 w-5"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-black uppercase tracking-wider">
                                        Ingreso
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setTransactionType("EXPENSE")
                                    }
                                    className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 py-4 transition-all ${
                                        transactionType === "EXPENSE"
                                            ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400"
                                            : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200 dark:border-slate-800 dark:bg-slate-800/50"
                                    }`}
                                >
                                    <div
                                        className={`flex h-8 w-8 items-center justify-center rounded-full ${transactionType === "EXPENSE" ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-700"}`}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-5 w-5"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-black uppercase tracking-wider">
                                        Egreso
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div className="flex flex-col gap-3">
                                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                    Monto (S/)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg font-black text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-3">
                                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                    Método de Pago
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) =>
                                        setPaymentMethod(e.target.value)
                                    }
                                    disabled={!allowChangePaymentMethod}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    <option value="CASH">💵 Efectivo</option>
                                    <option value="YAPE">📲 Yape</option>
                                    <option value="PLIN">📲 Plin</option>
                                    <option value="CARD">💳 Tarjeta</option>
                                    <option value="TRANSFER">
                                        🏦 Transferencia
                                    </option>
                                    <option value="OTROS">➕ Otros</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Referencia / Operación (Opcional)
                            </label>
                            <input
                                type="text"
                                value={referenceNumber}
                                onChange={(e) =>
                                    setReferenceNumber(e.target.value)
                                }
                                placeholder="Ej: N° Operación, cheque, etc."
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                        </div>

                        <div className="flex flex-col gap-3">
                            <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Notas Adicionales
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="¿Por qué se realiza este movimiento?"
                                rows={3}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3 border-t border-slate-100 pt-6 dark:border-slate-800/50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex-1 rounded-2xl py-3 text-sm font-black text-white shadow-lg transition-all active:scale-95 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 ${
                                transactionType === "INCOME"
                                    ? "bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700"
                                    : "bg-rose-600 shadow-rose-500/20 hover:bg-rose-700"
                            }`}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    <span>Guardando...</span>
                                </div>
                            ) : (
                                "Confirmar Movimiento"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManualTransactionModal;
