import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { CANCEL_ISSUED_DOCUMENT, REPRINT_DOCUMENT, REOPEN_ORDER_FROM_ANNULLED_DOCUMENT } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useResponsive } from '../../hooks/useResponsive';
import ConvertDocumentModal from './convertDocumentModal';
import { parseLocalEmissionDateTime } from '../../utils/localDateTime';
interface IssuedDocument {
  id: string;
  serial: string;
  number: string;
  emissionDate: string;
  emissionTime: string;
  totalAmount: number;
  totalDiscount: number;
  globalDiscount?: number;
  globalDiscountPercent?: number;
  igvAmount: number;
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
  };
}

interface ReportSaleListProps {
  documents: IssuedDocument[];
  loading: boolean;
  error?: any;
  isSmallDesktop: boolean;
  isSmall?: boolean;
  isMedium?: boolean;
  isXs?: boolean;
  onRefetch?: () => void;
}

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

const roundMoney2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/** Descuento en listado: "10% (S/ 1,60)" si aplica %; si no, solo monto en soles. */
function formatSalesDiscountSummary(doc: IssuedDocument): string | null {
  const td = roundMoney2(doc.totalDiscount);
  if (td <= 0) return null;
  const moneyStr = currencyFormatter.format(td);
  const pct = roundMoney2(doc.globalDiscountPercent ?? 0);
  if (pct > 0.001) {
    const pctDisplay = Math.abs(pct % 1) < 0.001 ? String(Math.trunc(pct)) : String(pct);
    return `${pctDisplay}% (${moneyStr})`;
  }
  return moneyStr;
}

