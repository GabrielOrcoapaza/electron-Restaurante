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
  const { isMobile, isTablet } = useResponsive();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    selectedEmployee: '',
    password: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'search' | 'password' | null>(null);
  /** Teclado mostrado explícitamente con el botón (además del foco en buscar/contraseña) */
  const [virtualKeyboardOpen, setVirtualKeyboardOpen] = useState(false);
  const keyboardActive = focusedInput !== null || virtualKeyboardOpen;
  const keyboardRef = useRef<HTMLDivElement>(null);
  const passwordFormRef = useRef<HTMLFormElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);

  const [userLoginMutation, { loading }] = useMutation(USER_LOGIN);

  const { data: usersData, loading: employeesLoading, refetch: refetchEmployees } = useQuery(GET_USERS_BY_BRANCH, {
    variables: { branchId: companyData?.branch?.id, includeInactive: false },
    skip: !companyData?.branch?.id,
    fetchPolicy: 'network-only'
  });

  const allEmployees = usersData?.usersByBranch || companyData?.branch?.users || [];

  const filteredEmployees = allEmployees
    .filter((employee: any) => employee.isActive !== false)
    .filter((employee: any) => {
      const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.toLowerCase();
      const dni = (employee.dni || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      return fullName.includes(search) || dni.includes(search);
    });

  const selectedEmployeeObj = allEmployees.find((e: any) => e.dni === formData.selectedEmployee);
  const needsPassword = selectedEmployeeObj
    ? (selectedEmployeeObj.role === 'WAITER'
      ? (selectedEmployeeObj.customPermissions || []).includes('users.manage')
      : true)
    : true;

  useEffect(() => {
    if (!companyData) {
      showToast('Primero debes iniciar sesión con los datos de la empresa', 'warning');
      navigate('/login-company');
    }
  }, [companyData, navigate, showToast]);

  useEffect(() => {
    if (companyData?.branch?.id && refetchEmployees) {
      refetchEmployees();
    }
  }, [companyData?.branch?.id, refetchEmployees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyData) {
      showToast('No hay datos de empresa. Redirigiendo...', 'error');
      navigate('/login-company');
      return;
    }

    if (!formData.selectedEmployee) {
      showToast('Por favor selecciona un empleado', 'warning');
      return;
    }

    if (needsPassword && !formData.password) {
      showToast('Por favor ingresa tu contraseña', 'warning');
      return;
    }

    await performLogin(formData.selectedEmployee, formData.password || '');
  };

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
        showToast(`¡Bienvenido, ${loggedUser.firstName || 'usuario'}!`, 'success');
        try {
          sessionStorage.setItem('postLoginOpenFloors', '1');
          localStorage.setItem('currentDashboardView', 'floors');
        } catch {
          /* ignorar si no hay storage */
        }
        navigate('/dashboard');
        return true;
      }
      showToast(data?.userLogin?.message || 'Contraseña incorrecta', 'error');
      return false;
    } catch (err: any) {
      let errorMessage = 'Contraseña incorrecta';
      if (err.graphQLErrors && err.graphQLErrors.length > 0) {
        const firstMsg = err.graphQLErrors[0]?.message;
        if (firstMsg) errorMessage = firstMsg;
      } else if (err.message) {
        errorMessage = err.message;
      }
      showToast(errorMessage, 'error');
      return false;
    }
  };

  const handleBackToCompany = () => {
    setShowConfirmExit(true);
  };

  const confirmExit = () => {
    clearCompanyData();
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('userPhoto');
    navigate('/login-company', { replace: true });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleVirtualKeyPress = (key: string) => {
    if (focusedInput === 'search') setSearchTerm(prev => prev + key);
    if (focusedInput === 'password') setFormData(prev => ({ ...prev, password: prev.password + key }));
  };
  const handleVirtualBackspace = () => {
    if (focusedInput === 'search') setSearchTerm(prev => prev.slice(0, -1));
    if (focusedInput === 'password') setFormData(prev => ({ ...prev, password: prev.password.slice(0, -1) }));
  };

  const closeVirtualKeyboard = () => {
    setVirtualKeyboardOpen(false);
    setFocusedInput(null);
    searchInputRef.current?.blur();
    passwordInputRef.current?.blur();
  };

  const activateVirtualKeyboard = () => {
    setVirtualKeyboardOpen(true);
    if (formData.selectedEmployee) {
      setFocusedInput('password');
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    } else {
      setFocusedInput('search');
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  return (
    <div className="login-user-wrapper">
      <div className="login-bg-image"></div>
      <div className="login-overlay"></div>

      <div className={`fullscreen-glass-card ${keyboardActive ? 'keyboard-active' : ''}`}>

        {/* CABECERA: Ahora integra el buscador de empleados */}
        <div className="card-header">
          <div className="header-top-row">
            <div className="header-info">
              <div className="user-icon-ring">
                <span className="user-icon">👤</span>
              </div>
              {/* SEARCH BOX integrado al lado del usuario */}
              <div className="search-container">
                <span className="search-icon">🔍</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar empleado por nombre o DNI..."
                  className={`search-input ${focusedInput === 'search' ? 'focused' : ''}`}
                  onFocus={() => {
                    setFocusedInput('search');
                    setTimeout(() => {
                      searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                    }, 300);
                  }}
                />
              </div>
            </div>

            <div className="header-actions">
              <button type="button" className="btn-back" onClick={handleBackToCompany}>
                🔙 <span className="action-text">Cambiar Local</span>
              </button>
            </div>
          </div>


        </div>

        <div className="card-body">

          <div className="left-column">
            {/* EMPLOYEES GRID */}
            <div className="employees-scroll-area employees-scroll-area-content">
              {employeesLoading ? (
                <div className="loading-state">
                  <span className="spinner">⏳</span>
                  <p>Cargando personal...</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="empty-state">
                  <span>😟</span>
                  <p>{searchTerm ? `No se encontró a "${searchTerm}"` : 'El local está vacío.'}</p>
                </div>
              ) : (
                <div className="employees-grid">
                  {filteredEmployees.map((employee: any) => {
                    const selected = formData.selectedEmployee === employee.dni;
                    return (
                      <button
                        key={employee.id}
                        type="button"
                        className={`employee-card ${selected ? 'selected' : ''}`}
                        onClick={async () => {
                          const isWaiter = employee.role === 'WAITER';

                          if (isWaiter) {
                            let password = '';
                            try {
                              const cachedPasswords = JSON.parse(localStorage.getItem('cached_waiter_passwords') || '{}');
                              password = cachedPasswords[employee.dni] || '';
                            } catch (e) { }
                            const ok = await performLogin(employee.dni, password);
                            if (!ok) {
                              setFormData({ ...formData, selectedEmployee: employee.dni, password: '' });
                              setFocusedInput('password');
                              setTimeout(() => passwordInputRef.current?.focus(), 0);
                            }
                            return;
                          }

                          setFormData({
                            ...formData,
                            selectedEmployee: employee.dni,
                            password: ''

                          });
                          showToast(`Has seleccionado a ${employee.firstName}`, 'success');
                          setFocusedInput('password');
                          setTimeout(() => passwordInputRef.current?.focus(), 0);
                        }}
                      >
                        <div className="employee-avatar">
                          {employee.photoBase64 ? (
                            <img
                              src={employee.photoBase64.startsWith('data:')
                                ? employee.photoBase64
                                : `data:image/jpeg;base64,${employee.photoBase64}`}
                              alt={employee.firstName}
                              onError={(e) => {
                                const el = e.currentTarget;
                                el.style.display = 'none';
                                el.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <span className={`fallback-avatar ${employee.photoBase64 ? 'hidden' : ''}`}>👤</span>
                        </div>
                        <div className="employee-info">
                          <span className="employee-name">{employee.firstName} {employee.lastName}</span>
                          <span className="employee-role">{employee.dni}</span>
                        </div>
                        {selected && <div className="selected-badge">✓</div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Teclado solo sobre la columna de mozos / empleados (no invade contraseña) */}
            <div
              ref={keyboardRef}
              className={`keyboard-overlay ${keyboardActive ? 'visible' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="keyboard-container">
                <VirtualKeyboard
                  onKeyPress={handleVirtualKeyPress}
                  onBackspace={handleVirtualBackspace}
                  compact
                  tight={isMobile || isTablet}
                  onClose={closeVirtualKeyboard}
                  onEnter={() => {
                    if (focusedInput === 'password') {
                      passwordFormRef.current?.requestSubmit();
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div className="right-column">
            {/* PASSWORD AREA */}
            <form ref={passwordFormRef} className="password-area" onSubmit={handleSubmit}>
              <div className="password-header">
                <h2>Contraseña</h2>
                <p>{formData.selectedEmployee ? 'Ingresa tu llave privada' : 'Selecciona tu usuario primero'}</p>
              </div>

              <div className={`password-input-group ${focusedInput === 'password' ? 'focused' : ''}`}>
                <span className="pass-icon">🔒</span>
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="pass-input"
                  onFocus={() => {
                    setFocusedInput('password');
                    setTimeout(() => {
                      passwordInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                    }, 300);
                  }}
                  disabled={!formData.selectedEmployee}
                />
                <button
                  type="button"
                  className="pass-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={!formData.selectedEmployee}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>

              <div className="action-buttons">
                <button type="submit" disabled={loading || !formData.selectedEmployee} className="btn-submit">
                  {loading ? '⏳' : '🚀 Iniciar Sesión'}
                </button>
              </div>
            </form>
          </div>

        </div>

        {!keyboardActive && (
          <button
            type="button"
            className="btn-float-virtual-keyboard"
            onClick={activateVirtualKeyboard}
            title="Teclado virtual"
            aria-label="Teclado virtual"
          >
            <span className="float-kb-icon" aria-hidden>⌨️</span>
          </button>
        )}

      </div>

      {/* MODAL CONFIRM EXIT */}
      {showConfirmExit && (
        <div className="modal-overlay">
          <div className="modal-content">
            <span className="modal-emoji">👋</span>
            <h3>¿Cambiar sucursal/empresa?</h3>
            <p>Se cerrará la conexión actual. Deberás volver a colocar el RUC para acceder.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowConfirmExit(false)}>Mejor No</button>
              <button className="btn-confirm" onClick={confirmExit}>Sí, Cambiar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        :root {
          --primary: #FF6B6B;
          --primary-hover: #ff5252;
          --secondary: #FFA726;
          --bg-card: rgba(255, 255, 255, 0.95);
          --text-dark: #2d3748;
          --text-muted: #718096;
          --border-color: #e2e8f0;
          --input-bg: rgba(247, 250, 252, 0.9);
        }

        .login-user-wrapper {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          width: 100vw; height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          z-index: 99999;
          overflow: hidden;
          background: #000;
        }

        .login-bg-image {
          position: absolute;
          inset: -5%;
          width: 110%; height: 110%;
          background-image: url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1920');
          background-size: cover;
          background-position: center;
          z-index: 1;
          filter: brightness(1.2);
          animation: smoothZoom 40s infinite alternate ease-in-out;
        }

        @keyframes smoothZoom {
          0% { transform: scale(1) translate(0, 0); }
          100% { transform: scale(1.05) translate(-1%, -1%); }
        }

        .login-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 107, 107, 0.65) 0%, rgba(255, 167, 38, 0.7) 50%, rgba(171, 71, 188, 0.6) 100%);
          backdrop-filter: blur(8px);
          z-index: 2;
        }

        .fullscreen-glass-card {
          position: relative;
          z-index: 10;
          background: var(--bg-card);
          backdrop-filter: blur(25px);
          box-shadow: 0 40px 80px rgba(0,0,0,0.3);
          width: 98vw;
          height: 96vh;
          border-radius: 2rem;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: popUpCard 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: padding-bottom 0.4s ease;
        }

        /* Aire inferior solo en la lista de mozos cuando el teclado está abierto */
        .fullscreen-glass-card.keyboard-active {
           padding-bottom: 0;
        }
        .keyboard-active .left-column .employees-scroll-area {
          padding-bottom: min(34vh, 280px);
        }

        @keyframes popUpCard {
          0% { opacity: 0; transform: scale(0.95) translateY(40px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* HEADER & SEARCH BAR */
        .card-header {
          display: flex;
          flex-direction: column;
          padding: 1.5rem 3rem;
          background: rgba(255, 255, 255, 0.7);
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
          gap: 1.5rem;
          transition: all 0.3s ease;
        }
        
        /* SEARCH BOX */
        .search-container {
          position: relative;
          width: 100%;
          min-width: 300px;
          max-width: 500px;
        }

        .search-icon {
          position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.25rem; opacity: 0.5;
        }

        .search-input {
          width: 100%;
          padding: 0.85rem 1rem 0.85rem 3rem;
          background: var(--input-bg);
          border: 2px solid var(--border-color); border-radius: 1rem;
          font-size: 1rem; font-weight: 500; color: var(--text-dark); outline: none; transition: all 0.2s;
        }
        .search-input:focus, .search-input.focused {
          background: white; border-color: var(--secondary); box-shadow: 0 0 0 4px rgba(255, 167, 38, 0.15);
        }

        .header-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .user-icon-ring {
          width: 3.5rem; height: 3.5rem;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          border-radius: 1rem;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 5px 15px rgba(255, 107, 107, 0.4);
        }

        .user-icon { font-size: 1.7rem; color: white; }



        .header-actions {
           display: flex;
           gap: 0.75rem;
           flex-wrap: wrap;
           align-items: center;
        }

        .btn-float-virtual-keyboard {
          position: absolute;
          left: max(1rem, calc(1rem + env(safe-area-inset-left, 0px)));
          bottom: max(1rem, calc(1rem + env(safe-area-inset-bottom, 0px)));
          z-index: 45;
          width: 3.5rem;
          height: 3.5rem;
          padding: 0;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          cursor: pointer;
          border: none;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.45), 0 2px 8px rgba(0, 0, 0, 0.12);
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        .btn-float-virtual-keyboard:hover {
          filter: brightness(1.06);
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(99, 102, 241, 0.5), 0 4px 12px rgba(0, 0, 0, 0.14);
        }
        .btn-float-virtual-keyboard:active {
          transform: translateY(0);
        }
        .float-kb-icon {
          font-size: 1.45rem;
          line-height: 1;
        }

        .btn-back, .btn-update {
           padding: 0.6rem 1.2rem;
           border-radius: 0.75rem;
           font-weight: 700;
           font-size: 0.9rem;
           cursor: pointer;
           border: none;
           display: flex;
           align-items: center;
           gap: 0.5rem;
           transition: all 0.2s;
        }

        .btn-back {
           background: white; color: var(--text-dark); border: 1px solid var(--border-color);
           box-shadow: 0 2px 5px rgba(0,0,0,0.02);
        }
        .btn-back:hover { background: #f8fafc; transform: translateY(-2px); }

        .btn-update { background: #475569; color: white; }
        .btn-update:hover { background: #334155; transform: translateY(-2px); }





        /* Sin compactar el header al abrir teclado: evita que la columna derecha
           (justify-content: center) recalcule y "salte" el bloque de login */

        /* BODY DE DOS COLUMNAS */
        .card-body {
          flex: 1; display: flex; padding: 1.5rem 3rem; gap: 2.5rem; min-height: 0;
        }
        
        .left-column {
           position: relative;
           flex: 1.85;
           display: flex;
           flex-direction: column;
           min-width: 0;
           min-height: 0;
           border-right: 1px solid var(--border-color);
           padding-right: 2.5rem;
        }

        /* Teclado: ancho de la columna izquierda (mozos), alineado al divisor con contraseña */
        .keyboard-overlay {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          width: auto;
          max-width: none;
          transform: translateY(100%);
          max-height: min(40vh, 300px);
          z-index: 55;
          padding: 0.4rem 0.4rem max(0.5rem, env(safe-area-inset-bottom));
          box-sizing: border-box;
          overflow-x: hidden;
          overflow-y: auto;
          scrollbar-width: auto;
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          border: 1px solid #cbd5e1;
          border-radius: 1rem;
          background: rgba(248, 250, 252, 0.98);
          backdrop-filter: blur(12px);
          box-shadow: 0 -8px 32px rgba(0,0,0, 0.1), 0 4px 16px rgba(0,0,0, 0.06);
          transition: transform 0.36s cubic-bezier(0.16, 1, 0.35, 1), opacity 0.26s ease, visibility 0.36s;
        }
        .keyboard-overlay.visible {
          transform: translateY(0);
          pointer-events: auto;
          opacity: 1;
          visibility: visible;
        }
        .keyboard-overlay .keyboard-container {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
        }
        .keyboard-overlay::-webkit-scrollbar {
          width: 22px;
        }
        .keyboard-overlay::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .keyboard-overlay::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 10px;
          border: 3px solid #f1f5f9;
        }
        .keyboard-overlay::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
        .right-column {
           flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0; max-width: 450px;
        }

        /* GRID EMPLEADOS - SMALLER CARDS */
        .employees-scroll-area {
          flex: 1; overflow-y: auto; min-height: 0; border-radius: 1rem; padding-right: 0.5rem;
          scrollbar-width: auto;
        }
        .employees-scroll-area::-webkit-scrollbar {
          width: 22px;
        }
        .employees-scroll-area::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .employees-scroll-area::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 10px;
          border: 3px solid #f1f5f9;
        }
        .employees-scroll-area::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }

        .employees-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
          gap: 1rem;
          padding-bottom: 1rem;
        }

        .employee-card {
          background: white;
          border: 2px solid var(--border-color);
          border-radius: 1rem;
          padding: 0.8rem 0.85rem;
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          text-align: left;
          position: relative;
        }

        .employee-card:hover {  border-color: var(--primary); transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.06); }
        .employee-card.selected { border-color: var(--primary); background: #fff5f5; box-shadow: 0 0 0 3px rgba(255, 107, 107, 0.15); }

        .employee-avatar {
          width: 2.95rem; height: 2.95rem;
          border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0; border: 1px solid var(--border-color);
          margin-top: 0.08rem;
        }
        .employee-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .fallback-avatar { font-size: 1.4rem; }

        .employee-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          overflow: visible;
          padding-right: 1.5rem;
        }
        .employee-name {
          font-weight: 800;
          color: var(--text-dark);
          font-size: 0.95rem;
          line-height: 1.32;
          margin-bottom: 0.15rem;
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .employee-role {
          font-weight: 600;
          color: var(--text-muted);
          font-size: 0.76rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .selected-badge {
           position: absolute; right: 0.5rem; top: 0.5rem; background: var(--primary); color: white;
           width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;
           font-size: 0.75rem;
           animation: popIn 0.3s ease forwards;
        }
        @keyframes popIn { 0%{transform: scale(0);} 100%{transform: scale(1);} }

        /* LOADING & EMPTY */
        .loading-state, .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-weight: 700; font-size: 1.1rem; }
        .spinner { font-size: 3rem; margin-bottom: 1rem; animation: spin 2s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .empty-state span { font-size: 4rem; margin-bottom: 1rem; }

        /* PASSWORD AREA */
        .password-area {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          background: rgba(255,255,255,0.7);
          padding: 2rem;
          border-radius: 1.5rem;
          border: 1px solid var(--border-color);
        }

        .password-header h2 { font-size: 1.5rem; font-weight: 800; color: var(--text-dark); margin-bottom: 0.25rem; }
        .password-header p { font-size: 0.95rem; color: var(--text-muted); font-weight: 500; }

        .password-input-group { position: relative; }
        .pass-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem; opacity: 0.5; color: var(--text-dark); }
        .pass-input {
          width: 100%; padding: 1.25rem 3.5rem; background: var(--input-bg); border: 2px solid var(--border-color); border-radius: 1rem;
          font-size: 1.1rem; color: var(--text-dark); outline: none; transition: all 0.2s; font-weight: 800; letter-spacing: 2px;
        }
        .pass-input:focus, .password-input-group.focused .pass-input { background: white; border-color: var(--primary); box-shadow: 0 0 0 4px rgba(255, 107, 107, 0.15); }
        .pass-input:disabled { background: #e2e8f0; cursor: not-allowed; opacity: 0.6; }
        .pass-toggle { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted); }
        .pass-toggle:hover { transform: translateY(-50%) scale(1.1); }

        .btn-submit {
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          color: white; border: none; border-radius: 1rem; padding: 1.25rem;
          font-weight: 800; font-size: 1.1rem; cursor: pointer; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); width: 100%;
          box-shadow: 0 10px 20px rgba(255, 107, 107, 0.3); text-transform: uppercase;
        }
        .btn-submit:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(255, 107, 107, 0.4); }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(0.5); box-shadow: none; }

        /* VIRTUAL KEYBOARD IPAD STYLE */
        .keyboard-slider {
          position: absolute; bottom: 0; left: 0; width: 100%; height: auto;
          background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px);
          border-top: 1px solid var(--border-color);
          transform: translateY(100%); transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 100;
          padding: 1rem 1rem 1.5rem 1rem;
          box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
        }
        .keyboard-slider.visible { transform: translateY(0); }
        .keyboard-container { max-width: 1200px; margin: 0 auto; height: 100%; }
        .keyboard-topbar {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 0.75rem; color: var(--text-dark); font-weight: 800; font-size: 1rem;
          border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem;
        }
        .close-kb-btn {
          background: var(--primary); color: white; border: none; font-size: 0.95rem; cursor: pointer; 
          padding: 0.5rem 1rem; border-radius: 0.75rem; font-weight: bold; transition: all 0.2s;
        }
        .close-kb-btn:hover { background: var(--primary-hover); transform: translateY(-2px); }

        /* MODAL EXIT */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 999999; }
        .modal-content { background: white; border-radius: 1.5rem; padding: 2.5rem; max-width: var(--modal-max-width, min(90vw, 28rem)); width: 100%; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.3); animation: popUpCard 0.4s ease forwards; }
        .modal-emoji { font-size: 3.5rem; display: block; margin-bottom: 1rem; }
        .modal-content h3 { font-size: 1.4rem; font-weight: 800; color: var(--text-dark); margin-bottom: 0.5rem; }
        .modal-content p { color: var(--text-muted); font-size: 1rem; margin-bottom: 2rem; }
        .modal-actions { display: flex; gap: 1rem; }
        .btn-cancel, .btn-confirm { flex: 1; border: none; padding: 0.85rem; border-radius: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s; font-size: 1rem; }
        .btn-cancel { background: #f1f5f9; color: var(--text-dark); }
        .btn-cancel:hover { background: #e2e8f0; }
        .btn-confirm { background: #ef4444; color: white; box-shadow: 0 10px 20px rgba(239, 68, 68, 0.3); }
        .btn-confirm:hover { transform: translateY(-2px); box-shadow: 0 15px 30px rgba(239, 68, 68, 0.4); }

        /* RESPONSIVIDAD: 4K, Desktop, Tablets y Teléfonos */
        @media (max-width: 1024px) {
          .fullscreen-glass-card { width: 100vw; height: 100vh; border-radius: 0; border: none; }
          .card-header { padding: 1.5rem; gap: 1rem; flex-direction: column; align-items: stretch; }
          .header-top-row { flex-wrap: wrap; gap: 1rem; }
          .search-container { max-width: 100%; }
          .card-body { padding: 1.5rem; gap: 1.5rem; }
          .left-column { padding-right: 1.5rem; }
          .fullscreen-glass-card.keyboard-active { padding-bottom: 0; }
        }

        @media (max-width: 768px) {
          .card-body {
            flex-direction: column;
            overflow-y: auto;
            padding-top: 1rem;
            scrollbar-width: auto;
          }
          .card-body::-webkit-scrollbar {
            width: 22px;
          }
          .card-body::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 10px;
          }
          .card-body::-webkit-scrollbar-thumb {
            background: #94a3b8;
            border-radius: 10px;
            border: 3px solid #f1f5f9;
          }
          .card-body::-webkit-scrollbar-thumb:hover {
            background: #64748b;
          }
          .left-column { border-right: none; padding-right: 0; flex: none; }
          .right-column { padding-top: 1.5rem; border-top: 1px solid var(--border-color); margin-top: 1.5rem; max-width: 100%; }
          .action-text { display: none; } /* Ocultar texto en botones de retroceso para ganar espacio */
          .btn-float-virtual-keyboard {
            left: max(0.65rem, calc(0.65rem + env(safe-area-inset-left, 0px)));
            bottom: max(0.65rem, calc(0.65rem + env(safe-area-inset-bottom, 0px)));
            width: 3.1rem;
            height: 3.1rem;
          }
          .float-kb-icon { font-size: 1.25rem; }
          .header-info { gap: 0.75rem; }
          .user-icon-ring { width: 3rem; height: 3rem; border-radius: 0.75rem; }
          .user-icon { font-size: 1.5rem; }
        }

        @media (max-width: 480px) {
           .employees-grid { grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); }
           .employee-avatar { width: 2.35rem; height: 2.35rem; }
           .fallback-avatar { font-size: 1.05rem; }
           .employee-name { font-size: 0.86rem; }
           .employee-role { font-size: 0.7rem; }
           .employee-card { padding: 0.55rem 0.6rem; gap: 0.55rem; border-radius: 0.8rem; }
           .pass-input { padding: 1rem 3rem; font-size: 1rem; }
        }
      `}</style>
    </div>
  );
};

export default Login;
