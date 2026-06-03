import React, { useEffect, useRef, useState } from 'react';
import { useLazyQuery, useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_CATEGORIES_BY_BRANCH, SEARCH_PRODUCTS } from '../../graphql/queries';
import ScopeEditor from './ScopeEditor';
import { promotionPhotoSrc } from './promotionFormHelpers';
import {
    DAY_LABELS,
    PROMOTION_TYPE_LABELS,
    emptyPromotionForm,
    type PromotionFormData,
    type PromotionTypeValue,
} from '../../types/promotions';

interface PromotionFormProps {
    initialData?: PromotionFormData;
    defaultType?: PromotionTypeValue;
    onSubmit: (formData: PromotionFormData) => Promise<void>;
    onCancel: () => void;
    loading?: boolean;
    submitLabel: string;
}

const fieldClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

const PromotionForm: React.FC<PromotionFormProps> = ({
    initialData,
    defaultType = 'COMBO',
    onSubmit,
    onCancel,
    loading = false,
    submitLabel,
}) => {
    const { companyData } = useAuth();
    const branchId = companyData?.branch?.id;
    const [formData, setFormData] = useState<PromotionFormData>(
        initialData || emptyPromotionForm(defaultType),
    );
    const [giftSearch, setGiftSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [newPhotoBase64, setNewPhotoBase64] = useState<string | null>(null);
    const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
    const [photoRemoved, setPhotoRemoved] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);

    const existingPhotoSrc =
        formData.existingPhoto && !photoRemoved
            ? promotionPhotoSrc(formData.existingPhoto)
            : null;
    const displayPhotoSrc = newPhotoPreview ?? existingPhotoSrc;

    const { data: categoriesData } = useQuery(GET_CATEGORIES_BY_BRANCH, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: 'network-only',
    });

    const [searchProducts, { data: searchData }] = useLazyQuery(SEARCH_PRODUCTS, {
        fetchPolicy: 'network-only',
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
            setNewPhotoBase64(null);
            setNewPhotoPreview(null);
            setPhotoRemoved(false);
            if (photoInputRef.current) photoInputRef.current.value = '';
        }
    }, [initialData]);

    useEffect(() => {
        if (!branchId || giftSearch.trim().length < 2) return;
        const timer = setTimeout(() => {
            searchProducts({
                variables: {
                    branchId,
                    search: giftSearch.trim(),
                    limit: 8,
                },
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [giftSearch, branchId, searchProducts]);

    const categories = categoriesData?.categoriesByBranch || [];
    const giftResults = searchData?.searchProducts || [];

    const patch = (patchData: Partial<PromotionFormData>) => {
        setFormData((prev) => ({ ...prev, ...patchData }));
    };

    const toggleDay = (day: number) => {
        setFormData((prev) => ({
            ...prev,
            daysOfWeek: prev.daysOfWeek.includes(day)
                ? prev.daysOfWeek.filter((d) => d !== day)
                : [...prev.daysOfWeek, day],
        }));
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('El archivo debe ser una imagen.');
            e.target.value = '';
            return;
        }
        if (file.size > MAX_PHOTO_BYTES) {
            setError('La imagen no debe superar 3 MB.');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const comma = dataUrl.indexOf(',');
            const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
            setNewPhotoBase64(b64);
            setNewPhotoPreview(dataUrl);
            setPhotoRemoved(false);
            setError(null);
        };
        reader.readAsDataURL(file);
    };

    const handleClearPhoto = () => {
        if (newPhotoBase64 !== null) {
            setNewPhotoBase64(null);
            setNewPhotoPreview(null);
            if (photoInputRef.current) photoInputRef.current.value = '';
            return;
        }
        if (formData.existingPhoto) {
            setPhotoRemoved(true);
        }
        if (photoInputRef.current) photoInputRef.current.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await onSubmit({
                ...formData,
                photoBase64: newPhotoBase64,
                photoRemoved,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        }
    };

    const showScopes =
        formData.promotionType === 'COMBO' || formData.appliesTo !== 'ALL';

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
                    {error}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm md:col-span-2">
                    <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                        Nombre *
                    </span>
                    <input
                        value={formData.name}
                        onChange={(e) => patch({ name: e.target.value })}
                        className={fieldClass}
                        placeholder="Ej: Menú Ejecutivo"
                        required
                    />
                </label>

                <label className="block text-sm md:col-span-2">
                    <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                        Descripción
                    </span>
                    <textarea
                        value={formData.description}
                        onChange={(e) => patch({ description: e.target.value })}
                        className={fieldClass}
                        rows={2}
                    />
                </label>

                <div className="block text-sm md:col-span-2">
                    <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                        Foto (opcional, para pantalla TV)
                    </span>
                    <div className="flex flex-wrap items-start gap-3">
                        {displayPhotoSrc && (
                            <img
                                src={displayPhotoSrc}
                                alt="Vista previa promoción"
                                className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-600"
                            />
                        )}
                        <div className="min-w-[160px] flex-1">
                            <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={handlePhotoChange}
                                className={fieldClass}
                            />
                            <p className="mt-1 text-xs text-slate-400">
                                JPG, PNG, WebP o GIF. Máx. 3 MB.
                            </p>
                        </div>
                        {displayPhotoSrc && (
                            <button
                                type="button"
                                onClick={handleClearPhoto}
                                className="self-center rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                                Quitar foto
                            </button>
                        )}
                    </div>
                </div>

                <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                        Tipo *
                    </span>
                    <select
                        value={formData.promotionType}
                        onChange={(e) =>
                            patch({
                                promotionType: e.target.value as PromotionTypeValue,
                            })
                        }
                        className={fieldClass}
                    >
                        {Object.entries(PROMOTION_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex items-center gap-2 self-end text-sm">
                    <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => patch({ isActive: e.target.checked })}
                    />
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                        Activa
                    </span>
                </label>

                <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                        Válida desde *
                    </span>
                    <input
                        type="date"
                        value={formData.validFrom}
                        onChange={(e) => patch({ validFrom: e.target.value })}
                        className={fieldClass}
                        required
                    />
                </label>

                <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                        Válida hasta
                    </span>
                    <input
                        type="date"
                        value={formData.validTo}
                        onChange={(e) => patch({ validTo: e.target.value })}
                        className={fieldClass}
                    />
                </label>

                <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                        Hora inicio
                    </span>
                    <input
                        type="time"
                        value={formData.timeFrom}
                        onChange={(e) => patch({ timeFrom: e.target.value })}
                        className={fieldClass}
                    />
                </label>

                <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                        Hora fin
                    </span>
                    <input
                        type="time"
                        value={formData.timeTo}
                        onChange={(e) => patch({ timeTo: e.target.value })}
                        className={fieldClass}
                    />
                </label>

                <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">
                        Prioridad
                    </span>
                    <input
                        type="number"
                        value={formData.priority}
                        onChange={(e) => patch({ priority: e.target.value })}
                        className={fieldClass}
                        placeholder="Mayor = primero"
                    />
                </label>
            </div>

            <div>
                <span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
                    Días de la semana
                </span>
                <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map((day) => {
                        const active = formData.daysOfWeek.includes(day.value);
                        return (
                            <button
                                key={day.value}
                                type="button"
                                onClick={() => toggleDay(day.value)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    active
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                }`}
                            >
                                {day.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {formData.promotionType === 'DISCOUNT_PERCENT' && (
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm">
                        <span className="mb-1 block font-medium">% Descuento *</span>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            value={formData.discountPercent}
                            onChange={(e) =>
                                patch({ discountPercent: e.target.value })
                            }
                            className={fieldClass}
                        />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-1 block font-medium">
                            Monto mínimo de compra
                        </span>
                        <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={formData.minPurchaseAmount}
                            onChange={(e) =>
                                patch({ minPurchaseAmount: e.target.value })
                            }
                            className={fieldClass}
                        />
                    </label>
                    <label className="block text-sm md:col-span-2">
                        <span className="mb-1 block font-medium">Aplica a</span>
                        <select
                            value={formData.appliesTo}
                            onChange={(e) =>
                                patch({
                                    appliesTo: e.target
                                        .value as PromotionFormData['appliesTo'],
                                })
                            }
                            className={fieldClass}
                        >
                            <option value="ALL">Todo el pedido</option>
                            <option value="CATEGORY">Categoría</option>
                            <option value="SUBCATEGORY">Subcategoría</option>
                            <option value="PRODUCT">Producto</option>
                        </select>
                    </label>
                </div>
            )}

            {formData.promotionType === 'DISCOUNT_AMOUNT' && (
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm">
                        <span className="mb-1 block font-medium">
                            Descuento S/ *
                        </span>
                        <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={formData.discountAmount}
                            onChange={(e) =>
                                patch({ discountAmount: e.target.value })
                            }
                            className={fieldClass}
                        />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-1 block font-medium">
                            Monto mínimo de compra
                        </span>
                        <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={formData.minPurchaseAmount}
                            onChange={(e) =>
                                patch({ minPurchaseAmount: e.target.value })
                            }
                            className={fieldClass}
                        />
                    </label>
                    <label className="block text-sm md:col-span-2">
                        <span className="mb-1 block font-medium">Aplica a</span>
                        <select
                            value={formData.appliesTo}
                            onChange={(e) =>
                                patch({
                                    appliesTo: e.target
                                        .value as PromotionFormData['appliesTo'],
                                })
                            }
                            className={fieldClass}
                        >
                            <option value="ALL">Todo el pedido</option>
                            <option value="CATEGORY">Categoría</option>
                            <option value="SUBCATEGORY">Subcategoría</option>
                            <option value="PRODUCT">Producto</option>
                        </select>
                    </label>
                </div>
            )}

            {formData.promotionType === 'NXM' && (
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm">
                        <span className="mb-1 block font-medium">
                            Lleva (N) *
                        </span>
                        <input
                            type="number"
                            min={2}
                            value={formData.buyQuantity}
                            onChange={(e) =>
                                patch({ buyQuantity: e.target.value })
                            }
                            className={fieldClass}
                        />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-1 block font-medium">Paga (M) *</span>
                        <input
                            type="number"
                            min={1}
                            value={formData.getQuantity}
                            onChange={(e) =>
                                patch({ getQuantity: e.target.value })
                            }
                            className={fieldClass}
                        />
                    </label>
                    <label className="block text-sm md:col-span-2">
                        <span className="mb-1 block font-medium">Aplica a</span>
                        <select
                            value={formData.appliesTo}
                            onChange={(e) =>
                                patch({
                                    appliesTo: e.target
                                        .value as PromotionFormData['appliesTo'],
                                })
                            }
                            className={fieldClass}
                        >
                            <option value="ALL">Todo el pedido</option>
                            <option value="CATEGORY">Categoría</option>
                            <option value="SUBCATEGORY">Subcategoría</option>
                            <option value="PRODUCT">Producto</option>
                        </select>
                    </label>
                </div>
            )}

            {formData.promotionType === 'GIFT' && (
                <div className="space-y-3">
                    <label className="block text-sm">
                        <span className="mb-1 block font-medium">
                            Buscar producto regalo *
                        </span>
                        <input
                            value={giftSearch}
                            onChange={(e) => setGiftSearch(e.target.value)}
                            className={fieldClass}
                            placeholder="Buscar por nombre..."
                        />
                    </label>
                    {formData.giftProductName && (
                        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300">
                            Seleccionado: {formData.giftProductName}
                        </div>
                    )}
                    {giftResults.length > 0 && (
                        <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            {giftResults.map((product: any) => (
                                <button
                                    key={product.id}
                                    type="button"
                                    onClick={() => {
                                        patch({
                                            giftProductId: product.id,
                                            giftProductName: product.name,
                                        });
                                        setGiftSearch(product.name);
                                    }}
                                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                                >
                                    {product.name}
                                    <span className="ml-2 text-slate-400">
                                        S/ {Number(product.salePrice).toFixed(2)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium">
                                Cantidad de regalo
                            </span>
                            <input
                                type="number"
                                min={1}
                                value={formData.giftQuantity}
                                onChange={(e) =>
                                    patch({ giftQuantity: e.target.value })
                                }
                                className={fieldClass}
                            />
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium">
                                Monto mínimo para activar
                            </span>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={formData.minPurchaseAmount}
                                onChange={(e) =>
                                    patch({ minPurchaseAmount: e.target.value })
                                }
                                className={fieldClass}
                            />
                        </label>
                    </div>
                </div>
            )}

            {showScopes && branchId && (
                <ScopeEditor
                    branchId={branchId}
                    scopes={formData.scopes}
                    onChange={(scopes) => patch({ scopes })}
                    categories={categories}
                />
            )}

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                    {loading ? 'Guardando...' : submitLabel}
                </button>
            </div>
        </form>
    );
};

export default PromotionForm;
