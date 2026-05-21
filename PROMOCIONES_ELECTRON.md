# Implementación de Promociones (COMBO) en Electron Restaurante

> Documento de referencia para la siguiente conversación de implementación.
> El backend Django ya está listo. Solo se modifica el frontend Electron.

---

## Contexto: Qué se hizo en Android SumApp

En SumApp (Android) se implementó soporte completo para productos tipo **PROMOTION** (combos). Un combo es un producto de tipo `PROMOTION` que tiene una "promoción" vinculada con **scopes** (grupos de elección). Ejemplo: "Menú Ejecutivo" → scope "Sopas" (elige sopa de pollo o caldo) + scope "Segundos" (elige lomo o pollo).

Al vender un combo:
- Se elige el producto PROMOTION
- Se abre un diálogo para elegir un producto por cada scope
- Los componentes elegidos se envían como `comboComponents` en el `OperationDetailInput`
- En cocina aparece uno por componente (no el combo completo)

Filtro de stock en scopes: si un producto del scope tiene `managesStock = true` y `currentStock <= 0`, no aparece en las opciones.

---

## Archivos que se deben modificar o crear

### ARCHIVO 1 — `src/graphql/queries.ts`

**1.1 — Actualizar `GET_OPERATION_BY_ID`** (líneas ~214-237): el bloque `details` actualmente no tiene `productType` ni `comboComponents`. Esto afecta tanto a `order.tsx` como a `cashPay.tsx`.

```graphql
# Buscar en queries.ts: "details {" dentro de GET_OPERATION_BY_ID
# Agregar estos dos campos después de "notes":
productType
comboComponents {
    productName
    quantity
}
```

**1.2 — Agregar queries para combos y promociones activas:**

```typescript
// ── COMBOS activos (productos tipo PROMOTION con scopes para elegir componentes) ──
export const GET_ACTIVE_COMBOS = gql`
    query GetActiveCombos($branchId: ID!) {
        activeCombos(branchId: $branchId) {
            id
            code
            name
            description
            salePrice
            unitMeasure
            isActive
            productType
            asPromotion {
                id
                name
                description
                promotionType
                isValidNow
                daysDisplay
                scopes {
                    id
                    label
                    scopeLabel
                    requiredQuantity
                    subcategory {
                        id
                        name
                    }
                    category {
                        id
                        name
                    }
                    product {
                        id
                        name
                        salePrice
                        isActive
                        currentStock
                        managesStock
                    }
                }
            }
        }
    }
`;

// ── PROMOCIONES activas (descuentos, NxM, regalo) ──
export const GET_ACTIVE_PROMOTIONS = gql`
    query GetActivePromotions($branchId: ID!) {
        activePromotions(branchId: $branchId) {
            id
            name
            promotionType
            discountPercent
            discountAmount
            buyQuantity
            getQuantity
            giftProduct {
                id
                name
                salePrice
                productType
                isActive
            }
            giftQuantity
            minPurchaseAmount
            appliesTo
            priority
            scopes {
                id
                category { id name }
                subcategory { id name }
                product { id name salePrice }
            }
        }
    }
`;
```

**1.3 — Agregar queries para gestión de promociones:**

```typescript
// ── LISTAR TODAS LAS PROMOCIONES DE UNA SUCURSAL ──
export const GET_PROMOTIONS_BY_BRANCH = gql`
    query GetPromotionsByBranch($branchId: ID!) {
        promotionsByBranch(branchId: $branchId) {
            id
            name
            promotionType
            isActive
            validFrom
            validTo
            daysOfWeek
            timeFrom
            timeTo
            discountPercent
            discountAmount
            buyQuantity
            getQuantity
            giftProduct {
                id
                name
                salePrice
            }
            giftQuantity
            minPurchaseAmount
            appliesTo
            priority
            isValidNow
            daysDisplay
            scopes {
                id
                label
                scopeLabel
                requiredQuantity
                subcategory { id name }
                category { id name }
                product { id name salePrice isActive currentStock managesStock }
            }
        }
    }
`;

// ── DETALLE DE UNA PROMOCIÓN ──
export const GET_PROMOTION_BY_ID = gql`
    query GetPromotionById($promotionId: ID!) {
        promotionById(promotionId: $promotionId) {
            id
            name
            promotionType
            isActive
            validFrom
            validTo
            daysOfWeek
            timeFrom
            timeTo
            discountPercent
            discountAmount
            buyQuantity
            getQuantity
            giftProduct { id name salePrice }
            giftQuantity
            minPurchaseAmount
            appliesTo
            priority
            isValidNow
            daysDisplay
            scopes {
                id
                label
                scopeLabel
                requiredQuantity
                subcategory { id name }
                category { id name }
                product { id name salePrice isActive currentStock managesStock }
            }
        }
    }
`;
```

---

### ARCHIVO 2 — `src/graphql/mutations.ts`

**Problema actual:** `CREATE_OPERATION`, `ADD_ITEMS_TO_OPERATION` y `CREATE_SALE_CARRY_OUT` no envían `comboComponents` en los detalles. El tipo `OperationDetailInput` en el backend Django SÍ acepta `comboComponents: [ComboComponentInput]`.

**Cambio 1 — `CREATE_OPERATION`:** No cambia la firma GraphQL (el backend ya acepta `comboComponents` dentro de `OperationDetailInput`). Solo hay que asegurarse de que al construir el array `details` en el componente se incluya el campo. Ver cambios en `order.tsx`.

**Cambio 2 — `ADD_ITEMS_TO_OPERATION`:** Igual, el backend ya lo acepta. Ver cambios en `order.tsx`.

**Cambio 3 — `CREATE_SALE_CARRY_OUT`:** Usa `CarryOutItemInput` en vez de `OperationDetailInput`. Verificar en el backend Django si `CarryOutItemInput` también acepta `comboComponents`. Si no lo acepta, hay que agregarlo al backend. Ver sección Backend al final.

**Cambio 4 — Agregar mutations para gestión de promociones:**

```typescript
// ── CREAR PROMOCIÓN ──
export const CREATE_PROMOTION = gql`
    mutation CreatePromotion(
        $branchId: ID!
        $name: String!
        $promotionType: String!
        $isActive: Boolean
        $validFrom: Date
        $validTo: Date
        $daysOfWeek: String
        $timeFrom: Time
        $timeTo: Time
        $discountPercent: Decimal
        $discountAmount: Decimal
        $buyQuantity: Int
        $getQuantity: Int
        $giftProductId: ID
        $giftQuantity: Int
        $minPurchaseAmount: Decimal
        $appliesTo: String
        $priority: Int
        $scopes: [PromotionScopeInput]
    ) {
        createPromotion(
            branchId: $branchId
            name: $name
            promotionType: $promotionType
            isActive: $isActive
            validFrom: $validFrom
            validTo: $validTo
            daysOfWeek: $daysOfWeek
            timeFrom: $timeFrom
            timeTo: $timeTo
            discountPercent: $discountPercent
            discountAmount: $discountAmount
            buyQuantity: $buyQuantity
            getQuantity: $getQuantity
            giftProductId: $giftProductId
            giftQuantity: $giftQuantity
            minPurchaseAmount: $minPurchaseAmount
            appliesTo: $appliesTo
            priority: $priority
            scopes: $scopes
        ) {
            promotion {
                id
                name
                promotionType
                isActive
            }
            errors
        }
    }
