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
  const { isMobile, isTablet } = useResponsive();
  const { showToast } = useToast();
  const isElectron = navigator.userAgent.toLowerCase().includes('electron');
  
  const [formData, setFormData] = useState({
    ruc: '',
    email: '',
    password: ''
  });
  
  const [macAddress, setMacAddress] = useState<string>('Cargando...');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [focusedInput, setFocusedInput] = useState<'ruc' | 'email' | 'password' | null>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  
  const [companyLoginMutation, { loading }] = useMutation(COMPANY_LOGIN);

  useEffect(() => {
    const fetchMacAddress = async () => {
      try {
        const mac = await getMacAddress();
        setMacAddress(mac);
      } catch (error) {
        showToast('Error al obtener la dirección MAC del dispositivo', 'error');
        setMacAddress('No disponible');
      }
    };
    fetchMacAddress();
  }, [getMacAddress, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación previa con toast
    const rucClean = formData.ruc.trim().replace(/\D/g, '');
    if (rucClean.length !== 11) {
      showToast('El RUC debe tener exactamente 11 dígitos', 'error');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      showToast('Ingresa un correo electrónico válido', 'error');
      return;
    }
    if (!formData.password.trim()) {
      showToast('Ingresa tu contraseña', 'error');
      return;
    }

    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('userPhoto');

    try {
      const { data } = await companyLoginMutation({
        variables: {
          ruc: formData.ruc,
          email: formData.email,
          password: formData.password
        }
      });

      if (data?.companyLogin?.success) {
        const allTables = (data.companyLogin.branch.floors || []).flatMap((floor: any) =>
          (floor.tables || []).map((table: any) => ({
            ...table,
            floorId: floor.id,
            floorName: floor.name
          }))
        );

        showToast('Empresa validada correctamente', 'success');

        loginCompany({
          company: data.companyLogin.company,
          branch: {
            ...data.companyLogin.branch,
            users: data.companyLogin.branch.users || [],
            floors: data.companyLogin.branch.floors || [],
            categories: data.companyLogin.branch.categories || [],
            tables: allTables,
            igvPercentage: data.companyLogin.branch.igvPercentage
          },
          companyLogo: data.companyLogin.companyLogoBase64,
          branchLogo: data.companyLogin.branchLogoBase64,
          availableBranches: data.companyLogin.availableBranches
        });

        navigate('/login-employee');
      } else {
        showToast(data?.companyLogin?.message || 'RUC, correo o contraseña incorrectos', 'error');
      }
    } catch (err: any) {
      let errorMessage = 'RUC, correo o contraseña incorrectos';
      if (err.graphQLErrors && err.graphQLErrors.length > 0) {
        const firstMsg = err.graphQLErrors[0]?.message;
        if (firstMsg) errorMessage = firstMsg;
      } else if (err.networkError) {
        if (err.networkError.message?.includes('Failed to fetch')) {
          errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
        } else {
          errorMessage = 'Error de conexión con el servidor';
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      showToast(errorMessage, 'error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
    <div className="login-wrapper">
      <div className="login-bg-image"></div>
      <div className="login-overlay"></div>
      
      <div className="glass-card">
        {/* PANEL IZQUIERDO (Branding) */}
        {!isMobile && (
          <div className="left-panel">
            <div className="brand-content">
              <div className="brand-icon-container">
                <span className="brand-icon">🍽️</span>
              </div>
              <h1 className="brand-title">AppSuma</h1>
              <p className="brand-subtitle">Gestión inteligente para restaurantes modernos. Controla todo en tiempo real.</p>
              
              <div className="mac-address-pill">
                <span className="pill-icon">🖥️</span>
                <span className="pill-text">MAC: {macAddress}</span>
              </div>
            </div>
            
            <div className="features-grid">
              <div className="feature-item">
                <span className="feature-icon">🚀</span>
                <span className="feature-text">Ultra Rápido</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔒</span>
                <span className="feature-text">100% Seguro</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">✨</span>
                <span className="feature-text">Fácil uso</span>
              </div>
            </div>
          </div>
        )}

        {/* PANEL DERECHO (Formulario) */}
        <div className="right-panel">
          <div className="form-container">
            <div className="form-header">
              <h2>Bienvenido</h2>
              <p>Ingresa los datos de tu empresa para comenzar</p>
              {!isElectron && (
                <button 
                  type="button" 
                  onClick={() => navigate('/')} 
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    marginTop: '1rem',
                    textDecoration: 'underline'
                  }}
                >
                  ← Volver al inicio
                </button>
              )}
            </div>

            {/* Mac Address Mobile Only */}
            {isMobile && (
              <div className="mac-address-pill mobile-mac mx-auto">
                <span className="pill-icon">🖥️</span>
                <span className="pill-text">MAC: {macAddress}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="input-group">
                <span className="input-icon">🏢</span>
                <input
                  type="text"
                  name="ruc"
                  value={formData.ruc}
                  onChange={handleChange}
                  placeholder="RUC de la Empresa"
                  required
                  className={`input-field \${focusedInput === 'ruc' ? 'focused' : ''}`}
                  onFocus={() => setFocusedInput('ruc')}
                  onBlur={(e) => {
                     if (!keyboardRef.current?.contains(e.relatedTarget as Node)) {
                       setTimeout(() => {
                         if (!keyboardRef.current?.contains(document.activeElement)) {
                            // Solo quitar foco si sale
                         }
                       }, 100);
                     }
                  }}
                />
              </div>

              <div className="input-group">
                <span className="input-icon">📧</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email corporativo"
                  required
                  className={`input-field \${focusedInput === 'email' ? 'focused' : ''}`}
                  onFocus={() => setFocusedInput('email')}
                />
              </div>

              <div className="input-group">
                <span className="input-icon">🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Contraseña"
                  required
                  className={`input-field \${focusedInput === 'password' ? 'focused' : ''}`}
                  onFocus={() => setFocusedInput('password')}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`submit-btn \${loading ? 'loading' : ''}`}
              >
                <span className="btn-text">
                  {loading ? 'Verificando...' : 'Acceder al Sistema'}
                </span>
                {!loading && <span className="btn-icon">→</span>}
              </button>
            </form>

            {/* Teclado animado en base al focus */}
            <div 
              ref={keyboardRef} 
              className={`keyboard-wrapper \${focusedInput ? 'visible' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="keyboard-header">
                <span>⌨️ Teclado Virtual</span>
                <button type="button" onClick={() => setFocusedInput(null)} className="close-keyboard">✖</button>
              </div>
              <VirtualKeyboard
                onKeyPress={handleVirtualKeyPress}
                onBackspace={handleVirtualBackspace}
                compact={isMobile || isTablet}
              />
            </div>

          </div>
        </div>
      </div>

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
          --text-dark: #2d3748;
          --text-muted: #718096;
          --bg-light: #f7fafc;
        }

        /* Posición fija para cubrir TODA la pantalla sin importar si hay sidebar o no */
        .login-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          z-index: 99999;
          overflow: hidden;
        }

        /* Fondo animado de restaurante */
        .login-bg-image {
          position: absolute;
          top: -5%;
          left: -5%;
          width: 110%;
          height: 110%;
          background-image: url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1920');
          background-size: cover;
          background-position: center;
          z-index: 1;
          animation: slowPan 30s infinite alternate ease-in-out;
        }

        @keyframes slowPan {
          0% { transform: scale(1) translate(0, 0); }
          50% { transform: scale(1.05) translate(1%, 1%); }
          100% { transform: scale(1) translate(-1%, -1%); }
        }

        /* Overlay con gradiente alegre (cálido, naranja/rojo/rosado) */
        .login-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(255, 107, 107, 0.85) 0%, rgba(255, 167, 38, 0.8) 50%, rgba(171, 71, 188, 0.75) 100%);
          z-index: 2;
          backdrop-filter: blur(4px);
        }

        /* Tarjeta principal con diseño claro/limpio de Glassmorphism - escalable con resolución */
        .glass-card {
          position: relative;
          z-index: 10;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.8);
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.2), 0 0 0 10px rgba(255, 255, 255, 0.2);
          border-radius: 2rem;
          display: flex;
          width: 90%;
          max-width: min(95vw, 69rem);
          min-height: min(80vh, 100%);
          max-height: 95vh;
          animation: popIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          overflow: hidden;
        }

        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.9) translateY(40px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* --- LEFT PANEL --- */
        .left-panel {
          flex: 1.1;
          padding: 4rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: linear-gradient(135deg, rgba(255,240,240,0.8), rgba(255,250,240,0.8));
          border-right: 1px solid rgba(0, 0, 0, 0.05);
          position: relative;
        }

        .brand-icon-container {
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          width: 5rem;
          height: 5rem;
          border-radius: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2rem;
          box-shadow: 0 15px 30px rgba(255, 107, 107, 0.4);
          animation: floatIcon 4s ease-in-out infinite;
        }

        .brand-icon {
          font-size: 2.5rem;
          color: white;
        }

        @keyframes floatIcon {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .brand-title {
          color: var(--text-dark);
          font-size: 3.5rem;
          font-weight: 800;
          margin-bottom: 1rem;
          letter-spacing: -1px;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .brand-subtitle {
          color: var(--text-muted);
          font-size: 1.25rem;
          line-height: 1.6;
          max-width: 90%;
          margin-bottom: 2rem;
        }

        .mac-address-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          background: white;
          padding: 0.75rem 1.25rem;
          border-radius: 2rem;
          border: 1px solid rgba(0, 0, 0, 0.05);
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }

        .pill-text {
          color: var(--text-dark);
          font-family: monospace;
          font-size: 0.95rem;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        .features-grid {
          display: flex;
          gap: 1rem;
        }
        
        .feature-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: white;
          padding: 0.75rem 1.25rem;
          border-radius: 1rem;
          border: 1px solid rgba(0,0,0,0.05);
          color: var(--text-dark);
          font-size: 0.95rem;
          font-weight: 600;
          box-shadow: 0 4px 10px rgba(0,0,0,0.02);
        }

        /* --- RIGHT PANEL --- */
        .right-panel {
          flex: 1;
          padding: 3rem 4rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .form-container {
          width: 100%;
          max-width: min(95vw, 28rem);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-header {
          text-align: center;
          margin-bottom: 1rem;
        }

        .form-header h2 {
          color: var(--text-dark);
          font-size: 2.25rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
        }

        .form-header p {
          color: var(--text-muted);
          font-size: 1rem;
        }

        .input-group {
          position: relative;
          margin-bottom: 1rem;
        }

        .input-icon {
          position: absolute;
          left: 1.25rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1.25rem;
          z-index: 2;
          color: var(--text-muted);
          transition: all 0.3s ease;
        }

        .input-field {
          width: 100%;
          padding: 1.25rem 1.25rem 1.25rem 3.5rem;
          background: var(--bg-light);
          border: 2px solid #e2e8f0;
          border-radius: 1rem;
          color: var(--text-dark);
          font-size: 1.05rem;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
        }

        .input-field::placeholder {
          color: #a0aec0;
          font-weight: 500;
        }

        .input-field:focus {
          border-color: var(--primary);
          background: white;
          box-shadow: 0 0 0 4px rgba(255, 107, 107, 0.15);
          transform: translateY(-2px);
        }

        .password-toggle {
          position: absolute;
          right: 1.25rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 1.25rem;
          z-index: 2;
          transition: transform 0.2s ease;
        }

        .password-toggle:hover {
          transform: translateY(-50%) scale(1.1);
        }

        .submit-btn {
          width: 100%;
          padding: 1.25rem;
          border-radius: 1rem;
          border: none;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          color: white;
          font-weight: 800;
          font-size: 1.1rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          box-shadow: 0 10px 20px rgba(255, 107, 107, 0.3);
          margin-top: 1rem;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 15px 30px rgba(255, 107, 107, 0.4);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          background: #cbd5e0;
          box-shadow: none;
        }

        .btn-icon {
          transition: transform 0.3s ease;
        }

        .submit-btn:hover .btn-icon {
          transform: translateX(5px);
        }

        /* KEYBOARD CONTAINER */
        .keyboard-wrapper {
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 1rem;
          padding: 1rem;
          margin-top: 0.5rem;
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          transform: translateY(10px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }

        .keyboard-wrapper.visible {
          max-height: var(--keyboard-height, min(40vh, 25rem));
          opacity: 1;
          transform: translateY(0);
          margin-bottom: 1rem;
        }

        .keyboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: var(--text-dark);
          font-size: 0.95rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .close-keyboard {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 1.2rem;
          transition: color 0.2s ease;
        }
        
        .close-keyboard:hover {
           color: var(--primary);
        }

        /* Responsive Breakpoints - escalan con resolución */
        @media (max-width: 1024px) {
          .glass-card {
             flex-direction: column;
             max-height: 95vh;
             max-width: min(95vw, 37.5rem);
             min-height: auto;
          }
          .left-panel {
            padding: 2rem;
            flex: none;
            border-right: none;
            border-bottom: 1px solid rgba(0,0,0,0.05);
            align-items: center;
            text-align: center;
          }
          .brand-title {
            font-size: 2.5rem;
          }
          .brand-subtitle {
             display: none;
          }
          .features-grid {
             display: none;
          }
          .right-panel {
            padding: 2rem;
            flex: 1;
          }
        }

        /* Pantallas cortas (ej: 1024x768) - reducir altura y espaciado */
        @media (max-height: 800px) {
          .glass-card {
            min-height: auto;
            max-height: 90vh;
          }
          .left-panel {
            padding: 1rem 2rem;
          }
          .brand-icon-container {
            width: 3.5rem;
            height: 3.5rem;
            margin-bottom: 1rem;
          }
          .brand-icon {
            font-size: 1.75rem;
          }
          .brand-title {
            font-size: 2rem;
            margin-bottom: 0.5rem;
          }
          .mac-address-pill {
            padding: 0.5rem 1rem;
          }
          .pill-text {
            font-size: 0.85rem;
          }
          .right-panel {
            padding: 1.25rem 2rem;
          }
          .form-container {
            gap: 1rem;
          }
          .form-header {
            margin-bottom: 0.5rem;
          }
          .form-header h2 {
            font-size: 1.75rem;
            margin-bottom: 0.25rem;
          }
          .form-header p {
            font-size: 0.9rem;
          }
          .input-group {
            margin-bottom: 0.75rem;
          }
          .input-field {
            padding: 0.9rem 1rem 0.9rem 3rem;
            font-size: 1rem;
          }
          .submit-btn {
            padding: 1rem;
            font-size: 1rem;
            margin-top: 0.5rem;
          }
          .keyboard-wrapper.visible {
            max-height: min(35vh, 280px);
            margin-bottom: 0.5rem;
          }
        }

        @media (max-width: 768px) {
          .glass-card {
            width: 95%;
            margin: auto;
            border-radius: 1.5rem;
          }
          .left-panel {
             display: none;
          }
          .right-panel {
            padding: 2rem 1.5rem;
          }
          .form-header h2 {
             font-size: 1.75rem;
          }
          .mobile-mac {
             display: inline-flex !important;
             margin-bottom: 1.5rem;
          }
          .input-field {
             padding: 1rem 1rem 1rem 3.25rem;
             font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginCompany;
