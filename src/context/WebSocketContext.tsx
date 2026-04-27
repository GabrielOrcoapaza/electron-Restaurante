import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useCallback,
    useMemo,
} from "react";
import { useAuth } from "../hooks/useAuth";

// Tipos para los mensajes del WebSocket
export interface WebSocketMessage {
    type: string;
    [key: string]: any;
}

// Tipo del contexto
export interface WebSocketContextType {
    isConnected: boolean;
    subscribe: (
        eventType: string,
        callback: (message: WebSocketMessage) => void,
    ) => () => void;
    sendMessage: (message: any) => void;
    disconnect: () => void;
}

// Crear el contexto
const WebSocketContext = createContext<WebSocketContextType | undefined>(
    undefined,
);

// Hook para usar el contexto
export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error("useWebSocket debe usarse dentro de WebSocketProvider");
    }
    return context;
};

// Provider del contexto
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { companyData, user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<any>(null);
    const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 10;
    const isManualDisconnectRef = useRef(false);
    const subscribersRef = useRef<
        Map<string, Set<(message: WebSocketMessage) => void>>
    >(new Map());

    // Función para suscribirse a eventos
    const subscribe = useCallback(
        (eventType: string, callback: (message: WebSocketMessage) => void) => {
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
        },
        [],
    );

    // Función para enviar mensajes
    const sendMessage = useCallback((message: any) => {
        if (wsRef.current && wsRef.current.readyState === 1) {
            wsRef.current.send(JSON.stringify(message));
        } else {
            console.warn(
                "⚠️ WebSocket no está conectado, no se puede enviar mensaje",
            );
        }
    }, []);

    // Función para desconectar el WebSocket
    const disconnect = useCallback(() => {
        isManualDisconnectRef.current = true; // Marcar como desconexión manual

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }
        if (wsRef.current && wsRef.current.readyState === 1) {
            console.log("🔌 Desconectando WebSocket manualmente...");
            wsRef.current.close(1000, "Manual disconnect");
            wsRef.current = null;
            setIsConnected(false);
        }
        reconnectAttemptsRef.current = 0;
    }, []);

    // Notificar a los suscriptores
    const notifySubscribers = useCallback((message: WebSocketMessage) => {
        const callbacks = subscribersRef.current.get(message.type);
        if (callbacks) {
            callbacks.forEach((callback) => callback(message));
        }
        // También notificar a los suscriptores de '*', que reciben todos los mensajes
        const allCallbacks = subscribersRef.current.get("*");
        if (allCallbacks) {
            allCallbacks.forEach((callback) => callback(message));
        }
    }, []);

    // Función para crear y conectar el WebSocket
    const { token } = useAuth(); // Obtener el token del contexto de autenticación

    // Guardar la URL actual para evitar reconexiones innecesarias
    const lastWsUrlRef = useRef<string>("");

    const connectWebSocket = useCallback(() => {
        if (!companyData?.branch.id || !user?.id) {
            return;
        }

        let tokenToUse = token || localStorage.getItem("token");
        if (!tokenToUse) return;

        tokenToUse = tokenToUse.replace(/^(JWT|Bearer)\s+/i, "");

        let wSocketBaseUrl = import.meta.env.VITE_WS_URL || "";
        if (wSocketBaseUrl && !wSocketBaseUrl.endsWith('/')) {
            wSocketBaseUrl += '/';
        }

        const wsUrl = `${wSocketBaseUrl}?token=${encodeURIComponent(tokenToUse)}`;

        // Si ya hay una conexión a la MISMA URL, no hacer nada
        if (wsRef.current && (wsRef.current.readyState === 0 || wsRef.current.readyState === 1)) {
            if (lastWsUrlRef.current === wsUrl) {
                console.log("ℹ️ WebSocket ya está conectado/conectando a la misma URL");
                return;
            }
            // Si la URL cambió (ej. nuevo token), cerramos la anterior
            console.log("🔄 URL de WebSocket cambió, cerrando conexión anterior...");
            wsRef.current.close(1000, "URL changed");
        }

        lastWsUrlRef.current = wsUrl;
        isManualDisconnectRef.current = false;
        
        console.log("🔌 Intentando conectar WebSocket... (intento", reconnectAttemptsRef.current + 1, ")");
        console.log("URL:", wsUrl.replace(encodeURIComponent(tokenToUse), "TOKEN_OCULTO")); 
        
        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            // Manejar eventos de forma compatible con Navegador y Electron (ws)
            ws.onopen = () => {
                console.log(
                    "✅ WebSocket conectado para branch:",
                    companyData.branch.id,
                );
                setIsConnected(true);
                reconnectAttemptsRef.current = 0;

                notifySubscribers({
                    type: "connected",
                    message: "Conexión establecida",
                });
            };

            ws.onmessage = (event: any) => {
                try {
                    // En navegador el mensaje viene en event.data, en Node 'ws' puede venir directo o en data
                    const rawData = event.data || event;
                    const messageString =
                        typeof rawData === "string"
                            ? rawData
                            : rawData.toString();
                    const message = JSON.parse(messageString);

                    console.log("🔄 Mensaje WebSocket recibido:", message);
                    notifySubscribers(message);
                } catch (error) {
                    console.error(
                        "❌ Error parseando mensaje WebSocket:",
                        error,
                    );
                }
            };

            ws.onerror = (error: any) => {
                console.error("❌ Error WebSocket:", error);
                setIsConnected(false);
                notifySubscribers({
                    type: "error",
                    message: "Error de conexión en tiempo real",
                });
            };

            ws.onclose = (event: any) => {
                const code = event.code || event;
                const reason = event.reason || "Sin razón";

                console.log("🔌 WebSocket desconectado:", code, reason);
                setIsConnected(false);

                if (pingIntervalRef.current) {
                    clearInterval(pingIntervalRef.current);
                    pingIntervalRef.current = null;
                }

                if (isManualDisconnectRef.current || code === 1000) {
                    console.log(
                        "✅ Cierre normal del WebSocket, no se reintentará",
                    );
                    return;
                }

                if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                    const delay = Math.min(
                        1000 * Math.pow(2, reconnectAttemptsRef.current),
                        30000,
                    );
                    reconnectAttemptsRef.current++;

                    console.log(
                        `🔄 Reintentando conexión en ${delay / 1000} segundos... (intento ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
                    );

                    reconnectTimeoutRef.current = setTimeout(() => {
                        connectWebSocket();
                    }, delay);
                } else {
                    console.error(
                        "❌ Se alcanzó el máximo de intentos de reconexión",
                    );
                    notifySubscribers({
                        type: "reconnect_failed",
                        message:
                            "No se pudo reconectar después de varios intentos",
                    });
                }
            };

            // Enviar ping periódico para mantener la conexión viva
            pingIntervalRef.current = setInterval(() => {
                if (ws.readyState === 1) {
                    // OPEN = 1
                    ws.send(JSON.stringify({ type: "ping" }));
                    console.log("🏓 Ping enviado");
                }
            }, 25000); // Cada 25 segundos
        } catch (error) {
            console.error("❌ Error creando WebSocket:", error);

            // Reintentar si falló la creación
            if (
                reconnectAttemptsRef.current < maxReconnectAttempts &&
                !isManualDisconnectRef.current
            ) {
                const delay = Math.min(
                    1000 * Math.pow(2, reconnectAttemptsRef.current),
                    30000,
                );
                reconnectAttemptsRef.current++;

                console.log(`🔄 Reintentando en ${delay / 1000} segundos...`);
                reconnectTimeoutRef.current = setTimeout(() => {
                    connectWebSocket();
                }, delay);
            }
        }
    }, [companyData?.branch.id, user?.id, token, notifySubscribers]);

    // Ref para manejar el cierre diferido (evita ruidos en React 18 Dev mode)
    const unmountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Efecto para manejar la conexión del WebSocket
    useEffect(() => {
        // Si había un cierre programado por un re-render rápido, lo cancelamos
        if (unmountTimeoutRef.current) {
            clearTimeout(unmountTimeoutRef.current);
            unmountTimeoutRef.current = null;
        }

        // Solo conectar si tenemos los datos necesarios
        if (companyData?.branch.id && user?.id && token) {
             connectWebSocket();
        }

        // Cleanup
        return () => {
            // No cerramos inmediatamente. Esperamos un breve momento por si es un re-render de React 18.
            // Si el componente se desmonta de verdad, este timeout se ejecutará.
            unmountTimeoutRef.current = setTimeout(() => {
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                    reconnectTimeoutRef.current = null;
                }
                if (pingIntervalRef.current) {
                    clearInterval(pingIntervalRef.current);
                    pingIntervalRef.current = null;
                }
                if (wsRef.current) {
                    const ws = wsRef.current;
                    // Solo cerrar si no se ha vuelto a marcar como activo por otro renderizado
                    if (ws.readyState === 1) { 
                        console.log("🔌 Cerrando WebSocket por desmontaje...");
                        ws.close(1000, "Component unmount");
                    } else if (ws.readyState === 0) {
                        ws.onopen = null;
                        ws.close();
                    }
                    wsRef.current = null;
                    setIsConnected(false);
                    lastWsUrlRef.current = "";
                }
            }, 100); // 100ms es suficiente para cubrir el doble mount de React 18
        };
    }, [connectWebSocket, companyData?.branch.id, user?.id, token]);

    const value: WebSocketContextType = useMemo(() => ({
        isConnected,
        subscribe,
        sendMessage,
        disconnect,
    }), [isConnected, subscribe, sendMessage, disconnect]);

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};
