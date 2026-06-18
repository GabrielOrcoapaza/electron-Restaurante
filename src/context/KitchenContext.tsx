import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
} from "react";
import { useMutation, useLazyQuery } from "@apollo/client";
import { useAuth } from "../hooks/useAuth";
import { useTts } from "../hooks/useTts";
import { useWebSocket } from "./WebSocketContext";
import { GET_PENDING_KITCHEN_ITEMS, KITCHEN_LOGIN } from "../graphql/queries";
import {
    MARK_ITEM_PREPARED,
    MARK_PARTIAL_PREPARED,
    MARK_ORDER_PREPARED,
    MARK_GROUP_PREPARED,
} from "../graphql/mutations";

// Tipos para los items de cocina
export interface KitchenItem {
    id: string;
    quantity: string; // La API devuelve string (ej: "1.0000")
    notes?: string;
    createdAt: string;
    productName: string;
    productId: number; // API devuelve number
    operationId: number; // API devuelve number
    isPrepared: boolean;
    isCanceled: boolean;
    operation: {
        id: string;
        order: number; // API devuelve number
        serviceType: string;
        table?: {
            id: string;
            name: string;
            floor?: {
                id: string;
                name: string;
            };
        };
        user?: {
            firstName: string;
            lastName: string;
        };
    };
    product?: {
        id: string;
        name: string;
        preparationTime?: number;
        subcategory?: {
            id: string;
            name: string;
            category?: {
                id: string;
                name: string;
                color?: string;
            };
        };
    };
    createdBy?: {
        firstName: string;
        lastName: string;
    };
    comboComponents?: Array<{
        id: string;
        productName: string;
        categoryId: string;
        quantity: number;
        isPrepared: boolean;
        isCanceled: boolean;
    }>;
}

// Tipo para la vista activa
export type KitchenViewType = "byOrder" | "byItem" | "byGroup";

// Tipo para el estado de la cocina
export interface KitchenContextType {
    // Estado
    items: KitchenItem[];
    isLoading: boolean;
    error: string | null;
    activeView: KitchenViewType;
    isAuthenticated: boolean;
    displayCategories: Array<{ id: string; name: string; color?: string }>;
    // TTS
    ttsIsSupported: boolean;
    ttsIsSpeaking: boolean;
    ttsIsEnabled: boolean;
    setTtsIsEnabled: (enabled: boolean) => void;
    ttsVoices: SpeechSynthesisVoice[];
    ttsSelectedVoice: SpeechSynthesisVoice | null;
    setTtsSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
    speak: (text: string) => void;
    stopSpeaking: () => void;
    // Notificaciones
    notificationsSupported: boolean;
    sendNotification: (title: string, body: string) => Promise<void>;
    // Métodos
    setActiveView: (view: KitchenViewType) => void;
    refreshItems: () => Promise<void>;
    login: (
        dni: string,
        password: string,
        deviceId: string,
    ) => Promise<{ success: boolean; message: string }>;
    logout: () => void;
    markItemPrepared: (detailId: string) => Promise<void>;
    markPartialPrepared: (detailId: string, quantity: number) => Promise<void>;
    markOrderPrepared: (operationId: string) => Promise<void>;
    markGroupPrepared: (detailIds: string[]) => Promise<void>;
}

// Crear el contexto
const KitchenContext = createContext<KitchenContextType | undefined>(undefined);

// Hook para usar el contexto
export const useKitchen = () => {
    const context = useContext(KitchenContext);
    if (!context) {
        throw new Error("useKitchen debe usarse dentro de KitchenProvider");
    }
    return context;
};

