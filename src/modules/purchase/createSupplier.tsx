import React, { useState, useMemo } from 'react';
import { useLazyQuery, useMutation } from '@apollo/client';
import { SEARCH_PERSON_BY_DOCUMENT } from '../../graphql/queries';
import { CREATE_PERSON } from '../../graphql/mutations';

export type SupplierOption = {
  id: string;
  name: string;
  documentType?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  isSupplier: boolean;
  isActive: boolean;
};

type CreateSupplierModalProps = {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  suppliers: SupplierOption[];
  refetchSuppliers: () => void;
  onSuccess: (supplier: { id: string; name: string; documentType?: string; documentNumber?: string }) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
};

const CreateSupplierModal: React.FC<CreateSupplierModalProps> = ({
  isOpen,
  onClose,
  branchId,
  suppliers,
  refetchSuppliers,
  onSuccess,
  showToast = () => {}
}) => {
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierOption | null>(null);

  const [searchPersonByDocument, { loading: sunatSearchLoading }] = useLazyQuery(SEARCH_PERSON_BY_DOCUMENT, {
    fetchPolicy: 'network-only'
  });
  const [createPersonMutation] = useMutation(CREATE_PERSON);

  const filteredSuppliers = useMemo(() => {
    const list = suppliers.filter((s) => s.isActive !== false);
    if (!supplierSearchTerm.trim()) return list.slice(0, 50);
    const lower = supplierSearchTerm.toLowerCase().trim();
    return list.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(lower) ||
        (s.documentNumber || '').replace(/\s/g, '').includes(lower)
    ).slice(0, 50);
  }, [suppliers, supplierSearchTerm]);

  const handleSearchSunat = async () => {
    const term = (supplierSearchTerm || '').trim().replace(/\s/g, '');
    if (!/^\d+$/.test(term) || !branchId) {
      showToast('Ingrese DNI (8 dígitos) o RUC (11 dígitos) y pulse la lupa para buscar.', 'warning');
      return;
    }
    const isRuc = term.length === 11;
    const isDni = term.length === 8;
    if (!isRuc && !isDni) {
      showToast('Ingrese DNI (8 dígitos) o RUC (11 dígitos).', 'warning');
      return;
    }
    const documentType = isRuc ? 'RUC' : 'DNI';
    try {
      const { data } = await searchPersonByDocument({
        variables: { documentType, documentNumber: term, branchId }
      });
      const result = data?.searchPersonByDocument;
      if (!result?.person) {
        showToast('No se encontró el documento en SUNAT ni en el sistema.', 'error');
        return;
      }
      const person = result.person;
      if (person.isSupplier && person.id) {
        setSelectedSupplier({
          id: person.id,
          name: person.name || '',
          documentType: person.documentType || documentType,
          documentNumber: person.documentNumber || term,
          isSupplier: true,
          isActive: true
        });
        setSupplierSearchTerm(person.name || '');
        onSuccess({
          id: person.id,
          name: person.name || '',
          documentType: person.documentType || documentType,
          documentNumber: person.documentNumber || term
        });
        refetchSuppliers();
        onClose();
        return;
      }
      // Persona existe pero no es proveedor: actualizar con isSupplier=true (CreatePerson hace update si existe)
      const { data: createData } = await createPersonMutation({
        variables: {
          branchId,
          documentType: person.documentType || documentType,
          documentNumber: person.documentNumber || term,
          name: person.name || (documentType === 'RUC' ? 'Proveedor' : 'Proveedor'),
          address: person.address || undefined,
          phone: person.phone || undefined,
          email: person.email || undefined,
          isCustomer: false,
          isSupplier: true
        }
      });
      if (createData?.createPerson?.success && createData?.createPerson?.person) {
        const newPerson = createData.createPerson.person;
        showToast(createData.createPerson.message || 'Proveedor registrado.', 'success');
        onSuccess({
          id: newPerson.id,
          name: newPerson.name || '',
          documentType: newPerson.documentType || documentType,
          documentNumber: newPerson.documentNumber || term
        });
        refetchSuppliers();
        onClose();
      } else {
        showToast(createData?.createPerson?.message || 'Error al registrar el proveedor.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error al buscar en SUNAT.', 'error');
    }
  };

  const handleSelectSupplier = (supplier: SupplierOption) => {
    setSelectedSupplier(supplier);
    setSupplierSearchTerm(supplier.name || '');
    onSuccess({
      id: supplier.id,
      name: supplier.name || '',
      documentType: supplier.documentType,
      documentNumber: supplier.documentNumber
    });
    refetchSuppliers();
    onClose();
  };

  const handleConfirmCreate = () => {
    const term = (supplierSearchTerm || '').trim().replace(/\s/g, '');
    const validDoc = /^\d{8}$/.test(term) || /^\d{11}$/.test(term);
    if (validDoc) {
      handleSearchSunat();
    } else {
      showToast('Ingrese DNI (8 dígitos) o RUC (11 dígitos) y pulse la lupa para buscar en SUNAT.', 'warning');
    }
  };

  if (!isOpen) return null;

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
          padding: '1.25rem',
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
            Crear o buscar proveedor
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '500', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
              Buscar por nombre o documento
            </label>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: '0.35rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  overflow: 'hidden'
                }}
              >
                <input
                  type="text"
                  value={supplierSearchTerm}
                  onChange={(e) => {
                    setSupplierSearchTerm(e.target.value);
                    setSelectedSupplier(null);
                  }}
                  placeholder="Nombre, DNI (8) o RUC (11)..."
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    border: 'none',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={handleConfirmCreate}
                  disabled={sunatSearchLoading}
                  title="Buscar en SUNAT"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 0.75rem',
                    border: 'none',
                    background: sunatSearchLoading ? '#e2e8f0' : '#0d9488',
                    color: 'white',
                    cursor: sunatSearchLoading ? 'not-allowed' : 'pointer',
                    opacity: sunatSearchLoading ? 0.7 : 1
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </button>
              </div>
              {supplierSearchTerm && !selectedSupplier && filteredSuppliers.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.25rem',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
                    zIndex: 10
                  }}
                >
                  {filteredSuppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      onClick={() => handleSelectSupplier(supplier)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '0.875rem'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#334155' }}>{supplier.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {supplier.documentType}: {supplier.documentNumber}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {supplierSearchTerm && !selectedSupplier && filteredSuppliers.length === 0 && (
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                  No hay proveedores que coincidan. Ingrese DNI (8 dígitos) o RUC (11) y pulse la lupa para buscar en SUNAT.
                </div>
              )}
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
            Escriba nombre o documento para filtrar la lista, o ingrese solo DNI/RUC y use la lupa para buscar en SUNAT y registrar como proveedor.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreateSupplierModal;
