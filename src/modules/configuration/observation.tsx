import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_SUBCATEGORIES_WITH_MODIFIERS } from '../../graphql/queries';
import { CREATE_MODIFIER, UPDATE_MODIFIER, DELETE_MODIFIER } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';

interface Category {
  id: string;
  name: string;
  isActive?: boolean;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
  notes?: Modifier[];
  categoryName?: string;
  categoryId?: string;
}

interface Modifier {
  id: string;
  note: string;
  isActive: boolean;
}

const Observation: React.FC = () => {
  const { companyData } = useAuth();
  const { breakpoint } = useResponsive();
  const branchId = companyData?.branch?.id;

  // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
  const isSmall = breakpoint === 'sm'; // 640px - 767px
  const isMedium = breakpoint === 'md'; // 768px - 1023px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  
  // Tamaños adaptativos
  const cardPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : '1.5rem';

  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');
  const [formData, setFormData] = useState({
    note: '',
    isActive: true,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Query para obtener categorías y subcategorías (siempre del servidor, no caché)
  const { data, loading, error, refetch } = useQuery(GET_SUBCATEGORIES_WITH_MODIFIERS, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only',
  });

  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null);
  const [editModifierForm, setEditModifierForm] = useState({ note: '', isActive: true });
  const [deletingModifierId, setDeletingModifierId] = useState<string | null>(null);

  // Mutación para crear modificador
  const [createModifier, { loading: creating }] = useMutation(CREATE_MODIFIER, {
    onCompleted: (data) => {
      if (data.createModifier.success) {
        setMessage({ type: 'success', text: data.createModifier.message });
        setFormData({ note: '', isActive: true });
        refetch();
      } else {
        setMessage({ type: 'error', text: data.createModifier.message });
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message });
    },
  });

  const [updateModifier, { loading: updatingModifier }] = useMutation(UPDATE_MODIFIER, {
    onCompleted: (res) => {
      const result = res?.updateModifier;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message || 'Observación actualizada' });
        setEditingModifier(null);
        refetch();
      } else {
        setMessage({ type: 'error', text: result?.message || 'No se pudo actualizar' });
      }
    },
    onError: (err) => setMessage({ type: 'error', text: err.message }),
  });

  const [deleteModifier] = useMutation(DELETE_MODIFIER, {
    onCompleted: (res) => {
      const result = res?.deleteModifier;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message || 'Observación eliminada' });
        setDeletingModifierId(null);
        refetch();
      } else {
        setMessage({ type: 'error', text: result?.message || 'No se pudo eliminar' });
      }
    },
    onError: (err) => setMessage({ type: 'error', text: err.message }),
  });

  const categories: Category[] = data?.categoriesByBranch || [];
  
  // Obtener todas las subcategorías activas de todas las categorías
  const allSubcategories = categories
    .filter(cat => cat.isActive ?? true)
    .flatMap(cat => 
      (cat.subcategories || [])
        .filter(sub => sub.isActive)
        .map(sub => ({
          ...sub,
          categoryName: cat.name,
          categoryId: cat.id
        }))
    );

  // Encontrar la subcategoría seleccionada
  const selectedSubcategory = allSubcategories.find(sub => sub.id === selectedSubcategoryId);
  const existingModifiers = selectedSubcategory?.notes || [];

  const handleSubcategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubcategoryId(e.target.value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubcategoryId) {
      setMessage({ type: 'error', text: 'Por favor selecciona una subcategoría' });
      return;
    }
    if (!formData.note.trim()) {
      setMessage({ type: 'error', text: 'Por favor ingresa una observación' });
      return;
    }
    setMessage(null);
    createModifier({
      variables: {
        subcategoryId: selectedSubcategoryId,
        note: formData.note.trim(),
        isActive: formData.isActive,
      },
    });
  };

  if (loading) {
    return (
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: cardPadding,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          color: '#64748b'
        }}
      >
        Cargando subcategorías...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '12px',
          padding: cardPadding,
          color: '#991b1b'
        }}
      >
        Error al cargar los datos: {error.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-1 transition-colors duration-200 md:p-0">
      {/* Header Section */}
      <div className="flex flex-col gap-1 px-2 md:px-0">
        <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 md:text-2xl">
          Gestión de Observaciones
        </h1>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 md:text-sm">
          Administra las notas rápidas y modificadores para cada subcategoría de productos.
        </p>
      </div>

      {/* Main Form Card */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/30">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Configurar Observación</h3>
        </div>

        <div className="p-6">
          {message && (
            <div
              className={`mb-6 flex items-center gap-3 rounded-xl border p-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
                message.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400'
                  : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400'
              }`}
            >
              <div className={`h-2 w-2 rounded-full ${message.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Subcategoría Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Subcategoría *</label>
                <select
                  id="subcategoryId"
                  name="subcategoryId"
                  value={selectedSubcategoryId}
                  onChange={handleSubcategoryChange}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">Seleccionar subcategoría</option>
                  {allSubcategories.map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.categoryName} - {subcategory.name}
                    </option>
                  ))}
                </select>
                {allSubcategories.length === 0 && (
                  <p className="text-[10px] font-bold text-amber-500 dark:text-amber-400">
                    No hay subcategorías activas disponibles.
                  </p>
                )}
              </div>

              {/* Input de Observación */}
              <div className={`flex flex-col gap-2 transition-all duration-300 ${selectedSubcategoryId ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Observación (Texto) *</label>
                <input
                  type="text"
                  name="note"
                  value={formData.note}
                  onChange={handleInputChange}
                  placeholder="Ej: Sin cebolla, Extra salsa, Caliente..."
                  maxLength={100}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Status and Action Row */}
            {selectedSubcategoryId && (
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6 animate-in fade-in slide-in-from-bottom-2 dark:border-slate-800">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/50">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Observación Activa</span>
                </label>

                <button
                  type="submit"
                  disabled={creating || !formData.note.trim()}
                  className={`flex min-w-[200px] items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black uppercase tracking-widest text-white transition-all shadow-lg ${
                    creating || !formData.note.trim()
                    ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none' 
                    : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-indigo-600/30 active:translate-y-0'
                  }`}
                >
                  {creating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span>Procesando...</span>
                    </>
                  ) : 'Crear Observación'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Existing Observations Section */}
      {selectedSubcategoryId && selectedSubcategory && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm animate-in fade-in zoom-in-95 duration-300 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/30">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Observaciones de <span className="text-indigo-600 dark:text-indigo-400">"{selectedSubcategory.name}"</span>
            </h3>
          </div>

          <div className="p-0">
            {existingModifiers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium">Esta subcategoría no tiene observaciones registradas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-800/20">
                      <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">Nota / Observación</th>
                      <th className="px-6 py-4 text-center font-bold text-slate-500 dark:text-slate-400">Estado</th>
                      <th className="px-6 py-4 text-right font-bold text-slate-500 dark:text-slate-400">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {existingModifiers.map((modifier) => (
                      <tr 
                        key={modifier.id} 
                        className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800 dark:text-slate-100">{modifier.note}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                              modifier.isActive 
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                            }`}
                          >
                            <div className={`h-1.5 w-1.5 rounded-full ${modifier.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {modifier.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingModifier(modifier);
                                setEditModifierForm({ note: modifier.note, isActive: modifier.isActive });
                                setMessage(null);
                              }}
                              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-all hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-indigo-600 dark:hover:text-white"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingModifierId(modifier.id)}
                              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-rose-600 transition-all hover:bg-rose-600 hover:text-white dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-600 dark:hover:text-white"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Editar Observación */}
      {editingModifier && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all animate-in fade-in duration-200"
          onClick={() => setEditingModifier(null)}
        >
          <div 
            className="relative flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-colors duration-200 dark:border-slate-800 dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Editar Observación</h3>
              <button
                type="button"
                onClick={() => setEditingModifier(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateModifier({
                    variables: {
                      modifierId: editingModifier.id,
                      note: editModifierForm.note.trim(),
                      isActive: editModifierForm.isActive,
                    },
                  });
                }}
                className="flex flex-col gap-6"
              >
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Texto de Observación</label>
                  <input
                    value={editModifierForm.note}
                    onChange={(e) => setEditModifierForm((p) => ({ ...p, note: e.target.value }))}
                    placeholder="Observación"
                    required
                    maxLength={100}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/50">
                  <input 
                    type="checkbox" 
                    checked={editModifierForm.isActive} 
                    onChange={(e) => setEditModifierForm((p) => ({ ...p, isActive: e.target.checked }))} 
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Activo</span>
                </label>

                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setEditingModifier(null)} 
                    className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={updatingModifier || !editModifierForm.note.trim()} 
                    className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black uppercase tracking-widest text-white transition-all shadow-lg ${
                      updatingModifier || !editModifierForm.note.trim()
                      ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none' 
                      : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-indigo-600/30 active:translate-y-0'
                    }`}
                  >
                    {updatingModifier ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar Observación */}
      {deletingModifierId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all animate-in fade-in duration-200"
          onClick={() => setDeletingModifierId(null)}
        >
          <div 
            className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-colors duration-200 dark:border-slate-800 dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-900/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">¿Eliminar observación?</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Esta acción no se puede deshacer y la nota ya no estará disponible para los pedidos.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => setDeletingModifierId(null)} 
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteModifier({ variables: { modifierId: deletingModifierId } })}
                className="flex-1 rounded-2xl bg-rose-600 py-3.5 text-sm font-black uppercase tracking-widest text-white transition-all shadow-lg shadow-rose-600/30 hover:bg-rose-700 hover:-translate-y-0.5 active:translate-y-0"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Observation;