`;

// ── EDITAR PROMOCIÓN ──
export const UPDATE_PROMOTION = gql`
    mutation UpdatePromotion(
        $promotionId: ID!
        $name: String
        $promotionType: String
        $isActive: Boolean
        $validFrom: Date
        $validTo: Date
        $daysOfWeek: String
        $timeFrom: Time
        $timeTo: Time
        $discountPercent: Decimal
        $discountAmount: Decimal
        $buyQuantity: Int
        $getQuantity: Int
        $giftProductId: ID
        $giftQuantity: Int
        $minPurchaseAmount: Decimal
        $appliesTo: String
        $priority: Int
        $scopes: [PromotionScopeInput]
    ) {
        updatePromotion(
            promotionId: $promotionId
            name: $name
            promotionType: $promotionType
            isActive: $isActive
            validFrom: $validFrom
            validTo: $validTo
            daysOfWeek: $daysOfWeek
            timeFrom: $timeFrom
            timeTo: $timeTo
            discountPercent: $discountPercent
            discountAmount: $discountAmount
            buyQuantity: $buyQuantity
            getQuantity: $getQuantity
            giftProductId: $giftProductId
            giftQuantity: $giftQuantity
            minPurchaseAmount: $minPurchaseAmount
            appliesTo: $appliesTo
            priority: $priority
            scopes: $scopes
        ) {
            promotion {
                id
                name
                promotionType
                isActive
            }
            errors
        }
    }
`;
```

**Input `PromotionScopeInput` (referencia para pasar scopes):**

```typescript
// El backend espera por scope:
{
    subcategoryId?: string | null;   // si el scope es por subcategoría
    categoryId?: string | null;      // si el scope es por categoría
    productId?: string | null;       // si es un producto fijo
    requiredQuantity: number;        // cuántos se eligen (normalmente 1)
    label?: string | null;           // ej: "Entrada"
    scopeLabel?: string | null;      // ej: "Elige tu entrada"
}
```

---

### ARCHIVO 3 — `src/types/promotions.ts` *(nuevo)*

Crear este archivo con TODOS los tipos TypeScript para combos y promociones:

```typescript
// ─── Scopes ───────────────────────────────────────────────────────────────────

// Scope de una promoción (grupo de elección dentro de un combo O target de descuento)
export interface IPromotionScope {
    id: string;
    label: string | null;
    scopeLabel: string | null;
    requiredQuantity: number;
    subcategoryId?: string | null;
    subcategoryName?: string | null;
    categoryId?: string | null;
    categoryName?: string | null;
    fixedProduct?: {         // "product" en GraphQL — producto fijo del scope
        id: string;
        name: string;
        salePrice: number;
        isActive: boolean;
        currentStock?: number | null;
        managesStock?: boolean | null;
    } | null;
}

// ─── Promoción (DISCOUNT_PERCENT | DISCOUNT_AMOUNT | NXM | GIFT | COMBO) ─────

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
}

// ─── Combos (producto PROMOTION con scopes de elección) ───────────────────────

// alias para scopes de combos (misma estructura)
export type ComboScope = IPromotionScope;

export interface ComboPromotion {
    id: string;
    name: string;
    description: string | null;
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

// Componente elegido por el mozo para un scope
export interface ComboComponentSelection {
    scopeId: string;
    scopeLabel: string;
    product: {
        id: string;
        name: string;
        salePrice: number;
    };
    quantity: number; // = scope.requiredQuantity
}

// Lo que se envía al backend dentro de OperationDetailInput
export interface ComboComponentInput {
    productId: string;
    quantity: number;
}
```

---

### ARCHIVO 3b — `src/utils/promotionUtils.ts` *(nuevo)*

Traducción exacta de `PromotionUtils.kt` a TypeScript. Toda la lógica de promociones vive aquí para ser reutilizada en `order.tsx`, `delivery.tsx` y `cashPay.tsx`.

```typescript
import type { IPromotion, IPromotionScope } from '../types/promotions';

// Producto mínimo necesario para evaluar promociones
export interface PromotionProduct {
    id: string;
    subcategoryId?: string | null;
    subcategory?: { category?: { id?: string } | null } | null;
    category?: { id?: string } | null;
    productType?: string | null;
}

export interface CartLine {
    index: number;
    product: PromotionProduct;
    unitPrice: number;
    quantity: number;
    isGift: boolean;
}

/** Devuelve true si la promoción aplica al producto (según appliesTo y scopes). */
export function promotionAppliesToProduct(promo: IPromotion, product: PromotionProduct): boolean {
    switch (promo.appliesTo) {
        case 'ALL':
            return true;
        case 'CATEGORY':
            return promo.scopes.some(scope =>
                scope.categoryId != null && (
                    product.subcategory?.category?.id === scope.categoryId ||
                    product.category?.id === scope.categoryId
                )
            );
        case 'SUBCATEGORY':
            return promo.scopes.some(scope =>
                scope.subcategoryId != null && product.subcategoryId === scope.subcategoryId
            );
        case 'PRODUCT':
            return promo.scopes.some(scope =>
                scope.fixedProduct?.id != null && scope.fixedProduct.id === product.id
            );
        default:
            return false;
    }
}

/**
 * Encuentra la mejor promoción de tipo DISCOUNT_PERCENT o DISCOUNT_AMOUNT para un producto.
 * Usa `priority` para desempatar (mayor = primero).
 */
export function findBestDiscountPromotion(
    product: PromotionProduct,
    promotions: IPromotion[],
    cartTotal: number
): IPromotion | null {
    const candidates = promotions.filter(promo =>
        (promo.promotionType === 'DISCOUNT_PERCENT' || promo.promotionType === 'DISCOUNT_AMOUNT') &&
        promotionAppliesToProduct(promo, product) &&
        cartTotal >= promo.minPurchaseAmount
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((best, curr) =>
        curr.priority > best.priority ? curr : best
    );
}

/**
 * Calcula el descuento total para una línea del carrito.
 * Resultado = descuento total de TODA la línea (precio × cantidad × factor).
 */
export function calculateLineDiscount(
    unitPrice: number,
    quantity: number,
    promo: IPromotion
): number {
    switch (promo.promotionType) {
        case 'DISCOUNT_PERCENT': {
            const pct = promo.discountPercent ?? 0;
            return Math.round(unitPrice * quantity * pct / 100 * 100) / 100;
        }
        case 'DISCOUNT_AMOUNT': {
            const amount = promo.discountAmount ?? 0;
            return Math.min(
                Math.round(amount * 100) / 100,
                Math.round(unitPrice * quantity * 100) / 100
            );
        }
        default:
            return 0;
    }
}

/** Badge para mostrar en la tarjeta de producto (ej: "20% OFF", "3×2", "REGALO"). */
export function promotionBadgeLabel(promo: IPromotion): string {
    switch (promo.promotionType) {
        case 'DISCOUNT_PERCENT': return `${Math.round(promo.discountPercent ?? 0)}% OFF`;
        case 'DISCOUNT_AMOUNT':  return `-S/ ${(promo.discountAmount ?? 0).toFixed(2)}`;
        case 'NXM':              return `${promo.buyQuantity}×${promo.getQuantity}`;
        case 'GIFT':             return 'REGALO';
        default: return '';
    }
}

/** Encuentra la mejor promoción (no COMBO) para mostrar badge en un producto. */
export function findBadgePromotion(
    product: PromotionProduct,
    promotions: IPromotion[]
): IPromotion | null {
    const candidates = promotions.filter(promo =>
        promo.promotionType !== 'COMBO' && promotionAppliesToProduct(promo, product)
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((best, curr) =>
        curr.priority > best.priority ? curr : best
    );
}

/**
 * Para cada promoción NxM, determina qué líneas del carrito obtienen descuento 100%.
 * Los más baratos son los que quedan gratis.
 * Devuelve un Map<lineIndex, promoName>.
 */
export function computeNxMFreeSet(
    lines: CartLine[],
    nxmPromotions: IPromotion[]
): Map<number, string> {
    const result = new Map<number, string>();
    for (const promo of nxmPromotions) {
        const N = promo.buyQuantity;
        const M = promo.getQuantity;
        if (!N || !M || M >= N || N <= 0) continue;
        const freePerGroup = N - M;

        const qualifying = lines
            .filter(l => !l.isGift && promotionAppliesToProduct(promo, l.product))
            .sort((a, b) => a.unitPrice - b.unitPrice); // más baratos = gratis

        if (qualifying.length < N) continue;

        qualifying.forEach((line, pos) => {
            const groupPos = pos % N;
            if (groupPos < freePerGroup) {
                result.set(line.index, promo.name);
            }
        });
    }
    return result;
}
```

