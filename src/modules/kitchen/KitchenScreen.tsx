import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useKitchen, type KitchenItem } from "../../context/KitchenContext";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../hooks/useAuth";
import { useWebSocket } from "../../context/WebSocketContext";
import { isTokenExpired } from "../../utils/jwt";

// Tipado de diálogos
interface ConfirmDialogState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
}

interface QtyPickerDialogState {
    isOpen: boolean;
    itemId: string;
    productName: string;
    maxQty: number;
    onConfirm: (qty: number) => void;
}

const KitchenScreen: React.FC = () => {
    const navigate = useNavigate();
    const {
        items,
        isLoading,
        error,
        activeView,
        setActiveView,
        logout,
        markItemPrepared,
        markPartialPrepared,
        markOrderPrepared,
        markGroupPrepared,
        ttsIsSupported,
        ttsIsEnabled,
        setTtsIsEnabled,
        ttsVoices,
        ttsSelectedVoice,
        setTtsSelectedVoice,
        speak,
    } = useKitchen();

    const { showToast } = useToast();
    const { companyData, user } = useAuth();
    const { isConnected, subscribe } = useWebSocket();

    // Estados locales para filtros y temporizadores
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
        null,
    );
    const [selectedFloorName, setSelectedFloorName] = useState<string | null>(
        null,
    );
    const [_tick, setTick] = useState(0);

    // Efecto para verificar token expirado al cargar y periódicamente
    useEffect(() => {
        const checkToken = () => {
            const kitchenToken = localStorage.getItem("kitchenToken");
            if (isTokenExpired(kitchenToken)) {
                console.warn("🔒 Token expirado, redirigiendo al login...");
                logout();
                navigate("/login-kitchen");
            }
        };

        // Verificar inmediatamente
        checkToken();

        // Verificar cada minuto
        const interval = setInterval(checkToken, 60000);

        return () => clearInterval(interval);
    }, [navigate, logout]);

    // Función auxiliar para convertir quantity de string a number
    const parseQuantity = (qty: string | number): number => {
        if (typeof qty === "number") return qty;
        return parseFloat(qty) || 0;
    };

    // Estados para diálogos
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => {},
    });

    const [qtyPickerDialog, setQtyPickerDialog] =
        useState<QtyPickerDialogState>({
            isOpen: false,
            itemId: "",
            productName: "",
            maxQty: 0,
            onConfirm: () => {},
        });

    // Estado para mensajes de difusión
    const [broadcast, setBroadcast] = useState<{
        message: string;
        senderName: string;
    } | null>(null);

    // Efecto para actualizar temporizadores cada segundo
    useEffect(() => {
        const timer = setInterval(() => {
            setTick((t) => t + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Suscribirse a mensajes de difusión del WebSocket
    useEffect(() => {
        const unsubscribe = subscribe("broadcast_message", (data: any) => {
            if (data?.message) {
                setBroadcast({
                    message: data.message,
                    senderName: data.senderName || "Sistema",
                });
                // Desaparecer después de 5 segundos
                const timer = setTimeout(() => {
                    setBroadcast(null);
                }, 5000);
                return () => clearTimeout(timer);
            }
        });
        return unsubscribe;
    }, [subscribe]);

    const handleLogout = () => {
        logout();
        navigate("/login-kitchen");
    };

    // Calcular tiempo transcurrido desde la creación del ítem (formato Android: Xh Ym)
    const getElapsedTime = (createdAt: string) => {
        const created = new Date(createdAt).getTime();
        if (isNaN(created)) return "0m";
        const now = Date.now();
        const diff = Math.max(0, now - created);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    // Color del temporizador según el tiempo transcurrido (mismo patrón que Android)
    const getTimerColorClass = (createdAt: string, prepTimeMin?: number) => {
        const limitMin = prepTimeMin || 15;
        const limitMs = limitMin * 60 * 1000;
        const created = new Date(createdAt).getTime();
        if (isNaN(created)) return "text-green-400";
        const diff = Date.now() - created;
        if (diff > limitMs) return "text-red-500 font-bold animate-pulse";
        if (diff > limitMs * 0.7) return "text-amber-500 font-medium";
        return "text-green-400";
    };

    // Extraer categorías únicas de los ítems actuales para la barra de filtros
    const filterCategories = useMemo(() => {
        const categoriesMap = new Map<
            string,
            { id: string; name: string; color?: string; count: number }
        >();
        items.forEach((item) => {
            const cat = item.product?.subcategory?.category;
            if (cat && cat.id) {
                if (!categoriesMap.has(cat.id)) {
                    categoriesMap.set(cat.id, {
                        id: cat.id,
                        name: cat.name,
                        color: cat.color,
                        count: 0,
                    });
                }
                categoriesMap.get(cat.id)!.count += 1;
            }
        });
        return Array.from(categoriesMap.values());
    }, [items]);

    // Extraer pisos/zonas únicos de las órdenes actuales
    const filterFloors = useMemo(() => {
        const floorsMap = new Map<string, { name: string; count: number }>();
        items.forEach((item) => {
            const floorName =
                item.operation.table?.floor?.name ||
                item.operation.serviceType ||
                "Salón";
            if (!floorsMap.has(floorName)) {
                floorsMap.set(floorName, { name: floorName, count: 0 });
            }
            floorsMap.get(floorName)!.count += 1;
        });
        return Array.from(floorsMap.values());
    }, [items]);

    // Aplicar filtros de Piso y Categoría
    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            const itemFloor =
                item.operation.table?.floor?.name ||
                item.operation.serviceType ||
                "Salón";
            const matchesFloor =
                !selectedFloorName || itemFloor === selectedFloorName;

            const itemCategory = item.product?.subcategory?.category?.id;
            const matchesCategory =
                !selectedCategoryId || itemCategory === selectedCategoryId;

            return matchesFloor && matchesCategory;
        });
    }, [items, selectedFloorName, selectedCategoryId]);

    // Agrupar ítems por Orden (operationId) para ByOrderView
    const orders = useMemo(() => {
        const groups: Record<
            string,
            {
                id: string;
                order: number; // API devuelve number
                serviceType: string;
                table?: any;
                user?: any;
                items: KitchenItem[];
                earliestCreatedAt: string;
            }
        > = {};

        filteredItems.forEach((item) => {
            const opId = item.operation.id;
            if (!groups[opId]) {
                groups[opId] = {
                    id: opId,
                    order: item.operation.order,
                    serviceType: item.operation.serviceType,
                    table: item.operation.table,
                    user: item.operation.user,
                    items: [],
                    earliestCreatedAt: item.createdAt,
                };
            }
            groups[opId].items.push(item);
            // Mantener la hora del primer plato para medir el tiempo total de la orden
            if (
                new Date(item.createdAt).getTime() <
                new Date(groups[opId].earliestCreatedAt).getTime()
            ) {
                groups[opId].earliestCreatedAt = item.createdAt;
            }
        });

        // Ordenar órdenes de más antigua a más reciente
        return Object.values(groups).sort((a, b) => {
            return (
                new Date(a.earliestCreatedAt).getTime() -
                new Date(b.earliestCreatedAt).getTime()
            );
        });
    }, [filteredItems]);

    // Agrupar ítems por Producto para ByGroupView
    const groupedProducts = useMemo(() => {
        const groups: Record<
            string,
            {
                productId: number; // API devuelve number
                productName: string;
                totalQty: number;
                preparationTime?: number;
                categoryColor?: string;
                earliestCreatedAt: string;
                details: Array<{
                    itemId: string;
                    orderNumber: number; // API devuelve number
                    tableName: string;
                    quantity: number;
                    notes?: string;
                }>;
                itemIds: string[];
            }
        > = {};

        filteredItems.forEach((item) => {
            const prodName = item.productName;
            const qty = parseQuantity(item.quantity);
            if (!groups[prodName]) {
                groups[prodName] = {
                    productId: item.productId,
                    productName: prodName,
                    totalQty: 0,
                    preparationTime: item.product?.preparationTime,
                    categoryColor: item.product?.subcategory?.category?.color,
                    earliestCreatedAt: item.createdAt,
                    details: [],
                    itemIds: [],
                };
            }

            groups[prodName].totalQty += qty;
            groups[prodName].itemIds.push(item.id);

            const tableName =
                item.operation.table?.name ||
                item.operation.serviceType ||
                "Salón";
            groups[prodName].details.push({
                itemId: item.id,
                orderNumber: item.operation.order,
                tableName,
                quantity: qty,
                notes: item.notes,
            });

            if (
                new Date(item.createdAt).getTime() <
                new Date(groups[prodName].earliestCreatedAt).getTime()
            ) {
                groups[prodName].earliestCreatedAt = item.createdAt;
            }
        });

        return Object.values(groups).sort((a, b) => {
            return (
                new Date(a.earliestCreatedAt).getTime() -
                new Date(b.earliestCreatedAt).getTime()
            );
        });
    }, [filteredItems]);

    // Manejar el marcado de preparado (con QuantityPickerDialog si aplica)
    const handleMarkItemPrepared = (item: KitchenItem) => {
        const qty = parseQuantity(item.quantity);
        if (qty > 1) {
            setQtyPickerDialog({
                isOpen: true,
                itemId: item.id,
                productName: item.productName,
                maxQty: qty,
                onConfirm: async (selectedQty) => {
                    try {
                        if (selectedQty === qty) {
                            await markItemPrepared(item.id);
                        } else {
                            await markPartialPrepared(item.id, selectedQty);
                        }
                        showToast(
                            `Preparado parcial (${selectedQty}/${qty}) registrado`,
                            "success",
                        );
                    } catch (err) {
                        showToast(
                            "Error al registrar preparación parcial",
                            "error",
                        );
                    }
                    setQtyPickerDialog((prev) => ({ ...prev, isOpen: false }));
                },
            });
        } else {
            setConfirmDialog({
                isOpen: true,
                title: "¿Marcar plato como listo?",
                message: `Confirmar que el plato "${item.productName}" está listo para ser servido.`,
                onConfirm: async () => {
                    try {
                        await markItemPrepared(item.id);
                        showToast("Plato marcado como listo", "success");
                    } catch (err) {
                        showToast("Error al marcar como listo", "error");
                    }
                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                },
            });
        }
    };

    const triggerMarkOrderPrepared = (orderId: string, orderNumber: number) => {
        setConfirmDialog({
            isOpen: true,
            title: `¿Marcar orden #${orderNumber} como lista?`,
            message:
                "Se marcarán como listos todos los platos pendientes de esta orden.",
            onConfirm: async () => {
                try {
                    await markOrderPrepared(orderId);
                    showToast(`Orden #${orderNumber} lista`, "success");
                } catch (err) {
                    showToast("Error al completar la orden", "error");
                }
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            },
        });
    };

    const triggerMarkGroupPrepared = (
        productName: string,
        itemIds: string[],
    ) => {
        setConfirmDialog({
            isOpen: true,
            title: `¿Preparar todo: ${productName}?`,
            message: `Se marcarán como listos todos los platos pendientes de "${productName}" en las distintas órdenes actuales.`,
            onConfirm: async () => {
                try {
                    await markGroupPrepared(itemIds);
                    showToast(
                        `Platos "${productName}" marcados como listos`,
                        "success",
                    );
                } catch (err) {
                    showToast("Error al completar los platos", "error");
                }
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            },
        });
    };

    return (
        <div className="min-h-screen bg-[#060E1F] text-[#E8EAF0] flex flex-col font-sans">
            {/* Broadcast Message Banner */}
            {broadcast && (
                <div className="bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-3 text-white flex justify-between items-center shadow-lg border-b border-orange-400 animate-slide-down">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📢</span>
                        <div>
                            <p className="font-semibold text-sm uppercase tracking-wide opacity-90">
                                Mensaje del mozo / caja ({broadcast.senderName})
                            </p>
                            <p className="text-lg font-medium">
                                {broadcast.message}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setBroadcast(null)}
                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Header / TopBar */}
            <header className="bg-[#0D2137] border-b border-[#2A3F5F] px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-md">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-900/30">
                        <span className="text-2xl">🍳</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-white">
                                KamApp
                            </h1>
                            <span
                                className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`}
                            />
                            <span className="text-xs text-[#8A9BBE]">
                                {isConnected ? "En línea" : "Desconectado"}
                            </span>
                        </div>
                        <p className="text-sm text-[#8A9BBE]">
                            {companyData?.branch.name || "Cocina Principal"} •
                            Cocinero:{" "}
                            <span className="text-white font-medium">
                                {user?.fullName || "Personal"}
                            </span>
                        </p>
                    </div>
                </div>

                {/* View Switcher */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/promotions")}
                        className="px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 bg-[#1A2E45] text-[#FF6F00] hover:bg-[#1E3A5F]"
                    >
                        🏷️ Promociones
                    </button>
                    <div className="flex bg-[#060E1F] rounded-xl p-1 border border-[#2A3F5F]">
                        <button
                            onClick={() => setActiveView("byOrder")}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                activeView === "byOrder"
                                    ? "bg-[#1E3A5F] text-[#4CAF50] shadow-sm border border-[#2A3F5F]"
                                    : "text-[#8A9BBE] hover:text-white"
                            }`}
                        >
                            POR ORDEN
                        </button>
                        <button
                            onClick={() => setActiveView("byItem")}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                activeView === "byItem"
                                    ? "bg-[#1E3A5F] text-[#4CAF50] shadow-sm border border-[#2A3F5F]"
                                    : "text-[#8A9BBE] hover:text-white"
                            }`}
                        >
                            POR ÍTEM
                        </button>
                        <button
                            onClick={() => setActiveView("byGroup")}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                activeView === "byGroup"
                                    ? "bg-[#1E3A5F] text-[#4CAF50] shadow-sm border border-[#2A3F5F]"
                                    : "text-[#8A9BBE] hover:text-white"
                            }`}
                        >
                            POR PLATO
                        </button>
                    </div>

                    {/* TTS and Notifications Controls */}
                    <div className="flex items-center gap-3 bg-[#060E1F] rounded-xl p-2 border border-[#2A3F5F]">
                        {/* TTS Toggle */}
                        {ttsIsSupported && (
                            <button
                                onClick={() => setTtsIsEnabled(!ttsIsEnabled)}
                                className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all flex items-center gap-1 ${
                                    ttsIsEnabled
                                        ? "bg-[#1E3A5F] text-[#4CAF50]"
                                        : "text-[#8A9BBE] hover:text-white"
                                }`}
                            >
                                🔊 {ttsIsEnabled ? "ON" : "OFF"}
                            </button>
                        )}

                        {/* Voice Selector */}
                        {ttsIsSupported &&
                            ttsIsEnabled &&
                            ttsVoices.length > 0 && (
                                <select
                                    value={ttsSelectedVoice?.name || ""}
                                    onChange={(e) => {
                                        const voice = ttsVoices.find(
                                            (v) => v.name === e.target.value,
                                        );
                                        if (voice) setTtsSelectedVoice(voice);
                                    }}
                                    className="bg-[#1A2E45] border border-[#2A3F5F] text-white text-xs px-2 py-1.5 rounded-lg outline-none focus:border-[#4CAF50]"
                                >
                                    {ttsVoices
                                        .filter((v) => v.lang.startsWith("es"))
                                        .map((voice) => (
                                            <option
                                                key={voice.name}
                                                value={voice.name}
                                            >
                                                {voice.name}
                                            </option>
                                        ))}
                                </select>
                            )}

                        {/* Test TTS Button */}
                        {ttsIsSupported && ttsIsEnabled && (
                            <button
                                onClick={() => speak("Prueba de voz exitosa")}
                                className="px-2 py-1.5 bg-[#1A2E45] hover:bg-[#1E3A5F] text-white text-xs font-semibold rounded-lg transition-all"
                            >
                                🎤
                            </button>
                        )}
                    </div>

                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-rose-600/90 hover:bg-rose-600 text-white font-semibold text-sm rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-rose-950/40"
                    >
                        Salir
                    </button>
                </div>
            </header>

            {/* FilterBar */}
            <section className="bg-[#0D2137]/60 border-b border-[#2A3F5F]/70 px-6 py-3 flex flex-wrap items-center gap-3">
                {/* Filtros de Piso / Zona (Solo en vista POR ORDEN) */}
                {activeView === "byOrder" && (
                    <div className="flex items-center gap-2 flex-wrap border-r border-[#2A3F5F] pr-4 mr-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#8A9BBE]">
                            Pisos:
                        </span>
                        <button
                            onClick={() => setSelectedFloorName(null)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                selectedFloorName === null
                                    ? "bg-[#4CAF50] text-[#060E1F] border-[#4CAF50]"
                                    : "bg-[#1A2E45] text-[#8A9BBE] border-[#2A3F5F] hover:text-white"
                            }`}
                        >
                            Todos ({items.length})
                        </button>
                        {filterFloors.map((floor) => (
                            <button
                                key={floor.name}
                                onClick={() => setSelectedFloorName(floor.name)}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                    selectedFloorName === floor.name
                                        ? "bg-[#4CAF50] text-[#060E1F] border-[#4CAF50]"
                                        : "bg-[#1A2E45] text-[#8A9BBE] border-[#2A3F5F] hover:text-white"
                                }`}
                            >
                                {floor.name} ({floor.count})
                            </button>
                        ))}
                    </div>
                )}

                {/* Filtros de Categorías */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8A9BBE]">
                        Categorías:
                    </span>
                    <button
                        onClick={() => setSelectedCategoryId(null)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            selectedCategoryId === null
                                ? "bg-[#4CAF50] text-[#060E1F] border-[#4CAF50]"
                                : "bg-[#1A2E45] text-[#8A9BBE] border-[#2A3F5F] hover:text-white"
                        }`}
                    >
                        Todas
                    </button>
                    {filterCategories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategoryId(cat.id)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                selectedCategoryId === cat.id
                                    ? "bg-[#4CAF50] text-[#060E1F] border-[#4CAF50]"
                                    : "bg-[#1A2E45] text-[#8A9BBE] border-[#2A3F5F] hover:text-white"
                            }`}
                            style={{
                                borderColor:
                                    selectedCategoryId === cat.id
                                        ? "#4CAF50"
                                        : cat.color || "#2A3F5F",
                            }}
                        >
                            {cat.name} ({cat.count})
                        </button>
                    ))}
                </div>
            </section>

            {/* Main Grid Content */}
            <main className="flex-1 p-6 overflow-y-auto">
                {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-lg text-[#8A9BBE]">
                                Cargando platos de cocina...
                            </p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="bg-[#0D2137] border border-rose-500/30 p-8 rounded-2xl max-w-md text-center shadow-2xl">
                            <span className="text-5xl mb-4 block">⚠️</span>
                            <h2 className="text-xl font-bold text-white mb-2">
                                Error de conexión
                            </h2>
                            <p className="text-[#8A9BBE] mb-6">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all"
                            >
                                Reintentar
                            </button>
                        </div>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                        <span className="text-7xl mb-6 animate-bounce">🎉</span>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            ¡Todo preparado!
                        </h2>
                        <p className="text-[#8A9BBE] max-w-sm">
                            No quedan pedidos pendientes en la zona filtrada.
                            ¡Buen trabajo!
                        </p>
                    </div>
                ) : activeView === "byOrder" ? (
                    // Vista por Orden
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {orders.map((order) => {
                            const allPrepared = order.items.every(
                                (item) => item.isPrepared,
                            );
                            return (
                                <div
                                    key={order.id}
                                    className={`bg-[#0D2137] rounded-2xl border-2 transition-all flex flex-col shadow-lg hover:shadow-2xl ${
                                        allPrepared
                                            ? "border-emerald-500/50 bg-[#0d2732]"
                                            : "border-[#2A3F5F]/60"
                                    }`}
                                >
                                    {/* Tarjeta Orden Cabecera */}
                                    <div className="p-4 bg-[#1A2E45]/80 rounded-t-2xl border-b border-[#2A3F5F]/40 flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs bg-[#4CAF50]/15 text-[#4CAF50] font-bold px-2 py-0.5 rounded">
                                                    Orden #{order.order}
                                                </span>
                                                <span className="text-xs font-semibold text-[#8A9BBE]">
                                                    {order.table?.name ||
                                                        order.serviceType}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[#8A9BBE] mt-1">
                                                Piso:{" "}
                                                <span className="text-white font-medium">
                                                    {order.table?.floor?.name ||
                                                        "Salón"}
                                                </span>
                                            </p>
                                            {order.user && (
                                                <p className="text-[10px] text-[#8A9BBE]">
                                                    Mozo:{" "}
                                                    <span className="text-white">
                                                        {order.user.firstName}{" "}
                                                        {order.user.lastName}
                                                    </span>
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-end gap-1">
                                            <span
                                                className={`text-sm font-mono ${getTimerColorClass(order.earliestCreatedAt)}`}
                                            >
                                                {getElapsedTime(
                                                    order.earliestCreatedAt,
                                                )}
                                            </span>
                                            {!allPrepared && (
                                                <button
                                                    onClick={() =>
                                                        triggerMarkOrderPrepared(
                                                            order.id,
                                                            order.order,
                                                        )
                                                    }
                                                    className="px-2.5 py-1 bg-emerald-500/90 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition-all"
                                                >
                                                    Completar
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Items de la orden */}
                                    <div className="p-4 flex-1 space-y-3">
                                        {order.items.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() =>
                                                    !item.isPrepared &&
                                                    !item.isCanceled &&
                                                    handleMarkItemPrepared(item)
                                                }
                                                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                                    item.isPrepared
                                                        ? "bg-emerald-950/20 border-emerald-500/30 opacity-60"
                                                        : item.isCanceled
                                                          ? "bg-rose-950/10 border-rose-500/20 opacity-40 line-through"
                                                          : "bg-[#1A2E45]/40 border-[#2A3F5F] hover:bg-[#1A2E45]/80 hover:border-emerald-500/40"
                                                }`}
                                            >
                                                <div className="flex justify-between items-start gap-2">
                                                    <p
                                                        className={`font-semibold text-sm ${item.isPrepared ? "text-emerald-400" : "text-white"}`}
                                                    >
                                                        {item.quantity}x{" "}
                                                        {item.productName}
                                                    </p>
                                                    {item.isPrepared && (
                                                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                            Listo
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Notas */}
                                                {item.notes && (
                                                    <p className="text-[11px] text-amber-400/95 italic mt-1 font-medium bg-amber-500/5 p-1 rounded">
                                                        📝 {item.notes}
                                                    </p>
                                                )}

                                                {/* Componentes de combo */}
                                                {item.comboComponents &&
                                                    item.comboComponents
                                                        .length > 0 && (
                                                        <div className="mt-2 pl-3 border-l-2 border-[#2A3F5F] space-y-1">
                                                            {item.comboComponents.map(
                                                                (comp) => (
                                                                    <p
                                                                        key={
                                                                            comp.id
                                                                        }
                                                                        className="text-[11px] text-[#8A9BBE]"
                                                                    >
                                                                        •{" "}
                                                                        {
                                                                            comp.quantity
                                                                        }
                                                                        x{" "}
                                                                        {
                                                                            comp.productName
                                                                        }
                                                                    </p>
                                                                ),
                                                            )}
                                                        </div>
                                                    )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : activeView === "byItem" ? (
                    // Vista por Ítems individuales
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredItems
                            .filter(
                                (item) => !item.isPrepared && !item.isCanceled,
                            )
                            .sort(
                                (a, b) =>
                                    new Date(a.createdAt).getTime() -
                                    new Date(b.createdAt).getTime(),
                            )
                            .map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-[#0D2137] rounded-2xl border border-[#2A3F5F]/70 p-5 shadow-lg flex flex-col justify-between hover:border-emerald-500/30 transition-all"
                                >
                                    <div>
                                        <div className="flex justify-between items-start gap-2 mb-2">
                                            <span className="text-xs bg-[#1E3A5F] text-[#4CAF50] font-bold px-2 py-0.5 rounded">
                                                Mesa{" "}
                                                {item.operation.table?.name ||
                                                    "Llevar"}
                                            </span>
                                            <span
                                                className={`text-sm font-mono ${getTimerColorClass(item.createdAt, item.product?.preparationTime)}`}
                                            >
                                                {getElapsedTime(item.createdAt)}
                                            </span>
                                        </div>

                                        <h3 className="text-lg font-bold text-white line-clamp-2">
                                            {item.quantity}x {item.productName}
                                        </h3>

                                        <p className="text-xs text-[#8A9BBE] mt-1">
                                            Orden #{item.operation.order} •{" "}
                                            {item.operation.table?.floor
                                                ?.name || "Principal"}
                                        </p>

                                        {item.notes && (
                                            <p className="text-xs text-amber-400 bg-amber-500/5 italic mt-3 p-2 rounded border border-amber-500/10">
                                                📝 {item.notes}
                                            </p>
                                        )}

                                        {item.comboComponents &&
                                            item.comboComponents.length > 0 && (
                                                <div className="mt-3 pl-3 border-l-2 border-[#2A3F5F] space-y-1">
                                                    {item.comboComponents.map(
                                                        (comp) => (
                                                            <p
                                                                key={comp.id}
                                                                className="text-xs text-[#8A9BBE]"
                                                            >
                                                                •{" "}
                                                                {comp.quantity}x{" "}
                                                                {
                                                                    comp.productName
                                                                }
                                                            </p>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                    </div>

                                    <button
                                        onClick={() =>
                                            handleMarkItemPrepared(item)
                                        }
                                        className="w-full mt-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-950/20"
                                    >
                                        Marcar como Listo
                                    </button>
                                </div>
                            ))}
                    </div>
                ) : (
                    // Vista por Plato / Agrupado (ByGroupView)
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {groupedProducts.map((group) => (
                            <div
                                key={group.productName}
                                className="bg-[#0D2137] rounded-2xl border border-[#2A3F5F]/70 p-5 shadow-lg flex flex-col justify-between hover:border-emerald-500/30 transition-all"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span
                                            className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase"
                                            style={{
                                                borderColor:
                                                    group.categoryColor ||
                                                    "#2A3F5F",
                                                color:
                                                    group.categoryColor ||
                                                    "#8A9BBE",
                                                backgroundColor:
                                                    group.categoryColor
                                                        ? `${group.categoryColor}15`
                                                        : "transparent",
                                            }}
                                        >
                                            Plato
                                        </span>
                                        <span
                                            className={`text-sm font-mono ${getTimerColorClass(group.earliestCreatedAt, group.preparationTime)}`}
                                        >
                                            {getElapsedTime(
                                                group.earliestCreatedAt,
                                            )}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-white flex justify-between items-center">
                                        <span>{group.productName}</span>
                                        <span className="bg-[#4CAF50]/15 text-[#4CAF50] text-xl px-2.5 py-0.5 rounded-xl font-extrabold border border-[#4CAF50]/20">
                                            {group.totalQty}
                                        </span>
                                    </h3>

                                    {/* Detalle por mesas de este plato */}
                                    <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {group.details.map((detail, idx) => (
                                            <div
                                                key={idx}
                                                className="flex justify-between text-xs bg-[#1A2E45]/40 p-2 rounded-lg border border-[#2A3F5F]/40"
                                            >
                                                <div>
                                                    <span className="font-semibold text-emerald-400">
                                                        x{detail.quantity}
                                                    </span>
                                                    <span className="text-[#8A9BBE] ml-1">
                                                        en Mesa{" "}
                                                        {detail.tableName}
                                                    </span>
                                                    {detail.notes && (
                                                        <p className="text-[10px] text-amber-400 italic mt-0.5">
                                                            📝 {detail.notes}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-[#8A9BBE]">
                                                    Ord #{detail.orderNumber}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() =>
                                        triggerMarkGroupPrepared(
                                            group.productName,
                                            group.itemIds,
                                        )
                                    }
                                    className="w-full mt-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl transition-all shadow-md"
                                >
                                    Preparar Todo ({group.totalQty})
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* BottomBar */}
            <footer className="bg-[#0D2137] border-t border-[#2A3F5F] px-6 py-3 flex flex-wrap justify-between items-center text-xs text-[#8A9BBE]">
                <div className="flex items-center gap-4">
                    <p>
                        Platos en Cocina:{" "}
                        <span className="text-white font-bold">
                            {items.length}
                        </span>
                    </p>
                    <p>
                        Órdenes Activas:{" "}
                        <span className="text-white font-bold">
                            {orders.length}
                        </span>
                    </p>
                </div>
                <p className="mt-1 sm:mt-0 font-medium">
                    KamApp Kitchen Display System v1.2
                </p>
            </footer>

            {/* QuantityPickerDialog */}
            {qtyPickerDialog.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[#0D2137] border border-[#2A3F5F] rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-up">
                        <h3 className="text-lg font-bold text-white mb-2">
                            Preparar Cantidad
                        </h3>
                        <p className="text-xs text-[#8A9BBE] mb-4">
                            ¿Cuántas unidades de{" "}
                            <span className="text-white font-bold">
                                {qtyPickerDialog.productName}
                            </span>{" "}
                            vas a completar? (Máx {qtyPickerDialog.maxQty})
                        </p>

                        <div className="grid grid-cols-5 gap-2 mb-6">
                            {Array.from({ length: qtyPickerDialog.maxQty }).map(
                                (_, idx) => {
                                    const qty = idx + 1;
                                    return (
                                        <button
                                            key={qty}
                                            onClick={() =>
                                                qtyPickerDialog.onConfirm(qty)
                                            }
                                            className="py-2.5 bg-[#1A2E45] hover:bg-[#1E3A5F] hover:text-[#4CAF50] rounded-xl font-bold border border-[#2A3F5F] transition-all"
                                        >
                                            {qty}
                                        </button>
                                    );
                                },
                            )}
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() =>
                                    setQtyPickerDialog((prev) => ({
                                        ...prev,
                                        isOpen: false,
                                    }))
                                }
                                className="px-4 py-2 bg-[#1A2E45] hover:bg-[#2A3F5F] font-semibold text-xs rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ConfirmDialog */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[#0D2137] border border-[#2A3F5F] rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-up">
                        <h3 className="text-lg font-bold text-white mb-2">
                            {confirmDialog.title}
                        </h3>
                        <p className="text-sm text-[#8A9BBE] mb-6">
                            {confirmDialog.message}
                        </p>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() =>
                                    setConfirmDialog((prev) => ({
                                        ...prev,
                                        isOpen: false,
                                    }))
                                }
                                className="px-4 py-2 bg-[#1A2E45] hover:bg-[#2A3F5F] font-semibold text-xs rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDialog.onConfirm}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-all"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KitchenScreen;
