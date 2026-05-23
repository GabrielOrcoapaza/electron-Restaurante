/*import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useResponsive } from "../../hooks/useResponsive";
import { GET_ACTIVE_COMBOS } from "../../graphql/queries";
/* Este es el componente más importante. Reemplaza al `ComboSelectorDialog` de Android. Es un modal que:

1. Paso 1: Lista todos los combos disponibles (tarjetas clicables)
2. Paso 2: Para el combo elegido, muestra cada scope con sus productos para elegir
3. Confirmar: Llama a `onConfirm(combo, componentsElegidos)`

**Estructura del componente:** 

interface ComboSelectorModalProps {
    branchId: string;
    onConfirm: (combo: ComboProduct, components: ComboComponentSelection[]) => void;
    onClose: () => void;
}


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
}; */
