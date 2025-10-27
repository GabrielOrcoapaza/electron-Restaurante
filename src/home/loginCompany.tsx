import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { COMPANY_LOGIN } from '../graphql/mutations';
import { useAuth } from '../hooks/useAuth';

const LoginCompany: React.FC = () => {
  const navigate = useNavigate();
  const { loginCompany } = useAuth();
  const [formData, setFormData] = useState({
    ruc: '',
    email: '',
    password: ''
  });

  const [companyLoginMutation, { loading }] = useMutation(COMPANY_LOGIN);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
        
        // Usar el hook useAuth para guardar datos
        loginCompany({
          company: data.companyLogin.company,
          branch: {
            ...data.companyLogin.branch,
            users: data.companyLogin.branch.users || []
          },
          companyLogo: data.companyLogin.companyLogoBase64,
          branchLogo: data.companyLogin.branchLogoBase64,
          availableBranches: data.companyLogin.availableBranches
        });

        // Redirigir al login de empleado
        navigate('/login-employee');
      } else {
        console.log('❌ Login fallido:', data?.companyLogin?.message);
      }
    } catch (err: any) {
      console.error('🚨 ===== ERROR EN LOGIN DE EMPRESA =====');
      console.error('Mensaje de error:', err.message);
      console.error('Error completo:', err);
      
      // Error de GraphQL
      if (err.graphQLErrors && err.graphQLErrors.length > 0) {
        console.error('📋 Errores de GraphQL:');
        err.graphQLErrors.forEach((error: any, index: number) => {
          console.error(`  Error ${index + 1}:`, error.message);
          console.error('  Código:', error.extensions?.code);
        });
      }
      
      // Error de red
      if (err.networkError) {
        console.error('🌐 Error de red:', err.networkError);
        console.error('  Mensaje:', err.networkError.message);
        if (err.networkError.result) {
          console.error('  Resultado:', err.networkError.result);
        }
      }
      
      console.error('==============================');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
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
          </div>
        </div>

        {/* Panel derecho con formulario - Siempre visible */}
        <div className="form-panel" style={{
          flex: '1',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0.5rem',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          height: '100vh',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}>
          <div className="form-container" style={{
            width: '100%',
            maxWidth: '400px',
            position: 'relative',
            padding: '0.5rem',
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

            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #ff6b6b, #ffa726)',
                borderRadius: '20px',
                margin: '0 auto 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                color: 'white',
                boxShadow: '0 15px 30px rgba(255, 107, 107, 0.4)',
                animation: 'bounce 3s ease-in-out infinite'
              }}>
                🏢
              </div>
              <h2 style={{ 
                margin: '0',
                color: '#2d3748',
                fontSize: 'clamp(24px, 4vw, 32px)',
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
                fontSize: 'clamp(14px, 2.5vw, 16px)',
                fontWeight: '500'
              }}>
                Ingresa los datos de tu empresa
              </p>
            </div>
        
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '2rem' }}>
                <label className="form-labels" style={{ 
                  display: 'block', 
                  marginBottom: '1rem', 
                  color: '#2d3748',
                  fontSize: 'clamp(14px, 3vw, 16px)',
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
                      padding: '1rem 1rem 1rem 3rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: 'clamp(14px, 3vw, 16px)',
                      backgroundColor: '#f8fafc',
                      transition: 'all 0.3s ease',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: '500'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#ff6b6b';
                      e.target.style.backgroundColor = 'white';
                      e.target.style.boxShadow = '0 0 0 4px rgba(255, 107, 107, 0.1)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onBlur={(e) => {
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
                    fontSize: 'clamp(16px, 3vw, 20px)'
                  }}>🏢</div>
                </div>
              </div>
              
              <div style={{ marginBottom: '2rem' }}>
                <label className="form-labels" style={{ 
                  display: 'block', 
                  marginBottom: '1rem', 
                  color: '#2d3748',
                  fontSize: 'clamp(14px, 3vw, 16px)',
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
                      padding: '1rem 1rem 1rem 3rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: 'clamp(14px, 3vw, 16px)',
                      backgroundColor: '#f8fafc',
                      transition: 'all 0.3s ease',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: '500'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#ffa726';
                      e.target.style.backgroundColor = 'white';
                      e.target.style.boxShadow = '0 0 0 4px rgba(255, 167, 38, 0.1)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onBlur={(e) => {
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
                    fontSize: 'clamp(16px, 3vw, 20px)'
                  }}>📧</div>
                </div>
              </div>
              
              <div style={{ marginBottom: '2.5rem' }}>
                <label className="form-labels" style={{ 
                  display: 'block', 
                  marginBottom: '1rem', 
                  color: '#2d3748',
                  fontSize: 'clamp(14px, 3vw, 16px)',
                  fontWeight: '700'
                }}>
                  🔒 Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className="form-inputs"
                    style={{
                      width: '100%',
                      padding: '1rem 1rem 1rem 3rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: 'clamp(14px, 3vw, 16px)',
                      backgroundColor: '#f8fafc',
                      transition: 'all 0.3s ease',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: '500'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#66bb6a';
                      e.target.style.backgroundColor = 'white';
                      e.target.style.boxShadow = '0 0 0 4px rgba(102, 187, 106, 0.1)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onBlur={(e) => {
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
                    fontSize: 'clamp(16px, 3vw, 20px)'
                  }}>🔒</div>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '1.25rem',
                  background: loading ? '#ccc' : 'linear-gradient(135deg, #ff6b6b 0%, #ffa726 50%, #66bb6a 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: '18px',
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
        
        /* Media queries para responsividad */
        @media (min-width: 1024px) {
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
            overflow: hidden !important;
          }
        }
        
        @media (max-width: 1023px) {
          .left-panel {
            display: none !important;
          }
          .form-panel {
            height: 100vh !important;
            width: 100vw !important;
            max-width: 100vw !important;
            overflow: hidden !important;
          }
        }
        
        @media (max-width: 768px) {
          .form-container {
            padding: 0.25rem !important;
            max-width: 350px !important;
          }
          .form-inputs {
            padding: 0.75rem 0.75rem 0.75rem 2.5rem !important;
            font-size: 14px !important;
          }
          .form-labels {
            font-size: 14px !important;
          }
        }
        
        @media (max-width: 480px) {
          .form-container {
            padding: 0.125rem !important;
            max-width: 300px !important;
          }
          .form-inputs {
            padding: 0.5rem 0.5rem 0.5rem 2rem !important;
            font-size: 13px !important;
          }
          .form-labels {
            font-size: 13px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginCompany;
