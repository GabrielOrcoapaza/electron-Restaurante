// ─── Scopes ───────────────────────────────────────────────────────────────────

// Scope de una promoción (grupo de elección dentro de un combo O target de descuento)
export interface IPromotionScope {
    id: string;
    label: string | null;
    scopeLabel: string | null;
    requiredQuantity: number;
    subcategory?: { id: string; name: string } | null;
    category?: { id: string; name: string } | null;
    product?: {
        id: string;
        name: string;
        salePrice: number;
        isActive: boolean;
        currentStock?: number | null;
        managesStock?: boolean | null;
    } | null;
}

export interface ScopeFormItem {
    id?: string;
    label: string;
    scopeLabel: string;
    requiredQuantity: number;
    scopeType: 'subcategory' | 'category' | 'product';
    subcategoryId?: string;
    categoryId?: string;
    productId?: string;
    productName?: string;
}

export type PromotionTypeValue =
    | 'COMBO'
    | 'DISCOUNT_PERCENT'
    | 'DISCOUNT_AMOUNT'
    | 'NXM'
    | 'GIFT';

export interface PromotionFormData {
    name: string;
    description: string;
    promotionType: PromotionTypeValue;
    isActive: boolean;
    validFrom: string;
    validTo: string;
    daysOfWeek: number[];
    timeFrom: string;
    timeTo: string;
    discountPercent: string;
    discountAmount: string;
    buyQuantity: string;
    getQuantity: string;
    giftProductId: string;
    giftProductName: string;
    giftQuantity: string;
    minPurchaseAmount: string;
    appliesTo: 'ALL' | 'CATEGORY' | 'SUBCATEGORY' | 'PRODUCT';
    priority: string;
    scopes: ScopeFormItem[];
    /** Base64 de foto nueva a subir (sin prefijo data:). */
    photoBase64?: string | null;
    /** URL de foto existente del servidor (solo edición / vista previa). */
    existingPhoto?: string | null;
    /** Marca eliminación de la foto al editar. */
    photoRemoved?: boolean;
}

export const PROMOTION_TYPE_LABELS: Record<PromotionTypeValue, string> = {
    COMBO: 'Combo / Menú',
    DISCOUNT_PERCENT: 'Descuento %',
    DISCOUNT_AMOUNT: 'Descuento S/',
    NXM: 'N × M',
    GIFT: 'Regalo',
};

export const DAY_LABELS = [
    { value: 1, label: 'Lu' },
    { value: 2, label: 'Ma' },
    { value: 3, label: 'Mi' },
    { value: 4, label: 'Ju' },
    { value: 5, label: 'Vi' },
    { value: 6, label: 'Sa' },
    { value: 7, label: 'Do' },
];

export function parseDaysOfWeek(value?: string | null): number[] {
    if (!value) return [1, 2, 3, 4, 5, 6, 7];
    return value
        .split(',')
        .map((d) => parseInt(d.trim(), 10))
        .filter((d) => !Number.isNaN(d) && d >= 1 && d <= 7);
}

export function serializeDaysOfWeek(days: number[]): string {
    return [...days].sort((a, b) => a - b).join(',');
}

export function timeToInput(value?: string | null): string {
    if (!value) return '';
    return value.slice(0, 5);
}

export function emptyPromotionForm(
    promotionType: PromotionTypeValue = 'COMBO',
): PromotionFormData {
    return {
        name: '',
        description: '',
        promotionType,
        isActive: true,
        validFrom: new Date().toISOString().slice(0, 10),
        validTo: '',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        timeFrom: '',
        timeTo: '',
        discountPercent: '',
        discountAmount: '',
        buyQuantity: '',
        getQuantity: '',
        giftProductId: '',
        giftProductName: '',
        giftQuantity: '1',
        minPurchaseAmount: '0',
        appliesTo: 'ALL',
        priority: '0',
        scopes: [],
    };
}


export interface IPromotion {
    id: string;
    name: string;
    description?: string | null;
    promotionType: 'COMBO' | 'DISCOUNT_PERCENT' | 'DISCOUNT_AMOUNT' | 'NXM' | 'GIFT';
    isValidNow: boolean;
    isActive: boolean;
    daysDisplay: string;
    scopes: IPromotionScope[];
    // Validity
    validFrom?: string | null;    // "YYYY-MM-DD"
    validTo?: string | null;
    daysOfWeek?: string | null;   // "1,2,3,4,5"
    timeFrom?: string | null;     // "HH:MM:SS"
    timeTo?: string | null;
    // Discount fields
    discountPercent?: number | null;
    discountAmount?: number | null;
    // NxM fields
    buyQuantity?: number | null;
    getQuantity?: number | null;
    // Gift fields
    giftProduct?: { id: string; name: string; salePrice: number; productType?: string } | null;
    giftQuantity?: number | null;
    // Common conditions
    minPurchaseAmount: number;
    appliesTo: 'ALL' | 'CATEGORY' | 'SUBCATEGORY' | 'PRODUCT';
    priority: number;
    photoUrl?: string | null;
}

// ─── Combos (producto PROMOTION con scopes de elección) ───────────────────────

export type ComboScope = IPromotionScope;

export interface ComboPromotion {
    id: string;
    name: string;
    description: string | null;
    photoUrl?: string | null;
    promotionType: string;
    isValidNow: boolean;
    daysDisplay: string;
    scopes: ComboScope[];
}

export interface ComboProduct {
    id: string;
    code: string;
    name: string;
    description: string | null;
    salePrice: number;
    unitMeasure: string;
    isActive: boolean;
    productType: string;
    asPromotion: ComboPromotion | null;
}

export interface ComboComponentSelection {
    scopeId: string;
    scopeLabel: string;
    product: {
        id: string;
        name: string;
        salePrice: number;
    };
    quantity: number;
}

export interface ComboComponentInput {
    productId: string;
    quantity: number;
}