const ReportSaleList: React.FC<ReportSaleListProps> = ({
  documents,
  loading,
  error,
  isSmallDesktop: propIsSmallDesktop,
  isSmall: propIsSmall,
  isMedium: propIsMedium,
  isXs: propIsXs,
  onRefetch
}) => {
  const { user, deviceId, getMacAddress, getDeviceId } = useAuth();
  const { hasPermission } = useUserPermissions();
  const { breakpoint, isMobile, isXs: isXsHook } = useResponsive();

  const isSmall = propIsSmall ?? (breakpoint === 'sm' || isMobile);
  const isMedium = propIsMedium ?? breakpoint === 'md';
  const isSmallDesktop = propIsSmallDesktop !== undefined ? propIsSmallDesktop : breakpoint === 'lg';
  const isMediumDesktop = breakpoint === 'xl';
  const isXs = propIsXs ?? isXsHook;
  const [expandedDocument, setExpandedDocument] = useState<string | null>(null);
  const [searchTerm] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<IssuedDocument | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [cancellationDescription, setCancellationDescription] = useState<string>('');
  const [cancelMessage, setCancelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [localDocuments, setLocalDocuments] = useState<IssuedDocument[]>(documents);
  const [printMessage, setPrintMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [printingDocId, setPrintingDocId] = useState<string | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [documentToConvert, setDocumentToConvert] = useState<IssuedDocument | null>(null);
  const [reopenMessage, setReopenMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [reopeningDocId, setReopeningDocId] = useState<string | null>(null);

  // Actualizar documentos locales cuando cambien los props
  React.useEffect(() => {
    setLocalDocuments(documents);
  }, [documents]);

  // Reimpresión: Precuenta, Cuenta, Boleta, Factura. Nota de venta (80) = Cuenta. No hay reimpresión para Nota de crédito.
  const getReprintDocumentType = (code: string, description: string): string => {
    const map: Record<string, string> = {
      '01': 'FACTURA',
      '03': 'BOLETA',
      '80': 'CUENTA', // Nota de venta se reimprime como Cuenta
    };
    return map[code] || description || code;
  };

  const [reprintDocument, { loading: reprinting }] = useMutation(REPRINT_DOCUMENT, {
    onCompleted: (data) => {
      const result = data?.reprintDocument;
      console.log('[ReprintDocument] Respuesta completa:', data);
      console.log('[ReprintDocument] success:', result?.success, '| message:', result?.message);
      if (result?.success) {
        setPrintMessage({ type: 'success', text: result.message });
      } else {
        setPrintMessage({ type: 'error', text: result?.message || 'Error al imprimir' });
      }
      setPrintingDocId(null);
      setTimeout(() => setPrintMessage(null), 4000);
    },
    onError: (err) => {
      console.error('[ReprintDocument] Error:', err);
      console.error('[ReprintDocument] graphQLErrors:', err.graphQLErrors);
      console.error('[ReprintDocument] networkError:', (err as any).networkError);
      console.error('[ReprintDocument] message:', err.message);
      const msg =
        err.graphQLErrors?.[0]?.message ||
        (err as any).networkError?.result?.errors?.[0]?.message ||
        err.message;
      setPrintMessage({ type: 'error', text: msg || 'Error al enviar a la impresora' });
      setPrintingDocId(null);
      setTimeout(() => setPrintMessage(null), 4000);
    },
  });

  // Mutación para cancelar documento
  const [reopenOrderFromAnnulledDocument, { loading: reopening }] = useMutation(REOPEN_ORDER_FROM_ANNULLED_DOCUMENT, {
    onCompleted: (data) => {
      const r = data?.reopenOrderFromAnnulledDocument;
      if (r?.success) {
        setReopenMessage({ type: 'success', text: r.message || 'Orden reaperturada.' });
        if (onRefetch) onRefetch();
      } else {
        setReopenMessage({ type: 'error', text: r?.message || 'No se pudo reaperturar la orden.' });
      }
      setReopeningDocId(null);
      setTimeout(() => setReopenMessage(null), 5000);
    },
    onError: (err) => {
      const msg =
        err.graphQLErrors?.[0]?.message ||
        (err as any).networkError?.result?.errors?.[0]?.message ||
        err.message;
      setReopenMessage({ type: 'error', text: msg || 'Error al reaperturar.' });
      setReopeningDocId(null);
      setTimeout(() => setReopenMessage(null), 5000);
    }
  });

  const [cancelDocument, { loading: canceling }] = useMutation(CANCEL_ISSUED_DOCUMENT, {
    onCompleted: (data) => {
      if (data.cancelIssuedDocument.success) {
        // Actualizar el documento local con el nuevo estado
        if (selectedDocument) {
          setLocalDocuments(prevDocs =>
            prevDocs.map(doc =>
              doc.id === selectedDocument.id
                ? { ...doc, billingStatus: data.cancelIssuedDocument.issuedDocument.billingStatus }
                : doc
            )
          );
        }

        setCancelMessage({ type: 'success', text: data.cancelIssuedDocument.message });

        // Cerrar el modal después de 2 segundos
        setTimeout(() => {
          setShowCancelModal(false);
          setCancellationReason('');
          setCancellationDescription('');
          setSelectedDocument(null);
          setCancelMessage(null);

          // Si hay callback de refetch, llamarlo para actualizar los datos
          if (onRefetch) {
            onRefetch();
          }
        }, 2000);
      } else {
        setCancelMessage({ type: 'error', text: data.cancelIssuedDocument.message });
      }
    },
    onError: (error) => {
      // Verificar si es un error de autenticación
      if (error.message.includes('authentication') || error.message.includes('token') || error.message.includes('Unauthorized')) {
        setCancelMessage({ type: 'error', text: 'Error de autenticación. Por favor, verifica tu sesión.' });
      } else {
        setCancelMessage({ type: 'error', text: error.message });
      }
    },
  });

  // Tamaños adaptativos
  const cardPadding = isXs ? '0.6rem' : isSmall ? '0.75rem' : '1rem';
  const tableFontSize = isXs ? '0.8rem' : isSmall ? '0.85rem' : '0.875rem';
  const tableCellPadding = isXs ? '0.5rem' : isSmall ? '0.6rem' : '0.75rem';
  const badgeFontSize = isXs ? '0.65rem' : isSmall ? '0.7rem' : '0.75rem';
  const inputFontSize = isXs ? '0.85rem' : isSmall ? '0.9rem' : '0.875rem';

  // Función para obtener el nombre del método de pago
  const getPaymentMethodName = (method: string) => {
    const methods: { [key: string]: string } = {
      'CASH': 'Efectivo',
      'YAPE': 'Yape',
      'PLIN': 'Plin',
      'CARD': 'Tarjeta',
      'TRANSFER': 'Transferencia',
      'OTROS': 'Otros'
    };
    return methods[method] || method;
  };

  // Función para obtener el color del método de pago
  const getPaymentMethodColor = (method: string) => {
    const colors: { [key: string]: { bg: string; text: string } } = {
      'CASH': { bg: '#f0f9ff', text: '#0369a1' },
      'YAPE': { bg: '#f0fdf4', text: '#047857' },
      'PLIN': { bg: '#fef3c7', text: '#b45309' },
      'CARD': { bg: '#fef2f2', text: '#b91c1c' },
      'TRANSFER': { bg: '#f3e8ff', text: '#7e22ce' },
      'OTROS': { bg: '#f1f5f9', text: '#334155' }
    };
    return colors[method] || { bg: '#f1f5f9', text: '#334155' };
  };

  // Función para obtener el nombre del estado de facturación
  const getBillingStatusName = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'PROCESSING': 'Procesando',
      'SENT': 'Enviado',
      'ACCEPTED': 'Emitido',
      'ACCEPTED_WITH_OBSERVATIONS': 'Emitido con observaciones',
      'REJECTED': 'Rechazado',
      'ERROR': 'Error',
      'PROCESSING_CANCELLATION': 'Procesando anulación',
      'CANCELLATION_PENDING': 'Anulación pendiente',
      'CANCELLED': 'Anulado',
      'CANCELLATION_ERROR': 'Error en anulación'
    };
    return statusMap[status] || status;
  };

  // Función para obtener el color del estado de facturación
  const getBillingStatusColor = (status: string) => {
    const colors: { [key: string]: { bg: string; text: string; border: string } } = {
      'PROCESSING': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
      'SENT': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
      'ACCEPTED': { bg: '#dcfce7', text: '#166534', border: '#86efac' },
      'ACCEPTED_WITH_OBSERVATIONS': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
      'REJECTED': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
      'ERROR': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
      'PROCESSING_CANCELLATION': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
      'CANCELLATION_PENDING': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
      'CANCELLED': { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
      'CANCELLATION_ERROR': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }
    };
    return colors[status] || { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
  };

  // Verificar si un documento puede ser cancelado
  const canCancelDocument = (status: string): boolean => {
    const validStatuses = ['ACCEPTED', 'SENT', 'ACCEPTED_WITH_OBSERVATIONS'];
    return validStatuses.includes(status);
  };

  /** Misma lógica base que el backend (venta completada, comprobante anulado, permiso orders.edit). */
  const canReopenAnnulledOrder = (doc: IssuedDocument): boolean => {
    if (!hasPermission('orders.edit')) return false;
    if (doc.billingStatus !== 'CANCELLED') return false;
    if (!doc.operation?.id || doc.operation.status !== 'COMPLETED') return false;
    const opType = doc.operation.operationType;
    if (opType && opType !== 'SALE') return false;
    return true;
  };

  const handleReopenOrder = (doc: IssuedDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    const msg =
      '¿Reaperturar la orden de esta venta?\n\n' +
      'Se anularán en caja los pagos vinculados a este comprobante (solo si no están en un cierre). La orden volverá a “en proceso” y, si hay mesa disponible, quedará ocupada de nuevo.';
    if (!window.confirm(msg)) return;
    setReopenMessage(null);
    setReopeningDocId(doc.id);
    reopenOrderFromAnnulledDocument({
      variables: { issuedDocumentId: doc.id, userId: user.id }
    });
  };

  // Motivos de cancelación válidos según SUNAT
  const cancellationReasons = [
    { code: '01', description: 'Anulación de la operación' },
    { code: '02', description: 'Anulación por error en el RUC' },
    { code: '03', description: 'Corrección por error en la descripción' },
    { code: '04', description: 'Descuento global aplicado después' },
    { code: '05', description: 'Descuento por ítem aplicado después' },
    { code: '06', description: 'Devolución total' },
    { code: '07', description: 'Devolución por ítem' },
    { code: '08', description: 'Bonificación' }
  ];

  const handleOpenCancelModal = (doc: IssuedDocument, e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que se expanda/contraiga el documento
    setSelectedDocument(doc);
    setCancellationReason('');
    setCancellationDescription('');
    setCancelMessage(null);
    setShowCancelModal(true);
  };

  const handleReprint = async (doc: IssuedDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    setPrintMessage(null);

    console.log('[ReprintDocument] Click impresora — documento:', {
      id: doc.id,
      code: doc.document.code,
      description: doc.document.description,
      operationId: doc.operation?.id ?? null,
    });

    // device_id debe ser la MAC del dispositivo (backend usa DevicePrintConfig por MAC o impresora de caja)
    const mac = await getMacAddress();
    const resolvedDeviceId = mac || deviceId || getDeviceId();
    if (!resolvedDeviceId) {
      setPrintMessage({ type: 'error', text: 'No se pudo obtener la MAC del dispositivo. No se puede imprimir.' });
      setTimeout(() => setPrintMessage(null), 4000);
      return;
    }
    console.log('[ReprintDocument] device_id (MAC) enviado:', resolvedDeviceId);

    const documentTypeForBackend = getReprintDocumentType(doc.document.code, doc.document.description);
    console.log('[ReprintDocument] document_type para backend:', documentTypeForBackend, '(código:', doc.document.code, ')');

    const variables = {
      operationId: doc.operation?.id || null,
      issuedDocumentId: doc.id,
      documentType: documentTypeForBackend,
      deviceId: resolvedDeviceId,
    };
    console.log('[ReprintDocument] Enviando a GraphQL variables:', variables);

    setPrintingDocId(doc.id);
    reprintDocument({ variables });
  };

  const handleCancelDocument = () => {
    if (!selectedDocument || !cancellationReason || !user?.id) {
      setCancelMessage({ type: 'error', text: 'Por favor completa todos los campos requeridos' });
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

  // Filtrar documentos por término de búsqueda
  const filteredDocuments = localDocuments.filter(doc => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();

    // Buscar en campos básicos del documento
    const paymentUserMatch = doc.payments.some(
      (p) => p.user?.fullName?.toLowerCase().includes(search) ?? false
    );
    const basicMatch =
      doc.serial.toLowerCase().includes(search) ||
      doc.number.toLowerCase().includes(search) ||
      doc.document.description.toLowerCase().includes(search) ||
      (doc.person?.name.toLowerCase().includes(search) || false) ||
      (doc.person?.documentNumber.toLowerCase().includes(search) || false) ||
      doc.user.fullName.toLowerCase().includes(search) ||
      (doc.operation?.user?.fullName?.toLowerCase().includes(search) ?? false) ||
      (doc.operation?.table?.floor?.name?.toLowerCase().includes(search) ?? false) ||
      paymentUserMatch;

    // Buscar en productos de los items
    const productMatch = doc.items.some(item =>
      item.operationDetail?.product?.code.toLowerCase().includes(search) ||
      item.operationDetail?.product?.name.toLowerCase().includes(search)
    );

    return basicMatch || productMatch;
 });

  const paymentRegistrarLabel = (doc: IssuedDocument): string => {
    const names = [
      ...new Set(
        doc.payments
          .map((p) => p.user?.fullName)
          .filter((n): n is string => Boolean(n && String(n).trim()))
      )
    ];
    if (names.length > 0) return names.join(', ');
    return doc.user?.fullName ?? '—';
  };

  if (loading) {
    return (
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: cardPadding,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          color: '#64748b'
        }}
      >
        Cargando documentos...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '12px',
          padding: cardPadding,
          color: '#991b1b'
        }}
      >
        Error al cargar los documentos: {error.message}
      </div>
    );
  }

  if (filteredDocuments.length === 0) {
    return (
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          color: '#475569',
          fontSize: '1rem',
          fontWeight: 500
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.7 }}>📋</div>
        <div style={{ marginBottom: '0.5rem' }}>
          {documents.length === 0
            ? 'No se encontraron documentos en el rango de fechas seleccionado.'
            : 'No se encontraron documentos que coincidan con la búsqueda.'}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
          Prueba con otro rango de fechas o verifica que existan ventas emitidas en ese periodo.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 1rem 0' }}>
      {/* Mensaje de impresión */}
      {printMessage && (
        <div
          style={{
            padding: '0.625rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            background: printMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${printMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
            color: printMessage.type === 'success' ? '#166534' : '#991b1b',
            fontSize: tableFontSize,
          }}
        >
          {printMessage.text}
        </div>
      )}
      {reopenMessage && (
        <div
          style={{
            padding: '0.625rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            background: reopenMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${reopenMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
            color: reopenMessage.type === 'success' ? '#166534' : '#991b1b',
            fontSize: tableFontSize,
          }}
        >
          {reopenMessage.text}
        </div>
      )}
      {/* Lista de documentos (el scroll está en el card del padre) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        minHeight: '200px'
      }}>
        {filteredDocuments.map((doc) => {
          const isExpanded = expandedDocument === doc.id;
          const discountSummary = formatSalesDiscountSummary(doc);
          const paymentMethodsMap = new Map<string, number>();

          doc.payments.forEach(payment => {
            const current = paymentMethodsMap.get(payment.paymentMethod) || 0;
            paymentMethodsMap.set(payment.paymentMethod, current + payment.paidAmount);
          });

          return (
            <div
              key={doc.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                overflow: 'hidden',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#667eea';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(102, 126, 234, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => setExpandedDocument(isExpanded ? null : doc.id)}
            >
              {/* Header del documento */}
                <div
                  style={{
                    padding: cardPadding,
                    background: isExpanded ? '#f8fafc' : 'white',
                    display: 'flex',
                    flexDirection: isXs ? 'column' : 'row',
                    alignItems: isXs ? 'stretch' : 'flex-start',
                    gap: isXs ? '0.75rem' : '1rem',
                    minWidth: 0
                  }}
                >
                  {/* Bloque izquierdo: tipo, número, estado, fecha y datos */}
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: badgeFontSize,
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          background: '#667eea',
                          color: 'white'
                        }}
                      >
                        {doc.document.code}
                      </span>
                      <span style={{ fontSize: tableFontSize, fontWeight: 600, color: '#1e293b' }}>
                        {doc.serial}-{doc.number}
                      </span>
                      {doc.billingStatus && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            background: getBillingStatusColor(doc.billingStatus).bg,
                            color: getBillingStatusColor(doc.billingStatus).text,
                            border: `1px solid ${getBillingStatusColor(doc.billingStatus).border}`
                          }}
                        >
                          {getBillingStatusName(doc.billingStatus)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                      {dateFormatter.format(parseLocalEmissionDateTime(doc.emissionDate, doc.emissionTime))}
                    </div>
                    {doc.person && (
                      <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>
                        👤 {doc.person.name}
                      </div>
                    )}
                  </div>

                  {/* Bloque derecho: monto, métodos de pago y acciones */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: isXs ? 'row' : 'column',
                      justifyContent: 'space-between',
                      alignItems: isXs ? 'center' : 'flex-end',
                      gap: '0.75rem',
                      minWidth: 0,
                      borderTop: isXs ? '1px solid #f1f5f9' : 'none',
                      paddingTop: isXs ? '0.75rem' : '0'
                    }}
                  >
                    <div style={{ textAlign: isXs ? 'left' : 'right' }}>
                      <div style={{
                        fontSize: isXs ? '1.1rem' : '1.25rem',
                        fontWeight: 800,
                        color: '#1e293b'
                      }}>
                        {currencyFormatter.format(doc.totalAmount)}
                      </div>
                      {!isXs && discountSummary && (
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#b45309' }}>
                          Desc: {discountSummary}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      onClick={(e) => handleReprint(doc, e)}
                      disabled={reprinting && printingDocId === doc.id}
                      title="Reimprimir documento"
                      style={{
                        padding: '0.625rem 0.75rem',
                        fontSize: badgeFontSize,
                        background: printingDocId === doc.id ? '#e2e8f0' : '#f1f5f9',
                        color: printingDocId === doc.id ? '#94a3b8' : '#475569',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        cursor: reprinting && printingDocId === doc.id ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '40px',
                        minHeight: '40px',
                      }}
                      onMouseEnter={(e) => {
                        if (!(reprinting && printingDocId === doc.id)) {
                          e.currentTarget.style.background = '#e2e8f0';
                          e.currentTarget.style.borderColor = '#667eea';
                          e.currentTarget.style.color = '#667eea';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (printingDocId !== doc.id) {
                          e.currentTarget.style.background = '#f1f5f9';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.color = '#475569';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }
                      }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      </svg>
                    </button>
                    {canCancelDocument(doc.billingStatus) && (
                      <button
                        onClick={(e) => handleOpenCancelModal(doc, e)}
                        style={{
                          padding: '0.625rem 1.25rem',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'white',
                          background: '#ef4444',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          minHeight: '40px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#dc2626';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#ef4444';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                    {doc.billingStatus === 'CANCELLED' && canReopenAnnulledOrder(doc) && (
                      <button
                        type="button"
                        onClick={(e) => handleReopenOrder(doc, e)}
                        disabled={reopening && reopeningDocId === doc.id}
                        title="Reaperturar orden: revierte pagos en caja y deja la orden en proceso"
                        style={{
                          padding: '0.625rem 1rem',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'white',
                          background: reopening && reopeningDocId === doc.id ? '#94a3b8' : '#d97706',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: reopening && reopeningDocId === doc.id ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          minHeight: '40px',
                        }}
                        onMouseEnter={(e) => {
                          if (!(reopening && reopeningDocId === doc.id)) {
                            e.currentTarget.style.background = '#b45309';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!(reopening && reopeningDocId === doc.id)) {
                            e.currentTarget.style.background = '#d97706';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }
                        }}
                      >
                        {reopening && reopeningDocId === doc.id ? '…' : 'Reaperturar orden'}
                      </button>
                    )}
                    {doc.billingStatus === 'CANCELLED' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocumentToConvert(doc);
                          setShowConvertModal(true);
                        }}
                        style={{
                          padding: '0.625rem 1rem',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'white',
                          background: '#8b5cf6', // Violeta
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          minHeight: '40px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#7c3aed';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#8b5cf6';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                        title="Convertir a otro documento"
                      >
                        Convertir
                      </button>
                    )}
                    <div style={{ fontSize: '1.375rem', color: '#64748b', marginLeft: '0.25rem' }} aria-hidden="true">
                      {isExpanded ? '▼' : '▶'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Detalles expandidos */}
              {isExpanded && (
                <div style={{ padding: tableCellPadding, background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
                  {/* Items del documento */}
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{
                      fontSize: tableFontSize,
                      fontWeight: 600,
                      color: '#1e293b',
                      marginBottom: '0.75rem'
                    }}>
                      Productos/Servicios
                    </h4>
                    <div style={{
                      background: 'white',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid #e5e7eb'
                    }}>
                      {!isXs ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: tableFontSize }}>
                          <thead>
                            <tr style={{ background: '#f9fafb' }}>
                              <th style={{ padding: tableCellPadding, textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Código</th>
                              <th style={{ padding: tableCellPadding, textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Producto</th>
                              <th style={{ padding: tableCellPadding, textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Cantidad</th>
                              <th style={{ padding: tableCellPadding, textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Precio Unit.</th>
                              <th style={{ padding: tableCellPadding, textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {doc.items.map((item) => (
                              <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: tableCellPadding, color: '#64748b' }}>{item.operationDetail?.product?.code || '-'}</td>
                                <td style={{ padding: tableCellPadding, color: '#1e293b' }}>
                                  {item.operationDetail?.product?.name || '-'}
                                  {item.notes && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{item.notes}</div>}
                                </td>
                                <td style={{ padding: tableCellPadding, textAlign: 'right', color: '#64748b' }}>{item.quantity}</td>
                                <td style={{ padding: tableCellPadding, textAlign: 'right', color: '#64748b' }}>{currencyFormatter.format(item.unitPrice)}</td>
                                <td style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>{currencyFormatter.format(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                              <td colSpan={4} style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 600, color: '#374151' }}>Subtotal:</td>
                              <td style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{currencyFormatter.format(doc.totalAmount - doc.igvAmount)}</td>
                            </tr>
                            {doc.totalDiscount > 0 && (
                              <tr>
                                <td colSpan={4} style={{ padding: tableCellPadding, textAlign: 'right', color: '#64748b' }}>Descuento:</td>
                                <td style={{ padding: tableCellPadding, textAlign: 'right', color: '#64748b' }}>{discountSummary ?? currencyFormatter.format(doc.totalDiscount)}</td>
                              </tr>
                            )}
                            <tr>
                              <td colSpan={4} style={{ padding: tableCellPadding, textAlign: 'right', color: '#64748b' }}>IGV:</td>
                              <td style={{ padding: tableCellPadding, textAlign: 'right', color: '#64748b' }}>{currencyFormatter.format(doc.igvAmount)}</td>
                            </tr>
                            <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                              <td colSpan={4} style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 600, color: '#374151' }}>Total:</td>
                              <td style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 700, color: '#1e293b', fontSize: '1.125rem' }}>{currencyFormatter.format(doc.totalAmount)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {doc.items.map((item) => (
                            <div key={item.id} style={{ padding: '0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>{item.operationDetail?.product?.name}</span>
                                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>{currencyFormatter.format(item.total)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                                <span>{item.quantity} x {currencyFormatter.format(item.unitPrice)}</span>
                                <span>{item.operationDetail?.product?.code}</span>
                              </div>
                            </div>
                          ))}
                          <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                              <span>Subtotal:</span>
                              <span>{currencyFormatter.format(doc.totalAmount - doc.igvAmount)}</span>
                            </div>
                            {doc.totalDiscount > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#b45309' }}>
                                <span>Descuento:</span>
                                <span>{discountSummary ?? currencyFormatter.format(doc.totalDiscount)}</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                              <span>IGV:</span>
                              <span>{currencyFormatter.format(doc.igvAmount)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginTop: '0.25rem', paddingTop: '0.25rem', borderTop: '1px solid #e2e8f0' }}>
                              <span>TOTAL:</span>
                              <span>{currencyFormatter.format(doc.totalAmount)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pagos del documento */}
                  {doc.payments.length > 0 && (
                    <div>
                      <h4 style={{
                        fontSize: tableFontSize,
                        fontWeight: 600,
                        color: '#1e293b',
                        marginBottom: '0.75rem'
                      }}>
                        Pagos
                      </h4>
                      <div style={{
                        background: 'white',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid #e5e7eb'
                      }}>
                        {!isXs ? (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: tableFontSize }}>
                            <thead>
                              <tr style={{ background: '#f9fafb' }}>
                                <th style={{ padding: tableCellPadding, textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                                  Método
                                </th>
                                <th style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                                  Monto
                                </th>
                                <th style={{ padding: tableCellPadding, textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                                  Fecha
                                </th>
                                <th style={{ padding: tableCellPadding, textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                                  Estado
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {doc.payments.map((payment) => {
                                const color = getPaymentMethodColor(payment.paymentMethod);
                                return (
                                  <tr key={payment.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: tableCellPadding }}>
                                      <span
                                        style={{
                                          fontSize: badgeFontSize,
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '4px',
                                          background: color.bg,
                                          color: color.text,
                                          fontWeight: 500
                                        }}
                                      >
                                        {getPaymentMethodName(payment.paymentMethod)}
                                      </span>
                                    </td>
                                    <td style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                                      {currencyFormatter.format(payment.paidAmount)}
                                    </td>
                                    <td style={{ padding: tableCellPadding, color: '#64748b' }}>
                                      {dateFormatter.format(new Date(payment.paymentDate))}
                                    </td>
                                    <td style={{ padding: tableCellPadding, textAlign: 'center' }}>
                                      <span
                                        style={{
                                          fontSize: badgeFontSize,
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '4px',
                                          background: payment.status === 'PAID' ? '#dcfce7' : '#fee2e2',
                                          color: payment.status === 'PAID' ? '#166534' : '#991b1b',
                                          fontWeight: 500
                                        }}
                                      >
                                        {payment.status === 'PAID' ? 'Pagado' : payment.status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {doc.payments.map((payment) => {
                              const color = getPaymentMethodColor(payment.paymentMethod);
                              return (
                                <div key={payment.id} style={{ padding: '0.75rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <span
                                      style={{
                                        fontSize: '0.7rem',
                                        padding: '0.125rem 0.4rem',
                                        borderRadius: '4px',
                                        background: color.bg,
                                        color: color.text,
                                        fontWeight: 600,
                                        width: 'fit-content'
                                      }}
                                    >
                                      {getPaymentMethodName(payment.paymentMethod)}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                      {dateFormatter.format(new Date(payment.paymentDate))}
                                    </span>
                                  </div>
                                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>
                                    {currencyFormatter.format(payment.paidAmount)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notas */}
                  {doc.notes && (
                    <div style={{ marginTop: '1rem', padding: tableCellPadding, background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: tableFontSize, fontWeight: 600, color: '#92400e', marginBottom: '0.5rem' }}>
                        Notas:
                      </div>
                      <div style={{ fontSize: tableFontSize, color: '#78350f' }}>
                        {doc.notes}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer con contador */}
      <div style={{
        marginTop: '1.5rem',
        paddingTop: '1rem',
        borderTop: '1px solid #e5e7eb',
        textAlign: 'center',
        fontSize: tableFontSize,
        color: '#64748b'
      }}>
        Mostrando {filteredDocuments.length} de {localDocuments.length} documento(s)
      </div>

      {/* Modal de cancelación */}
      {showCancelModal && selectedDocument && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => setShowCancelModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: cardPadding,
              maxWidth: isSmallDesktop ? '90%' : isMediumDesktop ? '550px' : '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                fontSize: '2.5rem',
                textAlign: 'center',
                marginBottom: '1rem'
              }}>
                ⚠️
              </div>
              <h3 style={{
                margin: '0 0 0.5rem',
                fontSize: isSmallDesktop ? '1.125rem' : isMediumDesktop ? '1.25rem' : '1.5rem',
                fontWeight: 700,
                color: '#1e293b',
                textAlign: 'center'
              }}>
                Cancelar Documento
              </h3>
              <p style={{
                margin: 0,
                fontSize: inputFontSize,
                color: '#64748b',
                textAlign: 'center',
                lineHeight: '1.5'
              }}>
                {selectedDocument.document.description} {selectedDocument.serial}-{selectedDocument.number}
              </p>
            </div>

            {/* Mensaje de éxito/error */}
            {cancelMessage && (
              <div
                style={{
                  padding: '0.875rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                  background: cancelMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
                  border: `1px solid ${cancelMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
                  color: cancelMessage.type === 'success' ? '#166534' : '#991b1b',
                  fontSize: inputFontSize,
                }}
              >
                {cancelMessage.text}
              </div>
            )}

            {/* Formulario de cancelación */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label
                  htmlFor="cancellationReason"
                  style={{
                    display: 'block',
                    fontSize: inputFontSize,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '0.5rem',
                  }}
                >
                  Motivo de Cancelación *
                </label>
                <select
                  id="cancellationReason"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    fontSize: inputFontSize,
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    background: 'white',
                    cursor: 'pointer',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                >
                  <option value="">Seleccionar motivo</option>
                  {cancellationReasons.map((reason) => (
                    <option key={reason.code} value={reason.code}>
                      {reason.code} - {reason.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="cancellationDescription"
                  style={{
                    display: 'block',
                    fontSize: inputFontSize,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '0.5rem',
                  }}
                >
                  Descripción (Opcional)
                </label>
                <textarea
                  id="cancellationDescription"
                  value={cancellationDescription}
                  onChange={(e) => setCancellationDescription(e.target.value)}
                  placeholder="Ingresa una descripción adicional sobre la cancelación..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    fontSize: inputFontSize,
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setSelectedDocument(null);
                    setCancellationReason('');
                    setCancellationDescription('');
                    setCancelMessage(null);
                  }}
                  disabled={canceling}
                  style={{
                    padding: '0.625rem 1.25rem',
                    fontSize: inputFontSize,
                    fontWeight: 600,
                    color: '#64748b',
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: canceling ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!canceling) {
                      e.currentTarget.style.background = '#e2e8f0';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!canceling) {
                      e.currentTarget.style.background = '#f1f5f9';
                    }
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCancelDocument}
                  disabled={canceling || !cancellationReason}
                  style={{
                    padding: '0.625rem 1.25rem',
                    fontSize: inputFontSize,
                    fontWeight: 600,
                    color: 'white',
                    background: canceling || !cancellationReason
                      ? '#9ca3af'
                      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: canceling || !cancellationReason ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: canceling || !cancellationReason
                      ? 'none'
                      : '0 4px 6px -1px rgba(239, 68, 68, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    if (!canceling && cancellationReason) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 12px -1px rgba(239, 68, 68, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!canceling && cancellationReason) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(239, 68, 68, 0.3)';
                    }
                  }}
                >
                  {canceling ? 'Cancelando...' : 'Confirmar Cancelación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Conversión */}
      {showConvertModal && documentToConvert && (
        <ConvertDocumentModal
          isOpen={showConvertModal}
          onClose={() => {
            setShowConvertModal(false);
            setDocumentToConvert(null);
          }}
          annulledDocument={documentToConvert}
          onSuccess={() => {
            if (onRefetch) onRefetch();
          }}
        />
      )}
    </div>
  );
};

export default ReportSaleList;