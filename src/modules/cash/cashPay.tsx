import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../context/WebSocketContext';
import { useResponsive } from '../../hooks/useResponsive';
import type { Table } from '../../types/table';
import { CREATE_ISSUED_DOCUMENT, CHANGE_OPERATION_TABLE, CHANGE_OPERATION_USER, TRANSFER_ITEMS, CANCEL_OPERATION_DETAIL, UPDATE_TABLE_STATUS, CANCEL_OPERATION, PRINT_PRECUENTA, PRINT_PARTIAL_PRECUENTA } from '../../graphql/mutations';
import { GET_DOCUMENTS, GET_CASH_REGISTERS, GET_SERIALS_BY_DOCUMENT, GET_OPERATION_BY_TABLE, GET_FLOORS_BY_BRANCH, GET_TABLES_BY_FLOOR, GET_PERSONS_BY_BRANCH } from '../../graphql/queries';
import CreateClient from '../user/createClient';

type CashPayProps = {
  table: Table | null;
  onBack: () => void;
  onPaymentSuccess?: () => void;
  onTableChange?: (newTable: Table) => void;
};

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

const CashPay: React.FC<CashPayProps> = ({ table, onBack, onPaymentSuccess, onTableChange }) => {
  const { companyData, user, deviceId, getMacAddress, updateTableInContext } = useAuth();
  const { sendMessage, subscribe } = useWebSocket();
  const { breakpoint } = useResponsive();
  
  // Solo para diferentes tamaños de pantalla de PC (desktop)
  // lg: 1024px-1279px, xl: 1280px-1535px, 2xl: >=1536px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  const isMediumDesktop = breakpoint === 'xl'; // 1280px - 1535px
  
  // Función para verificar si el usuario puede acceder a una mesa específica
  const canAccessTable = (tableItem: any): { canAccess: boolean; reason?: string } => {
    // Los cajeros siempre pueden acceder (para procesar pagos)
    if (user?.role?.toUpperCase() === 'CASHIER') {
      return { canAccess: true };
    }

    // Si la mesa no está ocupada, cualquier usuario puede acceder
    if (!tableItem.currentOperationId || !tableItem.occupiedById) {
      return { canAccess: true };
    }

    // Si la mesa está ocupada, verificar el modo multi-waiter
    const isMultiWaiterEnabled = companyData?.branch?.isMultiWaiterEnabled || false;

    // Si multi-waiter está habilitado, cualquier usuario puede acceder
    if (isMultiWaiterEnabled) {
      return { canAccess: true };
    }

    // Si multi-waiter está deshabilitado, solo el usuario que creó la orden puede acceder
    const tableOccupiedById = String(tableItem.occupiedById);
    const currentUserId = String(user?.id);

    if (tableOccupiedById === currentUserId) {
      return { canAccess: true };
    }

    // El usuario no es el que creó la orden
    return { 
      canAccess: false, 
      reason: `Esta mesa está siendo atendida por ${tableItem.userName || 'otro usuario'}.` 
    };
  };
  const hasSelection = Boolean(table?.id && companyData?.branch.id);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [selectedSerialId, setSelectedSerialId] = useState<string>('');
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  
  // Estado para múltiples pagos
  type Payment = {
    id: string;
    method: string;
    amount: number;
    referenceNumber: string;
  };
  const [payments, setPayments] = useState<Payment[]>([
    { id: '1', method: 'CASH', amount: 0, referenceNumber: '' }
  ]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  // ⚠️ Ref para prevenir dobles clics (más confiable que solo el estado)
  const isProcessingRef = useRef(false);
  const [itemAssignments, setItemAssignments] = useState<Record<string, boolean>>({});
  const [modifiedDetails, setModifiedDetails] = useState<any[]>([]);
  const [showChangeTableModal, setShowChangeTableModal] = useState(false);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [showChangeUserModal, setShowChangeUserModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [showTransferPlatesModal, setShowTransferPlatesModal] = useState(false);
  const [selectedTransferFloorId, setSelectedTransferFloorId] = useState<string>('');
  const [selectedTransferTableId, setSelectedTransferTableId] = useState<string>('');
  const [showCancelOperationModal, setShowCancelOperationModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState<string>('');

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
  const { data: cashRegistersData } = useQuery(GET_CASH_REGISTERS, {
    variables: { branchId: companyData?.branch.id || '' },
    skip: !companyData?.branch.id
  });

  // Obtener pisos para el modal de cambio de mesa
  const { data: floorsData, loading: floorsLoading } = useQuery(GET_FLOORS_BY_BRANCH, {
    variables: { branchId: companyData?.branch.id || '' },
    skip: !companyData?.branch.id || !showChangeTableModal
  });

  // Obtener mesas del piso seleccionado
  const { data: tablesData, loading: tablesLoading } = useQuery(GET_TABLES_BY_FLOOR, {
    variables: { floorId: selectedFloorId },
    skip: !selectedFloorId
  });

  // Obtener pisos para el modal de transferir platos
  const { data: transferFloorsData, loading: transferFloorsLoading } = useQuery(GET_FLOORS_BY_BRANCH, {
    variables: { branchId: companyData?.branch.id || '' },
    skip: !companyData?.branch.id || !showTransferPlatesModal
  });

  // Obtener mesas del piso seleccionado para transferir
  const { data: transferTablesData, loading: transferTablesLoading } = useQuery(GET_TABLES_BY_FLOOR, {
    variables: { floorId: selectedTransferFloorId },
    skip: !selectedTransferFloorId
  });

  // Obtener clientes (personas con isCustomer=true)
  const { data: clientsData, loading: clientsLoading, refetch: refetchClients } = useQuery(GET_PERSONS_BY_BRANCH, {
    variables: { branchId: companyData?.branch.id || '' },
    skip: !companyData?.branch.id
  });

  const [createIssuedDocumentMutation] = useMutation(CREATE_ISSUED_DOCUMENT);
  const [changeOperationTableMutation] = useMutation(CHANGE_OPERATION_TABLE);
  const [changeOperationUserMutation] = useMutation(CHANGE_OPERATION_USER);
  const [transferItemsMutation] = useMutation(TRANSFER_ITEMS);
  const [cancelOperationDetailMutation] = useMutation(CANCEL_OPERATION_DETAIL);
  const [updateTableStatusMutation] = useMutation(UPDATE_TABLE_STATUS);
  const [cancelOperationMutation] = useMutation(CANCEL_OPERATION);
  const [printPrecuentaMutation] = useMutation(PRINT_PRECUENTA);
  const [printPartialPrecuentaMutation] = useMutation(PRINT_PARTIAL_PRECUENTA);

  // Función auxiliar para enviar notificación WebSocket de actualización de mesa
  const notifyTableUpdate = (tableId: string, status: string, currentOperationId?: string | number | null, occupiedById?: string | number | null, waiterName?: string | null) => {
    // Pequeño delay para asegurar que la base de datos se haya actualizado primero
    setTimeout(() => {
      // Enviar actualización específica de la mesa
      sendMessage({
        type: 'table_status_update',
        table_id: tableId,
        status: status,
        current_operation_id: currentOperationId || null,
        occupied_by_user_id: occupiedById || null,
        waiter_name: waiterName || null
      });
      console.log(`📡 Notificación WebSocket enviada para mesa ${tableId}: ${status}`);
      
      // También solicitar un snapshot completo de todas las mesas para asegurar sincronización
      setTimeout(() => {
        sendMessage({
          type: 'table_update_request'
        });
        console.log('📡 Solicitud de snapshot de mesas enviada');
      }, 500);
    }, 300);
  };

  const operation = data?.operationByTable;
  
  // Suscribirse a eventos WebSocket
  useEffect(() => {
    const unsubscribeOperationCancelled = subscribe('operation_cancelled', (message: any) => {
      console.log('🚫 Operación cancelada recibida:', message);
      // Si la operación cancelada es la actual, refetch
      if (message.operation_id === operation?.id) {
        refetch();
      }
    });

    const unsubscribeOperationStatusUpdate = subscribe('operation_status_update', (message: any) => {
      console.log('🔄 Actualización de estado de operación:', message);
      // Si la operación actualizada es la actual, refetch
      if (message.operation_id === operation?.id) {
        refetch();
      }
    });

    return () => {
      unsubscribeOperationCancelled();
      unsubscribeOperationStatusUpdate();
    };
  }, [subscribe, operation?.id, refetch]);
  // Filtrar solo documentos y series activos (aunque el backend ya debería filtrarlos)
  const documents = (documentsData?.documentsByBranch || []).filter((doc: any) => doc.isActive !== false);
  const serials = (serialsData?.serialsByDocument || []).filter((ser: any) => ser.isActive !== false);
  
  // Filtrar clientes (personas con isCustomer=true, no proveedores) y activos
  const allClients = (clientsData?.personsByBranch || []).filter((person: any) => 
    !person.isSupplier && person.isActive !== false
  );
  
  // Filtrar clientes por término de búsqueda
  const filteredClients = allClients.filter((client: any) => {
    if (!clientSearchTerm) return true;
    const search = clientSearchTerm.toLowerCase();
    const name = (client.name || '').toLowerCase();
    const documentNumber = (client.documentNumber || '').toLowerCase();
    return name.includes(search) || documentNumber.includes(search);
  });
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

  // Usar el IGV de la sucursal obtenido en el login de empresa
  const igvPercentage = Number(companyData?.branch?.igvPercentage) || 10;
  
  // Log para verificar que se está usando el IGV de la sucursal
  React.useEffect(() => {
    if (companyData?.branch?.igvPercentage) {
      console.log('✅ IGV de la sucursal:', companyData.branch.igvPercentage, '%');
    } else {
      console.warn('⚠️ IGV de la sucursal no encontrado, usando valor por defecto: 10%');
    }
  }, [companyData?.branch?.igvPercentage]);
  
  // Función helper para obtener información de facturación desde sessionStorage
  const getFacturedItemsFromStorage = (operationId: string): Map<string, number> => {
    try {
      const storageKey = `factured_items_${operationId}`;
      const storedData = sessionStorage.getItem(storageKey);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        const map = new Map<string, number>();
        Object.entries(parsed).forEach(([key, value]) => {
          map.set(String(key), Number(value) || 0);
        });
        return map;
      }
    } catch (error) {
      console.warn('⚠️ Error leyendo facturación de sessionStorage:', error);
    }
    return new Map<string, number>();
  };

  // Función helper para guardar información de facturación en sessionStorage
  const saveFacturedItemsToStorage = (operationId: string, facturedItemsMap: Map<string, number>) => {
    try {
      const storageKey = `factured_items_${operationId}`;
      const existingData = getFacturedItemsFromStorage(operationId);
      
      // Combinar con datos existentes (sumar cantidades si el mismo detalle se facturó múltiples veces)
      facturedItemsMap.forEach((quantity, detailId) => {
        const existingQty = existingData.get(detailId) || 0;
        existingData.set(detailId, existingQty + quantity);
      });
      
      // Convertir Map a objeto para guardar en sessionStorage
      const dataToStore: Record<string, number> = {};
      existingData.forEach((value, key) => {
        dataToStore[key] = value;
      });
      
      sessionStorage.setItem(storageKey, JSON.stringify(dataToStore));
      console.log('💾 Facturación guardada en sessionStorage:', dataToStore);
    } catch (error) {
      console.warn('⚠️ Error guardando facturación en sessionStorage:', error);
    }
  };

  // Función helper para filtrar productos cancelados y completamente facturados
  const filterCanceledDetails = (details: any[], operationId?: string) => {
    if (!details || !Array.isArray(details)) return [];
    
    // Obtener información de facturación desde sessionStorage si tenemos operationId
    const facturedItemsMap = operationId ? getFacturedItemsFromStorage(operationId) : new Map<string, number>();
    
    return details.filter((detail: any) => {
      // 1. Filtrar productos cancelados (isCanceled puede ser true, "true", 1, etc.)
      const isCanceled = detail.isCanceled === true || detail.isCanceled === 1 || 
                        detail.isCanceled === "true" || detail.isCanceled === "True" ||
                        String(detail.isCanceled).toLowerCase() === "true";
      if (isCanceled) {
        return false; // Está cancelado, excluirlo
      }
      
      // 2. Filtrar productos completamente facturados
      // 2a. Si remainingQuantity existe y es <= 0, el producto ya fue completamente facturado
      if (detail.remainingQuantity !== undefined && detail.remainingQuantity !== null) {
        const remainingQty = Number(detail.remainingQuantity) || 0;
        if (remainingQty <= 0) {
          return false; // Ya fue completamente facturado, excluirlo
        }
      }
      
      // 2b. Calcular cantidad restante usando sessionStorage si está disponible
      const detailId = String(detail.id);
      const originalQuantity = Number(detail.quantity) || 0;
      const facturedQuantity = facturedItemsMap.get(detailId) || 0;
      const remainingQuantity = originalQuantity - facturedQuantity;
      
      // Si la cantidad restante es <= 0, el producto ya fue completamente facturado
      if (remainingQuantity <= 0) {
        console.log(`   ❌ Detalle ${detail.productName || detailId} excluido: facturado completamente (${facturedQuantity} de ${originalQuantity})`);
        return false; // Ya fue completamente facturado, excluirlo
      }
      
      // Incluir el producto si no está cancelado y tiene cantidad restante
      return true;
    });
  };

  // Calcular totales basados en los detalles modificados (filtrar cancelados)
  // ⚠️ IMPORTANTE: Si hay productos seleccionados (checkboxes), calcular solo los seleccionados
  // NOTA: Los precios unitarios ya incluyen IGV, por lo que:
  // Total = suma de (cantidad * precio_unitario) [con IGV incluido]
  // Subtotal = Total / (1 + IGV%)
  // IGV = Total - Subtotal
  const allDetails = modifiedDetails.length > 0 ? modifiedDetails : (operation?.details || []);
  const detailsToUse = filterCanceledDetails(allDetails, operation?.id);
  
  // Obtener productos seleccionados (si hay checkboxes marcados, usar solo esos)
  const selectedDetailIds = Object.keys(itemAssignments).filter(id => itemAssignments[id]);
  const detailsForTotal = selectedDetailIds.length > 0 
    ? detailsToUse.filter((detail: any) => selectedDetailIds.includes(detail.id))
    : detailsToUse;
  
  const total = detailsForTotal.reduce((sum: number, detail: any) => {
    const quantity = Number(detail.quantity) || 0;
    const unitPrice = Number(detail.unitPrice) || 0;
    return sum + (quantity * unitPrice);
  }, 0);
  const igvDecimal = igvPercentage / 100;
  const subtotal = parseFloat((Math.round((total / (1 + igvDecimal)) * 100) / 100).toFixed(2));
  const igvAmount = parseFloat((Math.round((total - subtotal) * 100) / 100).toFixed(2));

  // Funciones para manejar múltiples pagos
  const addPayment = () => {
    const newId = String(Date.now());
    // Calcular el monto restante para el nuevo pago
    const currentTotalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const remainingAmount = Math.max(0, total - currentTotalPaid);
    setPayments([...payments, { id: newId, method: 'CASH', amount: remainingAmount, referenceNumber: '' }]);
  };

  const removePayment = (id: string) => {
    if (payments.length > 1) {
      setPayments(payments.filter(p => p.id !== id));
    }
  };

  const updatePayment = (id: string, field: keyof Payment, value: string | number) => {
    setPayments(payments.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  // Calcular total pagado y diferencia
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = total - totalPaid;
  const isPaymentComplete = Math.abs(remaining) < 0.01; // Tolerancia para errores de redondeo

  // Inicializar el primer pago con el total cuando cambie la operación o el total
  React.useEffect(() => {
    if (total > 0 && payments.length > 0) {
      // Si solo hay un pago y está en 0, inicializarlo con el total
      if (payments.length === 1 && payments[0].amount === 0) {
        setPayments([{ ...payments[0], amount: total }]);
      }
    }
  }, [total, operation?.id]);

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

  // Inicializar detalles modificados cuando se carga la operación (filtrar cancelados)
  React.useEffect(() => {
    if (operation?.details && operation?.id) {
      const nonCanceledDetails = filterCanceledDetails(operation.details, operation.id);
      setModifiedDetails([...nonCanceledDetails]);
      
      // Marcar todos los productos como seleccionados automáticamente cuando se carga la orden
      const initialAssignments: Record<string, boolean> = {};
      nonCanceledDetails.forEach((detail: any) => {
        if (detail.id) {
          initialAssignments[detail.id] = true;
        }
      });
      setItemAssignments(initialAssignments);
    }
  }, [operation?.details, operation?.id]);

  // Refetch automático cuando cambia la mesa
  React.useEffect(() => {
    if (table?.id && companyData?.branch.id) {
      console.log('🔄 Mesa cambiada, refetching operación para mesa:', table.id);
      
      // Pequeño delay para asegurar que el backend haya procesado el cambio
      const timer = setTimeout(() => {
        refetch({
          tableId: table.id,
          branchId: companyData.branch.id
        }).then((result) => {
          console.log('✅ Operación refetched exitosamente para mesa:', table.id);
          // Reinicializar detalles después del refetch (filtrar cancelados)
          if (result.data?.operationByTable?.details && result.data?.operationByTable?.id) {
            const nonCanceledDetails = filterCanceledDetails(result.data.operationByTable.details, result.data.operationByTable.id);
            setModifiedDetails([...nonCanceledDetails]);
            // Marcar todos los productos como seleccionados automáticamente
            const initialAssignments: Record<string, boolean> = {};
            nonCanceledDetails.forEach((detail: any) => {
              if (detail.id) {
                initialAssignments[detail.id] = true;
              }
            });
            setItemAssignments(initialAssignments);
          }
        }).catch((error) => {
          console.error('❌ Error al refetch operación:', error);
        });
      }, 500);
      
      // Limpiar selecciones cuando cambia la mesa
      setItemAssignments({});
      
      return () => clearTimeout(timer);
    }
  }, [table?.id, companyData?.branch.id, refetch]);

  const handleSplitItem = (detailId: string) => {
    const splitTimestamp = Date.now();
    const splitDetailId = `${detailId}-split-${splitTimestamp}`;
    
    setModifiedDetails(prevDetails => {
      const detailIndex = prevDetails.findIndex((d: any) => d.id === detailId);
      if (detailIndex === -1) return prevDetails;

      const detail = prevDetails[detailIndex];
      const quantity = Number(detail.quantity) || 0;

      // Solo dividir si la cantidad es mayor a 1
      if (quantity <= 1) {
        return prevDetails;
      }

      // Dividir: reducir cantidad del original y crear copia con cantidad 1
      const newDetails = [...prevDetails];
      const originalDetail = { ...detail };
      
      // Reducir cantidad del original en 1
      newDetails[detailIndex] = {
        ...originalDetail,
        quantity: quantity - 1,
        total: (quantity - 1) * Number(originalDetail.unitPrice)
      };

      // Crear copia con cantidad 1
      // Guardar el ID original para poder transferir correctamente
      const splitDetail = {
        ...originalDetail,
        id: splitDetailId, // ID único para la copia (solo para UI)
        originalDetailId: detailId, // ID original del detalle en la BD
        quantity: 1,
        total: Number(originalDetail.unitPrice)
      };

      // Insertar la copia después del original
      newDetails.splice(detailIndex + 1, 0, splitDetail);
      
      // Marcar la copia recién creada como seleccionada
      setItemAssignments(prev => {
        return {
          ...prev,
          [detailId]: true, // Marcar el original como dividido
          [splitDetailId]: true // Marcar la copia como seleccionada
        };
      });
      
      return newDetails;
    });
  };

  const handleMergeItem = (splitDetailId: string) => {
    // Extraer el ID original del producto dividido
    const originalId = splitDetailId.split('-split')[0];
    
    setModifiedDetails(prevDetails => {
      const newDetails = [...prevDetails];
      
      // Encontrar el índice de la copia
      const splitIndex = newDetails.findIndex((d: any) => d.id === splitDetailId);
      if (splitIndex === -1) return prevDetails;
      
      // Encontrar el producto original
      const originalIndex = newDetails.findIndex((d: any) => d.id === originalId);
      if (originalIndex === -1) return prevDetails;
      
      const splitDetail = newDetails[splitIndex];
      const originalDetail = newDetails[originalIndex];
      
      // Sumar la cantidad de la copia al original
      const splitQuantity = Number(splitDetail.quantity) || 0;
      const originalQuantity = Number(originalDetail.quantity) || 0;
      
      newDetails[originalIndex] = {
        ...originalDetail,
        quantity: originalQuantity + splitQuantity,
        total: (originalQuantity + splitQuantity) * Number(originalDetail.unitPrice)
      };
      
      // Eliminar la copia
      newDetails.splice(splitIndex, 1);
      
      return newDetails;
    });

    // Verificar si quedan más copias del mismo producto original
    setItemAssignments(prev => {
      const remainingSplits = modifiedDetails.filter((d: any) => 
        d.id?.includes(`${originalId}-split`) && d.id !== splitDetailId
      );
      
      // Si no quedan más copias, remover la marca de dividido y marcar el original como seleccionado
      if (remainingSplits.length === 0) {
        const newAssignments = { ...prev };
        delete newAssignments[originalId];
        // Marcar el producto original como seleccionado
        newAssignments[originalId] = true;
        return newAssignments;
      }
      return prev;
    });
  };

  const handleToggleItemSelection = (detailId: string) => {
    setItemAssignments(prev => {
      const newAssignments = { ...prev };
      if (newAssignments[detailId]) {
        delete newAssignments[detailId];
      } else {
        newAssignments[detailId] = true;
      }
      return newAssignments;
    });
  };

  const handleDeleteItem = async (detailId: string) => {
    // Si es un item dividido (split), cancelar parcialmente el producto original
    if (detailId?.includes('-split')) {
      // Extraer el ID original del producto (todo antes de '-split')
      const originalDetailId = detailId.split('-split')[0];
      
      // Guardar splits restantes antes de eliminar (para preservarlos después del refetch)
      let remainingSplits: any[] = [];
      setModifiedDetails(prevDetails => {
        // Guardar splits restantes del mismo producto original
        remainingSplits = prevDetails.filter((d: any) => 
          d.id?.includes('-split') && 
          d.id !== detailId && 
          d.id.startsWith(`${originalDetailId}-split`)
        );
        // Eliminar el split seleccionado
        return prevDetails.filter((d: any) => d.id !== detailId);
      });
      
      // Limpiar las asignaciones del split eliminado
      setItemAssignments(prev => {
        const newAssignments = { ...prev };
        delete newAssignments[detailId];
        return newAssignments;
      });
      
      try {
        // Llamar a la mutación con cancelación parcial (quantity: 1)
        const result = await cancelOperationDetailMutation({
          variables: {
            detailId: originalDetailId,
            quantity: 1,
            userId: user?.id || '',
            deviceId: deviceId || undefined
          }
        });

        if (result.data?.cancelOperationDetail?.success) {
          // ✅ Verificar si la operación cambió de estado automáticamente
          const operationCancelled = result.data?.cancelOperationDetail?.operationCancelled;
          
          if (operationCancelled) {
            console.log('✅ Operación cambió de estado automáticamente después de cancelar item');
          }
          
          // Refetch la operación para obtener los datos actualizados
          const refetchResult = await refetch();
          // Actualizar modifiedDetails filtrando cancelados y preservando splits restantes
          if (refetchResult.data?.operationByTable?.details && refetchResult.data?.operationByTable?.id) {
            const nonCanceledDetails = filterCanceledDetails(refetchResult.data.operationByTable.details, refetchResult.data.operationByTable.id);
            // Combinar detalles del backend con splits restantes
            const allDetails = [...nonCanceledDetails, ...remainingSplits];
            setModifiedDetails(allDetails);
            
            // Si no hay detalles (ni del backend ni splits), la mesa queda libre
            if (allDetails.length === 0 && table?.id && updateTableInContext) {
              updateTableInContext({
                id: table.id,
                status: 'AVAILABLE',
                statusColors: null, // Limpiar colores para usar los por defecto (verde)
                currentOperationId: null,
                occupiedById: null,
                userName: null
              });
              // Notificar al componente padre para que actualice las mesas
              if (onPaymentSuccess) {
                onPaymentSuccess();
              }
              // Volver atrás después de un breve delay
              setTimeout(() => {
                onBack();
              }, 500);
            }
          } else if (!refetchResult.data?.operationByTable && table?.id && updateTableInContext) {
            // Si la operación ya no existe, la mesa queda libre
            updateTableInContext({
              id: table.id,
              status: 'AVAILABLE',
              statusColors: null, // Limpiar colores para usar los por defecto (verde)
              currentOperationId: null,
              occupiedById: null,
              userName: null
            });
            setModifiedDetails([]);
            // Notificar al componente padre para que actualice las mesas
            if (onPaymentSuccess) {
              onPaymentSuccess();
            }
            // Volver atrás después de un breve delay
            setTimeout(() => {
              onBack();
            }, 500);
          }
        } else {
          const errorMessage = result.data?.cancelOperationDetail?.message || 'Error al cancelar el item';
          alert(errorMessage);
          // Si falla, hacer refetch para restaurar el estado
          await refetch();
        }
      } catch (error: any) {
        console.error('Error cancelando item:', error);
        alert(error.message || 'Error al cancelar el item');
        // Si falla, hacer refetch para restaurar el estado
        await refetch();
      }
      return;
    }

    // Para items reales (no splits), usar la mutación de cancelación completa
    try {
      // Primero eliminar todos los splits relacionados del estado local si existen
      setModifiedDetails(prevDetails => {
        return prevDetails.filter((d: any) => !d.id?.includes(`${detailId}-split`));
      });
      
      // Limpiar asignaciones de splits relacionados
      setItemAssignments(prev => {
        const newAssignments = { ...prev };
        Object.keys(newAssignments).forEach(key => {
          if (key.includes(`${detailId}-split`)) {
            delete newAssignments[key];
          }
        });
        return newAssignments;
      });

      const result = await cancelOperationDetailMutation({
        variables: {
          detailId: detailId,
          userId: user?.id || '',
          deviceId: deviceId || undefined
        }
      });

      if (result.data?.cancelOperationDetail?.success) {
        // ✅ Verificar si la operación cambió de estado automáticamente
        const operationCancelled = result.data?.cancelOperationDetail?.operationCancelled;
        
        if (operationCancelled) {
          console.log('✅ Operación cambió de estado automáticamente después de cancelar item');
        }
        
        // Refetch la operación para obtener los datos actualizados
        const refetchResult = await refetch();
        // Actualizar modifiedDetails filtrando cancelados
        if (refetchResult.data?.operationByTable?.details) {
          const nonCanceledDetails = filterCanceledDetails(refetchResult.data.operationByTable.details);
          setModifiedDetails([...nonCanceledDetails]);
          
          // Si no hay detalles, la mesa queda libre
          if (nonCanceledDetails.length === 0 && table?.id && updateTableInContext) {
            updateTableInContext({
              id: table.id,
              status: 'AVAILABLE',
              statusColors: null, // Limpiar colores para usar los por defecto (verde)
              currentOperationId: null,
              occupiedById: null,
              userName: null
            });
            // Notificar al componente padre para que actualice las mesas
            if (onPaymentSuccess) {
              onPaymentSuccess();
            }
            // Volver atrás después de un breve delay
            setTimeout(() => {
              onBack();
            }, 500);
          }
        } else if (!refetchResult.data?.operationByTable && table?.id && updateTableInContext) {
          // Si la operación ya no existe, la mesa queda libre
          updateTableInContext({
            id: table.id,
            status: 'AVAILABLE',
            statusColors: null, // Limpiar colores para usar los por defecto (verde)
            currentOperationId: null,
            occupiedById: null,
            userName: null
          });
          setModifiedDetails([]);
          // Notificar al componente padre para que actualice las mesas
          if (onPaymentSuccess) {
            onPaymentSuccess();
          }
          // Volver atrás después de un breve delay
          setTimeout(() => {
            onBack();
          }, 500);
        }
        // Limpiar la selección del item original si estaba seleccionado
        setItemAssignments(prev => {
          const newAssignments = { ...prev };
          delete newAssignments[detailId];
          return newAssignments;
        });
      } else {
        const errorMessage = result.data?.cancelOperationDetail?.message || 'Error al cancelar el item';
        alert(errorMessage);
      }
    } catch (error: any) {
      console.error('Error cancelando item:', error);
      alert(error.message || 'Error al cancelar el item');
    }
  };

  const handleMergeAll = (originalDetailId: string) => {
    setModifiedDetails(prevDetails => {
      const newDetails = [...prevDetails];
      
      // Encontrar el producto original
      const originalIndex = newDetails.findIndex((d: any) => d.id === originalDetailId);
      if (originalIndex === -1) return prevDetails;
      
      const originalDetail = newDetails[originalIndex];
      let totalQuantityToAdd = 0;
      
      // Encontrar todas las copias y sumar sus cantidades
      const indicesToRemove: number[] = [];
      newDetails.forEach((d: any, index: number) => {
        if (d.id?.includes(`${originalDetailId}-split`)) {
          totalQuantityToAdd += Number(d.quantity) || 0;
          indicesToRemove.push(index);
        }
      });
      
      // Actualizar la cantidad del original
      const originalQuantity = Number(originalDetail.quantity) || 0;
      newDetails[originalIndex] = {
        ...originalDetail,
        quantity: originalQuantity + totalQuantityToAdd,
        total: (originalQuantity + totalQuantityToAdd) * Number(originalDetail.unitPrice)
      };
      
      // Eliminar las copias (de mayor a menor índice para no alterar los índices)
      indicesToRemove.sort((a, b) => b - a).forEach(index => {
        newDetails.splice(index, 1);
      });
      
      return newDetails;
    });

    // Remover la marca de dividido y marcar el producto original como seleccionado
    setItemAssignments(prev => {
      const newAssignments = { ...prev };
      delete newAssignments[originalDetailId];
      // Marcar el producto original como seleccionado
      newAssignments[originalDetailId] = true;
      return newAssignments;
    });
  };

  // Función helper para obtener MAC address del dispositivo
  // ⚠️ IMPORTANTE: Siempre priorizar obtener la MAC, nunca usar deviceId temporal
  const getDeviceIdOrMac = async (): Promise<string | null> => {
    try {
      // Siempre intentar obtener la MAC primero - es el valor requerido
      const macAddress = await getMacAddress();
      if (macAddress && macAddress.trim() !== '') {
        console.log('✅ MAC address obtenida correctamente:', macAddress);
        return macAddress;
      } else {
        console.warn('⚠️ MAC address obtenida pero está vacía');
      }
    } catch (error) {
      console.error('❌ Error al obtener MAC address:', error);
    }
    
    // ⚠️ NO usar deviceId como fallback - siempre debe ser MAC
    // Si no se puede obtener MAC, mostrar error claro
    console.error('❌ ERROR: No se pudo obtener MAC address. La impresión no funcionará correctamente.');
    return null;
  };

  const handleProcessPayment = async () => {
    // ⚠️ PROTECCIÓN CONTRA DOBLE CLIC - Verificar ref primero (más confiable que estado)
    if (isProcessingRef.current) {
      console.warn('⚠️ Pago ya en proceso (ref check), ignorando solicitud duplicada');
      return;
    }

    // ⚠️ PROTECCIÓN CONTRA DOBLE CLIC - Verificar también estado
    if (isProcessing) {
      console.warn('⚠️ Pago ya en proceso (state check), ignorando solicitud duplicada');
      return;
    }

    if (!operation || !selectedDocumentId || !selectedSerialId || !user?.id) {
      setPaymentError('Por favor completa todos los campos requeridos');
      return;
    }
    
    // Validar que se haya seleccionado un documento (boleta o factura)
    if (!selectedDocumentId) {
      setPaymentError('Por favor selecciona un documento (Boleta o Factura)');
      return;
    }
    
    // Si no hay caja seleccionada, usar la primera disponible
    const cashRegisterIdToUse = selectedCashRegisterId || (cashRegisters.length > 0 ? cashRegisters[0].id : null);
    
    if (!cashRegisterIdToUse) {
      setPaymentError('No hay cajas registradoras disponibles');
      return;
    }
    
    // ⚠️ ESTABLECER flags INMEDIATAMENTE para prevenir doble ejecución
    isProcessingRef.current = true; // Ref se actualiza síncronamente
    setIsProcessing(true); // Estado puede tener delay
    setPaymentError(null);
    
    // ⚠️ Obtener MAC address (requerida para impresión)
    const resolvedDeviceId = await getDeviceIdOrMac();
    if (!resolvedDeviceId) {
      setPaymentError('No se pudo obtener la MAC address del dispositivo. La impresión no funcionará correctamente.');
      isProcessingRef.current = false;
      setIsProcessing(false);
      return;
    }
    
    // Verificar que sea una MAC válida (formato XX:XX:XX:XX:XX:XX o similar)
    if (!resolvedDeviceId.includes(':')) {
      console.warn('⚠️ El deviceId no parece ser una MAC address válida:', resolvedDeviceId);
      // Continuar de todas formas, pero advertir
    }
    
    console.log('✅ MAC address que se enviará al backend:', resolvedDeviceId);

    try {
      const now = new Date();
      const emissionDate = now.toISOString().split('T')[0];
      const emissionTime = now.toTimeString().split(' ')[0].substring(0, 5);

      // Preparar items del documento usando los detalles modificados
      const detailsToProcess = modifiedDetails.length > 0 ? modifiedDetails : (operation.details || []);
      
      // Filtrar detalles cancelados para obtener solo los disponibles
      const availableDetails = filterCanceledDetails(detailsToProcess, operation?.id);
      
      // Obtener los IDs de los productos seleccionados (checkboxes marcados)
      const selectedDetailIds = Object.keys(itemAssignments).filter(id => itemAssignments[id]);
      
      // Si hay productos seleccionados, filtrar solo esos
      let detailsToPay = availableDetails;
      if (selectedDetailIds.length > 0) {
        detailsToPay = availableDetails.filter((detail: any) => {
          // Verificar si el detail.id está en los seleccionados
          return selectedDetailIds.includes(detail.id);
        });
        
        if (detailsToPay.length === 0) {
          setPaymentError('No hay productos seleccionados para pagar');
          setIsProcessing(false);
          return;
        }
      }
      
      // ✅ VERIFICAR SI ES PAGO PARCIAL O COMPLETO
      // Si se están pagando TODOS los productos disponibles, usar la operación existente
      // Si se están pagando SOLO ALGUNOS productos, también usar la operación existente (NO crear nueva)
      // El backend se encargará de manejar el pago parcial correctamente
      const isPartialPayment = selectedDetailIds.length > 0 && selectedDetailIds.length < availableDetails.length;
      
      // ✅ SIEMPRE usar la operación existente - NO crear nuevas operaciones
      // El backend maneja los pagos parciales a nivel de documento emitido
      const operationToPay = operation;
      
      // Preparar items para el documento usando los detalles seleccionados
      // Agrupar detalles por ID original (sin el sufijo -split si existe)
      let items: any[] = [];
      const groupedDetails: Record<string, any[]> = {};
      
      detailsToPay.forEach((detail: any) => {
        const originalId = detail.id?.includes('-split') 
          ? detail.id.split('-split')[0] 
          : detail.id;
        
        if (!groupedDetails[originalId]) {
          groupedDetails[originalId] = [];
        }
        groupedDetails[originalId].push(detail);
      });
       
      // Crear items agrupados
      items = Object.entries(groupedDetails).map(([originalId, details]) => {
        const totalQuantity = details.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
        const firstDetail = details[0];
        
        return {
          operationDetailId: originalId, // ✅ Usar IDs de la operación original
          quantity: totalQuantity,
          unitValue: Number(firstDetail.unitPrice) || 0,
          unitPrice: Number(firstDetail.unitPrice) || 0,
          discount: 0,
          notes: firstDetail.notes || ''
        };
      });
      
      // Calcular totales para el pago
      // NOTA: Los precios unitarios ya incluyen IGV
      const paymentTotal = detailsToPay.reduce((sum: number, detail: any) => {
        const quantity = Number(detail.quantity) || 0;
        const unitPrice = Number(detail.unitPrice) || 0;
        return sum + (quantity * unitPrice);
      }, 0);
      const igvDecimal = igvPercentage / 100;
      const paymentSubtotal = parseFloat((Math.round((paymentTotal / (1 + igvDecimal)) * 100) / 100).toFixed(2));
      const paymentIgvAmount = parseFloat((Math.round((paymentTotal - paymentSubtotal) * 100) / 100).toFixed(2));

      // Validar que la suma de pagos sea igual al total
      const totalPaymentsAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      if (Math.abs(totalPaymentsAmount - paymentTotal) > 0.01) {
        setPaymentError(`La suma de los pagos (${currencyFormatter.format(totalPaymentsAmount)}) debe ser igual al total (${currencyFormatter.format(paymentTotal)})`);
        isProcessingRef.current = false;
        setIsProcessing(false);
        return;
      }

      // Preparar pagos para enviar al backend
      const paymentsToSend = payments
        .filter(p => Number(p.amount) > 0) // Solo incluir pagos con monto > 0
        .map(p => ({
          cashRegisterId: cashRegisterIdToUse,
          paymentType: 'CASH',
          paymentMethod: p.method,
          transactionType: 'INCOME',
          totalAmount: Number(p.amount),
          paidAmount: Number(p.amount),
          paymentDate: now.toISOString(),
          dueDate: null,
          referenceNumber: (p.method === 'YAPE' || p.method === 'PLIN' || p.method === 'TRANSFER') 
            ? (p.referenceNumber || null) 
            : null,
          notes: null
        }));

      if (paymentsToSend.length === 0) {
        setPaymentError('Debe agregar al menos un pago con monto mayor a 0');
        isProcessingRef.current = false;
        setIsProcessing(false);
        return;
      }

      const selectedSerial = serials.find((ser: any) => ser.id === selectedSerialId);
      const serial = selectedSerial?.serial || '';

      // Para pagos parciales: NO pasar table_id si hay productos restantes
      // Esto evita que el backend libere la mesa cuando todavía hay productos por pagar
      // Solo pasamos tableId si se está pagando toda la operación (no hay productos restantes)
      const hasRemainingProducts = isPartialPayment;
      const tableIdForPayment = hasRemainingProducts ? null : (table?.id || null);

      const variables = {
        operationId: operationToPay.id,
        branchId: companyData?.branch.id,
        documentId: selectedDocumentId,
        serial: serial,
        personId: selectedClientId || null,
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
        igvAmount: paymentIgvAmount,
        totalTaxable: paymentSubtotal,
        totalUnaffected: 0.0,
        totalExempt: 0.0,
        totalFree: 0.0,
        totalAmount: paymentTotal,
        items: items,
        payments: paymentsToSend,
        notes: null,
        tableId: tableIdForPayment,
        deviceId: resolvedDeviceId, // Siempre pasar deviceId o MAC para que el backend pueda imprimir el documento (boleta/factura)
        printerId: null // Opcional: se puede agregar selección de impresora si es necesario
      };

      // 🧪 LOG COMPLETO ANTES DEL PAGO - ESPECIALMENTE PARA PAGOS PARCIALES
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`💰 ${isPartialPayment ? 'PAGO PARCIAL' : 'PAGO COMPLETO'}`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📋 INFORMACIÓN DE LA OPERACIÓN:');
      console.log(`   - Operation ID: ${operationToPay.id}`);
      console.log(`   - Tipo de pago: ${isPartialPayment ? 'PARCIAL' : 'COMPLETO'}`);
      console.log(`   - Mesa ID: ${table?.id || 'N/A'}`);
      console.log(`   - TableId para pago: ${tableIdForPayment || 'null (no liberar mesa)'}`);
      console.log('');
      console.log('📄 INFORMACIÓN DEL DOCUMENTO:');
      // ✅ Obtener información completa del documento seleccionado
      const selectedDocument = documents.find((doc: any) => doc.id === selectedDocumentId);
      const documentCode = selectedDocument?.code || 'N/A';
      const documentDescription = selectedDocument?.description || 'N/A';
      const isBillableDocument = documentCode === '01' || documentCode === '03'; // FACTURA o BOLETA
      console.log(`   - Document ID: ${selectedDocumentId}`);
      console.log(`   - Document Code: ${documentCode} (${documentDescription})`);
      console.log(`   - Es documento facturable (01/FACTURA o 03/BOLETA): ${isBillableDocument ? 'SÍ ✅' : 'NO ⚠️'}`);
      console.log(`   - Branch is_billing habilitado: ${companyData?.branch?.isBilling ? 'SÍ ✅' : 'NO ⚠️'}`);
      if (isBillableDocument && companyData?.branch?.isBilling) {
        console.log(`   ✅ Este documento será enviado a SUNAT automáticamente`);
      } else {
        if (!isBillableDocument) {
          console.log(`   ⚠️ Documento con código '${documentCode}' NO se enviará a SUNAT (solo se envían 01/FACTURA y 03/BOLETA)`);
        }
        if (!companyData?.branch?.isBilling) {
          console.log(`   ⚠️ Facturación electrónica deshabilitada en esta sucursal`);
        }
      }
      console.log(`   - Serial: ${serial}`);
      console.log(`   - Branch ID: ${companyData?.branch.id}`);
      console.log(`   - User ID: ${user.id}`);
      console.log(`   - Emission Date: ${emissionDate}`);
      console.log(`   - Emission Time: ${emissionTime}`);
      console.log('');
      console.log('📊 CÁLCULOS Y TOTALES:');
      console.log(`   - IGV Percentage: ${igvPercentage}%`);
      console.log(`   - Subtotal: ${currencyFormatter.format(paymentSubtotal)}`);
      console.log(`   - IGV Amount: ${currencyFormatter.format(paymentIgvAmount)}`);
      console.log(`   - Total Amount: ${currencyFormatter.format(paymentTotal)}`);
      console.log('');
      console.log('📦 ITEMS A PAGAR:');
      console.log(`   - Cantidad de items: ${items.length}`);
      items.forEach((item, index) => {
        console.log(`   ${index + 1}. Operation Detail ID: ${item.operationDetailId}`);
        console.log(`      - Cantidad: ${item.quantity}`);
        console.log(`      - Unit Value: ${currencyFormatter.format(item.unitValue)}`);
        console.log(`      - Unit Price: ${currencyFormatter.format(item.unitPrice)}`);
        console.log(`      - Subtotal Item: ${currencyFormatter.format(item.quantity * item.unitPrice)}`);
        if (item.notes) {
          console.log(`      - Notas: ${item.notes}`);
        }
      });
      console.log('');
      console.log('💳 INFORMACIÓN DE PAGO:');
      paymentsToSend.forEach((payment, index) => {
        console.log(`   Pago ${index + 1}:`);
        console.log(`      - Cash Register ID: ${payment.cashRegisterId}`);
        console.log(`      - Payment Type: ${payment.paymentType}`);
        console.log(`      - Payment Method: ${payment.paymentMethod}`);
        console.log(`      - Transaction Type: ${payment.transactionType}`);
        console.log(`      - Total Amount: ${currencyFormatter.format(payment.totalAmount)}`);
        console.log(`      - Paid Amount: ${currencyFormatter.format(payment.paidAmount)}`);
        if (payment.referenceNumber) {
          console.log(`      - Reference Number: ${payment.referenceNumber}`);
        }
      });
      console.log('');
      console.log('🖨️ IMPRESIÓN:');
      console.log(`   - Device ID: ${resolvedDeviceId || 'No disponible'}`);
      console.log(`   - Printer ID: No especificado`);
      console.log('');
      if (isPartialPayment) {
        console.log('⚠️ PAGO PARCIAL DETECTADO:');
        console.log(`   - Productos seleccionados para pagar: ${selectedDetailIds.length}`);
        console.log(`   - Productos totales disponibles: ${availableDetails.length}`);
        console.log(`   - Productos que quedan por pagar: ${availableDetails.length - selectedDetailIds.length}`);
        console.log(`   - TableId será null (mesa NO se liberará)`);
      }
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📤 Enviando mutación CREATE_ISSUED_DOCUMENT...');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');

      // ⚠️ VERIFICACIÓN FINAL: Usar ref en lugar de estado (más confiable - actualización síncrona)
      if (!isProcessingRef.current) {
        console.warn('⚠️ isProcessingRef cambiado, abortando pago');
        // Ya se reseteó, solo asegurar estado
        setIsProcessing(false);
        return;
      }

      // ⚠️ GUARDAR información de items facturados ANTES de enviar (para usar después del refetch)
      // Esto nos permite calcular remainingQuantity localmente si el backend no lo devuelve
      const facturedItemsMap = new Map<string, number>(); // operationDetailId (string) -> cantidad facturada
      items.forEach((item: any) => {
        const detailId = String(item.operationDetailId); // Asegurar que sea string
        const qty = Number(item.quantity) || 0;
        const existingQty = facturedItemsMap.get(detailId) || 0;
        facturedItemsMap.set(detailId, existingQty + qty);
      });
      
      console.log('✅ Enviando mutación al backend...');
      console.log('   - Items facturados (para cálculo local):', Array.from(facturedItemsMap.entries()).map(([id, qty]) => `ID:${id}=${qty}`));
      
      const result = await createIssuedDocumentMutation({
        variables
      });
        
      if (result.data?.createIssuedDocument?.success) {
        // El documento (boleta/factura) se ha creado exitosamente
        // El backend debería haber impreso el documento si deviceId estaba disponible
        
        // ✅ VERIFICAR SI EL DOCUMENTO SERÁ ENVIADO A SUNAT
        const selectedDocument = documents.find((doc: any) => doc.id === selectedDocumentId);
        const documentCode = selectedDocument?.code || '';
        const documentDescription = selectedDocument?.description || '';
        const isBillableDocument = documentCode === '01' || documentCode === '03'; // FACTURA o BOLETA
        const isBranchBillingEnabled = companyData?.branch?.isBilling || false;
        
        if (isBillableDocument && isBranchBillingEnabled) {
          console.log('✅ SUNAT: El documento será enviado a facturación electrónica');
          console.log(`   - Tipo: ${documentDescription} (Código: ${documentCode})`);
          console.log(`   - Serial: ${result.data?.createIssuedDocument?.issuedDocument?.serial || 'N/A'}`);
          console.log(`   - Número: ${result.data?.createIssuedDocument?.issuedDocument?.number || 'N/A'}`);
          console.log(`   - Proceso: ${isPartialPayment ? 'PAGO PARCIAL' : 'PAGO COMPLETO'}`);
        } else {
          if (!isBillableDocument) {
            console.log(`ℹ️ SUNAT: Documento "${documentDescription}" (Código: ${documentCode}) no se enviará a SUNAT`);
            console.log('   - Solo se envían FACTURAS (01) y BOLETAS (03)');
          }
          if (!isBranchBillingEnabled) {
            console.log('ℹ️ SUNAT: La sucursal no tiene facturación electrónica habilitada');
          }
        }
        
        // ✅ GUARDAR información de facturación en sessionStorage para pago parcial
        if (isPartialPayment && operation?.id) {
          saveFacturedItemsToStorage(operation.id, facturedItemsMap);
        }
        
        // Refetch para obtener la operación actualizada
        // Usar fetchPolicy: 'network-only' para forzar la actualización
        const refetchResult = await refetch({
          fetchPolicy: 'network-only'
        });
        
        // Limpiar selecciones después del pago
        setItemAssignments({});
        
        if (isPartialPayment) {
          // ✅ Pago parcial: La operación original sigue activa con los productos restantes
          // El backend ya se encargó de crear el documento con solo los items seleccionados
          // Actualizar los detalles modificados con los nuevos datos del refetch
          if (refetchResult.data?.operationByTable?.details && refetchResult.data?.operationByTable?.id) {
            const allDetails = refetchResult.data.operationByTable.details;
            const currentOperationId = refetchResult.data.operationByTable.id;
            
            // Filtrar detalles cancelados (usando sessionStorage para calcular cantidades restantes)
            // filterCanceledDetails ya calcula remainingQuantity usando sessionStorage
            const nonCanceledDetails = filterCanceledDetails(allDetails, currentOperationId);
            
            // Actualizar cantidades mostradas con las cantidades restantes calculadas
            const detailsWithRemaining: any[] = [];
            
            nonCanceledDetails.forEach((detail: any) => {
              const detailId = String(detail.id);
              const originalQuantity = Number(detail.quantity) || 0;
              
              // Obtener cantidad facturada total desde sessionStorage
              const facturedItemsMap = getFacturedItemsFromStorage(currentOperationId);
              const totalFactured = facturedItemsMap.get(detailId) || 0;
              const remainingQty = originalQuantity - totalFactured;
              
              if (remainingQty > 0) {
                detailsWithRemaining.push({
                  ...detail,
                  quantity: remainingQty, // Actualizar cantidad mostrada con lo que queda
                  remainingQuantity: remainingQty
                });
              } else {
                console.log(`   ❌ Detalle ${detail.productName || detailId} excluido: facturado completamente (${totalFactured} de ${originalQuantity})`);
              }
            });
            
            // Debug: mostrar información de los detalles
            console.log('📊 Detalles después del refetch:');
            allDetails.forEach((detail: any) => {
              const detailId = detail.id;
              const facturedQty = facturedItemsMap.get(detailId) || 0;
              const originalQty = Number(detail.quantity) || 0;
              const calculatedRemaining = facturedQty > 0 ? originalQty - facturedQty : originalQty;
              
              console.log(`   - ${detail.productName || detail.id} (ID: ${detailId}):`);
              console.log(`     quantity original: ${originalQty}`);
              console.log(`     facturado en este pago: ${facturedQty}`);
              console.log(`     remainingQuantity (backend): ${detail.remainingQuantity ?? 'N/A'}`);
              console.log(`     remainingQuantity (calculado): ${calculatedRemaining}`);
              console.log(`     isCanceled: ${detail.isCanceled}`);
              console.log(`     será incluido: ${calculatedRemaining > 0 ? 'SÍ' : 'NO'}`);
            });
            
            console.log('✅ Pago parcial completado - operación actualizada');
            console.log('   - Detalles totales:', allDetails.length);
            console.log('   - Detalles no cancelados:', nonCanceledDetails.length);
            console.log('   - Detalles restantes (con cantidad pendiente):', detailsWithRemaining.length);
            console.log('   - Items facturados en este pago:', Array.from(facturedItemsMap.entries()).map(([id, qty]) => `ID:${id}=${qty}`));
            console.log('   - IDs restantes:', detailsWithRemaining.map((d: any) => `${d.id} (qty:${d.quantity})`));
            
            // ⚠️ IMPORTANTE: Actualizar los detalles modificados con los productos restantes
            setModifiedDetails([...detailsWithRemaining]);
            
            // Marcar automáticamente todos los productos restantes como seleccionados
            const updatedAssignments: Record<string, boolean> = {};
            detailsWithRemaining.forEach((detail: any) => {
              if (detail.id) {
                updatedAssignments[detail.id] = true;
              }
            });
            setItemAssignments(updatedAssignments);
            
            console.log('   - Productos marcados automáticamente:', Object.keys(updatedAssignments).length);
          } else {
            console.warn('⚠️ No se pudieron obtener los detalles actualizados después del pago parcial');
            // Intentar refetch nuevamente si no hay datos
            setTimeout(async () => {
              const retryRefetch = await refetch({ fetchPolicy: 'network-only' });
              if (retryRefetch.data?.operationByTable?.details && retryRefetch.data?.operationByTable?.id) {
                const nonCanceledDetails = filterCanceledDetails(retryRefetch.data.operationByTable.details, retryRefetch.data.operationByTable.id);
                setModifiedDetails([...nonCanceledDetails]);
                console.log('✅ Detalles actualizados en el segundo intento:', nonCanceledDetails.length, 'items');
              }
            }, 500);
          }
        } else {
          // Si se pagó toda la operación, verificar si la mesa fue liberada
          // (ya hicimos refetch arriba, no necesitamos hacerlo de nuevo)
          
          // Verificar si la mesa fue liberada según la respuesta del backend
          if (result.data?.createIssuedDocument?.wasTableFreed) {
            // Actualizar la mesa en el contexto para limpiar el nombre del mozo
            const freedTable = result.data?.createIssuedDocument?.table;
            if (freedTable && table?.id && updateTableInContext) {
              updateTableInContext({
                id: table.id,
                status: freedTable.status || 'AVAILABLE',
                statusColors: freedTable.statusColors || null,
                currentOperationId: null,
                occupiedById: null,
                userName: null  // Limpiar el nombre del mozo
              });
              
              // Enviar notificación WebSocket para actualizar en tiempo real
              notifyTableUpdate(table.id, freedTable.status || 'AVAILABLE', null, null, null);
              
              console.log('✅ Mesa liberada - nombre del mozo limpiado para mesa:', table.id);
            }
            setTimeout(() => {
              onBack();
            }, 2000);
          } else if (!refetchResult.data?.operationByTable && table?.id && updateTableInContext) {
            // Si la operación ya no existe después del refetch, la mesa queda libre
            // Esto puede pasar si el backend liberó la mesa pero no retornó wasTableFreed
            updateTableInContext({
              id: table.id,
              status: 'AVAILABLE',
              statusColors: null, // Limpiar colores para usar los por defecto (verde)
              currentOperationId: null,
              occupiedById: null,
              userName: null
            });
            
            // Enviar notificación WebSocket para actualizar en tiempo real
            notifyTableUpdate(table.id, 'AVAILABLE', null, null, null);
            
            console.log('✅ Mesa liberada - operación ya no existe para mesa:', table.id);
            
            // Notificar al componente padre para que actualice las mesas
            if (onPaymentSuccess) {
              onPaymentSuccess();
            }
            
            // Volver atrás después de un breve delay
            setTimeout(() => {
              onBack();
            }, 500);
          }
        }
        
        // Llamar callback de éxito si existe
        if (onPaymentSuccess) {
          onPaymentSuccess();
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
      // ⚠️ Siempre resetear ambos flags al finalizar
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handlePrecuenta = async () => {
    if (!operation || !table?.id || !companyData?.branch.id || !user?.id) {
      setPaymentError('No hay una orden disponible para imprimir precuenta');
      return;
    }

    if (operation.status === 'COMPLETED') {
      setPaymentError('Esta orden ya ha sido completada');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const resolvedDeviceId = deviceId || await getMacAddress();
      
      // Obtener los IDs de los items seleccionados
      const selectedDetailIds = Object.keys(itemAssignments).filter(id => itemAssignments[id]);
      
      // Si hay items seleccionados, usar la mutación parcial
      if (selectedDetailIds.length > 0) {
        const result = await printPartialPrecuentaMutation({
          variables: {
            operationId: operation.id,
            detailIds: selectedDetailIds,
            tableId: table.id,
            branchId: companyData.branch.id,
            userId: user.id,
            deviceId: resolvedDeviceId,
            printerId: null // Opcional, se puede agregar selección de impresora si es necesario
          }
        });

        if (result.data?.printPartialPrecuenta?.success) {
          const resultTable = result.data.printPartialPrecuenta.table;
          
          // ✅ FORZAR actualización del estado de la mesa a TO_PAY
          // Primero intentar actualizar usando la mutación UPDATE_TABLE_STATUS
          try {
            await updateTableStatusMutation({
              variables: {
                tableId: table.id,
                status: 'TO_PAY',
                userId: user.id
              }
            });
            console.log('✅ Estado de mesa actualizado a TO_PAY mediante mutación');
          } catch (updateError) {
            console.warn('⚠️ No se pudo actualizar el estado mediante mutación, actualizando en contexto:', updateError);
          }

          // Actualizar la mesa en el contexto con el nuevo estado TO_PAY
          const updatedTableId = resultTable?.id || table.id;
          const updatedStatus = 'TO_PAY'; // Siempre forzar a TO_PAY
          
          if (updateTableInContext) {
            updateTableInContext({
              id: updatedTableId,
              status: updatedStatus,
              currentOperationId: resultTable?.currentOperationId ?? table?.currentOperationId,
              occupiedById: resultTable?.occupiedById ?? table?.occupiedById,
              userName: resultTable?.userName ?? table?.userName
            });
            console.log(`✅ Mesa ${updatedTableId} actualizada en contexto a estado: ${updatedStatus}`);
            
            // Enviar notificación WebSocket
            notifyTableUpdate(
              updatedTableId,
              updatedStatus,
              resultTable?.currentOperationId ?? table?.currentOperationId,
              resultTable?.occupiedById ?? table?.occupiedById,
              resultTable?.userName ?? table?.userName
            );
          }

          // Si hay callback onTableChange, notificar el cambio
          if (onTableChange && table) {
            onTableChange({
              ...table,
              status: updatedStatus
            });
          }

          // Refetch la operación para obtener los datos actualizados
          await refetch();
          
          // Llamar callback de éxito si existe (para que el padre pueda refetch las mesas)
          if (onPaymentSuccess) {
            onPaymentSuccess();
          }

          setPaymentError(null);
          // Mostrar mensaje de éxito
          alert(result.data.printPartialPrecuenta.message || `Precuenta parcial enviada a imprimir exitosamente (${selectedDetailIds.length} plato(s) seleccionado(s)). Estado de mesa actualizado a TO_PAY`);
        } else {
          setPaymentError(result.data?.printPartialPrecuenta?.message || 'Error al imprimir la precuenta parcial');
        }
      } else {
        // Si no hay items seleccionados, usar la mutación completa
        const result = await printPrecuentaMutation({
          variables: {
            operationId: operation.id,
            tableId: table.id,
            branchId: companyData.branch.id,
            deviceId: resolvedDeviceId,
            printerId: null // Opcional, se puede agregar selección de impresora si es necesario
          }
        });

        if (result.data?.printCuenta?.success) {
          const resultTable = result.data.printCuenta.table;
          
          // ✅ FORZAR actualización del estado de la mesa a TO_PAY
          // Primero intentar actualizar usando la mutación UPDATE_TABLE_STATUS
          try {
            await updateTableStatusMutation({
              variables: {
                tableId: table.id,
                status: 'TO_PAY',
                userId: user.id
              }
            });
            console.log('✅ Estado de mesa actualizado a TO_PAY mediante mutación');
          } catch (updateError) {
            console.warn('⚠️ No se pudo actualizar el estado mediante mutación, actualizando en contexto:', updateError);
          }

          // Actualizar la mesa en el contexto con el nuevo estado TO_PAY
          const updatedTableId = resultTable?.id || table.id;
          const updatedStatus = 'TO_PAY'; // Siempre forzar a TO_PAY
          
          if (updateTableInContext) {
            updateTableInContext({
              id: updatedTableId,
              status: updatedStatus,
              currentOperationId: resultTable?.currentOperationId ?? table?.currentOperationId,
              occupiedById: resultTable?.occupiedById ?? table?.occupiedById,
              userName: resultTable?.userName ?? table?.userName
            });
            console.log(`✅ Mesa ${updatedTableId} actualizada en contexto a estado: ${updatedStatus}`);
            
            // Enviar notificación WebSocket
            notifyTableUpdate(
              updatedTableId,
              updatedStatus,
              resultTable?.currentOperationId ?? table?.currentOperationId,
              resultTable?.occupiedById ?? table?.occupiedById,
              resultTable?.userName ?? table?.userName
            );
          }

          // Si hay callback onTableChange, notificar el cambio
          if (onTableChange && table) {
            onTableChange({
              ...table,
              status: updatedStatus
            });
          }

          // Refetch la operación para obtener los datos actualizados
          await refetch();
          
          // Llamar callback de éxito si existe (para que el padre pueda refetch las mesas)
          if (onPaymentSuccess) {
            onPaymentSuccess();
          }

          setPaymentError(null);
          // Mostrar mensaje de éxito
          alert(result.data.printCuenta.message || 'Precuenta enviada a imprimir exitosamente. Estado de mesa actualizado a TO_PAY');
        } else {
          setPaymentError(result.data?.printCuenta?.message || 'Error al imprimir la precuenta');
        }
      }
    } catch (err: any) {
      console.error('Error al imprimir precuenta:', err);
      setPaymentError(err.message || 'Error al imprimir la precuenta');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChangeTable = async () => {
    if (!operation || !selectedTableId || !companyData?.branch.id) {
      setPaymentError('Por favor selecciona una mesa');
      return;
    }

    if (selectedTableId === table?.id) {
      setPaymentError('La mesa seleccionada es la misma que la actual');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const result = await changeOperationTableMutation({
        variables: {
          operationId: operation.id,
          newTableId: selectedTableId,
          branchId: companyData.branch.id
        }
      });

      if (result.data?.changeOperationTable?.success) {
        // Obtener datos de la mesa antigua y nueva
        const oldTableData = result.data.changeOperationTable.oldTable;
        const resultNewTable = result.data.changeOperationTable.newTable;
        
        // IMPORTANTE: Actualizar la mesa antigua - limpiar el nombre del mozo
        // Usamos el ID de la mesa actual (table.id) que es la mesa antigua
        if (table?.id && updateTableInContext) {
          updateTableInContext({
            id: table.id,
            status: oldTableData?.status || 'AVAILABLE',
            currentOperationId: null,
            occupiedById: null,
            userName: null  // ← ESTO LIMPIA EL NOMBRE DEL MOZO
          });
          // Enviar notificación WebSocket para actualizar en tiempo real
          notifyTableUpdate(table.id, oldTableData?.status || 'AVAILABLE', null, null, null);
          console.log('✅ Mesa antigua actualizada - nombre del mozo limpiado para mesa:', table.id);
        }
        
        // Buscar la mesa completa en los datos de las mesas del piso
        const newTableData = tablesData?.tablesByFloor?.find((t: any) => t.id === selectedTableId);
        
        // Obtener el userName del resultado de la mutación, mesa original, o usuario actual
        const currentUserName = resultNewTable?.userName || table?.userName || user?.fullName || '';
        const currentOccupiedById = resultNewTable?.occupiedById || table?.occupiedById || (user?.id ? parseInt(user.id) : undefined);
        const currentOperationId = resultNewTable?.currentOperationId || operation.id;
        
        // Actualizar también la nueva mesa en el contexto
        if (resultNewTable?.id && updateTableInContext) {
          updateTableInContext({
            id: resultNewTable.id,
            status: resultNewTable.status || 'OCCUPIED',
            currentOperationId: currentOperationId,
            occupiedById: currentOccupiedById,
            userName: currentUserName
          });
          // Enviar notificación WebSocket para actualizar en tiempo real
          notifyTableUpdate(
            resultNewTable.id,
            resultNewTable.status || 'OCCUPIED',
            currentOperationId,
            currentOccupiedById,
            currentUserName
          );
          console.log('✅ Mesa nueva actualizada en contexto para mesa:', resultNewTable.id);
        }
        
        if (newTableData && onTableChange) {
          // Crear objeto mesa completo con los datos disponibles
          const newTable: Table = {
            id: newTableData.id,
            name: newTableData.name || resultNewTable?.name || '',
            capacity: newTableData.capacity || 0,
            shape: newTableData.shape || 'RECTANGLE',
            positionX: newTableData.positionX || 0,
            positionY: newTableData.positionY || 0,
            status: resultNewTable?.status || 'OCCUPIED',
            statusColors: newTableData.statusColors || {},
            currentOperationId: currentOperationId,
            occupiedById: currentOccupiedById,
            userName: currentUserName
          };
          
          // Notificar al componente padre sobre el cambio de mesa
          onTableChange(newTable);
        }
        
        // Cerrar modal
        setShowChangeTableModal(false);
        setSelectedFloorId('');
        setSelectedTableId('');
        
        // El useEffect detectará el cambio de mesa y hará el refetch automáticamente
        // Llamar callback de éxito si existe (para que el padre pueda refetch las mesas)
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
        setPaymentError(null);
      } else {
        setPaymentError(result.data?.changeOperationTable?.message || 'Error al cambiar la mesa');
      }
    } catch (err: any) {
      console.error('Error cambiando mesa:', err);
      setPaymentError(err.message || 'Error al cambiar la mesa');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChangeUser = async () => {
    if (!operation || !selectedUserId || !companyData?.branch.id) {
      setPaymentError('Por favor selecciona un mozo');
      return;
    }

    if (selectedUserId === operation.user?.id) {
      setPaymentError('El mozo seleccionado es el mismo que el actual');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const result = await changeOperationUserMutation({
        variables: {
          operationId: operation.id,
          newUserId: selectedUserId,
          branchId: companyData.branch.id
        }
      });

      if (result.data?.changeOperationUser?.success) {
        const resultTable = result.data.changeOperationUser.table;
        
        // Actualizar la mesa en el contexto con el nuevo mozo
        if (resultTable && updateTableInContext) {
          updateTableInContext({
            id: resultTable.id,
            status: resultTable.status || table?.status || 'OCCUPIED',
            currentOperationId: resultTable.currentOperationId ?? table?.currentOperationId,
            occupiedById: resultTable.occupiedById ?? table?.occupiedById,
            userName: resultTable.userName ?? table?.userName
          });
          console.log('✅ Mesa actualizada con nuevo mozo:', resultTable.userName);
        }
        
        // Cerrar modal
        setShowChangeUserModal(false);
        setSelectedUserId('');
        
        // Refetch la operación para obtener los datos actualizados
        await refetch();
        
        // Llamar callback de éxito si existe (para que el padre pueda refetch las mesas)
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
        setPaymentError(null);
      } else {
        setPaymentError(result.data?.changeOperationUser?.message || 'Error al cambiar el mozo');
      }
    } catch (err: any) {
      console.error('Error cambiando mozo:', err);
      setPaymentError(err.message || 'Error al cambiar el mozo');
    } finally {
      setIsProcessing(false);
    }
  };

  // Obtener lista de mozos disponibles (usuarios activos de la sucursal)
  const availableUsers = (companyData?.branch?.users || []).filter((u: any) => u.isActive !== false);

  const handleCancelOperation = async () => {
    if (!operation || !companyData?.branch.id || !user?.id) {
      setPaymentError('No se puede cancelar la operación: faltan datos necesarios');
      return;
    }

    if (!cancellationReason.trim()) {
      setPaymentError('Por favor ingresa una razón para la cancelación');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const resolvedDeviceId = deviceId || await getMacAddress();

      const result = await cancelOperationMutation({
        variables: {
          operationId: operation.id,
          branchId: companyData.branch.id,
          userId: user.id,
          cancellationReason: cancellationReason.trim(),
          deviceId: resolvedDeviceId
        }
      });

      if (result.data?.cancelOperation?.success) {
        const resultTable = result.data.cancelOperation.table;
        
        // Actualizar la mesa en el contexto - liberarla
        if (resultTable && updateTableInContext) {
          updateTableInContext({
            id: resultTable.id,
            status: resultTable.status || 'AVAILABLE',
            currentOperationId: null,
            occupiedById: null,
            userName: null
          });
          // Enviar notificación WebSocket
          notifyTableUpdate(resultTable.id, resultTable.status || 'AVAILABLE', null, null, null);
        }

        // Cerrar modal
        setShowCancelOperationModal(false);
        setCancellationReason('');
        
        // Refetch la operación (aunque ya no debería existir)
        await refetch();
        
        // Llamar callback de éxito para que el padre pueda refetch las mesas
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }

        // Volver atrás ya que la operación fue cancelada
        if (onBack) {
          onBack();
        }

        setPaymentError(null);
      } else {
        setPaymentError(result.data?.cancelOperation?.message || 'Error al cancelar la operación');
      }
    } catch (err: any) {
      console.error('Error cancelando operación:', err);
      setPaymentError(err.message || 'Error al cancelar la operación');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransferPlates = async () => {
    if (!operation || !selectedTransferTableId || !companyData?.branch.id) {
      setPaymentError('Por favor selecciona una mesa de destino');
      return;
    }

    // Obtener los IDs de los productos seleccionados (los que tienen checkbox marcado)
    const selectedDetailIds = Object.keys(itemAssignments).filter(id => itemAssignments[id]);
    
    if (selectedDetailIds.length === 0) {
      setPaymentError('Por favor selecciona al menos un plato para transferir');
      return;
    }

    if (selectedTransferTableId === table?.id) {
      setPaymentError('No puedes transferir platos a la misma mesa');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      // Procesar los items seleccionados: agrupar por ID original y calcular cantidades
      // Esto maneja correctamente los productos divididos
      const itemsByOriginalId: Record<string, { totalQuantity: number; originalQuantity: number }> = {};

      // Primero, agrupar todos los items seleccionados por su ID original
      for (const selectedId of selectedDetailIds) {
        // Buscar el detalle en modifiedDetails
        const detail = modifiedDetails.find((d: any) => d.id === selectedId);
        if (!detail) continue;

        // Si es una copia dividida, usar el originalDetailId o extraer del ID
        let originalDetailId: string;
        if (detail.originalDetailId) {
          originalDetailId = detail.originalDetailId;
        } else if (selectedId.includes('-split-')) {
          originalDetailId = selectedId.split('-split-')[0];
        } else {
          originalDetailId = selectedId;
        }

        // Validar que sea un ID numérico válido
        if (!/^\d+$/.test(originalDetailId)) continue;

        const selectedQuantity = Number(detail.quantity) || 0;

        // Inicializar o actualizar el registro para este ID original
        if (!itemsByOriginalId[originalDetailId]) {
          // Buscar el detalle original para obtener su cantidad total
          const originalDetail = modifiedDetails.find((d: any) => d.id === originalDetailId && !d.id?.includes('-split-'));
          itemsByOriginalId[originalDetailId] = {
            totalQuantity: selectedQuantity,
            originalQuantity: originalDetail ? Number(originalDetail.quantity) || 0 : selectedQuantity
          };
        } else {
          itemsByOriginalId[originalDetailId].totalQuantity += selectedQuantity;
        }
      }

      // Procesar cada item: cancelar parcialmente si es necesario, luego transferir
      const detailIdsToTransfer: string[] = [];
      let needsRefetch = false;

      for (const [originalDetailId, itemData] of Object.entries(itemsByOriginalId)) {
        const { totalQuantity, originalQuantity } = itemData;

        // Si la cantidad total seleccionada es menor que la cantidad original,
        // necesitamos cancelar la diferencia primero
        if (totalQuantity < originalQuantity) {
          const quantityToCancel = originalQuantity - totalQuantity;
          
          // Cancelar parcialmente el detalle original
          const cancelVariables: any = {
            detailId: originalDetailId,
            quantity: quantityToCancel,
            userId: user?.id || '',
            deviceId: deviceId || undefined
          };
          
          const cancelResult = await cancelOperationDetailMutation({
            variables: cancelVariables
          });

          if (!cancelResult.data?.cancelOperationDetail?.success) {
            throw new Error(cancelResult.data?.cancelOperationDetail?.message || 'Error al cancelar parcialmente el item');
          }

          needsRefetch = true;
        }

        // Agregar el ID original para transferir (el backend transferirá el detalle completo)
        detailIdsToTransfer.push(originalDetailId);
      }

      // Si se hicieron cancelaciones parciales, hacer refetch para obtener los datos actualizados
      if (needsRefetch) {
        await refetch();
      }

      if (detailIdsToTransfer.length === 0) {
        setPaymentError('No se encontraron IDs válidos para transferir');
        setIsProcessing(false);
        return;
      }

      const result = await transferItemsMutation({
        variables: {
          fromOperationId: operation.id,
          toTableId: selectedTransferTableId,
          detailIds: detailIdsToTransfer,
          branchId: companyData.branch.id,
          createNewOperation: false // Por defecto usa la operación existente o crea una nueva si no existe
        }
      });

      if (result.data?.transferItems?.success) {
        const resultOldTable = result.data.transferItems.oldTable;
        const resultNewTable = result.data.transferItems.newTable;
        
        // Actualizar las mesas en el contexto
        if (resultOldTable && updateTableInContext) {
          updateTableInContext({
            id: resultOldTable.id,
            status: resultOldTable.status || 'AVAILABLE',
            currentOperationId: resultOldTable.currentOperationId ?? null,
            occupiedById: resultOldTable.occupiedById ?? null,
            userName: resultOldTable.userName ?? null
          });
          // Enviar notificación WebSocket para actualizar en tiempo real
          notifyTableUpdate(
            resultOldTable.id,
            resultOldTable.status || 'AVAILABLE',
            resultOldTable.currentOperationId ?? null,
            resultOldTable.occupiedById ?? null,
            resultOldTable.userName ?? null
          );
          console.log('✅ Mesa origen actualizada después de transferir');
        }
        
        if (resultNewTable && updateTableInContext) {
          updateTableInContext({
            id: resultNewTable.id,
            status: resultNewTable.status || 'OCCUPIED',
            currentOperationId: resultNewTable.currentOperationId ?? null,
            occupiedById: resultNewTable.occupiedById ?? null,
            userName: resultNewTable.userName ?? null
          });
          // Enviar notificación WebSocket para actualizar en tiempo real
          notifyTableUpdate(
            resultNewTable.id,
            resultNewTable.status || 'OCCUPIED',
            resultNewTable.currentOperationId ?? null,
            resultNewTable.occupiedById ?? null,
            resultNewTable.userName ?? null
          );
          console.log('✅ Mesa destino actualizada después de transferir');
        }
        
        // Cerrar modal
        setShowTransferPlatesModal(false);
        setSelectedTransferFloorId('');
        setSelectedTransferTableId('');
        
        // Limpiar selecciones
        setItemAssignments({});
        
        // Refetch la operación para obtener los datos actualizados
        const refetchResult = await refetch();
        
        // Actualizar explícitamente los detalles modificados con los datos actualizados
        // Esto asegura que los platos trasladados desaparezcan de la mesa original (filtrar cancelados)
        if (refetchResult.data?.operationByTable?.details) {
          if (refetchResult.data?.operationByTable?.details && refetchResult.data?.operationByTable?.id) {
            const nonCanceledDetails = filterCanceledDetails(refetchResult.data.operationByTable.details, refetchResult.data.operationByTable.id);
            setModifiedDetails([...nonCanceledDetails]);
            console.log('✅ Detalles actualizados después del traslado:', nonCanceledDetails);
          }
        } else if (refetchResult.data?.operationByTable === null) {
          // Si la operación ya no existe (todos los platos fueron trasladados), limpiar los detalles
          setModifiedDetails([]);
          console.log('✅ Todos los platos fueron trasladados, limpiando detalles');
        }
        
        // Llamar callback de éxito si existe
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
        setPaymentError(null);
      } else {
        setPaymentError(result.data?.transferItems?.message || 'Error al transferir los platos');
      }
    } catch (err: any) {
      console.error('Error transfiriendo platos:', err);
      setPaymentError(err.message || 'Error al transferir los platos');
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
              onClick={handlePrecuenta}
              disabled={!operation || operation.status === 'COMPLETED' || loading || isProcessing}
              style={{
                padding: '0.85rem 1.45rem',
                borderRadius: '999px',
                border: 'none',
                background: !operation || operation.status === 'COMPLETED' || loading || isProcessing
                  ? 'rgba(255,255,255,0.08)'
                  : 'linear-gradient(135deg, rgba(245,158,11,0.9), rgba(217,119,6,0.9))',
                color: 'white',
                cursor: !operation || operation.status === 'COMPLETED' || loading || isProcessing ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '0.92rem',
                boxShadow: !operation || operation.status === 'COMPLETED' || loading || isProcessing
                  ? '0 8px 16px rgba(0,0,0,0.1)'
                  : '0 12px 24px rgba(245,158,11,0.3)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                opacity: !operation || operation.status === 'COMPLETED' || loading || isProcessing ? 0.6 : 1
              }}
              onMouseOver={(e) => {
                if (operation && operation.status !== 'COMPLETED' && !loading && !isProcessing) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 16px 28px rgba(245,158,11,0.4)';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = !operation || operation.status === 'COMPLETED' || loading || isProcessing
                  ? '0 8px 16px rgba(0,0,0,0.1)'
                  : '0 12px 24px rgba(245,158,11,0.3)';
              }}
            >
              {isProcessing ? '🖨️ Imprimiendo...' : '🧾 Precuenta'}
            </button>
            {/* Botones de acción rápida */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '0.5rem',
              marginLeft: '0.5rem'
            }}>
              <button
                onClick={() => setShowChangeTableModal(true)}
                disabled={!operation || operation.status === 'COMPLETED' || isProcessing}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: operation?.status === 'COMPLETED'
                    ? '#cbd5e0' 
                    : 'linear-gradient(130deg, #10b981, #059669)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  cursor: operation?.status === 'COMPLETED' || isProcessing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  opacity: operation?.status === 'COMPLETED' ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (operation?.status !== 'COMPLETED' && !isProcessing) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(16,185,129,0.4)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16,185,129,0.3)';
                }}
              >
                {isProcessing ? '...' : operation?.status === 'COMPLETED' ? 'Mesa' : 'Cambiar Mesa'}
              </button>
              <button
                onClick={() => setShowTransferPlatesModal(true)}
                disabled={!operation || operation.status === 'COMPLETED' || isProcessing}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: operation?.status === 'COMPLETED'
                    ? '#cbd5e0' 
                    : 'linear-gradient(130deg, #3b82f6, #2563eb)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  cursor: operation?.status === 'COMPLETED' || isProcessing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  opacity: operation?.status === 'COMPLETED' ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (operation?.status !== 'COMPLETED' && !isProcessing) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(59,130,246,0.4)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)';
                }}
              >
                Transferir
              </button>
              <button
                onClick={() => setShowChangeUserModal(true)}
                disabled={!operation || operation.status === 'COMPLETED' || isProcessing}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: operation?.status === 'COMPLETED'
                    ? '#cbd5e0' 
                    : 'linear-gradient(130deg, #8b5cf6, #7c3aed)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  cursor: operation?.status === 'COMPLETED' || isProcessing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  opacity: operation?.status === 'COMPLETED' ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (operation?.status !== 'COMPLETED' && !isProcessing) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(139,92,246,0.4)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.3)';
                }}
              >
                {isProcessing ? '...' : operation?.status === 'COMPLETED' ? 'Mozo' : 'Cambiar Mozo'}
              </button>
            </div>
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
                flexDirection: 'row',
                gap: isSmallDesktop ? '1.5rem' : '2rem',
                alignItems: 'flex-start'
              }}
            >
              {/* Tabla de productos */}
              <div
                style={{
                  flex: isSmallDesktop ? '1 1 55%' : isMediumDesktop ? '1 1 58%' : '1 1 60%',
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
                    gridTemplateColumns: isSmallDesktop 
                      ? '0.4fr 0.5fr 1.5fr 0.7fr 0.7fr 1.2fr'
                      : isMediumDesktop
                      ? '0.35fr 0.45fr 1.3fr 0.65fr 0.65fr 1.1fr'
                      : '0.3fr 0.4fr 1.2fr 0.6fr 0.6fr 1fr',
                    background: 'linear-gradient(135deg, rgba(102,126,234,0.12), rgba(129,140,248,0.12))',
                    padding: isSmallDesktop ? '0.6rem 0.9rem' : '0.7rem 1rem',
                    fontWeight: 700,
                    color: '#2d3748',
                    fontSize: isSmallDesktop ? '0.75rem' : '0.8rem',
                    letterSpacing: '0.01em'
                  }}
                >
                  <span style={{ textAlign: 'center' }}>Sel.</span>
                  <span style={{ textAlign: 'center' }}>Cant.</span>
                  <span>Producto</span>
                  <span style={{ textAlign: 'right' }}>P. Unit.</span>
                  <span style={{ textAlign: 'right' }}>Total</span>
                  <span style={{ textAlign: 'center' }}>Dividir</span>
                </div>

                {(detailsToUse || []).map((detail: any, index: number) => {
                  const quantity = Number(detail.quantity) || 0;
                  const unitPrice = Number(detail.unitPrice) || 0;
                  const lineTotal =
                    Number(detail.total) || unitPrice * quantity || 0;

                  const isEvenRow = index % 2 === 0;
                  const isSelected = itemAssignments[detail.id || ''];

                  return (
                    <div
                      key={detail.id || `${detail.productId}-${detail.productCode}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isSmallDesktop 
                          ? '0.4fr 0.5fr 1.5fr 0.7fr 0.7fr 1.2fr'
                          : isMediumDesktop
                          ? '0.35fr 0.45fr 1.3fr 0.65fr 0.65fr 1.1fr'
                          : '0.3fr 0.4fr 1.2fr 0.6fr 0.6fr 1fr',
                        padding: isSmallDesktop ? '0.6rem 0.9rem' : '0.7rem 1rem',
                        fontSize: isSmallDesktop ? '0.75rem' : '0.8rem',
                        alignItems: 'center',
                        color: '#1a202c',
                        backgroundColor: isSelected 
                          ? 'rgba(139, 92, 246, 0.1)' 
                          : isEvenRow 
                          ? 'rgba(247,250,252,0.85)' 
                          : 'rgba(255,255,255,0.92)',
                        borderTop: '1px solid rgba(226,232,240,0.7)',
                        borderLeft: isSelected ? '3px solid #8b5cf6' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center'
                      }}>
                        <input
                          type="checkbox"
                          checked={isSelected || false}
                          onChange={() => handleToggleItemSelection(detail.id || '')}
                          style={{
                            width: isSmallDesktop ? '1rem' : '1.1rem',
                            height: isSmallDesktop ? '1rem' : '1.1rem',
                            cursor: 'pointer',
                            accentColor: '#8b5cf6'
                          }}
                        />
                      </div>
                      <span
                        style={{
                          textAlign: 'center',
                          fontWeight: 700,
                          color: '#4c51bf',
                          fontSize: isSmallDesktop ? '0.85rem' : '0.9rem'
                        }}
                      >
                        {quantity}
                      </span>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.25rem'
                      }}>
                        <div style={{ fontWeight: 700, fontSize: isSmallDesktop ? '0.8rem' : '0.85rem' }}>
                          {detail.productName || 'Producto'}
                        </div>
                        {detail.notes && (
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.7rem' }}>
                            <span
                              style={{
                                backgroundColor: 'rgba(255,255,255,0.85)',
                                border: '1px dashed rgba(102,126,234,0.5)',
                                color: '#434190',
                                padding: '0.2rem 0.45rem',
                                borderRadius: '8px'
                              }}
                            >
                              Nota: {detail.notes}
                            </span>
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          textAlign: 'right',
                          color: '#2d3748',
                          fontSize: isSmallDesktop ? '0.8rem' : '0.85rem'
                        }}
                      >
                        {currencyFormatter.format(unitPrice)}
                      </span>
                      <span
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: isSmallDesktop ? '0.85rem' : '0.9rem',
                          color: '#1a202c'
                        }}
                      >
                        {currencyFormatter.format(lineTotal)}
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap'
                        }}
                      >
                        {!detail.id?.includes('-split') && quantity > 1 && (
                          <button
                            onClick={() => handleSplitItem(detail.id)}
                            style={{
                              padding: isSmallDesktop ? '0.3rem 0.6rem' : '0.35rem 0.7rem',
                              borderRadius: '6px',
                              border: 'none',
                              background: 'rgba(139, 92, 246, 0.15)',
                              color: '#8b5cf6',
                              fontWeight: 600,
                              fontSize: isSmallDesktop ? '0.7rem' : '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.25)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                            }}
                          >
                            ✂️ Dividir
                          </button>
                        )}
                        {detail.id?.includes('-split') && (
                          <button
                            onClick={() => handleMergeItem(detail.id)}
                            style={{
                              padding: isSmallDesktop ? '0.3rem 0.6rem' : '0.35rem 0.7rem',
                              borderRadius: '6px',
                              border: 'none',
                              background: 'linear-gradient(130deg, #10b981, #059669)',
                              color: 'white',
                              fontWeight: 600,
                              fontSize: isSmallDesktop ? '0.7rem' : '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(130deg, #059669, #047857)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(130deg, #10b981, #059669)';
                            }}
                          >
                            🔗 Unir
                          </button>
                        )}
                        {!detail.id?.includes('-split') && quantity <= 1 && modifiedDetails.some((d: any) => d.id?.includes(`${detail.id}-split`)) && (
                          <button
                            onClick={() => handleMergeAll(detail.id)}
                            style={{
                              padding: isSmallDesktop ? '0.3rem 0.6rem' : '0.35rem 0.7rem',
                              borderRadius: '6px',
                              border: 'none',
                              background: 'linear-gradient(130deg, #f59e0b, #d97706)',
                              color: 'white',
                              fontWeight: 600,
                              fontSize: isSmallDesktop ? '0.7rem' : '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(130deg, #d97706, #b45309)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(130deg, #f59e0b, #d97706)';
                            }}
                          >
                            🔗 Unir todo
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteItem(detail.id)}
                          style={{
                            padding: isSmallDesktop ? '0.3rem 0.6rem' : '0.35rem 0.7rem',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'linear-gradient(130deg, #ef4444, #dc2626)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: isSmallDesktop ? '0.7rem' : '0.75rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(130deg, #dc2626, #b91c1c)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(130deg, #ef4444, #dc2626)';
                          }}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
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
                  flex: isSmallDesktop ? '1 1 45%' : isMediumDesktop ? '1 1 42%' : '1 1 40%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isSmallDesktop ? '1.25rem' : '1.5rem'
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

              {/* Cliente */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#2d3748',
                      margin: 0
                    }}
                  >
                    Cliente
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCreateClientModal(true)}
                    disabled={isProcessing}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#10b981',
                      color: 'white',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      opacity: isProcessing ? 0.6 : 1
                    }}
                  >
                    + Nuevo Cliente
                  </button>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    placeholder="Buscar cliente por nombre o documento..."
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e0',
                      fontSize: '0.85rem',
                      backgroundColor: 'white',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={clientsLoading || isProcessing}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e0',
                    fontSize: '0.85rem',
                    backgroundColor: 'white',
                    cursor: clientsLoading || isProcessing ? 'not-allowed' : 'pointer'
                  }}
                >
                  {clientsLoading ? (
                    <option value="">Cargando clientes...</option>
                  ) : filteredClients.length === 0 ? (
                    <option value="">{clientSearchTerm ? 'No se encontraron clientes' : 'No hay clientes disponibles'}</option>
                  ) : (
                    <>
                      <option value="">Sin cliente (Consumidor final)</option>
                      {filteredClients.map((client: any) => (
                        <option key={client.id} value={client.id}>
                          {client.name} - {client.documentType} {client.documentNumber}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Pagos Múltiples */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#2d3748',
                      margin: 0
                    }}
                  >
                    Pagos *
                  </label>
                  <button
                    type="button"
                    onClick={addPayment}
                    disabled={isProcessing}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#667eea',
                      color: 'white',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      opacity: isProcessing ? 0.6 : 1
                    }}
                  >
                    + Agregar Pago
                  </button>
                </div>
                
                {payments.map((payment, index) => (
                  <div
                    key={payment.id}
                    style={{
                      marginBottom: '1rem',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f7fafc'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2d3748' }}>
                        Pago {index + 1}
                      </span>
                      {payments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePayment(payment.id)}
                          disabled={isProcessing}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            fontSize: '0.7rem',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            opacity: isProcessing ? 0.6 : 1
                          }}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                    
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#4a5568',
                          marginBottom: '0.3rem'
                        }}
                      >
                        Método de Pago
                      </label>
                      <select
                        value={payment.method}
                        onChange={(e) => updatePayment(payment.id, 'method', e.target.value)}
                        disabled={isProcessing}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e0',
                          fontSize: '0.8rem',
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
                    
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#4a5568',
                          marginBottom: '0.3rem'
                        }}
                      >
                        Monto
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={payment.amount === 0 ? '' : payment.amount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || value === null || value === undefined) {
                            updatePayment(payment.id, 'amount', 0);
                          } else {
                            const numValue = parseFloat(value);
                            updatePayment(payment.id, 'amount', isNaN(numValue) ? 0 : numValue);
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value === '' || e.target.value === null || e.target.value === undefined) {
                            updatePayment(payment.id, 'amount', 0);
                          }
                        }}
                        disabled={isProcessing}
                        placeholder="0.00"
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e0',
                          fontSize: '0.8rem'
                        }}
                      />
                    </div>
                    
                    {(payment.method === 'YAPE' || payment.method === 'PLIN' || payment.method === 'TRANSFER') && (
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#4a5568',
                            marginBottom: '0.3rem'
                          }}
                        >
                          Número de Operación
                        </label>
                        <input
                          type="text"
                          value={payment.referenceNumber}
                          onChange={(e) => updatePayment(payment.id, 'referenceNumber', e.target.value)}
                          disabled={isProcessing}
                          placeholder="Ingrese el número de operación"
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e0',
                            fontSize: '0.8rem'
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Resumen de Pagos */}
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    backgroundColor: isPaymentComplete ? '#d1fae5' : '#fef3c7',
                    border: `1px solid ${isPaymentComplete ? '#a7f3d0' : '#fde68a'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2d3748' }}>
                      Total Pagado:
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2d3748' }}>
                      {currencyFormatter.format(totalPaid)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2d3748' }}>
                      {remaining >= 0 ? 'Falta pagar:' : 'Exceso:'}
                    </span>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 700, 
                      color: isPaymentComplete ? '#059669' : (remaining >= 0 ? '#d97706' : '#dc2626')
                    }}>
                      {currencyFormatter.format(Math.abs(remaining))}
                    </span>
                  </div>
                  {!isPaymentComplete && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#92400e' }}>
                      ⚠️ La suma de los pagos debe ser igual al total
                    </div>
                  )}
                </div>
              </div>

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
                    IGV ({igvPercentage ? `${igvPercentage}%` : '—'})
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
                  onClick={handleProcessPayment}
                  disabled={!operation || operation.status === 'COMPLETED' || !selectedDocumentId || !selectedSerialId || isProcessing || !isPaymentComplete}
                  style={{
                    width: '100%',
                    marginTop: '0.75rem',
                    padding: '0.625rem 1rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: operation?.status === 'COMPLETED' || !selectedDocumentId || !selectedSerialId || !isPaymentComplete
                      ? '#cbd5e0' 
                      : 'linear-gradient(130deg, #4fd1c5, #63b3ed)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    cursor: operation?.status === 'COMPLETED' || !selectedDocumentId || !selectedSerialId || isProcessing || !isPaymentComplete ? 'not-allowed' : 'pointer',
                    boxShadow: '0 8px 16px rgba(79,209,197,0.4)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    opacity: operation?.status === 'COMPLETED' || !selectedDocumentId || !selectedSerialId || !isPaymentComplete ? 0.6 : 1
                  }}
                  onMouseOver={(e) => {
                    if (operation?.status !== 'COMPLETED' && selectedDocumentId && selectedSerialId && !isProcessing && isPaymentComplete) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 20px rgba(79,209,197,0.5)';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(79,209,197,0.4)';
                  }}
                >
                  {isProcessing ? 'Procesando...' : operation?.status === 'COMPLETED' ? 'Orden ya pagada' : !isPaymentComplete ? 'Completa los pagos' : 'Procesar pago'}
                </button>
                <button
                  onClick={() => setShowCancelOperationModal(true)}
                  disabled={!operation || operation.status === 'COMPLETED' || isProcessing}
                  style={{
                    width: '100%',
                    marginTop: '0.75rem',
                    padding: '0.625rem 1rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: operation?.status === 'COMPLETED'
                      ? '#cbd5e0' 
                      : 'linear-gradient(130deg, #ef4444, #dc2626)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    cursor: operation?.status === 'COMPLETED' || isProcessing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 8px 16px rgba(239,68,68,0.4)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    opacity: operation?.status === 'COMPLETED' ? 0.6 : 1
                  }}
                  onMouseOver={(e) => {
                    if (operation?.status !== 'COMPLETED' && !isProcessing) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 20px rgba(239,68,68,0.5)';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(239,68,68,0.4)';
                  }}
                >
                  {isProcessing ? 'Procesando...' : operation?.status === 'COMPLETED' ? 'Orden ya pagada' : 'Anular Orden'}
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

      {/* Modal para cambiar mesa */}
      {showChangeTableModal && (
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
          onClick={() => {
            if (!isProcessing) {
              setShowChangeTableModal(false);
              setSelectedFloorId('');
              setSelectedTableId('');
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '2rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#1a202c',
                  margin: 0
                }}
              >
                Cambiar Mesa
              </h2>
              <button
                onClick={() => {
                  if (!isProcessing) {
                    setShowChangeTableModal(false);
                    setSelectedFloorId('');
                    setSelectedTableId('');
                  }
                }}
                disabled={isProcessing}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  color: '#4a5568',
                  padding: '0.5rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* Selección de piso */}
            <div style={{ marginBottom: '2rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#2d3748',
                  marginBottom: '0.75rem'
                }}
              >
                Seleccionar Piso
              </label>
              {floorsLoading ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#4a5568' }}>
                  Cargando pisos...
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '0.75rem'
                  }}
                >
                  {floorsData?.floorsByBranch?.map((floor: any) => (
                    <button
                      key={floor.id}
                      onClick={() => {
                        setSelectedFloorId(floor.id);
                        setSelectedTableId('');
                      }}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        border: selectedFloorId === floor.id ? '2px solid #10b981' : '2px solid #e2e8f0',
                        background: selectedFloorId === floor.id
                          ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1))'
                          : 'white',
                        color: selectedFloorId === floor.id ? '#10b981' : '#2d3748',
                        fontWeight: selectedFloorId === floor.id ? 700 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontSize: '0.95rem'
                      }}
                      onMouseOver={(e) => {
                        if (selectedFloorId !== floor.id) {
                          e.currentTarget.style.borderColor = '#10b981';
                          e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.05)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (selectedFloorId !== floor.id) {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      {floor.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selección de mesa */}
            {selectedFloorId && (
              <div style={{ marginBottom: '2rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: '#2d3748',
                    marginBottom: '0.75rem'
                  }}
                >
                  Seleccionar Mesa
                </label>
                {tablesLoading ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#4a5568' }}>
                    Cargando mesas...
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: '0.75rem',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      padding: '0.5rem'
                    }}
                  >
                    {tablesData?.tablesByFloor?.map((tableItem: any) => {
                      const isSelected = selectedTableId === tableItem.id;
                      const isCurrentTable = tableItem.id === table?.id;
                      const isOccupied = tableItem.status === 'OCCUPIED' && !isCurrentTable;
                      const accessCheck = canAccessTable(tableItem);
                      const canAccess = accessCheck.canAccess;
                      
                      return (
                        <button
                          key={tableItem.id}
                          onClick={() => {
                            if (!canAccess) {
                              setPaymentError(accessCheck.reason || 'No tiene permiso para acceder a esta mesa.');
                              setTimeout(() => setPaymentError(null), 3000);
                              return;
                            }
                            if (!isOccupied && !isCurrentTable) {
                              setSelectedTableId(tableItem.id);
                            }
                          }}
                          disabled={isOccupied || isCurrentTable || !canAccess}
                          style={{
                            padding: '1rem',
                            borderRadius: '12px',
                            border: isSelected
                              ? '2px solid #10b981'
                              : isCurrentTable
                              ? '2px solid #f59e0b'
                              : isOccupied
                              ? '2px solid #e2e8f0'
                              : '2px solid #e2e8f0',
                            background: isSelected
                              ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1))'
                              : isCurrentTable
                              ? 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.1))'
                              : isOccupied
                              ? '#f7fafc'
                              : 'white',
                            color: isSelected
                              ? '#10b981'
                              : isCurrentTable
                              ? '#f59e0b'
                              : isOccupied
                              ? '#a0aec0'
                              : '#2d3748',
                            fontWeight: isSelected ? 700 : 600,
                            cursor: (isOccupied || isCurrentTable || !canAccess) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            fontSize: '0.9rem',
                            opacity: (isOccupied || isCurrentTable || !canAccess) ? 0.6 : 1,
                            position: 'relative'
                          }}
                          onMouseOver={(e) => {
                            if (!isOccupied && !isCurrentTable && !isSelected) {
                              e.currentTarget.style.borderColor = '#10b981';
                              e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.05)';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isOccupied && !isCurrentTable && !isSelected) {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.backgroundColor = 'white';
                            }
                          }}
                        >
                          {isCurrentTable && (
                            <span
                              style={{
                                position: 'absolute',
                                top: '0.25rem',
                                right: '0.25rem',
                                fontSize: '0.75rem',
                                background: '#f59e0b',
                                color: 'white',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontWeight: 700
                              }}
                            >
                              Actual
                            </span>
                          )}
                          {isOccupied && (
                            <span
                              style={{
                                position: 'absolute',
                                top: '0.25rem',
                                right: '0.25rem',
                                fontSize: '0.75rem',
                                background: '#e2e8f0',
                                color: '#4a5568',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontWeight: 700
                              }}
                            >
                              Ocupada
                            </span>
                          )}
                          <div style={{ marginTop: isCurrentTable || isOccupied ? '1rem' : '0' }}>
                            {tableItem.name}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: isOccupied || isCurrentTable ? '#a0aec0' : '#718096',
                              marginTop: '0.25rem'
                            }}
                          >
                            {tableItem.capacity} plazas
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Botones de acción */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                marginTop: '2rem'
              }}
            >
              <button
                onClick={() => {
                  if (!isProcessing) {
                    setShowChangeTableModal(false);
                    setSelectedFloorId('');
                    setSelectedTableId('');
                  }
                }}
                disabled={isProcessing}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0',
                  background: 'white',
                  color: '#4a5568',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.borderColor = '#cbd5e0';
                    e.currentTarget.style.backgroundColor = '#f7fafc';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleChangeTable}
                disabled={!selectedTableId || isProcessing || selectedTableId === table?.id}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: !selectedTableId || isProcessing || selectedTableId === table?.id
                    ? '#cbd5e0'
                    : 'linear-gradient(130deg, #10b981, #059669)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: !selectedTableId || isProcessing || selectedTableId === table?.id
                    ? 'not-allowed'
                    : 'pointer',
                  boxShadow: !selectedTableId || isProcessing || selectedTableId === table?.id
                    ? 'none'
                    : '0 12px 24px -8px rgba(16,185,129,0.4)',
                  transition: 'all 0.2s',
                  opacity: !selectedTableId || isProcessing || selectedTableId === table?.id ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (selectedTableId && !isProcessing && selectedTableId !== table?.id) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 16px 28px -10px rgba(16,185,129,0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = !selectedTableId || isProcessing || selectedTableId === table?.id
                    ? 'none'
                    : '0 12px 24px -8px rgba(16,185,129,0.4)';
                }}
              >
                {isProcessing ? 'Cambiando...' : 'Cambiar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para cambiar mozo */}
      {showChangeUserModal && (
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
          onClick={() => {
            if (!isProcessing) {
              setShowChangeUserModal(false);
              setSelectedUserId('');
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '2rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#1a202c',
                  margin: 0
                }}
              >
                Cambiar Mozo
              </h2>
              <button
                onClick={() => {
                  if (!isProcessing) {
                    setShowChangeUserModal(false);
                    setSelectedUserId('');
                  }
                }}
                disabled={isProcessing}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  color: '#4a5568',
                  padding: '0.5rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* Lista de mozos */}
            <div style={{ marginBottom: '2rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#2d3748',
                  marginBottom: '0.75rem'
                }}
              >
                Seleccionar Mozo
              </label>
              {availableUsers.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#4a5568' }}>
                  No hay mozos disponibles
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '0.75rem',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    padding: '0.5rem'
                  }}
                >
                  {availableUsers.map((userItem: any) => {
                    const isSelected = selectedUserId === userItem.id;
                    const isCurrentUser = userItem.id === operation?.user?.id;
                    
                    return (
                      <button
                        key={userItem.id}
                        onClick={() => {
                          if (!isCurrentUser && !isProcessing) {
                            setSelectedUserId(userItem.id);
                          }
                        }}
                        disabled={isCurrentUser || isProcessing}
                        style={{
                          padding: '1rem',
                          borderRadius: '12px',
                          border: isSelected
                            ? '2px solid #8b5cf6'
                            : isCurrentUser
                            ? '2px solid #f59e0b'
                            : '2px solid #e2e8f0',
                          background: isSelected
                            ? 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(124,58,237,0.1))'
                            : isCurrentUser
                            ? 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.1))'
                            : 'white',
                          color: isSelected
                            ? '#8b5cf6'
                            : isCurrentUser
                            ? '#f59e0b'
                            : '#2d3748',
                          fontWeight: isSelected ? 700 : 600,
                          cursor: isCurrentUser || isProcessing ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          fontSize: '0.9rem',
                          opacity: isCurrentUser || isProcessing ? 0.6 : 1,
                          position: 'relative',
                          textAlign: 'left'
                        }}
                        onMouseOver={(e) => {
                          if (!isCurrentUser && !isProcessing && !isSelected) {
                            e.currentTarget.style.borderColor = '#8b5cf6';
                            e.currentTarget.style.backgroundColor = 'rgba(139,92,246,0.05)';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!isCurrentUser && !isProcessing && !isSelected) {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.backgroundColor = 'white';
                          }
                        }}
                      >
                        {isCurrentUser && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '0.25rem',
                              right: '0.25rem',
                              fontSize: '0.75rem',
                              background: '#f59e0b',
                              color: 'white',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              fontWeight: 700
                            }}
                          >
                            Actual
                          </span>
                        )}
                        <div style={{ marginTop: isCurrentUser ? '1rem' : '0' }}>
                          <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                            {userItem.firstName} {userItem.lastName}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: isCurrentUser ? '#a0aec0' : '#718096',
                              marginTop: '0.25rem'
                            }}
                          >
                            DNI: {userItem.dni}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Botones de acción */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                marginTop: '2rem'
              }}
            >
              <button
                onClick={() => {
                  if (!isProcessing) {
                    setShowChangeUserModal(false);
                    setSelectedUserId('');
                  }
                }}
                disabled={isProcessing}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0',
                  background: 'white',
                  color: '#4a5568',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.borderColor = '#cbd5e0';
                    e.currentTarget.style.backgroundColor = '#f7fafc';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleChangeUser}
                disabled={!selectedUserId || isProcessing || selectedUserId === operation?.user?.id}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: !selectedUserId || isProcessing || selectedUserId === operation?.user?.id
                    ? '#cbd5e0'
                    : 'linear-gradient(130deg, #8b5cf6, #7c3aed)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: !selectedUserId || isProcessing || selectedUserId === operation?.user?.id
                    ? 'not-allowed'
                    : 'pointer',
                  boxShadow: !selectedUserId || isProcessing || selectedUserId === operation?.user?.id
                    ? 'none'
                    : '0 12px 24px -8px rgba(139,92,246,0.4)',
                  transition: 'all 0.2s',
                  opacity: !selectedUserId || isProcessing || selectedUserId === operation?.user?.id ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (selectedUserId && !isProcessing && selectedUserId !== operation?.user?.id) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 16px 28px -10px rgba(139,92,246,0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = !selectedUserId || isProcessing || selectedUserId === operation?.user?.id
                    ? 'none'
                    : '0 12px 24px -8px rgba(139,92,246,0.4)';
                }}
              >
                {isProcessing ? 'Cambiando...' : 'Cambiar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para transferir platos */}
      {showTransferPlatesModal && (
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
          onClick={() => {
            if (!isProcessing) {
              setShowTransferPlatesModal(false);
              setSelectedTransferFloorId('');
              setSelectedTransferTableId('');
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '2rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#1a202c',
                  margin: 0
                }}
              >
                Transferir Platos
              </h2>
              <button
                onClick={() => {
                  if (!isProcessing) {
                    setShowTransferPlatesModal(false);
                    setSelectedTransferFloorId('');
                    setSelectedTransferTableId('');
                  }
                }}
                disabled={isProcessing}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  color: '#4a5568',
                  padding: '0.5rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* Mostrar productos seleccionados */}
            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f7fafc', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#2d3748', marginBottom: '0.5rem' }}>
                Platos seleccionados para transferir:
              </div>
              <div style={{ fontSize: '0.85rem', color: '#4a5568' }}>
                {Object.keys(itemAssignments).filter(id => itemAssignments[id]).length === 0 ? (
                  <span style={{ color: '#a0aec0' }}>No hay platos seleccionados</span>
                ) : (
                  <span style={{ fontWeight: 700, color: '#3b82f6' }}>
                    {Object.keys(itemAssignments).filter(id => itemAssignments[id]).length} plato(s) seleccionado(s)
                  </span>
                )}
              </div>
            </div>

            {/* Selección de piso */}
            <div style={{ marginBottom: '2rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#2d3748',
                  marginBottom: '0.75rem'
                }}
              >
                Seleccionar Piso
              </label>
              {transferFloorsLoading ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#4a5568' }}>
                  Cargando pisos...
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '0.75rem'
                  }}
                >
                  {transferFloorsData?.floorsByBranch?.map((floor: any) => (
                    <button
                      key={floor.id}
                      onClick={() => {
                        setSelectedTransferFloorId(floor.id);
                        setSelectedTransferTableId('');
                      }}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        border: selectedTransferFloorId === floor.id ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                        background: selectedTransferFloorId === floor.id
                          ? 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(37,99,235,0.1))'
                          : 'white',
                        color: selectedTransferFloorId === floor.id ? '#3b82f6' : '#2d3748',
                        fontWeight: selectedTransferFloorId === floor.id ? 700 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontSize: '0.95rem'
                      }}
                      onMouseOver={(e) => {
                        if (selectedTransferFloorId !== floor.id) {
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.05)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (selectedTransferFloorId !== floor.id) {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      {floor.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selección de mesa */}
            {selectedTransferFloorId && (
              <div style={{ marginBottom: '2rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: '#2d3748',
                    marginBottom: '0.75rem'
                  }}
                >
                  Seleccionar Mesa
                </label>
                {transferTablesLoading ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#4a5568' }}>
                    Cargando mesas...
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: '0.75rem',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      padding: '0.5rem'
                    }}
                  >
                    {transferTablesData?.tablesByFloor?.map((tableItem: any) => {
                      const isSelected = selectedTransferTableId === tableItem.id;
                      const isCurrentTable = tableItem.id === table?.id;
                      
                      return (
                        <button
                          key={tableItem.id}
                          onClick={() => {
                            if (!isCurrentTable && !isProcessing) {
                              setSelectedTransferTableId(tableItem.id);
                            }
                          }}
                          disabled={isCurrentTable || isProcessing}
                          style={{
                            padding: '1rem',
                            borderRadius: '12px',
                            border: isSelected
                              ? '2px solid #3b82f6'
                              : isCurrentTable
                              ? '2px solid #f59e0b'
                              : '2px solid #e2e8f0',
                            background: isSelected
                              ? 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(37,99,235,0.1))'
                              : isCurrentTable
                              ? 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.1))'
                              : 'white',
                            color: isSelected
                              ? '#3b82f6'
                              : isCurrentTable
                              ? '#f59e0b'
                              : '#2d3748',
                            fontWeight: isSelected ? 700 : 600,
                            cursor: isCurrentTable || isProcessing ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            fontSize: '0.9rem',
                            opacity: isCurrentTable || isProcessing ? 0.6 : 1,
                            position: 'relative'
                          }}
                          onMouseOver={(e) => {
                            if (!isCurrentTable && !isProcessing && !isSelected) {
                              e.currentTarget.style.borderColor = '#3b82f6';
                              e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.05)';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isCurrentTable && !isProcessing && !isSelected) {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.backgroundColor = 'white';
                            }
                          }}
                        >
                          {isCurrentTable && (
                            <span
                              style={{
                                position: 'absolute',
                                top: '0.25rem',
                                right: '0.25rem',
                                fontSize: '0.75rem',
                                background: '#f59e0b',
                                color: 'white',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontWeight: 700
                              }}
                            >
                              Actual
                            </span>
                          )}
                          <div style={{ marginTop: isCurrentTable ? '1rem' : '0' }}>
                            {tableItem.name}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: isCurrentTable ? '#a0aec0' : '#718096',
                              marginTop: '0.25rem'
                            }}
                          >
                            {tableItem.capacity} plazas
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Botones de acción */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                marginTop: '2rem'
              }}
            >
              <button
                onClick={() => {
                  if (!isProcessing) {
                    setShowTransferPlatesModal(false);
                    setSelectedTransferFloorId('');
                    setSelectedTransferTableId('');
                  }
                }}
                disabled={isProcessing}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0',
                  background: 'white',
                  color: '#4a5568',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.borderColor = '#cbd5e0';
                    e.currentTarget.style.backgroundColor = '#f7fafc';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleTransferPlates}
                disabled={!selectedTransferTableId || isProcessing || selectedTransferTableId === table?.id || Object.keys(itemAssignments).filter(id => itemAssignments[id]).length === 0}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: !selectedTransferTableId || isProcessing || selectedTransferTableId === table?.id || Object.keys(itemAssignments).filter(id => itemAssignments[id]).length === 0
                    ? '#cbd5e0'
                    : 'linear-gradient(130deg, #3b82f6, #2563eb)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: !selectedTransferTableId || isProcessing || selectedTransferTableId === table?.id || Object.keys(itemAssignments).filter(id => itemAssignments[id]).length === 0
                    ? 'not-allowed'
                    : 'pointer',
                  boxShadow: !selectedTransferTableId || isProcessing || selectedTransferTableId === table?.id || Object.keys(itemAssignments).filter(id => itemAssignments[id]).length === 0
                    ? 'none'
                    : '0 12px 24px -8px rgba(59,130,246,0.4)',
                  transition: 'all 0.2s',
                  opacity: !selectedTransferTableId || isProcessing || selectedTransferTableId === table?.id || Object.keys(itemAssignments).filter(id => itemAssignments[id]).length === 0 ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (selectedTransferTableId && !isProcessing && selectedTransferTableId !== table?.id && Object.keys(itemAssignments).filter(id => itemAssignments[id]).length > 0) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 16px 28px -10px rgba(59,130,246,0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = !selectedTransferTableId || isProcessing || selectedTransferTableId === table?.id || Object.keys(itemAssignments).filter(id => itemAssignments[id]).length === 0
                    ? 'none'
                    : '0 12px 24px -8px rgba(59,130,246,0.4)';
                }}
              >
                {isProcessing ? 'Transfiriendo...' : 'Transferir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para cancelar operación */}
      {showCancelOperationModal && (
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
          onClick={() => {
            if (!isProcessing) {
              setShowCancelOperationModal(false);
              setCancellationReason('');
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#1a202c',
                  margin: 0
                }}
              >
                Anular Orden
              </h2>
              <button
                onClick={() => {
                  if (!isProcessing) {
                    setShowCancelOperationModal(false);
                    setCancellationReason('');
                  }
                }}
                disabled={isProcessing}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  color: '#4a5568',
                  padding: '0.5rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ color: '#4a5568', marginBottom: '1rem', fontSize: '0.95rem' }}>
                ¿Estás seguro de que deseas anular esta orden? Esta acción:
              </p>
              <ul style={{ color: '#4a5568', marginLeft: '1.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
                <li>Cancelará todos los items de la orden</li>
                <li>Devolverá el stock de los productos</li>
                <li>Liberará la mesa automáticamente</li>
                <li>No se puede deshacer</li>
              </ul>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#2d3748',
                  marginBottom: '0.75rem'
                }}
              >
                Razón de cancelación *
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                disabled={isProcessing}
                placeholder="Ingresa la razón de la cancelación..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e0',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Botones de acción */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                marginTop: '2rem'
              }}
            >
              <button
                onClick={() => {
                  if (!isProcessing) {
                    setShowCancelOperationModal(false);
                    setCancellationReason('');
                  }
                }}
                disabled={isProcessing}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0',
                  background: 'white',
                  color: '#4a5568',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.borderColor = '#cbd5e0';
                    e.currentTarget.style.backgroundColor = '#f7fafc';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCancelOperation}
                disabled={!cancellationReason.trim() || isProcessing}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: !cancellationReason.trim() || isProcessing
                    ? '#cbd5e0'
                    : 'linear-gradient(130deg, #ef4444, #dc2626)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: !cancellationReason.trim() || isProcessing
                    ? 'not-allowed'
                    : 'pointer',
                  boxShadow: !cancellationReason.trim() || isProcessing
                    ? 'none'
                    : '0 12px 24px -8px rgba(239,68,68,0.4)',
                  transition: 'all 0.2s',
                  opacity: !cancellationReason.trim() || isProcessing ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (cancellationReason.trim() && !isProcessing) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 16px 28px -10px rgba(239,68,68,0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = !cancellationReason.trim() || isProcessing
                    ? 'none'
                    : '0 12px 24px -8px rgba(239,68,68,0.4)';
                }}
              >
                {isProcessing ? 'Anulando...' : 'Confirmar Anulación'}
              </button>
            </div>
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
      )}

      {/* Modal para crear nuevo cliente */}
      {showCreateClientModal && (
        <CreateClient
          onSuccess={(clientId) => {
            setSelectedClientId(clientId);
            refetchClients();
            setShowCreateClientModal(false);
          }}
          onClose={() => setShowCreateClientModal(false)}
        />
      )}

    </div>
  );
};

export default CashPay;