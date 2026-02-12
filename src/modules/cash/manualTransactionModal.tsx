import React, { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_MANUAL_TRANSACTION, PRINT_PAYMENT } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';

interface ManualTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cashRegisters: any[];
  userId: string;
  branchId: string;
}

const ManualTransactionModal: React.FC<ManualTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cashRegisters,
  userId,
  branchId
}) => {
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [transactionType, setTransactionType] = useState('INCOME');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { deviceId, getMacAddress, getDeviceId } = useAuth();
  const [createManualTransaction, { loading }] = useMutation(CREATE_MANUAL_TRANSACTION);
  const [printPayment] = useMutation(PRINT_PAYMENT);

  useEffect(() => {
    if (isOpen && cashRegisters.length > 0 && !cashRegisterId) {
      setCashRegisterId(cashRegisters[0].id);
    }
  }, [isOpen, cashRegisters, cashRegisterId]);

  /* ... inside handleSubmit ... */
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
        // Imprimir el movimiento
        const createdPayments = result.data.createManualTransaction.payments;
        if (createdPayments && createdPayments.length > 0) {
          const paymentId = createdPayments[0].id;

          // Obtener MAC para imprimir
          let resolvedDeviceId: string;
          try {
            const mac = await getMacAddress();
            if (mac) {
              resolvedDeviceId = await getMacAddress();
            } else {
              resolvedDeviceId = deviceId || getDeviceId();
            }
          } catch (error) {
            console.error('Error al obtener MAC address:', error);
            resolvedDeviceId = deviceId || getDeviceId();
          }

          try {
            await printPayment({
              variables: {
                paymentId: paymentId,
                deviceId: resolvedDeviceId
              }
            });
          } catch (printError) {
            console.error('Error imprimiendo movimiento:', printError);
            // No bloqueamos el flujo si falla la impresión, solo logueamos
          }
        }

        // Reset form
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
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1e293b' }}>
            Registrar Ingreso/Egreso
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{
              padding: '0.75rem',
              borderRadius: '6px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>
              Caja
            </label>
            <select
              value={cashRegisterId}
              onChange={(e) => setCashRegisterId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                backgroundColor: 'white'
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

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>
              Tipo de Transacción
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{
                flex: 1,
                cursor: 'pointer',
                padding: '0.75rem',
                borderRadius: '6px',
                border: `1px solid ${transactionType === 'INCOME' ? '#16a34a' : '#cbd5e1'}`,
                backgroundColor: transactionType === 'INCOME' ? '#f0fdf4' : 'white',
                textAlign: 'center',
                fontWeight: transactionType === 'INCOME' ? 600 : 400,
                color: transactionType === 'INCOME' ? '#16a34a' : '#64748b'
              }}>
                <input
                  type="radio"
                  name="transactionType"
                  value="INCOME"
                  checked={transactionType === 'INCOME'}
                  onChange={() => setTransactionType('INCOME')}
                  style={{ display: 'none' }}
                />
                Ingreso
              </label>
              <label style={{
                flex: 1,
                cursor: 'pointer',
                padding: '0.75rem',
                borderRadius: '6px',
                border: `1px solid ${transactionType === 'EXPENSE' ? '#dc2626' : '#cbd5e1'}`,
                backgroundColor: transactionType === 'EXPENSE' ? '#fef2f2' : 'white',
                textAlign: 'center',
                fontWeight: transactionType === 'EXPENSE' ? 600 : 400,
                color: transactionType === 'EXPENSE' ? '#dc2626' : '#64748b'
              }}>
                <input
                  type="radio"
                  name="transactionType"
                  value="EXPENSE"
                  checked={transactionType === 'EXPENSE'}
                  onChange={() => setTransactionType('EXPENSE')}
                  style={{ display: 'none' }}
                />
                Egreso
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>
                Monto
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
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem'
                }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>
                Método de Pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                  backgroundColor: 'white'
                }}
              >
                <option value="CASH">Efectivo</option>
                <option value="YAPE">Yape</option>
                <option value="PLIN">Plin</option>
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="OTROS">Otros</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>
              Referencia (Opcional)
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="N° Operación, cheque, etc."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>
              Notas / Descripción
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descripción del movimiento..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: 'white',
                color: '#475569',
                fontSize: '0.875rem',
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
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: transactionType === 'INCOME' ? '#16a34a' : '#dc2626',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Guardando...' : 'Guardar Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualTransactionModal;
