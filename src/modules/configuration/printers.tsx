import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_PRINTERS_CONFIG, GET_CATEGORIES_BY_BRANCH } from '../../graphql/queries';
import { UPDATE_PRINTER } from '../../graphql/mutations';
import PrintersList, { type Printer } from './printersList';
import PrintersCreate from './printersCreate';
import PrinterPermission from './printerPermission';

interface RaspberryPi {
  id: string;
  name?: string;
}

const Printers: React.FC = () => {
  const { companyData } = useAuth();
  const branchId = companyData?.branch?.id;

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [printerForPermissions, setPrinterForPermissions] = useState<Printer | null>(null);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [editForm, setEditForm] = useState<Partial<Printer> & { is_active?: boolean }>({});

  const { data: printersConfigData, loading: loadingPrinters, error: errorPrinters, refetch: refetchPrintersConfig } = useQuery(
    GET_PRINTERS_CONFIG,
    {
      variables: { branchId: branchId! },
      skip: !branchId,
      fetchPolicy: 'network-only',
    }
  );

  const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
  });

  const raspberryPi: RaspberryPi | null = printersConfigData?.raspberryPiByBranch ?? null;
  const raspberryPis: RaspberryPi[] = raspberryPi ? [raspberryPi] : [];
  const categories = categoriesData?.categoriesByBranch ?? [];
  const allPrinters: Printer[] = printersConfigData?.printersByBranch ?? [];
  const categoryPrintersByBranch = printersConfigData?.categoryPrintersByBranch ?? [];

  const [updatePrinter, { loading: updating }] = useMutation(UPDATE_PRINTER, {
    onCompleted: (res) => {
      const result = res?.updatePrinter;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message ?? 'Impresora actualizada' });
        setEditingPrinter(null);
        refetchPrintersConfig();
      } else {
        setMessage({ type: 'error', text: result?.message ?? 'Error al actualizar' });
      }
    },
    onError: (e) => setMessage({ type: 'error', text: e.message }),
  });

  const handleUpdate = () => {
    if (!editingPrinter?.id) return;
    setMessage(null);
    updatePrinter({
      variables: {
        printer_id: editingPrinter.id,
        name: editForm.name !== undefined ? editForm.name : undefined,
        code: editForm.code !== undefined ? editForm.code : undefined,
        ip_address: editForm.ipAddress,
        port: editForm.port,
        printer_type: editForm.printerType,
        paper_width: editForm.paperWidth,
        characters_per_line: editForm.charactersPerLine,
        encoding: editForm.encoding,
        is_kitchen: editForm.isKitchen,
        is_bar: editForm.isBar,
        is_cashier: editForm.isCashier,
        is_receipt: editForm.isReceipt,
        is_invoice: editForm.isInvoice,
        is_active: editForm.is_active,
      },
    });
  };

  const openEdit = (p: Printer) => {
    setEditingPrinter(p);
    setEditForm({
      name: p.name,
      code: p.code,
      ipAddress: p.ipAddress ?? p.ip_address,
      port: p.port,
      printerType: p.printerType ?? p.printer_type,
      paperWidth: p.paperWidth ?? p.paper_width,
      charactersPerLine: p.charactersPerLine ?? p.characters_per_line,
      encoding: p.encoding,
      isKitchen: p.isKitchen ?? p.is_kitchen,
      isBar: p.isBar ?? p.is_bar,
      isCashier: p.isCashier ?? p.is_cashier,
      isReceipt: p.isReceipt ?? p.is_receipt,
      isInvoice: p.isInvoice ?? p.is_invoice,
      is_active: p.isActive ?? p.is_active,
    });
  };

  const styleSection = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '1rem',
    border: '1px solid #e2e8f0',
    marginBottom: '1rem',
  };
  const styleInput = {
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    width: '100%',
    boxSizing: 'border-box' as const,
  };
  const styleLabel = { display: 'block', marginBottom: '0.25rem', fontWeight: 600, color: '#334155', fontSize: '0.875rem' };
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

  if (!branchId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        No se encontró información de sucursal.
      </div>
    );
  }

  if (loadingPrinters) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
        Cargando impresoras y dispositivos...
      </div>
    );
  }

  if (errorPrinters) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#dc2626' }}>
        Error al cargar: {errorPrinters.message}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {message && (
        <div
          style={{
            padding: '0.75rem',
            borderRadius: '8px',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
            backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: message.type === 'success' ? '#166534' : '#991b1b',
          }}
        >
          {message.text}
        </div>
      )}

      <PrintersList
        printers={allPrinters}
        onEdit={openEdit}
        onOpenPermissions={(p) => setPrinterForPermissions(p)}
        onOpenCreate={() => setShowCreateModal(true)}
      />

      <PrinterPermission
        open={!!printerForPermissions}
        printer={printerForPermissions}
        onClose={() => setPrinterForPermissions(null)}
        categories={categories}
        categoryPrintersByBranch={categoryPrintersByBranch}
        onSuccess={refetchPrintersConfig}
      />

      <PrintersCreate
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        raspberryPis={raspberryPis}
        onSuccess={refetchPrintersConfig}
      />

      {/* Editar impresora (modal simple) */}
      {editingPrinter && (
        <div style={styleSection}>
          <h3 style={{ margin: '0 0 0.75rem', color: '#334155' }}>Editar: {editingPrinter.name}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={styleLabel}>Nombre</label>
              <input
                type="text"
                value={editForm.name ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                style={styleInput}
              />
            </div>
            <div>
              <label style={styleLabel}>Código</label>
              <input
                type="text"
                value={editForm.code ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))}
                style={styleInput}
              />
            </div>
            <div>
              <label style={styleLabel}>IP</label>
              <input
                type="text"
                value={editForm.ipAddress ?? editForm.ip_address ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, ipAddress: e.target.value }))}
                style={styleInput}
              />
            </div>
            <div>
              <label style={styleLabel}>Puerto</label>
              <input
                type="number"
                value={editForm.port ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, port: parseInt(e.target.value, 10) || undefined }))}
                style={styleInput}
              />
            </div>
            <div>
              <label style={styleLabel}>Activa</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={editForm.is_active ?? editForm.isActive ?? true}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Sí
              </label>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={handleUpdate} disabled={updating} style={styleButton(true)}>
              {updating ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setEditingPrinter(null)} style={styleButton(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Printers;
