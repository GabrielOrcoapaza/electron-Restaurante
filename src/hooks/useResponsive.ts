import { useState, useEffect } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface UseResponsiveReturn {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  breakpoint: Breakpoint;
}

/**
 * Hook para detectar el tamaño de pantalla y proporcionar breakpoints responsive
 * Solo para pantallas de PC (desktop), no para móviles o tablets
 * 
 * Breakpoints (solo desktop):
 * - lg: 1024px - 1279px (desktop pequeño/monitores pequeños)
 * - xl: 1280px - 1535px (desktop medio/monitores estándar)
 * - 2xl: >= 1536px (desktop grande/monitores grandes y ultra wide)
 */
export const useResponsive = (): UseResponsiveReturn => {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Establecer dimensiones iniciales
    handleResize();

    // Escuchar cambios de tamaño
    window.addEventListener('resize', handleResize);

    // Limpiar listener al desmontar
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const getBreakpoint = (width: number): Breakpoint => {
    if (width < 640) return 'xs';
    if (width < 768) return 'sm';
    if (width < 1024) return 'md';
    if (width < 1280) return 'lg';
    if (width < 1536) return 'xl';
    return '2xl';
  };

  const breakpoint = getBreakpoint(dimensions.width);
  const isMobile = dimensions.width < 768;
  const isTablet = dimensions.width >= 768 && dimensions.width < 1024;
  const isDesktop = dimensions.width >= 1024;

  return {
    width: dimensions.width,
    height: dimensions.height,
    isMobile,
    isTablet,
    isDesktop,
    breakpoint,
  };
};
