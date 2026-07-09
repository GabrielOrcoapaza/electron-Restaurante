import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import {
    GET_CASH_REGISTERS,
    GET_CASH_CLOSURE_PREVIEW,
    GET_CASH_CLOSURES,
    GET_PAYMENTS_PENDING_CLOSURE,
} from "../../graphql/queries";
import {
    CLOSE_CASH,
    REPRINT_CLOSURE,
    PRINT_PAYMENT,
    CANCEL_PAYMENT,
    UPDATE_PAYMENT_METHOD,
} from "../../graphql/mutations";
import ManualTransactionModal from "./manualTransactionModal";
import CashDetailModal from "./cashDetailModal";
import ConfirmModal from "../../components/ConfirmModal";
import { useToast } from "../../context/ToastContext";
import { isElectronRenderer } from "../../utils/electronPrint";
import { invokeLocalIssuedDocumentPrint } from "../../utils/localDocumentPrint";
import { getLocalTicketPrinterStorage } from "../../utils/localPrinterPreference";

const isElectron = isElectronRenderer();

const LOG_CASH_PRINT = "[Cierre de caja - impresión]";

function logCashPrint(msg: string, extra?: unknown) {
    if (extra !== undefined) {
        console.log(`${LOG_CASH_PRINT} ${msg}`, extra);
    } else {
        console.log(`${LOG_CASH_PRINT} ${msg}`);
    }
}

interface CashRegister {
    id: string;
    name: string;
    cashType: string;
    currentBalance: number;
    isActive: boolean;
    status?: string;
}

interface CashPreview {
    totalIncome: number;
    totalExpense: number;
    netTotal: number;
    generalPaymentMethods: {
        methodCode: string;
        methodName: string;
        income: number;
        expense: number;
        net: number;
    }[];
    canClose: boolean;
}

interface CashClosure {
    id: string;
    closureNumber: number;
    closedAt: string;
    openedAt?: string;
    totalIncome: number;
    totalExpense: number;
    netTotal: number;
    user: { id: string; fullName: string; role: string };
    cashRegister: { id: string; name: string; cashType: string };
    branch: { id: string; name: string };
}
interface PaymentMovement {
    id: string;
    paymentDate: string;
    paidAmount: number;
    totalAmount?: number;
    transactionType: string;
    paymentMethod: string;
    status: string;
    notes?: string;
    user?: { id: string; fullName: string };
    operation?: { id: string; order?: string };
    issuedDocument?: { id: string; serial?: string; number?: string };
}

type PendingConfirmAction =
    | { type: "close_register"; registerId: string; registerName: string }
    | { type: "cancel_payment"; paymentId: string };

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
});


const formatLocalDateYYYYMMDD = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-PE", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Efectivo",
    YAPE: "Yape",
    PLIN: "Plin",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
};

const isPaymentCancelled = (status?: string | null): boolean => {
    const normalized = (status ?? "").trim().toUpperCase();
    return (
        normalized === "CANCELLED" ||
        normalized === "CANCELED" ||
        normalized === "ANULLED" ||
        normalized === "VOID" ||
        normalized === "INACTIVE"
    );
};

const isSaleMovement = (movement: PaymentMovement): boolean =>
    Boolean(movement.operation?.id || movement.issuedDocument?.id);

const toPaymentAmount = (value: unknown): number => {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
};

