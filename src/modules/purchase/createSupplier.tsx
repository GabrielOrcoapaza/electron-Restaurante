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
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800/50">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
              Registrar Proveedor
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Búsqueda en sistema o consulta SUNAT
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Nombre o Documento (DNI/RUC)
              </label>
              <div className="relative">
                <div className="flex items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800">
                  <input
                    type="text"
                    value={supplierSearchTerm}
                    onChange={(e) => {
                      setSupplierSearchTerm(e.target.value);
                      setSelectedSupplier(null);
                    }}
                    placeholder="DNI (8), RUC (11) o nombre..."
                    className="flex-1 bg-transparent px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmCreate}
                    disabled={sunatSearchLoading}
                    title="Buscar en SUNAT"
                    className="flex items-center justify-center bg-indigo-600 px-4 text-white transition-all hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                  >
                    {sunatSearchLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Dropdown de resultados */}
                {supplierSearchTerm && !selectedSupplier && filteredSuppliers.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-[12000] mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl animate-in fade-in slide-in-from-top-2 dark:border-slate-800 dark:bg-slate-900">
                    {filteredSuppliers.map((supplier) => (
                      <button
                        key={supplier.id}
                        onClick={() => handleSelectSupplier(supplier)}
                        className="flex w-full flex-col gap-0.5 rounded-xl p-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {supplier.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400">
                            {supplier.documentType}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400">
                            {supplier.documentNumber}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {supplierSearchTerm && !selectedSupplier && filteredSuppliers.length === 0 && (
                <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    No hay coincidencias locales
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Use la lupa para consultar en SUNAT si el documento es válido.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-indigo-50/50 p-4 dark:bg-indigo-900/10">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-[11px] leading-relaxed text-indigo-700 dark:text-indigo-400">
                Al buscar un documento que no existe, el sistema consultará con <strong>SUNAT</strong> y lo registrará automáticamente como proveedor si la búsqueda es exitosa.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-slate-100 bg-slate-50/30 p-6 dark:border-slate-800/50 dark:bg-slate-800/10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleConfirmCreate}
            disabled={sunatSearchLoading || !supplierSearchTerm.trim()}
            className="flex-1 rounded-2xl bg-indigo-600 py-3 text-sm font-black text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-95 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
          >
            {sunatSearchLoading ? 'Buscando...' : 'Buscar / Crear'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSupplierModal;

