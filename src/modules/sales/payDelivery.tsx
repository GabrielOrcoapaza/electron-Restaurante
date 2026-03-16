import React from 'react';
import { useResponsive } from '../../hooks/useResponsive';

type ToastType = 'success' | 'error' | 'info' | 'warning';

export type PersonPayment = {
    id: string;
    name: string;
    documentType: string;
    documentNumber: string;
};

type SerialItem = { id: string; serial: string };

export type PayDeliveryModalProps = {
    isOpen: boolean;
    onClose: () => void;
    cartTotal: number;
    isFactura: boolean;
    personSearchTerm: string;
    setPersonSearchTerm: (v: string) => void;
    selectedPerson: PersonPayment | null;
    setSelectedPerson: (p: PersonPayment | null) => void;
    filteredClients: any[];
    clientsLoading: boolean;
    sunatSearchLoading: boolean;
    isSaving: boolean;
    onSearchSunat: () => void;
    showToast: (msg: string, type: ToastType) => void;
    documents: any[];
    selectedDocument: string;
    setSelectedDocument: (v: string) => void;
    serials: SerialItem[];
    selectedSerial: string;
    setSelectedSerial: (v: string) => void;
    cashRegisters: any[];
    selectedCashRegister: string;
    setSelectedCashRegister: (v: string) => void;
    paymentMethod: string;
    setPaymentMethod: (v: string) => void;
    paidAmount: string;
    setPaidAmount: (v: string) => void;
    onConfirm: () => void;
};

