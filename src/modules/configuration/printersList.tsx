import React from 'react';

export interface Printer {
  id: string;
  name: string;
  code: string;
  ipAddress?: string;
  ip_address?: string;
  port?: number;
  printer_type?: string;
  printerType?: string;
  paper_width?: number;
  paperWidth?: number;
  characters_per_line?: number;
  charactersPerLine?: number;
  encoding?: string;
  is_kitchen?: boolean;
  isKitchen?: boolean;
  is_bar?: boolean;
  isBar?: boolean;
  is_cashier?: boolean;
  isCashier?: boolean;
  is_receipt?: boolean;
  isReceipt?: boolean;
  is_invoice?: boolean;
  isInvoice?: boolean;
  is_active?: boolean;
  isActive?: boolean;
}

interface PrintersListProps {
  printers: Printer[];
  onEdit: (printer: Printer) => void;
  onOpenPermissions: (printer: Printer) => void;
  onOpenCreate: () => void;
}

const getP = (p: Printer, key: keyof Printer) => p[key];
const pVal = (p: Printer, camel: string, snake: string) =>
  getP(p, camel as keyof Printer) ?? getP(p, snake as keyof Printer);

const styleSection = {
  backgroundColor: 'white',
  borderRadius: '12px',
  padding: '1rem',
  border: '1px solid #e2e8f0',
  marginBottom: '1rem',
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

const PrintersList: React.FC<PrintersListProps> = ({ printers, onEdit, onOpenPermissions, onOpenCreate }) => {
  return (
    <div style={styleSection}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, color: '#334155' }}>Lista de impresoras</h3>
        <button type="button" onClick={onOpenCreate} style={styleButton(true)}>
          + Crear impresora
        </button>
      </div>
      {printers.length === 0 ? (
        <p style={{ color: '#64748b', margin: 0 }}>No hay impresoras. Haz clic en "Crear impresora" para agregar una.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>Nombre</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>Código</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>IP</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>Tipo</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>Uso</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {printers.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>{p.name}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>{p.code}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>{pVal(p, 'ipAddress', 'ip_address') ?? '-'}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>{pVal(p, 'printerType', 'printer_type') ?? 'THERMAL'}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    {[
                      pVal(p, 'isKitchen', 'is_kitchen'),
                      pVal(p, 'isBar', 'is_bar'),
                      pVal(p, 'isCashier', 'is_cashier'),
                      pVal(p, 'isReceipt', 'is_receipt'),
                      pVal(p, 'isInvoice', 'is_invoice'),
                    ]
                      .map((v, i) => (v ? ['Cocina', 'Bar', 'Caja', 'Ticket', 'Factura'][i] : null))
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    {pVal(p, 'isActive', 'is_active') !== false ? 'Activa' : 'Inactiva'}
                  </td>
                  <td style={{ padding: '0.5rem', display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => onOpenPermissions(p)} style={{ ...styleButton(false), padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
                      🔐 Asignaciones 
                    </button>
                    <button type="button" onClick={() => onEdit(p)} style={styleButton(false)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PrintersList;