---

### ARCHIVO 4 — `src/components/ComboSelectorModal.tsx` *(nuevo)*

Este es el componente más importante. Reemplaza al `ComboSelectorDialog` de Android. Es un modal que:

1. **Paso 1:** Lista todos los combos disponibles (tarjetas clicables)
2. **Paso 2:** Para el combo elegido, muestra cada scope con sus productos para elegir
3. **Confirmar:** Llama a `onConfirm(combo, componentsElegidos)`

**Estructura del componente:**

```typescript
interface ComboSelectorModalProps {
    branchId: string;
    onConfirm: (combo: ComboProduct, components: ComboComponentSelection[]) => void;
    onClose: () => void;
}
```

**Lógica interna:**

```typescript
// Estado
const [selectedCombo, setSelectedCombo] = useState<ComboProduct | null>(null);
const [scopeProducts, setScopeProducts] = useState<Record<string, any[]>>({}); 
// key = scope.id, value = productos disponibles filtrados
const [selectedComponents, setSelectedComponents] = useState<Record<string, any>>({}); 
// key = scope.id, value = producto elegido

// Query de combos activos
const { data, loading } = useQuery(GET_ACTIVE_COMBOS, { variables: { branchId } });
const combos: ComboProduct[] = data?.activeCombos || [];

// Lazy query para cargar productos por subcategoría
const [loadSubcategoryProducts] = useLazyQuery(GET_PRODUCTS_BY_CATEGORY, {
    fetchPolicy: "network-only"
});
// también GET_PRODUCTS con categoryId si el scope tiene categoryId

// Cuando se selecciona un combo, cargar productos para cada scope
useEffect(() => {
    if (!selectedCombo?.asPromotion) return;
    selectedCombo.asPromotion.scopes.forEach(scope => {
        if (scope.product) {
            // Producto fijo: verificar stock aquí mismo
            const fixedOk = !scope.product.managesStock || (scope.product.currentStock ?? 1) > 0;
            setScopeProducts(prev => ({
                ...prev,
                [scope.id]: fixedOk ? [scope.product] : []
            }));
            if (fixedOk) {
                // Auto-seleccionar si solo hay una opción
                setSelectedComponents(prev => ({ ...prev, [scope.id]: scope.product }));
            }
        } else if (scope.subcategory?.id) {
            // Cargar productos de la subcategoría
            loadSubcategoryProducts({
                variables: { categoryId: scope.subcategory.id }
            }).then(res => {
                const raw = res.data?.productsBySubcategory || res.data?.products || [];
                const filtered = raw.filter((p: any) =>
                    p.isActive !== false &&
                    (!p.managesStock || (p.currentStock ?? 1) > 0)
                );
                setScopeProducts(prev => ({ ...prev, [scope.id]: filtered }));
            });
        } else if (scope.category?.id) {
            // Cargar productos de la categoría
            // usar GET_PRODUCTS con categoryId
        }
    });
}, [selectedCombo]);

// Verificar si todos los scopes tienen selección
const allSelected = selectedCombo?.asPromotion?.scopes.every(
    s => selectedComponents[s.id]
) ?? false;

// Al confirmar
const handleConfirm = () => {
    if (!selectedCombo?.asPromotion) return;
    const components: ComboComponentSelection[] = selectedCombo.asPromotion.scopes.map(scope => ({
        scopeId: scope.id,
        scopeLabel: scope.scopeLabel || scope.label || '',
        product: selectedComponents[scope.id],
        quantity: scope.requiredQuantity
    }));
    onConfirm(selectedCombo, components);
};
```

**UI del modal:**
- Fondo oscuro con overlay
- Ancho: 95% del viewport, max 700px
- Header naranja con título y botón X
- Paso 1: Grid de cards de combos (nombre, descripción, precio, ícono estrella)
- Paso 2: Por cada scope, lista de productos como botones seleccionables
  - Si el scope no tiene productos disponibles: mostrar "Sin stock disponible" en rojo
  - Producto seleccionado: borde naranja + fondo naranja tenue
- Footer: botón "Agregar al pedido" (deshabilitado hasta que todos los scopes tengan selección)

---

### ARCHIVO 5 — `src/modules/sales/order.tsx`

**5.1 — Actualizar tipo `OrderItem`** (línea 52):

```typescript
type OrderItem = {
    id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
    isNew: boolean;
    notes: string;
    subcategoryId?: string;
    isPrinted?: boolean;
    printedAt?: string;
    // NUEVO: campo producto completo (necesario para evaluar promociones)
    product?: any;
    // NUEVO: descuento calculado automáticamente por recalculatePromotions
    discount?: number;
    promotionName?: string | null;
    // NUEVO: solo para productos tipo PROMOTION (combo)
    isCombo?: boolean;
    comboComponents?: ComboComponentSelection[];
};
```

**5.2 — Actualizar filtro `isOrderSearchProduct`** (línea 71):

```typescript
// Antes: solo DISH y BEVERAGE
// Después: también PROMOTION
function isOrderSearchProduct(p: any) {
    const t = p?.productType;
    return t === "DISH" || t === "BEVERAGE" || t === "PROMOTION";
}
```

> **IMPORTANTE:** Los PROMOTION no deben agregarse con `handleAddProduct` normal. Agregar intercepción dentro de `handleAddProduct`:
```typescript
if (product.productType === "PROMOTION") {
    setPendingComboProduct(product);
    setShowComboModal(true);
    return;
}
```

**5.3 — Agregar imports de promotionUtils:**

```typescript
import {
    findBestDiscountPromotion,
    calculateLineDiscount,
    computeNxMFreeSet,
    findBadgePromotion,
    promotionBadgeLabel,
    type CartLine,
} from '../../utils/promotionUtils';
import type { IPromotion } from '../../types/promotions';
```

**5.4 — Cargar promociones activas al montar el componente:**

```typescript
// Junto a los otros useQuery del componente
const { data: promotionsData } = useQuery(GET_ACTIVE_PROMOTIONS, {
    variables: { branchId: companyData?.branch?.id },
    skip: !companyData?.branch?.id,
    fetchPolicy: "network-only",
});
const [activePromotions, setActivePromotions] = useState<IPromotion[]>([]);

useEffect(() => {
    if (promotionsData?.activePromotions) {
        setActivePromotions(promotionsData.activePromotions);
    }
}, [promotionsData]);

// Mensaje de regalo disponible
const [giftMessage, setGiftMessage] = useState<string | null>(null);
```

**5.5 — Función `recalculatePromotions` (llamar tras cada cambio de carrito):**

