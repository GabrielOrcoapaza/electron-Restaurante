import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { COMPANY_LOGIN } from '../graphql/mutations';
import { useAuth } from '../hooks/useAuth';
import { useResponsive } from '../hooks/useResponsive';
import { useToast } from '../context/ToastContext';
import VirtualKeyboard from '../components/VirtualKeyboard';

const LoginCompany: React.FC = () => {
  const navigate = useNavigate();
  const { loginCompany, getMacAddress } = useAuth();
  const { breakpoint, isMobile } = useResponsive();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    ruc: '',
    email: '',
    password: ''
  });
  const [macAddress, setMacAddress] = useState<string>('Cargando...');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [focusedInput, setFocusedInput] = useState<'ruc' | 'email' | 'password' | null>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);

  // Obtener la MAC address al cargar el componente
  useEffect(() => {
    const fetchMacAddress = async () => {
      try {
        const mac = await getMacAddress();
        setMacAddress(mac);
      } catch (error) {
        console.error('Error al obtener MAC address:', error);
        setMacAddress('No disponible');
      }
    };
    fetchMacAddress();
  }, [getMacAddress]);

  const [companyLoginMutation, { loading }] = useMutation(COMPANY_LOGIN);

  // Tamaños adaptativos según breakpoint
  const isSmall = breakpoint === 'sm'; // 640px - 767px
  const isMedium = breakpoint === 'md'; // 768px - 1023px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  const isMediumDesktop = breakpoint === 'xl'; // 1280px - 1535px

  const showLeftPanel = breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === '2xl';
  const containerPadding = isSmall ? '0.5rem' : isMedium ? '0.75rem' : isSmallDesktop ? '1rem' : isMediumDesktop ? '1.25rem' : '1.5rem';
  const formMaxWidth = isSmall ? '100%' : isMedium ? '100%' : isSmallDesktop ? '420px' : isMediumDesktop ? '450px' : '480px';
  const titleFontSize = isSmall ? 'clamp(20px, 3.5vw, 24px)' : isMedium ? 'clamp(22px, 3.5vw, 28px)' : isSmallDesktop ? 'clamp(24px, 3.5vw, 30px)' : isMediumDesktop ? 'clamp(26px, 3.5vw, 32px)' : 'clamp(28px, 3.5vw, 36px)';
  const subtitleFontSize = isSmall ? 'clamp(12px, 2vw, 14px)' : isMedium ? 'clamp(13px, 2vw, 15px)' : 'clamp(14px, 2vw, 16px)';
  const inputFontSize = isSmall ? 'clamp(12px, 2.5vw, 14px)' : isMedium ? 'clamp(13px, 2.5vw, 15px)' : 'clamp(14px, 2.5vw, 16px)';
  const labelFontSize = isSmall ? 'clamp(12px, 2.5vw, 14px)' : isMedium ? 'clamp(13px, 2.5vw, 15px)' : 'clamp(14px, 2.5vw, 16px)';
  const buttonFontSize = isSmall ? 'clamp(14px, 2.5vw, 16px)' : isMedium ? 'clamp(15px, 2.5vw, 17px)' : 'clamp(16px, 2.5vw, 18px)';

  // Bloquear acceso en móviles
  if (isMobile) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ffa726 25%, #66bb6a 50%, #42a5f5 75%, #ab47bc 100%)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '20px',
          padding: '3rem 2rem',
          maxWidth: '500px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>📱</div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: '1rem'
          }}>
            Acceso no disponible en móviles
          </h1>
          <p style={{
            fontSize: '1rem',
            color: '#64748b',
            lineHeight: '1.6'
          }}>
            Esta aplicación está diseñada para ser usada en tablets y computadoras. Por favor, accede desde un dispositivo con pantalla más grande.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Limpiar localStorage antes de intentar login para evitar tokens expirados
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('userPhoto');
    console.log('🧹 localStorage limpiado antes del login');

    console.log('🚀 Intentando login de empresa con datos:', {
      ruc: formData.ruc,
      email: formData.email,
      password: formData.password,
      url: 'http://192.168.1.22:8000/graphql'
    });

    try {
      console.log('📡 Enviando mutation companyLogin...');
      const { data } = await companyLoginMutation({
        variables: {
          ruc: formData.ruc,
          email: formData.email,
          password: formData.password
        }
      });

      console.log('✅ Respuesta recibida del servidor:', data);

      if (data?.companyLogin?.success) {
        console.log('✅ Empleados de la sucursal:', data.companyLogin.branch.users);
        console.log('🏢 Pisos de la sucursal:', data.companyLogin.branch.floors);
        console.log('📦 Categorías de la sucursal:', data.companyLogin.branch.categories);

        // Extraer todas las mesas de todos los pisos con su información de piso
        const allTables = (data.companyLogin.branch.floors || []).flatMap((floor: any) =>
          (floor.tables || []).map((table: any) => ({
            ...table,
            floorId: floor.id,
            floorName: floor.name
          }))
        );
        console.log('🪑 Todas las mesas de la sucursal:', allTables);

        // Usar el hook useAuth para guardar datos
        console.log('📊 IGV de la sucursal obtenido:', data.companyLogin.branch.igvPercentage, '%');

        showToast('Empresa validada correctamente', 'success');

        loginCompany({
          company: data.companyLogin.company,
          branch: {
            ...data.companyLogin.branch,
            users: data.companyLogin.branch.users || [],
            floors: data.companyLogin.branch.floors || [],
            categories: data.companyLogin.branch.categories || [],
            tables: allTables,
            igvPercentage: data.companyLogin.branch.igvPercentage // Asegurar que el IGV se guarde explícitamente
          },
          companyLogo: data.companyLogin.companyLogoBase64,
          branchLogo: data.companyLogin.branchLogoBase64,
          availableBranches: data.companyLogin.availableBranches
        });

        // Redirigir al login de empleado
        navigate('/login-employee');
      } else {
        console.log('❌ Login fallido:', data?.companyLogin?.message);
        showToast(data?.companyLogin?.message || 'Error al validar empresa', 'error');
      }
    } catch (err: any) {
      console.error('🚨 ===== ERROR EN LOGIN DE EMPRESA =====');
      console.error('Mensaje de error:', err.message);
      console.error('Error completo:', err);

      let errorMessage = 'Error al iniciar sesión';

      // Error de GraphQL
      if (err.graphQLErrors && err.graphQLErrors.length > 0) {
        console.error('📋 Errores de GraphQL:');
        err.graphQLErrors.forEach((error: any, index: number) => {
          console.error(`  Error ${index + 1}:`, error.message);
          console.error('  Código:', error.extensions?.code);

          // Obtener mensaje de error específico
          errorMessage = error.message || errorMessage;
        });
      }

      // Error de red
      if (err.networkError) {
        console.error('🌐 Error de red:', err.networkError);
        console.error('  Mensaje:', err.networkError.message);
        if (err.networkError.result) {
          console.error('  Resultado:', err.networkError.result);
        }

        // Mensajes específicos para errores de red
        if (err.networkError.message?.includes('Failed to fetch')) {
          errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
        } else {
          errorMessage = 'Error de conexión con el servidor';
        }
      }

      console.error('==============================');

      // Mostrar mensaje de error al usuario
      console.error(errorMessage);
      showToast(errorMessage, 'error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleVirtualKeyPress = (key: string) => {
    if (focusedInput === 'ruc') setFormData(prev => ({ ...prev, ruc: prev.ruc + key }));
    if (focusedInput === 'email') setFormData(prev => ({ ...prev, email: prev.email + key }));
    if (focusedInput === 'password') setFormData(prev => ({ ...prev, password: prev.password + key }));
  };
  const handleVirtualBackspace = () => {
    if (focusedInput === 'ruc') setFormData(prev => ({ ...prev, ruc: prev.ruc.slice(0, -1) }));
    if (focusedInput === 'email') setFormData(prev => ({ ...prev, email: prev.email.slice(0, -1) }));
    if (focusedInput === 'password') setFormData(prev => ({ ...prev, password: prev.password.slice(0, -1) }));
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      maxWidth: '100vw',
      background: 'linear-gradient(135deg, #ff6b6b 0%, #ffa726 25%, #66bb6a 50%, #42a5f5 75%, #ab47bc 100%)',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'hidden',
      margin: 0,
      padding: 0
    }}>
      {/* Fondo con elementos decorativos de cocina */}
      <div style={{
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundImage: `
          url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjMiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPgo8Y2lyY2xlIGN4PSI4MCIgY3k9IjMwIiByPSI1IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDgpIi8+CjxjaXJjbGUgY3g9IjMwIiBjeT0iNzAiIHI9IjQiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xMikiLz4KPGNpcmNsZSBjeD0iNzAiIGN5PSI4MCIgcj0iNiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA2KSIvPgo8L3N2Zz4K'),
          url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQwIDEwTDUwIDMwSDMwTDQwIDEwWiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPgo8cGF0aCBkPSJNMzAgNDBMMTAgNjBIMzBWNDBaIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDYpIi8+CjxwYXRoIGQ9Ik01MCA0MEw3MCA2MEg1MFY0MFoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPgo8L3N2Zz4K')
        `,
        backgroundSize: '200px 200px, 150px 150px',
        backgroundPosition: '0 0, 100px 100px',
        animation: 'float 20s ease-in-out infinite',
        opacity: 0.3
      }}></div>

      {/* Elementos flotantes decorativos */}
      <div style={{
        position: 'absolute',
        top: '10%',
        right: '10%',
        width: '120px',
        height: '120px',
        background: 'linear-gradient(45deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
        borderRadius: '50%',
        animation: 'pulse 3s ease-in-out infinite'
      }}></div>

      <div style={{
        position: 'absolute',
        bottom: '15%',
        left: '5%',
        width: '80px',
        height: '80px',
        background: 'linear-gradient(45deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))',
        borderRadius: '50%',
        animation: 'float 4s ease-in-out infinite reverse'
      }}></div>

      <div style={{
        position: 'absolute',
        top: '30%',
        left: '15%',
        width: '60px',
        height: '60px',
        background: 'linear-gradient(45deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02))',
        borderRadius: '50%',
        animation: 'pulse 5s ease-in-out infinite'
      }}></div>

      {/* Contenedor principal responsivo */}
      <div className="main-container" style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        position: 'relative',
        zIndex: 1,
        flexDirection: 'column',
        margin: 0,
        padding: 0
      }}>
        {/* Panel izquierdo con imagen de cocina - Solo visible en pantallas grandes */}
        <div className="left-panel" style={{
          display: 'none',
          flex: '1.2',
          background: 'linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.6))',
          backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRkY2QjZCIiBvcGFjaXR5PSIwLjEiLz4KPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjAwLCAyMDApIj4KPGNpcmNsZSBjeD0iLTEwMCIgY3k9Ii01MCIgcj0iNDAiIGZpbGw9IiNGRkE3MjYiIG9wYWNpdHk9IjAuMiIvPgo8Y2lyY2xlIGN4PSIxMDAiIGN5PSItNDAiIHI9IjMwIiBmaWxsPSIjNjZCMkI2IiBvcGFjaXR5PSIwLjE1Ii8+CjxjaXJjbGUgY3g9Ii04MCIgY3k9IjgwIiByPSI1MCIgZmlsbD0iIzQyQTVGNiIgb3BhY2l0eT0iMC4xOCIvPgo8Y2lyY2xlIGN4PSI5MCIgY3k9IjcwIiByPSIzNSIgZmlsbD0iI0FCNDdCQyIgb3BhY2l0eT0iMC4xMiIvPgo8L2c+CjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDIwMCwgMjAwKSByb3RhdGUoNDUpIj4KPHJlY3QgeD0iLTEwMCIgeT0iLTEwIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHJ4PSIxMCIvPgo8cmVjdCB4PSItMTAwIiB5PSIxMCIgd2lkdGg9IjE1MCIgaGVpZ2h0PSIyMCIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIgcng9IjEwIi8+CjxyZWN0IHg9Ii0xMDAiIHk9IjQwIiB3aWR0aD0iMTgwIiBoZWlnaHQ9IjIwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMTIpIiByeD0iMTAiLz4KPC9nPgo8L3N2Zz4K')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '4rem',
          position: 'relative'
        }}>
          {/* Overlay con gradiente */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(255,107,107,0.8) 0%, rgba(255,167,38,0.7) 25%, rgba(102,187,106,0.6) 50%, rgba(66,165,246,0.7) 75%, rgba(171,71,188,0.8) 100%)',
            zIndex: 1
          }}></div>

          {/* Contenido del panel izquierdo */}
          <div style={{
            position: 'relative',
            zIndex: 2,
            textAlign: 'center',
            color: 'white'
          }}>
            <div style={{
              fontSize: '80px',
              marginBottom: '2rem',
              textShadow: '0 4px 8px rgba(0,0,0,0.3)',
              animation: 'bounce 2s ease-in-out infinite'
            }}>🍳</div>

            <h1 style={{
              fontSize: '3rem',
              fontWeight: '800',
              marginBottom: '1rem',
              textShadow: '0 4px 8px rgba(0,0,0,0.3)',
              background: 'linear-gradient(45deg, #fff, #f0f0f0)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              AppSuma
            </h1>

            <p style={{
              fontSize: '1.2rem',
              marginBottom: '2rem',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              opacity: 0.9
            }}>
              Sistema de Gestión para Restaurantes
            </p>

            {focusedInput ? (
              <div ref={keyboardRef} style={{
                width: '100%',
                maxWidth: '540px',
                minWidth: '480px',
                marginTop: '0.5rem',
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.95)',
                borderRadius: '12px',
                border: '2px solid rgba(255,255,255,0.6)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
              }}>
                <div style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700, color: 'rgba(255,255,255,0.95)', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  ⌨️ Teclado virtual
                </div>
                <VirtualKeyboard
                  onKeyPress={handleVirtualKeyPress}
                  onBackspace={handleVirtualBackspace}
                  compact={true}
                />
              </div>
            ) : (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '2rem',
                marginTop: '3rem'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🍽️</div>
                  <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Pedidos</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👨‍🍳</div>
                  <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Cocina</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
                  <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Reportes</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel derecho con formulario - Siempre visible */}
        <div className="form-panel" style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: isSmall ? '0.25rem' : isMedium ? '0.5rem' : '0.5rem',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          height: '100vh',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>
          <div className="form-container" style={{
            width: '100%',
            maxWidth: formMaxWidth,
            position: 'relative',
            padding: containerPadding,
            boxSizing: 'border-box'
          }}>
            {/* Elementos decorativos del formulario */}
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '60px',
              height: '60px',
              background: 'linear-gradient(45deg, #ff6b6b, #ffa726)',
              borderRadius: '50%',
              opacity: 0.1,
              animation: 'pulse 4s ease-in-out infinite'
            }}></div>

            <div style={{
              position: 'absolute',
              bottom: '-30px',
              left: '-30px',
              width: '80px',
              height: '80px',
              background: 'linear-gradient(45deg, #66bb6a, #42a5f5)',
              borderRadius: '50%',
              opacity: 0.08,
              animation: 'float 6s ease-in-out infinite reverse'
            }}></div>

            <div style={{ textAlign: 'center', marginBottom: isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem' }}>
              <div style={{
                width: isSmall ? '60px' : isMedium ? '70px' : '80px',
                height: isSmall ? '60px' : isMedium ? '70px' : '80px',
                background: 'linear-gradient(135deg, #ff6b6b, #ffa726)',
                borderRadius: '20px',
                margin: `0 auto ${isSmall ? '0.75rem' : isMedium ? '1rem' : '1.5rem'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isSmall ? '24px' : isMedium ? '28px' : '32px',
                color: 'white',
                boxShadow: '0 15px 30px rgba(255, 107, 107, 0.4)',
                animation: 'bounce 3s ease-in-out infinite'
              }}>
                🏢
              </div>
              <h2 style={{
                margin: '0',
                color: '#2d3748',
                fontSize: titleFontSize,
                fontWeight: '800',
                background: 'linear-gradient(135deg, #ff6b6b, #ffa726)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Acceso Empresarial
              </h2>
              <p style={{
                color: '#718096',
                margin: '0.5rem 0 0',
                fontSize: subtitleFontSize,
                fontWeight: '500'
              }}>
                Ingresa los datos de tu empresa
              </p>
              <div style={{
                marginTop: isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem',
                padding: isSmall ? '0.5rem 0.75rem' : isMedium ? '0.625rem 0.875rem' : '0.75rem 1rem',
                backgroundColor: '#f7fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: isSmall ? '14px' : isMedium ? '15px' : 'clamp(14px, 2.5vw, 16px)' }}>🖥️</span>
                <span style={{
                  color: '#4a5568',
                  fontSize: isSmall ? '11px' : isMedium ? '12px' : 'clamp(12px, 2vw, 14px)',
                  fontWeight: '600',
                  fontFamily: 'monospace'
                }}>
                  MAC: {macAddress}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: isSmall ? '0.5rem' : isMedium ? '0.75rem' : '0.75rem' }}>
                <label className="form-labels" style={{
                  display: 'block',
                  marginBottom: isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem',
                  color: '#2d3748',
                  fontSize: labelFontSize,
                  fontWeight: '700'
                }}>
                  🏛️ RUC de la Empresa
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    name="ruc"
                    value={formData.ruc}
                    onChange={handleChange}
                    placeholder="12345678901"
                    required
                    className="form-inputs"
                    style={{
                      width: '100%',
                      padding: isSmall ? '0.75rem 0.75rem 0.75rem 2.5rem' : isMedium ? '0.875rem 0.875rem 0.875rem 2.75rem' : '1rem 1rem 1rem 3rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: inputFontSize,
                      backgroundColor: '#f8fafc',
                      transition: 'all 0.3s ease',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: '500'
                    }}
                    onFocus={(e) => {
                      setFocusedInput('ruc');
                      e.target.style.borderColor = '#ff6b6b';
                      e.target.style.backgroundColor = 'white';
                      e.target.style.boxShadow = '0 0 0 4px rgba(255, 107, 107, 0.1)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onBlur={(e) => {
                      if (!keyboardRef.current?.contains(e.relatedTarget as Node)) setFocusedInput(null);
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.backgroundColor = '#f8fafc';
                      e.target.style.boxShadow = 'none';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: isSmall ? '16px' : isMedium ? '18px' : isSmallDesktop ? '18px' : '20px'
                  }}>🏢</div>
                </div>
              </div>

              <div style={{ marginBottom: isSmall ? '0.5rem' : isMedium ? '0.75rem' : '0.75rem' }}>
                <label className="form-labels" style={{
                  display: 'block',
                  marginBottom: isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem',
                  color: '#2d3748',
                  fontSize: labelFontSize,
                  fontWeight: '700'
                }}>
                  📧 Email de la Empresa
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="empresa@ejemplo.com"
                    required
                    className="form-inputs"
                    style={{
                      width: '100%',
                      padding: isSmall ? '0.75rem 0.75rem 0.75rem 2.5rem' : isMedium ? '0.875rem 0.875rem 0.875rem 2.75rem' : '1rem 1rem 1rem 3rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: inputFontSize,
                      backgroundColor: '#f8fafc',
                      transition: 'all 0.3s ease',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: '500'
                    }}
                    onFocus={(e) => {
                      setFocusedInput('email');
                      e.target.style.borderColor = '#ffa726';
                      e.target.style.backgroundColor = 'white';
                      e.target.style.boxShadow = '0 0 0 4px rgba(255, 167, 38, 0.1)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onBlur={(e) => {
                      if (!keyboardRef.current?.contains(e.relatedTarget as Node)) setFocusedInput(null);
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.backgroundColor = '#f8fafc';
                      e.target.style.boxShadow = 'none';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: isSmall ? '16px' : isMedium ? '18px' : isSmallDesktop ? '18px' : '20px'
                  }}>📧</div>
                </div>
              </div>

              <div style={{ marginBottom: isSmall ? '0.5rem' : isMedium ? '0.75rem' : '0.75rem' }}>
                <label className="form-labels" style={{
                  display: 'block',
                  marginBottom: isSmall ? '0.5rem' : isMedium ? '0.75rem' : '1rem',
                  color: '#2d3748',
                  fontSize: labelFontSize,
                  fontWeight: '700'
                }}>
                  🔒 Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className="form-inputs"
                    style={{
                      width: '100%',
                      padding: isSmall ? '0.75rem 2.5rem 0.75rem 2.5rem' : isMedium ? '0.875rem 2.75rem 0.875rem 2.75rem' : '1rem 3rem 1rem 3rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: inputFontSize,
                      backgroundColor: '#f8fafc',
                      transition: 'all 0.3s ease',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: '500'
                    }}
                    onFocus={(e) => {
                      setFocusedInput('password');
                      e.target.style.borderColor = '#66bb6a';
                      e.target.style.backgroundColor = 'white';
                      e.target.style.boxShadow = '0 0 0 4px rgba(102, 187, 106, 0.1)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onBlur={(e) => {
                      if (!keyboardRef.current?.contains(e.relatedTarget as Node)) setFocusedInput(null);
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.backgroundColor = '#f8fafc';
                      e.target.style.boxShadow = 'none';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: isSmall ? '16px' : isMedium ? '18px' : isSmallDesktop ? '18px' : '20px',
                    pointerEvents: 'none'
                  }}>🔒</div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isSmall ? '16px' : isMedium ? '18px' : isSmallDesktop ? '18px' : '20px',
                      color: '#64748b',
                      transition: 'color 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.color = '#1e293b';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.color = '#64748b';
                    }}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: isSmall ? '1rem' : isMedium ? '1.125rem' : '1.25rem',
                  background: loading ? '#ccc' : 'linear-gradient(135deg, #ff6b6b 0%, #ffa726 50%, #66bb6a 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: buttonFontSize,
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 15px 30px rgba(255, 107, 107, 0.4)',
                  position: 'relative',
                  overflow: 'hidden',
                  opacity: loading ? 0.7 : 1,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
                onMouseOver={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(255, 107, 107, 0.6)';
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ff5252 0%, #ff9800 50%, #4caf50 100%)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 15px 30px rgba(255, 107, 107, 0.4)';
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ffa726 50%, #66bb6a 100%)';
                  }
                }}
              >
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  {loading ? '⏳ Verificando...' : '🚀 Acceder a la Plataforma'}
                </span>
              </button>
            </form>
          </div>

          {focusedInput && !showLeftPanel && (
            <div ref={keyboardRef} style={{
              width: '100%',
              maxWidth: '680px',
              minWidth: '560px',
              marginTop: '1rem',
              padding: '1rem',
              background: 'linear-gradient(145deg, #f1f5f9, #e2e8f0)',
              borderRadius: '16px',
              border: '3px solid #64748b',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 700, color: '#334155' }}>
                ⌨️ Teclado virtual
              </div>
              <VirtualKeyboard
                onKeyPress={handleVirtualKeyPress}
                onBackspace={handleVirtualBackspace}
                compact={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* Estilos CSS para animaciones y responsividad */}
      <style>{`
        /* Asegurar que el contenedor principal ocupe toda la pantalla */
        * {
          box-sizing: border-box !important;
        }
        
        body, html {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          height: 100vh !important;
          width: 100vw !important;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.1; }
          50% { transform: scale(1.1); opacity: 0.2; }
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        /* Media queries para responsividad - sm, md, lg, xl, 2xl (excluye xs/móvil) */
        @media (min-width: 1536px) {
          .main-container {
            flex-direction: row !important;
            height: 100vh !important;
          }
          .left-panel {
            display: flex !important;
            height: 100vh !important;
          }
          .form-panel {
            height: 100vh !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
        }
        
        @media (min-width: 1280px) and (max-width: 1535px) {
          .main-container {
            flex-direction: row !important;
            height: 100vh !important;
          }
          .left-panel {
            display: flex !important;
            height: 100vh !important;
          }
          .form-panel {
            height: 100vh !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
        }
        
        @media (min-width: 1024px) and (max-width: 1279px) {
          .main-container {
            flex-direction: row !important;
            height: 100vh !important;
          }
          .left-panel {
            display: flex !important;
            height: 100vh !important;
          }
          .form-panel {
            height: 100vh !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
        }
        
        @media (min-width: 768px) and (max-width: 1023px) {
          .left-panel {
            display: none !important;
          }
          .form-panel {
            height: 100vh !important;
            width: 100vw !important;
            max-width: 100vw !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
        }
        
        @media (min-width: 640px) and (max-width: 767px) {
          .left-panel {
            display: none !important;
          }
          .form-panel {
            height: 100vh !important;
            width: 100vw !important;
            max-width: 100vw !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginCompany;
