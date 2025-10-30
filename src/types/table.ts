// Interfaz para los colores de estado de una mesa (formato exacto del método get_status_colors() de Django)
export interface TableStatusColors {
  color: string;                    // Color principal del borde
  background_color: string;          // Color de fondo
  text_color: string;               // Color del texto
}

// Interfaz para los colores procesados que se usan en el frontend
export interface ProcessedTableColors {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  badgeColor: string;
  badgeTextColor: string;
}

// Tipos de estado de mesa (coinciden con TABLE_STATUS del modelo Django)
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'TO_PAY' | 'IN_PROCESS' | 'MAINTENANCE';

// Tipos para las mesas
export interface Table {
  id: string;
  name: string;
  shape: 'CIRCLE' | 'RECTANGLE' | 'SQUARE'; // Incluye SQUARE del modelo Django
  positionX: number;
  positionY: number;
  capacity: number;
  status: TableStatus;
  statusColors: string | TableStatusColors; // Puede ser JSON string o objeto
  currentOperationId?: number;
  occupiedById?: number;
  userName?: string;
}

// Opciones de estado para las mesas (coinciden con el modelo Django)
export interface TableStatusOption {
  value: TableStatus;
  label: string;
  color: string;
}

// Respuesta de la mutación de actualización de estado
export interface UpdateTableStatusResponse {
  success: boolean;
  message: string;
  table?: Table;
}

// Variables para la mutación de actualización de estado
export interface UpdateTableStatusVariables {
  tableId: string;
  status: string;
  userId?: string;
}
