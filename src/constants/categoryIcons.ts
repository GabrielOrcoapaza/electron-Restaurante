/**
 * Iconos disponibles para categorías y subcategorías.
 * IDs coinciden con Material Icons (https://fonts.google.com/icons).
 * Sincronizado con la app Android/Kotlin.
 */
export interface IconOption {
  id: string;
  label: string;
}

export const CATEGORY_ICONS: IconOption[] = [
  { id: 'local_drink', label: 'Bebidas' },
  { id: 'water_drop', label: 'Bebidas puras' },
  { id: 'restaurant', label: 'Parrillas' },
  { id: 'lunch_dining', label: 'Ceviches' },
  { id: 'outdoor_grill', label: 'Parrillas' },
  { id: 'soup_kitchen', label: 'Sopas' },
  { id: 'restaurant_menu', label: 'Entradas' },
  { id: 'cake', label: 'Postres' },
  { id: 'local_pizza', label: 'Pizzas' },
  { id: 'ramen_dining', label: 'Polladas' },
  { id: 'breakfast_dining', label: 'Desayunos' },
  { id: 'dinner_dining', label: 'Comidas' },
  { id: 'bakery_dining', label: 'Panadería' },
  { id: 'icecream', label: 'Helados' },
  { id: 'category', label: 'Otros' },
];

export const SUBCATEGORY_ICONS: IconOption[] = [
  { id: 'local_drink', label: 'Bebidas' },
  { id: 'local_cafe', label: 'Cafés' },
  { id: 'water_drop', label: 'Agua' },
  { id: 'sports_bar', label: 'Gaseosas' },
  { id: 'emoji_food_beverage', label: 'Jugos' },
  { id: 'wine_bar', label: 'Vinos' },
  { id: 'liquor', label: 'Licores' },
  { id: 'tea', label: 'Tés / Mates' },
  { id: 'breakfast_dining', label: 'Desayunos' },
  { id: 'lunch_dining', label: 'Ceviches' },
  { id: 'dinner_dining', label: 'Comidas' },
  { id: 'outdoor_grill', label: 'Parrilla' },
  { id: 'ramen_dining', label: 'Pollo' },
  { id: 'set_meal', label: 'Cerdo' },
  { id: 'kebab_dining', label: 'Res' },
  { id: 'local_pizza', label: 'Pizzas' },
  { id: 'restaurant_menu', label: 'Entradas' },
  { id: 'soup_kitchen', label: 'Sopas' },
  { id: 'cake', label: 'Postres' },
  { id: 'icecream', label: 'Helados' },
  { id: 'bakery_dining', label: 'Pan' },
  { id: 'cookie', label: 'Galletas' },
  { id: 'egg', label: 'Huevos' },
  { id: 'grain', label: 'Pastas' },
  { id: 'grass', label: 'Ensaladas' },
  { id: 'takeout_dining', label: 'Para llevar' },
  { id: 'room_service', label: 'Servicio' },
  { id: 'nightlife', label: 'Nocturno' },
  { id: 'brunch_dining', label: 'Brunch' },
  { id: 'category', label: 'Otros' },
];

const VALID_CATEGORY_IDS = new Set(CATEGORY_ICONS.map((i) => i.id));
const VALID_SUBCATEGORY_IDS = new Set(SUBCATEGORY_ICONS.map((i) => i.id));

/**
 * Normaliza un ID de icono para Material Icons (snake_case, lowercase).
 * Ej: "LocalDrink" -> "local_drink", "local drink" -> "local_drink"
 */
function normalizeIconId(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

/** Obtiene el ID de icono válido para categoría (solo si está en lista) */
export function categoryIconFromId(id: string | null | undefined): string | undefined {
  if (!id || !id.trim()) return undefined;
  const normalized = normalizeIconId(id);
  if (VALID_CATEGORY_IDS.has(normalized)) return normalized;
  return undefined;
}

/** Obtiene el ID de icono válido para subcategoría (solo si está en lista) */
export function subcategoryIconFromId(id: string | null | undefined): string | undefined {
  if (!id || !id.trim()) return undefined;
  const normalized = normalizeIconId(id);
  if (VALID_SUBCATEGORY_IDS.has(normalized)) return normalized;
  return undefined;
}

/**
 * ID de icono para categoría. Acepta cualquier ID de Material Icons (no solo la lista).
 * Si viene vacío o no coincide, usa "category".
 */
export function categoryIconFromIdOrDefault(id: string | null | undefined): string {
  if (!id || !id.trim()) return 'category';
  const normalized = normalizeIconId(id);
  if (VALID_CATEGORY_IDS.has(normalized)) return normalized;
  // Permitir cualquier nombre de Material Icons (snake_case, ej: local_drink, restaurant)
  return normalized || 'category';
}

/**
 * ID de icono para subcategoría. Acepta cualquier ID de Material Icons (no solo la lista).
 * Si viene vacío o no coincide, usa "category".
 */
export function subcategoryIconFromIdOrDefault(id: string | null | undefined): string {
  if (!id || !id.trim()) return 'category';
  const normalized = normalizeIconId(id);
  if (VALID_SUBCATEGORY_IDS.has(normalized)) return normalized;
  return normalized || 'category';
}
