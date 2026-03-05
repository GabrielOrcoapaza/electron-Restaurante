import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { USER_LOGIN } from '../graphql/mutations';
import { GET_USERS_BY_BRANCH } from '../graphql/queries';
import { useAuth } from '../hooks/useAuth';
import { useResponsive } from '../hooks/useResponsive';
import { useToast } from '../context/ToastContext';
import VirtualKeyboard from '../components/VirtualKeyboard';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { loginUser, companyData, getMacAddress, clearCompanyData } = useAuth();
  const { breakpoint, isMobile } = useResponsive();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    selectedEmployee: '',
    password: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'search' | 'password' | null>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);

  const [userLoginMutation, { loading }] = useMutation(USER_LOGIN);

  // Solo disponible en Electron (app empaquetada)
  const isElectron = typeof window !== 'undefined' && typeof (window as any).require === 'function';

  const handleCheckForUpdates = async () => {
    if (!isElectron) return;
    setUpdateChecking(true);
    try {
      const { ipcRenderer } = (window as any).require('electron');
      const result = await ipcRenderer.invoke('check-for-updates');
      showToast(result?.message || 'Listo', result?.success ? 'success' : 'info');
    } catch (e: any) {
      showToast(e?.message || 'Error al verificar actualizaciones', 'error');
    } finally {
      setUpdateChecking(false);
    }
  };

  // Obtener empleados actualizados desde el servidor usando GraphQL
  const { data: usersData, loading: employeesLoading, refetch: refetchEmployees } = useQuery(GET_USERS_BY_BRANCH, {
    variables: { branchId: companyData?.branch?.id },
    skip: !companyData?.branch?.id,
    fetchPolicy: 'network-only' // Siempre obtener datos frescos del servidor
  });

  // Usar los empleados de la query, o fallback a los del companyData si no hay datos aún
  const allEmployees = usersData?.usersByBranch || companyData?.branch?.users || [];

  // Filtrar solo empleados activos y por término de búsqueda
  const filteredEmployees = allEmployees
    .filter((employee: any) => employee.isActive !== false) // Solo empleados activos
    .filter((employee: any) => {
      const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.toLowerCase();
      const dni = (employee.dni || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      return fullName.includes(search) || dni.includes(search);
    });

  // Determinar si el empleado seleccionado requiere contraseña
  // Para mozos: solo si tienen el permiso 'users.manage'
  // Para otros roles: siempre
  const selectedEmployeeObj = allEmployees.find((e: any) => e.dni === formData.selectedEmployee);
  const needsPassword = selectedEmployeeObj
    ? (selectedEmployeeObj.role === 'WAITER'
      ? (selectedEmployeeObj.customPermissions || []).includes('users.manage')
      : true)
    : true;

  // Verificar que existan datos de la empresa
  useEffect(() => {
    if (!companyData) {
      showToast('Primero debes iniciar sesión con los datos de la empresa', 'warning');
      navigate('/login-company');
    }
  }, [companyData, navigate, showToast]);

  // Refrescar empleados cuando cambia el branchId o cuando se monta el componente
  useEffect(() => {
    if (companyData?.branch?.id && refetchEmployees) {
      refetchEmployees();
    }
  }, [companyData?.branch?.id, refetchEmployees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verificar datos de empresa
    if (!companyData) {
      showToast('No hay datos de empresa. Redirigiendo...', 'error');
      navigate('/login-company');
      return;
    }

    // Obtener MAC real del dispositivo
    const deviceId = await getMacAddress();
    console.log('🔍 MAC obtenida del dispositivo:', deviceId);
    console.log('🔍 Tipo de deviceId:', typeof deviceId);
    console.log('🔍 Longitud de deviceId:', deviceId.length);

    // Verificar que se haya seleccionado un empleado
    if (!formData.selectedEmployee) {
      showToast('Por favor selecciona un empleado', 'warning');
      return;
    }

    // Verificar contraseña solo si es requerida para este empleado
    if (needsPassword && !formData.password) {
      showToast('Por favor ingresa tu contraseña', 'warning');
      return;
    }
    await performLogin(formData.selectedEmployee, formData.password || '');
  };

  // Función reutilizable para ejecutar el login (usada por handleSubmit y por click directo de mozo)
  const performLogin = async (dni: string, password: string) => {
    if (!companyData) {
      showToast('No hay datos de empresa. Redirigiendo...', 'error');
      navigate('/login-company');
      return false;
    }
    try {
      const deviceId = await getMacAddress();
      const { data } = await userLoginMutation({
        variables: {
          dni,
          password: password || '',
          branchId: companyData.branch.id,
          deviceId
        }
      });
      if (data?.userLogin?.success) {
        const loggedUser = data.userLogin.user;
        if (loggedUser.role === 'WAITER' && password) {
          try {
            const cachedPasswords = JSON.parse(localStorage.getItem('cached_waiter_passwords') || '{}');
            cachedPasswords[loggedUser.dni] = password;
            localStorage.setItem('cached_waiter_passwords', JSON.stringify(cachedPasswords));
          } catch (e) {
            console.error('Error guardando contraseña en caché:', e);
          }
        }
        loginUser(
          data.userLogin.token,
          data.userLogin.refreshToken,
          data.userLogin.user,
          data.userLogin.userPhotoBase64
        );
        navigate('/dashboard');
        return true;
      }
      showToast(data?.userLogin?.message || 'Error en el login', 'error');
      return false;
    } catch (err: any) {
      showToast(err?.message || 'Error en login de usuario', 'error');
      return false;
    }
  };

  const handleBackToCompany = () => {
    setShowConfirmExit(true);
  };

  const confirmExit = () => {
    // Limpiar datos de la compañía usando el método del contexto
    clearCompanyData();
    // Limpiar también tokens y datos de usuario por si acaso
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('userPhoto');
    console.log('🧹 Datos de compañía limpiados, redirigiendo a login de compañía...');
    // Navegar al login de compañía
    navigate('/login-company', { replace: true });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleVirtualKeyPress = (key: string) => {
    if (focusedInput === 'search') setSearchTerm(prev => prev + key);
    if (focusedInput === 'password') setFormData(prev => ({ ...prev, password: prev.password + key }));
  };
  const handleVirtualBackspace = () => {
    if (focusedInput === 'search') setSearchTerm(prev => prev.slice(0, -1));
    if (focusedInput === 'password') setFormData(prev => ({ ...prev, password: prev.password.slice(0, -1) }));
  };

  // Tamaños adaptativos según breakpoint (lg: 1024+, xl: 1280+, 2xl: 1536+)
  const isSmallDesktop = breakpoint === 'lg';
  const isMediumDesktop = breakpoint === 'xl';
  const isLargeDesktop = breakpoint === '2xl';
  const containerPadding = isSmallDesktop ? '0.75rem' : isMediumDesktop ? '1rem' : '1.5rem';
  // Contenedor más ancho para mostrar hasta 5 empleados por fila
  const formMaxWidth = isSmallDesktop ? '100%' : isMediumDesktop ? '780px' : '960px';
  const titleFontSize = isSmallDesktop ? 'clamp(22px, 3.5vw, 28px)' : isMediumDesktop ? 'clamp(26px, 3.5vw, 32px)' : 'clamp(28px, 3.5vw, 36px)';
  const inputFontSize = isSmallDesktop ? 'clamp(13px, 2.5vw, 15px)' : 'clamp(14px, 2.5vw, 16px)';
  const labelFontSize = isSmallDesktop ? 'clamp(13px, 2.5vw, 15px)' : 'clamp(14px, 2.5vw, 16px)';
  // Columnas del grid de empleados: responsive (hasta 5 por fila en pantallas grandes)
  const employeesGridColumns = isLargeDesktop ? 5 : isMediumDesktop ? 5 : isSmallDesktop ? 4 : 3;
  const avatarSize = isSmallDesktop ? 28 : 32;
  const cardPadding = isSmallDesktop ? '0.4rem' : '0.5rem';
  const cardFontSize = isSmallDesktop ? '11px' : '12px';
  const cardDniFontSize = isSmallDesktop ? '10px' : '11px';

  // Tema visual del login
  const theme = {
    font: "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif",
    bg: 'linear-gradient(160deg, #0f172a 0%, #1e293b 40%, #334155 100%)',
    cardBg: 'rgba(255, 255, 255, 0.98)',
    cardBorder: '1px solid rgba(255, 255, 255, 0.2)',
    cardShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05)',
    accent: '#0ea5e9',
    accentHover: '#0284c7',
    accentMuted: 'rgba(14, 165, 233, 0.12)',
    text: '#0f172a',
    textMuted: '#64748b',
    inputBg: '#f8fafc',
    inputBorder: '#e2e8f0',
    inputFocusBorder: '#0ea5e9',
    inputFocusRing: 'rgba(14, 165, 233, 0.25)',
    success: '#10b981',
    radius: 14,
    radiusSm: 10,
  };

  // Decoración restaurante: chef, croissants, utensilios, café, comida + "4 soluciones"
  const iconSize = isSmallDesktop ? 'clamp(36px, 6vmin, 56px)' : 'clamp(44px, 7vmin, 72px)';
  const croissantSize = isSmallDesktop ? 'clamp(40px, 6.5vmin, 64px)' : 'clamp(48px, 7.5vmin, 80px)';
  const smallIconSize = isSmallDesktop ? 'clamp(28px, 4.5vmin, 44px)' : 'clamp(34px, 5vmin, 52px)';
  const decorOpacity = 0.42;
  const restaurantDecor: Array<{
    key: string;
    type: 'chef' | 'croissant' | 'utensils' | 'coffee' | 'food';
    top: string;
    left: string;
  }> = [
      { key: 'c1', type: 'chef', top: '5%', left: '3%' },
      { key: 'c2', type: 'chef', top: '18%', left: '92%' },
      { key: 'c3', type: 'chef', top: '38%', left: '4%' },
      { key: 'c4', type: 'chef', top: '58%', left: '91%' },
      { key: 'c5', type: 'chef', top: '12%', left: '72%' },
      { key: 'c6', type: 'chef', top: '82%', left: '6%' },
      { key: 'c7', type: 'chef', top: '72%', left: '94%' },
      { key: 'c8', type: 'chef', top: '28%', left: '12%' },
      { key: 'c9', type: 'chef', top: '45%', left: '86%' },
      { key: 'p1', type: 'croissant', top: '8%', left: '22%' },
      { key: 'p2', type: 'croissant', top: '14%', left: '60%' },
      { key: 'p3', type: 'croissant', top: '32%', left: '6%' },
      { key: 'p4', type: 'croissant', top: '40%', left: '78%' },
      { key: 'p5', type: 'croissant', top: '58%', left: '24%' },
      { key: 'p6', type: 'croissant', top: '65%', left: '68%' },
      { key: 'p7', type: 'croissant', top: '86%', left: '32%' },
      { key: 'p8', type: 'croissant', top: '90%', left: '52%' },
      { key: 'p9', type: 'croissant', top: '25%', left: '42%' },
      { key: 'p10', type: 'croissant', top: '48%', left: '58%' },
      { key: 'p11', type: 'croissant', top: '18%', left: '38%' },
      { key: 'p12', type: 'croissant', top: '75%', left: '78%' },
      { key: 'u1', type: 'utensils', top: '7%', left: '48%' },
      { key: 'u2', type: 'utensils', top: '42%', left: '28%' },
      { key: 'u3', type: 'utensils', top: '70%', left: '62%' },
      { key: 'u4', type: 'utensils', top: '22%', left: '85%' },
      { key: 'u5', type: 'utensils', top: '88%', left: '18%' },
      { key: 'cf1', type: 'coffee', top: '10%', left: '52%' },
      { key: 'cf2', type: 'coffee', top: '55%', left: '38%' },
      { key: 'cf3', type: 'coffee', top: '78%', left: '72%' },
      { key: 'fd1', type: 'food', top: '30%', left: '62%' },
      { key: 'fd2', type: 'food', top: '62%', left: '48%' },
      { key: 'fd3', type: 'food', top: '15%', left: '28%' },
      { key: 'fd4', type: 'food', top: '85%', left: '58%' },
    ];

  // Bloquear acceso en móviles
  if (isMobile) {
    return (
      <div className="login-root login-mobile-block" style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.bg,
        fontFamily: theme.font,
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{
          background: theme.cardBg,
          borderRadius: 24,
          padding: '2.5rem 2rem',
          maxWidth: '420px',
          boxShadow: theme.cardShadow,
          border: theme.cardBorder
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem', opacity: 0.9 }}>📱</div>
          <h1 style={{
            fontSize: '1.35rem',
            fontWeight: 700,
            color: theme.text,
            marginBottom: '0.75rem',
            letterSpacing: '-0.02em'
          }}>
            Acceso no disponible en móviles
          </h1>
          <p style={{
            fontSize: '0.9375rem',
            color: theme.textMuted,
            lineHeight: 1.6
          }}>
            Usa esta aplicación en tablet o computadora para continuar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-root" style={{
      height: '100vh',
      width: '100vw',
      maxWidth: '100vw',
      background: theme.bg,
      fontFamily: theme.font,
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'hidden',
      margin: 0,
      padding: 0
    }}>
      {/* Fondo sutil con ruido */}
      <div className="login-bg-pattern" style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.4,
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(14, 165, 233, 0.2), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(14, 165, 233, 0.08), transparent)'
      }} />

      <div
        className="main-container"
        style={{
          display: 'flex',
          flexDirection: focusedInput ? 'column' : 'row',
          flexWrap: 'nowrap',
          width: '100vw',
          height: '100vh',
          position: 'relative',
          zIndex: 1,
          margin: 0,
          padding: 0,
          justifyContent: focusedInput ? 'flex-start' : 'center',
          alignItems: 'stretch',
          overflow: 'hidden'
        }}
      >

        <div className="form-panel" style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: focusedInput ? 'flex-start' : 'center',
          alignItems: 'center',
          padding: isSmallDesktop ? '0.5rem' : '1rem',
          background: theme.cardBg,
          backdropFilter: 'blur(24px)',
          position: 'relative',
          minHeight: 0,
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflow: 'auto'
        }}>
          {/* Decoración restaurante: chef, platos (con color), utensilios, café, comida + "4 soluciones" */}
          <div className="login-decorations" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
            {restaurantDecor.map((d) => {
              const isEmoji = d.type === 'chef' || d.type === 'croissant' || d.type === 'utensils' || d.type === 'coffee' || d.type === 'food';
              const emoji = d.type === 'chef' ? '👨‍🍳' : d.type === 'croissant' ? '🥐' : d.type === 'utensils' ? '🍴' : d.type === 'coffee' ? '☕' : d.type === 'food' ? '🍽️' : null;
              const size = d.type === 'chef' ? iconSize : d.type === 'croissant' ? croissantSize : smallIconSize;
              return (
                <div
                  key={d.key}
                  className={`login-deco login-deco--${d.key}`}
                  style={{
                    position: 'absolute',
                    top: d.top,
                    left: d.left,
                    width: size,
                    height: size,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: decorOpacity,
                    transform: 'translate(-50%, -50%)',
                    fontSize: isEmoji ? size : undefined,
                    lineHeight: 1,
                    filter: isEmoji ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.06))' : undefined,
                  }}
                >
                  {emoji}
                </div>
              );
            })}
            {/* Badge "4 soluciones" con el 4 destacado */}
            <div
              className="login-4soluciones"
              style={{
                position: 'absolute',
                bottom: '1.5rem',
                right: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.85,
              }}
            >
              <span style={{
                display: 'block',
                fontSize: isSmallDesktop ? '2.5rem' : '3.25rem',
                fontWeight: 800,
                lineHeight: 1,
                color: theme.accent,
                textShadow: '0 1px 2px rgba(0,0,0,0.08)',
              }}>4</span>
              <span style={{
                display: 'block',
                fontSize: isSmallDesktop ? '0.7rem' : '0.8125rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: theme.textMuted,
                textTransform: 'uppercase',
                marginTop: '0.15rem',
              }}>soluciones</span>
            </div>
          </div>
          <div className="form-container" style={{
            width: '100%',
            maxWidth: formMaxWidth,
            position: 'relative',
            zIndex: 1,
            padding: containerPadding,
            boxSizing: 'border-box'
          }}>
            {/* Ocultar cabecera cuando el teclado está visible (el teclado ocupa esa zona) */}
            {!focusedInput && (
              <header style={{ textAlign: 'center', marginBottom: isSmallDesktop ? '1.25rem' : '1.75rem' }}>
                <div style={{
                  width: isSmallDesktop ? 56 : 72,
                  height: isSmallDesktop ? 56 : 72,
                  background: `linear-gradient(145deg, ${theme.accent}, #0284c7)`,
                  borderRadius: 18,
                  margin: `0 auto ${isSmallDesktop ? '0.75rem' : '1rem'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isSmallDesktop ? 28 : 36,
                  color: 'white',
                  boxShadow: `0 12px 28px ${theme.accentMuted}`,
                  border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  👤
                </div>
                <h2 style={{
                  margin: 0,
                  color: theme.text,
                  fontSize: titleFontSize,
                  fontWeight: 700,
                  letterSpacing: '-0.03em'
                }}>
                  Iniciar sesión
                </h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.9375rem', color: theme.textMuted }}>
                  Elige tu usuario e ingresa tu contraseña
                </p>
              </header>
            )}

            <form onSubmit={handleSubmit}>
              {/* Buscador de Empleados */}
              <div style={{ marginBottom: isSmallDesktop ? '0.75rem' : '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: theme.text,
                  fontSize: labelFontSize,
                  fontWeight: 600,
                  textAlign: 'center'
                }}>
                  🔍 Buscar empleado
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nombre o DNI..."
                    className="login-input form-inputs"
                    style={{
                      width: '100%',
                      padding: isSmallDesktop ? '0.75rem 0.75rem 0.75rem 2.5rem' : '0.875rem 0.875rem 0.875rem 2.75rem',
                      border: `2px solid ${theme.inputBorder}`,
                      borderRadius: theme.radiusSm,
                      fontSize: inputFontSize,
                      backgroundColor: theme.inputBg,
                      transition: 'border-color 0.2s, box-shadow 0.2s, background-color 0.2s',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: 500
                    }}
                    onFocus={(e) => {
                      setFocusedInput('search');
                      e.target.style.borderColor = theme.inputFocusBorder;
                      e.target.style.backgroundColor = 'white';
                      e.target.style.boxShadow = `0 0 0 4px ${theme.inputFocusRing}`;
                    }}
                    onBlur={(e) => {
                      if (!keyboardRef.current?.contains(e.relatedTarget as Node)) setFocusedInput(null);
                      e.target.style.borderColor = theme.inputBorder;
                      e.target.style.backgroundColor = theme.inputBg;
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '1rem',
                    opacity: 0.7
                  }}>🔍</span>
                </div>
                {searchTerm && (
                  <p style={{
                    margin: '0.375rem 0 0',
                    fontSize: '0.8125rem',
                    color: theme.textMuted,
                    textAlign: 'center',
                    fontWeight: 500
                  }}>
                    {filteredEmployees.length} empleado(s)
                  </p>
                )}
              </div>

              {/* Selección de Empleados */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.75rem',
                  color: theme.text,
                  fontSize: labelFontSize,
                  fontWeight: 600,
                  textAlign: 'center'
                }}>
                  👥 Selecciona tu empleado
                </label>

                {employeesLoading ? (
                  <div style={{
                    color: theme.accent,
                    fontSize: '0.9375rem',
                    textAlign: 'center',
                    padding: '1.25rem',
                    backgroundColor: theme.accentMuted,
                    borderRadius: theme.radius,
                    border: `1px solid ${theme.inputFocusBorder}`,
                    fontWeight: 500
                  }}>
                    ⏳ Cargando empleados...
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <p style={{
                    color: '#b91c1c',
                    fontSize: '0.9375rem',
                    textAlign: 'center',
                    padding: '1.25rem',
                    backgroundColor: '#fef2f2',
                    borderRadius: theme.radius,
                    border: '1px solid #fecaca',
                    fontWeight: 500,
                    margin: 0
                  }}>
                    {searchTerm
                      ? `No hay resultados para "${searchTerm}"`
                      : 'No hay empleados activos en esta sucursal'
                    }
                  </p>
                ) : (
                  <div
                    className="login-employees-grid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${employeesGridColumns}, minmax(0, 1fr))`,
                      gap: isSmallDesktop ? '0.4rem' : '0.5rem',
                      maxHeight: isSmallDesktop ? 180 : 220,
                      overflowY: 'auto',
                      padding: '0.5rem',
                      backgroundColor: theme.inputBg,
                      borderRadius: theme.radius,
                      border: `1px solid ${theme.inputBorder}`
                    }}
                  >
                    {filteredEmployees.map((employee: any) => {
                      const selected = formData.selectedEmployee === employee.dni;
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          onClick={async () => {
                            const isWaiter = employee.role === 'WAITER';

                            if (isWaiter) {
                              // Mozo: intentar entrar directamente (con contraseña en caché o vacía)
                              let password = '';
                              try {
                                const cachedPasswords = JSON.parse(localStorage.getItem('cached_waiter_passwords') || '{}');
                                password = cachedPasswords[employee.dni] || '';
                              } catch (e) {
                                console.error('Error leyendo caché de contraseñas:', e);
                              }
                              const ok = await performLogin(employee.dni, password);
                              if (!ok) {
                                // Si falla, mostrar formulario para que ingrese contraseña
                                setFormData({ ...formData, selectedEmployee: employee.dni, password: '' });
                                setFocusedInput('password');
                                setTimeout(() => passwordInputRef.current?.focus(), 0);
                              }
                              return;
                            }

                            // Caja u otro rol: seleccionar y pedir contraseña
                            setFormData({
                              ...formData,
                              selectedEmployee: employee.dni,
                              password: ''
                            });
                            showToast(`Empleado seleccionado: ${employee.firstName} ${employee.lastName}`, 'success');
                            setFocusedInput('password');
                            setTimeout(() => passwordInputRef.current?.focus(), 0);
                          }}
                          className="login-employee-btn"
                          style={{
                            padding: cardPadding,
                            border: selected ? `2px solid ${theme.accent}` : `1px solid ${theme.inputBorder}`,
                            borderRadius: theme.radiusSm,
                            backgroundColor: selected ? theme.accentMuted : 'white',
                            cursor: 'pointer',
                            transition: 'border-color 0.2s, background-color 0.2s, box-shadow 0.2s',
                            textAlign: 'left',
                            fontSize: cardFontSize,
                            fontWeight: 600,
                            color: theme.text,
                            boxShadow: selected ? `0 2px 8px ${theme.accentMuted}` : 'none',
                            minWidth: 0
                          }}
                          onMouseOver={(e) => {
                            if (!selected) {
                              e.currentTarget.style.borderColor = theme.accent;
                              e.currentTarget.style.backgroundColor = theme.accentMuted;
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!selected) {
                              e.currentTarget.style.borderColor = theme.inputBorder;
                              e.currentTarget.style.backgroundColor = 'white';
                            }
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            marginBottom: '0.2rem',
                            minWidth: 0
                          }}>
                            {employee.photoBase64 ? (
                              <img
                                src={employee.photoBase64.startsWith('data:')
                                  ? employee.photoBase64
                                  : `data:image/jpeg;base64,${employee.photoBase64}`}
                                alt={`${employee.firstName} ${employee.lastName}`}
                                style={{
                                  width: avatarSize,
                                  height: avatarSize,
                                  minWidth: avatarSize,
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: `1px solid ${theme.inputBorder}`
                                }}
                                onError={(e) => {
                                  const el = e.currentTarget;
                                  el.style.display = 'none';
                                  const span = document.createElement('span');
                                  span.setAttribute('style', `font-size: ${Math.round(avatarSize * 0.65)}px; min-width: ${avatarSize}px; text-align: center;`);
                                  span.textContent = '👤';
                                  el.parentElement?.insertBefore(span, el);
                                }}
                              />
                            ) : (
                              <span style={{ fontSize: `${Math.round(avatarSize * 0.65)}px`, minWidth: avatarSize, textAlign: 'center' }}>👤</span>
                            )}
                            <span style={{
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {employee.firstName} {employee.lastName}
                            </span>
                          </div>
                          <div style={{
                            fontSize: cardDniFontSize,
                            color: '#000',
                            marginLeft: avatarSize + 6,
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            DNI: {employee.dni}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1rem', marginTop: 0 }}>
                <label className="form-labels" style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: theme.text,
                  fontSize: labelFontSize,
                  fontWeight: 600
                }}>
                  🔒 Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className="login-input form-inputs"
                    style={{
                      width: '100%',
                      padding: isSmallDesktop ? '0.75rem 2.5rem 0.75rem 2.5rem' : '0.875rem 2.75rem 0.875rem 2.75rem',
                      border: `2px solid ${theme.inputBorder}`,
                      borderRadius: theme.radius,
                      fontSize: inputFontSize,
                      backgroundColor: theme.inputBg,
                      transition: 'border-color 0.2s, box-shadow 0.2s, background-color 0.2s',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: 500
                    }}
                    onFocus={(e) => {
                      setFocusedInput('password');
                      e.target.style.borderColor = theme.inputFocusBorder;
                      e.target.style.backgroundColor = 'white';
                      e.target.style.boxShadow = `0 0 0 4px ${theme.inputFocusRing}`;
                    }}
                    onBlur={(e) => {
                      if (!keyboardRef.current?.contains(e.relatedTarget as Node)) setFocusedInput(null);
                      e.target.style.borderColor = theme.inputBorder;
                      e.target.style.backgroundColor = theme.inputBg;
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '1.125rem',
                    pointerEvents: 'none',
                    opacity: 0.7
                  }}>🔒</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.125rem',
                      color: theme.textMuted,
                      transition: 'background-color 0.2s, color 0.2s',
                      borderRadius: 8
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = theme.inputBg;
                      e.currentTarget.style.color = theme.text;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = theme.textMuted;
                    }}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: isSmallDesktop ? '0.5rem' : '0.75rem'
              }}>
                <button
                  type="button"
                  onClick={handleBackToCompany}
                  style={{
                    width: '100%',
                    padding: isSmallDesktop ? '0.75rem' : '0.9375rem 1rem',
                    background: `linear-gradient(145deg, ${theme.accent}, ${theme.accentHover})`,
                    color: 'white',
                    border: 'none',
                    borderRadius: theme.radius,
                    fontSize: isSmallDesktop ? '0.875rem' : '0.9375rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'opacity 0.2s, transform 0.2s, box-shadow 0.2s',
                    boxShadow: `0 8px 24px ${theme.accentMuted}`,
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = `0 12px 28px ${theme.accentMuted}`;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = `0 8px 24px ${theme.accentMuted}`;
                  }}
                >
                  🔙 Volver
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: isSmallDesktop ? '0.75rem' : '0.9375rem 1rem',
                    background: loading ? '#cbd5e1' : `linear-gradient(145deg, ${theme.accent}, ${theme.accentHover})`,
                    color: 'white',
                    border: 'none',
                    borderRadius: theme.radius,
                    fontSize: isSmallDesktop ? '0.875rem' : '0.9375rem',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.2s, transform 0.2s, box-shadow 0.2s',
                    boxShadow: loading ? 'none' : `0 8px 24px ${theme.accentMuted}`,
                    opacity: loading ? 0.8 : 1
                  }}
                  onMouseOver={(e) => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = `0 12px 28px ${theme.accentMuted}`;
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = `0 8px 24px ${theme.accentMuted}`;
                    }
                  }}
                >
                  {loading ? '⏳ Autenticando...' : '✨ Iniciar sesión'}
                </button>

                {isElectron && (
                  <button
                    type="button"
                    onClick={handleCheckForUpdates}
                    disabled={updateChecking}
                    style={{
                      gridColumn: '1 / -1',
                      padding: '0.5rem',
                      background: 'transparent',
                      color: theme.textMuted,
                      border: 'none',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      cursor: updateChecking ? 'not-allowed' : 'pointer',
                      opacity: updateChecking ? 0.7 : 1,
                      marginTop: '0.25rem'
                    }}
                  >
                    {updateChecking ? '⏳ Buscando actualizaciones...' : '🔄 Actualizar sistema'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Teclado virtual en la parte inferior */}
        {focusedInput && (
          <div
            ref={keyboardRef}
            className="login-keyboard-panel"
            style={{
              flex: '0 0 auto',
              width: '100%',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              padding: isSmallDesktop ? '0.4rem 0.75rem' : '0.5rem 1rem',
              background: theme.cardBg,
              borderTop: `1px solid ${theme.inputBorder}`,
              boxSizing: 'border-box',
              overflow: 'hidden',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
              zIndex: 10
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 600, color: theme.text }}>
              ⌨️ Teclado virtual
            </div>
            <div style={{ width: '100%', minWidth: 0 }}>
              <VirtualKeyboard
                onKeyPress={handleVirtualKeyPress}
                onBackspace={handleVirtualBackspace}
                compact={true}
              />
            </div>
          </div>
        )}
      </div>

      {showConfirmExit && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 24,
            padding: '2.5rem',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem' }}>👋</div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>¿Estas seguro que quieres salir?</h3>
            <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: 1.6 }}>Al volver se cerrará la sesión actual de la empresa.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button
                onClick={() => setShowConfirmExit(false)}
                style={{
                  padding: '0.875rem',
                  borderRadius: 14,
                  border: '1px solid #e2e8f0',
                  background: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#0f172a'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                No, quedar
              </button>
              <button
                onClick={confirmExit}
                style={{
                  padding: '0.875rem',
                  borderRadius: 14,
                  border: 'none',
                  background: `linear-gradient(145deg, ${theme.accent}, ${theme.accentHover})`,
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: `0 8px 16px ${theme.accentMuted}`
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box !important; }
        body, html {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          height: 100vh !important;
          width: 100vw !important;
        }
        .login-root .form-panel {
          height: 100vh !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .login-root .login-input:focus {
          outline: none;
        }
        .login-root .login-keyboard-panel {
          min-width: 0;
        }
        .login-root .login-decorations .login-deco {
          transition: opacity 0.25s ease;
        }
        @media (max-width: 900px) {
          .login-root .login-decorations .login-deco { opacity: 0.3 !important; }
        }
        @media (max-width: 700px) {
          .login-root .login-decorations .login-deco { opacity: 0.2 !important; }
        }
      `}</style>
    </div>
  );
};

export default Login;
