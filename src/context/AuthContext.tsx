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
    requireWaiterPassword?: boolean;
    users?: Array<{
      id: string;
      firstName: string;
      lastName: string;
      dni: string;
      role: string;
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
  switchBranch: (newBranch: CompanyData['branch']) => void; // Cambiar sucursal (multisucursal)

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
  // Cargar datos de localStorage de forma síncrona para evitar parpadeos/redirecciones
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('token'));
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<UserData | null>(() => {
    const storedUser = localStorage.getItem('userData');
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch (error) {
        console.error('Error al parsear userData inicial:', error);
      }
    }
    return null;
  });
  const [companyData, setCompanyData] = useState<CompanyData | null>(() => {
    const storedCompany = localStorage.getItem('companyData');
    if (storedCompany) {
      try {
        return JSON.parse(storedCompany);
      } catch (error) {
        console.error('Error al parsear companyData inicial:', error);
      }
    }
    return null;
  });
  const [deviceId, setDeviceId] = useState<string | null>(() => localStorage.getItem('device_id'));

  // Sincronización adicional si fuera necesaria
  useEffect(() => {
    // Si por alguna razón los datos cambian externamente (poco probable en este flujo)
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

  /** True si la app corre en SumApp/Electron (escritorio), donde sí hay MAC de la PC vía Node. */
  const isElectronRuntime = (): boolean =>
    typeof window !== 'undefined' && Boolean((window as any).process?.versions?.electron);

  /**
   * Identificador del **equipo cliente** (PC con SumApp) para backend / impresión:
   * - Electron: MAC de una interfaz de red de esta PC.
   * - Navegador u otro: `device_id` persistente en localStorage de **este** equipo (no es MAC).
   */
  const getMacAddress = async (): Promise<string> => {
    try {
      if (isElectronRuntime() && typeof window !== 'undefined' && typeof (window as any).require === 'function') {
        const os = (window as any).require('os');
        const networkInterfaces = os.networkInterfaces() as Record<string, Array<{ mac?: string }> | undefined>;

        for (const interfaceName of Object.keys(networkInterfaces)) {
          const list = networkInterfaces[interfaceName];
          if (!list) continue;
          for (const iface of list) {
            if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
              return iface.mac.toUpperCase();
            }
          }
        }
      }

      return getDeviceId();
    } catch (error) {
      console.error('Error obteniendo MAC:', error);
      return getDeviceId();
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

  // Cambiar sucursal activa (multisucursal) - actualiza branch manteniendo company
  const switchBranch = (newBranch: CompanyData['branch']) => {
    if (!companyData) return;
    const allTables = (newBranch.floors || []).flatMap((floor) =>
      (floor.tables || []).map((t) => ({
        ...t,
        floorId: floor.id,
        floorName: floor.name,
      }))
    );
    const updated: CompanyData = {
      ...companyData,
      branch: {
        ...newBranch,
        tables: allTables,
      },
    };
    console.log('🏢 Cambiando sucursal a:', newBranch.name);
    setCompanyData(updated);
    localStorage.setItem('companyData', JSON.stringify(updated));
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

  // Logout - Solo limpia datos del usuario, mantiene datos de la empresa en Electron
  const logout = () => {
    console.log('🚪 Cerrando sesión de usuario...');

    const isElectron = typeof navigator !== 'undefined' && 
                       navigator.userAgent.toLowerCase().includes('electron');

    // Limpiar localStorage obligatorio (Token y Datos de Usuario)
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('userPhoto');

    if (!isElectron) {
      // EN WEB: Limpiar TAMBIÉN datos de la empresa para un cierre completo
      localStorage.removeItem('companyData');
      setCompanyData(null);
    }

    // Limpiar estado
    setToken(null);
    setUser(null);
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
    switchBranch,
    updateTableInContext,
    getDeviceId,
    getMacAddress,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