```typescript
const recalculatePromotions = useCallback((items: OrderItem[], promotions: IPromotion[]) => {
    if (promotions.length === 0) return items;

    const cartTotal = items.reduce((sum, it) => sum + it.price * it.quantity - (it.discount ?? 0), 0);

    // 1. DISCOUNT_PERCENT / DISCOUNT_AMOUNT por ítem
    let updated = items.map(item => {
        // No aplicar a combos ni a ítems ya impresos
        if (item.isCombo || item.isPrinted || !item.product) return { ...item, discount: 0, promotionName: null };
        const promo = findBestDiscountPromotion(item.product, promotions, cartTotal);
        if (promo) {
            const disc = calculateLineDiscount(item.price, item.quantity, promo);
            return { ...item, discount: disc, promotionName: promo.name };
        }
        return { ...item, discount: 0, promotionName: null };
    });

    // 2. NxM — los más baratos del grupo quedan gratis
    const nxmPromos = promotions.filter(p => p.promotionType === 'NXM');
    if (nxmPromos.length > 0) {
        const lines: CartLine[] = updated
            .map((item, idx) => item.product ? {
                index: idx,
                product: item.product,
                unitPrice: item.price,
                quantity: item.quantity,
                isGift: false,
            } : null)
            .filter(Boolean) as CartLine[];

        const freeSet = computeNxMFreeSet(lines, nxmPromos);
        freeSet.forEach((promoName, idx) => {
            if (!updated[idx].isPrinted) {
                updated[idx] = {
                    ...updated[idx],
                    discount: Math.round(updated[idx].price * updated[idx].quantity * 100) / 100,
                    promotionName: promoName,
                };
            }
        });
    }

    // 3. GIFT — solo notificación (el mozo agrega el regalo manualmente)
    const newTotal = updated.reduce((sum, it) => sum + it.price * it.quantity - (it.discount ?? 0), 0);
    const giftPromo = promotions.find(p =>
        p.promotionType === 'GIFT' && newTotal >= p.minPurchaseAmount && p.giftProduct
    );
    setGiftMessage(giftPromo
        ? `¡Regalo disponible! ${giftPromo.giftProduct?.name} × ${giftPromo.giftQuantity ?? 1} — ${giftPromo.name}`
        : null
    );

    return updated;
}, []);

// Disparar recálculo cuando cambia el carrito o las promociones
useEffect(() => {
    if (activePromotions.length > 0 && orderItems.length > 0) {
        setOrderItems(prev => recalculatePromotions(prev, activePromotions));
    }
}, [activePromotions, orderItems.length]); // ojo: no poner orderItems en deps directos o loops
```

> **Nota:** Para evitar bucles infinitos, el useEffect debe dispararse solo cuando cambia la _longitud_ del carrito o cuando llegan las promociones. El cambio de descuento no debe re-disparar el efecto. Alternativa: llamar `recalculatePromotions` explícitamente en `handleAddProduct`, `handleRemoveItem` y `handleUpdateQuantity`.

**5.6 — Mostrar badge de promoción en tarjetas de producto:**

En el renderizado de cada tarjeta de producto, agregar badge:
```tsx
{(() => {
    const badge = findBadgePromotion(product, activePromotions);
    if (!badge) return null;
    return (
        <span className="absolute top-1 right-1 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-bold z-10">
            {promotionBadgeLabel(badge)}
        </span>
    );
})()}
```

**5.7 — Banner de regalo disponible:**

Debajo del encabezado de la orden (o encima del carrito):
```tsx
{giftMessage && (
    <div className="bg-yellow-500 text-black text-sm px-3 py-2 rounded-lg flex items-center gap-2 font-semibold animate-pulse">
        🎁 {giftMessage}
    </div>
)}
```

**5.8 — Mostrar descuento en el carrito:**

En cada fila del carrito donde `item.discount > 0`:
```tsx
{(item.discount ?? 0) > 0 && (
    <div className="text-xs text-green-400 flex items-center gap-1">
        <span>-S/ {item.discount!.toFixed(2)}</span>
        {item.promotionName && <span className="text-gray-400">({item.promotionName})</span>}
    </div>
)}
```

**5.9 — Agregar estado y handler para combos:**

```typescript
const [showComboModal, setShowComboModal] = useState(false);

const handleAddCombo = (combo: ComboProduct, components: ComboComponentSelection[]) => {
    const newItem: OrderItem = {
        id: `combo-${combo.id}-${Date.now()}`,
        productId: combo.id,
        name: combo.name,
        price: combo.salePrice,
        quantity: 1,
        total: combo.salePrice,
        isNew: true,
        notes: "",
        subcategoryId: undefined,
        product: combo,
        isCombo: true,
        comboComponents: components,
        discount: 0,
    };
    setOrderItems(prev => [...prev, newItem]);
    setShowComboModal(false);
};
```

**5.10 — Botón de combos en la UI:**

```tsx
<button
    onClick={() => setShowComboModal(true)}
    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-semibold"
>
    ⭐ Combos
</button>
```

**5.11 — Renderizar componentes del combo en el carrito:**

```tsx
{item.isCombo && item.comboComponents && (
    <div className="text-xs text-orange-300 mt-1 space-y-0.5">
        {item.comboComponents.map(comp => (
            <div key={comp.scopeId}>• {comp.product.name}</div>
        ))}
    </div>
)}
```

**5.12 — Incluir `discount` y `comboComponents` al enviar la operación** (línea ~980 y ~1080):

```typescript
return {
    productId: String(item.productId),
    quantity,
    unitMeasure: "NIU",
    unitValue,
    unitPrice,
    discount: item.discount ?? 0,           // NUEVO: descuento calculado
    notes,
    comboComponents: item.isCombo && item.comboComponents
        ? item.comboComponents.map(comp => ({
              productId: comp.product.id,
              quantity: comp.quantity,   // NO multiplicar por item.quantity
          }))
        : undefined,
};
```

> **Verificar:** que `OperationDetailInput` en el backend acepte el campo `discount`. Si no lo acepta, el descuento no se registra en la orden — solo sería visual. Revisar `apps/finances/types.py` → `OperationDetailInput`.

**5.13 — Montar el modal al final del JSX:**

```tsx
{showComboModal && (
    <ComboSelectorModal
        branchId={companyData.branch.id}
        onConfirm={handleAddCombo}
        onClose={() => setShowComboModal(false)}
    />
)}
```

---

### ARCHIVO 6 — `src/modules/sales/delivery.tsx`

Mismos cambios que `order.tsx` adaptados a `CartItem` y `CREATE_SALE_CARRY_OUT`. Este es el equivalente al `PointOfSaleScreen` de Android.

**6.1 — Actualizar tipo `CartItem`:**

```typescript
type CartItem = {
    id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
    notes: string;
    subcategoryId?: string;
    // NUEVO: campo producto completo (necesario para evaluar promociones)
    product?: any;
    // NUEVO: descuentos por promoción
    discount?: number;
    promotionName?: string | null;
    // NUEVO: combos
    isCombo?: boolean;
    comboComponents?: ComboComponentSelection[];
};
```

**6.2 — Importar promotionUtils** (igual que `order.tsx`).

**6.3 — Cargar `GET_ACTIVE_PROMOTIONS` al montar:**

```typescript
const { data: promotionsData } = useQuery(GET_ACTIVE_PROMOTIONS, {
    variables: { branchId: companyData?.branch?.id },
    skip: !companyData?.branch?.id,
    fetchPolicy: "network-only",
});
const [activePromotions, setActivePromotions] = useState<IPromotion[]>([]);
const [giftMessage, setGiftMessage] = useState<string | null>(null);

useEffect(() => {
    if (promotionsData?.activePromotions) {
        setActivePromotions(promotionsData.activePromotions);
    }
}, [promotionsData]);
```

