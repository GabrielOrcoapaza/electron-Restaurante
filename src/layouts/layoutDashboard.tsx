import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, gql } from '@apollo/client';
import { useAuth } from '../hooks/useAuth';
import { useResponsive } from '../hooks/useResponsive';
import { WebSocketProvider, useWebSocket } from '../context/WebSocketContext';
import Floor from '../modules/sales/floor';
import CashPay from '../modules/cash/cashPay';
import Cashs from '../modules/cash/cashs';
import Message from '../modules/cash/message';
import CreateUser from '../modules/user/createUser';
import Products from '../modules/products/Products';
import Inventories from '../modules/inventories/Inventories';
import Kardex from '../modules/inventories/kardex';
import Purchase from '../modules/purchase/Purchase';
import ReportSale from '../modules/reports/reportSale';
import Observation from '../modules/configuration/observation';
import { GET_MY_UNREAD_MESSAGES } from '../graphql/queries';
import { MARK_MESSAGE_READ } from '../graphql/mutations';
import type { Table } from '../types/table';

const GET_MY_KITCHEN_NOTIFICATIONS = gql`
  query GetMyKitchenNotifications($limit: Int) {
    myKitchenNotifications(limit: $limit) {
      id
      message
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
  const { breakpoint } = useResponsive();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Adaptar según tamaño de pantalla de PC
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  const isMediumDesktop = breakpoint === 'xl'; // 1280px - 1535px
  
  // Tamaños adaptativos
  const sidebarWidth = sidebarOpen ? (isSmallDesktop ? '260px' : '280px') : '80px';
  const headerPadding = isSmallDesktop ? '1rem 1.5rem' : isMediumDesktop ? '1rem 1.75rem' : '1rem 2rem';
  const headerFontSize = isSmallDesktop ? '1.375rem' : '1.5rem';
  const headerSubFontSize = isSmallDesktop ? '0.8125rem' : '0.875rem';
  const [currentView, setCurrentView] = useState<'dashboard' | 'floors' | 'cash' | 'cashs' | 'messages' | 'employees' | 'products' | 'inventory' | 'kardex' | 'purchase' | 'reports' | 'configuration'>('dashboard');
  const [selectedCashTable, setSelectedCashTable] = useState<Table | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const [hiddenNotificationIds, setHiddenNotificationIds] = useState<string[]>([]);
  const previousNotificationIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);

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

  const {
    data: broadcastMessagesData,
    loading: broadcastMessagesLoading,
    error: broadcastMessagesError,
    refetch: refetchBroadcastMessages
  } = useQuery(GET_MY_UNREAD_MESSAGES, {
    skip: !user?.id,
    pollInterval: 10000 // Polling cada 10 segundos como respaldo, pero el WebSocket actualiza inmediatamente
  });

  const [markMessageReadMutation] = useMutation(MARK_MESSAGE_READ);

  useEffect(() => {
    if (notificationsError) {
      console.error('❌ Error al obtener notificaciones de cocina:', notificationsError);
    }
  }, [notificationsError]);

  useEffect(() => {
    if (broadcastMessagesError) {
      console.error('❌ Error al obtener mensajes broadcast:', broadcastMessagesError);
    }
  }, [broadcastMessagesError]);
  
  useEffect(() => {
    if (!user?.id) {
      return;
    }
    const unsubscribeKitchen = subscribe('kitchen_notification', () => {
      refetchKitchenNotifications();
    });
    const unsubscribeBroadcast = subscribe('broadcast_message', (message: any) => {
      // Actualizar notificaciones inmediatamente cuando llegue un mensaje broadcast
      // El servidor ya filtra los mensajes según los recipients, así que actualizamos directamente
      console.log('📬 Mensaje broadcast recibido por WebSocket:', message);
      refetchBroadcastMessages();
    });
    return () => {
      unsubscribeKitchen();
      unsubscribeBroadcast();
    };
  }, [subscribe, refetchKitchenNotifications, refetchBroadcastMessages, user?.id]);

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

  // Función para verificar si el usuario debe ver un mensaje broadcast según su rol
  const shouldUserSeeMessage = (messageRecipients: string, userRole: string | undefined): boolean => {
    if (!userRole) return false;
    
    // Si el mensaje es para todos, todos lo ven
    if (messageRecipients === 'ALL') return true;
    
    // Mapear roles del usuario a los valores de recipients
    const roleMapping: Record<string, string> = {
      'WAITER': 'WAITERS',
      'COOK': 'COOKS',
      'CASHIER': 'CASHIERS',
      'ADMIN': 'ADMINS',
    };
    
    // Verificar si el rol del usuario coincide con el destinatario del mensaje
    const userRecipientGroup = roleMapping[userRole.toUpperCase()];
    return userRecipientGroup === messageRecipients;
  };

  // Notificaciones de cocina
  const kitchenNotifications = notificationsData?.myKitchenNotifications ?? [];
  const unreadKitchenNotifications = useMemo(() => 
    kitchenNotifications.filter((notification: any) => !notification?.isRead),
    [kitchenNotifications]
  );
  
  // Mensajes broadcast - filtrar solo los que corresponden al rol del usuario
  const broadcastMessages = useMemo(() => {
    const allMessages = broadcastMessagesData?.myUnreadMessages ?? [];
    return allMessages.filter((message: any) => 
      shouldUserSeeMessage(message.recipients, user?.role)
    );
  }, [broadcastMessagesData?.myUnreadMessages, user?.role]);
  
  // Combinar ambas notificaciones
  const allNotifications = useMemo(() => [
    ...unreadKitchenNotifications.map((n: any) => ({ ...n, type: 'kitchen' })),
    ...broadcastMessages.map((m: any) => ({ ...m, type: 'broadcast' }))
  ].sort((a: any, b: any) => {
    // Ordenar por fecha, más recientes primero
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  }), [unreadKitchenNotifications, broadcastMessages]);

  const visibleNotifications = allNotifications.filter(
    (notification: any) => !hiddenNotificationIds.includes(notification?.id)
  );
  const unreadCount = visibleNotifications.length;

  useEffect(() => {
    if (!allNotifications.length) {
      setHiddenNotificationIds([]);
      previousNotificationIdsRef.current = new Set();
      return;
    }
    setHiddenNotificationIds((prev) =>
      prev.filter((hiddenId) => allNotifications.some((notification: any) => notification?.id === hiddenId))
    );
  }, [allNotifications]);

  // Detectar nuevas notificaciones y abrir el modal automáticamente
  useEffect(() => {
    if (!allNotifications.length) {
      previousNotificationIdsRef.current = new Set();
      // Si no hay notificaciones, no es la carga inicial (ya se procesaron datos)
      if (!isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
      }
      return;
    }

    // Obtener las IDs actuales de todas las notificaciones (incluyendo ocultas)
    const currentAllIds = new Set(
      allNotifications.map((notification: any) => notification.id)
    );
    
    // En la carga inicial, solo guardar las IDs sin abrir el modal
    if (isInitialLoadRef.current) {
      previousNotificationIdsRef.current = currentAllIds;
      isInitialLoadRef.current = false;
      return;
    }
    
    // Verificar si hay nuevas notificaciones comparando con las anteriores
    const hasNewNotifications = Array.from(currentAllIds).some(
      (id) => !previousNotificationIdsRef.current.has(id)
    );
    
    // Solo abrir el modal si:
    // 1. Hay nuevas notificaciones (nuevas IDs que no estaban antes)
    // 2. Y hay notificaciones visibles (no todas están ocultas)
    if (hasNewNotifications && visibleNotifications.length > 0) {
      setShowNotifications(true);
    }

    // Actualizar la referencia con las IDs actuales de todas las notificaciones
    previousNotificationIdsRef.current = currentAllIds;
  }, [allNotifications, visibleNotifications.length]);

  const handleDismissNotification = (notificationId: string) => {
    setHiddenNotificationIds((prev) => (prev.includes(notificationId) ? prev : [...prev, notificationId]));
  };

  const handleMarkMessageRead = async (messageId: string) => {
    try {
      await markMessageReadMutation({
        variables: { messageId },
      });
      refetchBroadcastMessages();
    } catch (error) {
      console.error('Error marcando mensaje como leído:', error);
    }
  };

  const handleLogout = () => {
    // Desconectar WebSocket antes de hacer logout
    disconnect();
    logout();
    // Navegar al login de empleado (los datos de la empresa se mantienen)
    navigate('/login-employee');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleMenuClick = (view: 'dashboard' | 'floors' | 'messages' | 'employees' | 'cashs' | 'products' | 'inventory' | 'kardex' | 'purchase' | 'reports' | 'configuration') => {
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
      : currentView === 'messages'
      ? 'Mensajes'
      : currentView === 'employees'
      ? 'Empleados'
      : currentView === 'products'
      ? 'Productos'
      : currentView === 'cashs'
      ? 'Gestión de Cajas'
      : currentView === 'inventory'
      ? 'Inventario'
      : currentView === 'kardex'
      ? 'Kardex'
      : currentView === 'purchase'
      ? 'Compras'
      : currentView === 'reports'
      ? 'Reportes'
      : currentView === 'configuration'
      ? 'Configuración'
      : 'Caja';

  const headerSubtitle =
    currentView === 'dashboard'
      ? `Bienvenido de vuelta, ${user?.firstName}`
      : currentView === 'floors'
      ? 'Gestiona la ocupación y las órdenes de tus mesas.'
      : currentView === 'messages'
      ? 'Envía mensajes a cocina, mozos u otros usuarios.'
      : currentView === 'employees'
      ? 'Administra los empleados de tu empresa.'
      : currentView === 'products'
      ? 'Administra los productos de tu menú.'
      : currentView === 'cashs'
      ? 'Gestiona las cajas registradoras, cierres y resúmenes de pagos.'
      : currentView === 'inventory'
      ? 'Controla el stock de tus productos.'
      : currentView === 'kardex'
      ? 'Registro de movimientos de inventario.'
      : currentView === 'purchase'
      ? 'Gestiona las compras a proveedores y controla el stock.'
      : currentView === 'reports'
      ? 'Visualiza reportes de ventas y documentos emitidos.'
      : currentView === 'configuration'
      ? 'Configura las observaciones y modificadores de tus productos.'
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
        width: sidebarWidth,
        backgroundColor: '#1a202c',
        color: 'white',
        transition: 'width 0.3s ease',
        position: 'fixed',
        height: '100vh',
        zIndex: 1000,
        overflow: 'auto',
        boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header del Sidebar */}
        <div style={{
          padding: isSmallDesktop ? '1.25rem' : '1.5rem',
          borderBottom: '1px solid #2d3748',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {sidebarOpen && (
            <div>
              <h2 style={{
                fontSize: isSmallDesktop ? '1.125rem' : '1.25rem',
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
                fontSize: isSmallDesktop ? '0.8125rem' : '0.875rem',
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
          flex: 1, 
          overflowY: 'auto',
          scrollbarWidth: 'thin',             // Firefox
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
              onClick={() => handleMenuClick('products')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: currentView === 'products' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                border: 'none',
                color: currentView === 'products' ? '#667eea' : '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                if (currentView !== 'products') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseOut={(e) => {
                if (currentView !== 'products') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#a0aec0';
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>🍽️</span>
              {sidebarOpen && 'Productos'}
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
              onClick={() => handleMenuClick('configuration')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: currentView === 'configuration' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                border: 'none',
                color: currentView === 'configuration' ? '#667eea' : '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                if (currentView !== 'configuration') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseOut={(e) => {
                if (currentView !== 'configuration') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#a0aec0';
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>⚙️</span>
              {sidebarOpen && 'Configuración'}
            </button>

            <button
              onClick={() => handleMenuClick('messages')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: currentView === 'messages' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                border: 'none',
                color: currentView === 'messages' ? '#667eea' : '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                if (currentView !== 'messages') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseOut={(e) => {
                if (currentView !== 'messages') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#a0aec0';
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>💬</span>
              {sidebarOpen && 'Mensajes'}
            </button>

            <button
              onClick={() => handleMenuClick('employees')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: currentView === 'employees' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                border: 'none',
                color: currentView === 'employees' ? '#667eea' : '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                if (currentView !== 'employees') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseOut={(e) => {
                if (currentView !== 'employees') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#a0aec0';
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>👥</span>
              {sidebarOpen && 'Empleados'}
            </button> 

            <button
              onClick={() => handleMenuClick('purchase')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: currentView === 'purchase' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                border: 'none',
                color: currentView === 'purchase' ? '#667eea' : '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                if (currentView !== 'purchase') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseOut={(e) => {
                if (currentView !== 'purchase') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#a0aec0';
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>🛒</span>
              {sidebarOpen && 'Compras'}
            </button> 

            <button
              onClick={() => handleMenuClick('cashs')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: currentView === 'cashs' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                border: 'none',
                color: currentView === 'cashs' ? '#667eea' : '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                if (currentView !== 'cashs') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseOut={(e) => {
                if (currentView !== 'cashs') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#a0aec0';
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>💰</span>
              {sidebarOpen && 'Caja'}
            </button>

            <button
              onClick={() => handleMenuClick('inventory')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: currentView === 'inventory' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                border: 'none',
                color: currentView === 'inventory' ? '#667eea' : '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                if (currentView !== 'inventory') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseOut={(e) => {
                if (currentView !== 'inventory') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#a0aec0';
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>📦</span>
              {sidebarOpen && 'Inventario'}
            </button>

            <button
              onClick={() => handleMenuClick('kardex')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: currentView === 'kardex' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                border: 'none',
                color: currentView === 'kardex' ? '#667eea' : '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                if (currentView !== 'kardex') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseOut={(e) => {
                if (currentView !== 'kardex') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#a0aec0';
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>📋</span>
              {sidebarOpen && 'Kardex'}
            </button>

            <button
              onClick={() => handleMenuClick('reports')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: currentView === 'reports' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                border: 'none',
                color: currentView === 'reports' ? '#667eea' : '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                if (currentView !== 'reports') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseOut={(e) => {
                if (currentView !== 'reports') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#a0aec0';
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>📊</span>
              {sidebarOpen && 'Reportes'}
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
        marginLeft: sidebarWidth,
        width: `calc(100vw - ${sidebarWidth})`,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'margin-left 0.3s ease, width 0.3s ease',
        minWidth: '1024px' // Mínimo para pantallas de PC
      }}>
        {/* Header Principal */}
        <header style={{
          backgroundColor: 'white',
          padding: headerPadding,
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h1 style={{
              fontSize: headerFontSize,
              fontWeight: '700',
              color: '#2d3748',
              margin: 0
            }}>
              {headerTitle}
            </h1>
            <p style={{
              fontSize: headerSubFontSize,
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
                        Notificaciones
                      </h3>
                      <p
                        style={{
                          margin: '0.15rem 0 0',
                          fontSize: '0.75rem',
                          color: '#718096'
                        }}
                      >
                        Mensajes y notificaciones de cocina
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        refetchKitchenNotifications();
                        refetchBroadcastMessages();
                      }}
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
                  {(notificationsLoading || broadcastMessagesLoading) ? (
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
                  ) : visibleNotifications.length === 0 ? (
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
                    visibleNotifications.map((notification: any) => {
                      const isBroadcast = notification.type === 'broadcast';
                      const chefName = notification?.preparedBy?.fullName || 'Cocina';
                      const tableName = notification?.operation?.table?.name || 'Sin mesa';
                      const productName = notification?.operationDetail?.productName;
                      const quantity = notification?.operationDetail?.quantity;
                      const senderName = notification?.sender?.fullName || 'Usuario';
                      const recipientsLabel = notification?.recipients === 'ALL' ? 'Todos' :
                        notification?.recipients === 'WAITERS' ? 'Mozos' :
                        notification?.recipients === 'COOKS' ? 'Cocineros' :
                        notification?.recipients === 'CASHIERS' ? 'Cajeros' :
                        notification?.recipients === 'ADMINS' ? 'Administradores' : notification?.recipients;

                      return (
                        <div
                          key={notification.id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '0.75rem',
                            marginBottom: '0.5rem',
                            backgroundColor: isBroadcast ? '#eff6ff' : '#fdf2f8',
                            position: 'relative'
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (isBroadcast) {
                                handleMarkMessageRead(notification.id);
                              }
                              handleDismissNotification(notification.id);
                            }}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: '#a0aec0',
                              cursor: 'pointer',
                              fontSize: '1rem',
                              fontWeight: 700,
                              lineHeight: 1
                            }}
                            aria-label={isBroadcast ? "Marcar como leído y ocultar" : "Ocultar notificación"}
                            title={isBroadcast ? "Marcar como leído y ocultar" : "Ocultar notificación"}
                          >
                            ×
                          </button>
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
                                backgroundColor: isBroadcast ? '#bfdbfe' : '#fbb6ce',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.1rem'
                              }}
                            >
                              {isBroadcast ? '💬' : '🍽️'}
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
                                {isBroadcast ? (
                                  <>
                                    <span>👤 De: {senderName}</span>
                                    <span>📢 Para: {recipientsLabel}</span>
                                  </>
                                ) : (
                                  <>
                                    <span>👨‍🍳 {chefName}</span>
                                    <span>🪑 Mesa {tableName}</span>
                                    {productName && (
                                      <span>
                                        🧾 {quantity ? `${quantity}× ` : ''}
                                        {productName}
                                      </span>
                                    )}
                                  </>
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
          overflowY: 'auto',
          overflowX: 'hidden',
          width: '100%',
          boxSizing: 'border-box',
          minHeight: 0
        }}>
          {currentView === 'dashboard' && children}
          {currentView === 'floors' && <Floor onOpenCash={handleOpenCash} />}
          {currentView === 'cash' && (
            <CashPay
              table={selectedCashTable}
              onBack={handleBackFromCash}
              onPaymentSuccess={() => {
                // El WebSocket debería actualizar automáticamente las mesas
                // pero podemos forzar un refetch si es necesario
                console.log('✅ Pago procesado exitosamente');
              }}
              onTableChange={(newTable) => {
                // Actualizar la mesa seleccionada cuando se cambia la mesa
                console.log('🔄 Mesa cambiada a:', newTable.name);
                setSelectedCashTable(newTable);
              }}
            />
          )}
          {currentView === 'cashs' && <Cashs />}
          {currentView === 'messages' && (
            <Message
              onBack={() => handleMenuClick('dashboard')}
              onSuccess={() => {
                // Opcional: puedes agregar lógica aquí después de enviar un mensaje exitosamente
                console.log('✅ Mensaje enviado exitosamente');
              }}
            />
          )}
          {currentView === 'employees' && <CreateUser />}
          {currentView === 'products' && <Products />}
          {currentView === 'inventory' && <Inventories />}
          {currentView === 'kardex' && <Kardex />}
          {currentView === 'purchase' && <Purchase />}
          {currentView === 'reports' && <ReportSale />}
          {currentView === 'configuration' && <Observation />}
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
