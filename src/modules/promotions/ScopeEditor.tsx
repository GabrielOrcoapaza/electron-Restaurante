import React from 'react';
import ProductSearchInput from '../../components/ProductSearchInput';
import type { ScopeFormItem } from '../../types/promotions';

interface CategoryOption {
    id: string;
    name: string;
    subcategories?: { id: string; name: string; isActive: boolean }[];
}

interface ScopeEditorProps {
    branchId: string;
    scopes: ScopeFormItem[];
    onChange: (scopes: ScopeFormItem[]) => void;
    categories: CategoryOption[];
}

const emptyScope = (): ScopeFormItem => ({
    label: '',
    scopeLabel: '',
    requiredQuantity: 1,
    scopeType: 'subcategory',
    subcategoryId: '',
    categoryId: '',
    productId: '',
});

const ScopeEditor: React.FC<ScopeEditorProps> = ({
    branchId,
    scopes,
    onChange,
    categories,
}) => {
    const updateScope = (index: number, patch: Partial<ScopeFormItem>) => {
        onChange(
            scopes.map((scope, i) => (i === index ? { ...scope, ...patch } : scope)),
        );
    };

    const removeScope = (index: number) => {
        onChange(scopes.filter((_, i) => i !== index));
    };

    const allSubcategories = categories.flatMap((cat) =>
        (cat.subcategories || [])
            .filter((sub) => sub.isActive)
            .map((sub) => ({ ...sub, categoryId: cat.id, categoryName: cat.name })),
    );

    return (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Scopes del combo
                </h4>
                <button
                    type="button"
                    onClick={() => onChange([...scopes, emptyScope()])}
                    className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-500"
                >
                    + Agregar scope
                </button>
            </div>

            {scopes.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Agrega al menos un scope para definir las opciones del combo.
                </p>
            )}

            {scopes.map((scope, index) => (
                <div
                    key={scope.id || `scope-${index}`}
                    className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900"
                >
                    <div className="grid gap-3 md:grid-cols-2">
                        <label className="block text-xs">
                            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                                Etiqueta
                            </span>
                            <input
                                value={scope.label}
                                onChange={(e) =>
                                    updateScope(index, { label: e.target.value })
                                }
                                placeholder="Ej: Entrada"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                            />
                        </label>
                        <label className="block text-xs">
                            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                                Texto de elección
                            </span>
                            <input
                                value={scope.scopeLabel}
                                onChange={(e) =>
                                    updateScope(index, { scopeLabel: e.target.value })
                                }
                                placeholder="Ej: Elige tu entrada"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                            />
                        </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                        <label className="block text-xs">
                            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                                Cantidad
                            </span>
                            <input
                                type="number"
                                min={1}
                                value={scope.requiredQuantity}
                                onChange={(e) =>
                                    updateScope(index, {
                                        requiredQuantity:
                                            parseInt(e.target.value, 10) || 1,
                                    })
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                            />
                        </label>
                        <label className="block text-xs md:col-span-2">
                            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                                Tipo de scope
                            </span>
                            <select
                                value={scope.scopeType}
                                onChange={(e) =>
                                    updateScope(index, {
                                        scopeType: e.target
                                            .value as ScopeFormItem['scopeType'],
                                        subcategoryId: '',
                                        categoryId: '',
                                        productId: '',
                                        productName: '',
                                    })
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                            >
                                <option value="subcategory">Subcategoría</option>
                                <option value="category">Categoría</option>
                                <option value="product">Producto fijo</option>
                            </select>
                        </label>
                    </div>

                    {scope.scopeType === 'subcategory' && (
                        <label className="block text-xs">
                            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                                Subcategoría
                            </span>
                            <select
                                value={scope.subcategoryId || ''}
                                onChange={(e) =>
                                    updateScope(index, {
                                        subcategoryId: e.target.value,
                                    })
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                            >
                                <option value="">Seleccionar...</option>
                                {allSubcategories.map((sub) => (
                                    <option key={sub.id} value={sub.id}>
                                        {sub.categoryName} / {sub.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {scope.scopeType === 'category' && (
                        <label className="block text-xs">
                            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                                Categoría
                            </span>
                            <select
                                value={scope.categoryId || ''}
                                onChange={(e) =>
                                    updateScope(index, { categoryId: e.target.value })
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                            >
                                <option value="">Seleccionar...</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {scope.scopeType === 'product' && (
                        <div className="block text-xs">
                            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                                Producto fijo
                            </span>
                            <ProductSearchInput
                                branchId={branchId}
                                selectedProductId={scope.productId}
                                selectedProductName={scope.productName}
                                compact
                                placeholder="Buscar producto o escanear código"
                                onSelect={(product) =>
                                    updateScope(index, {
                                        productId: product.id,
                                        productName: product.name,
                                    })
                                }
                                onClear={() =>
                                    updateScope(index, {
                                        productId: '',
                                        productName: '',
                                    })
                                }
                            />
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={() => removeScope(index)}
                            className="text-xs font-semibold text-red-500 hover:text-red-400"
                        >
                            Eliminar scope
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ScopeEditor;
