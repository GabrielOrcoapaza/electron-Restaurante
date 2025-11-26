import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import type { Table } from '../../types/table';
import { CREATE_ISSUED_DOCUMENT } from '../../graphql/mutations';
import { GET_DOCUMENTS, GET_CASH_REGISTERS, GET_SERIALS_BY_DOCUMENT, GET_OPERATION_BY_TABLE } from '../../graphql/queries';

type CashPayProps = {
  table: Table | null;
  onBack: () => void;
  onPaymentSuccess?: () => void;
};

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

const CashPay: React.FC<CashPayProps> = ({ table, onBack, onPaymentSuccess }) => {
  const { companyData, user, deviceId } = useAuth();
  const hasSelection = Boolean(table?.id && companyData?.branch.id);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [selectedSerialId, setSelectedSerialId] = useState<string>('');
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [itemAssignments, setItemAssignments] = useState<Record<string, boolean>>({});
  const [modifiedDetails, setModifiedDetails] = useState<any[]>([]);

  const {
    data,
    loading,
    error,
    refetch
  } = useQuery(GET_OPERATION_BY_TABLE, {
    variables: {
      tableId: table?.id || '',
      branchId: companyData?.branch.id || ''
    },
    skip: !hasSelection,
    fetchPolicy: 'network-only'
  });

  // Obtener documentos disponibles
  const { data: documentsData, loading: documentsLoading, error: documentsError } = useQuery(GET_DOCUMENTS, {
    variables: { branchId: companyData?.branch.id || '' },
    skip: !companyData?.branch.id,
    fetchPolicy: 'no-cache', // Cambiar a no-cache para evitar problemas de caché
    notifyOnNetworkStatusChange: true,
    onError: (error) => {
      console.error('❌ Error al cargar documentos:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
    },
    onCompleted: (data) => {
      console.log('✅ Documentos cargados:', data);
      console.log('✅ Documents by branch:', data?.documentsByBranch);
    }
  });

  // Obtener series del documento seleccionado
  const { data: serialsData, loading: serialsLoading } = useQuery(GET_SERIALS_BY_DOCUMENT, {
    variables: { documentId: selectedDocumentId },
    skip: !selectedDocumentId
  });

  // Obtener cajas registradoras
  const { data: cashRegistersData, loading: cashRegistersLoading } = useQuery(GET_CASH_REGISTERS, {
    variables: { branchId: companyData?.branch.id || '' },
    skip: !companyData?.branch.id
  });

  const [createIssuedDocumentMutation] = useMutation(CREATE_ISSUED_DOCUMENT);

  const operation = data?.operationByTable;
  // Filtrar solo documentos y series activos (aunque el backend ya debería filtrarlos)
  const documents = (documentsData?.documentsByBranch || []).filter((doc: any) => doc.isActive !== false);
  const serials = (serialsData?.serialsByDocument || []).filter((ser: any) => ser.isActive !== false);
  const cashRegisters = cashRegistersData?.cashRegistersByBranch || [];

  // Debug: Log para verificar datos
  React.useEffect(() => {
    console.log('📄 Documents Data:', documentsData);
    console.log('📄 Documents:', documents);
    console.log('📄 Documents Loading:', documentsLoading);
    console.log('📄 Documents Error:', documentsError);
    console.log('📄 Branch ID:', companyData?.branch.id);
  }, [documentsData, documents, documentsLoading, documentsError, companyData?.branch.id]);

  if (!table) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
            textAlign: 'center',
            maxWidth: '400px'
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💳</div>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#1a202c',
              marginBottom: '0.75rem'
            }}
          >
            Selecciona una mesa
          </h2>
          <p
            style={{
              fontSize: '0.95rem',
              color: '#4a5568',
              marginBottom: '1.5rem'
            }}
          >
            Elige una mesa desde la vista de mesas para revisar y cobrar su
            orden.
          </p>
          <button
            onClick={onBack}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#667eea',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Ir a mesas
          </button>
        </div>
      </div>
    );
  }

  const igvPercentage = Number(operation?.igvPercentage) || 18;
  
  // Calcular totales basados en los detalles modificados
  const detailsToUse = modifiedDetails.length > 0 ? modifiedDetails : (operation?.details || []);
  const subtotal = detailsToUse.reduce((sum: number, detail: any) => {
    const quantity = Number(detail.quantity) || 0;
    const unitPrice = Number(detail.unitPrice) || 0;
    return sum + (quantity * unitPrice);
  }, 0);
  const igvAmount = subtotal * (igvPercentage / 100);
  const total = subtotal + igvAmount;

  // Inicializar valores por defecto cuando se cargan los datos
  React.useEffect(() => {
    if (documents.length > 0 && !selectedDocumentId) {
      console.log('📄 Inicializando documento por defecto:', documents[0]);
      setSelectedDocumentId(documents[0].id);
    }
    if (cashRegisters.length > 0 && !selectedCashRegisterId) {
      setSelectedCashRegisterId(cashRegisters[0].id);
    }
  }, [documents, cashRegisters, selectedDocumentId, selectedCashRegisterId]);


  // Inicializar serie cuando se carga un documento o cambia el documento seleccionado
  React.useEffect(() => {
    if (serials.length > 0 && !selectedSerialId) {
      setSelectedSerialId(serials[0].id);
    } else if (serials.length === 0) {
      setSelectedSerialId('');
    }
  }, [serials, selectedSerialId]);

  // Resetear serie cuando cambia el documento
  React.useEffect(() => {
    setSelectedSerialId('');
  }, [selectedDocumentId]);

  // Inicializar detalles modificados cuando se carga la operación
  React.useEffect(() => {
    if (operation?.details) {
      setModifiedDetails([...operation.details]);
    }
  }, [operation?.details]);

  const handleSplitBill = () => {
    setIsSplitMode(!isSplitMode);
    if (!isSplitMode) {
      // No inicializar asignaciones, el usuario las hará manualmente
    } else {
      // Limpiar asignaciones y restaurar detalles originales cuando se desactiva
      setItemAssignments({});
      if (operation?.details) {
        setModifiedDetails([...operation.details]);
      }
    }
  };

  const handleSplitItem = (detailId: string) => {
    setModifiedDetails(prevDetails => {
      const detailIndex = prevDetails.findIndex((d: any) => d.id === detailId);
      if (detailIndex === -1) return prevDetails;

      const detail = prevDetails[detailIndex];
      const quantity = Number(detail.quantity) || 0;

      // Solo dividir si la cantidad es mayor a 1
      if (quantity <= 1) {
        return prevDetails;
      }

      // Verificar si ya está dividido
      const isAlreadySplit = itemAssignments[detailId];

      if (isAlreadySplit) {
        // Si ya está dividido, revertir: encontrar y eliminar la copia, restaurar cantidad original
        const originalDetail = operation?.details?.find((d: any) => d.id === detailId);
        if (originalDetail) {
          const newDetails = [...prevDetails];
          // Eliminar todas las copias de este detalle (las que tienen id que empieza con detailId-split)
          const filteredDetails = newDetails.filter((d: any) => {
            if (d.id === detailId) {
              // Restaurar cantidad original
              d.quantity = originalDetail.quantity;
              return true;
            }
            // Eliminar copias (identificadas por tener un id que incluye el detailId original)
            return !d.id?.includes(`${detailId}-split`);
          });
          return filteredDetails;
        }
        return prevDetails;
      } else {
        // Dividir: reducir cantidad del original y crear copia con cantidad 1
        const newDetails = [...prevDetails];
        const originalDetail = { ...detail };
        
        // Reducir cantidad del original
        newDetails[detailIndex] = {
          ...originalDetail,
          quantity: quantity - 1,
          total: (quantity - 1) * Number(originalDetail.unitPrice)
        };

        // Crear copia con cantidad 1
        const splitDetail = {
          ...originalDetail,
          id: `${detailId}-split-${Date.now()}`, // ID único para la copia
          quantity: 1,
          total: Number(originalDetail.unitPrice)
        };

        // Insertar la copia después del original
        newDetails.splice(detailIndex + 1, 0, splitDetail);
        return newDetails;
      }
    });

    // Actualizar asignaciones
    setItemAssignments(prev => {
      if (prev[detailId]) {
        const newAssignments = { ...prev };
        delete newAssignments[detailId];
        return newAssignments;
      } else {
        return {
          ...prev,
          [detailId]: true
        };
      }
    });
  };

  const handleProcessPayment = async () => {
    if (!operation || !selectedDocumentId || !selectedSerialId || !user?.id) {
      setPaymentError('Por favor completa todos los campos requeridos');
      return;
    }
    
    // Si no hay caja seleccionada, usar la primera disponible
    const cashRegisterIdToUse = selectedCashRegisterId || (cashRegisters.length > 0 ? cashRegisters[0].id : null);
    
    if (!cashRegisterIdToUse) {
      setPaymentError('No hay cajas registradoras disponibles');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const now = new Date();
      const emissionDate = now.toISOString().split('T')[0];
      const emissionTime = now.toTimeString().split(' ')[0].substring(0, 5);

      // Preparar items del documento usando los detalles modificados
      // Agrupar detalles originales y sus copias
      const detailsToProcess = modifiedDetails.length > 0 ? modifiedDetails : (operation.details || []);
      
      // Agrupar por ID original (sin el sufijo -split)
      const groupedDetails: Record<string, any[]> = {};
      detailsToProcess.forEach((detail: any) => {
        const originalId = detail.id?.includes('-split') 
          ? detail.id.split('-split')[0] 
          : detail.id;
        
        if (!groupedDetails[originalId]) {
          groupedDetails[originalId] = [];
        }
        groupedDetails[originalId].push(detail);
      });
      
      // Crear items agrupados
      const items = Object.entries(groupedDetails).map(([originalId, details]) => {
        // Sumar cantidades de todos los detalles (original + copias)
        const totalQuantity = details.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
        const firstDetail = details[0];
        
        return {
          operationDetailId: originalId,
          quantity: totalQuantity,
          unitValue: Number(firstDetail.unitPrice) || 0,
          unitPrice: Number(firstDetail.unitPrice) || 0,
          discount: 0,
          notes: firstDetail.notes || ''
        };
      });

      // Preparar pagos
      const payments = [{
        cashRegisterId: cashRegisterIdToUse,
        paymentType: 'CASH',
        paymentMethod: paymentMethod,
        transactionType: 'INCOME',
        totalAmount: total,
        paidAmount: total,
        paymentDate: now.toISOString(),
        dueDate: null,
        referenceNumber: referenceNumber || null,
        notes: null
      }];

      const selectedSerial = serials.find((ser: any) => ser.id === selectedSerialId);
      const serial = selectedSerial?.serial || '';

      const variables = {
        operationId: operation.id,
        branchId: companyData?.branch.id,
        documentId: selectedDocumentId,
        serial: serial,
        personId: null,
        userId: user.id,
        emissionDate: emissionDate,
        emissionTime: emissionTime,
        currency: 'PEN',
        exchangeRate: 1.0,
        itemsTotalDiscount: 0.0,
        globalDiscount: 0.0,
        globalDiscountPercent: 0.0,
        totalDiscount: 0.0,
        igvPercent: igvPercentage,
        igvAmount: igvAmount,
        totalTaxable: subtotal,
        totalUnaffected: 0.0,
        totalExempt: 0.0,
        totalFree: 0.0,
        totalAmount: total,
        items: items,
        payments: payments,
        notes: null,
        tableId: table?.id || null,
        deviceId: deviceId || null,
        printerId: null
      };

      const result = await createIssuedDocumentMutation({
        variables
      });

      if (result.data?.createIssuedDocument?.success) {
        // Refetch la operación para actualizar el estado
        await refetch();
        // Llamar callback de éxito si existe
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
        // Si la mesa fue liberada, volver a la vista de mesas
        if (result.data?.createIssuedDocument?.wasTableFreed) {
          setTimeout(() => {
            onBack();
          }, 2000);
        }
        // Limpiar errores
        setPaymentError(null);
      } else {
        setPaymentError(result.data?.createIssuedDocument?.message || 'Error al procesar el pago');
      }
    } catch (err: any) {
      console.error('Error procesando pago:', err);
      setPaymentError(err.message || 'Error al procesar el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        background: 'linear-gradient(160deg, #f0f4ff 0%, #f9fafb 45%, #ffffff 100%)',
        padding: '1.5rem',
        borderRadius: '18px',
        boxShadow: '0 25px 50px -12px rgba(15,23,42,0.18)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: '260px',
          height: '260px',
          background: 'radial-gradient(circle at center, rgba(102,126,234,0.25), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-80px',
          left: '-80px',
          width: '220px',
          height: '220px',
          background: 'radial-gradient(circle at center, rgba(72,219,251,0.18), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0
        }}
      />

      <div
        style={{
          background: 'linear-gradient(135deg, rgba(102,126,234,0.95), rgba(118,75,162,0.92))',
          borderRadius: '20px',
          padding: '2rem 2.5rem',
          color: 'white',
          boxShadow: '0 20px 35px rgba(102,126,234,0.3)',
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(120deg, rgba(255,255,255,0.09), rgba(255,255,255,0))',
            pointerEvents: 'none'
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.25rem',
            flexWrap: 'wrap',
            position: 'relative',
            zIndex: 1
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.85)',
                padding: '0.35rem 0.9rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 600
              }}
            >
              💳 Caja Activa
            </span>
            <h2
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                margin: 0,
                textShadow: '0 6px 18px rgba(0,0,0,0.20)'
              }}
            >
              {table.name}
            </h2>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                fontSize: '0.95rem',
                color: 'rgba(255,255,255,0.85)'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                🪑 <strong>{table.capacity} plazas</strong>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                🕒 {operation?.operationDate ? new Date(operation.operationDate).toLocaleString() : 'Sin horario'}
              </span>
            </div>
            {operation?.order && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#fefcbf'
                }}
              >
                🔖 Orden #{operation.order}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '0.6rem 1.1rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(6px)',
                fontWeight: 600,
                fontSize: '0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              Estado:
              <span
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  color: 'white',
                  fontWeight: 700
                }}
              >
                {table.status}
              </span>
            </span>
            <button
              onClick={refetch}
              disabled={!hasSelection || loading}
              style={{
                padding: '0.85rem 1.45rem',
                borderRadius: '999px',
                border: 'none',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.75))',
                color: '#4c51bf',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '0.92rem',
                boxShadow: '0 12px 24px rgba(15,23,42,0.18)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                opacity: loading ? 0.7 : 1
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 16px 28px rgba(15,23,42,0.22)';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(15,23,42,0.18)';
              }}
            >
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
            <button
              onClick={onBack}
              style={{
                padding: '0.85rem 1.45rem',
                borderRadius: '999px',
                border: 'none',
                background: 'rgba(255,255,255,0.12)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.92rem',
                boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 16px 28px rgba(0,0,0,0.18)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
              }}
            >
              ← Volver
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: '20px',
          padding: '2rem',
          border: '1px solid rgba(226,232,240,0.8)',
          boxShadow: '0 24px 40px -12px rgba(15,23,42,0.15)',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1.15rem',
              fontWeight: 600,
              color: '#1a202c'
            }}
          >
            Detalle de la orden
          </h3>
          {operation?.status && (
            <span
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '12px',
                backgroundColor: 'rgba(102,126,234,0.12)',
                border: '1px solid rgba(102,126,234,0.35)',
                color: '#434190',
                fontSize: '0.88rem',
                fontWeight: 600,
                boxShadow: '0 10px 18px rgba(102,126,234,0.15)'
              }}
            >
              Estado de orden: {operation.status}
            </span>
          )}
        </div>

        {error && (
          <div
            style={{
              backgroundColor: '#fed7d7',
              border: '1px solid #feb2b2',
              color: '#742a2a',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.95rem'
            }}
          >
            Error al cargar la orden: {error.message}
          </div>
        )}

        {loading && (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#4a5568'
            }}
          >
            Cargando orden...
          </div>
        )}

        {!loading && !error && !operation && (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#4a5568'
            }}
          >
            No se encontró una orden activa para esta mesa.
          </div>
        )}

        {operation && (
          <>
            <div
              style={{
                display: 'flex',
                gap: '2rem',
                alignItems: 'flex-start'
              }}
            >
              {/* Tabla de productos */}
              <div
                style={{
                  flex: '1 1 60%',
                  border: '1px solid rgba(226,232,240,0.9)',
                  borderRadius: '18px',
                  overflow: 'hidden',
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95))',
                  boxShadow: '0 18px 28px -14px rgba(15,23,42,0.22)'
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isSplitMode ? '1.2fr 0.4fr 0.6fr 0.6fr 1fr' : '1.2fr 0.4fr 0.6fr 0.6fr',
                    background: 'linear-gradient(135deg, rgba(102,126,234,0.12), rgba(129,140,248,0.12))',
                    padding: '0.9rem 1.2rem',
                    fontWeight: 700,
                    color: '#2d3748',
                    fontSize: '0.92rem',
                    letterSpacing: '0.01em'
                  }}
                >
                  <span>Producto</span>
                  <span style={{ textAlign: 'center' }}>Cant.</span>
                  <span style={{ textAlign: 'right' }}>P. Unit.</span>
                  <span style={{ textAlign: 'right' }}>Total</span>
                  {isSplitMode && <span style={{ textAlign: 'center' }}>Dividir</span>}
                </div>

                {(detailsToUse || []).map((detail: any, index: number) => {
                  const quantity = Number(detail.quantity) || 0;
                  const unitPrice = Number(detail.unitPrice) || 0;
                  const lineTotal =
                    Number(detail.total) || unitPrice * quantity || 0;

                  const isEvenRow = index % 2 === 0;

                  return (
                    <div
                      key={detail.id || `${detail.productId}-${detail.productCode}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isSplitMode ? '1.2fr 0.4fr 0.6fr 0.6fr 1fr' : '1.2fr 0.4fr 0.6fr 0.6fr',
                        padding: '1rem 1.2rem',
                        fontSize: '0.9rem',
                        alignItems: 'center',
                        color: '#1a202c',
                        backgroundColor: isEvenRow ? 'rgba(247,250,252,0.85)' : 'rgba(255,255,255,0.92)',
                        borderTop: '1px solid rgba(226,232,240,0.7)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          {detail.productName || 'Producto'}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                          {detail.productCode && (
                            <span
                              style={{
                                backgroundColor: 'rgba(237,242,247,0.9)',
                                color: '#4a5568',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '999px',
                                fontWeight: 600
                              }}
                            >
                              Código {detail.productCode}
                            </span>
                          )}
                          {detail.notes && (
                            <span
                              style={{
                                backgroundColor: 'rgba(255,255,255,0.85)',
                                border: '1px dashed rgba(102,126,234,0.5)',
                                color: '#434190',
                                padding: '0.3rem 0.55rem',
                                borderRadius: '10px'
                              }}
                            >
                              Nota: {detail.notes}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        style={{
                          textAlign: 'center',
                          fontWeight: 700,
                          color: '#4c51bf',
                          fontSize: '1.05rem'
                        }}
                      >
                        {quantity}
                      </span>
                      <span
                        style={{
                          textAlign: 'right',
                          color: '#2d3748'
                        }}
                      >
                        {currencyFormatter.format(unitPrice)}
                      </span>
                      <span
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '1.05rem',
                          color: '#1a202c'
                        }}
                      >
                        {currencyFormatter.format(lineTotal)}
                      </span>
                      {isSplitMode && !detail.id?.includes('-split') && quantity > 1 && (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}
                        >
                          <button
                            onClick={() => handleSplitItem(detail.id)}
                            style={{
                              padding: '0.5rem 1rem',
                              borderRadius: '8px',
                              border: 'none',
                              background: itemAssignments[detail.id]
                                ? 'linear-gradient(130deg, #a78bfa, #8b5cf6)'
                                : 'rgba(139, 92, 246, 0.15)',
                              color: itemAssignments[detail.id] ? 'white' : '#8b5cf6',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                            onMouseOver={(e) => {
                              if (!itemAssignments[detail.id]) {
                                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.25)';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (!itemAssignments[detail.id]) {
                                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                              }
                            }}
                          >
                            {itemAssignments[detail.id] ? '✓ Dividido' : '✂️ Dividir'}
                          </button>
                        </div>
                      )}
                      {isSplitMode && (detail.id?.includes('-split') || quantity <= 1) && (
                        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem' }}>
                          {detail.id?.includes('-split') ? 'Copia' : '—'}
                        </div>
                      )}
                    </div>
                  );
                })}

                {detailsToUse?.length === 0 && (
                  <div
                    style={{
                      padding: '1.75rem',
                      textAlign: 'center',
                      color: '#4a5568'
                    }}
                  >
                    No hay ítems registrados en esta orden.
                  </div>
                )}
              </div>

              {/* Selectores de Documento, Serie, Caja Registradora y Método de Pago */}
              <div
                style={{
                  flex: '1 1 40%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem'
                }}
              >
                {/* Documento */}
                <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#2d3748',
                    marginBottom: '0.4rem'
                  }}
                >
                  Documento *
                </label>
                {documentsError && (
                  <div
                    style={{
                      backgroundColor: '#fed7d7',
                      border: '1px solid #feb2b2',
                      color: '#742a2a',
                      padding: '0.5rem',
                      borderRadius: '8px',
                      marginBottom: '0.4rem',
                      fontSize: '0.8rem'
                    }}
                  >
                    Error al cargar documentos: {documentsError.message}
                  </div>
                )}
                <select
                  value={selectedDocumentId}
                  onChange={(e) => setSelectedDocumentId(e.target.value)}
                  disabled={documentsLoading}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e0',
                    fontSize: '0.85rem',
                    backgroundColor: 'white',
                    cursor: documentsLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {documentsLoading ? (
                    <option value="">Cargando documentos...</option>
                  ) : documentsError ? (
                    <option value="">Error al cargar documentos</option>
                  ) : documents.length === 0 ? (
                    <option value="">No hay documentos disponibles</option>
                  ) : (
                    <>
                      <option value="">Seleccione un documento</option>
                      {documents.map((doc: any) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.code || 'Sin código'} - {doc.description || 'Sin descripción'}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Serie */}
              {selectedDocumentId && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#2d3748',
                      marginBottom: '0.4rem'
                    }}
                  >
                    Serie *
                  </label>
                  <select
                    value={selectedSerialId}
                    onChange={(e) => setSelectedSerialId(e.target.value)}
                    disabled={serialsLoading || !selectedDocumentId}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e0',
                      fontSize: '0.85rem',
                      backgroundColor: 'white',
                      cursor: serialsLoading || !selectedDocumentId ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {serialsLoading ? (
                      <option value="">Cargando series...</option>
                    ) : serials.length === 0 ? (
                      <option value="">No hay series disponibles para este documento</option>
                    ) : (
                      <>
                        <option value="">Seleccione una serie</option>
                        {serials.map((ser: any) => (
                          <option key={ser.id} value={ser.id}>
                            {ser.serial || 'Sin serie'}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              )}

              {/* Método de Pago */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#2d3748',
                    marginBottom: '0.4rem'
                  }}
                >
                  Método de Pago *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  disabled={isProcessing}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e0',
                    fontSize: '0.85rem',
                    backgroundColor: 'white',
                    cursor: isProcessing ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="CASH">Efectivo</option>
                  <option value="YAPE">Yape</option>
                  <option value="PLIN">Plin</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia Bancaria</option>
                </select>
              </div>

              {/* Número de Referencia (para Yape, Plin, etc.) */}
              {(paymentMethod === 'YAPE' || paymentMethod === 'PLIN' || paymentMethod === 'TRANSFER') && (
                <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#2d3748',
                    marginBottom: '0.4rem'
                  }}
                >
                  Número de Operación
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  disabled={isProcessing}
                  placeholder="Ingrese el número de operación"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e0',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
              )}

              {/* Resumen de Totales */}
              <div
                style={{
                  marginTop: '1rem',
                  borderRadius: '18px',
                  padding: '1.5rem',
                  background: 'linear-gradient(145deg, rgba(102,126,234,0.16), rgba(79,209,197,0.16))',
                  border: '1px solid rgba(102,126,234,0.28)',
                  boxShadow: '0 22px 35px -15px rgba(79,209,197,0.35)',
                  backdropFilter: 'blur(14px)',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                    color: '#2d3748',
                    fontSize: '0.92rem',
                    letterSpacing: '0.01em'
                  }}
                >
                  <span>Subtotal</span>
                  <span>{currencyFormatter.format(subtotal)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                    color: '#2d3748',
                    fontSize: '0.92rem',
                    letterSpacing: '0.01em'
                  }}
                >
                  <span>
                    IGV ({operation.igvPercentage ? `${operation.igvPercentage}%` : '—'})
                  </span>
                  <span>{currencyFormatter.format(igvAmount)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#1a202c',
                    fontWeight: 700,
                    fontSize: '1.35rem',
                    marginTop: '1rem',
                    alignItems: 'center'
                  }}
                >
                  <span>Total</span>
                  <span>{currencyFormatter.format(total)}</span>
                </div>
                <button
                  onClick={handleSplitBill}
                  disabled={!operation || operation.status === 'COMPLETED' || !operation.details || operation.details.length === 0 || isProcessing}
                  style={{
                    width: '100%',
                    marginTop: '1.35rem',
                    padding: '0.85rem 1.25rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: operation?.status === 'COMPLETED' || !operation?.details || operation.details.length === 0
                      ? '#cbd5e0' 
                      : isSplitMode
                      ? 'linear-gradient(130deg, #f59e0b, #d97706)'
                      : 'linear-gradient(130deg, #a78bfa, #8b5cf6)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: operation?.status === 'COMPLETED' || !operation?.details || operation.details.length === 0 || isProcessing ? 'not-allowed' : 'pointer',
                    boxShadow: isSplitMode 
                      ? '0 12px 24px -8px rgba(245, 158, 11, 0.4)'
                      : '0 12px 24px -8px rgba(139, 92, 246, 0.4)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    opacity: operation?.status === 'COMPLETED' || !operation?.details || operation.details.length === 0 ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseOver={(e) => {
                    if (operation?.status !== 'COMPLETED' && operation?.details && operation.details.length > 0 && !isProcessing) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = isSplitMode
                        ? '0 16px 28px -10px rgba(245, 158, 11, 0.5)'
                        : '0 16px 28px -10px rgba(139, 92, 246, 0.5)';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = isSplitMode
                      ? '0 12px 24px -8px rgba(245, 158, 11, 0.4)'
                      : '0 12px 24px -8px rgba(139, 92, 246, 0.4)';
                  }}
                >
                  {isSplitMode ? '✓ Finalizar División' : '✂️ Dividir Cuenta'}
                </button>
                <button
                  onClick={handleProcessPayment}
                  disabled={!operation || operation.status === 'COMPLETED' || !selectedDocumentId || !selectedSerialId || isProcessing}
                  style={{
                    width: '100%',
                    marginTop: '0.75rem',
                    padding: '0.95rem 1.25rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: operation?.status === 'COMPLETED' || !selectedDocumentId || !selectedSerialId
                      ? '#cbd5e0' 
                      : 'linear-gradient(130deg, #4fd1c5, #63b3ed)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: operation?.status === 'COMPLETED' || !selectedDocumentId || !selectedSerialId || isProcessing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 16px 28px -12px rgba(79,209,197,0.55)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    opacity: operation?.status === 'COMPLETED' || !selectedDocumentId || !selectedSerialId ? 0.6 : 1
                  }}
                  onMouseOver={(e) => {
                    if (operation?.status !== 'COMPLETED' && selectedDocumentId && selectedSerialId && !isProcessing) {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 20px 32px -10px rgba(79,209,197,0.6)';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 16px 28px -12px rgba(79,209,197,0.55)';
                  }}
                >
                  {isProcessing ? 'Procesando...' : operation?.status === 'COMPLETED' ? 'Orden ya pagada' : 'Procesar pago'}
                </button>
                {paymentError && (
                  <div
                    style={{
                      marginTop: '1rem',
                      backgroundColor: '#fed7d7',
                      border: '1px solid #feb2b2',
                      color: '#742a2a',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem'
                    }}
                  >
                    {paymentError}
                  </div>
                )}
              </div>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
};

export default CashPay;