**6.4 — Función `recalculatePromotions`** (idéntica a la de `order.tsx`, adaptada a `CartItem`):

```typescript
const recalculatePromotions = useCallback((items: CartItem[], promotions: IPromotion[]) => {
    if (promotions.length === 0) return items;
    const cartTotal = items.reduce((sum, it) => sum + it.price * it.quantity - (it.discount ?? 0), 0);

    let updated = items.map(item => {
        if (item.isCombo || !item.product) return { ...item, discount: 0, promotionName: null };
        const promo = findBestDiscountPromotion(item.product, promotions, cartTotal);
        if (promo) {
            return { ...item, discount: calculateLineDiscount(item.price, item.quantity, promo), promotionName: promo.name };
        }
        return { ...item, discount: 0, promotionName: null };
    });

    // NxM
    const nxmPromos = promotions.filter(p => p.promotionType === 'NXM');
    if (nxmPromos.length > 0) {
        const lines: CartLine[] = updated
            .map((item, idx) => item.product ? { index: idx, product: item.product, unitPrice: item.price, quantity: item.quantity, isGift: false } : null)
            .filter(Boolean) as CartLine[];
        const freeSet = computeNxMFreeSet(lines, nxmPromos);
        freeSet.forEach((promoName, idx) => {
            updated[idx] = { ...updated[idx], discount: Math.round(updated[idx].price * updated[idx].quantity * 100) / 100, promotionName: promoName };
        });
    }

    // GIFT notification
    const newTotal = updated.reduce((sum, it) => sum + it.price * it.quantity - (it.discount ?? 0), 0);
    const giftPromo = promotions.find(p => p.promotionType === 'GIFT' && newTotal >= p.minPurchaseAmount && p.giftProduct);
    setGiftMessage(giftPromo ? `¡Regalo disponible! ${giftPromo.giftProduct?.name} × ${giftPromo.giftQuantity ?? 1} — ${giftPromo.name}` : null);

    return updated;
}, []);

useEffect(() => {
    if (activePromotions.length > 0 && cartItems.length > 0) {
        setCartItems(prev => recalculatePromotions(prev, activePromotions));
    }
}, [activePromotions, cartItems.length]);
```

**6.5 — Mostrar badge de promoción en tarjetas de producto** (igual que `order.tsx` sección 5.6).

**6.6 — Banner de regalo disponible** (igual que `order.tsx` sección 5.7).

**6.7 — Mostrar descuento en el carrito** (igual que `order.tsx` sección 5.8).

**6.8 — Agregar filtro PROMOTION en búsqueda:**

```typescript
// Buscar también productos tipo PROMOTION (combos) — igual que order.tsx
function isCartSearchProduct(p: any) {
    const t = p?.productType;
    return t === "DISH" || t === "BEVERAGE" || t === "PROMOTION";
}
```

**6.9 — Estado y handler para combos** (igual que `order.tsx` sección 5.9 pero con `CartItem`).

**6.10 — Botón "Combos"** (igual que `order.tsx` sección 5.10).

**6.11 — Renderizar componentes del combo en el carrito** (igual que `order.tsx` sección 5.11).

**6.12 — Incluir `discount` y `comboComponents` al construir `items` para `CREATE_SALE_CARRY_OUT`:**

```typescript
const items = cartItems.map(item => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.price,
    discount: item.discount ?? 0,          // NUEVO: descuento calculado
    notes: item.notes || null,
    comboComponents: item.isCombo && item.comboComponents
        ? item.comboComponents.map(comp => ({
              productId: comp.product.id,
              quantity: comp.quantity,     // NO multiplicar por item.quantity
          }))
        : undefined,
}));
```

> **NOTA:** Verificar que `CarryOutItemInput` en el backend acepte `comboComponents` y `discount`. Ver sección Backend más abajo.

**6.13 — Montar el modal al final del JSX** (igual que `order.tsx` sección 5.13).

---

### ARCHIVO 7 — `src/modules/products/createProduct.tsx`

**Agregar opción PROMOTION al select de tipo de producto** (línea ~411):

```tsx
// Antes:
<option value="DISH">Plato</option>
<option value="BEVERAGE">Bebida</option>
<option value="INGREDIENT">Ingrediente</option>

// Después:
<option value="DISH">Plato</option>
<option value="BEVERAGE">Bebida</option>
<option value="INGREDIENT">Ingrediente</option>
<option value="PROMOTION">Promoción / Combo</option>
```

**Cuando productType === "PROMOTION":**
- No mostrar campos de precio de compra / stock (o mostrarlos opcionalmente)
- El precio de venta SÍ se muestra (es el precio del combo completo)
- Después de crear el producto, el usuario debe ir a la pantalla de gestión de promociones para vincular la promoción/scopes

---

### ARCHIVO 8 — `src/modules/products/editProduct.tsx`

Mismo cambio que `createProduct.tsx`: agregar opción `PROMOTION` al select.

---

### ARCHIVO 9 — `src/modules/products/listProduct.tsx`

**Agregar badge visual para productos tipo PROMOTION:**

```tsx
{product.productType === "PROMOTION" && (
    <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded font-semibold">
        COMBO
    </span>
)}
```

---

### ARCHIVO 10 — `src/modules/products/promotionManagement.tsx` *(REQUERIDO)*

Esta pantalla es obligatoria. Sin ella no se pueden crear ni editar promociones desde Electron. El backend ya tiene las mutations y queries listas.

**Ruta:** `/products/promotions`

**Navegación:** Agregar enlace en el menú lateral de productos (junto a "Productos", "Categorías", etc.)

**Registro de ruta en `App.tsx`:**
```tsx
// Importar componente
import PromotionManagement from "./modules/products/promotionManagement";

// Agregar ruta dentro del router:
<Route path="/products/promotions" element={<PromotionManagement />} />
```

---

#### 10.1 — Tipos de promoción (`promotionType`)

| Valor | Descripción |
|---|---|
| `COMBO` | Producto tipo PROMOTION con scopes de elección |
| `DISCOUNT_PERCENT` | Descuento porcentual sobre el total o productos del scope |
| `DISCOUNT_AMOUNT` | Descuento fijo en soles |
| `NXM` | Compra N lleva M (ejemplo: 2x1) |
| `GIFT` | Regalo: al comprar X, obtienes Y gratis |

---

#### 10.2 — Estructura del componente

**Estados principales:**
```typescript
const [promotions, setPromotions] = useState<Promotion[]>([]);
const [showForm, setShowForm] = useState(false);
const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
const [activeTab, setActiveTab] = useState<'COMBO' | 'DISCOUNT_PERCENT' | 'DISCOUNT_AMOUNT' | 'NXM' | 'GIFT'>('COMBO');
```

**Queries utilizadas:**
```typescript
const { data, refetch } = useQuery(GET_PROMOTIONS_BY_BRANCH, {
    variables: { branchId: companyData.branch.id },
    fetchPolicy: "network-only",
});
```

**Mutations utilizadas:**
```typescript
const [createPromotion] = useMutation(CREATE_PROMOTION, {
    onCompleted: () => { refetch(); setShowForm(false); }
});
const [updatePromotion] = useMutation(UPDATE_PROMOTION, {
    onCompleted: () => { refetch(); setShowForm(false); setEditingPromotion(null); }
});
```

