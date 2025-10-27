import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import type { AuthContextType } from '../context/AuthContext';

/**
 * Hook personalizado para acceder al contexto de autenticación
 * Este hook proporciona acceso a todos los métodos y estado de autenticación
 * desde cualquier componente de la aplicación
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  
  return context;
}; 