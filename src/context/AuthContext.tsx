import React, { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

// Tipos para los datos de autenticación

// Datos de la empresa y sucursal (primer login)
export interface CompanyData {
  company: {
    id: string;
    ruc: string;
    denomination: string;
    email: string;
  };
  branch: {
    id: string;
    name: string;
    address: string;
    users?: Array<{
      id: string;
      firstName: string;
      lastName: string;
      dni: string;
    }>;
  };
  companyLogo?: string;
  branchLogo?: string;
  availableBranches?: any[];
}

// Datos del usuario (segundo login)
export interface UserData {
  id: string;
  dni: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
}

// Tipo del contexto de autenticación
export interface AuthContextType {
  // Estado
  isAuthenticated: boolean;
  token: string | null;
  user: UserData | null;
  companyData: CompanyData | null;
  deviceId: string | null;

  // Métodos de autenticación
  loginCompany: (data: CompanyData) => void;
  loginUser: (token: string, refreshToken: string, userData: UserData, userPhoto?: string) => void;
  logout: () => void;
  
  // Utilidades
  getDeviceId: () => string;
  getMacAddress: () => Promise<string>;
}

// Crear el contexto
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Props del provider
interface AuthProviderProps {
  children: ReactNode;
}

// Provider del contexto
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Cargar datos de localStorage al iniciar
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('userData');
    const storedCompany = localStorage.getItem('companyData');
    const storedDeviceId = localStorage.getItem('device_id');

    if (storedToken) {
      setToken(storedToken);
      setIsAuthenticated(true);
    }

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error al parsear userData:', error);
      }
    }

    if (storedCompany) {
      try {
        setCompanyData(JSON.parse(storedCompany));
      } catch (error) {
        console.error('Error al parsear companyData:', error);
      }
    }

    if (storedDeviceId) {
      setDeviceId(storedDeviceId);
    }
  }, []);


  // Obtener o crear device_id
  const getDeviceId = (): string => {
    if (deviceId) return deviceId;

    const storedDeviceId = localStorage.getItem('device_id');
    if (storedDeviceId) {
      setDeviceId(storedDeviceId);
      return storedDeviceId;
    }

    // Generar device_id de forma síncrona para compatibilidad
    // En una implementación real, esto debería ser asíncrono
    const newDeviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('device_id', newDeviceId);
    setDeviceId(newDeviceId);
    return newDeviceId;
  };

  // Función asíncrona para obtener MAC real
  const getMacAddress = async (): Promise<string> => {
    try {
      console.log('🔍 Intentando obtener MAC del dispositivo...');
      console.log('🔍 typeof window:', typeof window);
      console.log('🔍 window.require existe:', !!(typeof window !== 'undefined' && (window as any).require));
      
      if (typeof window !== 'undefined' && (window as any).require) {
        console.log('✅ Entorno Electron detectado, obteniendo MAC real...');
        const os = (window as any).require('os');
        const networkInterfaces = os.networkInterfaces();
        
        console.log('📡 Interfaces de red disponibles:', Object.keys(networkInterfaces));
        
        for (const interfaceName in networkInterfaces) {
          const interfaces = networkInterfaces[interfaceName];
          if (interfaces) {
            console.log(`🔍 Revisando interfaz: ${interfaceName}`, interfaces);
            for (const iface of interfaces) {
              if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
                const macAddress = iface.mac.toUpperCase();
                console.log('✅ MAC real obtenida:', macAddress);
                console.log('🔍 MAC original:', iface.mac);
                console.log('🔍 MAC normalizada:', macAddress);
                console.log('🔍 Longitud de MAC:', macAddress.length);
                console.log('🔍 Formato de MAC:', macAddress.match(/^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/) ? 'Válido' : 'Inválido');
                return macAddress;
              }
            }
          }
        }
        
        console.log('⚠️ No se encontró MAC válida en Electron');
      } else {
        console.log('🌐 Entorno web detectado, no se puede obtener MAC real');
      }
      
      // Fallback
      const fallback = `FF:${Math.random().toString(16).substring(2, 4).toUpperCase()}:${Math.random().toString(16).substring(2, 4).toUpperCase()}:${Math.random().toString(16).substring(2, 4).toUpperCase()}:${Math.random().toString(16).substring(2, 4).toUpperCase()}:${Math.random().toString(16).substring(2, 4).toUpperCase()}`;
      console.log('⚠️ Usando MAC generada como fallback:', fallback);
      return fallback;
    } catch (error) {
      console.error('❌ Error obteniendo MAC:', error);
      const errorFallback = 'FF:FF:FF:FF:FF:FF';
      console.log('🔄 Usando MAC de error:', errorFallback);
      return errorFallback;
    }
  };

  // Login de empresa (primer paso)
  const loginCompany = (data: CompanyData) => {
    console.log('💼 Guardando datos de empresa:', data);
    localStorage.setItem('companyData', JSON.stringify(data));
    setCompanyData(data);
  };

  // Login de usuario (segundo paso)
  const loginUser = (
    jwtToken: string,
    refreshToken: string,
    userData: UserData,
    userPhoto?: string
  ) => {
    console.log('👤 Guardando datos de usuario:', userData);
    
    // Guardar en localStorage
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('userData', JSON.stringify(userData));
    
    if (userPhoto) {
      localStorage.setItem('userPhoto', userPhoto);
    }

    // Actualizar estado
    setToken(jwtToken);
    setUser(userData);
    setIsAuthenticated(true);
  };

  // Logout
  const logout = () => {
    console.log('🚪 Cerrando sesión...');
    
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('userPhoto');
    localStorage.removeItem('companyData');
    // Mantener device_id para futuros logins

    // Limpiar estado
    setToken(null);
    setUser(null);
    setCompanyData(null);
    setIsAuthenticated(false);
  };

  const value: AuthContextType = {
    isAuthenticated,
    token,
    user,
    companyData,
    deviceId,
    loginCompany,
    loginUser,
    logout,
    getDeviceId,
    getMacAddress,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
