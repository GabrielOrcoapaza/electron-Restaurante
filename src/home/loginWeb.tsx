import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { WEB_LOGIN } from '../graphql/mutations';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import VirtualKeyboard from '../components/VirtualKeyboard';
import { useResponsive } from '../hooks/useResponsive';

const LoginWeb: React.FC = () => {
  const navigate = useNavigate();
  const { loginUser, loginCompany } = useAuth();
  const { showToast } = useToast();
  const { isMobile, isTablet } = useResponsive();

  const [formData, setFormData] = useState({
    ruc: '',
    usuario: '',
    password: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'ruc' | 'usuario' | 'password' | null>(null);
  const [virtualKeyboardOpen, setVirtualKeyboardOpen] = useState(false);
  
  const rucRef = useRef<HTMLInputElement>(null);
  const usuarioRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [webLoginMutation, { loading }] = useMutation(WEB_LOGIN);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ruc || !formData.usuario || !formData.password) {
      showToast('Por favor completa todos los campos', 'warning');
      return;
    }

    try {
      const { data } = await webLoginMutation({
        variables: {
          ruc: formData.ruc,
          usuario: formData.usuario,
          password: formData.password
        }
      });

      if (data?.webLogin?.success) {
        const { token, refreshToken, user, branch, company } = data.webLogin;
        
        // Simular la estructura de CompanyData que espera el contexto
        // Nota: Si faltan datos como floors/categories, la app podría fallar en algunas partes,
        // pero aquí seguimos la solicitud del usuario de usar esta mutación.
        loginCompany({
          company: company,
          branch: {
            ...branch,
            isActive: true, // Asumimos activo si el login fue exitoso
            floors: [],
            categories: [],
            tables: []
          }
        });

        loginUser(token, refreshToken, user);
        
        showToast(`¡Bienvenido, ${user.fullName || user.firstName || 'usuario'}!`, 'success');
        navigate('/dashboard');
      } else {
        showToast(data?.webLogin?.message || 'Error en el inicio de sesión', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error de conexión', 'error');
    }
  };

  const handleVirtualKeyPress = (key: string) => {
    if (focusedInput === 'ruc') setFormData(prev => ({ ...prev, ruc: prev.ruc + key }));
    else if (focusedInput === 'usuario') setFormData(prev => ({ ...prev, usuario: prev.usuario + key }));
    else if (focusedInput === 'password') setFormData(prev => ({ ...prev, password: prev.password + key }));
  };

  const handleVirtualBackspace = () => {
    if (focusedInput === 'ruc') setFormData(prev => ({ ...prev, ruc: prev.ruc.slice(0, -1) }));
    else if (focusedInput === 'usuario') setFormData(prev => ({ ...prev, usuario: prev.usuario.slice(0, -1) }));
    else if (focusedInput === 'password') setFormData(prev => ({ ...prev, password: prev.password.slice(0, -1) }));
  };

  return (
    <div className="login-web-wrapper">
      <div className="login-bg-image"></div>
      <div className="login-overlay"></div>

      <div className="login-card-container">
        <div className="login-glass-card">
          <div className="card-header">
            <div className="logo-container">
              <span className="logo-icon">🍽️</span>
              <h1 className="logo-text">Sum<span>App</span></h1>
            </div>
            <h2>Acceso al Sistema</h2>
            <p>Ingresa las credenciales de tu empresa</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className={`input-group ${focusedInput === 'ruc' ? 'focused' : ''}`}>
              <span className="input-icon">🏢</span>
              <input
                ref={rucRef}
                type="text"
                name="ruc"
                value={formData.ruc}
                onChange={handleChange}
                placeholder="RUC de la empresa"
                onFocus={() => setFocusedInput('ruc')}
                autoComplete="off"
              />
            </div>

            <div className={`input-group ${focusedInput === 'usuario' ? 'focused' : ''}`}>
              <span className="input-icon">👤</span>
              <input
                ref={usuarioRef}
                type="text"
                name="usuario"
                value={formData.usuario}
                onChange={handleChange}
                placeholder="Usuario o DNI"
                onFocus={() => setFocusedInput('usuario')}
                autoComplete="off"
              />
            </div>

            <div className={`input-group ${focusedInput === 'password' ? 'focused' : ''}`}>
              <span className="input-icon">🔒</span>
              <input
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Contraseña"
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

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? (
                <span className="loader"></span>
              ) : (
                <>🚀 Entrar al Panel</>
              )}
            </button>
          </form>

          <div className="card-footer">
            <button className="back-link" onClick={() => navigate('/')}>
              ← Volver al inicio
            </button>
          </div>
        </div>

        {virtualKeyboardOpen && (
          <div className="keyboard-container-web">
            <VirtualKeyboard
              onKeyPress={handleVirtualKeyPress}
              onBackspace={handleVirtualBackspace}
              onClose={() => setVirtualKeyboardOpen(false)}
              tight={isMobile || isTablet}
            />
          </div>
        )}

        {!virtualKeyboardOpen && (
          <button
            className="virtual-kb-toggle"
            onClick={() => setVirtualKeyboardOpen(true)}
          >
            ⌨️
          </button>
        )}
      </div>

      <style>{`
        .login-web-wrapper {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100vw; height: 100vh;
          font-family: 'Inter', sans-serif;
          z-index: 1000;
          overflow: hidden;
        }

        .login-bg-image {
          position: absolute;
          inset: 0;
          background-image: url('https://images.unsplash.com/photo-1517248135467-4c7ed9d42c77?auto=format&fit=crop&q=80&w=1920');
          background-size: cover;
          background-position: center;
          filter: brightness(0.6);
          z-index: 1;
        }

        .login-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 107, 107, 0.4) 0%, rgba(30, 41, 59, 0.8) 100%);
          backdrop-filter: blur(8px);
          z-index: 2;
        }

        .login-card-container {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 450px;
          padding: 20px;
        }

        .login-glass-card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.2);
          animation: slideUp 0.6s ease-out;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .card-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .logo-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        .logo-icon { font-size: 2.5rem; }
        .logo-text { font-size: 2rem; font-weight: 800; color: #1e293b; }
        .logo-text span { color: #ff6b6b; }

        .card-header h2 {
          font-size: 1.5rem;
          color: #1e293b;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .card-header p {
          color: #64748b;
          font-size: 0.95rem;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .input-group {
          position: relative;
          display: flex;
          align-items: center;
          background: #f1f5f9;
          border: 2px solid transparent;
          border-radius: 12px;
          transition: all 0.2s;
        }

        .input-group.focused {
          background: #fff;
          border-color: #ff6b6b;
          box-shadow: 0 0 0 4px rgba(255, 107, 107, 0.1);
        }

        .input-icon {
          padding-left: 16px;
          font-size: 1.2rem;
          opacity: 0.6;
        }

        .input-group input {
          width: 100%;
          padding: 14px 16px;
          border: none;
          background: transparent;
          font-size: 1rem;
          color: #1e293b;
          font-weight: 500;
          outline: none;
        }

        .password-toggle {
          background: none;
          border: none;
          padding-right: 16px;
          cursor: pointer;
          font-size: 1.2rem;
        }

        .login-submit-btn {
          margin-top: 10px;
          padding: 16px;
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5253 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 10px 15px -3px rgba(238, 82, 83, 0.4);
        }

        .login-submit-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.1);
          box-shadow: 0 15px 20px -3px rgba(238, 82, 83, 0.5);
        }

        .login-submit-btn:active {
          transform: translateY(0);
        }

        .login-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .card-footer {
          margin-top: 24px;
          text-align: center;
        }

        .back-link {
          background: none;
          border: none;
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s;
        }

        .back-link:hover {
          color: #ff6b6b;
        }

        .virtual-kb-toggle {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #1e293b;
          color: white;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          z-index: 100;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .keyboard-container-web {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          padding: 20px;
          z-index: 1000;
          border-top: 1px solid #e2e8f0;
          animation: slideUpKeyboard 0.3s ease-out;
        }

        @keyframes slideUpKeyboard {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .loader {
          width: 20px;
          height: 20px;
          border: 3px solid #FFF;
          border-bottom-color: transparent;
          border-radius: 50%;
          display: inline-block;
          animation: rotation 1s linear infinite;
        }

        @keyframes rotation {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .login-glass-card {
            padding: 24px;
          }
          .logo-text { font-size: 1.5rem; }
        }
      `}</style>
    </div>
  );
};

export default LoginWeb;
