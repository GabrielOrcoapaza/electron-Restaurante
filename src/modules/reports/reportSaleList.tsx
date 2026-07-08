import React, { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useApolloClient } from "@apollo/client";
import {
    CANCEL_ISSUED_DOCUMENT,
    REPRINT_DOCUMENT,
    REACTIVATE_TABLE,
    FULL_ANNULMENT,
} from "../../graphql/mutations";
import { GET_DOCUMENTS } from "../../graphql/queries";
import { useAuth } from "../../hooks/useAuth";
import { useUserPermissions } from "../../hooks/useUserPermissions";
import ConvertDocumentModal from "./convertDocumentModal";
import { parseLocalEmissionDateTime } from "../../utils/localDateTime";
import { isElectronRenderer } from "../../utils/electronPrint";
import {
    buildIssuedDocumentReportJson,
    issuedDocumentPdfFilename,
} from "../../utils/buildIssuedDocumentReportJson";
import { buildSunatQrData } from "../../utils/buildSunatQrData";
import { downloadIssuedDocumentPdf } from "../../utils/downloadIssuedDocumentPdf";
import {
    buildIssuedDocumentSunatUrls,
    buildPrintInvoiceUrl,
    canDownloadSunatXmlFiles,
    canOpenOfficialIssuedDocument,
    downloadIssuedDocumentSunatFile,
    downloadOfficialIssuedDocumentPdf,
    isElectronicBillingDocumentCode,
    officialDocumentUnavailableMessage,
    resolveCompanyRucForSunat,
    resolvePrintInvoiceId,
} from "../../utils/issuedDocumentSunatUrls";
import { invokeLocalIssuedDocumentPrint } from "../../utils/localDocumentPrint";
import {
    getIntegratedPrinterCashUiEnabled,
    getLocalTicketPrinterStorage,
} from "../../utils/localPrinterPreference";
import { issuedItemLineTotal } from "../../utils/taxAmounts";

interface IssuedDocument {
    id: string;
    serial: string;
    number: string | number;
    cdrPath?: string | null;
    signedXmlPath?: string | null;
    xmlPath?: string | null;
    sunatOperationId?: string | number | null;
    emissionDate: string;
    emissionTime: string;
    totalAmount: number;
    totalDiscount: number;
    globalDiscount?: number;
    globalDiscountPercent?: number;
    igvAmount: number;
    hashCode?: string | null;
    billingStatus: string;
    notes?: string;
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
    };
    operation?: {
        id: string;
        order: string;
        status: string;
        operationType?: string;
        serviceType?: string;
        user?: {
            id: string;
            fullName: string;
        } | null;
        table?: {
            id: string;
            name: string;
            floor?: {
                id: string;
                name: string;
            } | null;
        } | null;
    };
    items: Array<{
        id: string;
        quantity: number;
        unitValue?: number;
        unitPrice: number;
        total: number;
        notes?: string;
        operationDetail?: {
            product: {
                id: string;
                code: string;
                name: string;
            };
        };
    }>;
    payments: Array<{
        id: string;
        paymentMethod: string;
        paidAmount: number;
        paymentDate: string;
        status: string;
        isActive?: boolean;
        cashClosure?: {
            id: string;
        } | null;
        user?: {
            id: string;
            fullName: string;
        } | null;
    }>;
    user: {
        id: string;
        fullName: string;
    };
    branch: {
        id: string;
        name: string;
        igvPercentage?: number;
        company?: {
            ruc?: string;
        } | null;
    };
}

interface ReportSaleListProps {
    documents: IssuedDocument[];
    loading: boolean;
    error?: any;
    isSmallDesktop: boolean;
    isSmall?: boolean;
    isXs?: boolean;
    onRefetch?: () => void;
}

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
});

const roundMoney2 = (n: number): number =>
    Math.round((Number(n) || 0) * 100) / 100;

function formatSalesDiscountSummary(doc: IssuedDocument): string | null {
    const td = roundMoney2(doc.totalDiscount);
    if (td <= 0) return null;
    const moneyStr = currencyFormatter.format(td);
    const pct = roundMoney2(doc.globalDiscountPercent ?? 0);
    if (pct > 0.001) {
        const pctDisplay =
            Math.abs(pct % 1) < 0.001 ? String(Math.trunc(pct)) : String(pct);
        return `${pctDisplay}% (${moneyStr})`;
    }
    return moneyStr;
}

