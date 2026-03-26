import React, { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useWebSocket } from '../../context/WebSocketContext';
import { useToast } from '../../context/ToastContext';
import type { Table, ProcessedTableColors } from '../../types/table';
import { GET_FLOORS_BY_BRANCH, GET_TABLES_BY_FLOOR } from '../../graphql/queries';
import Order from './order';

type FloorProps = {
  onOpenCash?: (table: Table) => void;
};

const Floor: React.FC<FloorProps> = ({ onOpenCash }) => {
  const { companyData, user } = useAuth();
  const { hasPermission } = useUserPermissions();
  const { showToast } = useToast();
  const { breakpoint } = useResponsive();
  
  // Adaptar según tamaño de pantalla
  const isXs = breakpoint === 'xs'; // < 640px
  const isSmall = breakpoint === 'sm'; // 640px - 767px
  const isMedium = breakpoint === 'md'; // 768px - 1023px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  /** Pantallas estrechas: mesas más legibles (menos columnas + fuente mayor) */
  const isNarrowScreen = isXs || isSmall;

  // Columnas del grid: pocas columnas = mesas más grandes (hay espacio bajo la fila)
  const tablesGridColumns =
    isNarrowScreen ? 'repeat(4, 1fr)' : isMedium ? 'repeat(6, 1fr)' : isSmallDesktop ? 'repeat(7, 1fr)' : 'repeat(8, 1fr)';
  const floorsGridColumns = isNarrowScreen ? 'repeat(5, 1fr)' : 'repeat(10, 1fr)';

  const titleFontSize = isNarrowScreen ? '1.35rem' : isMedium ? '1.3rem' : isSmallDesktop ? '1.375rem' : '1.5rem';

  // Tipografía y tamaño táctil dentro de cada mesa
  const tableNameFont = isNarrowScreen ? '1.155rem' : isMedium ? '1.0925rem' : isSmallDesktop ? '1.0925rem' : '1.4rem';
  const tableBadgeFont = isNarrowScreen ? '0.985rem' : isMedium ? '0.9125rem' : isSmallDesktop ? '0.9125rem' : '1.2rem';
  const tableWaiterFont = isNarrowScreen ? '0.985rem' : isMedium ? '0.9125rem' : isSmallDesktop ? '0.9125rem' : '1.2rem';
  const tableCellPadding = isNarrowScreen ? '0.55rem' : isMedium ? '0.55rem' : isSmallDesktop ? '0.65rem' : '0.75rem';
  const tablesGridGap = isNarrowScreen ? '0.5rem' : isMedium ? '0.55rem' : isSmallDesktop ? '0.6rem' : '0.7rem';
  /** Altura mínima mesas rectangulares (las redondas usan aspect-ratio 1:1) */
  const tableRectMinHeight = isNarrowScreen ? '5.5rem' : isMedium ? '6rem' : isSmallDesktop ? '6.25rem' : '6.75rem';

  // CSS para animación de pulso (adaptable a diferentes colores)
  const pulseKeyframes = `
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(220, 53, 69, 0);
      }
    }
    
    @keyframes pulseYellow {
      0% {
        box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.7);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(255, 193, 7, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(255, 193, 7, 0);
      }
    }
    
    @keyframes pulseBlue {
      0% {
        box-shadow: 0 0 0 0 rgba(23, 162, 184, 0.7);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(23, 162, 184, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(23, 162, 184, 0);
      }
    }
  `;
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showOrder, setShowOrder] = useState(false);

  // Obtener pisos de la sucursal
  const { data: floorsData, loading: floorsLoading, error: floorsError } = useQuery(GET_FLOORS_BY_BRANCH, {
    variables: { branchId: companyData?.branch.id },
    skip: !companyData?.branch.id,
    fetchPolicy: 'network-only'
  });

  // Obtener mesas del piso seleccionado (siempre desde red para ver cambios de otros mozos)
  const { data: tablesData, loading: tablesLoading, error: tablesError, refetch: refetchTables } = useQuery(GET_TABLES_BY_FLOOR, {
    variables: { floorId: selectedFloorId },
    skip: !selectedFloorId,
    fetchPolicy: 'network-only'
  });

  // WebSocket para cambios en tiempo real usando el contexto
  const { subscribe } = useWebSocket();

  // Suscribirse a eventos del WebSocket
  useEffect(() => {
    // Suscribirse a connection_established
    const unsubscribeConnection = subscribe('connection_established', (message) => {
      console.log('✅ Conexión establecida:', {
        user: message.user,
        branch: message.branch,
        timestamp: message.timestamp
      });
    });

    // Suscribirse a tables_snapshot
    const unsubscribeSnapshot = subscribe('tables_snapshot', (message) => {
      console.log('📊 Snapshot de mesas recibido:', message.tables?.length, 'mesas');
      refetchTables();
    });

    // Suscribirse a table_update
    const unsubscribeTableUpdate = subscribe('table_update', (message) => {
      console.log(`🔄 Mesa ${message.table_id} actualizada:`, {
        status: message.status,
        operationId: message.current_operation_id,
        userName: message.occupied_by_name,
        timestamp: message.timestamp
      });
      
      // Refetch inmediato para actualizar los colores de la mesa
      refetchTables().then(() => {
        console.log(`✅ Mesas actualizadas después de table_update para mesa ${message.table_id}`);
      }).catch((error) => {
        console.error('❌ Error al refetch mesas:', error);
      });
    });

    // Suscribirse a errores
    const unsubscribeError = subscribe('error', (message) => {
      console.error('❌ Error del WebSocket:', message.message);
      showToast(message.message, 'error');
    });

    // Suscribirse a pong
    const unsubscribePong = subscribe('pong', (message) => {
      console.log('🏓 Pong recibido:', message.timestamp);
    });

    // Cleanup: desuscribirse de todos los eventos
    return () => {
      unsubscribeConnection();
      unsubscribeSnapshot();
      unsubscribeTableUpdate();
      unsubscribeError();
      unsubscribePong();
    };
  }, [subscribe, refetchTables]);

  const handleFloorSelect = (floorId: string) => {
    setSelectedFloorId(floorId);
  };

  const handleBackToFloors = () => {
    setSelectedFloorId('');
  };

  // Función para verificar si el usuario puede acceder a una mesa específica (por permisos)
  const canAccessTable = (table: Table): { canAccess: boolean; reason?: string } => {
    // Quien tiene permiso de cobrar (sales.pay) puede acceder para procesar pagos
    if (hasPermission('sales.pay')) {
      return { canAccess: true };
    }

    // Si la mesa no está ocupada, cualquier usuario puede acceder
    if (!table.currentOperationId || !table.occupiedById) {
      return { canAccess: true };
    }

    // Si la mesa está ocupada, verificar el modo multi-waiter
    const isMultiWaiterEnabled = companyData?.branch?.isMultiWaiterEnabled || false;

    // Si multi-waiter está habilitado, cualquier usuario puede acceder
    if (isMultiWaiterEnabled) {
      return { canAccess: true };
    }

    // Si multi-waiter está deshabilitado, solo el usuario que creó la orden puede acceder
    const tableOccupiedById = String(table.occupiedById);
    const currentUserId = String(user?.id);

    if (tableOccupiedById === currentUserId) {
      return { canAccess: true };
    }

    // El usuario no es el que creó la orden
    return { 
      canAccess: false, 
      reason: `Esta mesa está siendo atendida por ${table.userName || 'otro usuario'}. Solo el usuario que creó la orden puede acceder a esta mesa.` 
    };
  };

  const isMozo = (user?.role || '').toUpperCase() === 'WAITER';

  const handleTableClick = (table: Table) => {
    // Verificar si el usuario puede acceder a esta mesa
    const accessCheck = canAccessTable(table);
    
    if (!accessCheck.canAccess) {
      showToast(accessCheck.reason || 'No tiene permiso para acceder a esta mesa.', 'error');
      return;
    }
    
    setSelectedTable(table);
    const hasExistingOrder = Boolean(table.currentOperationId) || table.status === 'OCCUPIED' || table.status === 'TO_PAY';
    
    // Solo para mozos: nunca mostrar el modal Orden/Caja, ir siempre directo a order.tsx
    if (isMozo) {
      setShowStatusModal(false);
      setShowOrder(true);
      return;
    }
    
    // Caja, Admin, etc.: si la mesa tiene orden, mostrar modal para elegir Orden o Caja
    if (hasExistingOrder) {
      setShowOrder(false);
      setShowStatusModal(true);
    } else {
      setShowStatusModal(false);
      setShowOrder(true);
    }
  };
  

  // Colores por defecto según el estado (texto oscuro para buena legibilidad)
  const DEFAULT_STATUS_COLORS: Record<string, ProcessedTableColors> = {
    'AVAILABLE': {
      backgroundColor: '#86efac',
      borderColor: '#15803d',
      textColor: '#052e16',
      badgeColor: '#15803d',
      badgeTextColor: '#ffffff'
    },
    'OCCUPIED': {
      backgroundColor: '#fca5a5',
      borderColor: '#b91c1c',
      textColor: '#450a0a',
      badgeColor: '#b91c1c',
      badgeTextColor: '#ffffff'
    },
    'TO_PAY': {
      backgroundColor: '#fde047',
      borderColor: '#ca8a04',
      textColor: '#422006',
      badgeColor: '#ca8a04',
      badgeTextColor: '#ffffff'
    },
    'IN_PROCESS': {
      backgroundColor: '#67e8f9',
      borderColor: '#0e7490',
      textColor: '#083344',
      badgeColor: '#0e7490',
      badgeTextColor: '#ffffff'
    },
    'MAINTENANCE': {
      backgroundColor: '#cbd5e1',
      borderColor: '#475569',
      textColor: '#0f172a',
      badgeColor: '#475569',
      badgeTextColor: '#ffffff'
    }
  };

  // Función para obtener los colores de la mesa según su estado
  const getTableColors = (table: Table): ProcessedTableColors => {
    // Primero intentamos obtener los colores por defecto del estado
    const defaultColors = DEFAULT_STATUS_COLORS[table.status] || DEFAULT_STATUS_COLORS['MAINTENANCE'];
    
    // Si tenemos statusColors del backend, intentamos usarlos
    if (table.statusColors) {
      try {
        // Si es un string JSON, lo parseamos
        let colors: any;
        if (typeof table.statusColors === 'string') {
          // Verificar que sea un JSON válido
          if (table.statusColors.startsWith('{')) {
            colors = JSON.parse(table.statusColors);
          } else {
            console.warn(`Mesa ${table.name} - statusColors no es JSON válido:`, table.statusColors);
            return defaultColors;
          }
        } else {
          colors = table.statusColors;
        }
        
        // Solo usamos los colores del backend si tienen los campos requeridos
        if (colors && typeof colors === 'object' && (colors.color || colors.background_color)) {
          return {
            backgroundColor: colors.background_color || defaultColors.backgroundColor,
            borderColor: colors.color || defaultColors.borderColor,
            textColor: colors.text_color || defaultColors.textColor,
            badgeColor: colors.color || defaultColors.badgeColor,
            badgeTextColor: '#ffffff'
          };
        }
      } catch (error) {
        console.warn(`Mesa ${table.name} - Error parsing statusColors:`, error);
      }
    }
    
    // Usar colores por defecto del estado
    return defaultColors;
  };

  if (floorsLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        fontSize: '1.125rem',
        color: '#718096'
      }}>
        Cargando pisos...
      </div>
    );
  }

  if (floorsError) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        fontSize: '1.125rem',
        color: '#e53e3e'
      }}>
        Error al cargar los pisos: {floorsError.message}
      </div>
    );
  }

  const selectedFloor = floorsData?.floorsByBranch?.find((floor: any) => floor.id === selectedFloorId);

  return (
    <>
      {/* CSS para animaciones */}
      <style>{pulseKeyframes}</style>
      
      <div style={{
        height: '100%',
        width: '100%',
        padding: '1rem',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Sección pisos - con scroll */}
        <div style={{
          flexShrink: 0,
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: isNarrowScreen ? '0.75rem' : isMedium ? '1rem' : '1.25rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {floorsData?.floorsByBranch?.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: isNarrowScreen ? '1.5rem' : isMedium ? '2rem' : '2.5rem',
              color: '#718096'
            }}>
              <div style={{ fontSize: isNarrowScreen ? '2rem' : '2.5rem', marginBottom: '0.5rem' }}>🏢</div>
              <p style={{ fontSize: isNarrowScreen ? '0.9375rem' : '1rem', margin: 0 }}>
                No hay pisos disponibles para esta sucursal
              </p>
            </div>
          ) : (
            <div style={{
              maxHeight: isNarrowScreen ? '160px' : isMedium ? '170px' : '180px',
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: '0.25rem',
              scrollbarWidth: 'thin'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: floorsGridColumns,
                gap: isNarrowScreen ? '0.5rem' : isMedium ? '0.625rem' : isSmallDesktop ? '0.75rem' : '0.875rem',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                {floorsData?.floorsByBranch?.map((floor: any) => (
                  <div
                    key={floor.id}
                    onClick={() => handleFloorSelect(floor.id)}
                    title={floor.name}
                    style={{
                      backgroundColor: selectedFloorId === floor.id ? '#eef2ff' : '#f7fafc',
                      border: selectedFloorId === floor.id ? '1.5px solid #667eea' : '1.5px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: isNarrowScreen ? '0.55rem' : isMedium ? '0.625rem' : isSmallDesktop ? '0.75rem' : '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      minWidth: 0,
                      boxSizing: 'border-box'
                    }}
                    onMouseOver={(e) => {
                      if (selectedFloorId !== floor.id) {
                        e.currentTarget.style.borderColor = '#667eea';
                        e.currentTarget.style.backgroundColor = '#f0f4ff';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.15)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (selectedFloorId !== floor.id) {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.backgroundColor = '#f7fafc';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <div style={{
                      fontSize: isNarrowScreen ? '1.125rem' : isMedium ? '1.125rem' : isSmallDesktop ? '1.25rem' : '1.375rem',
                      marginBottom: '0.25rem',
                      lineHeight: 1
                    }}>
                      🏢
                    </div>
                    <h3 style={{
                      fontSize: isNarrowScreen ? '0.75rem' : isMedium ? '0.68rem' : isSmallDesktop ? '0.72rem' : '0.8rem',
                      fontWeight: '600',
                      color: '#2d3748',
                      margin: '0 0 0.125rem 0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'normal',
                      width: '100%',
                      lineHeight: 1.15,
                      wordBreak: 'break-word',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      minHeight: '2.3em'
                    }}>
                      {floor.name}
                    </h3>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: isNarrowScreen ? '0.65rem' : isMedium ? '0.6rem' : isSmallDesktop ? '0.6rem' : '0.65rem',
                      color: '#718096',
                      marginTop: '0.25rem',
                      lineHeight: 1.2
                    }}>
                      <span>{floor.capacity}</span>
                      <span>#{floor.order}</span>
                    </div>
                    <div style={{
                      position: 'absolute',
                      top: '0.25rem',
                      right: '0.25rem',
                      backgroundColor: selectedFloorId === floor.id ? '#667eea' : '#667eea',
                      color: 'white',
                      padding: '0.1rem 0.375rem',
                      borderRadius: '12px',
                      fontSize: isNarrowScreen ? '0.62rem' : isMedium ? '0.56rem' : isSmallDesktop ? '0.56rem' : '0.625rem',
                      fontWeight: '600',
                      lineHeight: 1.2
                    }}>
                      {floor.order}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sección mesas - solo cuando hay un piso seleccionado */}
        {selectedFloorId && (
          <div style={{
            flex: 1,
            minHeight: 0,
            marginTop: '1rem',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: isNarrowScreen ? '0.75rem' : isMedium ? '1rem' : isSmallDesktop ? '1rem' : '1.25rem',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              width: '100%',
              boxSizing: 'border-box',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Header con botón de regreso */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: isNarrowScreen ? '1rem' : isMedium ? '1.25rem' : '1.5rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid #e2e8f0',
                flexWrap: 'wrap',
                gap: '0.5rem',
                flexShrink: 0
              }}>
                <h2 style={{
                  fontSize: titleFontSize,
                  fontWeight: '700',
                  color: '#2d3748',
                  margin: 0
                }}>
                  {selectedFloor?.name}
                </h2>
                <button
                  onClick={handleBackToFloors}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: isNarrowScreen ? '0.55rem 1rem' : isMedium ? '0.625rem 1.25rem' : '0.75rem 1.5rem',
                    backgroundColor: '#f7fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    color: '#4a5568',
                    cursor: 'pointer',
                    fontSize: isNarrowScreen ? '0.875rem' : '0.8125rem',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#edf2f7';
                    e.currentTarget.style.borderColor = '#cbd5e0';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#f7fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  ← Volver a pisos
                </button>
              </div>

              {/* Lista de mesas */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {tablesLoading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
            fontSize: '1.125rem',
            color: '#718096'
          }}>
            Cargando mesas...
          </div>
        ) : tablesError ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
            fontSize: '1.125rem',
            color: '#e53e3e'
          }}>
            Error al cargar las mesas: {tablesError.message}
          </div>
        ) : tablesData?.tablesByFloor?.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#718096'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🪑</div>
            <p style={{ fontSize: '1.125rem', margin: 0 }}>
              No hay mesas en este piso
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: tablesGridColumns,
            gap: tablesGridGap,
            width: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}>
            {tablesData?.tablesByFloor?.map((table: Table) => {
              const colors = getTableColors(table);
              // Determinar si la mesa es redonda (ROUND del backend o CIRCLE)
              const tableShape = table.shape as string;
              const isRoundTable = tableShape === 'ROUND' || tableShape === 'CIRCLE';
              return (
                <div
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  style={{
                    backgroundColor: colors.backgroundColor,
                    border: isRoundTable ? `3px solid ${colors.borderColor}` : `1.5px solid ${colors.borderColor}`,
                    borderRadius: isRoundTable ? '50%' : '8px',
                    padding: tableCellPadding,
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                    cursor: canAccessTable(table).canAccess ? 'pointer' : 'not-allowed',
                    opacity: canAccessTable(table).canAccess ? 1 : 0.6,
                    position: 'relative',
                    // Para mesas redondas, hacer el contenedor cuadrado para que el 50% funcione
                    aspectRatio: isRoundTable ? '1 / 1' : 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: table.status === 'OCCUPIED' ? 'pulse 2s infinite' : 
                               table.status === 'TO_PAY' ? 'pulseYellow 2s infinite' :
                               table.status === 'IN_PROCESS' ? 'pulseBlue 2s infinite' : 'none',
                    boxShadow: isRoundTable 
                      ? (table.status === 'OCCUPIED' || table.status === 'TO_PAY' || table.status === 'IN_PROCESS')
                        ? `0 0 0 0 ${colors.borderColor}` 
                        : `0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 2px ${colors.borderColor}40`
                      : (table.status === 'OCCUPIED' || table.status === 'TO_PAY' || table.status === 'IN_PROCESS')
                        ? `0 0 0 0 ${colors.borderColor}` 
                        : '0 2px 8px rgba(0, 0, 0, 0.1)',
                    minWidth: 0,
                    ...(isRoundTable ? {} : { minHeight: tableRectMinHeight }),
                    overflow: 'hidden',
                    boxSizing: 'border-box'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#667eea';
                    e.currentTarget.style.backgroundColor = '#f0f4ff';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = colors.borderColor;
                    e.currentTarget.style.backgroundColor = colors.backgroundColor;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                <h4 style={{
                  fontSize: tableNameFont,
                  fontWeight: '700',
                  color: colors.textColor,
                  margin: '0 0 0.125rem 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                  lineHeight: 1.2,
                  textShadow: '0 1px 2px rgba(0,0,0,0.15), 0 0 1px rgba(255,255,255,0.5)'
                }}>
                  {table.name}
                </h4>
                
                <div style={{
                  display: 'inline-block',
                  padding: isNarrowScreen ? '0.18rem 0.45rem' : isMedium ? '0.16rem 0.5rem' : isSmallDesktop ? '0.16rem 0.5rem' : '0.2rem 0.625rem',
                  borderRadius: '12px',
                  fontSize: tableBadgeFont,
                  fontWeight: '700',
                  backgroundColor: colors.badgeColor,
                  color: colors.badgeTextColor,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%'
                }}>
                  {table.status === 'AVAILABLE' ? 'Disp' : 
                   table.status === 'OCCUPIED' ? 'Ocup' : 
                   table.status === 'TO_PAY' ? 'Pagar' :
                   table.status === 'IN_PROCESS' ? 'Proc' :
                   table.status === 'MAINTENANCE' ? 'Mant' : '?'}
                </div>
                
                {/* Solo mostrar el nombre del mozo si la mesa NO está disponible */}
                {table.userName && table.status !== 'AVAILABLE' && (
                  <div style={{
                    fontSize: tableWaiterFont,
                    color: colors.badgeTextColor,
                    marginTop: '0.125rem',
                    backgroundColor: colors.badgeColor,
                    padding: isNarrowScreen ? '0.16rem 0.3rem' : isMedium ? '0.15rem 0.375rem' : isSmallDesktop ? '0.15rem 0.375rem' : '0.2rem 0.5rem',
                    borderRadius: '8px',
                    fontWeight: '700',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                    lineHeight: 1.2,
                    textShadow: '0 1px 1px rgba(0,0,0,0.3)'
                  }}>
                    {table.userName}
                  </div>
                )}
                
              </div>
              );
            })}
          </div>
        )}
              </div>
              </div>
            </div>
          )}

      {/* Modal de opciones de mesa */}
      {showStatusModal && selectedTable && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '420px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#2d3748',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              Elige una opción
            </h3>
            
            <div style={{
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '2rem',
                marginBottom: '0.5rem'
              }}>
                {selectedTable.shape === 'CIRCLE' ? '⭕' : 
                 selectedTable.shape === 'SQUARE' ? '⬜' : '🟦'}
              </div>
              <h4 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#2d3748',
                margin: '0 0 0.25rem 0'
              }}>
                {selectedTable.name}
              </h4>
              <p style={{
                fontSize: '0.875rem',
                color: '#718096',
                margin: 0
              }}>
                Capacidad: {selectedTable.capacity}
              </p>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {selectedTable && canAccessTable(selectedTable).canAccess && (
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setShowOrder(true);
                  }}
                  style={{
                    padding: '0.9rem 1.25rem',
                    backgroundColor: '#667eea',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: 600
                  }}
                >
                  Orden
                </button>
              )}
              <button
                onClick={() => {
                  const tableForCash = selectedTable;
                  if (!tableForCash?.currentOperationId) {
                    showToast('Esta mesa no tiene una orden activa para cobrar.', 'error');
                    return;
                  }
                  setShowStatusModal(false);
                  setShowOrder(false);
                  onOpenCash?.(tableForCash);
                  setSelectedTable(null);
                }}
                style={{
                  padding: '0.9rem 1.25rem',
                  backgroundColor: '#f7fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  color: '#2d3748',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 600
                }}
              >
                Caja
              </button>
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedTable(null);
                }}
                style={{
                  padding: '0.75rem 1.25rem',
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  color: '#4a5568',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 500
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Orden */}
      {showOrder && selectedTable && (
        <Order
          table={selectedTable}
          onClose={() => {
            setShowOrder(false);
            setSelectedTable(null);
          }}
          onSuccess={async () => {
            showToast(`Orden guardada exitosamente. La mesa ${selectedTable.name} ha sido actualizada.`, 'success');
            // Refetch inmediato de las mesas para actualizar colores
            console.log('🔄 Refetch inmediato de mesas después de guardar orden');
            try {
              await refetchTables();
              console.log('✅ Mesas actualizadas correctamente');
            } catch (error) {
              console.error('❌ Error al actualizar mesas:', error);
            }
          }}
        />
      )}

      </div>
    </>
  );
};

export default Floor;
