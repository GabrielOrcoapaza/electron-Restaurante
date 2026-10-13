import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import {
    CREATE_COMBO,
    CREATE_PROMOTION,
    SET_PROMOTION_SCOPES,
} from '../../graphql/mutations';
import { GET_PROMOTIONS_BY_BRANCH } from '../../graphql/queries';
import PromotionForm from './PromotionForm';
import {
    buildPromotionVariables,
    buildScopeInputs,
    validatePromotionForm,
} from './promotionFormHelpers';
import type { PromotionFormData, PromotionTypeValue } from '../../types/promotions';

interface CreatePromotionProps {
    onClose: () => void;
    onSuccess: () => void;
    defaultType?: PromotionTypeValue;
}

const CreatePromotion: React.FC<CreatePromotionProps> = ({
    onClose,
    onSuccess,
    defaultType = 'COMBO',
}) => {
    const { companyData } = useAuth();
    const branchId = companyData?.branch?.id;
    const [saving, setSaving] = useState(false);

    const [createPromotion] = useMutation(CREATE_PROMOTION);
    const [setPromotionScopes] = useMutation(SET_PROMOTION_SCOPES);
    const [createCombo] = useMutation(CREATE_COMBO);

    const handleSubmit = async (formData: PromotionFormData) => {
        if (!branchId) throw new Error('No se encontró la sucursal.');

        const validationError = validatePromotionForm(formData);
        if (validationError) throw new Error(validationError);

        setSaving(true);
        try {
            // ✅ COMBO: una sola mutación crea la promoción + el producto vendible +
            // los scopes, ya vinculados. Evita el viaje aparte al módulo Productos.
            if (formData.promotionType === 'COMBO') {
                const salePrice = parseFloat(formData.salePrice);
                if (!salePrice || salePrice <= 0) {
                    throw new Error('Ingresa el precio de venta del combo.');
                }

                const { data } = await createCombo({
                    variables: {
                        branchId,
                        name: formData.name.trim(),
                        description: formData.description.trim() || '',
                        salePrice,
                        validFrom: formData.validFrom,
                        validTo: formData.validTo || null,
                        daysOfWeek: formData.daysOfWeek
                            .slice()
                            .sort((a, b) => a - b)
                            .join(','),
                        timeFrom: formData.timeFrom || null,
                        timeTo: formData.timeTo || null,
                        priority: formData.priority ? parseInt(formData.priority, 10) : 0,
                        isActive: formData.isActive,
                        photoBase64: formData.photoBase64 || null,
                        scopes: buildScopeInputs(formData),
                    },
                    refetchQueries: [
                        { query: GET_PROMOTIONS_BY_BRANCH, variables: { branchId } },
                    ],
                });

                const comboResult = data?.createCombo;
                if (!comboResult?.success) {
                    throw new Error(comboResult?.message || 'No se pudo crear el combo.');
                }

                onSuccess();
                return;
            }

            const { data } = await createPromotion({
                variables: buildPromotionVariables(formData, branchId),
            });

            const result = data?.createPromotion;
            if (!result?.success) {
                throw new Error(result?.message || 'No se pudo crear la promoción.');
            }

            const promotionId = result.promotion?.id;
            const scopes = buildScopeInputs(formData);
            if (promotionId && scopes.length > 0) {
                const scopeResult = await setPromotionScopes({
                    variables: { promotionId, scopes },
                    refetchQueries: [
                        {
                            query: GET_PROMOTIONS_BY_BRANCH,
                            variables: { branchId },
                        },
                    ],
                });
                if (!scopeResult.data?.setPromotionScopes?.success) {
                    throw new Error(
                        scopeResult.data?.setPromotionScopes?.message ||
                            'Promoción creada, pero falló al guardar los scopes.',
                    );
                }
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
                        Nueva promoción
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
                    <PromotionForm
                        defaultType={defaultType}
                        onSubmit={handleSubmit}
                        onCancel={onClose}
                        loading={saving}
                        submitLabel="Crear promoción"
                    />
                </div>
            </div>
        </div>
    );
};

export default CreatePromotion;
