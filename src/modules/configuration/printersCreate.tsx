import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_PRINTER } from '../../graphql/mutations';

interface RaspberryPi {
  id: string;
  name?: string;
}

interface PrintersCreateProps {
  open: boolean;
  onClose: () => void;
  raspberryPis: RaspberryPi[];
  onSuccess: () => void;
}

const PRINTER_TYPES = [
  { value: 'THERMAL', label: 'Térmica' },
  { value: 'MATRIX', label: 'Matricial' },
  { value: 'LASER', label: 'Láser' },
];

const defaultForm = {
  raspberry_pi_id: '',
  name: '',
  code: '',
  ip_address: '',
  port: 9100,
  printer_type: 'THERMAL',
  paper_width: 80,
  characters_per_line: 48,
  encoding: 'UTF-8',
  is_kitchen: true,
  is_bar: false,
  is_cashier: false,
  is_receipt: false,
  is_invoice: false,
};

const styleOverlay = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
  padding: '1rem',
};

const styleModal = {
  backgroundColor: 'white',
  borderRadius: '16px',
  padding: '1.5rem',
  maxWidth: '520px',
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto' as const,
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
  border: '1px solid #e2e8f0',
};

const styleInput = {
  padding: '0.5rem 0.75rem',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  width: '100%',
  boxSizing: 'border-box' as const,
};

const styleLabel = {
  display: 'block',
  marginBottom: '0.25rem',
  fontWeight: 600,
  color: '#334155',
  fontSize: '0.875rem',
};

const styleButton = (primary: boolean) => ({
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  border: primary ? 'none' : '1px solid #e2e8f0',
  backgroundColor: primary ? '#6366f1' : 'white',
  color: primary ? 'white' : '#475569',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.875rem',
});

const PrintersCreate: React.FC<PrintersCreateProps> = ({ open, onClose, raspberryPis, onSuccess }) => {
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [createPrinter, { loading: creating }] = useMutation(CREATE_PRINTER, {
    onCompleted: (res) => {
      const result = res?.createPrinter;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message ?? 'Impresora creada' });
        setForm(defaultForm);
        onSuccess();
        setTimeout(() => {
          setMessage(null);
          onClose();
        }, 1200);
      } else {
        setMessage({ type: 'error', text: result?.message ?? 'Error al crear' });
      }
    },
    onError: (e) => setMessage({ type: 'error', text: e.message }),
  });

  const handleSubmit = () => {
    if (!form.raspberry_pi_id || !form.name?.trim() || !form.code?.trim() || !form.ip_address?.trim()) {
      setMessage({ type: 'error', text: 'Completa Raspberry Pi, nombre, código e IP' });
      return;
    }
    setMessage(null);
    createPrinter({
      variables: {
        raspberry_pi_id: form.raspberry_pi_id,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        ip_address: form.ip_address.trim(),
        port: form.port ?? 9100,
        printer_type: form.printer_type ?? 'THERMAL',
        paper_width: form.paper_width ?? 80,
        characters_per_line: form.characters_per_line ?? 48,
        encoding: form.encoding ?? 'UTF-8',
        is_kitchen: form.is_kitchen ?? true,
        is_bar: form.is_bar ?? false,
        is_cashier: form.is_cashier ?? false,
        is_receipt: form.is_receipt ?? false,
        is_invoice: form.is_invoice ?? false,
      },
    });
  };

  const handleClose = () => {
    if (!creating) {
      setForm(defaultForm);
      setMessage(null);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div style={styleOverlay} onClick={handleClose}>
      <div style={styleModal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 1rem', color: '#334155' }}>🖨️ Crear impresora</h3>

        {message && (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.75rem',
              borderRadius: '8px',
              backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: message.type === 'success' ? '#166534' : '#991b1b',
              fontSize: '0.875rem',
            }}
          >
            {message.text}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={styleLabel}>Raspberry Pi *</label>
            <select
              value={form.raspberry_pi_id}
              onChange={(e) => setForm((f) => ({ ...f, raspberry_pi_id: e.target.value }))}
              style={styleInput}
            >
              <option value="">Seleccionar</option>
              {raspberryPis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || `Dispositivo ${r.id.slice(0, 8)}`}
                </option>
              ))}
            </select>
            {raspberryPis.length === 0 && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                No hay Raspberry Pi para esta sucursal.
              </p>
            )}
          </div>
          <div>
            <label style={styleLabel}>Nombre *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej. Cocina 1"
              style={styleInput}
            />
          </div>
          <div>
            <label style={styleLabel}>Código *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="Ej. COCINA1"
              style={styleInput}
            />
          </div>
          <div>
            <label style={styleLabel}>IP *</label>
            <input
              type="text"
              value={form.ip_address}
              onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))}
              placeholder="192.168.1.100"
              style={styleInput}
            />
          </div>
          <div>
            <label style={styleLabel}>Puerto</label>
            <input
              type="number"
              value={form.port}
              onChange={(e) => setForm((f) => ({ ...f, port: parseInt(e.target.value, 10) || 9100 }))}
              style={styleInput}
            />
          </div>
          <div>
            <label style={styleLabel}>Tipo</label>
            <select
              value={form.printer_type}
              onChange={(e) => setForm((f) => ({ ...f, printer_type: e.target.value }))}
              style={styleInput}
            >
              {PRINTER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={styleLabel}>Ancho papel (mm)</label>
            <input
              type="number"
              value={form.paper_width}
              onChange={(e) => setForm((f) => ({ ...f, paper_width: parseInt(e.target.value, 10) || 80 }))}
              style={styleInput}
            />
          </div>
          <div>
            <label style={styleLabel}>Caracteres por línea</label>
            <input
              type="number"
              value={form.characters_per_line}
              onChange={(e) => setForm((f) => ({ ...f, characters_per_line: parseInt(e.target.value, 10) || 48 }))}
              style={styleInput}
            />
          </div>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {['is_kitchen', 'is_bar', 'is_cashier', 'is_receipt', 'is_invoice'].map((key) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
              <input
                type="checkbox"
                checked={!!(form as Record<string, unknown>)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
              />
              {key.replace('is_', '').replace('_', ' ')}
            </label>
          ))}
        </div>

        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" onClick={handleClose} disabled={creating} style={styleButton(false)}>
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={creating} style={styleButton(true)}>
            {creating ? 'Creando...' : 'Crear impresora'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintersCreate;
