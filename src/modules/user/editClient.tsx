import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { CREATE_PERSON } from '../../graphql/mutations';

type EditClientProps = {
    client: {
        id: string;
        name: string;
        documentType: string;
        documentNumber: string;
        email?: string;
        phone?: string;
        address?: string;
    };
    onSuccess?: () => void;
    onClose: () => void;
};

const EditClient: React.FC<EditClientProps> = ({ client, onSuccess, onClose }) => {
    const { companyData } = useAuth();
    const { breakpoint } = useResponsive();

    // Adaptar según tamaño de pantalla
    const isSmall = breakpoint === 'sm';
    const isMedium = breakpoint === 'md';
    const isSmallDesktop = breakpoint === 'lg';
    const isMediumDesktop = breakpoint === 'xl';

    const modalPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.5rem' : isMediumDesktop ? '1.75rem' : '2rem';
    const modalMaxWidth = isSmall ? '95%' : isMedium ? '450px' : isSmallDesktop ? '500px' : isMediumDesktop ? '550px' : '600px';
    const titleFontSize = isSmall ? '1.25rem' : isMedium ? '1.375rem' : isSmallDesktop ? '1.375rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
    const labelFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
    const inputFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
    const inputPadding = isSmall ? '0.5rem 0.625rem' : isMedium ? '0.5625rem 0.75rem' : isSmallDesktop ? '0.5625rem 0.75rem' : isMediumDesktop ? '0.625rem 0.875rem' : '0.75rem';
    const buttonPadding = isSmall ? '0.5625rem 1rem' : isMedium ? '0.625rem 1.25rem' : isSmallDesktop ? '0.625rem 1.25rem' : isMediumDesktop ? '0.75rem 1.5rem' : '0.75rem 1.5rem';
    const buttonFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';

    const [formData, setFormData] = useState({
        name: client.name || '',
        documentType: client.documentType || 'DNI',
        documentNumber: client.documentNumber || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || ''
    });
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [updatePerson, { loading }] = useMutation(CREATE_PERSON, {
        onCompleted: (data) => {
            if (data.createPerson.success) {
                setMessage({ type: 'success', text: data.createPerson.message || 'Cliente actualizado exitosamente' });
                if (onSuccess) {
                    setTimeout(() => {
                        onSuccess();
                        onClose();
                    }, 1000);
                }
            } else {
                setMessage({ type: 'error', text: data.createPerson.message || 'Error al actualizar el cliente' });
            }
        },
        onError: (error) => {
            setMessage({ type: 'error', text: error.message || 'Error al actualizar el cliente' });
        },
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (!formData.name.trim()) {
            setMessage({ type: 'error', text: 'El nombre es requerido' });
            return;
        }
        if (!formData.documentNumber.trim()) {
            setMessage({ type: 'error', text: 'El número de documento es requerido' });
            return;
        }

        if (!companyData?.branch?.id) {
            setMessage({ type: 'error', text: 'No se encontró información de la sucursal' });
            return;
        }

        try {
            await updatePerson({
                variables: {
                    branchId: companyData.branch.id,
                    documentType: formData.documentType,
                    documentNumber: formData.documentNumber.trim(),
                    name: formData.name.trim(),
                    email: formData.email.trim() || null,
                    phone: formData.phone.trim() || null,
                    address: formData.address.trim() || null,
                    isCustomer: true,
                    isSupplier: false
                }
            });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Error al actualizar el cliente' });
        }
    };

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
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '1rem'
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: modalPadding,
                    maxWidth: modalMaxWidth,
                    width: '100%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isSmall ? '1rem' : isMedium ? '1.25rem' : '1.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: titleFontSize, fontWeight: 700, color: '#1e293b' }}>
                        ✏️ Editar Cliente
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
                            transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        ×
                    </button>
                </div>

                {message && (
                    <div
                        style={{
                            padding: '0.75rem',
                            borderRadius: '8px',
                            marginBottom: '1rem',
                            backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                            color: message.type === 'success' ? '#166534' : '#991b1b',
                            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fecaca'}`,
                            fontSize: isSmall ? '0.75rem' : isMedium ? '0.8125rem' : '0.875rem'
                        }}
                    >
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label
                            style={{
                                display: 'block',
                                fontSize: labelFontSize,
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: '0.5rem'
                            }}
                        >
                            Tipo de Documento *
                        </label>
                        <select
                            name="documentType"
                            value={formData.documentType}
                            onChange={handleChange}
                            required
                            style={{
                                width: '100%',
                                padding: inputPadding,
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                fontSize: inputFontSize,
                                backgroundColor: 'white',
                                boxSizing: 'border-box'
                            }}
                        >
                            <option value="DNI">DNI</option>
                            <option value="RUC">RUC</option>
                            <option value="CE">Carné de Extranjería</option>
                            <option value="PASAPORTE">Pasaporte</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label
                            style={{
                                display: 'block',
                                fontSize: labelFontSize,
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: '0.5rem'
                            }}
                        >
                            Número de Documento *
                        </label>
                        <input
                            type="text"
                            name="documentNumber"
                            value={formData.documentNumber}
                            onChange={handleChange}
                            required
                            style={{
                                width: '100%',
                                padding: inputPadding,
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                fontSize: inputFontSize,
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label
                            style={{
                                display: 'block',
                                fontSize: labelFontSize,
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: '0.5rem'
                            }}
                        >
                            Nombre Completo *
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            style={{
                                width: '100%',
                                padding: inputPadding,
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                fontSize: inputFontSize,
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label
                            style={{
                                display: 'block',
                                fontSize: labelFontSize,
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: '0.5rem'
                            }}
                        >
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                padding: inputPadding,
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                fontSize: inputFontSize,
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label
                            style={{
                                display: 'block',
                                fontSize: labelFontSize,
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: '0.5rem'
                            }}
                        >
                            Teléfono
                        </label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                padding: inputPadding,
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                fontSize: inputFontSize,
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: isSmall ? '1rem' : isMedium ? '1.25rem' : '1.5rem' }}>
                        <label
                            style={{
                                display: 'block',
                                fontSize: labelFontSize,
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: '0.5rem'
                            }}
                        >
                            Dirección
                        </label>
                        <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                padding: inputPadding,
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                fontSize: inputFontSize,
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: isSmall ? 'column' : 'row',
                        gap: '1rem',
                        justifyContent: 'flex-end'
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            style={{
                                padding: buttonPadding,
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                backgroundColor: 'white',
                                color: '#374151',
                                fontSize: buttonFontSize,
                                fontWeight: 600,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.6 : 1,
                                width: isSmall ? '100%' : 'auto'
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                padding: buttonPadding,
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: loading ? '#9ca3af' : '#667eea',
                                color: 'white',
                                fontSize: buttonFontSize,
                                fontWeight: 600,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'background 0.2s',
                                width: isSmall ? '100%' : 'auto'
                            }}
                        >
                            {loading ? 'Actualizando...' : 'Actualizar Cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditClient;
