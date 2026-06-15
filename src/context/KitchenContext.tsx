import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import { useMutation, useLazyQuery } from "@apollo/client";
import { useAuth } from "../hooks/useAuth";
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
    quantity: number;
    notes?: string;
    createdAt: string;
    productName: string;
    productId: string;
    operationId: string;
    isPrepared: boolean;
    isCanceled: boolean;
    operation: {
        id: string;
        order: string;
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
    const [items, setItems] = useState<KitchenItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<KitchenViewType>("byOrder");
    const [isAuthenticated, setIsAuthenticated] = useState(
        () => !!localStorage.getItem("kitchenToken"),
    );
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

    // Queries y Mutations de Apollo
    const [getPendingItems, { loading: itemsLoading, data: itemsData }] =
        useLazyQuery(GET_PENDING_KITCHEN_ITEMS, {
            fetchPolicy: "network-only",
            onCompleted: (data) => {
                setItems(data?.pendingKitchenItems || []);
            },
            onError: (err) => {
                console.error("Error al obtener items de cocina:", err);
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
        if (!isAuthenticated || !companyData?.branch.id || !user?.id) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await getPendingItems({
                variables: {
                    branchId: companyData.branch.id,
                    userId: user.id,
                },
            });
        } catch (err) {
            console.error("Error al obtener items de cocina:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Error al cargar items de cocina",
            );
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, companyData?.branch.id, user?.id, getPendingItems]);

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

                    setIsAuthenticated(true);
                    localStorage.setItem("kitchenToken", token);
                    localStorage.setItem(
                        "kitchenDisplayCategories",
                        JSON.stringify(displayCategories),
                    );
                    setDisplayCategories(displayCategories);
                    await refreshItems();

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
        [refreshItems, loginMutation],
    );

    // Método para logout
    const logout = useCallback(() => {
        setIsAuthenticated(false);
        setItems([]);
        localStorage.removeItem("kitchenToken");
        localStorage.removeItem("kitchenDisplayCategories");
    }, []);

    // Métodos para marcar items como preparados
    const markItemPrepared = useCallback(
        async (detailId: string): Promise<void> => {
            if (!companyData?.branch.id || !user?.id) return;

            try {
                await markItemPreparedMutation({
                    variables: { detailId, branchId: companyData.branch.id },
                });
                await refreshItems();
            } catch (err) {
                console.error("Error al marcar item como preparado:", err);
            }
        },
        [
            companyData?.branch.id,
            user?.id,
            markItemPreparedMutation,
            refreshItems,
        ],
    );

    const markPartialPrepared = useCallback(
        async (detailId: string, quantity: number): Promise<void> => {
            if (!companyData?.branch.id || !user?.id) return;

            try {
                await markPartialPreparedMutation({
                    variables: {
                        detailId,
                        quantity,
                        branchId: companyData.branch.id,
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
        [
            companyData?.branch.id,
            user?.id,
            markPartialPreparedMutation,
            refreshItems,
        ],
    );

    const markOrderPrepared = useCallback(
        async (operationId: string): Promise<void> => {
            if (!companyData?.branch.id || !user?.id) return;

            try {
                await markOrderPreparedMutation({
                    variables: { operationId, branchId: companyData.branch.id },
                });
                await refreshItems();
            } catch (err) {
                console.error("Error al marcar orden como preparada:", err);
            }
        },
        [
            companyData?.branch.id,
            user?.id,
            markOrderPreparedMutation,
            refreshItems,
        ],
    );

    const markGroupPrepared = useCallback(
        async (detailIds: string[]): Promise<void> => {
            if (!companyData?.branch.id || !user?.id) return;

            try {
                await markGroupPreparedMutation({
                    variables: { detailIds, branchId: companyData.branch.id },
                });
                await refreshItems();
            } catch (err) {
                console.error("Error al marcar grupo como preparado:", err);
            }
        },
        [
            companyData?.branch.id,
            user?.id,
            markGroupPreparedMutation,
            refreshItems,
        ],
    );

    // Efecto inicial para refrescar items
    useEffect(() => {
        if (isAuthenticated) {
            refreshItems();
        }
    }, [isAuthenticated, refreshItems]);

    // Efecto para escuchar eventos de WebSocket
    useEffect(() => {
        if (!isAuthenticated) return;

        const unsubscribe = subscribe("*", (message) => {
            console.log("📡 Evento de cocina recibido:", message);
            // Cuando llegue cualquier evento, refrescamos los items
            refreshItems();
        });

        return unsubscribe;
    }, [isAuthenticated, subscribe, refreshItems]);

    const value: KitchenContextType = useMemo(
        () => ({
            items: itemsData?.pendingKitchenItems || items,
            isLoading: isLoading || itemsLoading,
            error,
            activeView,
            isAuthenticated,
            displayCategories,
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
            items,
            itemsData,
            isLoading,
            itemsLoading,
            error,
            activeView,
            isAuthenticated,
            displayCategories,
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
