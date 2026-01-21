import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { CANCEL_ISSUED_DOCUMENT } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';

interface IssuedDocument {
  id: string;
  serial: string;
  number: string;
  emissionDate: string;
  emissionTime: string;
  totalAmount: number;
  totalDiscount: number;
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

const ReportSaleList: React.FC<ReportSaleListProps> = ({ 
  documents, 
  loading, 
  error,
  isSmallDesktop,
  onRefetch
}) => {
  const { user } = useAuth();
  const [expandedDocument, setExpandedDocument] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<IssuedDocument | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [cancellationDescription, setCancellationDescription] = useState<string>('');
  const [cancelMessage, setCancelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [localDocuments, setLocalDocuments] = useState<IssuedDocument[]>(documents);

  // Actualizar documentos locales cuando cambien los props
  React.useEffect(() => {
    setLocalDocuments(documents);
  }, [documents]);

  // Mutación para cancelar documento
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
  const cardPadding = isSmallDesktop ? '1.25rem' : '1.5rem';
  const tableFontSize = isSmallDesktop ? '0.8125rem' : '0.875rem';
  const tableCellPadding = isSmallDesktop ? '0.625rem' : '0.75rem';
  const badgeFontSize = isSmallDesktop ? '0.6875rem' : '0.75rem';
  const inputFontSize = isSmallDesktop ? '0.8125rem' : '0.875rem';

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
    const basicMatch = 
      doc.serial.toLowerCase().includes(search) ||
      doc.number.toLowerCase().includes(search) ||
      doc.document.description.toLowerCase().includes(search) ||
      (doc.person?.name.toLowerCase().includes(search) || false) ||
      (doc.person?.documentNumber.toLowerCase().includes(search) || false) ||
      doc.user.fullName.toLowerCase().includes(search);
    
    // Buscar en productos de los items
    const productMatch = doc.items.some(item => 
      item.operationDetail?.product?.code.toLowerCase().includes(search) ||
      item.operationDetail?.product?.name.toLowerCase().includes(search)
    );
    
    return basicMatch || productMatch;
  });

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
          padding: cardPadding,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          color: '#64748b'
        }}
      >
        {documents.length === 0
          ? 'No se encontraron documentos en el rango de fechas seleccionado.'
          : 'No se encontraron documentos que coincidan con la búsqueda.'}
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: cardPadding,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* Barra de búsqueda */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Buscar por serie, número, documento, cliente o usuario..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: inputFontSize,
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.target.style.borderColor = '#667eea'}
          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
        />
      </div>

      {/* Lista de documentos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredDocuments.map((doc) => {
          const isExpanded = expandedDocument === doc.id;
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
                  padding: tableCellPadding,
                  background: isExpanded ? '#f8fafc' : 'white',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: badgeFontSize,
                        fontWeight: 600,
                        padding: '0.25rem 0.625rem',
                        borderRadius: '6px',
                        background: '#667eea',
                        color: 'white'
                      }}
                    >
                      {doc.document.code} - {doc.document.description}
                    </span>
                    <span style={{ fontSize: tableFontSize, color: '#64748b' }}>
                      {doc.serial}-{doc.number}
                    </span>
                    {doc.billingStatus && (
                      <span
                        style={{
                          fontSize: badgeFontSize,
                          fontWeight: 600,
                          padding: '0.25rem 0.625rem',
                          borderRadius: '6px',
                          background: getBillingStatusColor(doc.billingStatus).bg,
                          color: getBillingStatusColor(doc.billingStatus).text,
                          border: `1px solid ${getBillingStatusColor(doc.billingStatus).border}`
                        }}
                      >
                        {getBillingStatusName(doc.billingStatus)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: tableFontSize, color: '#64748b' }}>
                    {dateFormatter.format(new Date(`${doc.emissionDate}T${doc.emissionTime}`))}
                  </div>
                  {doc.person && (
                    <div style={{ fontSize: tableFontSize, color: '#64748b', marginTop: '0.25rem' }}>
                      Cliente: {doc.person.name} ({doc.person.documentNumber})
                    </div>
                  )}
                  <div style={{ fontSize: tableFontSize, color: '#64748b', marginTop: '0.25rem' }}>
                    Usuario: {doc.user.fullName}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: isSmallDesktop ? '1.125rem' : '1.25rem',
                    fontWeight: 700,
                    color: '#1e293b',
                    marginBottom: '0.5rem'
                  }}>
                    {currencyFormatter.format(doc.totalAmount)}
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {Array.from(paymentMethodsMap.entries()).map(([method, amount]) => {
                      const color = getPaymentMethodColor(method);
                      return (
                        <span
                          key={method}
                          style={{
                            fontSize: badgeFontSize,
                            padding: '0.125rem 0.5rem',
                            borderRadius: '4px',
                            background: color.bg,
                            color: color.text,
                            fontWeight: 500
                          }}
                        >
                          {getPaymentMethodName(method)}: {currencyFormatter.format(amount)}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {canCancelDocument(doc.billingStatus) && (
                    <button
                      onClick={(e) => handleOpenCancelModal(doc, e)}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: badgeFontSize,
                        fontWeight: 600,
                        color: 'white',
                        background: '#ef4444',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
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
                  <div style={{ fontSize: '1.25rem', color: '#64748b' }}>
                    {isExpanded ? '▼' : '▶'}
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
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: tableFontSize }}>
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            <th style={{ padding: tableCellPadding, textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                              Código
                            </th>
                            <th style={{ padding: tableCellPadding, textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                              Producto
                            </th>
                            <th style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                              Cantidad
                            </th>
                            <th style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                              Precio Unit.
                            </th>
                            <th style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {doc.items.map((item) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: tableCellPadding, color: '#64748b' }}>
                                {item.operationDetail?.product?.code || '-'}
                              </td>
                              <td style={{ padding: tableCellPadding, color: '#1e293b' }}>
                                {item.operationDetail?.product?.name || '-'}
                                {item.notes && (
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                    {item.notes}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: tableCellPadding, textAlign: 'right', color: '#64748b' }}>
                                {item.quantity}
                              </td>
                              <td style={{ padding: tableCellPadding, textAlign: 'right', color: '#64748b' }}>
                                {currencyFormatter.format(item.unitPrice)}
                              </td>
                              <td style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                                {currencyFormatter.format(item.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                            <td colSpan={4} style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                              Subtotal:
                            </td>
                            <td style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                              {currencyFormatter.format(doc.totalAmount - doc.igvAmount)}
                            </td>
                          </tr>
                          {doc.totalDiscount > 0 && (
                            <tr>
                              <td colSpan={4} style={{ padding: tableCellPadding, textAlign: 'right', color: '#64748b' }}>
                                Descuento:
                              </td>
                              <td style={{ padding: tableCellPadding, textAlign: 'right', color: '#64748b' }}>
                                {currencyFormatter.format(doc.totalDiscount)}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td colSpan={4} style={{ padding: tableCellPadding, textAlign: 'right', color: '#64748b' }}>
                              IGV:
                            </td>
                            <td style={{ padding: tableCellPadding, textAlign: 'right', color: '#64748b' }}>
                              {currencyFormatter.format(doc.igvAmount)}
                            </td>
                          </tr>
                          <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                            <td colSpan={4} style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                              Total:
                            </td>
                            <td style={{ padding: tableCellPadding, textAlign: 'right', fontWeight: 700, color: '#1e293b', fontSize: '1.125rem' }}>
                              {currencyFormatter.format(doc.totalAmount)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
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
              maxWidth: isSmallDesktop ? '500px' : '600px',
              width: '100%',
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
                fontSize: isSmallDesktop ? '1.25rem' : '1.5rem',
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
    </div>
  );
};

export default ReportSaleList;