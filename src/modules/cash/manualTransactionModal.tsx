import React, { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_MANUAL_TRANSACTION } from '../../graphql/mutations';
import { useResponsive } from '../../hooks/useResponsive';

interface ManualTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cashRegisters: any[];
  userId: string;
  branchId: string;
  /** Si es false, el método de pago queda fijo en efectivo (permiso cash.change_payment_method). Por defecto true. */
  allowChangePaymentMethod?: boolean;
}

const ManualTransactionModal: React.FC<ManualTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cashRegisters,
  userId,
  branchId,
  allowChangePaymentMethod = true
}) => {
  const { isXs } = useResponsive();
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [transactionType, setTransactionType] = useState('INCOME');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const [createManualTransaction, { loading }] = useMutation(CREATE_MANUAL_TRANSACTION);

  useEffect(() => {
    if (isOpen && cashRegisters.length > 0 && !cashRegisterId) {
      setCashRegisterId(cashRegisters[0].id);
    }
  }, [isOpen, cashRegisters, cashRegisterId]);

  useEffect(() => {
    if (!allowChangePaymentMethod) {
      setPaymentMethod('CASH');
    }
  }, [allowChangePaymentMethod, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!cashRegisterId) {
      setError('Seleccione una caja');
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }

    try {
      const now = new Date().toISOString();
      const paymentInput = {
        cashRegisterId,
        paymentType: paymentMethod,
        transactionType,
        paidAmount: Number(amount),
        paymentDate: now,
        paymentMethod,
        totalAmount: Number(amount),
        referenceNumber: referenceNumber || null
      };

      const result = await createManualTransaction({
        variables: {
          cashRegisterId,
          transactionType,
          payments: [paymentInput],
          notes: notes || null,
          userId,
          branchId
        }
      });

      if (result.data?.createManualTransaction?.success) {
        setAmount('');
        setReferenceNumber('');
        setNotes('');
        onSuccess();
        onClose();
      } else {
        setError(result.data?.createManualTransaction?.message || 'Error al crear la transacción');
      }
    } catch (err: any) {
      console.error('Error creating manual transaction:', err);
      setError(err.message || 'Error al crear la transacción');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: isXs ? 'flex-end' : 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: isXs ? '20px 20px 0 0' : '16px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        animation: isXs ? 'slideUp 0.3s ease-out' : 'fadeIn 0.2s ease-out'
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: isXs ? '1.25rem' : '1.5rem',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          zIndex: 10
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: isXs ? '1.1rem' : '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              💰 Registrar Movimiento
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
              Completa los datos para el ingreso o egreso
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: isXs ? '1.25rem' : '1.5rem' }}>
          {error && (
            <div style={{
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              fontWeight: 500
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
              Seleccionar Caja
            </label>
            <select
              value={cashRegisterId}
              onChange={(e) => setCashRegisterId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                fontSize: '0.95rem',
                backgroundColor: '#f8fafc',
                color: '#1e293b'
              }}
              required
            >
              <option value="">Seleccionar caja</option>
              {cashRegisters.map(cash => (
                <option key={cash.id} value={cash.id}>
                  {cash.name} ({cash.cashType === 'MAIN' ? 'Principal' : 'Secundaria'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
              Tipo de Movimiento
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <label style={{
                flex: 1,
                cursor: 'pointer',
                padding: '1rem',
                borderRadius: '10px',
                border: `2px solid ${transactionType === 'INCOME' ? '#16a34a' : '#e2e8f0'}`,
                backgroundColor: transactionType === 'INCOME' ? '#f0fdf4' : 'white',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}>
                <input
                  type="radio"
                  name="transactionType"
                  value="INCOME"
                  checked={transactionType === 'INCOME'}
                  onChange={() => setTransactionType('INCOME')}
                  style={{ display: 'none' }}
                />
                <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>📈</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: transactionType === 'INCOME' ? '#166534' : '#64748b' }}>Ingreso</div>
              </label>
              <label style={{
                flex: 1,
                cursor: 'pointer',
                padding: '1rem',
                borderRadius: '10px',
                border: `2px solid ${transactionType === 'EXPENSE' ? '#dc2626' : '#e2e8f0'}`,
                backgroundColor: transactionType === 'EXPENSE' ? '#fef2f2' : 'white',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}>
                <input
                  type="radio"
                  name="transactionType"
                  value="EXPENSE"
                  checked={transactionType === 'EXPENSE'}
                  onChange={() => setTransactionType('EXPENSE')}
                  style={{ display: 'none' }}
                />
                <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>📉</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: transactionType === 'EXPENSE' ? '#991b1b' : '#64748b' }}>Egreso</div>
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isXs ? '1fr' : '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
                Monto (S/)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  backgroundColor: '#f8fafc',
                  color: '#0f172a'
                }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
                Método de Pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={!allowChangePaymentMethod}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.95rem',
                  backgroundColor: allowChangePaymentMethod ? '#f8fafc' : '#f1f5f9',
                  color: '#1e293b'
                }}
              >
                <option value="CASH">💵 Efectivo</option>
                <option value="YAPE">📲 Yape</option>
                <option value="PLIN">📲 Plin</option>
                <option value="CARD">💳 Tarjeta</option>
                <option value="TRANSFER">🏦 Transferencia</option>
                <option value="OTROS">➕ Otros</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
              Referencia / Operación (Opcional)
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Ej: N° Operación, cheque, etc."
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                fontSize: '0.95rem',
                backgroundColor: '#f8fafc'
              }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
              Notas Adicionales
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="¿Por qué se realiza este movimiento?"
              rows={3}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                fontSize: '0.95rem',
                backgroundColor: '#f8fafc',
                resize: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexDirection: isXs ? 'column-reverse' : 'row', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.875rem 1.5rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                backgroundColor: 'white',
                color: '#64748b',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.875rem 1.5rem',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: transactionType === 'INCOME' ? '#16a34a' : '#dc2626',
                color: 'white',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: `0 4px 12px ${transactionType === 'INCOME' ? 'rgba(22, 163, 74, 0.25)' : 'rgba(220, 38, 38, 0.25)'}`
              }}
            >
              {loading ? 'Guardando...' : 'Confirmar Movimiento'}
            </button>
          </div>
        </form>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}} />
      </div>
    </div>
  );
};

export default ManualTransactionModal;
