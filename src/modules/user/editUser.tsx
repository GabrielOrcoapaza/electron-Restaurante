import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_USER } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';

interface Branch {
  id: string;
  name: string;
  isActive: boolean;
}

interface User {
  id: string;
  dni: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  phone: string;
  isActive: boolean;
  photoBase64?: string | null;
}

type EditUserProps = {
  user: User;
  onSuccess?: () => void;
  onClose: () => void;
};

const EditUser: React.FC<EditUserProps> = ({ user, onSuccess, onClose }) => {
  const { companyData } = useAuth();
  const { breakpoint, isMobile, isXs } = useResponsive();

  const isSmall = breakpoint === 'sm' || isMobile;
  const isMedium = breakpoint === 'md';

  const modalPadding = isXs ? '1rem' : isSmall ? '1.25rem' : '2rem';
  const modalMaxWidth = isSmall ? '100%' : isMedium ? '500px' : '650px';
  const titleFontSize = isXs ? '1.1rem' : isSmall ? '1.25rem' : '1.5rem';
  const labelFontSize = isXs ? '0.7rem' : isSmall ? '0.75rem' : '0.875rem';
  const inputFontSize = isXs ? '0.85rem' : isSmall ? '0.9rem' : '1rem';
  const inputPadding = isXs ? '0.6rem' : isSmall ? '0.75rem' : '0.875rem';
  const buttonPadding = isXs ? '0.6rem 1rem' : isSmall ? '0.75rem 1.25rem' : '0.8rem 1.5rem';
  const buttonFontSize = isXs ? '0.8rem' : isSmall ? '0.85rem' : '0.9rem';
  const gapSize = isXs ? '0.6rem' : isSmall ? '0.75rem' : '1rem';

  const [formData, setFormData] = useState({
    email: user.email || '',
    password: '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    branchId: companyData?.branch?.id || '',
    role: user.role || '',
    phone: user.phone || '',
    isActive: user.isActive ?? true,
  });
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [updateUser, { loading }] = useMutation(UPDATE_USER, {
    onCompleted: (data) => {
      if (data.updateUser?.success) {
        setMessage({ type: 'success', text: data.updateUser.message || 'Usuario actualizado exitosamente' });
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1200);
        } else {
          setTimeout(() => onClose(), 1200);
        }
      } else {
        setMessage({ type: 'error', text: data.updateUser?.message || 'Error al actualizar' });
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message || 'Error al actualizar el usuario' });
    },
  });

  // Auto-seleccionar sucursal si no está
  React.useEffect(() => {
    if (companyData?.branch?.id && !formData.branchId) {
      setFormData(prev => ({ ...prev, branchId: companyData.branch.id }));
    }
  }, [companyData?.branch?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
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

    const variables: Record<string, unknown> = {
      id: user.id,
      email: formData.email.trim() || undefined,
      firstName: formData.firstName.trim() || undefined,
      lastName: formData.lastName.trim() || undefined,
      branchId: formData.branchId || undefined,
      role: formData.role || undefined,
      phone: formData.phone.trim() || undefined,
      isActive: formData.isActive,
    };
    if (formData.password.trim()) {
      variables.password = formData.password;
    }
    if (photoBase64) {
      variables.photoBase64 = photoBase64;
    }

    updateUser({ variables });
  };

  const roles = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'CASHIER', label: 'Cajero' },
    { value: 'WAITER', label: 'Mozo' },
    { value: 'COOK', label: 'Cocinero' },
  ];

  const branches: Branch[] = companyData?.branch
    ? [{ id: companyData.branch.id, name: companyData.branch.name, isActive: true }]
    : [];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: isSmall ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isSmall ? 0 : '1rem',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.3s ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>
        {`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}
      </style>
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: isSmall ? '24px 24px 0 0' : '16px',
          padding: modalPadding,
          maxWidth: modalMaxWidth,
          width: '100%',
          maxHeight: isSmall ? '92vh' : '90vh',
          overflow: 'auto',
          boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.1), 0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          animation: isSmall ? 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' : 'fadeIn 0.3s ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, fontSize: titleFontSize, fontWeight: 700, color: '#1e293b' }}>
            ✏️ Editar Empleado
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
            }}
          >
            ×
          </button>
        </div>

        <p style={{ margin: '0 0 1rem', color: '#64748b', fontSize: isSmall ? '0.75rem' : '0.8125rem' }}>
          DNI: {user.dni}
        </p>

        {message && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: message.type === 'success' ? '#166534' : '#991b1b',
              border: `1px solid ${message.type === 'success' ? '#86efac' : '#fecaca'}`,
              fontSize: inputFontSize,
            }}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isSmall ? '1fr' : 'repeat(2, 1fr)',
              gap: gapSize,
              marginBottom: '1rem',
            }}
          >
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
                style={{
                  width: '100%',
                  padding: inputPadding,
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: inputFontSize,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                Nueva contraseña (dejar vacío para mantener)
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: inputPadding,
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: inputFontSize,
                  boxSizing: 'border-box',
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
                style={{
                  width: '100%',
                  padding: inputPadding,
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: inputFontSize,
                  boxSizing: 'border-box',
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
                style={{
                  width: '100%',
                  padding: inputPadding,
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: inputFontSize,
                  boxSizing: 'border-box',
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
                style={{
                  width: '100%',
                  padding: inputPadding,
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: inputFontSize,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                Sucursal
              </label>
              <select
                name="branchId"
                value={formData.branchId}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: inputPadding,
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: inputFontSize,
                  backgroundColor: 'white',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Seleccionar sucursal</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
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
                  backgroundColor: 'white',
                  boxSizing: 'border-box',
                }}
              >
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: labelFontSize }}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  style={{ width: '1.125rem', height: '1.125rem' }}
                />
                <span style={{ color: '#475569', fontWeight: 500 }}>Usuario activo</span>
              </label>
            </div>

            <div style={{ gridColumn: isSmall ? '1' : '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontWeight: 500, fontSize: labelFontSize, color: '#475569' }}>
                Foto (opcional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: inputFontSize,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: buttonPadding,
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                backgroundColor: 'white',
                color: '#64748b',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: buttonFontSize,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: buttonPadding,
                borderRadius: '10px',
                border: 'none',
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: buttonFontSize,
              }}
            >
              {loading ? 'Actualizando...' : '💾 Actualizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUser;
