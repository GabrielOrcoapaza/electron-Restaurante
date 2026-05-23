import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { GET_PROMOTION_BY_ID } from '../../graphql/queries';
import {
    SET_PROMOTION_SCOPES,
    UPDATE_PROMOTION,
} from '../../graphql/mutations';
import PromotionForm from './PromotionForm';
import {
    buildPromotionVariables,
    buildScopeInputs,
    promotionToFormData,
    validatePromotionForm,
} from './promotionFormHelpers';
import type { IPromotion, PromotionFormData } from '../../types/promotions';

interface EditPromotionProps {
    promotion: IPromotion;
    onClose: () => void;
    onSuccess: () => void;
}

const EditPromotion: React.FC<EditPromotionProps> = ({
    promotion,
    onClose,
    onSuccess,
}) => {
    const { companyData } = useAuth();
    const branchId = companyData?.branch?.id;
    const [saving, setSaving] = useState(false);

    const { data, loading } = useQuery(GET_PROMOTION_BY_ID, {
        variables: { promotionId: promotion.id },
        fetchPolicy: 'network-only',
    });

    const [updatePromotion] = useMutation(UPDATE_PROMOTION);
    const [setPromotionScopes] = useMutation(SET_PROMOTION_SCOPES);

    const initialData = useMemo<PromotionFormData | undefined>(() => {
        const promo = data?.promotionById || promotion;
        if (!promo) return undefined;
        return promotionToFormData(promo);
    }, [data, promotion]);

    const handleSubmit = async (formData: PromotionFormData) => {
        if (!branchId) throw new Error('No se encontró la sucursal.');

        const validationError = validatePromotionForm(formData);
        if (validationError) throw new Error(validationError);

        setSaving(true);
        try {
            const { data: updateData } = await updatePromotion({
                variables: {
                    promotionId: promotion.id,
                    ...buildPromotionVariables(formData),
                },
            });

            const result = updateData?.updatePromotion;
            if (!result?.success) {
                throw new Error(result?.message || 'No se pudo actualizar la promoción.');
            }

            const scopes = buildScopeInputs(formData);
            const scopeResult = await setPromotionScopes({
                variables: { promotionId: promotion.id, scopes },
            });
            if (!scopeResult.data?.setPromotionScopes?.success) {
                throw new Error(
                    scopeResult.data?.setPromotionScopes?.message ||
                        'Promoción actualizada, pero falló al guardar los scopes.',
                );
            }

            onSuccess();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        Editar promoción
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        ✕
                    </button>
                </div>
                <div className="p-6">
                    {loading || !initialData ? (
                        <div className="py-12 text-center text-sm text-slate-500">
                            Cargando promoción...
                        </div>
                    ) : (
                        <PromotionForm
                            initialData={initialData}
                            onSubmit={handleSubmit}
                            onCancel={onClose}
                            loading={saving}
                            submitLabel="Guardar cambios"
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default EditPromotion;