const ReportSaleList: React.FC<ReportSaleListProps> = ({
    documents,
    loading,
    error,
    onRefetch,
}) => {
    const { user, deviceId, getMacAddress, getDeviceId, companyData } =
        useAuth();
    const branchId = companyData?.branch?.id;
    const apolloClient = useApolloClient();
    const igvPercentageForLabel =
        Number(companyData?.branch?.igvPercentage) || 10.5;
    const { hasPermission } = useUserPermissions();
    const isElectron = isElectronRenderer();

    const [expandedDocument, setExpandedDocument] = useState<string | null>(
        null,
    );
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [selectedDocument, setSelectedDocument] =
        useState<IssuedDocument | null>(null);
    const [cancellationReason, setCancellationReason] = useState<string>("");
    const [cancellationDescription, setCancellationDescription] =
        useState<string>("");
    const [cancelMessage, setCancelMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [localDocuments, setLocalDocuments] =
        useState<IssuedDocument[]>(documents);
    const [printMessage, setPrintMessage] = useState<{
        type: "success" | "error" | "warning";
        text: string;
    } | null>(null);
    const [printingDocId, setPrintingDocId] = useState<string | null>(null);
    const [downloadingDocId, setDownloadingDocId] = useState<string | null>(
        null,
    );
    const [downloadMenuDocId, setDownloadMenuDocId] = useState<string | null>(
        null,
    );
    const downloadMenuRef = useRef<HTMLDivElement | null>(null);
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [documentToConvert, setDocumentToConvert] =
        useState<IssuedDocument | null>(null);
    const [showReactivateModal, setShowReactivateModal] = useState(false);
    const [documentToReactivate, setDocumentToReactivate] =
        useState<IssuedDocument | null>(null);
    const [reactivateMessage, setReactivateMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [reactivatingDocId, setReactivatingDocId] = useState<string | null>(
        null,
    );
    const [showFullAnnulModal, setShowFullAnnulModal] = useState(false);
    const [documentForFullAnnul, setDocumentForFullAnnul] =
        useState<IssuedDocument | null>(null);
    const [fullAnnulReason, setFullAnnulReason] = useState("");
    const [fullAnnulDescription, setFullAnnulDescription] = useState("");
    const [fullAnnulMessage, setFullAnnulMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [fullAnnulling, setFullAnnulling] = useState(false);

    const { data: documentsConfigData } = useQuery(GET_DOCUMENTS, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: "cache-first",
    });

    React.useEffect(() => {
        setLocalDocuments(documents);
    }, [documents]);

    useEffect(() => {
        if (!downloadMenuDocId) return;
        const onPointerDown = (event: MouseEvent) => {
            if (
                downloadMenuRef.current &&
                !downloadMenuRef.current.contains(event.target as Node)
            ) {
                setDownloadMenuDocId(null);
            }
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [downloadMenuDocId]);

    const getReprintDocumentType = (
        code: string,
        description: string,
    ): string => {
        const map: Record<string, string> = {
            "01": "FACTURA",
            "03": "BOLETA",
            "80": "CUENTA",
        };
        return map[code] || description || code;
    };

    const [reprintDocument, { loading: reprinting }] =
        useMutation(REPRINT_DOCUMENT);

    const preferLocalUsbPrint = () =>
        getIntegratedPrinterCashUiEnabled() ||
        Boolean(getLocalTicketPrinterStorage().trim()) ||
        isElectron;

    const resolveReprintDocumentJson = (
        doc: IssuedDocument,
        backendRaw?: string | null,
    ): string => {
        const backend = String(backendRaw ?? "").trim();
        if (backend) {
            try {
                const parsed = JSON.parse(backend) as Record<string, unknown>;
                const hasQr = Boolean(
                    String(parsed.qr_data ?? parsed.qrData ?? "").trim(),
                );
                if (hasQr) return backend;

                const localQr = buildSunatQrData(doc, companyData);
                if (localQr) {
                    parsed.qr_data = localQr;
                    return JSON.stringify(parsed);
                }
                return backend;
            } catch {
                return backend;
            }
        }
        return buildIssuedDocumentReportJson(doc, companyData);
    };

    const resolveReprintPrintPayload = (
        doc: IssuedDocument,
        backendDocumentData?: string | null,
    ) => {
        if (!preferLocalUsbPrint()) return null;
        const documentData = resolveReprintDocumentJson(doc, backendDocumentData);
        return {
            printLocally: true,
            documentData,
        };
    };

    const [cancelDocument, { loading: canceling }] = useMutation(
        CANCEL_ISSUED_DOCUMENT,
        {
            onCompleted: (data) => {
                if (data.cancelIssuedDocument.success) {
                    if (selectedDocument) {
                        setLocalDocuments((prevDocs) =>
                            prevDocs.map((doc) =>
                                doc.id === selectedDocument.id
                                    ? {
                                          ...doc,
                                          billingStatus:
                                              data.cancelIssuedDocument
                                                  .issuedDocument.billingStatus,
                                      }
                                    : doc,
                            ),
                        );
                    }
                    setCancelMessage({
                        type: "success",
                        text: data.cancelIssuedDocument.message,
                    });
                    setTimeout(() => {
                        setShowCancelModal(false);
                        setCancellationReason("");
                        setCancellationDescription("");
                        setSelectedDocument(null);
                        setCancelMessage(null);
                        if (onRefetch) onRefetch();
                    }, 2000);
                } else {
                    setCancelMessage({
                        type: "error",
                        text: data.cancelIssuedDocument.message,
                    });
                }
            },
            onError: (error) =>
                setCancelMessage({ type: "error", text: error.message }),
        },
    );

    const getPaymentMethodInfo = (method: string) => {
        const methods: Record<
            string,
            { label: string; color: string; bg: string }
        > = {
            CASH: {
                label: "Efectivo",
                color: "text-sky-600",
                bg: "bg-sky-50 dark:bg-sky-900/20",
            },
            YAPE: {
                label: "Yape",
                color: "text-emerald-600",
                bg: "bg-emerald-50 dark:bg-emerald-900/20",
            },
            PLIN: {
                label: "Plin",
                color: "text-amber-600",
                bg: "bg-amber-50 dark:bg-amber-900/20",
            },
            CARD: {
                label: "Tarjeta",
                color: "text-rose-600",
                bg: "bg-rose-50 dark:bg-rose-900/20",
            },
            TRANSFER: {
                label: "Transf.",
                color: "text-purple-600",
                bg: "bg-purple-50 dark:bg-purple-900/20",
            },
            OTROS: {
                label: "Otros",
                color: "text-slate-600",
                bg: "bg-slate-50 dark:bg-slate-800/30",
            },
        };
        return (
            methods[method] || {
                label: method,
                color: "text-slate-600",
                bg: "bg-slate-50 dark:bg-slate-800/30",
            }
        );
    };

    const getBillingStatusInfo = (status: string) => {
        const statusMap: Record<
            string,
            { label: string; color: string; bg: string; dot: string }
        > = {
            PROCESSING: {
                label: "Procesando",
                color: "text-amber-600",
                bg: "bg-amber-50 dark:bg-amber-900/20",
                dot: "bg-amber-500",
            },
            SENT: {
                label: "Enviado",
                color: "text-blue-600",
                bg: "bg-blue-50 dark:bg-blue-900/20",
                dot: "bg-blue-500",
            },
            ACCEPTED: {
                label: "Emitido",
                color: "text-emerald-600",
                bg: "bg-emerald-50 dark:bg-emerald-900/20",
                dot: "bg-emerald-500",
            },
            REJECTED: {
                label: "Rechazado",
                color: "text-rose-600",
                bg: "bg-rose-50 dark:bg-rose-900/20",
                dot: "bg-rose-500",
            },
            ERROR: {
                label: "Error",
                color: "text-rose-600",
                bg: "bg-rose-50 dark:bg-rose-900/20",
                dot: "bg-rose-500",
            },
            CANCELLED: {
                label: "Anulado",
                color: "text-red-700 dark:text-red-300",
                bg: "bg-red-50 dark:bg-red-950/40",
                dot: "bg-red-600",
            },
            PROCESSING_CANCELLATION: {
                label: "Anulando",
                color: "text-red-700 dark:text-red-300",
                bg: "bg-red-50 dark:bg-red-950/40",
                dot: "bg-red-500",
            },
            CANCELLATION_PENDING: {
                label: "Anulación pendiente",
                color: "text-red-700 dark:text-red-300",
                bg: "bg-red-50 dark:bg-red-950/40",
                dot: "bg-red-500",
            },
            CANCELLATION_ERROR: {
                label: "Error anulación",
                color: "text-red-700 dark:text-red-300",
                bg: "bg-red-50 dark:bg-red-950/40",
                dot: "bg-red-600",
            },
        };
        return (
            statusMap[status] || {
                label: status,
                color: "text-slate-500",
                bg: "bg-slate-100 dark:bg-slate-800",
                dot: "bg-slate-400",
            }
        );
    };

    const CANCELLATION_STATUSES = new Set([
        "CANCELLED",
        "PROCESSING_CANCELLATION",
        "CANCELLATION_PENDING",
        "CANCELLATION_ERROR",
    ]);

    const canEditOrders = hasPermission("orders.edit");

    const isCancelledDocument = (doc: IssuedDocument): boolean =>
        CANCELLATION_STATUSES.has(doc.billingStatus?.toUpperCase?.() || "");

    const isActionableDocument = (doc: IssuedDocument): boolean =>
        !isCancelledDocument(doc);

    const branchDocuments: Array<{ id: string; code: string; isActive: boolean }> =
        documentsConfigData?.documentsByBranch || [];

    const canConvertDocument = (doc: IssuedDocument): boolean =>
        branchDocuments.some(
            (d) => d.isActive && d.id !== doc.document.id,
        );

    const canReactivateTable = (doc: IssuedDocument): boolean => {
        const isRestaurant =
            (doc.operation?.serviceType || "").toUpperCase() === "RESTAURANT";
        const hasTable = Boolean(doc.operation?.table?.id);
        const noPaymentClosed = doc.payments
            .filter((p) => p.isActive !== false)
            .every((p) => !p.cashClosure?.id);
        return isRestaurant && hasTable && noPaymentClosed;
    };

    const canAnnulDocument = (status: string): boolean =>
        ["ACCEPTED", "SENT", "ACCEPTED_WITH_OBSERVATIONS"].includes(status);

    const handleReactivateTable = async () => {
        if (!documentToReactivate || !user?.id) return;
        setReactivatingDocId(documentToReactivate.id);
        setReactivateMessage(null);
        try {
            const result = await apolloClient.mutate({
                mutation: REACTIVATE_TABLE,
                variables: {
                    issuedDocumentId: documentToReactivate.id,
                    userId: user.id,
                },
            });
            const payload = result.data?.reactivateTable;
            if (!payload?.success) {
                throw new Error(
                    payload?.message || "No se pudo reactivar la mesa.",
                );
            }

            setReactivateMessage({
                type: "success",
                text: payload.message || "Mesa reactivada correctamente.",
            });
            setShowReactivateModal(false);
            setDocumentToReactivate(null);
            if (onRefetch) onRefetch();
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : "Error al reactivar la mesa.";
            setReactivateMessage({ type: "error", text: msg });
        } finally {
            setReactivatingDocId(null);
            setTimeout(() => setReactivateMessage(null), 5000);
        }
    };

    const handleCancelDocument = () => {
        if (!selectedDocument || !cancellationReason || !user?.id) {
            setCancelMessage({
                type: "error",
                text: "Por favor completa todos los campos requeridos",
            });
            return;
        }

        setCancelMessage(null);
        cancelDocument({
            variables: {
                issuedDocumentId: selectedDocument.id,
                userId: user.id,
                cancellationReason: cancellationReason,
                cancellationDescription: cancellationDescription || null,
            },
        });
    };

    const handleFullAnnulment = async () => {
        if (!documentForFullAnnul || !fullAnnulReason || !user?.id || !branchId) {
            setFullAnnulMessage({
                type: "error",
                text: "Seleccione un motivo de anulación",
            });
            return;
        }

        setFullAnnulMessage(null);
        setFullAnnulling(true);
        try {
            const result = await apolloClient.mutate({
                mutation: FULL_ANNULMENT,
                variables: {
                    issuedDocumentId: documentForFullAnnul.id,
                    userId: user.id,
                    cancellationReason: fullAnnulReason,
                    cancellationDescription: fullAnnulDescription || null,
                },
            });
            const payload = result.data?.fullAnnulment;
            if (!payload?.success) {
                throw new Error(
                    payload?.message || "No se pudo completar la anulación.",
                );
            }

            setFullAnnulMessage({
                type: "success",
                text: payload.message || "Anulación registrada correctamente.",
            });
            setTimeout(() => {
                setShowFullAnnulModal(false);
                setFullAnnulReason("");
                setFullAnnulDescription("");
                setDocumentForFullAnnul(null);
                setFullAnnulMessage(null);
                if (onRefetch) onRefetch();
            }, 2000);
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : "No se pudo completar la anulación.";
            setFullAnnulMessage({ type: "error", text: msg });
        } finally {
            setFullAnnulling(false);
        }
    };

    const handleDownloadPdf = async (
        doc: IssuedDocument,
        e: React.MouseEvent,
    ) => {
        e.stopPropagation();
        setDownloadMenuDocId(null);
        setDownloadingDocId(doc.id);
        setPrintMessage(null);

        try {
            let result: { ok: boolean; message?: string };

            if (isElectronicBillingDocumentCode(doc.document.code)) {
                result = await downloadOfficialIssuedDocumentPdf(
                    doc,
                    issuedDocumentPdfFilename(doc),
                    companyData,
                );
            } else {
                const documentJson = buildIssuedDocumentReportJson(
                    doc,
                    companyData,
                );
                result = await downloadIssuedDocumentPdf(
                    documentJson,
                    issuedDocumentPdfFilename(doc),
                );
            }

            if (result.ok) {
                setPrintMessage({
                    type: "success",
                    text:
                        result.message ||
                        `PDF descargado: ${doc.serial}-${doc.number}`,
                });
            } else {
                setPrintMessage({
                    type: "error",
                    text: result.message || "No se pudo descargar el PDF.",
                });
            }
        } catch (error) {
            const msg =
                error instanceof Error ? error.message : "Error al descargar PDF";
            setPrintMessage({ type: "error", text: msg });
        } finally {
            setDownloadingDocId(null);
            setTimeout(() => setPrintMessage(null), 5000);
        }
    };

    const handleDownloadSunatFile = async (
        doc: IssuedDocument,
        kind: "pdf" | "cdr" | "xml",
        e: React.MouseEvent,
    ) => {
        e.stopPropagation();
        setDownloadMenuDocId(null);
        setPrintMessage(null);

        const label =
            kind === "pdf"
                ? "PDF oficial (SUNAT)"
                : kind === "cdr"
                  ? "CDR (XML)"
                  : "XML firmado";

        if (kind === "pdf") {
            const printInvoiceUrl = buildPrintInvoiceUrl(doc);
            if (!printInvoiceUrl) {
                setPrintMessage({
                    type: "error",
                    text: officialDocumentUnavailableMessage(doc),
                });
                setTimeout(() => setPrintMessage(null), 5000);
                return;
            }

            console.log("[Reporte ventas - descarga PDF oficial]", {
                issuedDocumentLocalId: doc.id,
                sunatOperationId: doc.sunatOperationId ?? null,
                printInvoiceOperationId: resolvePrintInvoiceId(doc),
                printInvoiceUrl,
                serial: doc.serial,
                number: doc.number,
                documentCode: doc.document.code,
            });

            setDownloadingDocId(doc.id);
            try {
                const result = await downloadOfficialIssuedDocumentPdf(
                    doc,
                    issuedDocumentPdfFilename(doc),
                    companyData,
                );
                setPrintMessage({
                    type: result.ok ? "success" : "error",
                    text:
                        result.message ||
                        (result.ok
                            ? `${label} descargado: ${doc.serial}-${doc.number}`
                            : "No se pudo descargar el PDF oficial."),
                });
            } catch (error) {
                const msg =
                    error instanceof Error
                        ? error.message
                        : "Error al descargar comprobante";
                setPrintMessage({ type: "error", text: msg });
            } finally {
                setDownloadingDocId(null);
                setTimeout(() => setPrintMessage(null), 5000);
            }
            return;
        }

        const urls = buildIssuedDocumentSunatUrls(
            doc,
            resolveReportCompanyRuc(doc),
        );
        if (!urls) {
            setPrintMessage({
                type: "error",
                text: "No se pudieron generar las URLs del comprobante electrónico.",
            });
            setTimeout(() => setPrintMessage(null), 5000);
            return;
        }

        const targetUrl =
            kind === "cdr" ? urls.cdrXmlUrl : urls.signedXmlUrl;

        console.log("[Reporte ventas - descarga tuf4ctur4]", {
            kind,
            issuedDocumentLocalId: doc.id,
            sunatOperationId: doc.sunatOperationId ?? null,
            printInvoiceOperationId: urls.printInvoiceOperationId,
            companyRuc: urls.companyRuc,
            serial: doc.serial,
            number: doc.number,
            fileBaseName: urls.fileBaseName,
            cdrPath: doc.cdrPath ?? null,
            signedXmlPath: doc.signedXmlPath ?? null,
            printInvoiceUrl: urls.printInvoiceUrl,
            url: targetUrl,
            isElectron,
        });

        setDownloadingDocId(doc.id);
        try {
            const result = await downloadIssuedDocumentSunatFile(urls, kind);
            setPrintMessage({
                type: result.ok ? "success" : "error",
                text:
                    result.message ||
                    (result.ok
                        ? `${label}: ${doc.serial}-${doc.number}`
                        : `No se pudo descargar ${label.toLowerCase()}.`),
            });
        } catch (error) {
            const msg =
                error instanceof Error ? error.message : "Error al descargar";
            setPrintMessage({ type: "error", text: msg });
        } finally {
            setDownloadingDocId(null);
            setTimeout(() => setPrintMessage(null), 5000);
        }
    };

    const resolveReportCompanyRuc = (doc: IssuedDocument): string | null =>
        resolveCompanyRucForSunat(
            companyData?.company?.ruc ?? doc.branch?.company?.ruc,
            doc,
        );

    const canDownloadSunatXml = (doc: IssuedDocument): boolean =>
        canDownloadSunatXmlFiles(doc, resolveReportCompanyRuc(doc));

    const hasDownloadOptions = (doc: IssuedDocument): boolean =>
        canOpenOfficialIssuedDocument(doc) ||
        canDownloadSunatXml(doc) ||
        isElectron;

    const handleReprint = async (doc: IssuedDocument, e: React.MouseEvent) => {
        e.stopPropagation();
        const mac = await getMacAddress();
        const resolvedDeviceId = mac || deviceId || getDeviceId();
        if (!resolvedDeviceId) {
            setPrintMessage({
                type: "error",
                text: "No se pudo obtener la MAC del dispositivo.",
            });
            setTimeout(() => setPrintMessage(null), 4000);
            return;
        }

        setPrintingDocId(doc.id);
        setPrintMessage(null);

        try {
            const documentType = getReprintDocumentType(
                doc.document.code,
                doc.document.description,
            );

            console.log("Documento a reimprimir:", {
                operationId: doc.operation?.id || null,
                issuedDocumentId: doc.id,
                documentType,
                deviceId: resolvedDeviceId,
            });

            const { data } = await reprintDocument({
                variables: {
                    operationId: doc.operation?.id || null,
                    issuedDocumentId: doc.id,
                    documentType,
                    deviceId: resolvedDeviceId,
                },
            });

            const result = data?.reprintDocument as
                | Record<string, unknown>
                | null
                | undefined;

            if (!result?.success) {
                setPrintMessage({
                    type: "error",
                    text: String(result?.message || "Error al imprimir"),
                });
                return;
            }

            const backendDocData =
                (result?.documentData as string | null | undefined) ??
                (result?.document_data as string | null | undefined) ??
                null;

            const localPrintPayload = resolveReprintPrintPayload(
                doc,
                backendDocData,
            );
            if (localPrintPayload) {
                let parsedQr = false;
                try {
                    const p = JSON.parse(localPrintPayload.documentData) as Record<
                        string,
                        unknown
                    >;
                    parsedQr = Boolean(
                        String(p.qr_data ?? p.qrData ?? "").trim(),
                    );
                } catch {
                    parsedQr = false;
                }

                console.log("[Reprint reporte ventas]", {
                    issuedDocumentId: doc.id,
                    hashCode: doc.hashCode ?? null,
                    qrEnJson: parsedQr,
                    origenDocumentData: backendDocData ? "backend" : "local",
                });

                const localPrintOk = await invokeLocalIssuedDocumentPrint(
                    localPrintPayload,
                    {
                        label: "reimpresión reporte ventas",
                        operationId: doc.operation?.id ?? null,
                        deviceId: resolvedDeviceId,
                        localPrinterName:
                            getLocalTicketPrinterStorage().trim() || null,
                    },
                );

                if (!localPrintOk) {
                    setPrintMessage({
                        type: "error",
                        text:
                            "El documento se registró para reimpresión, pero no se pudo enviar a la impresora USB/local. Revise la impresora en Configuración → Impresoras locales.",
                    });
                    return;
                }

                if (
                    isElectronicBillingDocumentCode(doc.document.code) &&
                    !parsedQr
                ) {
                    setPrintMessage({
                        type: "warning",
                        text:
                            "Documento reimpreso, pero sin código QR: el comprobante no tiene hash SUNAT (hashCode). Debe estar emitido/aceptado por SUNAT.",
                    });
                    return;
                }

                setPrintMessage({
                    type: "success",
                    text:
                        String(result.message || "").trim() ||
                        "Documento reimpreso en la impresora local.",
                });
                return;
            }

            setPrintMessage({
                type: "success",
                text: String(result.message || "Documento enviado a impresión."),
            });
        } catch (err: unknown) {
            const graphQLError =
                err &&
                typeof err === "object" &&
                "graphQLErrors" in err &&
                Array.isArray(
                    (err as { graphQLErrors?: Array<{ message?: string }> })
                        .graphQLErrors,
                )
                    ? (err as { graphQLErrors: Array<{ message?: string }> })
                          .graphQLErrors[0]?.message
                    : undefined;
            const msg =
                graphQLError ||
                (err instanceof Error ? err.message : undefined) ||
                "Error al enviar a la impresora";
            setPrintMessage({ type: "error", text: msg });
        } finally {
            setPrintingDocId(null);
            setTimeout(() => setPrintMessage(null), 5000);
        }
    };

    const cancellationReasonsList = [
        { code: "01", description: "Anulación de la operación" },
        { code: "02", description: "Anulación por error en el RUC" },
        { code: "03", description: "Corrección por error en la descripción" },
        { code: "04", description: "Descuento global aplicado después" },
        { code: "05", description: "Descuento por ítem aplicado después" },
        { code: "06", description: "Devolución total" },
        { code: "07", description: "Devolución por ítem" },
        { code: "08", description: "Bonificación" },
    ];
    const paymentRegistrarLabel = (doc: IssuedDocument): string => {
        const names = [
            ...new Set(
                doc.payments
                    .map((p) => p.user?.fullName)
                    .filter((n): n is string => Boolean(n && String(n).trim())),
            ),
        ];
        if (names.length > 0) return names.join(", ");
        return doc.user?.fullName ?? "—";
    };
    if (loading)
        return (
            <div className="text-center py-10 font-bold text-slate-400">
                Cargando documentos...
            </div>
        );
    if (error)
        return (
            <div className="p-6 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 font-bold">
                Error: {error.message}
            </div>
        );
    if (localDocuments.length === 0)
        return (
            <div className="text-center py-20 text-slate-400 font-bold">
                No se encontraron documentos.
            </div>
        );

    return (
        <div className="flex flex-col gap-4">
            {/* Toast Messages */}
            {(printMessage || reactivateMessage) && (
                <div
                    className={`p-4 rounded-2xl border mb-2 font-bold text-sm ${
                        printMessage?.type === "success" ||
                        reactivateMessage?.type === "success"
                            ? "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-900/30"
                            : printMessage?.type === "warning"
                              ? "bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/30"
                              : "bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-900/20 dark:border-rose-900/30"
                    }`}
                >
                    {printMessage?.text || reactivateMessage?.text}
                </div>
            )}

            <div className="flex flex-col gap-4">
                {localDocuments.map((doc) => {
                    const isExpanded = expandedDocument === doc.id;
                    const status = getBillingStatusInfo(doc.billingStatus);
                    const discountSummary = formatSalesDiscountSummary(doc);
                    const isDownloadMenuOpen = downloadMenuDocId === doc.id;
                    const isCancelled = isCancelledDocument(doc);

                    return (
                        <div
                            key={doc.id}
                            onClick={() =>
                                setExpandedDocument(isExpanded ? null : doc.id)
                            }
                            className={`group relative flex flex-col overflow-visible rounded-[24px] border transition-all cursor-pointer ${
                                isDownloadMenuOpen ? "z-30" : "z-0"
                            } ${
                                isCancelled
                                    ? isExpanded
                                        ? "border-red-300 bg-red-50/60 shadow-lg shadow-red-100 dark:border-red-800 dark:bg-red-950/30 dark:shadow-none"
                                        : "border-red-200 bg-red-50/40 hover:border-red-300 hover:shadow-md hover:shadow-red-100 dark:border-red-900/50 dark:bg-red-950/20 dark:hover:border-red-800"
                                    : isExpanded
                                      ? "border-indigo-200 bg-indigo-50/20 shadow-lg shadow-indigo-100 dark:border-indigo-900/30 dark:bg-indigo-900/10 dark:shadow-none"
                                      : "border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                            }`}
                        >
                            {/* Card Header */}
                            <div className="flex flex-col p-5 sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div
                                        className={`flex h-12 w-12 items-center justify-center rounded-2xl font-black ${
                                            isCancelled
                                                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                                : doc.document.code === "01"
                                                  ? "bg-amber-100 text-amber-600"
                                                  : "bg-indigo-100 text-indigo-600"
                                        }`}
                                    >
                                        {doc.document.code}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`text-lg font-black ${
                                                    isCancelled
                                                        ? "text-red-800 line-through decoration-red-400 dark:text-red-200"
                                                        : "text-slate-800 dark:text-slate-100"
                                                }`}
                                            >
                                                {doc.serial}-{doc.number}
                                            </span>
                                            <div
                                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${status.bg} ${status.color}`}
                                            >
                                                <span
                                                    className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                                                />
                                                {status.label}
                                            </div>
                                        </div>
                                        {/* Piso, mesa, cajero y mozo */}
                                        <div className="mt-1.5 flex flex-col gap-1 text-[11px] leading-tight">
                                            {(doc.operation?.table?.floor?.name || doc.operation?.table?.name) && (
                                                <div className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <span className="opacity-50">📍</span>
                                                        {doc.operation?.table?.floor?.name ? `Piso ${doc.operation.table.floor.name}` : "Local"}
                                                    </span>
                                                    {doc.operation?.table?.name && (
                                                        <>
                                                            <span className="text-slate-300">|</span>
                                                            <span className="flex items-center gap-1">
                                                                <span className="opacity-50">🪑</span>
                                                                Mesa {doc.operation.table.name}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                {doc.operation?.user?.fullName && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px]">Mozo:</span>
                                                        <span className="text-slate-600 dark:text-slate-300">{doc.operation.user.fullName}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px]">Caja:</span>
                                                    <span className="text-slate-600 dark:text-slate-300">{paymentRegistrarLabel(doc)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-400">
                                            {dateFormatter.format(
                                                parseLocalEmissionDateTime(
                                                    doc.emissionDate,
                                                    doc.emissionTime,
                                                ),
                                            )}
                                            {doc.person &&
                                                ` • 👤 ${doc.person.name}`}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-6">
                                    <div className="flex flex-col items-end">
                                        <span
                                            className={`text-xl font-black ${
                                                isCancelled
                                                    ? "text-red-700 dark:text-red-300"
                                                    : "text-slate-800 dark:text-slate-100"
                                            }`}
                                        >
                                            {currencyFormatter.format(
                                                doc.totalAmount,
                                            )}
                                        </span>
                                        {discountSummary && (
                                            <span className="text-[10px] font-black text-rose-500 uppercase">
                                                Desc: {discountSummary}
                                            </span>
                                        )}
                                    </div>

                                    <div className="relative z-20 flex shrink-0 items-center gap-2">
                                        {hasDownloadOptions(doc) && (
                                            <div
                                                ref={
                                                    isDownloadMenuOpen
                                                        ? downloadMenuRef
                                                        : null
                                                }
                                                className="relative"
                                            >
                                                <button
                                                    type="button"
                                                    title="Descargar comprobante"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDownloadMenuDocId(
                                                            (prev) =>
                                                                prev === doc.id
                                                                    ? null
                                                                    : doc.id,
                                                        );
                                                    }}
                                                    disabled={
                                                        downloadingDocId ===
                                                        doc.id
                                                    }
                                                    className={`flex h-11 items-center gap-2 rounded-xl px-3.5 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 ${
                                                        isDownloadMenuOpen
                                                            ? "bg-rose-600 text-white shadow-lg shadow-rose-300/50 ring-2 ring-rose-300 dark:ring-rose-500"
                                                            : "bg-rose-500 text-white shadow-md shadow-rose-200/80 hover:bg-rose-600 hover:shadow-lg dark:bg-rose-600 dark:shadow-rose-900/40"
                                                    }`}
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className={`h-4 w-4 shrink-0 ${downloadingDocId === doc.id ? "animate-pulse" : ""}`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2.5}
                                                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                        />
                                                    </svg>
                                                    <span>Descargar</span>
                                                </button>

                                                {isDownloadMenuOpen && (
                                                    <div className="absolute right-0 top-[calc(100%+8px)] z-[100] min-w-[260px] overflow-hidden rounded-2xl border-2 border-rose-200 bg-white shadow-2xl shadow-rose-200/40 dark:border-rose-800 dark:bg-slate-900 dark:shadow-black/50">
                                                        <div className="border-b border-rose-100 bg-rose-50 px-4 py-2.5 dark:border-rose-900/40 dark:bg-rose-950/40">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
                                                                Descargar comprobante
                                                            </span>
                                                        </div>
                                                    {canOpenOfficialIssuedDocument(
                                                        doc,
                                                    ) ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) =>
                                                                handleDownloadSunatFile(
                                                                    doc,
                                                                    "pdf",
                                                                    e,
                                                                )
                                                            }
                                                            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-200 dark:hover:bg-rose-900/20 dark:hover:text-rose-300"
                                                        >
                                                            <span>📄</span>
                                                            <span>
                                                                Descargar PDF
                                                                A4 (SUNAT)
                                                            </span>
                                                        </button>
                                                    ) : null}
                                                    {canDownloadSunatXml(doc) ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={(e) =>
                                                                    handleDownloadSunatFile(
                                                                        doc,
                                                                        "cdr",
                                                                        e,
                                                                    )
                                                                }
                                                                className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-200 dark:hover:bg-rose-900/20 dark:hover:text-rose-300 ${
                                                                    canOpenOfficialIssuedDocument(
                                                                        doc,
                                                                    )
                                                                        ? "border-t border-slate-100 dark:border-slate-800"
                                                                        : ""
                                                                }`}
                                                            >
                                                                <span>📋</span>
                                                                <span>
                                                                    CDR (XML)
                                                                </span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) =>
                                                                    handleDownloadSunatFile(
                                                                        doc,
                                                                        "xml",
                                                                        e,
                                                                    )
                                                                }
                                                                className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-rose-50 hover:text-rose-700 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-rose-900/20 dark:hover:text-rose-300"
                                                            >
                                                                <span>🧾</span>
                                                                <span>
                                                                    XML firmado
                                                                </span>
                                                            </button>
                                                        </>
                                                    ) : null}
                                                    {isElectron && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) =>
                                                                handleDownloadPdf(
                                                                    doc,
                                                                    e,
                                                                )
                                                            }
                                                            disabled={
                                                                downloadingDocId ===
                                                                doc.id
                                                            }
                                                            className={`flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-semibold text-slate-500 transition hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 ${
                                                                canOpenOfficialIssuedDocument(
                                                                    doc,
                                                                ) ||
                                                                canDownloadSunatXml(
                                                                    doc,
                                                                )
                                                                    ? "border-t border-slate-100 dark:border-slate-800"
                                                                    : ""
                                                            }`}
                                                        >
                                                            <span>💾</span>
                                                            <span>
                                                                PDF del reporte
                                                                (SumApp)
                                                            </span>
                                                        </button>
                                                    )}
                                                    {!canOpenOfficialIssuedDocument(
                                                        doc,
                                                    ) &&
                                                        !canDownloadSunatXml(
                                                            doc,
                                                        ) &&
                                                        !isElectron && (
                                                            <div className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                                No hay opciones
                                                                de descarga para
                                                                este documento.
                                                            </div>
                                                        )}
                                                </div>
                                            )}
                                            </div>
                                        )}

                                        {isElectron && (
                                            <button
                                                type="button"
                                                title="Reimprimir"
                                                onClick={(e) =>
                                                    handleReprint(doc, e)
                                                }
                                                disabled={
                                                    reprinting &&
                                                    printingDocId === doc.id
                                                }
                                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:text-slate-400"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className={`h-5 w-5 ${reprinting && printingDocId === doc.id ? "animate-spin" : ""}`}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                                    />
                                                </svg>
                                            </button>
                                        )}

                                        {canEditOrders &&
                                            isActionableDocument(doc) && (
                                                <>
                                                    {canReactivateTable(doc) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDocumentToReactivate(
                                                                    doc,
                                                                );
                                                                setShowReactivateModal(
                                                                    true,
                                                                );
                                                            }}
                                                            disabled={
                                                                reactivatingDocId ===
                                                                doc.id
                                                            }
                                                            className="h-10 px-4 rounded-xl bg-amber-50 text-amber-600 text-xs font-black uppercase tracking-widest transition-all hover:bg-amber-600 hover:text-white dark:bg-amber-900/20"
                                                        >
                                                            {reactivatingDocId ===
                                                            doc.id
                                                                ? "..."
                                                                : "Reabrir Mesa"}
                                                        </button>
                                                    )}

                                                    {canConvertDocument(doc) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDocumentToConvert(
                                                                    doc,
                                                                );
                                                                setShowConvertModal(
                                                                    true,
                                                                );
                                                            }}
                                                            className="h-10 px-4 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-black uppercase tracking-widest transition-all hover:bg-emerald-600 hover:text-white dark:bg-emerald-900/20"
                                                        >
                                                            Convertir
                                                        </button>
                                                    )}

                                                    {canAnnulDocument(
                                                        doc.billingStatus,
                                                    ) &&
                                                        isElectronicBillingDocumentCode(
                                                            doc.document.code,
                                                        ) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedDocument(
                                                                    doc,
                                                                );
                                                                setShowCancelModal(
                                                                    true,
                                                                );
                                                            }}
                                                            className="h-10 px-4 rounded-xl bg-rose-50 text-rose-600 text-xs font-black uppercase tracking-widest transition-all hover:bg-rose-600 hover:text-white dark:bg-rose-900/20"
                                                        >
                                                            Anular Doc.
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDocumentForFullAnnul(
                                                                doc,
                                                            );
                                                            setFullAnnulReason(
                                                                "",
                                                            );
                                                            setFullAnnulDescription(
                                                                "",
                                                            );
                                                            setFullAnnulMessage(
                                                                null,
                                                            );
                                                            setShowFullAnnulModal(
                                                                true,
                                                            );
                                                        }}
                                                        className="h-10 px-4 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest transition-all hover:bg-red-700 shadow-sm"
                                                    >
                                                        Anul. Completa
                                                    </button>
                                                </>
                                            )}

                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className={`h-5 w-5 text-slate-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={3}
                                                d="M19 9l-7 7-7-7"
                                            />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div
                                    className={`overflow-hidden rounded-b-[24px] border-t p-6 ${
                                        isCancelled
                                            ? "border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20"
                                            : "border-indigo-100 bg-white/50 dark:border-indigo-900/30 dark:bg-slate-900/50"
                                    }`}
                                >
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {/* Items */}
                                        <div className="flex flex-col gap-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                Detalle de Productos
                                            </h4>
                                            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                                                <table className="w-full text-left text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-50/50 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800/30">
                                                            <th className="px-4 py-3">
                                                                Producto
                                                            </th>
                                                            <th className="px-4 py-3 text-center">
                                                                Cant.
                                                            </th>
                                                            <th className="px-4 py-3 text-right">
                                                                Total
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                                        {doc.items.map(
                                                            (item) => (
                                                                <tr
                                                                    key={
                                                                        item.id
                                                                    }
                                                                >
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                                                                {
                                                                                    item
                                                                                        .operationDetail
                                                                                        ?.product
                                                                                        ?.name
                                                                                }
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-400">
                                                                                {
                                                                                    item
                                                                                        .operationDetail
                                                                                        ?.product
                                                                                        ?.code
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center font-bold text-slate-500">
                                                                        {
                                                                            item.quantity
                                                                        }
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-black text-slate-700 dark:text-slate-200">
                                                                        {currencyFormatter.format(
                                                                            issuedItemLineTotal(
                                                                                item,
                                                                            ),
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ),
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Payments & Summary */}
                                        <div className="flex flex-col gap-6">
                                            <div className="flex flex-col gap-4">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    Información de Pago
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {doc.payments.map((p) => {
                                                        const info =
                                                            getPaymentMethodInfo(
                                                                p.paymentMethod,
                                                            );
                                                        return (
                                                            <div
                                                                key={p.id}
                                                                className={`flex items-center justify-between rounded-2xl border border-transparent p-4 ${info.bg}`}
                                                            >
                                                                <div className="flex flex-col">
                                                                    <span
                                                                        className={`text-[10px] font-black uppercase ${info.color}`}
                                                                    >
                                                                        {
                                                                            info.label
                                                                        }
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-slate-400 opacity-70">
                                                                        {dateFormatter.format(
                                                                            new Date(
                                                                                p.paymentDate,
                                                                            ),
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <span
                                                                    className={`text-sm font-black ${info.color}`}
                                                                >
                                                                    {currencyFormatter.format(
                                                                        p.paidAmount,
                                                                    )}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="mt-auto flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
                                                <div className="flex justify-between text-xs">
                                                    <span className="font-bold text-slate-400">
                                                        IGV (
                                                        {Number(
                                                            doc.branch
                                                                ?.igvPercentage ??
                                                                igvPercentageForLabel,
                                                        ) || 10.5}
                                                        %)
                                                    </span>
                                                    <span className="font-black text-slate-600 dark:text-slate-300">
                                                        {currencyFormatter.format(
                                                            doc.igvAmount,
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-lg border-t border-slate-200 pt-2 dark:border-slate-700">
                                                    <span className="font-black text-slate-800 dark:text-slate-100">
                                                        TOTAL
                                                    </span>
                                                    <span className="font-black text-indigo-600 dark:text-indigo-400">
                                                        {currencyFormatter.format(
                                                            doc.totalAmount,
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Cancel Modal */}
            {showCancelModal && selectedDocument && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                    onClick={() => setShowCancelModal(false)}
                >
                    <div
                        className="w-full max-w-lg overflow-hidden rounded-[32px] bg-white shadow-2xl dark:bg-slate-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-rose-500 p-8 text-white">
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
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-black">
                                Anular Documento
                            </h3>
                            <p className="mt-1 text-sm font-bold opacity-80">
                                {selectedDocument.document.description}{" "}
                                {selectedDocument.serial}-
                                {selectedDocument.number}
                            </p>
                        </div>

                        <div className="p-8">
                            {cancelMessage && (
                                <div
                                    className={`mb-6 p-4 rounded-2xl border text-sm font-bold ${cancelMessage.type === "success" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"}`}
                                >
                                    {cancelMessage.text}
                                </div>
                            )}

                            <div className="flex flex-col gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Motivo de Cancelación
                                    </label>
                                    <select
                                        value={cancellationReason}
                                        onChange={(e) =>
                                            setCancellationReason(
                                                e.target.value,
                                            )
                                        }
                                        className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-sm font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200"
                                    >
                                        <option value="">
                                            Seleccionar motivo...
                                        </option>
                                        {cancellationReasonsList.map((r) => (
                                            <option key={r.code} value={r.code}>
                                                {r.code} - {r.description}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Descripción (Opcional)
                                    </label>
                                    <textarea
                                        value={cancellationDescription}
                                        onChange={(e) =>
                                            setCancellationDescription(
                                                e.target.value,
                                            )
                                        }
                                        rows={3}
                                        placeholder="Detalles adicionales..."
                                        className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-sm font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() =>
                                            setShowCancelModal(false)
                                        }
                                        className="flex-1 h-12 rounded-2xl bg-slate-100 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                                    >
                                        Regresar
                                    </button>
                                    <button
                                        onClick={handleCancelDocument}
                                        disabled={
                                            canceling || !cancellationReason
                                        }
                                        className="flex-1 h-12 rounded-2xl bg-rose-500 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-rose-200 transition-all hover:bg-rose-600 disabled:opacity-50 dark:shadow-none"
                                    >
                                        {canceling ? "..." : "Anular Documento"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Annulment Modal */}
            {showFullAnnulModal && documentForFullAnnul && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                    onClick={() =>
                        !fullAnnulling && setShowFullAnnulModal(false)
                    }
                >
                    <div
                        className="w-full max-w-lg overflow-hidden rounded-[32px] bg-white shadow-2xl dark:bg-slate-900 max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-red-700 p-8 text-white flex-shrink-0">
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
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-black">
                                Anulación Completa
                            </h3>
                            <p className="mt-1 text-sm font-bold opacity-80">
                                {documentForFullAnnul.document.description}{" "}
                                {documentForFullAnnul.serial}-
                                {documentForFullAnnul.number}
                            </p>
                        </div>

                        <div className="p-8 overflow-y-auto flex-1">
                            {fullAnnulMessage && (
                                <div
                                    className={`mb-6 p-4 rounded-2xl border text-sm font-bold ${fullAnnulMessage.type === "success" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"}`}
                                >
                                    {fullAnnulMessage.text}
                                </div>
                            )}

                            <div className="mb-6 rounded-2xl border-2 border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/30">
                                <p className="text-sm font-black text-red-700 dark:text-red-300">
                                    Esta acción es IRREVERSIBLE
                                </p>
                                <ul className="mt-3 space-y-1.5 text-xs font-bold leading-relaxed text-red-800/90 dark:text-red-100/80">
                                    <li>
                                        • El comprobante{" "}
                                        {documentForFullAnnul.serial}-
                                        {documentForFullAnnul.number}
                                    </li>
                                    <li>
                                        • Los pagos vinculados a este
                                        comprobante
                                    </li>
                                    <li>
                                        • Los ítems facturados en este
                                        comprobante
                                    </li>
                                    <li>
                                        • El stock de ingredientes será
                                        restaurado
                                    </li>
                                    <li>
                                        • Si no quedan otros comprobantes
                                        activos, se cancelará la operación
                                        completa
                                    </li>
                                    {(documentForFullAnnul.operation
                                        ?.serviceType || ""
                                    ).toUpperCase() === "RESTAURANT" &&
                                        documentForFullAnnul.operation?.table
                                            ?.name && (
                                            <li>
                                                • La mesa "
                                                {
                                                    documentForFullAnnul
                                                        .operation.table.name
                                                }
                                                " quedará libre
                                            </li>
                                        )}
                                </ul>
                            </div>

                            <div className="mb-4 flex items-center justify-between rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                    {documentForFullAnnul.document.description}
                                </span>
                                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                    {currencyFormatter.format(
                                        documentForFullAnnul.totalAmount,
                                    )}
                                </span>
                            </div>

                            <div className="flex flex-col gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Motivo de Anulación *
                                    </label>
                                    <select
                                        value={fullAnnulReason}
                                        onChange={(e) =>
                                            setFullAnnulReason(e.target.value)
                                        }
                                        className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-sm font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200"
                                    >
                                        <option value="">
                                            Seleccionar motivo...
                                        </option>
                                        {cancellationReasonsList.map((r) => (
                                            <option key={r.code} value={r.code}>
                                                {r.code} - {r.description}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Descripción (Opcional)
                                    </label>
                                    <textarea
                                        value={fullAnnulDescription}
                                        onChange={(e) =>
                                            setFullAnnulDescription(
                                                e.target.value,
                                            )
                                        }
                                        rows={3}
                                        placeholder="Detalles adicionales..."
                                        className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-sm font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() =>
                                            setShowFullAnnulModal(false)
                                        }
                                        disabled={fullAnnulling}
                                        className="flex-1 h-12 rounded-2xl bg-slate-100 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                                    >
                                        Regresar
                                    </button>
                                    <button
                                        onClick={handleFullAnnulment}
                                        disabled={
                                            fullAnnulling || !fullAnnulReason
                                        }
                                        className="flex-1 h-12 rounded-2xl bg-red-700 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-200 transition-all hover:bg-red-800 disabled:opacity-50 dark:shadow-none"
                                    >
                                        {fullAnnulling
                                            ? "..."
                                            : "Anular Todo"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reactivate Table Modal */}
            {showReactivateModal && documentToReactivate && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                    onClick={() =>
                        reactivatingDocId === null &&
                        setShowReactivateModal(false)
                    }
                >
                    <div
                        className="w-full max-w-lg overflow-hidden rounded-[32px] bg-white shadow-2xl dark:bg-slate-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-amber-500 p-8 text-white">
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
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-black">
                                ¿Reabrir Mesa?
                            </h3>
                            <p className="mt-1 text-sm font-bold opacity-80">
                                {documentToReactivate.document.description}{" "}
                                {documentToReactivate.serial}-
                                {documentToReactivate.number}
                            </p>
                        </div>

                        <div className="p-8 flex flex-col gap-4">
                            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
                                <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                                    Mesa:{" "}
                                    {documentToReactivate.operation?.table
                                        ?.name || "—"}
                                </p>
                                <p className="mt-2 text-xs font-bold text-amber-700/80 dark:text-amber-100/70">
                                    La mesa debe estar libre. Si está ocupada,
                                    no se podrá reactivar la operación.
                                </p>
                            </div>

                            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-900/30 dark:bg-rose-900/10">
                                <p className="text-sm font-bold text-rose-700 dark:text-rose-200">
                                    Se anularán este comprobante y sus pagos, se
                                    revertirá el saldo de caja y la operación
                                    volverá a estado en curso para emitir un
                                    nuevo comprobante.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() =>
                                        setShowReactivateModal(false)
                                    }
                                    disabled={reactivatingDocId !== null}
                                    className="flex-1 h-12 rounded-2xl bg-slate-100 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                                >
                                    Regresar
                                </button>
                                <button
                                    onClick={handleReactivateTable}
                                    disabled={reactivatingDocId !== null}
                                    className="flex-1 h-12 rounded-2xl bg-amber-500 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-amber-200 transition-all hover:bg-amber-600 disabled:opacity-50 dark:shadow-none"
                                >
                                    {reactivatingDocId !== null
                                        ? "..."
                                        : "Reabrir Mesa"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Convert Modal */}
            {showConvertModal && documentToConvert && (
                <ConvertDocumentModal
                    isOpen={showConvertModal}
                    onClose={() => {
                        setShowConvertModal(false);
                        setDocumentToConvert(null);
                    }}
                    sourceDocument={documentToConvert}
                    onSuccess={() => onRefetch?.()}
                />
            )}
        </div>
    );
};

export default ReportSaleList;