---

#### 10.3 — UI del listado

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  Gestión de Promociones           [+ Nueva Promoción]   │
│                                                         │
│  [COMBO] [DESCUENTO%] [DESCUENTO S/] [NxM] [REGALO]    │
│  (tabs para filtrar por tipo)                           │
│                                                         │
│  ┌──────────────────────────────────────────────┐       │
│  │ 🌟 Menú Ejecutivo          COMBO    ● Activa │       │
│  │ Lu-Vi • 11:00-15:00                [Editar]  │       │
│  │ 3 scopes (Entrada, Sopa, Segundo)            │       │
│  └──────────────────────────────────────────────┘       │
│  ┌──────────────────────────────────────────────┐       │
│  │ 🏷️ Desc. 10% Bebidas    DESCUENTO%  ● Activa │       │
│  │ Todos los días                     [Editar]  │       │
│  └──────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

**Card de cada promoción:**
```tsx
<div className="border rounded-lg p-4 flex justify-between items-start">
    <div>
        <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{promo.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                promo.promotionType === 'COMBO' ? 'bg-orange-500' :
                promo.promotionType === 'DISCOUNT_PERCENT' ? 'bg-blue-500' :
                promo.promotionType === 'DISCOUNT_AMOUNT' ? 'bg-green-600' :
                promo.promotionType === 'NXM' ? 'bg-purple-500' : 'bg-yellow-500'
            } text-white`}>
                {promo.promotionType}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
                promo.isActive ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
            }`}>
                {promo.isActive ? 'Activa' : 'Inactiva'}
            </span>
        </div>
        <div className="text-xs text-gray-400 mt-1">{promo.daysDisplay}</div>
        {promo.promotionType === 'COMBO' && (
            <div className="text-xs text-orange-300 mt-0.5">
                {promo.scopes?.length} scopes: {promo.scopes?.map(s => s.label || s.scopeLabel).join(', ')}
            </div>
        )}
        {promo.promotionType === 'DISCOUNT_PERCENT' && (
            <div className="text-xs text-blue-300 mt-0.5">{promo.discountPercent}% de descuento</div>
        )}
        {promo.promotionType === 'DISCOUNT_AMOUNT' && (
            <div className="text-xs text-green-300 mt-0.5">S/ {promo.discountAmount} de descuento</div>
        )}
        {promo.promotionType === 'NXM' && (
            <div className="text-xs text-purple-300 mt-0.5">
                Compra {promo.buyQuantity} lleva {promo.getQuantity}
            </div>
        )}
    </div>
    <button
        onClick={() => { setEditingPromotion(promo); setShowForm(true); }}
        className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded"
    >
        Editar
    </button>
</div>
```

---

#### 10.4 — Formulario de creación/edición

El formulario muestra campos dinámicos según `promotionType`.

**Campos comunes (siempre visibles):**
```tsx
<input name="name" placeholder="Nombre de la promoción" />
<select name="promotionType">
    <option value="COMBO">Combo / Menú</option>
    <option value="DISCOUNT_PERCENT">Descuento porcentual (%)</option>
    <option value="DISCOUNT_AMOUNT">Descuento fijo (S/)</option>
    <option value="NXM">N × M (Lleva más pagando menos)</option>
    <option value="GIFT">Regalo al comprar</option>
</select>
<input type="checkbox" name="isActive" /> Activa
<input type="date" name="validFrom" /> Desde
<input type="date" name="validTo" /> Hasta
{/* Días de la semana: checkboxes Lu Ma Mi Ju Vi Sa Do */}
<input type="time" name="timeFrom" /> Hora inicio
<input type="time" name="timeTo" /> Hora fin
<input type="number" name="priority" placeholder="Prioridad (mayor = primero)" />
```

**Campos por tipo:**

```tsx
{/* DISCOUNT_PERCENT */}
{formData.promotionType === 'DISCOUNT_PERCENT' && (
    <>
        <input type="number" name="discountPercent" placeholder="% descuento (ej: 10)" />
        <input type="number" name="minPurchaseAmount" placeholder="Monto mínimo de compra" />
        <select name="appliesTo">
            <option value="ALL">Todo el pedido</option>
            <option value="SCOPE">Solo productos del scope</option>
        </select>
    </>
)}

{/* DISCOUNT_AMOUNT */}
{formData.promotionType === 'DISCOUNT_AMOUNT' && (
    <>
        <input type="number" name="discountAmount" placeholder="Descuento en S/" />
        <input type="number" name="minPurchaseAmount" placeholder="Monto mínimo de compra" />
    </>
)}

{/* NXM */}
{formData.promotionType === 'NXM' && (
    <>
        <input type="number" name="buyQuantity" placeholder="Cantidad a comprar (N)" />
        <input type="number" name="getQuantity" placeholder="Cantidad a llevar (M)" />
    </>
)}

{/* GIFT */}
{formData.promotionType === 'GIFT' && (
    <>
        {/* ProductSearchInput para elegir el producto regalo */}
        <input type="number" name="giftQuantity" placeholder="Cantidad de regalo" />
        <input type="number" name="minPurchaseAmount" placeholder="Monto mínimo para activar" />
    </>
)}

{/* COMBO — gestión de scopes */}
{formData.promotionType === 'COMBO' && (
    <ScopeEditor scopes={formData.scopes} onChange={newScopes => setFormData(f => ({...f, scopes: newScopes}))} />
)}
```

---

#### 10.5 — Subcomponente `ScopeEditor`

Para el tipo COMBO, el formulario incluye un editor de scopes:

```typescript
interface ScopeEditorProps {
    scopes: ScopeFormItem[];
    onChange: (scopes: ScopeFormItem[]) => void;
}

interface ScopeFormItem {
    id?: string;         // si existe = edición
    label: string;       // ej: "Entrada"
    scopeLabel: string;  // ej: "Elige tu entrada"
    requiredQuantity: number;
    scopeType: 'subcategory' | 'category' | 'product'; // tipo de relación
    subcategoryId?: string;
    categoryId?: string;
    productId?: string;
}
```

