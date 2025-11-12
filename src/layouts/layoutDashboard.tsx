import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, gql } from '@apollo/client';
import { useAuth } from '../hooks/useAuth';
import { WebSocketProvider, useWebSocket } from '../context/WebSocketContext';
import Floor from '../modules/sales/floor';
import CashPay from '../modules/cash/cashPay';
import type { Table } from '../types/table';

const GET_MY_KITCHEN_NOTIFICATIONS = gql`
  query GetMyKitchenNotifications($limit: Int) {
    myKitchenNotifications(limit: $limit) {
      id
      message
      isRead
      createdAt
      operation {
        id
        table {
          id
          name
        }
      }
      operationDetail {
        id
        productName
        quantity
      }
      preparedBy {
        id
        fullName
      }
    }
  }
`;

const formatRelativeTime = (dateString?: string | null) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'Hace un momento';
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Hace un momento';
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
};

interface LayoutDashboardProps {
  children: React.ReactNode;
}

// Componente interno que usa el WebSocket
const LayoutDashboardContent: React.FC<LayoutDashboardProps> = ({ children }) => {
  const navigate = useNavigate();
  const { user, companyData, logout } = useAuth();
  const { disconnect, subscribe } = useWebSocket();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'floors' | 'cash'>('dashboard');
  const [selectedCashTable, setSelectedCashTable] = useState<Table | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const {
    data: notificationsData,
    loading: notificationsLoading,
    error: notificationsError,
    refetch: refetchKitchenNotifications
  } = useQuery(GET_MY_KITCHEN_NOTIFICATIONS, {
    variables: { limit: 20 },
    skip: !user?.id,
    pollInterval: 30000
  });

  useEffect(() => {
    if (notificationsError) {
      console.error('❌ Error al obtener notificaciones de cocina:', notificationsError);
    }
  }, [notificationsError]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    const unsubscribe = subscribe('kitchen_notification', () => {
      refetchKitchenNotifications();
    });
    return () => {
      unsubscribe();
    };
  }, [subscribe, refetchKitchenNotifications, user?.id]);

  useEffect(() => {
    if (!showNotifications) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const notifications = notificationsData?.myKitchenNotifications ?? [];
  const unreadCount = notifications.length;

  const handleLogout = () => {
    // Desconectar WebSocket antes de hacer logout
    disconnect();
    logout();
    navigate('/login-company');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleMenuClick = (view: 'dashboard' | 'floors') => {
    setCurrentView(view);
    setSelectedCashTable(null);
  };

  const handleOpenCash = (table: Table) => {
    setSelectedCashTable(table);
    setCurrentView('cash');
  };

  const handleBackFromCash = () => {
    setCurrentView('floors');
    setSelectedCashTable(null);
  };

  const headerTitle =
    currentView === 'dashboard'
      ? 'Dashboard'
      : currentView === 'floors'
      ? 'Mesas'
      : 'Caja';

  const headerSubtitle =
    currentView === 'dashboard'
      ? `Bienvenido de vuelta, ${user?.firstName}`
      : currentView === 'floors'
      ? 'Gestiona la ocupación y las órdenes de tus mesas.'
      : selectedCashTable
      ? `Procesa el pago de ${selectedCashTable.name}.`
      : 'Selecciona una mesa para revisar su orden.';

  const isFloorsSection = currentView === 'floors' || currentView === 'cash';

  return (
    <div style={{
        height: '100vh',
        width: '100vw',
        maxWidth: '100vw',
        backgroundColor: '#f8fafc',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        position: 'fixed',
        top: 0,
        left: 0,
        overflow: 'hidden',
        display: 'flex'
      }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? '280px' : '80px',
        backgroundColor: '#1a202c',
        color: 'white',
        transition: 'width 0.3s ease',
        position: 'fixed',
        height: '100vh',
        zIndex: 1000,
        overflow: 'hidden',
        boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header del Sidebar */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #2d3748',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {sidebarOpen && (
            <div>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                margin: 0,
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                AppSuma
              </h2>
              <p style={{
                fontSize: '0.875rem',
                color: '#a0aec0',
                margin: '0.25rem 0 0',
                fontWeight: '500'
              }}>
                {companyData?.company.denomination}
              </p>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: 'white',
              padding: '0.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1.25rem',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>

        {/* Información del Usuario */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #2d3748'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}>
              👤
            </div>
            {sidebarOpen && (
              <div>
                <p style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: 'white'
                }}>
                  {user?.fullName}
                </p>
                <p style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  color: '#a0aec0'
                }}>
                  {user?.role}
                </p>
              </div>
            )}
          </div>
          
          {sidebarOpen && (
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              padding: '0.75rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              color: '#a0aec0'
            }}>
              <p style={{ margin: '0 0 0.25rem', fontWeight: '500' }}>
                <strong>Sucursal:</strong> {companyData?.branch.name}
              </p>
              <p style={{ margin: 0 }}>
                <strong>DNI:</strong> {user?.dni}
              </p>
            </div>
          )}
        </div>

        {/* Menú de Navegación */}
        <nav style={{
          padding: '1rem 0',
          flex: 1
        }}>
          <div style={{
            padding: '0.5rem 1.5rem',
            color: '#a0aec0',
            fontSize: '0.75rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.5rem'
          }}>
            {sidebarOpen && 'MENÚ'}
          </div>
          
          {/* Opciones del menú */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}>
            <button
              onClick={() => handleMenuClick('dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: currentView === 'dashboard' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                border: 'none',
                color: currentView === 'dashboard' ? '#667eea' : '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                if (currentView !== 'dashboard') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseOut={(e) => {
                if (currentView !== 'dashboard') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#a0aec0';
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>📊</span>
              {sidebarOpen && 'Dashboard'}
            </button>

            <button
              onClick={() => handleMenuClick('floors')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: isFloorsSection ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                border: 'none',
                color: isFloorsSection ? '#667eea' : '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                if (!isFloorsSection) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseOut={(e) => {
                if (!isFloorsSection) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#a0aec0';
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>🪑</span>
              {sidebarOpen && 'Mesas'}
            </button>
                            
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: 'transparent',
                border: 'none',
                color: '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#a0aec0';
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>📈</span>
              {sidebarOpen && 'Reportes'}
            </button>

            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: 'transparent',
                border: 'none',
                color: '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#a0aec0';
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>⚙️</span>
              {sidebarOpen && 'Configuración'}
            </button>
          </div>
        </nav>

        {/* Footer del Sidebar */}
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid #2d3748'
        }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(245, 87, 108, 0.1)',
              border: 'none',
              color: '#f5576c',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              textAlign: 'left',
              width: '100%',
              borderRadius: '8px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(245, 87, 108, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(245, 87, 108, 0.1)';
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>🚪</span>
            {sidebarOpen && 'Cerrar Sesión'}
          </button>
        </div>
      </div>

      {/* Contenido Principal */}
      <div style={{
        marginLeft: sidebarOpen ? '280px' : '80px',
        width: `calc(100vw - ${sidebarOpen ? '280px' : '80px'})`,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        transition: 'margin-left 0.3s ease'
      }}>
        {/* Header Principal */}
        <header style={{
          backgroundColor: 'white',
          padding: '1rem 2rem',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#2d3748',
              margin: 0
            }}>
              {headerTitle}
            </h1>
            <p style={{
              fontSize: '0.875rem',
              color: '#718096',
              margin: '0.25rem 0 0'
            }}>
              {headerSubtitle}
            </p>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#f7fafc',
              borderRadius: '8px',
              fontSize: '0.875rem',
              color: '#4a5568'
            }}>
              <span>🏢</span>
              <span>{companyData?.branch.name}</span>
            </div>
            <div
              ref={notificationsRef}
              style={{ position: 'relative' }}
            >
              <button
                type="button"
                aria-label="Notificaciones de cocina"
                onClick={() => setShowNotifications((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '42px',
                  height: '42px',
                  borderRadius: '9999px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: showNotifications ? '#edf2f7' : '#f8fafc',
                  color: '#4a5568',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#edf2f7';
                  e.currentTarget.style.borderColor = '#cbd5e0';
                }}
                onMouseOut={(e) => {
                  if (!showNotifications) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '9999px',
                      backgroundColor: '#f56565',
                      color: 'white',
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    width: '320px',
                    maxHeight: '420px',
                    overflowY: 'auto',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.18)',
                    padding: '0.75rem',
                    zIndex: 1200
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem'
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          color: '#2d3748'
                        }}
                      >
                        Notificaciones de cocina
                      </h3>
                      <p
                        style={{
                          margin: '0.15rem 0 0',
                          fontSize: '0.75rem',
                          color: '#718096'
                        }}
                      >
                        Últimos mensajes de los cocineros
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => refetchKitchenNotifications()}
                      style={{
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#4a5568',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                      title="Actualizar"
                    >
                      ⟳
                    </button>
                  </div>
                  {notificationsLoading ? (
                    <div
                      style={{
                        padding: '1rem',
                        textAlign: 'center',
                        color: '#4a5568',
                        fontSize: '0.85rem'
                      }}
                    >
                      Cargando notificaciones...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div
                      style={{
                        padding: '1rem',
                        textAlign: 'center',
                        color: '#4a5568',
                        fontSize: '0.85rem',
                        backgroundColor: '#f7fafc',
                        borderRadius: '10px'
                      }}
                    >
                      No tienes notificaciones pendientes.
                    </div>
                  ) : (
                    notifications.map((notification: any) => {
                      const chefName = notification?.preparedBy?.fullName || 'Cocina';
                      const tableName = notification?.operation?.table?.name || 'Sin mesa';
                      const productName = notification?.operationDetail?.productName;
                      const quantity = notification?.operationDetail?.quantity;
                      return (
                        <div
                          key={notification.id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '0.75rem',
                            marginBottom: '0.5rem',
                            backgroundColor: '#fdf2f8'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.75rem'
                            }}
                          >
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '9999px',
                                backgroundColor: '#fbb6ce',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.1rem'
                              }}
                            >
                              🍽️
                            </div>
                            <div style={{ flex: 1 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: '0.9rem',
                                  fontWeight: 600,
                                  color: '#2d3748'
                                }}
                              >
                                {notification.message}
                              </p>
                              <div
                                style={{
                                  marginTop: '0.35rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.25rem',
                                  fontSize: '0.75rem',
                                  color: '#4a5568'
                                }}
                              >
                                <span>👨‍🍳 {chefName}</span>
                                <span>🪑 Mesa {tableName}</span>
                                {productName && (
                                  <span>
                                    🧾 {quantity ? `${quantity}× ` : ''}
                                    {productName}
                                  </span>
                                )}
                                <span style={{ color: '#a0aec0' }}>
                                  {formatRelativeTime(notification?.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main style={{
          flex: 1,
          padding: currentView === 'dashboard' ? '2rem' : '1rem',
          backgroundColor: '#f8fafc',
          overflow: 'auto',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {currentView === 'dashboard' && children}
          {currentView === 'floors' && <Floor onOpenCash={handleOpenCash} />}
          {currentView === 'cash' && (
            <CashPay
              table={selectedCashTable}
              onBack={handleBackFromCash}
            />
          )}
        </main>
      </div>
    </div>
  );
};

// Componente principal que envuelve con el WebSocketProvider
const LayoutDashboard: React.FC<LayoutDashboardProps> = ({ children }) => {
  return (
    <WebSocketProvider>
      <LayoutDashboardContent>{children}</LayoutDashboardContent>
    </WebSocketProvider>
  );
};

export default LayoutDashboard;
