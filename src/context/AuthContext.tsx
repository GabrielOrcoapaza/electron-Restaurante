import React, { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Table } from '../types/table';

// Tipos para los datos de autenticación

// Tipo para notas de subcategorías
export interface Note {
  id: string;
  note: string;
  isActive: boolean;
}

// Tipo para subcategorías
export interface Subcategory {
  id: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
  notes?: Note[];
}

// Tipo para categorías
export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order: number;
  isActive: boolean;
  subcategories?: Subcategory[];
}

// Tipo para pisos con sus mesas
export interface Floor {
  id: string;
  name: string;
  capacity: number;
  floorImage?: string;
  isActive: boolean;
  order: number;
  tables?: Array<Table & {
    floorId?: string;
    floorName?: string;
  }>;
}

// Datos de la empresa y sucursal (primer login)
export interface CompanyData {
  company: {
    id: string;
    ruc: string;
    denomination: string;
    commercialName?: string;
    address?: string;
    phone?: string;
    email: string;
    logo?: string;
    isActive: boolean;
  };
  branch: {
    id: string;
    serial?: string;
    name: string;
    address?: string;
    phone?: string;
    logo?: string;
    latitude?: number;
    longitude?: number;
    igvPercentage?: number;
    pdfSize?: string;
    pdfColor?: string;
    isActive: boolean;
    isPayment?: boolean;
    isBilling?: boolean;
    isDelivery?: boolean;
    isMultiWaiterEnabled?: boolean;
    isCommandItemMode?: boolean;
    isKitchenPrint?: boolean;
    isKitchenDisplay?: boolean;
    users?: Array<{
      id: string;
      firstName: string;
      lastName: string;
      dni: string;
    }>;
    floors?: Floor[];
    categories?: Category[];
    tables?: Array<Table & {
      floorId?: string;
      floorName?: string;
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

// Tipo para actualizar una mesa
export interface UpdatedTable {
  id: string;
  status: string;
  statusColors?: any;
  currentOperationId?: number | null;
  occupiedById?: number | null;
  userName?: string | null;
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
  clearCompanyData: () => void; // Limpiar solo los datos de la compañía

  // Métodos para mesas
  updateTableInContext: (updatedTable: UpdatedTable) => void;

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

  // Limpiar solo los datos de la compañía (para cambiar de compañía)
  const clearCompanyData = () => {
    console.log('🧹 Limpiando datos de compañía...');
    localStorage.removeItem('companyData');
    setCompanyData(null);
  };

  // Actualizar el estado de una mesa en el contexto
  const updateTableInContext = (updatedTable: UpdatedTable) => {
    if (!companyData) return;

    console.log('🪑 Actualizando mesa en contexto:', updatedTable);

    const newCompanyData: CompanyData = {
      ...companyData,
      branch: {
        ...companyData.branch,
        // Actualizar en floors
        floors: companyData.branch.floors?.map(floor => ({
          ...floor,
          tables: floor.tables?.map(table =>
            table.id === updatedTable.id
              ? {
                ...table,
                status: updatedTable.status as Table['status'],
                statusColors: updatedTable.statusColors !== undefined ? updatedTable.statusColors : table.statusColors,
                currentOperationId: updatedTable.currentOperationId !== undefined ? (updatedTable.currentOperationId ?? undefined) : table.currentOperationId,
                occupiedById: updatedTable.occupiedById !== undefined ? (updatedTable.occupiedById ?? undefined) : table.occupiedById,
                userName: updatedTable.userName !== undefined ? (updatedTable.userName ?? undefined) : table.userName
              }
              : table
          )
        })),
        // Actualizar en tables (lista plana)
        tables: companyData.branch.tables?.map(table =>
          table.id === updatedTable.id
            ? {
              ...table,
              status: updatedTable.status as Table['status'],
              statusColors: updatedTable.statusColors !== undefined ? updatedTable.statusColors : table.statusColors,
              currentOperationId: updatedTable.currentOperationId !== undefined ? (updatedTable.currentOperationId ?? undefined) : table.currentOperationId,
              occupiedById: updatedTable.occupiedById !== undefined ? (updatedTable.occupiedById ?? undefined) : table.occupiedById,
              userName: updatedTable.userName !== undefined ? (updatedTable.userName ?? undefined) : table.userName
            }
            : table
        )
      }
    };

    // Actualizar estado y localStorage
    setCompanyData(newCompanyData);
    localStorage.setItem('companyData', JSON.stringify(newCompanyData));
    console.log('✅ Mesa actualizada en contexto');
  };

  // Logout - Solo limpia datos del usuario, mantiene datos de la empresa
  const logout = () => {
    console.log('🚪 Cerrando sesión de usuario...');

    // Limpiar localStorage - Solo datos del usuario
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('userPhoto');
    // Mantener companyData para no tener que volver a iniciar sesión como empresa
    // Usar clearCompanyData() si se quiere cambiar de empresa
    // Mantener device_id para futuros logins

    // Limpiar estado del usuario
    setToken(null);
    setUser(null);
    // Mantener companyData
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
    clearCompanyData,
    updateTableInContext,
    getDeviceId,
    getMacAddress,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
