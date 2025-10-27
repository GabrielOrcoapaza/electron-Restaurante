import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Floor from '../modules/sales/floor';

interface LayoutDashboardProps {
  children: React.ReactNode;
}

const LayoutDashboard: React.FC<LayoutDashboardProps> = ({ children }) => {
  const navigate = useNavigate();
  const { user, companyData, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'floors'>('dashboard');

  const handleLogout = () => {
    logout();
    navigate('/login-company');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleMenuClick = (view: 'dashboard' | 'floors') => {
    setCurrentView(view);
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
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
                background: currentView === 'floors' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                border: 'none',
                color: currentView === 'floors' ? '#667eea' : '#a0aec0',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseOver={(e) => {
                if (currentView !== 'floors') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseOut={(e) => {
                if (currentView !== 'floors') {
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
        flex: 1,
        marginLeft: sidebarOpen ? '280px' : '80px',
        transition: 'margin-left 0.3s ease',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
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
              Dashboard
            </h1>
            <p style={{
              fontSize: '0.875rem',
              color: '#718096',
              margin: '0.25rem 0 0'
            }}>
              Bienvenido de vuelta, {user?.firstName}
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
          </div>
        </header>

        {/* Contenido */}
        <main style={{
          flex: 1,
          padding: '2rem',
          backgroundColor: '#f8fafc'
        }}>
          {currentView === 'dashboard' ? children : <Floor />}
        </main>
      </div>
    </div>
  );
};

export default LayoutDashboard;
