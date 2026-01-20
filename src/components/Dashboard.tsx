import LayoutDashboard from '../layouts/layoutDashboard';
import { useAuth } from '../hooks/useAuth';
import { useResponsive } from '../hooks/useResponsive';

const Dashboard = () => {
  const { user, companyData } = useAuth();
  const { breakpoint } = useResponsive();
  
  // Adaptar según tamaño de pantalla de PC
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  const isMediumDesktop = breakpoint === 'xl'; // 1280px - 1535px
  
  // Tamaños adaptativos
  const cardPadding = isSmallDesktop ? '1.5rem' : '2rem';
  const cardGap = isSmallDesktop ? '1.5rem' : '2rem';
  const cardMinWidth = isSmallDesktop ? '280px' : isMediumDesktop ? '300px' : '320px';
  const gridGap = isSmallDesktop ? '1.25rem' : '1.5rem';
  const quickActionMinWidth = isSmallDesktop ? '180px' : '200px';

  return (
    <LayoutDashboard>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${cardMinWidth}, 1fr))`,
        gap: cardGap,
        marginBottom: cardGap,
        padding: isSmallDesktop ? '0.75rem' : '1rem'
      }}>
        {/* Tarjeta de Bienvenida */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '2rem',
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(102, 126, 234, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '100px',
            height: '100px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%'
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: '-30px',
            left: '-30px',
            width: '60px',
            height: '60px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%'
          }}></div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              margin: '0 0 0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🎉 ¡Bienvenido!
            </h2>
            <p style={{
              fontSize: '1rem',
              margin: '0 0 1rem',
              opacity: 0.9
            }}>
              {user?.fullName}
            </p>
            <p style={{
              fontSize: '0.875rem',
              margin: 0,
              opacity: 0.8
            }}>
              Has iniciado sesión exitosamente en la plataforma
            </p>
          </div>
        </div>

        {/* Tarjeta de Información del Usuario */}
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '16px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            margin: '0 0 1.5rem',
            color: '#2d3748',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            👤 Información Personal
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              borderBottom: '1px solid #f7fafc'
            }}>
              <span style={{ color: '#718096', fontSize: '0.875rem' }}>DNI:</span>
              <span style={{ color: '#2d3748', fontWeight: '500' }}>{user?.dni}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              borderBottom: '1px solid #f7fafc'
            }}>
              <span style={{ color: '#718096', fontSize: '0.875rem' }}>Rol:</span>
              <span style={{ color: '#2d3748', fontWeight: '500' }}>{user?.role}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0'
            }}>
              <span style={{ color: '#718096', fontSize: '0.875rem' }}>Nombre:</span>
              <span style={{ color: '#2d3748', fontWeight: '500' }}>{user?.fullName}</span>
            </div>
          </div>
        </div>

        {/* Tarjeta de Información de la Empresa */}
        <div style={{
          background: 'white',
          padding: cardPadding,
          borderRadius: '16px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{
            fontSize: isSmallDesktop ? '1.125rem' : '1.25rem',
            fontWeight: '600',
            margin: '0 0 1.5rem',
            color: '#2d3748',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🏢 Información de la Empresa
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              borderBottom: '1px solid #f7fafc'
            }}>
              <span style={{ color: '#718096', fontSize: '0.875rem' }}>Empresa:</span>
              <span style={{ color: '#2d3748', fontWeight: '500' }}>{companyData?.company.denomination}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              borderBottom: '1px solid #f7fafc'
            }}>
              <span style={{ color: '#718096', fontSize: '0.875rem' }}>RUC:</span>
              <span style={{ color: '#2d3748', fontWeight: '500' }}>{companyData?.company.ruc}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0'
            }}>
              <span style={{ color: '#718096', fontSize: '0.875rem' }}>Sucursal:</span>
              <span style={{ color: '#2d3748', fontWeight: '500' }}>{companyData?.branch.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Acciones Rápidas */}
      <div style={{
        background: 'white',
        padding: cardPadding,
        borderRadius: '16px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0',
        margin: `0 ${isSmallDesktop ? '0.75rem' : '1rem'}`
      }}>
        <h3 style={{
          fontSize: isSmallDesktop ? '1.125rem' : '1.25rem',
          fontWeight: '600',
          margin: '0 0 1.5rem',
          color: '#2d3748',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          ⚡ Acciones Rápidas
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${quickActionMinWidth}, 1fr))`,
          gap: gridGap
        }}>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 6px rgba(102, 126, 234, 0.2)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 15px rgba(102, 126, 234, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(102, 126, 234, 0.2)';
          }}
          >
            <span style={{ fontSize: '1.25rem' }}>📊</span>
            Ver Reportes
          </button>

          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            background: 'linear-gradient(135deg, #48dbfb, #0abde3)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 6px rgba(72, 219, 251, 0.2)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 15px rgba(72, 219, 251, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(72, 219, 251, 0.2)';
          }}
          >
            <span style={{ fontSize: '1.25rem' }}>📈</span>
            Estadísticas
          </button>

          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            background: 'linear-gradient(135deg, #ff9ff3, #f368e0)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 6px rgba(255, 159, 243, 0.2)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 15px rgba(255, 159, 243, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(255, 159, 243, 0.2)';
          }}
          >
            <span style={{ fontSize: '1.25rem' }}>⚙️</span>
            Configuración
          </button>
        </div>
      </div>
    </LayoutDashboard>
  );
};

export default Dashboard;
