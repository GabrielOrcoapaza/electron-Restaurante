import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

// Tipos para los mensajes del WebSocket
export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

// Tipo del contexto
export interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (eventType: string, callback: (message: WebSocketMessage) => void) => () => void;
  sendMessage: (message: any) => void;
  disconnect: () => void;
}

// Crear el contexto
const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// Hook para usar el contexto
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket debe usarse dentro de WebSocketProvider');
  }
  return context;
};

// Provider del contexto
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { companyData, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<any>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subscribersRef = useRef<Map<string, Set<(message: WebSocketMessage) => void>>>(new Map());

  // Función para suscribirse a eventos
  const subscribe = useCallback((eventType: string, callback: (message: WebSocketMessage) => void) => {
    if (!subscribersRef.current.has(eventType)) {
      subscribersRef.current.set(eventType, new Set());
    }
    subscribersRef.current.get(eventType)!.add(callback);

    // Retornar función para desuscribirse
    return () => {
      const callbacks = subscribersRef.current.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          subscribersRef.current.delete(eventType);
        }
      }
    };
  }, []);

  // Función para enviar mensajes
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket no está conectado, no se puede enviar mensaje');
    }
  }, []);

  // Función para desconectar el WebSocket
  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState === 1) {
      console.log('🔌 Desconectando WebSocket manualmente...');
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Notificar a los suscriptores
  const notifySubscribers = useCallback((message: WebSocketMessage) => {
    const callbacks = subscribersRef.current.get(message.type);
    if (callbacks) {
      callbacks.forEach(callback => callback(message));
    }
    // También notificar a los suscriptores de '*', que reciben todos los mensajes
    const allCallbacks = subscribersRef.current.get('*');
    if (allCallbacks) {
      allCallbacks.forEach(callback => callback(message));
    }
  }, []);

  // Efecto para manejar la conexión del WebSocket
  useEffect(() => {
    if (!companyData?.branch.id || !user?.id) {
      console.log('⚠️ Faltan datos para WebSocket:', { 
        branchId: companyData?.branch.id, 
        userId: user?.id
      });
      return;
    }

    // Obtener token del localStorage
    const tokenFromStorage = localStorage.getItem('token');
    if (!tokenFromStorage) {
      console.warn('⚠️ No hay token disponible para WebSocket');
      return;
    }

    // URL del WebSocket según tu backend
    const wsUrl = `ws://192.168.1.22:8000/ws/restaurant/${companyData.branch.id}/`;
    
    console.log('🔌 Intentando conectar WebSocket...');
    
    // Sistema de escritorio con Electron - usar WebSocket con headers
    const WebSocketNode = (window as any).require('ws');
    const ws = new WebSocketNode(wsUrl, {
      headers: {
        'Authorization': `Bearer ${tokenFromStorage}`
      }
    });

    wsRef.current = ws;

    // Usar la API de eventos de ws (Node.js)
    ws.on('open', () => {
      console.log('✅ WebSocket conectado para branch:', companyData.branch.id);
      setIsConnected(true);
    });

    ws.on('message', (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('🔄 Mensaje WebSocket recibido:', message);
        
        // Notificar a los suscriptores
        notifySubscribers(message);
        
      } catch (error) {
        console.error('❌ Error parseando mensaje WebSocket:', error);
      }
    });

    ws.on('error', (error: any) => {
      console.error('❌ Error WebSocket:', error);
      setIsConnected(false);
      notifySubscribers({ type: 'error', message: 'Error de conexión en tiempo real' });
    });

    ws.on('close', (code: number, reason: any) => {
      console.log('🔌 WebSocket desconectado:', code, reason.toString());
      setIsConnected(false);
      
      // No reintentar automáticamente si fue un cierre normal (logout)
      if (code === 1000) {
        console.log('✅ Cierre normal del WebSocket');
        return;
      }
      
      // Reintentar conexión si no fue un cierre normal
      if (code !== 1000) {
        console.log('🔄 Reintentando conexión en 3 segundos...');
        setTimeout(() => {
          // La reconexión se manejará automáticamente por el useEffect
        }, 3000);
      }
    });

    // Enviar ping periódico para mantener la conexión viva
    pingIntervalRef.current = setInterval(() => {
      if (ws.readyState === 1) { // OPEN = 1
        ws.send(JSON.stringify({ type: 'ping' }));
        console.log('🏓 Ping enviado');
      }
    }, 30000); // Cada 30 segundos

    // Cleanup
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (ws && ws.readyState === 1) { // OPEN = 1
        ws.close(1000, 'Component unmount');
      }
      wsRef.current = null;
      setIsConnected(false);
    };
  }, [companyData?.branch.id, user?.id, notifySubscribers]);

  const value: WebSocketContextType = {
    isConnected,
    subscribe,
    sendMessage,
    disconnect,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};