**UI del ScopeEditor:**
```
┌─ Scopes del combo ─────────────────────────────────┐
│  [+ Agregar scope]                                  │
│                                                     │
│  ┌── Scope 1 ────────────────────────────────────┐  │
│  │ Etiqueta: [Entrada          ]                 │  │
│  │ Texto:    [Elige tu entrada ]                 │  │
│  │ Cantidad: [1]                                 │  │
│  │ Tipo: (●) Subcategoría  ( ) Categoría  ( ) Producto fijo │
│  │ Subcategoría: [▼ Entradas          ]          │  │
│  │                                  [Eliminar]   │  │
│  └───────────────────────────────────────────────┘  │
│  ┌── Scope 2 ────────────────────────────────────┐  │
│  │ ...                                           │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

Cada scope tiene un select para elegir `subcategoryId` (carga con `GET_SUBCATEGORIES_BY_BRANCH` o similar) o `productId` (campo de búsqueda de producto).

---

#### 10.6 — Guardar la promoción

```typescript
const handleSave = async () => {
    const variables = {
        branchId: companyData.branch.id,
        name: formData.name,
        promotionType: formData.promotionType,
        isActive: formData.isActive,
        validFrom: formData.validFrom || null,
        validTo: formData.validTo || null,
        daysOfWeek: formData.daysOfWeek.join(','), // ej: "1,2,3,4,5" (lunes=1, domingo=7)
        timeFrom: formData.timeFrom || null,
        timeTo: formData.timeTo || null,
        discountPercent: formData.discountPercent || null,
        discountAmount: formData.discountAmount || null,
        buyQuantity: formData.buyQuantity || null,
        getQuantity: formData.getQuantity || null,
        giftProductId: formData.giftProductId || null,
        giftQuantity: formData.giftQuantity || null,
        minPurchaseAmount: formData.minPurchaseAmount || null,
        appliesTo: formData.appliesTo || 'ALL',
        priority: formData.priority || 0,
        scopes: formData.promotionType === 'COMBO'
            ? formData.scopes.map(s => ({
                subcategoryId: s.subcategoryId || null,
                categoryId: s.categoryId || null,
                productId: s.productId || null,
                requiredQuantity: s.requiredQuantity,
                label: s.label,
                scopeLabel: s.scopeLabel,
              }))
            : [],
    };

    if (editingPromotion) {
        await updatePromotion({ variables: { promotionId: editingPromotion.id, ...variables } });
    } else {
        await createPromotion({ variables });
    }
};
```

---

### ARCHIVO 11 — `src/modules/cash/cashPay.tsx` *(REQUERIDO)*

Esta pantalla ya tiene campos de descuento manual (`discountAmount` y `discountPercent`). Se deben agregar TODAS las siguientes mejoras — exactamente como en Android:

1. Mostrar los componentes de combos en la lista de detalles de la operación
2. Mostrar descuentos aplicados por ítem (DISCOUNT_PERCENT / DISCOUNT_AMOUNT)
3. Mostrar información de NxM aplicado por ítem
4. Cargar todas las promociones activas y mostrarlas como botones de aplicación rápida
5. Banner de GIFT si el total de la operación cumple el mínimo

---

#### 11.1 — Actualizar `GET_OPERATION_BY_ID` en queries.ts

Ya documentado en ARCHIVO 1 sección 1.1. Agregar `productType`, `discount` y `comboComponents` al bloque `details`:

```graphql
# En GET_OPERATION_BY_ID → details {
productType
discount          # descuento por línea (si el backend lo devuelve)
comboComponents {
    productName
    quantity
}
```

---

#### 11.2 — Mostrar componentes de combo en el detalle de la operación

En `cashPay.tsx`, la lista de detalles de la operación (línea ~2700-2800) renderiza cada `detail`. Actualizar cada fila:

```tsx
{details.map((detail, index) => (
    <div key={index} className="...">
        <div className="flex justify-between items-center">
            <span>{detail.quantity}x {detail.productDescription}</span>
            <span>S/ {detail.unitPrice}</span>
        </div>

        {/* NUEVO: descuento por ítem (DISCOUNT_PERCENT / DISCOUNT_AMOUNT / NxM) */}
        {(detail.discount ?? 0) > 0 && (
            <div className="text-xs text-green-400 ml-4 flex items-center gap-1">
                <span>Descuento: -S/ {Number(detail.discount).toFixed(2)}</span>
            </div>
        )}

        {/* NUEVO: componentes del combo */}
        {detail.productType === 'PROMOTION' && detail.comboComponents?.length > 0 && (
            <div className="ml-4 mt-1 space-y-0.5">
                {detail.comboComponents.map((comp: any, ci: number) => (
                    <div key={ci} className="text-xs text-orange-300 flex items-center gap-1">
                        <span>•</span>
                        <span>{comp.productName}</span>
                        {comp.quantity > 1 && <span className="text-gray-400">×{comp.quantity}</span>}
                    </div>
                ))}
            </div>
        )}

        {detail.notes && <div className="text-xs text-gray-400 ml-4">{detail.notes}</div>}
    </div>
))}
```

---

#### 11.3 — Cargar TODAS las promociones activas en cashPay

```typescript
import {
    promotionBadgeLabel,
} from '../../utils/promotionUtils';
import type { IPromotion } from '../../types/promotions';

// Cerca de los otros useQuery del componente
const { data: promotionsData } = useQuery(GET_ACTIVE_PROMOTIONS, {
    variables: { branchId: companyData?.branch?.id },
    skip: !companyData?.branch?.id,
    fetchPolicy: "network-only",
});

const activePromotions: IPromotion[] = promotionsData?.activePromotions || [];

// Separar por tipo para la UI
const discountPromotions = activePromotions.filter(
    p => p.promotionType === 'DISCOUNT_PERCENT' || p.promotionType === 'DISCOUNT_AMOUNT'
);
const nxmPromotions  = activePromotions.filter(p => p.promotionType === 'NXM');
const giftPromotions = activePromotions.filter(p => p.promotionType === 'GIFT');
```

---

#### 11.4 — Banner de GIFT en cashPay

Basado en el total de la operación (se calcula del `totalAmount` ya cargado):

```tsx
{(() => {
    const operationTotal = Number(operationData?.operationById?.totalAmount ?? 0);
    const giftPromo = giftPromotions.find(p =>
        operationTotal >= p.minPurchaseAmount && p.giftProduct
    );
    if (!giftPromo) return null;
    return (
        <div className="bg-yellow-500 text-black text-sm px-3 py-2 rounded-lg flex items-center gap-2 font-semibold mb-3 animate-pulse">
            🎁 ¡Regalo disponible! {giftPromo.giftProduct?.name} × {giftPromo.giftQuantity ?? 1} — {giftPromo.name}
        </div>
    );
})()}
```

---

#### 11.5 — Botones de aplicación rápida de TODAS las promociones de descuento

En la zona de pago (líneas ~2867-2916), encima de los campos manuales "Desc S/" y "Desc %":

```tsx
{activePromotions.filter(p => p.promotionType !== 'COMBO' && p.promotionType !== 'GIFT').length > 0 && (
    <div className="mb-3">
        <div className="text-xs text-gray-400 mb-1 font-semibold">Aplicar promoción rápida:</div>
        <div className="flex flex-wrap gap-2">
            {/* DISCOUNT_PERCENT */}
            {discountPromotions.map(promo => (
                <button
                    key={promo.id}
                    onClick={() => {
                        if (promo.promotionType === 'DISCOUNT_PERCENT') {
                            setDiscountPercent(String(promo.discountPercent ?? 0));
                            setDiscountAmount('0');
                        } else {
                            setDiscountAmount(String(promo.discountAmount ?? 0));
                            setDiscountPercent('0');
                        }
                    }}
                    className="text-xs bg-blue-800 hover:bg-blue-700 text-blue-200 border border-blue-600 px-2 py-1 rounded-full font-semibold transition-colors"
                    title={promo.name}
                >
                    {promotionBadgeLabel(promo)} — {promo.name}
                </button>
            ))}
            {/* NxM — solo informativo en cashPay, el descuento ya está en los ítems */}
            {nxmPromotions.map(promo => (
                <span
                    key={promo.id}
                    className="text-xs bg-purple-800 text-purple-200 border border-purple-600 px-2 py-1 rounded-full font-semibold"
                    title={`${promo.name} — aplicado automáticamente por ítem`}
                >
                    {promotionBadgeLabel(promo)} — {promo.name}
                </span>
            ))}
        </div>
        <div className="text-xs text-gray-500 mt-1">
            * NxM se aplica automáticamente por ítem en el pedido.
        </div>
    </div>
)}

