import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { USER_LOGIN } from '../graphql/mutations';
import { useAuth } from '../hooks/useAuth';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { loginUser, companyData, getMacAddress } = useAuth();
  const [formData, setFormData] = useState({
    selectedEmployee: '',
    password: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  const [userLoginMutation, { loading }] = useMutation(USER_LOGIN);

  // Obtener empleados directamente de los datos de la sucursal
  const allEmployees = companyData?.branch?.users || [];
  const employeesLoading = false;

  // Filtrar empleados por término de búsqueda
  const filteredEmployees = allEmployees.filter((employee: any) => {
    const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
    const dni = employee.dni.toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || dni.includes(search);
  });

  // Verificar que existan datos de la empresa
  useEffect(() => {
    if (!companyData) {
      console.log('Primero debes iniciar sesion con los datos de la empresa')
      navigate('/login-company');
    }
  }, [companyData, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verificar datos de empresa
    if (!companyData) {
      console.log('No hay datps de empresa. Redirigiendo...')
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
      console.log('Por favor selecciona un empleado')
      return;
    }

    try {
      const variables = {
        dni: formData.selectedEmployee,
        password: formData.password,
        branchId: companyData.branch.id,
        deviceId: deviceId
      };
      
      console.log('📡 Variables completas para USER_LOGIN:', variables);
      console.log('📡 Enviando USER_LOGIN con deviceId (MAC):', deviceId);
      console.log('📡 branchId que se está enviando:', companyData.branch.id);
      console.log('📡 Tipo de branchId:', typeof companyData.branch.id);
      console.log('📡 DNI que se está enviando:', formData.selectedEmployee);
      console.log('📡 Password que se está enviando:', formData.password);
      
      // Debug: Mostrar todos los datos de la empresa
      console.log('🏢 Datos completos de la empresa:', companyData);
      
      const { data } = await userLoginMutation({
        variables: variables
      });

      console.log('📥 Respuesta completa del servidor:', data);
      console.log('📥 userLogin object:', data?.userLogin);
      console.log('📥 deviceRegistered value:', data?.userLogin?.deviceRegistered);
      
      if (data?.userLogin?.success) {
        console.log('✅ Login exitoso, deviceRegistered:', data.userLogin.deviceRegistered);
        // Usar el hook useAuth para guardar datos
        loginUser(
          data.userLogin.token,
          data.userLogin.refreshToken,
          data.userLogin.user,
          data.userLogin.userPhotoBase64
        );
        
        // Redirigir al dashboard
        navigate('/dashboard');
      } else {
        console.log('❌ Error en el login:', data?.userLogin?.message);
        console.log('❌ deviceRegistered en error:', data?.userLogin?.deviceRegistered);
        alert(`❌ ${data?.userLogin?.message || 'Error en el login'}`);
      }
    } catch (err: any) {
      console.error('Error en login de usuario:', err);
    }
  };

  const handleBackToCompany = () => {
    navigate('/login-company');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      background: 'linear-gradient(135deg, #42a5f5 0%, #66bb6a 25%, #ffa726 50%, #ff6b6b 75%, #ab47bc 100%)',
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
          backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjNDJBOUY1IiBvcGFjaXR5PSIwLjEiLz4KPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjAwLCAyMDApIj4KPGNpcmNsZSBjeD0iLTEwMCIgY3k9Ii01MCIgcj0iNDAiIGZpbGw9IiM2NkJCMkYiIG9wYWNpdHk9IjAuMiIvPgo8Y2lyY2xlIGN4PSIxMDAiIGN5PSItNDAiIHI9IjMwIiBmaWxsPSIjRkZBNzI2IiBvcGFjaXR5PSIwLjE1Ii8+CjxjaXJjbGUgY3g9Ii04MCIgY3k9IjgwIiByPSI1MCIgZmlsbD0iI0ZGNkI2QiIgb3BhY2l0eT0iMC4xOCIvPgo8Y2lyY2xlIGN4PSI5MCIgY3k9IjcwIiByPSIzNSIgZmlsbD0iI0FCNDdCQyIgb3BhY2l0eT0iMC4xMiIvPgo8L2c+CjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDIwMCwgMjAwKSByb3RhdGUoNDUpIj4KPHJlY3QgeD0iLTEwMCIgeT0iLTEwIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHJ4PSIxMCIvPgo8cmVjdCB4PSItMTAwIiB5PSIxMCIgd2lkdGg9IjE1MCIgaGVpZ2h0PSIyMCIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIgcng9IjEwIi8+CjxyZWN0IHg9Ii0xMDAiIHk9IjQwIiB3aWR0aD0iMTgwIiBoZWlnaHQ9IjIwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMTIpIiByeD0iMTAiLz4KPC9nPgo8L3N2Zz4K')`,
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
            background: 'linear-gradient(135deg, rgba(66,165,246,0.8) 0%, rgba(102,187,106,0.7) 25%, rgba(255,167,38,0.6) 50%, rgba(255,107,107,0.7) 75%, rgba(171,71,188,0.8) 100%)',
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
            }}>👨‍🍳</div>
            
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
              Acceso Personal
            </h1>
            
            <p style={{
              fontSize: '1.2rem',
              marginBottom: '2rem',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              opacity: 0.9
            }}>
              Selecciona tu empleado y contraseña
            </p>
            
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '2rem',
              marginTop: '3rem'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👤</div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Empleados</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔐</div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Seguridad</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Rápido</div>
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
              background: 'linear-gradient(45deg, #42a5f5, #66bb6a)',
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
              background: 'linear-gradient(45deg, #ffa726, #ff6b6b)',
              borderRadius: '50%',
              opacity: 0.08,
              animation: 'float 6s ease-in-out infinite reverse'
            }}></div>

            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #42a5f5, #66bb6a)',
                borderRadius: '20px',
                margin: '0 auto 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                color: 'white',
                boxShadow: '0 15px 30px rgba(66, 165, 246, 0.4)',
                animation: 'bounce 3s ease-in-out infinite'
              }}>
                👤
              </div>
              <h2 style={{ 
                margin: '0',
                color: '#2d3748',
                fontSize: '32px',
                fontWeight: '800',
                background: 'linear-gradient(135deg, #42a5f5, #66bb6a)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Acceso Personal
              </h2>
              <p style={{ 
                color: '#718096', 
                margin: '0.5rem 0 0',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Selecciona tu empleado y contraseña
              </p>
            </div>
        
            <form onSubmit={handleSubmit}>
              {/* Buscador de Empleados */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '1rem', 
                  color: '#2d3748',
                  fontSize: '16px',
                  fontWeight: '700',
                  textAlign: 'center'
                }}>
                  🔍 Buscar Empleado
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre o DNI..."
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
                      e.target.style.borderColor = '#42a5f5';
                      e.target.style.backgroundColor = 'white';
                      e.target.style.boxShadow = '0 0 0 4px rgba(66, 165, 246, 0.1)';
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
                  }}>🔍</div>
                </div>
                {searchTerm && (
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '14px',
                    color: '#718096',
                    textAlign: 'center',
                    fontWeight: '500'
                  }}>
                    {filteredEmployees.length} empleado(s) encontrado(s)
                  </div>
                )}
              </div>

              {/* Selección de Empleados con Botones */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '1rem', 
                  color: '#2d3748',
                  fontSize: '16px',
                  fontWeight: '700',
                  textAlign: 'center'
                }}>
                  👥 Selecciona tu Empleado
                </label>
                
                {filteredEmployees.length === 0 && !employeesLoading ? (
                  <p style={{ 
                    color: '#e53e3e', 
                    fontSize: '16px', 
                    textAlign: 'center',
                    padding: '2rem',
                    backgroundColor: '#fef2f2',
                    borderRadius: '16px',
                    border: '2px solid #fecaca',
                    fontWeight: '500'
                  }}>
                    {searchTerm 
                      ? `🔍 No se encontraron empleados con "${searchTerm}"`
                      : '⚠️ No hay empleados activos en esta sucursal'
                    }
                  </p>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    maxHeight: '250px',
                    overflowY: 'auto',
                    padding: '1rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '16px',
                    border: '2px solid #e2e8f0'
                  }}>
                    {filteredEmployees.map((employee: any) => (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, selectedEmployee: employee.dni })}
                        style={{
                          padding: '1.25rem',
                          border: formData.selectedEmployee === employee.dni 
                            ? '2px solid #42a5f5' 
                            : '2px solid #e2e8f0',
                          borderRadius: '12px',
                          backgroundColor: formData.selectedEmployee === employee.dni 
                            ? '#e3f2fd' 
                            : 'white',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          textAlign: 'left',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#2d3748',
                          boxShadow: formData.selectedEmployee === employee.dni 
                            ? '0 8px 20px rgba(66, 165, 246, 0.3)' 
                            : '0 4px 8px rgba(0, 0, 0, 0.1)',
                          transform: formData.selectedEmployee === employee.dni 
                            ? 'translateY(-2px)' 
                            : 'translateY(0)'
                        }}
                        onMouseOver={(e) => {
                          if (formData.selectedEmployee !== employee.dni) {
                            e.currentTarget.style.borderColor = '#42a5f5';
                            e.currentTarget.style.backgroundColor = '#e3f2fd';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(66, 165, 246, 0.2)';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (formData.selectedEmployee !== employee.dni) {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                          }
                        }}
                      >
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem',
                          marginBottom: '0.5rem'
                        }}>
                          <span style={{ fontSize: '18px' }}>👤</span>
                          <span style={{ fontWeight: '700' }}>
                            {employee.firstName} {employee.lastName}
                          </span>
                        </div>
                        <div style={{ 
                          fontSize: '13px', 
                          color: '#718096',
                          marginLeft: '2.25rem',
                          fontWeight: '500'
                        }}>
                          DNI: {employee.dni}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {formData.selectedEmployee && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: '#e8f5e8',
                    border: '2px solid #4caf50',
                    borderRadius: '12px',
                    textAlign: 'center'
                  }}>
                    <span style={{ color: '#2e7d32', fontSize: '16px', fontWeight: '600' }}>
                      ✅ Empleado seleccionado
                    </span>
                  </div>
                )}
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
                  }}>🔒</div>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '1.25rem',
                  background: loading ? '#ccc' : 'linear-gradient(135deg, #42a5f5 0%, #66bb6a 50%, #ffa726 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: '18px',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 15px 30px rgba(66, 165, 246, 0.4)',
                  position: 'relative',
                  overflow: 'hidden',
                  marginBottom: '1rem',
                  opacity: loading ? 0.7 : 1,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
                onMouseOver={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(66, 165, 246, 0.6)';
                    e.currentTarget.style.background = 'linear-gradient(135deg, #1976d2 0%, #4caf50 50%, #ff9800 100%)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 15px 30px rgba(66, 165, 246, 0.4)';
                    e.currentTarget.style.background = 'linear-gradient(135deg, #42a5f5 0%, #66bb6a 50%, #ffa726 100%)';
                  }
                }}
              >
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  {loading ? '⏳ Autenticando...' : '✨ Iniciar Sesión'}
                </span>
              </button>
              
              <button
                type="button"
                onClick={handleBackToCompany}
                style={{
                  width: '100%',
                  padding: '1.25rem',
                  background: 'rgba(108, 117, 125, 0.1)',
                  color: '#6c757d',
                  border: '2px solid #e2e8f0',
                  borderRadius: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(108, 117, 125, 0.2)';
                  e.currentTarget.style.borderColor = '#6c757d';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(108, 117, 125, 0.2)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(108, 117, 125, 0.1)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  🔙 Volver a Login Empresa
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

export default Login;
