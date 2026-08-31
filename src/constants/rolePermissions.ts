/**
 * Permisos por defecto por rol.
 * Si un usuario no tiene permisos personalizados (customPermissions), se usarán estos.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
    'ADMIN': [
        'users.manage', 'orders.create', 'orders.edit', 'point_of_sale', 'sales.pay', 'sales.close',
        'products.view', 'products.edit_prices', 'recipes.manage',
        'reports.sales', 'reports.cancellations', 'reports.sold_products', 'reports.user_sales',
        'config.manage', 'kitchen.view', 'purchases.manage', 'kardex.view', 'messages.view', 'branch.view',
        'cash.void', 'cash.register_movements', 'cash.change_payment_method'
    ],
    'CASHIER': [
        'orders.create', 'point_of_sale', 'sales.pay', 'sales.close', 'products.view',
        'reports.sales', 'reports.cancellations', 'reports.sold_products', 'reports.user_sales',
        'kitchen.view', 'messages.view', 'branch.view',
        'cash.void', 'cash.register_movements', 'cash.change_payment_method'
    ],
    /** Mismo conjunto que CASHIER (nombre de rol usado en algunos backends / mesas). */
    'CAJA': [
        'orders.create', 'point_of_sale', 'sales.pay', 'sales.close', 'products.view',
        'reports.sales', 'reports.cancellations', 'reports.sold_products', 'reports.user_sales',
        'kitchen.view', 'messages.view', 'branch.view',
        'cash.void', 'cash.register_movements', 'cash.change_payment_method'
    ],
    'WAITER': [
        'orders.create', 'products.view', 'kitchen.view', 'messages.view', 'branch.view'
    ],
    'COOK': [
        'products.view', 'kitchen.view', 'messages.view', 'branch.view'
    ],
};

/**
 * Misma regla que User.get_effective_permissions() en el backend:
 * customPermissions no vacío → solo esos; si no → defaults del rol.
 */
export function getEffectivePermissions(
    role: string,
    customPermissions?: string[] | null,
): string[] {
    const roleUpper = (role || '').toUpperCase();
    const custom = Array.isArray(customPermissions)
        ? customPermissions.filter(Boolean)
        : [];
    if (custom.length > 0) {
        return [...new Set(custom)];
    }
    return ROLE_DEFAULT_PERMISSIONS[roleUpper] ?? [];
}