{/* Campos manuales existentes — sin cambiar */}
{/* "Desc S/" y "Desc %" ya existen en el código */}
```

---

#### 11.6 — Resumen de cambios en cashPay.tsx

| Qué | Dónde | Qué agregar |
|---|---|---|
| Importar `GET_ACTIVE_PROMOTIONS` | Header imports | desde `../graphql/queries` |
| Importar `promotionBadgeLabel` | Header imports | desde `../../utils/promotionUtils` |
| Cargar todas las promociones | Sección queries | `useQuery(GET_ACTIVE_PROMOTIONS, ...)` |
| Separar por tipo | Después del useQuery | `discountPromotions`, `nxmPromotions`, `giftPromotions` |
| Banner GIFT | Encima del detalle de la operación | JSX condicional (ver 11.4) |
| Descuento por ítem | Dentro del map de detalles | Sub-fila verde `-S/ X` |
| Componentes combo | Dentro del map de detalles | Sub-lista naranja para `productType === 'PROMOTION'` |
| Botones promo rápida | Encima de campos Desc S/ y Desc % | Botones azul (DISCOUNT) + badge púrpura (NxM) |

---

## Verificación en Backend Django

Antes de implementar en Electron, confirmar en el backend:

### ✅ Ya está listo (no tocar):
- `activeCombos(branchId)` query → devuelve productos PROMOTION con `asPromotion.scopes`
- `OperationDetailInput` acepta `comboComponents: [ComboComponentInput]`
- `CreateOperationMutation` y `AddItemsToOperationMutation` procesan `comboComponents`
- La multiplicación de cantidad la hace el BACKEND: `comp_quantity * detail_quantity`

### ⚠️ Verificar:
- `CarryOutItemInput` (usado en `CREATE_SALE_CARRY_OUT`) — confirmar si acepta `comboComponents`. Si no:
  - Abrir `apps/finances/mutations.py` → buscar `CarryOutItemInput`
  - Agregar `combo_components = graphene.List(ComboComponentInputType)` si falta
  - Agregar lógica de creación de `ComboComponent` en la mutation de carry out

---

## Resumen de archivos a tocar

| Archivo | Tipo de cambio |
|---|---|
| `src/graphql/queries.ts` | Actualizar `GET_OPERATION_BY_ID`; agregar `GET_ACTIVE_COMBOS`, `GET_ACTIVE_PROMOTIONS`, `GET_PROMOTIONS_BY_BRANCH`, `GET_PROMOTION_BY_ID` |
| `src/graphql/mutations.ts` | Agregar `CREATE_PROMOTION`, `UPDATE_PROMOTION`; verificar `CarryOutItemInput` |
| `src/types/promotions.ts` | **CREAR**: `IPromotion`, `IPromotionScope`, `ComboProduct`, `ComboScope`, `ComboComponentSelection`, `ComboComponentInput` |
| `src/utils/promotionUtils.ts` | **CREAR**: `promotionAppliesToProduct`, `findBestDiscountPromotion`, `calculateLineDiscount`, `promotionBadgeLabel`, `findBadgePromotion`, `computeNxMFreeSet` |
| `src/components/ComboSelectorModal.tsx` | **CREAR**: modal de selección de combo |
| `src/modules/sales/order.tsx` | `OrderItem` + `discount/promotionName`, cargar `GET_ACTIVE_PROMOTIONS`, `recalculatePromotions()`, badges, banner GIFT, combos, enviar `discount` |
| `src/modules/sales/delivery.tsx` | Igual que `order.tsx` adaptado a `CartItem` y `CREATE_SALE_CARRY_OUT` |
| `src/modules/cash/cashPay.tsx` | Componentes combo, descuento por ítem, banner GIFT, botones de todas las promos activas |
| `src/modules/products/createProduct.tsx` | Agregar opción PROMOTION en select |
| `src/modules/products/editProduct.tsx` | Agregar opción PROMOTION en select |
| `src/modules/products/listProduct.tsx` | Badge visual para PROMOTION |
| `src/modules/products/promotionManagement.tsx` | **CREAR** (REQUERIDO): listado, formulario dinámico por tipo, ScopeEditor |
| `App.tsx` | Agregar ruta `/products/promotions` |

---

## Orden recomendado de implementación

1. `src/graphql/queries.ts` — actualizar `GET_OPERATION_BY_ID` + agregar las 4 queries nuevas
2. `src/graphql/mutations.ts` — agregar `CREATE_PROMOTION` y `UPDATE_PROMOTION`
3. `src/types/promotions.ts` — tipos base (todo depende de esto)
4. `src/utils/promotionUtils.ts` — lógica de cálculo (depende de los tipos)
5. `src/components/ComboSelectorModal.tsx` — modal central de combos
6. `src/modules/sales/order.tsx` — combos + auto-descuentos + NxM + GIFT en órdenes de mesa
7. `src/modules/sales/delivery.tsx` — igual para punto de venta / takeout
8. `src/modules/cash/cashPay.tsx` — combos + todas las promos en caja
9. `src/modules/products/createProduct.tsx` + `editProduct.tsx` + `listProduct.tsx` — tipo PROMOTION
10. `src/modules/products/promotionManagement.tsx` + ruta en `App.tsx` — pantalla de gestión

---

## Notas críticas para la implementación

1. **NO multiplicar `comp.quantity` por `item.quantity` en el frontend.** El backend Django ya hace esa multiplicación. Solo enviar `comp.quantity` (la cantidad por unidad de combo, típicamente 1).

2. **Filtro de stock en scopes:** si `managesStock = true && currentStock <= 0`, el producto no debe aparecer en el scope. Si `managesStock = false`, siempre aparece.

3. **Los combos no se agrupan** en el carrito al repetir (cada combo es una fila independiente con sus propios componentes).

4. **El precio del combo** es el `salePrice` del producto PROMOTION, no la suma de componentes.

5. **Las notas del combo** van en el campo `notes` del `OrderItem` normal (el modal de observaciones puede usarse igual).

6. **`GET_OPERATION_BY_ID` actualizado** es necesario para que `cashPay.tsx` muestre los componentes del combo y los descuentos por ítem. Sin ese cambio, `productType`, `discount` y `comboComponents` llegarían como `undefined`.

7. **NxM en `order.tsx` y `delivery.tsx`:** los ítems más baratos del grupo obtienen `discount = unitPrice × quantity` (100% gratis). La función `computeNxMFreeSet` de `promotionUtils.ts` calcula esto. Llamar `recalculatePromotions` cada vez que se agrega, elimina o cambia cantidad de un ítem.

8. **GIFT en `order.tsx` y `delivery.tsx`:** solo es una notificación (`giftMessage`). El mozo agrega el regalo manualmente como ítem normal. No hay lógica automática de inserción de ítems.

9. **GIFT en `cashPay.tsx`:** se evalúa sobre el `totalAmount` de la operación ya guardada. Si el total cumple el `minPurchaseAmount`, se muestra el banner amarillo.

10. **`recalculatePromotions` — evitar bucle infinito:** llamar la función explícitamente en `handleAddProduct`, `handleRemoveItem` y `handleUpdateQuantity`, no dentro de un `useEffect` que observe `orderItems` directamente (causaría bucle). Observar solo `orderItems.length` o el array de promociones.

11. **Descuento en `OperationDetailInput`:** verificar que el campo `discount` está en `OperationDetailInput` (backend Django `apps/finances/types.py`). En `CarryOutItemInput` ya está — confirmado en Android. Si no está en `OperationDetailInput`, el descuento en órdenes de mesa es solo visual hasta que se añada.

12. **`daysOfWeek`** se almacena como string CSV de números (1=lunes … 7=domingo). En el formulario usar checkboxes y serializar como `[1,2,3,4,5].join(',')`.

13. **La ruta `/products/promotions`** debe estar protegida con el mismo guard de autenticación que el resto de las rutas de productos.
