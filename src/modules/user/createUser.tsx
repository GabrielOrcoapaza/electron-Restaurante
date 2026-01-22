import React, { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_USER } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import ListUser from './listUser';

interface Branch {
  id: string;
  name: string;
  isActive: boolean;
}

const CreateUser: React.FC = () => {
  const { companyData } = useAuth();
  const { breakpoint } = useResponsive();
  const [showForm, setShowForm] = useState(false);
  
  // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
  const isSmall = breakpoint === 'sm'; // 640px - 767px
  const isMedium = breakpoint === 'md'; // 768px - 1023px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  const isMediumDesktop = breakpoint === 'xl'; // 1280px - 1535px
  
  // Tamaños adaptativos
  const containerPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const containerGap = isSmall ? '1rem' : isMedium ? '1.5rem' : isSmallDesktop ? '1.5rem' : isMediumDesktop ? '2rem' : '2rem';
  const titleFontSize = isSmall ? '1.125rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.375rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const subtitleFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const labelFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const inputFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const inputPadding = isSmall ? '0.5rem 0.625rem' : isMedium ? '0.5625rem 0.75rem' : isSmallDesktop ? '0.5625rem 0.75rem' : isMediumDesktop ? '0.625rem 0.875rem' : '0.625rem 0.875rem';
  const buttonPadding = isSmall ? '0.5625rem 1rem' : isMedium ? '0.625rem 1.25rem' : isSmallDesktop ? '0.625rem 1.25rem' : isMediumDesktop ? '0.75rem 1.5rem' : '0.75rem 1.5rem';
  const buttonFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const cardPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const gapSize = isSmall ? '0.75rem' : isMedium ? '0.875rem' : isSmallDesktop ? '0.875rem' : isMediumDesktop ? '1rem' : '1rem';
  const [formData, setFormData] = useState({
    dni: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    branchId: '',
    role: '',
    phone: '',
  });
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Usar la sucursal del contexto de autenticación
  const currentBranch = companyData?.branch;
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-seleccionar la sucursal actual
  useEffect(() => {
    if (currentBranch?.id && !formData.branchId) {
      setFormData(prev => ({ ...prev, branchId: currentBranch.id }));
    }
  }, [currentBranch?.id, formData.branchId]);

  const [createUser, { loading }] = useMutation(CREATE_USER, {
    onCompleted: (data) => {
      if (data.createUser.success) {
        setMessage({ type: 'success', text: data.createUser.message });
        setFormData({
          dni: '',
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          branchId: '',
          role: '',
          phone: '',
        });
        setPhotoBase64(null);
        setShowForm(false);
        setRefreshKey(prev => prev + 1);
      } else {
        setMessage({ type: 'error', text: data.createUser.message });
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setPhotoBase64(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    createUser({
      variables: {
        ...formData,
        photoBase64,
      },
    });
  };

  const roles = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'CASHIER', label: 'Cajero' },
    { value: 'WAITER', label: 'Mozo' },
    { value: 'COOK', label: 'Cocinero' },
  ];

  // Usar la sucursal actual del contexto
  const branches: Branch[] = currentBranch ? [{ id: currentBranch.id, name: currentBranch.name, isActive: true }] : [];

  return (
    <div
      style={{
        minHeight: '100%',
        width: '100%',
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: containerGap,
        background: 'linear-gradient(160deg, #f0f4ff 0%, #f9fafb 45%, #ffffff 100%)',
        padding: containerPadding,
        borderRadius: '18px',
        boxShadow: '0 25px 50px -12px rgba(15,23,42,0.18)',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Elementos decorativos de fondo */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: '260px',
          height: '260px',
          background: 'radial-gradient(circle at center, rgba(102,126,234,0.25), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-80px',
          left: '-80px',
          width: '220px',
          height: '220px',
          background: 'radial-gradient(circle at center, rgba(72,219,251,0.18), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0,
        }}
      />

      {/* Contenido principal */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: isSmall ? 'flex-start' : 'center',
          flexDirection: isSmall ? 'column' : 'row',
          marginBottom: isSmall ? '1rem' : isMedium ? '1.5rem' : isSmallDesktop ? '1.5rem' : '2rem',
          gap: isSmall || isMedium ? '1rem' : '0'
        }}>
        <div>
          <h2 style={{ 
            margin: 0, 
            fontSize: titleFontSize, 
            fontWeight: 700, 
            color: '#1e293b' 
          }}>
            👥 Gestión de Empleados
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: subtitleFontSize }}>
            Administra los empleados de tu empresa
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: buttonPadding,
            background: showForm ? '#64748b' : 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: buttonFontSize,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease',
            width: isSmall ? '100%' : 'auto'
          }}
        >
          {showForm ? '✕ Cancelar' : '+ Nuevo Empleado'}
        </button>
      </div>

        {/* Mensaje */}
        {message && (
          <div style={{
            padding: '1rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
            backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: message.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fecaca'}`
          }}>
            {message.text}
          </div>
        )}

        {/* Formulario */}
        {showForm && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: cardPadding,
            marginBottom: isSmall ? '1rem' : isMedium ? '1.25rem' : '1.5rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e2e8f0'
          }}>
          <h3 style={{ 
            margin: '0 0 1.25rem', 
            fontSize: isSmall ? '1rem' : isMedium ? '1.05rem' : isSmallDesktop ? '1.05rem' : '1.1rem', 
            fontWeight: 600, 
            color: '#334155' 
          }}>
            📝 Nuevo Empleado
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isSmall ? '1fr' : isMedium ? 'repeat(auto-fit, minmax(180px, 1fr))' : 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: gapSize 
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                  DNI *
                </label>
                <input
                  type="text"
                  name="dni"
                  value={formData.dni}
                  onChange={handleChange}
                  maxLength={8}
                  required
                  placeholder="12345678"
                  style={{
                    width: '100%',
                    padding: inputPadding,
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: inputFontSize,
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="correo@ejemplo.com"
                  style={{
                    width: '100%',
                    padding: inputPadding,
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: inputFontSize,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                  Contraseña *
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: inputPadding,
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: inputFontSize,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                  Nombre *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  placeholder="Juan"
                  style={{
                    width: '100%',
                    padding: inputPadding,
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: inputFontSize,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                  Apellido *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  placeholder="Pérez"
                  style={{
                    width: '100%',
                    padding: inputPadding,
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: inputFontSize,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                  Teléfono
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="987654321"
                  style={{
                    width: '100%',
                    padding: inputPadding,
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: inputFontSize,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                  Sucursal *
                </label>
                <select
                  name="branchId"
                  value={formData.branchId}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: inputPadding,
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: inputFontSize,
                    boxSizing: 'border-box',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="">Seleccionar sucursal</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                  Rol *
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: inputPadding,
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: inputFontSize,
                    boxSizing: 'border-box',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="">Seleccionar rol</option>
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                  Foto (opcional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{
                    width: '100%',
                    padding: isSmall ? '0.4375rem' : '0.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: inputFontSize,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ 
              marginTop: '1.25rem', 
              display: 'flex', 
              flexDirection: isSmall ? 'column' : 'row',
              gap: '0.75rem' 
            }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: isSmall ? 'none' : 1,
                  padding: buttonPadding,
                  background: loading ? '#94a3b8' : 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: buttonFontSize
                }}
              >
                {loading ? 'Guardando...' : '💾 Guardar Empleado'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  padding: buttonPadding,
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: buttonFontSize
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
          </div>
        )}

        {/* Lista de empleados */}
        <ListUser key={refreshKey} />
      </div>
    </div>
  );
};

export default CreateUser;

