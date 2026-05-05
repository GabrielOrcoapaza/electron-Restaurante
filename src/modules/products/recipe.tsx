import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_RECIPES_BY_PRODUCT, GET_PRODUCTS_WITH_STOCK } from '../../graphql/queries';
import { ADD_RECIPE, REMOVE_RECIPE } from '../../graphql/mutations';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface Recipe {
  id: string;
  quantity: number;
  unitMeasure?: string;
  notes?: string;
  product: {
    id: string;
    name: string;
    code: string;
  };
  ingredient: {
    id: string;
    name: string;
    code: string;
    unitMeasure?: string;
  };
}

interface Ingredient {
  id: string;
  name: string;
  code: string;
  unitMeasure?: string;
}

interface RecipeModalProps {
  productId: string;
  productName: string;
  productType?: string;
  onClose: () => void;
}

// Unidades de medida válidas en el backend (ProductsRecipeUnitMeasureChoices)
const UNIT_MEASURES: Array<[string, string]> = [
  ['NIU', 'Unidad'],
  ['KGM', 'Kilogramo'],
  ['LTR', 'Litro'],
];

const RecipeModal: React.FC<RecipeModalProps> = ({ productId, productName, productType, onClose }) => {
  const isDish = productType === 'DISH';
  const { companyData } = useAuth();
  const { showToast } = useToast();
  const branchId = companyData?.branch?.id;
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    ingredientId: '',
    quantity: '',
    unitMeasure: 'NIU',
    notes: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, loading, error, refetch } = useQuery(GET_RECIPES_BY_PRODUCT, {
    variables: { productId },
    fetchPolicy: 'network-only'
  });

  const { data: productsData } = useQuery(GET_PRODUCTS_WITH_STOCK, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'network-only'
  });

  const rawRecipes: Recipe[] = data?.recipesByProduct || [];
  const recipes = rawRecipes.filter((r): r is Recipe => Boolean(r && r.ingredient));

  const allProducts: any[] = productsData?.productsByBranch || [];
  const availableIngredients: Ingredient[] = allProducts
    .filter(p => p.productType === 'INGREDIENT' && p.isActive)
    .map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      unitMeasure: p.unitMeasure
    }));

  const ingredientIdsInRecipe = recipes.map(r => r.ingredient!.id);
  const filteredIngredients = availableIngredients.filter(
    ing => !ingredientIdsInRecipe.includes(ing.id)
  );

  const [addRecipe, { loading: addingRecipe }] = useMutation(ADD_RECIPE, {
    onCompleted: (data) => {
      if (data.addRecipe.success) {
        setMessage({ type: 'success', text: data.addRecipe.message });
        setFormData({ ingredientId: '', quantity: '', unitMeasure: 'NIU', notes: '' });
        setShowAddForm(false);
        refetch();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.addRecipe.message });
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message });
    },
  });

  const [removeRecipe, { loading: removingRecipe }] = useMutation(REMOVE_RECIPE, {
    onCompleted: (data) => {
      if (data.removeRecipe.success) {
        showToast(data.removeRecipe.message || 'Ingrediente eliminado de la receta', 'success');
        refetch();
      } else {
        showToast(data.removeRecipe.message || 'No se pudo eliminar el ingrediente', 'error');
      }
    },
    onError: (error) => {
      showToast(error.message || 'Error al eliminar el ingrediente', 'error');
    },
  });

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!formData.ingredientId || !formData.quantity) {
      setMessage({ type: 'error', text: 'Por favor completa todos los campos requeridos' });
      return;
    }

    const quantity = parseFloat(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      setMessage({ type: 'error', text: 'La cantidad debe ser un número mayor a 0' });
      return;
    }

    addRecipe({
      variables: {
        productId,
        ingredientId: formData.ingredientId,
        quantity: quantity,
        unitMeasure: formData.unitMeasure,
        notes: formData.notes || null
      }
    });
  };

  const handleRemoveIngredient = (recipeId: string) => {
    removeRecipe({ variables: { recipeId } });
  };

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300 dark:bg-slate-900"
        style={{ maxHeight: '90vh' }}
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800/50">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 md:text-2xl">
              Gestión de Receta
            </h2>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 uppercase tracking-tight">
                PRODUCTO
              </span>
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{productName}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6 scrollbar-hide">
          {/* Aviso: solo platos (DISH) pueden tener receta */}
          {!isDish && (
            <div className="mb-6 flex items-start gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm dark:border-rose-900/30 dark:bg-rose-950/20">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-black text-rose-900 dark:text-rose-300 uppercase tracking-wider text-[11px]">Restricción de Tipo</p>
                <p className="text-rose-700 dark:text-rose-400/80">
                  Solo se pueden agregar recetas a productos tipo <strong className="font-bold">Plato (DISH)</strong>. Edita el producto para cambiar su tipo si es necesario.
                </p>
              </div>
            </div>
          )}

          {/* Mensajes */}
          {message && (
            <div className={`mb-6 flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
              message.type === 'success' 
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400' 
                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400'
            }`}>
              <div className={`h-2 w-2 rounded-full ${message.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {message.text}
            </div>
          )}

          {/* Botón para agregar ingrediente */}
          {isDish && !showAddForm && filteredIngredients.length > 0 && (
            <div className="mb-6 flex justify-end">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Agregar Ingrediente
              </button>
            </div>
          )}

          {/* Formulario para agregar ingrediente */}
          {isDish && showAddForm && (
            <div className="mb-8 rounded-3xl border border-slate-200 bg-slate-50/50 p-6 animate-in fade-in slide-in-from-top-4 duration-300 dark:border-slate-800 dark:bg-slate-800/30">
              <h3 className="mb-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Nuevo Ingrediente en Receta
              </h3>
              <form onSubmit={handleAddIngredient} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Ingrediente *
                  </label>
                  <select
                    value={formData.ingredientId}
                    onChange={(e) => setFormData({ ...formData, ingredientId: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">Selecciona un ingrediente</option>
                    {filteredIngredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name} ({ingredient.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Cantidad *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      required
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Unidad de Medida *
                    </label>
                    <select
                      value={formData.unitMeasure}
                      onChange={(e) => setFormData({ ...formData, unitMeasure: e.target.value })}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {UNIT_MEASURES.map(([value, label]) => (
                        <option key={value} value={value}>{value} ({label})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Notas u Observaciones
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Ej: Solo la parte blanca, cortado en juliana..."
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setFormData({ ingredientId: '', quantity: '', unitMeasure: 'NIU', notes: '' });
                      setMessage(null);
                    }}
                    className="rounded-xl border border-slate-200 px-6 py-2.5 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={addingRecipe || filteredIngredients.length === 0}
                    className="flex min-w-[120px] items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white transition-all hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                  >
                    {addingRecipe ? (
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>Guardando...</span>
                      </div>
                    ) : (
                      'Guardar Ingrediente'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
              <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando Receta...</p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">
              <p className="font-bold">Error al cargar la receta</p>
              <p className="text-xs">{error.message}</p>
            </div>
          )}

          {!loading && !error && recipes.length === 0 && !showAddForm && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-200 dark:bg-slate-800/50 dark:text-slate-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Sin Ingredientes</h3>
              <p className="mt-1 max-w-[280px] text-xs font-medium text-slate-500 dark:text-slate-400">
                {filteredIngredients.length > 0 
                  ? 'Este producto aún no tiene una receta definida. Comienza agregando su primer ingrediente.'
                  : 'No hay ingredientes disponibles para agregar. Crea algunos primero en el inventario.'}
              </p>
            </div>
          )}

          {!loading && !error && recipes.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
                      <th className="px-6 py-4 text-center">Cod</th>
                      <th className="px-6 py-4">Ingrediente</th>
                      <th className="px-6 py-4 text-center">Cantidad</th>
                      <th className="px-6 py-4">Notas</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {recipes.map((recipe) => (
                      <tr key={recipe.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-4 text-center">
                          <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">{recipe.ingredient.code}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-700 dark:text-slate-200">{recipe.ingredient.name}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                            {recipe.quantity} {recipe.unitMeasure || recipe.ingredient.unitMeasure || 'NIU'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="max-w-[200px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {recipe.notes || '—'}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleRemoveIngredient(recipe.id)}
                            disabled={removingRecipe}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500 transition-all hover:bg-rose-100 hover:text-rose-600 disabled:opacity-50 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50/50 p-4 dark:bg-slate-800/30">
                <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Total: {recipes.length} ingredientes registrados
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-100 bg-slate-50/30 p-6 dark:border-slate-800/50 dark:bg-slate-800/10">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-8 py-2.5 text-sm font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cerrar Receta
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeModal;
export { RecipeModal };