const PayDeliveryModal: React.FC<PayDeliveryModalProps> = ({
    isOpen,
    onClose,
    cartTotal,
    isFactura,
    personSearchTerm,
    setPersonSearchTerm,
    selectedPerson,
    setSelectedPerson,
    filteredClients,
    clientsLoading,
    sunatSearchLoading,
    isSaving,
    onSearchSunat,
    showToast,
    documents,
    selectedDocument,
    setSelectedDocument,
    serials,
    selectedSerial,
    setSelectedSerial,
    cashRegisters,
    selectedCashRegister,
    setSelectedCashRegister,
    paymentMethod,
    setPaymentMethod,
    paidAmount,
    setPaidAmount,
    onConfirm
}) => {
    const { breakpoint } = useResponsive();
    const isMedium = breakpoint === 'md';
    const paymentFormGap = '0.65rem';
    const inputPadding = isMedium ? '0.45rem' : '0.35rem';

    if (!isOpen) return null;

    const handleSearchSunatClick = () => {
        const term = (personSearchTerm || '').trim().replace(/\s/g, '');
        const validDoc = (/^\d{8}$/.test(term) && !isFactura) || /^\d{11}$/.test(term);
        if (validDoc) {
            onSearchSunat();
        } else {
            showToast('Ingrese DNI (8 dígitos) o RUC (11 dígitos) y pulse la lupa para buscar en SUNAT.', 'warning');
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '1rem',
                boxSizing: 'border-box'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: isMedium ? '1rem' : '1.25rem',
                    maxWidth: '420px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#2d3748', margin: 0 }}>
                        Información de Pago
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '0.25rem 0.5rem',
                            border: 'none',
                            background: 'transparent',
                            fontSize: '1.25rem',
                            color: '#64748b',
                            cursor: 'pointer',
                            lineHeight: 1
                        }}
                        aria-label="Cerrar"
                    >
                        ×
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: paymentFormGap }}>
                    {/* Cliente */}
                    <div>
                        <label style={{ fontSize: '0.6875rem', fontWeight: '500', color: '#4a5568', display: 'block', marginBottom: '0.15rem' }}>
                            Cliente (opcional)
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.35rem', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: 'white', overflow: 'hidden' }}>
                                <input
                                    type="text"
                                    value={personSearchTerm}
                                    onChange={(e) => {
                                        setPersonSearchTerm(e.target.value);
                                        setSelectedPerson(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSearchSunatClick();
                                        }
                                    }}
                                    placeholder={isFactura ? 'Buscar cliente (solo RUC)...' : 'Buscar cliente (DNI/RUC)...'}
                                    disabled={clientsLoading || isSaving}
                                    style={{
                                        flex: 1,
                                        padding: inputPadding,
                                        border: 'none',
                                        fontSize: '0.75rem',
                                        backgroundColor: 'transparent',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        cursor: clientsLoading || isSaving ? 'not-allowed' : 'text'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleSearchSunatClick}
                                    disabled={clientsLoading || sunatSearchLoading || isSaving}
                                    title="Buscar en SUNAT"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0 0.5rem',
                                        border: 'none',
                                        background: sunatSearchLoading ? '#e2e8f0' : '#0d9488',
                                        color: 'white',
                                        cursor: clientsLoading || sunatSearchLoading || isSaving ? 'not-allowed' : 'pointer',
                                        opacity: clientsLoading || sunatSearchLoading || isSaving ? 0.7 : 1
                                    }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="m21 21-4.35-4.35" />
                                    </svg>
                                </button>
                            </div>
                            {personSearchTerm && !selectedPerson && filteredClients.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    marginTop: '0.25rem',
                                    maxHeight: '140px',
                                    overflowY: 'auto',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    backgroundColor: 'white',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
                                    zIndex: 10
                                }}>
                                    {!isFactura && (
                                        <div
                                            onClick={() => { setSelectedPerson(null); setPersonSearchTerm(''); }}
                                            style={{
                                                padding: '0.4rem 0.6rem',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #f1f5f9',
                                                fontSize: '0.75rem',
                                                color: '#64748b'
                                            }}
                                        >
                                            Sin cliente (Consumidor final)
                                        </div>
                                    )}
                                    {filteredClients.map((client: any) => (
                                        <div
                                            key={client.id}
                                            onClick={() => {
                                                setSelectedPerson({
                                                    id: client.id,
                                                    name: client.name || '',
                                                    documentType: client.documentType || '',
                                                    documentNumber: client.documentNumber || ''
                                                });
                                                setPersonSearchTerm(client.name || '');
                                            }}
                                            style={{
                                                padding: '0.4rem 0.6rem',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #f1f5f9',
                                                fontSize: '0.75rem'
                                            }}
                                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f7fafc'; }}
                                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                                        >
                                            <div style={{ fontWeight: 600 }}>{client.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{client.documentType}: {client.documentNumber}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {personSearchTerm && !selectedPerson && !clientsLoading && filteredClients.length === 0 && (
                                <div style={{ marginTop: '0.25rem' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.35rem' }}>
                                        {isFactura ? 'No hay clientes con RUC' : 'No se encontraron clientes'}
                                    </div>
                                    {(() => {
                                        const term = (personSearchTerm || '').trim().replace(/\s/g, '');
                                        const canSearchSunat = (/^\d{8}$/.test(term) && !isFactura) || /^\d{11}$/.test(term);
                                        return (
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                {canSearchSunat ? (
                                                    <button
                                                        type="button"
                                                        onClick={onSearchSunat}
                                                        disabled={sunatSearchLoading || isSaving}
                                                        style={{
                                                            padding: '0.35rem 0.6rem',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 600,
                                                            color: '#0f766e',
                                                            backgroundColor: '#ccfbf1',
                                                            border: '1px solid #99f6e4',
                                                            borderRadius: '6px',
                                                            cursor: sunatSearchLoading || isSaving ? 'not-allowed' : 'pointer',
                                                            opacity: sunatSearchLoading || isSaving ? 0.7 : 1
                                                        }}
                                                    >
                                                        {sunatSearchLoading ? 'Buscando en SUNAT...' : '🔍 Buscar en SUNAT'}
                                                    </button>
                                                ) : (
                                                    <span>Ingrese DNI (8 dígitos) o RUC (11 dígitos) y pulse el botón de lupa para traer el cliente desde SUNAT.</span>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Documento y Serie */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ flex: 2 }}>
                            <label style={{ fontSize: '0.6875rem', fontWeight: '500', color: '#4a5568', display: 'block', marginBottom: '0.15rem' }}>Tipo Documento *</label>
                            <select
                                value={selectedDocument}
                                onChange={(e) => {
                                    setSelectedDocument(e.target.value);
                                    setSelectedSerial('');
                                }}
                                style={{ width: '100%', padding: inputPadding, border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.75rem' }}
                            >
                                <option value="..."></option>
                                {documents.map((doc: any) => (
                                    <option key={doc.id} value={doc.id}>{doc.description}</option>
                                ))}
                            </select>
                        </div>
                        {selectedDocument && (
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.6875rem', fontWeight: '500', color: '#4a5568', display: 'block', marginBottom: '0.15rem' }}>Serie *</label>
                                <select
                                    value={selectedSerial}
                                    onChange={(e) => setSelectedSerial(e.target.value)}
                                    style={{ width: '100%', padding: inputPadding, border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.75rem' }}
                                >
                                    <option value="">...</option>
                                    {serials.map((serial: SerialItem) => (
                                        <option key={serial.id} value={serial.serial}>{serial.serial}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Caja y Método */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.6875rem', fontWeight: '500', color: '#4a5568', display: 'block', marginBottom: '0.15rem' }}>Caja *</label>
                            <select
                                value={selectedCashRegister}
                                onChange={(e) => setSelectedCashRegister(e.target.value)}
                                style={{ width: '100%', padding: inputPadding, border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.75rem' }}
                            >
                                <option value="">Seleccionar...</option>
                                {cashRegisters.map((cashRegister: any) => (
                                    <option key={cashRegister.id} value={cashRegister.id}>{cashRegister.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.6875rem', fontWeight: '500', color: '#4a5568', display: 'block', marginBottom: '0.15rem' }}>Método *</label>
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                style={{ width: '100%', padding: inputPadding, border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.75rem' }}
                            >
                                <option value="CASH">Efectivo</option>
                                <option value="CARD">Tarjeta</option>
                                <option value="TRANSFER">Transferencia</option>
                                <option value="YAPE">Yape</option>
                                <option value="PLIN">Plin</option>
                            </select>
                        </div>
                    </div>

                    {/* Monto Pagado */}
                    <div>
                        <label style={{ fontSize: '0.6875rem', fontWeight: '500', color: '#4a5568', display: 'block', marginBottom: '0.15rem' }}>Monto Pagado *</label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={paidAmount}
                            onChange={(e) => setPaidAmount(e.target.value)}
                            style={{
                                width: '100%',
                                padding: inputPadding,
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {/* Total en el modal */}
                    <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#2d3748' }}>Total a pagar:</span>
                            <span style={{ fontSize: '1rem', fontWeight: '700', color: '#667eea' }}>S/ {cartTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Botones del modal */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                flex: 1,
                                padding: '0.65rem 1rem',
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: '#475569',
                                cursor: 'pointer'
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isSaving}
                            style={{
                                flex: 1,
                                padding: '0.65rem 1rem',
                                backgroundColor: isSaving ? '#cbd5e0' : '#667eea',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: 'white',
                                cursor: isSaving ? 'not-allowed' : 'pointer',
                                boxShadow: '0 2px 4px rgba(102, 126, 234, 0.3)'
                            }}
                        >
                            {isSaving ? 'Procesando...' : 'Confirmar y Procesar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PayDeliveryModal;
