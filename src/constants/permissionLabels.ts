/**
 * Lista de códigos de permiso y etiquetas en español.
 * Debe coincidir con el backend (ej. PermissionLabels en Kotlin).
 * Los códigos se manejan en inglés en backend; al usuario se muestra en español.
 */

export const ALL_PERMISSION_CODES: string[] = [
  'users.manage',
  'orders.create',
  'orders.edit',
  'point_of_sale',
  'sales.pay',
  'sales.close',
  'products.view',
  'products.edit_prices',
  'reports.sales',
  'reports.cancellations',
  'reports.sold_products',
  'reports.user_sales',
  'config.manage',
  'kitchen.view',
  'purchases.manage',
  'kardex.view',
  'messages.view',
  'branch.view',
  // cash.void: alias en algunos backends; mismo uso que cash.view en cobro
  'cash.void',
  'cash.register_movements',
  'cash.change_payment_method'
];

const LABELS_ES: Record<string, string> = {
  'users.manage': 'Gestionar usuarios',
  'orders.create': 'Órdenes (mesas / pedidos)',
  'orders.edit': 'Editar órdenes',
  'point_of_sale': 'Punto de venta (para llevar)',
  'sales.pay': 'Cobrar ventas (registrar pagos)',
  'sales.close': 'Cierre de caja',
  'products.view': 'Ver productos',
  'products.edit_prices': 'Editar precios de productos',
  'reports.sales': 'Reporte de ventas',
  'reports.cancellations': 'Reporte de anulados',
  'reports.sold_products': 'Ventas por producto',
  'reports.user_sales': 'Ventas por usuario',
  'config.manage': 'Configuración (impresoras, categorías)',
  'kitchen.view': 'Ver cocina',
  'purchases.manage': 'Gestionar compras',
  'kardex.view': 'Ver kardex',
  'messages.view': 'Ver mensajes',
  'branch.view': 'Ver sede',
  'cash.void': 'Anular en caja (operación o ítems)',
  'cash.register_movements': 'Registrar ingresos y egresos en cierre',
  'cash.change_payment_method': 'Cambiar método de pago (mov. manual)'
};

const DESCRIPTIONS_ES: Record<string, string> = {
  'users.manage': 'Crear, editar usuarios y asignar permisos',
  'orders.create': 'Ver y usar Órdenes (mesas / pedidos)',
  'orders.edit': 'Modificar órdenes ya creadas',
  'point_of_sale': 'Ver y usar Punto de venta (para llevar)',
  'sales.pay': 'Cobrar órdenes y registrar pagos (efectivo, Yape, Plin, etc.)',
  'sales.close': 'Cerrar caja y ver resumen',
  'products.view': 'Consultar productos y precios',
  'products.edit_prices': 'Cambiar precios de platos/productos',
  'reports.sales': 'Ver reporte de ventas',
  'reports.cancellations': 'Ver reporte de anulados',
  'reports.sold_products': 'Ver ventas por producto',
  'reports.user_sales': 'Ver ventas por usuario',
  'config.manage': 'Impresoras, categorías y ajustes',
  'kitchen.view': 'Pantalla de cocina y pedidos',
  'purchases.manage': 'Registrar compras e ingresos',
  'kardex.view': 'Ver movimientos de inventario',
  'messages.view': 'Ver mensajes broadcast',
  'branch.view': 'Ver datos de la sede',
  'cash.void': 'Anular la orden completa o quitar ítems desde la pantalla de cobro',
  'cash.register_movements': 'Registrar ingresos o egresos manuales al cerrar caja',
  'cash.change_payment_method': 'Elegir método de pago en ingresos/egresos manuales (cierre de caja)'
};

/**
 * Devuelve el nombre del permiso en español para mostrar al usuario.
 */
export function getPermissionLabel(code: string): string {
  return LABELS_ES[code] ?? code;
}

/**
 * Descripción corta opcional en español para algunos permisos.
 */
export function getPermissionDescription(code: string): string {
  return DESCRIPTIONS_ES[code] ?? '';
}

/**
 * Lista de permisos con código, etiqueta y descripción para usar en listas/checkboxes.
 */
export interface PermissionOption {
  code: string;
  label: string;
  description: string;
}

export function getPermissionOptions(): PermissionOption[] {
  return ALL_PERMISSION_CODES.map((code) => ({
    code,
    label: getPermissionLabel(code),
    description: getPermissionDescription(code),
  }));
}
