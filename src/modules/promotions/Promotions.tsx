import React, { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_PROMOTIONS_BY_BRANCH } from '../../graphql/queries';
import CreatePromotion from './createPromotion';
import EditPromotion from './editPromotion';
import {
    PROMOTION_TYPE_LABELS,
    type IPromotion,
    type PromotionTypeValue,
} from '../../types/promotions';

const TAB_TYPES: PromotionTypeValue[] = [
    'COMBO',
    'DISCOUNT_PERCENT',
    'DISCOUNT_AMOUNT',
    'NXM',
    'GIFT',
];

const typeBadgeClass: Record<PromotionTypeValue, string> = {
    COMBO: 'bg-orange-500',
    DISCOUNT_PERCENT: 'bg-blue-500',
    DISCOUNT_AMOUNT: 'bg-green-600',
    NXM: 'bg-purple-500',
    GIFT: 'bg-yellow-500 text-black',
};

const Promotions: React.FC = () => {
    const { companyData } = useAuth();
    const branchId = companyData?.branch?.id;
    const [activeTab, setActiveTab] = useState<PromotionTypeValue>('COMBO');
    const [showCreate, setShowCreate] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState<IPromotion | null>(
        null,
    );
    const [refreshKey, setRefreshKey] = useState(0);

    const { data, loading, refetch } = useQuery(GET_PROMOTIONS_BY_BRANCH, {
        variables: { branchId: branchId! },
        skip: !branchId,
        fetchPolicy: 'network-only',
    });

    const promotions: IPromotion[] = useMemo(() => {
        const raw = data?.promotionsByBranch || [];
        return raw.map((promo: any) => ({
            ...promo,
            scopes: (promo.scopes || []).map((scope: any) => ({
                ...scope,
                fixedProduct: scope.product || null,
            })),
        }));
    }, [data]);

    const filteredPromotions = promotions.filter(
        (promo) => promo.promotionType === activeTab,
    );

    const handleRefresh = () => {
        setRefreshKey((prev) => prev + 1);
        refetch();
    };

    if (!branchId) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
                No se encontró información de la sucursal.
            </div>
        );
    }

    return (
        <div
            key={refreshKey}
            className="flex w-full max-w-full flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        Gestión de Promociones
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Crea y edita combos, descuentos, NxM y regalos
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                    + Nueva promoción
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {TAB_TYPES.map((type) => (
                    <button
                        key={type}
                        onClick={() => setActiveTab(type)}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                            activeTab === type
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                    >
                        {PROMOTION_TYPE_LABELS[type]}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                    Cargando promociones...
                </div>
            ) : filteredPromotions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
                    No hay promociones de tipo {PROMOTION_TYPE_LABELS[activeTab]}.
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredPromotions.map((promo) => (
                        <div
                            key={promo.id}
                            className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                                        {promo.name}
                                    </span>
                                    <span
                                        className={`rounded px-2 py-0.5 text-xs font-bold text-white ${typeBadgeClass[promo.promotionType]}`}
                                    >
                                        {promo.promotionType}
                                    </span>
                                    <span
                                        className={`rounded px-2 py-0.5 text-xs ${
                                            promo.isActive
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                                        }`}
                                    >
                                        {promo.isActive ? 'Activa' : 'Inactiva'}
                                    </span>
                                    {promo.isValidNow && (
                                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                            Vigente ahora
                                        </span>
                                    )}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {promo.daysDisplay || 'Sin restricción de días'}
                                </div>
                                {promo.promotionType === 'COMBO' && (
                                    <div className="mt-1 text-xs text-orange-600 dark:text-orange-300">
                                        {promo.scopes?.length || 0} scopes:{' '}
                                        {(promo.scopes || [])
                                            .map((s) => s.label || s.scopeLabel)
                                            .filter(Boolean)
                                            .join(', ') || '—'}
                                    </div>
                                )}
                                {promo.promotionType === 'DISCOUNT_PERCENT' && (
                                    <div className="mt-1 text-xs text-blue-600 dark:text-blue-300">
                                        {promo.discountPercent}% de descuento
                                    </div>
                                )}
                                {promo.promotionType === 'DISCOUNT_AMOUNT' && (
                                    <div className="mt-1 text-xs text-green-600 dark:text-green-300">
                                        S/ {Number(promo.discountAmount || 0).toFixed(2)} de descuento
                                    </div>
                                )}
                                {promo.promotionType === 'NXM' && (
                                    <div className="mt-1 text-xs text-purple-600 dark:text-purple-300">
                                        Compra {promo.buyQuantity} lleva {promo.getQuantity}
                                    </div>
                                )}
                                {promo.promotionType === 'GIFT' && promo.giftProduct && (
                                    <div className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                                        Regalo: {promo.giftProduct.name} × {promo.giftQuantity ?? 1}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setEditingPromotion(promo)}
                                className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-600"
                            >
                                Editar
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {showCreate && (
                <CreatePromotion
                    defaultType={activeTab}
                    onClose={() => setShowCreate(false)}
                    onSuccess={() => {
                        setShowCreate(false);
                        handleRefresh();
                    }}
                />
            )}

            {editingPromotion && (
                <EditPromotion
                    promotion={editingPromotion}
                    onClose={() => setEditingPromotion(null)}
                    onSuccess={() => {
                        setEditingPromotion(null);
                        handleRefresh();
                    }}
                />
            )}
        </div>
    );
};

export default Promotions;
