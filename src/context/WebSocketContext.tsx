import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useCallback,
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
    const connectWebSocket = useCallback(() => {
        if (!companyData?.branch.id || !user?.id) {
            console.log("⚠️ Faltan datos para WebSocket:", {
                branchId: companyData?.branch.id,
                userId: user?.id,
            });
            return;
        }

        // Obtener token del localStorage
        const tokenFromStorage = localStorage.getItem("token");
        if (!tokenFromStorage) {
            console.warn("⚠️ No hay token disponible para WebSocket");
            return;
        }

        // Si ya hay una conexión activa, no crear otra
        if (wsRef.current && wsRef.current.readyState === 1) {
            console.log("ℹ️ WebSocket ya está conectado");
            return;
        }

        // Resetear flag de desconexión manual al intentar conectar
        isManualDisconnectRef.current = false;

        // URL del WebSocket según tu backend
        const wSocketUrl = import.meta.env.VITE_WS_URL;

        //const wsUrl = `ws://192.168.1.22:8000/ws/restaurant/${companyData.branch.id}/`;
        const wsUrl = `${wSocketUrl}${companyData.branch.id}/`;

        console.log(
            "🔌 Intentando conectar WebSocket... (intento",
            reconnectAttemptsRef.current + 1,
            ")",
        );
        const isElectron = () => {
            return !!(window as any).electron || !!(window as any).require;
        };
        try {
            let ws;

            if (isElectron()) {
                // Entorno Electron - usar WebSocket con headers
                const WebSocketNode = (window as any).require("ws");
                ws = new WebSocketNode(wsUrl, {
                    headers: {
                        Authorization: `Bearer ${tokenFromStorage}`,
                    },
                });
            } else {
                // Navegador web - WebSocket estándar (no soporta headers personalizados)
                // En este caso, el token debe ir en la URL o usar otro método
                const urlWithToken = `${wsUrl}?token=${encodeURIComponent(tokenFromStorage)}`;
                ws = new WebSocket(urlWithToken);
            }

            wsRef.current = ws;

            // Usar la API de eventos de ws (Node.js)
            ws.on("open", () => {
                console.log(
                    "✅ WebSocket conectado para branch:",
                    companyData.branch.id,
                );
                setIsConnected(true);
                reconnectAttemptsRef.current = 0; // Resetear contador de intentos al conectar exitosamente

                // Notificar reconexión exitosa
                notifySubscribers({
                    type: "connected",
                    message: "Conexión establecida",
                });
            });

            ws.on("message", (data: any) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log("🔄 Mensaje WebSocket recibido:", message);

                    // Notificar a los suscriptores
                    notifySubscribers(message);
                } catch (error) {
                    console.error(
                        "❌ Error parseando mensaje WebSocket:",
                        error,
                    );
                }
            });

            ws.on("error", (error: any) => {
                console.error("❌ Error WebSocket:", error);
                setIsConnected(false);
                notifySubscribers({
                    type: "error",
                    message: "Error de conexión en tiempo real",
                });
            });

            ws.on("close", (code: number, reason: any) => {
                console.log(
                    "🔌 WebSocket desconectado:",
                    code,
                    reason?.toString?.() || "Sin razón",
                );
                setIsConnected(false);

                // Limpiar el ping interval
                if (pingIntervalRef.current) {
                    clearInterval(pingIntervalRef.current);
                    pingIntervalRef.current = null;
                }

                // No reintentar si fue desconexión manual o cierre normal
                if (isManualDisconnectRef.current || code === 1000) {
                    console.log(
                        "✅ Cierre normal del WebSocket, no se reintentará",
                    );
                    return;
                }

                // Reintentar conexión con backoff exponencial
                if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                    const delay = Math.min(
                        1000 * Math.pow(2, reconnectAttemptsRef.current),
                        30000,
                    ); // Max 30 segundos
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
            });

            // Enviar ping periódico para mantener la conexión viva
            pingIntervalRef.current = setInterval(() => {
                if (ws.readyState === 1) {
                    // OPEN = 1
                    ws.send(JSON.stringify({ type: "ping" }));
                    console.log("🏓 Ping enviado");
                }
            }, 25000); // Cada 25 segundos (un poco más frecuente para mayor seguridad)
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
    }, [companyData?.branch.id, user?.id, notifySubscribers]);

    // Efecto para manejar la conexión del WebSocket
    useEffect(() => {
        connectWebSocket();

        // Cleanup
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
            if (wsRef.current && wsRef.current.readyState === 1) {
                // OPEN = 1
                wsRef.current.close(1000, "Component unmount");
            }
            wsRef.current = null;
            setIsConnected(false);
        };
    }, [connectWebSocket]);

    const value: WebSocketContextType = {
        isConnected,
        subscribe,
        sendMessage,
        disconnect,
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};