// Provider del contexto
export const KitchenProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { companyData, user } = useAuth();
    const { subscribe } = useWebSocket();
    const tts = useTts();
    const [items, setItems] = useState<KitchenItem[]>([]);
    const previousItemIdsRef = useRef<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<KitchenViewType>("byOrder");
    const [isAuthenticated, setIsAuthenticated] = useState(
        () => !!localStorage.getItem("kitchenToken"),
    );

    // branchId y userId del cocinero (guardados al hacer kitchenLogin, independientes del AuthContext)
    const [kitchenBranchId, setKitchenBranchId] = useState<string | null>(() =>
        localStorage.getItem("kitchenBranchId"),
    );
    const [kitchenUserId, setKitchenUserId] = useState<string | null>(() =>
        localStorage.getItem("kitchenUserId"),
    );

    // Usar los datos del cocinero si existen, de lo contrario caer de vuelta al AuthContext
    const effectiveBranchId = kitchenBranchId ?? companyData?.branch.id ?? null;
    const effectiveUserId = kitchenUserId ?? user?.id ?? null;
    const [displayCategories, setDisplayCategories] = useState<
        Array<{ id: string; name: string; color?: string }>
    >(() => {
        const stored = localStorage.getItem("kitchenDisplayCategories");
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return [];
            }
        }
        return [];
    });

    // Notificaciones Web
    const [notificationsSupported, setNotificationsSupported] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setNotificationsSupported("Notification" in window);
        }
    }, []);

    const sendNotification = useCallback(
        async (title: string, body: string) => {
            if (!notificationsSupported) return;

            try {
                let permission = Notification.permission;
                if (permission === "default") {
                    permission = await Notification.requestPermission();
                }

                if (permission === "granted") {
                    new Notification(title, {
                        body,
                        icon: "/favicon.ico", // O una URL a un ícono
                    });
                }
            } catch (err) {
                console.error("Error al enviar notificación:", err);
            }
        },
        [notificationsSupported],
    );

    // Queries y Mutations de Apollo
    const [getPendingItems, { loading: itemsLoading, data: itemsData }] =
        useLazyQuery(GET_PENDING_KITCHEN_ITEMS, {
            fetchPolicy: "network-only",
            onCompleted: (data) => {
                setItems(data?.pendingKitchenItems || []);
            },
            onError: (err) => {
                console.error("❌ Error al obtener items de cocina:", err);
                setError(err.message);
            },
        });

    const [loginMutation] = useMutation(KITCHEN_LOGIN);
    const [markItemPreparedMutation] = useMutation(MARK_ITEM_PREPARED);
    const [markPartialPreparedMutation] = useMutation(MARK_PARTIAL_PREPARED);
    const [markOrderPreparedMutation] = useMutation(MARK_ORDER_PREPARED);
    const [markGroupPreparedMutation] = useMutation(MARK_GROUP_PREPARED);

    // Método para refrescar items
    const refreshItems = useCallback(async () => {
        if (!isAuthenticated || !effectiveBranchId || !effectiveUserId) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await getPendingItems({
                variables: {
                    branchId: effectiveBranchId,
                    userId: effectiveUserId,
                },
            });
        } catch (err) {
            console.error("❌ Error al obtener items de cocina:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Error al cargar items de cocina",
            );
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, effectiveBranchId, effectiveUserId, getPendingItems]);

    // Método para login de cocinero
    const login = useCallback(
        async (
            dni: string,
            password: string,
            deviceId: string,
        ): Promise<{ success: boolean; message: string }> => {
            try {
                const { data } = await loginMutation({
                    variables: { dni, password, deviceId },
                });

                if (data?.kitchenLogin?.success) {
                    const token = data.kitchenLogin.token;
                    const displayCategories =
                        data.kitchenLogin.displayCategories || [];
                    const branchId = data.kitchenLogin.branch?.id;
                    const userId = data.kitchenLogin.user?.id;

                    setIsAuthenticated(true);
                    localStorage.setItem("kitchenToken", token);
                    localStorage.setItem(
                        "kitchenDisplayCategories",
                        JSON.stringify(displayCategories),
                    );
                    if (branchId) {
                        localStorage.setItem("kitchenBranchId", branchId);
                        setKitchenBranchId(branchId);
                    }
                    if (userId) {
                        localStorage.setItem("kitchenUserId", userId);
                        setKitchenUserId(userId);
                    }
                    setDisplayCategories(displayCategories);

                    // Llamar getPendingItems directamente con los IDs recién obtenidos
                    // porque refreshItems todavía tiene los valores anteriores en su closure
                    if (branchId && userId) {
                        setIsLoading(true);
                        try {
                            await getPendingItems({
                                variables: { branchId, userId },
                            });
                        } finally {
                            setIsLoading(false);
                        }
                    }

                    return { success: true, message: "Login exitoso" };
                }

                return {
                    success: false,
                    message:
                        data?.kitchenLogin?.message || "Credenciales inválidas",
                };
            } catch (err: any) {
                console.error("Error en login de cocina:", err);
                return {
                    success: false,
                    message:
                        err.graphQLErrors?.[0]?.message ||
                        err.message ||
                        "Error en login",
                };
            }
        },
        [loginMutation, getPendingItems],
    );

    // Método para logout
    const logout = useCallback(() => {
        setIsAuthenticated(false);
        setItems([]);
        setKitchenBranchId(null);
        setKitchenUserId(null);
        localStorage.removeItem("kitchenToken");
        localStorage.removeItem("kitchenDisplayCategories");
        localStorage.removeItem("kitchenBranchId");
        localStorage.removeItem("kitchenUserId");
    }, []);

    // Métodos para marcar items como preparados
    const markItemPrepared = useCallback(
        async (detailId: string): Promise<void> => {
            if (!effectiveUserId) return;

            try {
                await markItemPreparedMutation({
                    variables: { detailId, userId: effectiveUserId },
                });
                await refreshItems();
            } catch (err) {
                console.error("Error al marcar item como preparado:", err);
            }
        },
        [effectiveUserId, markItemPreparedMutation, refreshItems],
    );

    const markPartialPrepared = useCallback(
        async (detailId: string, quantity: number): Promise<void> => {
            if (!effectiveUserId) return;

            try {
                await markPartialPreparedMutation({
                    variables: {
                        detailId,
                        preparedQuantity: quantity,
                        userId: effectiveUserId,
                    },
                });
                await refreshItems();
            } catch (err) {
                console.error(
                    "Error al marcar item como parcialmente preparado:",
                    err,
                );
            }
        },
        [effectiveUserId, markPartialPreparedMutation, refreshItems],
    );

    const markOrderPrepared = useCallback(
        async (operationId: string): Promise<void> => {
            if (!effectiveUserId) return;

            try {
                await markOrderPreparedMutation({
                    variables: { operationId, userId: effectiveUserId },
                });
                await refreshItems();
            } catch (err) {
                console.error("Error al marcar orden como preparada:", err);
            }
        },
        [effectiveUserId, markOrderPreparedMutation, refreshItems],
    );

    const markGroupPrepared = useCallback(
        async (detailIds: string[]): Promise<void> => {
            if (!effectiveUserId) return;

            try {
                await markGroupPreparedMutation({
                    variables: { detailIds, userId: effectiveUserId },
                });
                await refreshItems();
            } catch (err) {
                console.error("Error al marcar grupo como preparado:", err);
            }
        },
        [effectiveUserId, markGroupPreparedMutation, refreshItems],
    );

    // Efecto inicial para refrescar items
    useEffect(() => {
        if (isAuthenticated && effectiveBranchId && effectiveUserId) {
            refreshItems();
        }
    }, [isAuthenticated, effectiveBranchId, effectiveUserId, refreshItems]);

    // Efecto para escuchar eventos de WebSocket
    useEffect(() => {
        if (!isAuthenticated || !effectiveBranchId || !effectiveUserId) {
            console.log(
                "🍳 KitchenContext: No hay datos suficientes para suscribirse a WebSocket",
                {
                    isAuthenticated,
                    effectiveBranchId,
                    effectiveUserId,
                },
            );
            return;
        }

        console.log(
            "🍳 KitchenContext: Suscribiéndose a eventos de WebSocket...",
        );

        const unsubscribe = subscribe("*", (message) => {
            console.log("📡 Evento de cocina recibido:", message);
            // Cuando llegue cualquier evento, refrescamos los items
            refreshItems();
        });

        return () => {
            console.log("🍳 KitchenContext: Desuscribiéndose de WebSocket");
            unsubscribe();
        };
    }, [
        isAuthenticated,
        effectiveBranchId,
        effectiveUserId,
        subscribe,
        refreshItems,
    ]);

    const filteredItems = useMemo(() => {
        const rawItems: KitchenItem[] = itemsData?.pendingKitchenItems || items;
        if (!displayCategories || displayCategories.length === 0) {
            return rawItems;
        }
        const allowedIds = new Set(displayCategories.map((c) => c.id));
        return rawItems.filter((item: KitchenItem) => {
            const categoryId = item.product?.subcategory?.category?.id;
            return categoryId ? allowedIds.has(categoryId) : true;
        });
    }, [items, itemsData, displayCategories]);

    // Detectar items nuevos para TTS y Notificaciones
    useEffect(() => {
        if (!isAuthenticated || filteredItems.length === 0) return;

        const currentItemIds = new Set(filteredItems.map((item) => item.id));
        const newItems = filteredItems.filter(
            (item) => !previousItemIdsRef.current.has(item.id),
        );

        if (newItems.length > 0) {
            for (const item of newItems) {
                // TTS
                const ttsText = `Nuevo pedido: ${item.quantity} ${item.productName} para la mesa ${item.operation.table?.name || "desconocida"}`;
                tts.speak(ttsText);

                // Notificación
                sendNotification(
                    `Nuevo item: ${item.productName}`,
                    `Mesa: ${item.operation.table?.name || "desconocida"} | Cantidad: ${item.quantity}`,
                );
            }
        }

        // Actualizar el ref con los IDs actuales
        previousItemIdsRef.current = currentItemIds;
    }, [filteredItems, isAuthenticated, tts, sendNotification]);

    const value: KitchenContextType = useMemo(
        () => ({
            items: filteredItems,
            isLoading: isLoading || itemsLoading,
            error,
            activeView,
            isAuthenticated,
            displayCategories,
            // TTS
            ttsIsSupported: tts.isSupported,
            ttsIsSpeaking: tts.isSpeaking,
            ttsIsEnabled: tts.isEnabled,
            setTtsIsEnabled: tts.setIsEnabled,
            ttsVoices: tts.voices,
            ttsSelectedVoice: tts.selectedVoice,
            setTtsSelectedVoice: tts.setSelectedVoice,
            speak: tts.speak,
            stopSpeaking: tts.stop,
            // Notificaciones
            notificationsSupported,
            sendNotification,
            // Métodos
            setActiveView,
            refreshItems,
            login,
            logout,
            markItemPrepared,
            markPartialPrepared,
            markOrderPrepared,
            markGroupPrepared,
        }),
        [
            filteredItems,
            isLoading,
            itemsLoading,
            error,
            activeView,
            isAuthenticated,
            displayCategories,
            tts,
            notificationsSupported,
            sendNotification,
            refreshItems,
            login,
            logout,
            markItemPrepared,
            markPartialPrepared,
            markOrderPrepared,
            markGroupPrepared,
        ],
    );

    return (
        <KitchenContext.Provider value={value}>
            {children}
        </KitchenContext.Provider>
    );
};
