import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { ASSIGN_CATEGORY_TO_PRINTER, BULK_ASSIGN_CATEGORY_PRINTERS, REMOVE_CATEGORY_PRINTERS } from '../../graphql/mutations';

export interface Printer {
  id: string;
  name: string;
  code?: string;
}

interface Category {
  id: string;
  name: string;
}

interface CategoryPrinterItem {
  id: string;
  priority: number;
  category?: { id: string; name: string };
  printer?: { id: string; name: string };
}

interface PrinterPermissionProps {
  open: boolean;
  onClose: () => void;
  printer: Printer | null;
  categories: Category[];
  categoryPrintersByBranch: CategoryPrinterItem[];
  onSuccess: () => void;
}

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

const styleLabel = { display: 'block', marginBottom: '0.25rem', fontWeight: 600, color: '#334155', fontSize: '0.875rem' };
const styleInput = {
  padding: '0.5rem 0.75rem',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  width: '100%',
  boxSizing: 'border-box' as const,
};

const styleButton = (primary: boolean) => ({
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  border: primary ? 'none' : '1px solid #e2e8f0',
  backgroundColor: primary ? '#16a34a' : 'white',
  color: primary ? 'white' : '#475569',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.875rem',
});

const PrinterPermission: React.FC<PrinterPermissionProps> = ({
  open,
  onClose,
  printer,
  categories,
  categoryPrintersByBranch,
  onSuccess,
}) => {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [assignPriority, setAssignPriority] = useState(1);

  const [assignCategory, { loading: assigningOne }] = useMutation(ASSIGN_CATEGORY_TO_PRINTER, {
    onCompleted: (res) => {
      const result = res?.assignCategoryToPrinter;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message ?? 'Categoría asignada' });
        setSelectedCategoryIds(new Set());
        onSuccess();
      } else {
        setMessage({ type: 'error', text: result?.message ?? 'Error' });
      }
    },
    onError: (e) => setMessage({ type: 'error', text: e.message }),
  });

  const [bulkAssign, { loading: assigningBulk }] = useMutation(BULK_ASSIGN_CATEGORY_PRINTERS, {
    onCompleted: (res) => {
      const result = res?.bulkAssignCategoryPrinters;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message ?? 'Categorías asignadas' });
        setSelectedCategoryIds(new Set());
        onSuccess();
      } else {
        setMessage({ type: 'error', text: result?.message ?? 'Error' });
      }
    },
    onError: (e) => setMessage({ type: 'error', text: e.message }),
  });

  const assigning = assigningOne || assigningBulk;

  const [removeCategoryPrinters, { loading: removing }] = useMutation(REMOVE_CATEGORY_PRINTERS, {
    onCompleted: (res) => {
      const result = res?.removeCategoryPrinters;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message ?? 'Asignación quitada' });
        onSuccess();
      } else {
        setMessage({ type: 'error', text: result?.message ?? 'Error' });
      }
    },
    onError: (e) => setMessage({ type: 'error', text: e.message }),
  });

  if (!open || !printer) return null;

  const assignedToThisPrinter = categoryPrintersByBranch.filter(
    (cp) => cp.printer?.id === printer.id
  );
  const assignedCategoryIds = new Set(assignedToThisPrinter.map((cp) => cp.category?.id).filter(Boolean));
  const availableToAssign = categories.filter((c) => !assignedCategoryIds.has(c.id));

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const handleAssignSelected = () => {
    if (!printer?.id || selectedCategoryIds.size === 0) {
      setMessage({ type: 'error', text: 'Selecciona al menos una categoría' });
      return;
    }
    setMessage(null);
    const ids = Array.from(selectedCategoryIds);
    if (ids.length === 1) {
      assignCategory({
        variables: {
          printerId: printer.id,
          categoryId: ids[0],
          priority: assignPriority,
        },
      });
    } else {
      bulkAssign({
        variables: {
          categoryIds: ids,
          printerIds: [printer.id],
          priority: assignPriority,
        },
      });
    }
  };

  const handleRemove = (categoryPrinterId: string) => {
    setMessage(null);
    removeCategoryPrinters({ variables: { ids: [categoryPrinterId] } });
  };

  const handleClose = () => {
    if (!assigning && !removing) {
      setMessage(null);
      setSelectedCategoryIds(new Set());
      onClose();
    }
  };

  return (
    <div style={styleOverlay} onClick={handleClose}>
      <div style={styleModal} onClick={(e) => e.stopPropagation()}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
          🔐 Categorías: {printer.name}
        </h4>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#64748b' }}>
          Asigna o quita categorías para esta impresora. Las categorías asignadas definen qué productos se imprimen aquí.
        </p>

        {message && (
          <div
            style={{
              marginBottom: '1rem',
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

        {/* Categorías ya asignadas a esta impresora */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h5 style={{ margin: '0 0 0.5rem', color: '#334155', fontSize: '0.9375rem' }}>
            Categorías asignadas a esta impresora
          </h5>
          {assignedToThisPrinter.length === 0 ? (
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.875rem' }}>
              Aún no tiene categorías asignadas.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {assignedToThisPrinter.map((cp) => (
                <div
                  key={cp.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  <span style={{ fontWeight: 500, color: '#334155' }}>
                    {cp.category?.name ?? '?'} (prioridad {cp.priority})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(cp.id)}
                    disabled={removing}
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                      backgroundColor: '#fee2e2',
                      color: '#991b1b',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: removing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Categorías disponibles para asignar */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h5 style={{ margin: '0 0 0.5rem', color: '#334155', fontSize: '0.9375rem' }}>
            Asignar categorías
          </h5>
          {availableToAssign.length === 0 ? (
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.875rem' }}>
              Todas las categorías ya están asignadas a esta impresora.
            </p>
          ) : (
            <>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={styleLabel}>Prioridad</label>
                <input
                  type="number"
                  value={assignPriority}
                  onChange={(e) => setAssignPriority(parseInt(e.target.value, 10) || 1)}
                  style={{ ...styleInput, width: '80px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                {availableToAssign.map((cat) => (
                  <label
                    key={cat.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      backgroundColor: selectedCategoryIds.has(cat.id) ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${selectedCategoryIds.has(cat.id) ? '#93c5fd' : '#e2e8f0'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.has(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      style={{ width: '1rem', height: '1rem', flexShrink: 0 }}
                    />
                    <span style={{ fontWeight: 500, color: '#334155' }}>{cat.name}</span>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleAssignSelected}
                  disabled={assigning || selectedCategoryIds.size === 0}
                  style={styleButton(true)}
                >
                  {assigning ? 'Asignando...' : `Asignar seleccionadas (${selectedCategoryIds.size})`}
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" onClick={handleClose} disabled={assigning || removing} style={styleButton(false)}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrinterPermission;
