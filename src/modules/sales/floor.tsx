import React, { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../context/WebSocketContext';
import type { Table, ProcessedTableColors } from '../../types/table';
import { GET_FLOORS_BY_BRANCH, GET_TABLES_BY_FLOOR } from '../../graphql/queries';
import Order from './order';

type FloorProps = {
  onOpenCash?: (table: Table) => void;
};

const Floor: React.FC<FloorProps> = ({ onOpenCash }) => {
  const { companyData } = useAuth();
  
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
  const [showTables, setShowTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [showOrder, setShowOrder] = useState(false);

  // Obtener pisos de la sucursal
  const { data: floorsData, loading: floorsLoading, error: floorsError } = useQuery(GET_FLOORS_BY_BRANCH, {
    variables: { branchId: companyData?.branch.id },
    skip: !companyData?.branch.id
  });

  // Obtener mesas del piso seleccionado
  const { data: tablesData, loading: tablesLoading, error: tablesError, refetch: refetchTables } = useQuery(GET_TABLES_BY_FLOOR, {
    variables: { floorId: selectedFloorId },
    skip: !selectedFloorId
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
      setNotification({ type: 'error', message: message.message });
      setTimeout(() => setNotification(null), 3000);
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
    setShowTables(true);
  };

  const handleBackToFloors = () => {
    setSelectedFloorId('');
    setShowTables(false);
  };

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
    setShowOrder(false);
    setShowStatusModal(true);
  };
  

  // Función para obtener los colores de la mesa según su estado
  const getTableColors = (table: Table): ProcessedTableColors => {
    // Debug: ver qué colores llegan del backend
    console.log(`Mesa ${table.name} - Status: ${table.status} - StatusColors:`, table.statusColors);
    
    // Si tenemos statusColors del backend, los usamos
    if (table.statusColors) {
      try {
        // Si es un string JSON, lo parseamos
        const colors = typeof table.statusColors === 'string' 
          ? JSON.parse(table.statusColors) 
          : table.statusColors;
        
        console.log(`Mesa ${table.name} - Colores parseados:`, colors);
        
        if (colors && typeof colors === 'object') {
          // Usar el formato exacto del método get_status_colors() del modelo Django
          return {
            backgroundColor: colors.background_color || colors.backgroundColor || '#f7fafc',
            borderColor: colors.color || colors.borderColor || '#e2e8f0',
            textColor: colors.text_color || colors.textColor || '#2d3748',
            badgeColor: colors.background_color || colors.backgroundColor || '#667eea',
            badgeTextColor: colors.text_color || colors.textColor || '#ffffff'
          };
        }
      } catch (error) {
        console.warn('Error parsing statusColors:', error);
      }
    }
    
    // Fallback a colores por defecto según el estado (usando los mismos colores del modelo Django)
    switch (table.status) {
      case 'AVAILABLE':
        return {
          backgroundColor: '#d4edda',
          borderColor: '#28a745',
          textColor: '#155724',
          badgeColor: '#d4edda',
          badgeTextColor: '#155724'
        };
      case 'OCCUPIED':
        return {
          backgroundColor: '#f8d7da',
          borderColor: '#dc3545',
          textColor: '#721c24',
          badgeColor: '#f8d7da',
          badgeTextColor: '#721c24'
        };
      case 'TO_PAY':
        return {
          backgroundColor: '#fff3cd',
          borderColor: '#ffc107',
          textColor: '#856404',
          badgeColor: '#fff3cd',
          badgeTextColor: '#856404'
        };
      case 'IN_PROCESS':
        return {
          backgroundColor: '#d1ecf1',
          borderColor: '#17a2b8',
          textColor: '#0c5460',
          badgeColor: '#d1ecf1',
          badgeTextColor: '#0c5460'
        };
      case 'MAINTENANCE':
        return {
          backgroundColor: '#e2e3e5',
          borderColor: '#6c757d',
          textColor: '#383d41',
          badgeColor: '#e2e3e5',
          badgeTextColor: '#383d41'
        };
      default:
        return {
          backgroundColor: '#e2e3e5',
          borderColor: '#6c757d',
          textColor: '#383d41',
          badgeColor: '#e2e3e5',
          badgeTextColor: '#383d41'
        };
    }
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

  if (!showTables) {
    return (
        <div style={{
          height: '100%',
          width: '100%',
          padding: '1rem',
          boxSizing: 'border-box'
        }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#2d3748',
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            Seleccionar Piso
          </h2>
          
          <p style={{
            fontSize: '1rem',
            color: '#718096',
            marginBottom: '2rem',
            textAlign: 'center'
          }}>
            Elige un piso para ver sus mesas
          </p>

          {floorsData?.floorsByBranch?.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#718096'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
              <p style={{ fontSize: '1.125rem', margin: 0 }}>
                No hay pisos disponibles para esta sucursal
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem'
            }}>
              {floorsData?.floorsByBranch?.map((floor: any) => (
                <div
                  key={floor.id}
                  onClick={() => handleFloorSelect(floor.id)}
                  style={{
                    backgroundColor: '#f7fafc',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#667eea';
                    e.currentTarget.style.backgroundColor = '#f0f4ff';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.15)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.backgroundColor = '#f7fafc';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    fontSize: '2.5rem',
                    marginBottom: '1rem'
                  }}>
                    🏢
                  </div>
                  
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: '#2d3748',
                    margin: '0 0 0.5rem 0'
                  }}>
                    {floor.name}
                  </h3>
                  
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.875rem',
                    color: '#718096',
                    marginTop: '1rem'
                  }}>
                    <span>Capacidad: {floor.capacity}</span>
                    <span>Orden: {floor.order}</span>
                  </div>
                  
                  <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    backgroundColor: '#667eea',
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    Piso {floor.order}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista de mesas del piso seleccionado
  const selectedFloor = floorsData?.floorsByBranch?.find((floor: any) => floor.id === selectedFloorId);

  return (
    <>
      {/* CSS para animaciones */}
      <style>{pulseKeyframes}</style>
      
      <div style={{
        height: '100%',
        width: '100%',
        padding: '1rem',
        boxSizing: 'border-box'
      }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header con botón de regreso */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#2d3748',
              margin: 0
            }}>
              {selectedFloor?.name}
            </h2>
            <p style={{
              fontSize: '1rem',
              color: '#718096',
              margin: '0.25rem 0 0 0'
            }}>
              Mesas del piso
            </p>
          </div>
          
          <button
            onClick={handleBackToFloors}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f7fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              color: '#4a5568',
              cursor: 'pointer',
              fontSize: '0.875rem',
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '2rem',
            width: '100%'
          }}>
            {tablesData?.tablesByFloor?.map((table: Table) => {
              const colors = getTableColors(table);
              return (
                <div
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  style={{
                    backgroundColor: colors.backgroundColor,
                    border: `3px solid ${colors.borderColor}`,
                    borderRadius: '16px',
                    padding: '2.5rem',
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    position: 'relative',
                    animation: table.status === 'OCCUPIED' ? 'pulse 2s infinite' : 
                               table.status === 'TO_PAY' ? 'pulseYellow 2s infinite' :
                               table.status === 'IN_PROCESS' ? 'pulseBlue 2s infinite' : 'none',
                    boxShadow: (table.status === 'OCCUPIED' || table.status === 'TO_PAY' || table.status === 'IN_PROCESS') 
                               ? `0 0 0 0 ${colors.borderColor}` : '0 4px 12px rgba(0, 0, 0, 0.1)'
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
                <div style={{
                  fontSize: '3rem',
                  marginBottom: '1.5rem',
                  position: 'relative'
                }}>
                  {/* Icono principal de la mesa */}
                  <div style={{
                    display: 'inline-block',
                    transform: (table.status === 'OCCUPIED' || table.status === 'TO_PAY' || table.status === 'IN_PROCESS') 
                              ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.2s ease'
                  }}>
                    {table.shape === 'CIRCLE' ? '⭕' : 
                     table.shape === 'SQUARE' ? '⬜' : '🟦'}
                  </div>
                  
                  {/* Indicador de estado con icono */}
                  <div style={{
                    position: 'absolute',
                    top: '-0.5rem',
                    right: '-0.5rem',
                    fontSize: '1.25rem',
                    backgroundColor: colors.badgeColor,
                    borderRadius: '50%',
                    width: '2rem',
                    height: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.badgeTextColor,
                    fontWeight: 'bold',
                    border: `3px solid ${colors.borderColor}`
                  }}>
                    {table.status === 'AVAILABLE' ? '✓' : 
                     table.status === 'OCCUPIED' ? '👤' : 
                     table.status === 'TO_PAY' ? '💰' :
                     table.status === 'IN_PROCESS' ? '⚙️' :
                     table.status === 'MAINTENANCE' ? '🔧' : '❓'}
                  </div>
                </div>
                
                <h4 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: colors.textColor,
                  margin: '0 0 1rem 0'
                }}>
                  {table.name}
                </h4>
                
                <div style={{
                  fontSize: '1.125rem',
                  color: '#718096',
                  marginBottom: '1.5rem',
                  fontWeight: '500'
                }}>
                  Capacidad: {table.capacity}
                </div>
                
                <div style={{
                  display: 'inline-block',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '25px',
                  fontSize: '1rem',
                  fontWeight: '700',
                  backgroundColor: colors.badgeColor,
                  color: colors.badgeTextColor
                }}>
                  {table.status === 'AVAILABLE' ? 'Disponible' : 
                   table.status === 'OCCUPIED' ? 'Ocupada' : 
                   table.status === 'TO_PAY' ? 'Por Pagar' :
                   table.status === 'IN_PROCESS' ? 'En Proceso' :
                   table.status === 'MAINTENANCE' ? 'Mantenimiento' : 'Desconocido'}
                </div>
                
                {table.userName && (
                  <div style={{
                    fontSize: '1rem',
                    color: colors.textColor,
                    marginTop: '1rem',
                    backgroundColor: colors.badgeColor,
                    padding: '0.5rem 1rem',
                    borderRadius: '15px',
                    fontWeight: '600',
                    opacity: 0.9
                  }}>
                    👤 {table.userName}
                  </div>
                )}
                
                {/* Indicador de que es clickeable */}
                <div style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#667eea',
                  fontWeight: '600'
                }}>
                  ✏️
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

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
              <button
                onClick={() => {
                  const tableForCash = selectedTable;
                  if (!tableForCash?.currentOperationId) {
                    setNotification({ type: 'error', message: 'Esta mesa no tiene una orden activa para cobrar.' });
                    setTimeout(() => setNotification(null), 3000);
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
          onSuccess={() => {
            // Mostrar notificación de éxito cuando se guarde la orden
            setNotification({ 
              type: 'success', 
              message: `Orden guardada exitosamente. La mesa ${selectedTable.name} ha sido actualizada.` 
            });
            setTimeout(() => setNotification(null), 4000);
            
            // Forzar actualización inmediata de las mesas (además del WebSocket)
            // Esto asegura que las mesas se actualicen incluso si hay un pequeño delay en el WebSocket
            setTimeout(() => {
              refetchTables();
              console.log('🔄 Refetch manual de mesas después de guardar orden');
            }, 500);
          }}
        />
      )}

      {/* Notificación de éxito/error */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: notification.type === 'success' ? '#c6f6d5' : '#fed7d7',
          color: notification.type === 'success' ? '#22543d' : '#742a2a',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          zIndex: 1001,
          maxWidth: '300px',
          fontSize: '0.875rem',
          fontWeight: '500',
          border: `1px solid ${notification.type === 'success' ? '#9ae6b4' : '#feb2b2'}`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '1.25rem' }}>
              {notification.type === 'success' ? '✅' : '❌'}
            </span>
            <span>{notification.message}</span>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default Floor;
