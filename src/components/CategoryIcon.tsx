import React from 'react';
import { categoryIconFromIdOrDefault, subcategoryIconFromIdOrDefault } from '../constants/categoryIcons';

type IconType = 'category' | 'subcategory';

interface CategoryIconProps {
  /** ID del icono (ej: "local_drink", "restaurant") */
  iconId: string | null | undefined;
  /** category = usar lista de categorías, subcategory = subcategorías */
  type?: IconType;
  /** Tamaño en rem o px */
  size?: string | number;
  /** Estilo adicional */
  style?: React.CSSProperties;
  /** Clase CSS adicional */
  className?: string;
}

/**
 * Renderiza un icono Material para categoría o subcategoría.
 * Usa la fuente Material Icons (Google Fonts).
 */
const CategoryIcon: React.FC<CategoryIconProps> = ({
  iconId,
  type = 'category',
  size = '1.5rem',
  style = {},
  className = '',
}) => {
  const resolvedId = type === 'category'
    ? categoryIconFromIdOrDefault(iconId)
    : subcategoryIconFromIdOrDefault(iconId);

  const fontSize = typeof size === 'number' ? `${size}px` : size;

  return (
    <span
      className={`material-icons ${className}`}
      style={{
        fontSize,
        ...style,
      }}
      aria-hidden
    >
      {resolvedId}
    </span>
  );
};

export default CategoryIcon;
