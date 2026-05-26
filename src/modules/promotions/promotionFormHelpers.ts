import type {
    IPromotion,
    PromotionFormData,
    ScopeFormItem,
} from '../../types/promotions';
import {
    parseDaysOfWeek,
    serializeDaysOfWeek,
    timeToInput,
} from '../../types/promotions';

function scopeRequiredQuantity(value: unknown): number {
    const qty = Number(value);
    if (!Number.isFinite(qty) || qty < 1) return 1;
    return Math.floor(qty);
}

export function promotionToFormData(promo: IPromotion & Record<string, any>): PromotionFormData {
    const scopes: ScopeFormItem[] = (promo.scopes || []).map((scope: any) => {
        let scopeType: ScopeFormItem['scopeType'] = 'subcategory';
        if (scope.product?.id) scopeType = 'product';
        else if (scope.category?.id) scopeType = 'category';

        return {
            id: scope.id,
            label: scope.label || '',
            scopeLabel: scope.scopeLabel || '',
            requiredQuantity: scopeRequiredQuantity(scope.requiredQuantity),
            scopeType,
            subcategoryId: scope.subcategory?.id || '',
            categoryId: scope.category?.id || '',
            productId: scope.product?.id || scope.fixedProduct?.id || '',
            productName: scope.product?.name || scope.fixedProduct?.name || '',
        };
    });

    return {
        name: promo.name || '',
        description: promo.description || '',
        promotionType: promo.promotionType,
        isActive: promo.isActive ?? true,
        validFrom: promo.validFrom || '',
        validTo: promo.validTo || '',
        daysOfWeek: parseDaysOfWeek(promo.daysOfWeek),
        timeFrom: timeToInput(promo.timeFrom),
        timeTo: timeToInput(promo.timeTo),
        discountPercent:
            promo.discountPercent != null ? String(promo.discountPercent) : '',
        discountAmount:
            promo.discountAmount != null ? String(promo.discountAmount) : '',
        buyQuantity: promo.buyQuantity != null ? String(promo.buyQuantity) : '',
        getQuantity: promo.getQuantity != null ? String(promo.getQuantity) : '',
        giftProductId: promo.giftProduct?.id || '',
        giftProductName: promo.giftProduct?.name || '',
        giftQuantity:
            promo.giftQuantity != null ? String(promo.giftQuantity) : '1',
        minPurchaseAmount:
            promo.minPurchaseAmount != null
                ? String(promo.minPurchaseAmount)
                : '0',
        appliesTo: promo.appliesTo || 'ALL',
        priority: promo.priority != null ? String(promo.priority) : '0',
        scopes,
    };
}

export function buildPromotionVariables(
    formData: PromotionFormData,
    branchId?: string,
) {
    const base: Record<string, unknown> = {
        name: formData.name.trim(),
        description: formData.description.trim() || '',
        promotionType: formData.promotionType,
        isActive: formData.isActive,
        validFrom: formData.validFrom,
        validTo: formData.validTo || null,
        daysOfWeek: serializeDaysOfWeek(formData.daysOfWeek),
        timeFrom: formData.timeFrom || null,
        timeTo: formData.timeTo || null,
        discountPercent: formData.discountPercent
            ? parseFloat(formData.discountPercent)
            : null,
        discountAmount: formData.discountAmount
            ? parseFloat(formData.discountAmount)
            : null,
        buyQuantity: formData.buyQuantity
            ? parseInt(formData.buyQuantity, 10)
            : null,
        getQuantity: formData.getQuantity
            ? parseInt(formData.getQuantity, 10)
            : null,
        giftProductId: formData.giftProductId || null,
        giftQuantity: formData.giftQuantity
            ? parseFloat(formData.giftQuantity)
            : null,
        minPurchaseAmount: formData.minPurchaseAmount
            ? parseFloat(formData.minPurchaseAmount)
            : 0,
        appliesTo: formData.appliesTo,
        priority: formData.priority ? parseInt(formData.priority, 10) : 0,
    };

    if (branchId) {
        base.branchId = branchId;
    }

    return base;
}

/** Campos que acepta ScopeInput en GraphQL (backend Django). */
export type GraphQLScopeInput = {
    label: string;
    categoryId: string | null;
    subcategoryId: string | null;
    productId: string | null;
    requiredQuantity: number;
};

export function buildScopeInputs(
    formData: PromotionFormData,
): GraphQLScopeInput[] {
    const needsScopes =
        formData.promotionType === 'COMBO' ||
        formData.promotionType === 'NXM' ||
        (formData.appliesTo !== 'ALL' && formData.scopes.length > 0);

    if (!needsScopes) return [];

    return formData.scopes.map(
        (scope): GraphQLScopeInput => ({
            label: scope.scopeLabel || scope.label || '',
            categoryId:
                scope.scopeType === 'category' ? scope.categoryId || null : null,
            subcategoryId:
                scope.scopeType === 'subcategory'
                    ? scope.subcategoryId || null
                    : null,
            productId:
                scope.scopeType === 'product' ? scope.productId || null : null,
            requiredQuantity: scopeRequiredQuantity(scope.requiredQuantity),
        }),
    );
}

export function validatePromotionForm(formData: PromotionFormData): string | null {
    if (!formData.name.trim()) return 'El nombre es obligatorio.';
    if (!formData.validFrom) return 'La fecha de inicio es obligatoria.';

    if (formData.promotionType === 'DISCOUNT_PERCENT') {
        const pct = parseFloat(formData.discountPercent);
        if (!pct || pct <= 0) return 'Ingresa un porcentaje de descuento válido.';
    }

    if (formData.promotionType === 'DISCOUNT_AMOUNT') {
        const amount = parseFloat(formData.discountAmount);
        if (!amount || amount <= 0) return 'Ingresa un monto de descuento válido.';
    }

    if (formData.promotionType === 'NXM') {
        const n = parseInt(formData.buyQuantity, 10);
        const m = parseInt(formData.getQuantity, 10);
        if (!n || !m || m >= n) {
            return 'NxM requiere N > M (ej: compra 3 lleva 2).';
        }
    }

    if (formData.promotionType === 'GIFT' && !formData.giftProductId) {
        return 'Selecciona el producto de regalo.';
    }

    if (formData.promotionType === 'COMBO' && formData.scopes.length === 0) {
        return 'Agrega al menos un scope para el combo.';
    }

    if (
        formData.promotionType !== 'COMBO' &&
        formData.appliesTo !== 'ALL' &&
        formData.scopes.length === 0
    ) {
        return 'Agrega al menos un scope para el alcance seleccionado.';
    }

    for (const scope of formData.scopes) {
        const qty = Number(scope.requiredQuantity);
        if (!Number.isFinite(qty) || qty < 1) {
            return 'La cantidad de cada scope debe ser al menos 1.';
        }
        if (scope.scopeType === 'subcategory' && !scope.subcategoryId) {
            return 'Completa la subcategoría de todos los scopes.';
        }
        if (scope.scopeType === 'category' && !scope.categoryId) {
            return 'Completa la categoría de todos los scopes.';
        }
        if (scope.scopeType === 'product' && !scope.productId) {
            return 'Completa el producto fijo de todos los scopes.';
        }
    }

    return null;
}
