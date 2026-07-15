import React, { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_CATEGORIES_BY_BRANCH } from '../../graphql/queries';
import { CREATE_SUBCATEGORY, UPDATE_SUBCATEGORY } from '../../graphql/mutations';
import { SUBCATEGORY_ICONS } from '../../constants/categoryIcons';
import CategoryIcon from '../../components/CategoryIcon';
import SubcategoryList from './subcategoryList';

interface Subcategory {
  id: string;
  name: string;
  description?: string;
  order?: number;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  isActive: boolean;
  subcategories?: Subcategory[];
}

const Subcategory: React.FC = () => {
  const { companyData } = useAuth();
  const branchId = companyData?.branch?.id;

  const [formData, setFormData] = useState({
    categoryId: '',
    name: '',
    description: '',
    icon: 'category',
    color: '#3b82f6',
    order: 0,
    isActive: true,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingRow, setEditingRow] = useState<{ id: string; categoryId: string; categoryName: string; name: string; description?: string; icon?: string; color?: string; order?: number; isActive: boolean } | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', description: '', icon: 'category', color: '#3b82f6', order: 0, isActive: true });

  const { data, refetch } = useQuery(GET_CATEGORIES_BY_BRANCH, {
    variables: { branchId: branchId!, includeInactive: true },
    skip: !branchId,
    fetchPolicy: 'network-only',
  });

  const [createSubcategory, { loading: creating }] = useMutation(CREATE_SUBCATEGORY, {
    onCompleted: (res) => {
      const result = res?.createSubcategory;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message || 'Subcategoría creada exitosamente' });
        setFormData((prev) => ({
          ...prev,
          name: '',
          description: '',
          icon: 'category',
          color: '#3b82f6',
          order: 0,
          isActive: true,
        }));
        refetch();
      } else {
        setMessage({ type: 'error', text: result?.message || 'No se pudo crear la subcategoría' });
      }
    },
    onError: (mutationError) => {
      setMessage({ type: 'error', text: mutationError.message });
    },
  });

  const [updateSubcategory, { loading: updating }] = useMutation(UPDATE_SUBCATEGORY, {
    onCompleted: (res) => {
      const result = res?.updateSubcategory;
      if (result?.success) {
        setMessage({ type: 'success', text: result.message || 'Subcategoría actualizada' });
        setEditingRow(null);
        refetch();
      } else {
        setMessage({ type: 'error', text: result?.message || 'No se pudo actualizar' });
      }
    },
    onError: (mutationError) => {
      setMessage({ type: 'error', text: mutationError.message });
    },
  });

  const categories: Category[] = data?.categoriesByBranch || [];
  const activeCategories = categories.filter((category) => category.isActive);

  const duplicateActiveCategoryNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of activeCategories) {
      const k = c.name.trim().toLowerCase();
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const dups = new Set<string>();
    counts.forEach((n, k) => {
      if (n > 1) dups.add(k);
    });
    return dups;
  }, [activeCategories]);

  const formatCategoryOptionLabel = (c: Category) =>
    duplicateActiveCategoryNames.has(c.name.trim().toLowerCase())
      ? `${c.name} · ${String(c.id).slice(-6)}`
      : c.name;

  return (
    <div className="flex flex-col gap-6 p-1 transition-colors duration-200 md:p-0">
      {/* Crear Subcategoría Card */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/30">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Crear Nueva Subcategoría</h3>
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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setMessage(null);
              createSubcategory({
                variables: {
                  categoryId: formData.categoryId,
                  name: formData.name.trim(),
                  description: formData.description.trim() || null,
                  icon: formData.icon || null,
                  color: formData.color || null,
                  order: Number(formData.order) || 0,
                  isActive: formData.isActive,
                },
              });
            }}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {/* Categoría Padre */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Categoría Padre *</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData((prev) => ({ ...prev, categoryId: e.target.value }))}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Seleccionar categoría</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {formatCategoryOptionLabel(category)}
                  </option>
                ))}
              </select>
            </div>

            {/* Nombre */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Nombre de Subcategoría *</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Jugos, Entradas Frías..."
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
              <p className="text-[10px] leading-tight text-slate-400 dark:text-slate-500">
                Puede coincidir con nombres de otras categorías.
              </p>
            </div>

            {/* Descripción */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Descripción (opcional)</label>
              <input
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción de la subcategoría"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Icono Picker */}
            <div className="flex flex-col gap-2 lg:col-span-1 lg:row-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Seleccionar Icono</label>
              <div className="grid h-[140px] grid-cols-5 gap-2 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/50 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                {SUBCATEGORY_ICONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, icon: opt.id }))}
                    title={opt.label}
                    className={`flex items-center justify-center rounded-xl p-2 transition-all ${
                      formData.icon === opt.id
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none'
                        : 'bg-white text-slate-400 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-600 dark:hover:bg-slate-800'
                    }`}
                  >
                    <CategoryIcon iconId={opt.id} type="subcategory" size="1.25rem" />
                  </button>
                ))}
              </div>
            </div>

            {/* Color, Orden y Estado */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-2">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Color de Etiqueta</label>
                <div className="flex items-center gap-3">
                  <div 
                    className="h-10 w-10 rounded-xl border-2 border-white shadow-sm ring-1 ring-slate-200 dark:border-slate-800 dark:ring-slate-700"
                    style={{ backgroundColor: formData.color }}
                  />
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                    className="h-10 w-24 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 transition-all focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Orden de Visualización</label>
                <input
                  type="number"
                  min={0}
                  value={formData.order}
                  onChange={(e) => setFormData((prev) => ({ ...prev, order: Number(e.target.value) || 0 }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <label className="flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/50">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                />
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Subcategoría Activa</span>
              </label>

              <button
                type="submit"
                disabled={creating || !formData.categoryId || !formData.name.trim()}
                className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black uppercase tracking-widest text-white transition-all shadow-lg ${
                  creating || !formData.categoryId || !formData.name.trim()
                  ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none' 
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-indigo-600/30 active:translate-y-0'
                }`}
              >
                {creating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>Creando...</span>
                  </>
                ) : 'Crear Subcategoría'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Lista de Subcategorías */}
      <SubcategoryList
        categories={categories}
        onEdit={(row) => {
          setEditingRow({ 
            id: row.id, 
            categoryId: row.categoryId, 
            categoryName: row.categoryName, 
            name: row.name, 
            description: row.description, 
            icon: row.icon, 
            color: row.color, 
            order: row.order ?? 0, 
            isActive: row.isActive 
          });
          setEditFormData({ 
            name: row.name, 
            description: row.description || '', 
            icon: row.icon || 'category', 
            color: row.color || '#3b82f6', 
            order: row.order ?? 0, 
            isActive: row.isActive 
          });
          setMessage(null);
        }}
      />

      {/* Modal Editar Subcategoría */}
      {editingRow && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all animate-in fade-in duration-200"
          onClick={() => setEditingRow(null)}
        >
          <div 
            className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-colors duration-200 dark:border-slate-800 dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Editar Subcategoría</h3>
                <span className="text-[10px] font-bold uppercase text-slate-400">Padre: {editingRow.categoryName}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateSubcategory({
                    variables: {
                      subcategoryId: editingRow.id,
                      name: editFormData.name.trim(),
                      description: editFormData.description.trim() || null,
                      icon: editFormData.icon || null,
                      color: editFormData.color || null,
                      order: editFormData.order,
                      isActive: editFormData.isActive,
                    },
                  });
                }}
                className="flex flex-col gap-6"
              >
                {/* Nombre */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Nombre</label>
                  <input
                    value={editFormData.name}
                    onChange={(e) => setEditFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nombre"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Descripción */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Descripción (opcional)</label>
                  <input
                    value={editFormData.description}
                    onChange={(e) => setEditFormData((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Descripción"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Icon Picker */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Icono</label>
                  <div className="grid grid-cols-6 gap-2 max-h-[120px] overflow-y-auto rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/50">
                    {SUBCATEGORY_ICONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEditFormData((p) => ({ ...p, icon: opt.id }))}
                        className={`flex items-center justify-center rounded-lg p-2 transition-all ${
                          editFormData.icon === opt.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-400 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-600 dark:hover:bg-slate-700'
                        }`}
                      >
                        <CategoryIcon iconId={opt.id} type="subcategory" size="1.25rem" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color and Order Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Color</label>
                    <input
                      type="color"
                      value={editFormData.color}
                      onChange={(e) => setEditFormData((p) => ({ ...p, color: e.target.value }))}
                      className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Orden</label>
                    <input
                      type="number"
                      min={0}
                      value={editFormData.order}
                      onChange={(e) => setEditFormData((p) => ({ ...p, order: Number(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 outline-none transition-all dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Estado Checkbox */}
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/50">
                  <input 
                    type="checkbox" 
                    checked={editFormData.isActive} 
                    onChange={(e) => setEditFormData((p) => ({ ...p, isActive: e.target.checked }))} 
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Activa</span>
                </label>

                {/* Footer Buttons */}
                <div className="mt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setEditingRow(null)} 
                    className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={updating || !editFormData.name.trim()} 
                    className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black uppercase tracking-widest text-white transition-all shadow-lg ${
                      updating || !editFormData.name.trim()
                      ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none' 
                      : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-indigo-600/30 active:translate-y-0'
                    }`}
                  >
                    {updating ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>Guardando...</span>
                      </>
                    ) : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subcategory;