const Cashs: React.FC = () => {
    const { companyData, user, getMacAddress } = useAuth();
    const { showToast } = useToast();
    const branchId = companyData?.branch?.id || "";
    const userId = user?.id || "";

    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [selectedRegister, setSelectedRegister] =
        useState<CashRegister | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedClosureDetail, setSelectedClosureDetail] =
        useState<CashClosure | null>(null);
    const [reprintingClosureId, setReprintingClosureId] = useState<
        string | null
    >(null);
    const [showMovements, setShowMovements] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [pendingConfirm, setPendingConfirm] =
        useState<PendingConfirmAction | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [locallyCancelledMovements, setLocallyCancelledMovements] = useState<
        PaymentMovement[]
    >([]);

    // Queries
    const {
        data: registersData,
        loading: loadingRegisters,
        refetch: refetchRegisters,
    } = useQuery(GET_CASH_REGISTERS, {
        variables: { branchId },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const {
        data: previewData,
        loading: loadingPreview,
        refetch: refetchPreview,
    } = useQuery(GET_CASH_CLOSURE_PREVIEW, {
        variables: { branchId, cashRegisterId: selectedRegister?.id || "" },
        skip: !branchId || !selectedRegister,
        fetchPolicy: "network-only",
    });

    const {
        data: historyData,
        loading: loadingHistory,
        refetch: refetchHistory,
    } = useQuery(GET_CASH_CLOSURES, {
        variables: { branchId, limit: 10 },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    // Pagos pendientes: al abrir preview (total ventas sin manual) y para la tabla de movimientos
    const {
        data: movementsData,
        loading: loadingMovements,
        refetch: refetchMovements,
    } = useQuery(GET_PAYMENTS_PENDING_CLOSURE, {
        variables: {
            cashRegisterId: selectedRegister?.id,
            transactionType: null,
            paymentMethod: null,
        },
        skip: !selectedRegister,
        fetchPolicy: "network-only",
    });
    // Mutations
    const [closeCashRegister] = useMutation(CLOSE_CASH);
    const [reprintClosureMutation] = useMutation(REPRINT_CLOSURE);
    const [printPaymentMutation] = useMutation(PRINT_PAYMENT);
    const [cancelPaymentMutation] = useMutation(CANCEL_PAYMENT);
    const [updatePaymentMethodMutation] = useMutation(UPDATE_PAYMENT_METHOD);

    useEffect(() => {
        setLocallyCancelledMovements([]);
    }, [selectedRegister?.id]);

    const apiMovements: PaymentMovement[] =
        movementsData?.paymentsPendingClosure ||
        movementsData?.payments_pending_closure ||
        [];

    const movements = useMemo(() => {
        const apiIds = new Set(apiMovements.map((m) => m.id));
        const preservedCancelled = locallyCancelledMovements.filter(
            (m) => !apiIds.has(m.id),
        );
        return [...apiMovements, ...preservedCancelled];
    }, [apiMovements, locallyCancelledMovements]);

    const movementTotals = useMemo(() => {
        let salesIncome = 0;
        let manualIncome = 0;
        let totalExpense = 0;

        for (const movement of movements) {
            if (isPaymentCancelled(movement.status)) continue;

            const amount = toPaymentAmount(movement.paidAmount);
            if (movement.transactionType === "INCOME") {
                if (isSaleMovement(movement)) {
                    salesIncome += amount;
                } else {
                    manualIncome += amount;
                }
            } else if (movement.transactionType === "EXPENSE") {
                totalExpense += amount;
            }
        }

        return {
            salesIncome,
            manualIncome,
            totalExpense,
            netTotal: salesIncome + manualIncome - totalExpense,
        };
    }, [movements]);

    const cashRegisters: CashRegister[] =
        registersData?.cashRegistersByBranch || [];
    const preview: CashPreview | null = previewData?.cashClosurePreview || null;
    const history: CashClosure[] =
        historyData?.cashClosures || historyData?.cash_closures || [];

    const handleCloseRegister = async (registerId: string) => {
        try {
            setConfirmLoading(true);
            const deviceId = await getMacAddress();
            const localPrinterName =
                getLocalTicketPrinterStorage().trim() || null;

            logCashPrint("inicio cierre de caja", {
                registerId,
                deviceId,
                localPrinterName,
                isElectron,
            });

            const result = await closeCashRegister({
                variables: {
                    cashRegisterId: registerId,
                    userId,
                    branchId,
                    deviceId,
                },
            });

            logCashPrint("respuesta closeCash (raw)", result.data?.closeCash);

            if (result.data?.closeCash?.success) {
                const closeResult = result.data
                    .closeCash as typeof result.data.closeCash & {
                    print_locally?: boolean;
                    document_data?: string | null;
                };
                const printLocallyFlag =
                    closeResult?.printLocally === true ||
                    closeResult?.print_locally === true;
                const docData =
                    closeResult?.documentData ??
                    closeResult?.document_data ??
                    null;

                logCashPrint("datos impresión del servidor", {
                    printLocally: printLocallyFlag,
                    documentDataChars:
                        docData != null && String(docData).trim() !== ""
                            ? String(docData).length
                            : 0,
                    ruta: printLocallyFlag
                        ? "LOCAL (USB/integrada → invokeLocalIssuedDocumentPrint)"
                        : "SERVIDOR/RED (backend imprime; cliente no envía document_data)",
                });

                const localPrintOk = await invokeLocalIssuedDocumentPrint(
                    {
                        printLocally:
                            closeResult?.printLocally ??
                            closeResult?.print_locally,
                        documentData: docData,
                    },
                    {
                        label: "cierre de caja",
                        deviceId,
                        localPrinterName,
                    },
                );

                logCashPrint("resultado impresión local", {
                    printLocallyFlag,
                    localPrintOk,
                });

                if (printLocallyFlag && !localPrintOk) {
                    showToast(
                        "La caja se cerró, pero no se pudo imprimir en la impresora local. Revise la impresora en Configuración → Impresoras locales.",
                        "warning",
                    );
                } else {
                    showToast("Caja cerrada correctamente", "success");
                }
                refetchRegisters();
                refetchHistory();
                setSelectedRegister(null);
                setPendingConfirm(null);
            } else {
                logCashPrint("cierre fallido", {
                    message: result.data?.closeCash?.message,
                });
                showToast(
                    result.data?.closeCash?.message ||
                        "Error al cerrar la caja",
                    "error",
                );
            }
        } catch (error: any) {
            logCashPrint("error en cierre de caja", error);
            showToast(error.message || "Error al cerrar la caja", "error");
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleReprint = async (closure: CashClosure) => {
        setReprintingClosureId(closure.id);
        try {
            const deviceId = await getMacAddress();
            const localPrinterName =
                getLocalTicketPrinterStorage().trim() || null;

            logCashPrint("inicio reimpresión cierre", {
                closureId: closure.id,
                closureNumber: closure.closureNumber,
                deviceId,
                localPrinterName,
                isElectron,
            });

            const result = await reprintClosureMutation({
                variables: {
                    closureId: closure.id,
                    deviceId,
                },
            });

            logCashPrint("respuesta reprintClosure (raw)", result.data?.reprintClosure);

            if (result.data?.reprintClosure?.success) {
                const reprintResult = result.data
                    .reprintClosure as typeof result.data.reprintClosure & {
                    print_locally?: boolean;
                    document_data?: string | null;
                };
                const printLocallyFlag =
                    reprintResult?.printLocally === true ||
                    reprintResult?.print_locally === true;
                const docData =
                    reprintResult?.documentData ??
                    reprintResult?.document_data ??
                    null;

                logCashPrint("datos impresión del servidor", {
                    printLocally: printLocallyFlag,
                    documentDataChars:
                        docData != null && String(docData).trim() !== ""
                            ? String(docData).length
                            : 0,
                    ruta: printLocallyFlag
                        ? "LOCAL (USB/integrada → invokeLocalIssuedDocumentPrint)"
                        : "SERVIDOR/RED (backend imprime; cliente no envía document_data)",
                });

                const localPrintOk = await invokeLocalIssuedDocumentPrint(
                    {
                        printLocally:
                            reprintResult?.printLocally ??
                            reprintResult?.print_locally,
                        documentData: docData,
                    },
                    {
                        label: "reimpresión cierre de caja",
                        deviceId,
                        localPrinterName,
                    },
                );

                logCashPrint("resultado impresión local", {
                    printLocallyFlag,
                    localPrintOk,
                });

                if (printLocallyFlag && !localPrintOk) {
                    showToast(
                        "No se pudo imprimir el ticket en la impresora local. Revise la impresora en Configuración → Impresoras locales.",
                        "error",
                    );
                } else {
                    showToast("Ticket enviado a impresión", "success");
                }
            } else {
                logCashPrint("reimpresión fallida", {
                    message: result.data?.reprintClosure?.message,
                });
                showToast(
                    result.data?.reprintClosure?.message ||
                        "Error al imprimir el ticket",
                    "error",
                );
            }
        } catch (error: any) {
            logCashPrint("error en reimpresión cierre", error);
            showToast(error.message || "Error al imprimir el ticket", "error");
        } finally {
            setReprintingClosureId(null);
        }
    };

    const handlePrintPayment = async (paymentId: string) => {
        try {
            const result = await printPaymentMutation({
                variables: { paymentId, deviceId: await getMacAddress() },
            });
            if (result.data?.printPayment?.success) {
                showToast("Comprobante enviado a impresión", "success");
            } else {
                showToast(
                    result.data?.printPayment?.message || "Error al imprimir",
                    "error",
                );
            }
        } catch (error: any) {
            showToast(error.message || "Error al imprimir", "error");
        }
    };

    const handleCancelPayment = async (paymentId: string) => {
        const movementToCancel = movements.find((m) => m.id === paymentId);
        try {
            setConfirmLoading(true);
            const result = await cancelPaymentMutation({
                variables: { paymentId },
            });
            if (result.data?.cancelPayment?.success) {
                if (movementToCancel) {
                    setLocallyCancelledMovements((prev) => {
                        if (prev.some((m) => m.id === paymentId)) return prev;
                        return [
                            ...prev,
                            { ...movementToCancel, status: "CANCELLED" },
                        ];
                    });
                }
                showToast("Movimiento anulado correctamente", "success");
                refetchMovements();
                refetchPreview();
                setPendingConfirm(null);
            } else {
                showToast(
                    result.data?.cancelPayment?.message || "Error al anular",
                    "error",
                );
            }
        } catch (error: any) {
            showToast(error.message || "Error al anular", "error");
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleConfirmAction = async () => {
        if (!pendingConfirm) return;
        if (pendingConfirm.type === "close_register") {
            await handleCloseRegister(pendingConfirm.registerId);
        } else {
            await handleCancelPayment(pendingConfirm.paymentId);
        }
    };

    const confirmModalConfig =
        pendingConfirm?.type === "close_register"
            ? {
                  title: "Cerrar caja",
                  message: `¿Está seguro de que desea cerrar la caja "${pendingConfirm.registerName}"? Esta acción generará el cierre del turno actual.`,
                  confirmLabel: "Cerrar caja",
                  variant: "danger" as const,
              }
            : pendingConfirm?.type === "cancel_payment"
              ? {
                    title: "Anular movimiento",
                    message:
                        "¿Está seguro de que desea anular este movimiento? Esta acción no se puede deshacer.",
                    confirmLabel: "Anular movimiento",
                    variant: "danger" as const,
                }
              : null;

    const handleUpdatePaymentMethod = async (
        paymentId: string,
        method: string,
    ) => {
        const movement = movements.find((m) => m.id === paymentId);
        if (movement && isPaymentCancelled(movement.status)) return;

        try {
            const result = await updatePaymentMethodMutation({
                variables: { paymentId, newPaymentMethod: method },
            });
            if (result.data?.updatePaymentMethod?.success) {
                showToast("Método de pago actualizado", "success");
                refetchMovements();
                refetchPreview();
            } else {
                showToast(
                    result.data?.updatePaymentMethod?.message ||
                        "Error al actualizar",
                    "error",
                );
            }
        } catch (error: any) {
            showToast(error.message || "Error al actualizar", "error");
        }
    };

    const getStatusStyles = (status?: string) => {
        if (!status)
            return "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/50";
        switch (status) {
            case "CLOSED":
                return "bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700/50";
            default:
                return "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50";
        }
    };

    return (
        <div className="flex  w-full flex-col bg-slate-50 p-4 transition-colors duration-300 dark:bg-slate-950 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl space-y-8">
                {/* Header Section */}
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/20">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-6 w-6"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                                    />
                                </svg>
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                                Gestión de Cajas
                            </h1>
                        </div>
                        <p className="pl-[60px] text-sm font-medium text-slate-500 dark:text-slate-400">
                            Control de aperturas, cierres y movimientos en
                            tiempo real
                        </p>
                    </div>

                    <div className="flex items-center gap-3 lg:self-end">
                        <button
                            onClick={() => setIsManualModalOpen(true)}
                            className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-indigo-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                />
                            </svg>
                            Nuevo Movimiento
                        </button>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                                showHistory
                                    ? "border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-800/30 dark:bg-indigo-900/20 dark:text-indigo-400"
                                    : "border-slate-100 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900"
                            }`}
                            title={
                                showHistory
                                    ? "Ocultar Historial"
                                    : "Mostrar Historial"
                            }
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
                                    strokeWidth={2.5}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            {showHistory
                                ? "Ocultar Historial"
                                : "Ver Historial"}
                        </button>
                        <button
                            onClick={() => {
                                refetchRegisters();
                                refetchHistory();
                            }}
                            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-600 dark:bg-slate-900 dark:text-slate-500 dark:hover:bg-slate-800"
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
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                    {/* Left Column: Registers and Preview */}
                    <div
                        className={`space-y-8 transition-all duration-500 ${showHistory ? "lg:col-span-8" : "lg:col-span-12"}`}
                    >
                        {/* Registers Grid */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {loadingRegisters
                                ? Array(2)
                                      .fill(0)
                                      .map((_, i) => (
                                          <div
                                              key={i}
                                              className="h-48 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800"
                                          />
                                      ))
                                : cashRegisters.map((register) => (
                                      <div
                                          key={register.id}
                                          onClick={() =>
                                              setSelectedRegister(
                                                  selectedRegister?.id ===
                                                      register.id
                                                      ? null
                                                      : register,
                                              )
                                          }
                                          className={`group relative overflow-hidden rounded-3xl border-2 p-6 transition-all cursor-pointer ${
                                              selectedRegister?.id ===
                                              register.id
                                                  ? "border-indigo-500 bg-white shadow-2xl shadow-indigo-500/10 dark:bg-slate-900"
                                                  : "border-transparent bg-white shadow-sm hover:border-slate-200 dark:bg-slate-900 dark:hover:border-slate-800"
                                          }`}
                                      >
                                          <div className="flex flex-col gap-4">
                                              <div className="flex items-start justify-between">
                                                  <div className="flex flex-col gap-1">
                                                      <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                                                          {register.name}
                                                      </h3>
                                                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                          {register.cashType ===
                                                          "MAIN"
                                                              ? "Caja Principal"
                                                              : "Caja Secundaria"}
                                                      </span>
                                                  </div>
                                                  <span
                                                      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${getStatusStyles(register.status)}`}
                                                  >
                                                      {register.status ===
                                                      "CLOSED"
                                                          ? "Cerrada"
                                                          : "Activa"}
                                                  </span>
                                              </div>

                                              <div className="mt-2 flex items-center justify-between gap-4">
                                                  <button
                                                      onClick={(e) => {
                                                          e.stopPropagation();
                                                          if (!isElectron)
                                                              return;
                                                          setPendingConfirm({
                                                              type: "close_register",
                                                              registerId:
                                                                  register.id,
                                                              registerName:
                                                                  register.name,
                                                          });
                                                      }}
                                                      disabled={!isElectron}
                                                      className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black text-white shadow-lg transition-all ${
                                                          isElectron
                                                              ? "bg-rose-600 shadow-rose-500/20 hover:bg-rose-700 active:scale-95"
                                                              : "bg-slate-400 opacity-50 cursor-not-allowed"
                                                      }`}
                                                      title={
                                                          !isElectron
                                                              ? "El cierre de caja solo está disponible en la aplicación de escritorio"
                                                              : ""
                                                      }
                                                  >
                                                      <svg
                                                          xmlns="http://www.w3.org/2000/svg"
                                                          className="h-4 w-4"
                                                          viewBox="0 0 20 20"
                                                          fill="currentColor"
                                                      >
                                                          <path
                                                              fillRule="evenodd"
                                                              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                                              clipRule="evenodd"
                                                          />
                                                      </svg>
                                                      {isElectron
                                                          ? "Cerrar Caja"
                                                          : "Solo en App"}
                                                  </button>
                                              </div>
                                          </div>
                                          {/* Selected Indicator */}
                                          {selectedRegister?.id ===
                                              register.id && (
                                              <div className="absolute right-0 top-0 p-3 text-indigo-500">
                                                  <svg
                                                      xmlns="http://www.w3.org/2000/svg"
                                                      className="h-5 w-5"
                                                      viewBox="0 0 20 20"
                                                      fill="currentColor"
                                                  >
                                                      <path
                                                          fillRule="evenodd"
                                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                          clipRule="evenodd"
                                                      />
                                                  </svg>
                                              </div>
                                          )}
                                      </div>
                                  ))}
                        </div>

                        {/* Preview Section */}
                        <div className="overflow-visible rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                            <div className="border-b border-slate-50 p-8 dark:border-slate-800/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
                                            {selectedRegister
                                                ? `Resumen: ${selectedRegister.name}`
                                                : "Resumen de Cierre"}
                                        </h2>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            Selecciona una caja abierta para ver
                                            el resumen de cierre
                                        </p>
                                    </div>
                                    {selectedRegister && (
                                        <button
                                            onClick={() =>
                                                setSelectedRegister(null)
                                            }
                                            className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 dark:text-indigo-400"
                                        >
                                            Limpiar
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="p-8">
                                {!selectedRegister ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="mb-4 h-12 w-12 opacity-20"
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
                                        <p className="text-sm font-bold uppercase tracking-widest">
                                            Selecciona una caja para ver la
                                            vista previa del cierre
                                        </p>
                                    </div>
                                ) : loadingPreview || loadingMovements ? (
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                        {Array(4)
                                            .fill(0)
                                            .map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="h-32 animate-pulse rounded-3xl bg-slate-50 dark:bg-slate-800/50"
                                                />
                                            ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-8">
                                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                            {/* Ingresos por ventas */}
                                            <div className="flex flex-col gap-3 rounded-3xl bg-emerald-50/50 p-6 dark:bg-emerald-900/10">
                                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-800">
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
                                                                strokeWidth={
                                                                    2.5
                                                                }
                                                                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                                        Ingresos Ventas
                                                    </span>
                                                </div>
                                                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                                                    {currencyFormatter.format(
                                                        movementTotals.salesIncome,
                                                    )}
                                                </span>
                                            </div>

                                            {/* Ingresos por movimientos manuales */}
                                            <div className="flex flex-col gap-3 rounded-3xl bg-teal-50/50 p-6 dark:bg-teal-900/10">
                                                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-800">
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
                                                                strokeWidth={
                                                                    2.5
                                                                }
                                                                d="M12 4v16m8-8H4"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                                        Ingresos Movimientos
                                                    </span>
                                                </div>
                                                <span className="text-2xl font-black text-teal-700 dark:text-teal-400">
                                                    {currencyFormatter.format(
                                                        movementTotals.manualIncome,
                                                    )}
                                                </span>
                                            </div>

                                            {/* Expense */}
                                            <div className="flex flex-col gap-3 rounded-3xl bg-rose-50/50 p-6 dark:bg-rose-900/10">
                                                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-800">
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
                                                                strokeWidth={
                                                                    2.5
                                                                }
                                                                d="M20 12H4"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                                        Egresos
                                                    </span>
                                                </div>
                                                <span className="text-2xl font-black text-rose-700 dark:text-rose-400">
                                                    {currencyFormatter.format(
                                                        movementTotals.totalExpense,
                                                    )}
                                                </span>
                                            </div>

                                            {/* Net */}
                                            <div className="flex flex-col gap-3 rounded-3xl bg-indigo-50/50 p-6 dark:bg-indigo-900/10">
                                                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-800">
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
                                                                strokeWidth={
                                                                    2.5
                                                                }
                                                                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                                        Saldo Neto
                                                    </span>
                                                </div>
                                                <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400">
                                                    {currencyFormatter.format(
                                                        movementTotals.netTotal,
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Resumen por método de pago */}
                                        <div className="flex flex-col gap-4">
                                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                                Resumen por método de pago
                                            </h3>
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                                                {(
                                                    preview?.generalPaymentMethods ||
                                                    []
                                                ).map((p) => {
                                                    const config: Record<
                                                        string,
                                                        {
                                                            color: string;
                                                            bg: string;
                                                            border: string;
                                                            darkBg: string;
                                                            darkBorder: string;
                                                        }
                                                    > = {
                                                        CASH: {
                                                            color: "text-blue-600",
                                                            bg: "bg-blue-50/50",
                                                            border: "border-blue-100",
                                                            darkBg: "bg-blue-900/10",
                                                            darkBorder:
                                                                "border-blue-800/30",
                                                        },
                                                        YAPE: {
                                                            color: "text-emerald-600",
                                                            bg: "bg-emerald-50/50",
                                                            border: "border-emerald-100",
                                                            darkBg: "bg-emerald-900/10",
                                                            darkBorder:
                                                                "border-emerald-800/30",
                                                        },
                                                        PLIN: {
                                                            color: "text-amber-600",
                                                            bg: "bg-amber-50/50",
                                                            border: "border-amber-100",
                                                            darkBg: "bg-amber-900/10",
                                                            darkBorder:
                                                                "border-amber-800/30",
                                                        },
                                                        CARD: {
                                                            color: "text-rose-600",
                                                            bg: "bg-rose-50/50",
                                                            border: "border-rose-100",
                                                            darkBg: "bg-rose-900/10",
                                                            darkBorder:
                                                                "border-rose-800/30",
                                                        },
                                                        TRANSFER: {
                                                            color: "text-purple-600",
                                                            bg: "bg-purple-50/50",
                                                            border: "border-purple-100",
                                                            darkBg: "bg-purple-900/10",
                                                            darkBorder:
                                                                "border-purple-800/30",
                                                        },
                                                    };
                                                    const style = config[
                                                        p.methodCode
                                                    ] || {
                                                        color: "text-slate-600",
                                                        bg: "bg-slate-50/50",
                                                        border: "border-slate-100",
                                                        darkBg: "bg-slate-800/10",
                                                        darkBorder:
                                                            "border-slate-700/30",
                                                    };

                                                    return (
                                                        <div
                                                            key={p.methodCode}
                                                            className={`flex flex-col gap-3 rounded-3xl border ${style.bg} ${style.border} p-5 transition-all hover:shadow-md dark:${style.darkBg} dark:${style.darkBorder}`}
                                                        >
                                                            <span
                                                                className={`text-sm font-black ${style.color}`}
                                                            >
                                                                {p.methodName}
                                                            </span>
                                                            <div className="flex flex-col gap-1 text-[11px] font-bold">
                                                                <div className="flex justify-between text-slate-400">
                                                                    <span>
                                                                        Ingresos:
                                                                    </span>
                                                                    <span className="text-emerald-600 dark:text-emerald-400">
                                                                        {currencyFormatter.format(
                                                                            p.income,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between text-slate-400">
                                                                    <span>
                                                                        Egresos:
                                                                    </span>
                                                                    <span className="text-rose-600 dark:text-rose-400">
                                                                        {currencyFormatter.format(
                                                                            p.expense,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div
                                                                    className={`mt-1 flex justify-between border-t border-slate-100 pt-1 dark:border-slate-800`}
                                                                >
                                                                    <span className="text-slate-500 dark:text-slate-400">
                                                                        Neto:
                                                                    </span>
                                                                    <span
                                                                        className={`text-[13px] font-black ${style.color}`}
                                                                    >
                                                                        {currencyFormatter.format(
                                                                            p.net,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Movements Table */}
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
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
                                                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                                        Movimientos de caja
                                                    </h3>
                                                </div>
                                                <button
                                                    onClick={() =>
                                                        setShowMovements(
                                                            !showMovements,
                                                        )
                                                    }
                                                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                                                >
                                                    {showMovements
                                                        ? "Ocultar"
                                                        : "Mostrar"}
                                                </button>
                                            </div>

                                            {showMovements && (
                                                <div className="rounded-3xl border border-slate-200 bg-white shadow-md dark:border-slate-600 dark:bg-slate-900">
                                                    <div className="overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600">
                                                        <table className="w-full min-w-[1080px] text-left text-xs">
                                                            <thead>
                                                                <tr className="border-b-2 border-slate-200 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                                                                    <th className="min-w-[150px] whitespace-nowrap px-4 py-3">
                                                                        Fecha / Hora
                                                                    </th>
                                                                    <th className="min-w-[90px] whitespace-nowrap px-4 py-3 text-center">
                                                                        Tipo
                                                                    </th>
                                                                    <th className="min-w-[110px] whitespace-nowrap px-4 py-3">
                                                                        Método
                                                                    </th>
                                                                    <th className="min-w-[90px] whitespace-nowrap px-4 py-3">
                                                                        Monto
                                                                    </th>
                                                                    <th className="min-w-[100px] whitespace-nowrap px-4 py-3 text-center">
                                                                        Documento
                                                                    </th>
                                                                    <th className="min-w-[120px] whitespace-nowrap px-4 py-3">
                                                                        Usuario
                                                                    </th>
                                                                    <th className="min-w-[120px] whitespace-nowrap px-4 py-3">
                                                                        Notas
                                                                    </th>
                                                                    <th className="sticky right-[4.75rem] z-20 min-w-[4.75rem] whitespace-nowrap bg-slate-100 px-3 py-3 text-center shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.25)] dark:bg-slate-800">
                                                                        Imprimir
                                                                    </th>
                                                                    <th className="sticky right-0 z-20 min-w-[4.75rem] whitespace-nowrap bg-slate-100 px-3 py-3 text-center dark:bg-slate-800">
                                                                        Anular
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                                {movements.length ===
                                                                0 ? (
                                                                    <tr>
                                                                        <td
                                                                            colSpan={
                                                                                9
                                                                            }
                                                                            className="py-10 text-center text-slate-400 italic"
                                                                        >
                                                                            No
                                                                            hay
                                                                            movimientos
                                                                            registrados
                                                                        </td>
                                                                    </tr>
                                                                ) : (
                                                                    movements.map(
                                                                        (m, rowIndex) => {
                                                                            const isCancelled =
                                                                                isPaymentCancelled(
                                                                                    m.status,
                                                                                );
                                                                            const stickyRowBg =
                                                                                isCancelled
                                                                                    ? "bg-red-50 dark:bg-red-950/40"
                                                                                    : rowIndex % 2 === 0
                                                                                      ? "bg-white dark:bg-slate-900"
                                                                                      : "bg-slate-50/60 dark:bg-slate-800/50";

                                                                            return (
                                                                            <tr
                                                                                key={
                                                                                    m.id
                                                                                }
                                                                                className={`border-b transition-colors ${
                                                                                    isCancelled
                                                                                        ? "border-l-4 border-l-red-500 bg-red-50 hover:bg-red-100/70 dark:border-l-red-400 dark:border-red-900/40 dark:bg-red-950/40 dark:hover:bg-red-950/55"
                                                                                        : rowIndex % 2 === 0
                                                                                          ? "border-slate-100 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/80"
                                                                                          : "border-slate-100 bg-slate-50/60 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800/80"
                                                                                }`}
                                                                            >
                                                                                <td
                                                                                    className={`min-w-[150px] whitespace-nowrap px-4 py-3 font-semibold ${
                                                                                        isCancelled
                                                                                            ? "text-slate-700 dark:text-slate-200"
                                                                                            : "text-slate-600 dark:text-slate-300"
                                                                                    }`}
                                                                                >
                                                                                    {formatLocalDateYYYYMMDD(
                                                                                        m.paymentDate,
                                                                                    )}
                                                                                </td>
                                                                                <td className="min-w-[90px] px-4 py-3 text-center">
                                                                                    <div className="flex flex-col items-center gap-1">
                                                                                        <span
                                                                                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${
                                                                                                isCancelled
                                                                                                    ? "bg-red-600 text-white ring-red-500 dark:bg-red-600 dark:text-white dark:ring-red-500"
                                                                                                    : m.transactionType ===
                                                                                                        "INCOME"
                                                                                                      ? "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:ring-emerald-800"
                                                                                                      : "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-900/50 dark:text-rose-300 dark:ring-rose-800"
                                                                                            }`}
                                                                                        >
                                                                                            {m.transactionType ===
                                                                                            "INCOME"
                                                                                                ? "Ingreso"
                                                                                                : "Egreso"}
                                                                                        </span>
                                                                                        {isCancelled && (
                                                                                            <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white ring-1 ring-red-500 dark:bg-red-600 dark:ring-red-500">
                                                                                                Anulado
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="min-w-[110px] px-4 py-3">
                                                                                    {isCancelled ? (
                                                                                        <span className="text-[11px] font-bold text-slate-600 line-through decoration-red-400 dark:text-slate-300 dark:decoration-red-400">
                                                                                            {PAYMENT_METHOD_LABELS[
                                                                                                m.paymentMethod
                                                                                            ] ??
                                                                                                m.paymentMethod}
                                                                                        </span>
                                                                                    ) : (
                                                                                        <select
                                                                                            value={
                                                                                                m.paymentMethod
                                                                                            }
                                                                                            onChange={(
                                                                                                e,
                                                                                            ) =>
                                                                                                handleUpdatePaymentMethod(
                                                                                                    m.id,
                                                                                                    e
                                                                                                        .target
                                                                                                        .value,
                                                                                                )
                                                                                            }
                                                                                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                                                                        >
                                                                                            <option value="CASH">
                                                                                                Efectivo
                                                                                            </option>
                                                                                            <option value="YAPE">
                                                                                                Yape
                                                                                            </option>
                                                                                            <option value="PLIN">
                                                                                                Plin
                                                                                            </option>
                                                                                            <option value="CARD">
                                                                                                Tarjeta
                                                                                            </option>
                                                                                            <option value="TRANSFER">
                                                                                                Transferencia
                                                                                            </option>
                                                                                        </select>
                                                                                    )}
                                                                                </td>
                                                                                <td
                                                                                    className={`min-w-[90px] whitespace-nowrap px-4 py-3 text-sm font-black ${
                                                                                        isCancelled
                                                                                            ? "text-red-700 line-through decoration-red-400 dark:text-red-200 dark:decoration-red-400"
                                                                                            : "text-slate-800 dark:text-slate-100"
                                                                                    }`}
                                                                                >
                                                                                    {currencyFormatter.format(
                                                                                        toPaymentAmount(
                                                                                            m.paidAmount,
                                                                                        ),
                                                                                    )}
                                                                                </td>
                                                                                <td
                                                                                    className={`min-w-[100px] whitespace-nowrap px-4 py-3 text-center text-sm font-bold ${
                                                                                        isCancelled
                                                                                            ? "text-red-700 line-through decoration-red-400 dark:text-red-200 dark:decoration-red-400"
                                                                                            : "text-slate-700 dark:text-slate-200"
                                                                                    }`}
                                                                                >
                                                                                    {m.issuedDocument
                                                                                        ? `${m.issuedDocument.serial}-${m.issuedDocument.number}`
                                                                                        : m
                                                                                                .operation
                                                                                                ?.order
                                                                                          ? `Orden #${m.operation.order}`
                                                                                          : "—"}
                                                                                </td>
                                                                                <td
                                                                                    className={`max-w-[140px] truncate px-4 py-3 font-semibold ${
                                                                                        isCancelled
                                                                                            ? "text-slate-700 dark:text-slate-200"
                                                                                            : "text-slate-600 dark:text-slate-300"
                                                                                    }`}
                                                                                    title={
                                                                                        m.user
                                                                                            ?.fullName
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        m
                                                                                            .user
                                                                                            ?.fullName
                                                                                    }
                                                                                </td>
                                                                                <td className="min-w-[120px] max-w-[160px] px-4 py-3">
                                                                                    <p
                                                                                        className={`truncate font-medium ${
                                                                                            isCancelled
                                                                                                ? "text-slate-600 line-through decoration-red-400 dark:text-slate-300 dark:decoration-red-400"
                                                                                                : "text-slate-600 dark:text-slate-300"
                                                                                        }`}
                                                                                        title={
                                                                                            m.notes
                                                                                        }
                                                                                    >
                                                                                        {m.notes ||
                                                                                            "—"}
                                                                                    </p>
                                                                                </td>
                                                                                <td
                                                                                    className={`sticky right-[4.75rem] z-10 min-w-[4.75rem] px-3 py-3 text-center shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.25)] ${stickyRowBg}`}
                                                                                >
                                                                                    <button
                                                                                        onClick={() =>
                                                                                            handlePrintPayment(
                                                                                                m.id,
                                                                                            )
                                                                                        }
                                                                                        title="Imprimir comprobante"
                                                                                        className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200 transition-all hover:bg-indigo-200 dark:bg-indigo-900/60 dark:text-indigo-200 dark:ring-indigo-800 dark:hover:bg-indigo-900/80"
                                                                                    >
                                                                                        <svg
                                                                                            xmlns="http://www.w3.org/2000/svg"
                                                                                            className="h-4 w-4"
                                                                                            viewBox="0 0 20 20"
                                                                                            fill="currentColor"
                                                                                        >
                                                                                            <path
                                                                                                fillRule="evenodd"
                                                                                                d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2-2zm8 2H7V4h6v2zM7 14v2h6v-2H7z"
                                                                                                clipRule="evenodd"
                                                                                            />
                                                                                        </svg>
                                                                                    </button>
                                                                                </td>
                                                                                <td
                                                                                    className={`sticky right-0 z-10 min-w-[4.75rem] px-3 py-3 text-center ${stickyRowBg}`}
                                                                                >
                                                                                    {isCancelled ? (
                                                                                        <span
                                                                                            className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-white ring-1 ring-red-500 dark:bg-red-600 dark:ring-red-500"
                                                                                            title="Movimiento anulado"
                                                                                        >
                                                                                            <svg
                                                                                                xmlns="http://www.w3.org/2000/svg"
                                                                                                className="h-4 w-4"
                                                                                                viewBox="0 0 20 20"
                                                                                                fill="currentColor"
                                                                                            >
                                                                                                <path
                                                                                                    fillRule="evenodd"
                                                                                                    d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                                                                                                    clipRule="evenodd"
                                                                                                />
                                                                                            </svg>
                                                                                        </span>
                                                                                    ) : (
                                                                                        <button
                                                                                            onClick={() =>
                                                                                                setPendingConfirm(
                                                                                                    {
                                                                                                        type: "cancel_payment",
                                                                                                        paymentId:
                                                                                                            m.id,
                                                                                                    },
                                                                                                )
                                                                                            }
                                                                                            title="Anular movimiento"
                                                                                            className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500 text-white ring-1 ring-rose-400 transition-all hover:bg-rose-600 dark:bg-rose-600 dark:ring-rose-500 dark:hover:bg-rose-500"
                                                                                        >
                                                                                            <svg
                                                                                                xmlns="http://www.w3.org/2000/svg"
                                                                                                className="h-4 w-4"
                                                                                                viewBox="0 0 20 20"
                                                                                                fill="currentColor"
                                                                                            >
                                                                                                <path
                                                                                                    fillRule="evenodd"
                                                                                                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                                                                                    clipRule="evenodd"
                                                                                                />
                                                                                            </svg>
                                                                                        </button>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                            );
                                                                        },
                                                                    )
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: History */}
                    {showHistory && (
                        <div className="lg:col-span-4">
                            <div className="flex h-full flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                                <div className="border-b border-slate-50 p-6 dark:border-slate-800/50">
                                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                                        Historial Reciente
                                    </h2>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        Últimos 10 cierres
                                    </p>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4">
                                    {loadingHistory ? (
                                        <div className="space-y-4">
                                            {Array(5)
                                                .fill(0)
                                                .map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className="h-20 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/50"
                                                    />
                                                ))}
                                        </div>
                                    ) : history.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="mb-4 h-12 w-12 opacity-20"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                            <p className="text-xs font-black uppercase tracking-widest">
                                                Sin cierres previos
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {history.map((closure) => (
                                                <div
                                                    key={closure.id}
                                                    className="group relative flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                                                                Cierre #
                                                                {
                                                                    closure.closureNumber
                                                                }
                                                            </span>
                                                            <span className="text-[10px] font-medium text-slate-500">
                                                                {formatLocalDateYYYYMMDD(
                                                                    closure.closedAt,
                                                                )}
                                                            </span>
                                                        </div>
                                                        <span
                                                            className={`text-sm font-black ${closure.netTotal >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                                                        >
                                                            {currencyFormatter.format(
                                                                closure.netTotal ||
                                                                    0,
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between border-t border-slate-50 pt-3 dark:border-slate-800/50">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[8px] font-black dark:bg-slate-800">
                                                                {closure.user?.fullName?.charAt(
                                                                    0,
                                                                ) || "U"}
                                                            </div>
                                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                                                {
                                                                    closure.user?.fullName?.split(
                                                                        " ",
                                                                    )[0]
                                                                }
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() =>
                                                                    handleReprint(
                                                                        closure,
                                                                    )
                                                                }
                                                                disabled={
                                                                    reprintingClosureId ===
                                                                    closure.id
                                                                }
                                                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                                                                title="Reimprimir Ticket"
                                                            >
                                                                {reprintingClosureId ===
                                                                closure.id ? (
                                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
                                                                ) : (
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
                                                                            strokeWidth={
                                                                                2
                                                                            }
                                                                            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                                                        />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedClosureDetail(
                                                                        closure,
                                                                    );
                                                                    setIsDetailModalOpen(
                                                                        true,
                                                                    );
                                                                }}
                                                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                                                                title="Ver Detalle"
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
                                                                        strokeWidth={
                                                                            2.5
                                                                        }
                                                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                                    />
                                                                    <path
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        strokeWidth={
                                                                            2
                                                                        }
                                                                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                                    />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <ManualTransactionModal
                isOpen={isManualModalOpen}
                onClose={() => setIsManualModalOpen(false)}
                onSuccess={() => {
                    refetchRegisters();
                    refetchPreview();
                    refetchMovements();
                }}
                cashRegisters={cashRegisters.filter(
                    (r: CashRegister) => r.isActive,
                )}
                userId={userId}
                branchId={branchId}
            />

            <CashDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                closure={selectedClosureDetail}
                onReprint={handleReprint}
                reprintingClosureId={reprintingClosureId}
            />

            <ConfirmModal
                isOpen={pendingConfirm !== null}
                title={confirmModalConfig?.title ?? ""}
                message={confirmModalConfig?.message ?? ""}
                confirmLabel={confirmModalConfig?.confirmLabel}
                variant={confirmModalConfig?.variant}
                loading={confirmLoading}
                onConfirm={handleConfirmAction}
                onClose={() => {
                    if (confirmLoading) return;
                    setPendingConfirm(null);
                }}
            />
        </div>
    );
};

export default Cashs;
