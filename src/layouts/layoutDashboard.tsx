import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, gql } from "@apollo/client";
import { useAuth } from "../hooks/useAuth";
import { useResponsive } from "../hooks/useResponsive";
import { useSwitchBranch } from "../hooks/useSwitchBranch";
import { useIntegratedPrinterSyncFromServer } from "../hooks/useIntegratedPrinterSyncFromServer";
import { useUserPermissions } from "../hooks/useUserPermissions";
import { WebSocketProvider, useWebSocket } from "../context/WebSocketContext";
import Floor from "../modules/sales/floor";
import CashPay from "../modules/cash/cashPay";
import Cashs from "../modules/cash/cashs";
import Message from "../modules/cash/message";
import CreateUser from "../modules/user/createUser";
import UserPermissions from "../modules/user/UserPermissions";
import Products from "../modules/products/Products";
import Inventories from "../modules/inventories/Inventories";
import Kardex from "../modules/inventories/kardex";
import Purchase from "../modules/purchase/Purchase";
import ReportSale from "../modules/reports/reportSale";
import ReportCancel from "../modules/reports/reportCancel";
import ReportsProductsSold from "../modules/reports/reportsProductsSold";
import ReportCategorySales from "../modules/reports/reportCategorySales";
import ReportEmployee from "../modules/reports/reportEmployee";
import Observation from "../modules/configuration/observation";
import Subcategory from "../modules/configuration/subcategory";
import CategoryModule from "../modules/configuration/category";
import Printers from "../modules/configuration/printers";
import LocalPrinters from "../modules/configuration/localPrinters";
import FloorModule from "../modules/configuration/floor";
import TableModule from "../modules/configuration/table";
import Delivery from "../modules/sales/delivery";
import { GET_MY_UNREAD_MESSAGES } from "../graphql/queries";
import { MARK_MESSAGE_READ } from "../graphql/mutations";
import type { Table } from "../types/table";

const GET_MY_KITCHEN_NOTIFICATIONS = gql`
    query GetMyKitchenNotifications($limit: Int) {
        myKitchenNotifications(limit: $limit) {
            id
            message
            createdAt
            operation {
                id
                table {
                    id
                    name
                }
            }
            operationDetail {
                id
                productName
                quantity
            }
            preparedBy {
                id
                fullName
            }
        }
    }
`;

const formatRelativeTime = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return "Hace un momento";
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return "Hace un momento";
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} d`;
};

interface LayoutDashboardProps {
    children: React.ReactNode;
}

// Componente interno que usa el WebSocket
const LayoutDashboardContent: React.FC<LayoutDashboardProps> = ({
    children,
}) => {
    const navigate = useNavigate();
    const { user, companyData, logout, getMacAddress } = useAuth();
    useIntegratedPrinterSyncFromServer();
    const [macAddress, setMacAddress] = useState<string>("");
    const { disconnect, subscribe } = useWebSocket();
    const { switchToBranch, loading: switchingBranch } = useSwitchBranch();
    const { breakpoint, isMobile } = useResponsive();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
    const isSmall = breakpoint === "sm"; // 640px - 767px
    const isMedium = breakpoint === "md"; // 768px - 1023px
    const isSmallDesktop = breakpoint === "lg"; // 1024px - 1279px
    const isMediumDesktop = breakpoint === "xl"; // 1280px - 1535px
    const isMobileOnly = breakpoint === "xs";

    const isOverlay = ["xs", "sm", "md", "lg", "xl"].includes(breakpoint);

    // Tamaños adaptativos
    const sidebarWidthValue = isSmall
        ? "240px"
        : isMedium
          ? "260px"
          : isSmallDesktop
            ? "260px"
            : "280px";

    const sidebarWidth = sidebarOpen ? sidebarWidthValue : "0px";
    const displayedSidebarWidth = isOverlay ? sidebarWidthValue : sidebarWidth;

    const headerPadding = isMobileOnly
        ? "0.5rem 0.75rem"
        : isSmall
          ? "0.75rem 1rem"
          : isMedium
            ? "1rem 1.25rem"
            : isSmallDesktop
              ? "1rem 1.5rem"
              : isMediumDesktop
                ? "1rem 1.75rem"
                : "1rem 2rem";

    const headerFontSize = isMobileOnly
        ? "1.125rem"
        : isSmall
          ? "1.125rem"
          : isMedium
            ? "1.25rem"
            : isSmallDesktop
              ? "1.375rem"
              : "1.5rem";

    const headerSubFontSize = isMobileOnly
        ? "0.8rem"
        : isSmall
          ? "0.75rem"
          : isMedium
            ? "0.8125rem"
            : isSmallDesktop
              ? "0.8125rem"
              : "0.875rem";

    const { hasPermission } = useUserPermissions();
    const [currentView, setCurrentView] = useState<
        | "dashboard"
        | "floors"
        | "cash"
        | "cashs"
        | "messages"
        | "employees"
        | "permissions"
        | "products"
        | "inventory"
        | "kardex"
        | "purchase"
        | "reports"
        | "configuration"
        | "delivery"
    >(() => {
        const savedView = localStorage.getItem("currentDashboardView");
        const validViews = [
            "dashboard",
            "floors",
            "cash",
            "cashs",
            "messages",
            "employees",
            "permissions",
            "products",
            "inventory",
            "kardex",
            "purchase",
            "reports",
            "configuration",
            "delivery",
        ];
        return savedView && validViews.includes(savedView)
            ? (savedView as any)
            : "dashboard";
    });

    useEffect(() => {
        if (currentView) {
            localStorage.setItem("currentDashboardView", currentView);
        }
    }, [currentView]);

    const [configurationTab, setConfigurationTab] = useState<
        | "category"
        | "subcategory"
        | "observation"
        | "printers"
        | "local_printers"
        | "floors_tables"
    >("category");
    const [floorsTablesSubTab, setFloorsTablesSubTab] = useState<
        "floors" | "tables"
    >("floors");
    const [reportType, setReportType] = useState<
        | "sales"
        | "cancellation"
        | "productsSold"
        | "categorySales"
        | "employees"
    >("sales");
    const [selectedCashTable, setSelectedCashTable] = useState<Table | null>(
        null,
    );
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserPopover, setShowUserPopover] = useState(false);
    const notificationsRef = useRef<HTMLDivElement | null>(null);
    const userPopoverRef = useRef<HTMLDivElement | null>(null);
    const [hiddenNotificationIds, setHiddenNotificationIds] = useState<
        string[]
    >([]);

    const {
        data: notificationsData,
        loading: notificationsLoading,
        error: notificationsError,
        refetch: refetchKitchenNotifications,
    } = useQuery(GET_MY_KITCHEN_NOTIFICATIONS, {
        variables: { limit: 20 },
        skip: !user?.id,
        pollInterval: 30000,
    });

    const {
        data: broadcastMessagesData,
        loading: broadcastMessagesLoading,
        error: broadcastMessagesError,
        refetch: refetchBroadcastMessages,
    } = useQuery(GET_MY_UNREAD_MESSAGES, {
        skip: !user?.id,
        pollInterval: 10000,
    });

    const [markMessageReadMutation] = useMutation(MARK_MESSAGE_READ);

    useEffect(() => {
        let cancelled = false;
        getMacAddress().then((mac) => {
            if (!cancelled && mac) setMacAddress(mac);
        });
        return () => {
            cancelled = true;
        };
    }, [getMacAddress]);

    useEffect(() => {
        if (notificationsError) {
            console.error(
                "❌ Error al obtener notificaciones de cocina:",
                notificationsError,
            );
        }
    }, [notificationsError]);

    useEffect(() => {
        if (broadcastMessagesError) {
            console.error(
                "❌ Error al obtener mensajes broadcast:",
                broadcastMessagesError,
            );
        }
    }, [broadcastMessagesError]);

    useEffect(() => {
        if (!user?.id) {
            return;
        }
        const unsubscribeKitchen = subscribe("kitchen_notification", () => {
            refetchKitchenNotifications();
        });
        const unsubscribeBroadcast = subscribe(
            "broadcast_message",
            (message: any) => {
                // Actualizar notificaciones inmediatamente cuando llegue un mensaje broadcast
                // El servidor ya filtra los mensajes según los recipients, así que actualizamos directamente
                console.log(
                    "📬 Mensaje broadcast recibido por WebSocket:",
                    message,
                );
                refetchBroadcastMessages();
            },
        );
        return () => {
            unsubscribeKitchen();
            unsubscribeBroadcast();
        };
    }, [
        subscribe,
        refetchKitchenNotifications,
        refetchBroadcastMessages,
        user?.id,
    ]);

    // Función para verificar si el usuario debe ver un mensaje broadcast según su rol
    const shouldUserSeeMessage = (
        messageRecipients: string,
        userRole: string | undefined,
    ): boolean => {
        if (!userRole) return false;

        // Si el mensaje es para todos, todos lo ven
        if (messageRecipients === "ALL") return true;

        // Mapear roles del usuario a los valores de recipients
        const roleMapping: Record<string, string> = {
            WAITER: "WAITERS",
            COOK: "COOKS",
            CASHIER: "CASHIERS",
            ADMIN: "ADMINS",
        };

        // Verificar si el rol del usuario coincide con el destinatario del mensaje
        const userRecipientGroup = roleMapping[userRole.toUpperCase()];
        return userRecipientGroup === messageRecipients;
    };

    // Notificaciones de cocina
    const kitchenNotifications =
        notificationsData?.myKitchenNotifications ?? [];
    const unreadKitchenNotifications = useMemo(
        () =>
            kitchenNotifications.filter(
                (notification: any) => !notification?.isRead,
            ),
        [kitchenNotifications],
    );

    // Mensajes broadcast - filtrar solo los que corresponden al rol del usuario
    const broadcastMessages = useMemo(() => {
        const allMessages = broadcastMessagesData?.myUnreadMessages ?? [];
        return allMessages.filter((message: any) =>
            shouldUserSeeMessage(message.recipients, user?.role),
        );
    }, [broadcastMessagesData?.myUnreadMessages, user?.role]);

    const roleDisplay = (role?: string): string => {
        const r = role?.toUpperCase();
        if (r === "CASHIER") return "Cajero";
        if (r === "WAITER") return "Mozo";
        if (r === "COOK") return "Cocinero";
        if (r === "ADMIN") return "Administrador";
        return role || "";
    };

    // Combinar ambas notificaciones
    const allNotifications = useMemo(
        () =>
            [
                ...unreadKitchenNotifications.map((n: any) => ({
                    ...n,
                    type: "kitchen",
                })),
                ...broadcastMessages.map((m: any) => ({
                    ...m,
                    type: "broadcast",
                })),
            ].sort((a: any, b: any) => {
                // Ordenar por fecha, más recientes primero
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            }),
        [unreadKitchenNotifications, broadcastMessages],
    );

    const visibleNotifications = allNotifications.filter(
        (notification: any) =>
            !hiddenNotificationIds.includes(notification?.id),
    );
    const unreadCount = visibleNotifications.length;

    /** Clave estable del conjunto de pendientes (evita reabrir el panel en cada refetch si el usuario ya lo cerró). */
    const visibleNotificationIdsKey = useMemo(
        () =>
            allNotifications
                .filter((n: any) => !hiddenNotificationIds.includes(n?.id))
                .map((n: any) => String(n.id))
                .sort()
                .join("|"),
        [allNotifications, hiddenNotificationIds],
    );

    useEffect(() => {
        if (!allNotifications.length) {
            setHiddenNotificationIds([]);
            return;
        }
        setHiddenNotificationIds((prev) =>
            prev.filter((hiddenId) =>
                allNotifications.some(
                    (notification: any) => notification?.id === hiddenId,
                ),
            ),
        );
    }, [allNotifications]);

    // Abrir al cargar o cuando cambian los pendientes (nuevo aviso o cierre con ×); no forzar reapertura si solo repitió el mismo set tras un refetch
    useEffect(() => {
        if (notificationsLoading || broadcastMessagesLoading) {
            return;
        }
        if (!visibleNotificationIdsKey) {
            setShowNotifications(false);
            return;
        }
        setShowNotifications(true);
    }, [
        visibleNotificationIdsKey,
        notificationsLoading,
        broadcastMessagesLoading,
    ]);

    useEffect(() => {
        if (!showNotifications && !showUserPopover) {
            return;
        }
        const handleClickOutside = (event: MouseEvent) => {
            if (
                notificationsRef.current &&
                !notificationsRef.current.contains(event.target as Node)
            ) {
                setShowNotifications(false);
            }
            if (
                userPopoverRef.current &&
                !userPopoverRef.current.contains(event.target as Node)
            ) {
                setShowUserPopover(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showNotifications, showUserPopover]);

    const handleDismissNotification = (notificationId: string) => {
        setHiddenNotificationIds((prev) =>
            prev.includes(notificationId) ? prev : [...prev, notificationId],
        );
    };

    const handleMarkMessageRead = async (messageId: string) => {
        try {
            await markMessageReadMutation({
                variables: { messageId },
            });
            refetchBroadcastMessages();
        } catch (error) {
            console.error("Error marcando mensaje como leído:", error);
        }
    };

    const handleLogout = () => {
        // Desconectar WebSocket antes de hacer logout
        disconnect();
        logout();

        // Verificar si es entorno Electron
        const isElectron = navigator.userAgent
            .toLowerCase()
            .includes("electron");

        if (isElectron) {
            // En Electron navegar al login de empleado (los datos de la empresa se mantienen)
            navigate("/login-employee");
        } else {
            // En Web navegar a la Landing Page
            navigate("/");
        }
    };

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const handleMenuClick = (
        view:
            | "dashboard"
            | "floors"
            | "messages"
            | "employees"
            | "permissions"
            | "cashs"
            | "products"
            | "inventory"
            | "kardex"
            | "purchase"
            | "reports"
            | "configuration"
            | "delivery",
    ) => {
        setCurrentView(view);
        if (view === "configuration") {
            setConfigurationTab("category");
            setFloorsTablesSubTab("floors");
        }
        setSelectedCashTable(null);
        if (isOverlay) {
            setSidebarOpen(false);
        }
    };

    const handleOpenCash = (table: Table) => {
        setSelectedCashTable(table);
        setCurrentView("cash");
    };

    const handleBackFromCash = () => {
        setCurrentView("floors");
        setSelectedCashTable(null);
    };

    const SidebarItem = ({
        view,
        icon,
        label,
        isActive,
    }: {
        view: any;
        icon: string;
        label: string;
        isActive: boolean;
    }) => (
        <button
            onClick={() => handleMenuClick(view)}
            className={`group relative mx-4 flex w-[calc(100%-2rem)] items-center gap-3 overflow-hidden rounded-xl border px-5 py-3 text-left text-sm transition-all duration-300 ${
                isActive
                    ? "border-indigo-400/30 bg-indigo-500/15 text-indigo-300 shadow-[0_8px_20px_rgba(99,102,241,0.18)]"
                    : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-100"
            }`}
        >
            <span className="text-xl">{icon}</span>
            {sidebarOpen && label}
            {isActive && (
                <div className="absolute bottom-[20%] left-0 top-[20%] w-1 rounded-r bg-indigo-400" />
            )}
        </button>
    );

    const headerTitle =
        currentView === "dashboard"
            ? "Panel"
            : currentView === "floors"
              ? "Mesas"
              : currentView === "messages"
                ? "Mensajes"
                : currentView === "employees"
                  ? "Empleados"
                  : currentView === "permissions"
                    ? "Permisos"
                    : currentView === "products"
                      ? "Productos"
                      : currentView === "cashs"
                        ? "Gestión de Cajas"
                        : currentView === "inventory"
                          ? "Inventario"
                          : currentView === "kardex"
                            ? "Kardex"
                            : currentView === "purchase"
                              ? "Compras"
                              : currentView === "reports"
                                ? "Reportes"
                                : currentView === "configuration"
                                  ? "Configuración"
                                  : currentView === "delivery"
                                    ? "Punto de venta"
                                    : "Caja";

    const headerSubtitle =
        currentView === "dashboard"
            ? "Bienvenido de vuelta"
            : currentView === "floors"
              ? "Gestiona la ocupación y las órdenes de tus mesas."
              : currentView === "messages"
                ? "Envía mensajes a cocina, mozos u otros usuarios."
                : currentView === "employees"
                  ? "Administra los empleados de tu empresa."
                  : currentView === "permissions"
                    ? "Asigna permisos personalizados por usuario (solo administrador)."
                    : currentView === "products"
                      ? "Administra los productos de tu menú."
                      : currentView === "cashs"
                        ? "Gestiona las cajas registradoras, cierres y resúmenes de pagos."
                        : currentView === "inventory"
                          ? "Controla el stock de tus productos."
                          : currentView === "kardex"
                            ? "Registro de movimientos de inventario."
                            : currentView === "purchase"
                              ? "Gestiona las compras a proveedores y controla el stock."
                              : currentView === "reports"
                                ? reportType === "sales"
                                    ? "Visualiza reportes de ventas y documentos emitidos."
                                    : reportType === "cancellation"
                                      ? "Visualiza el historial de anulaciones de operaciones y productos."
                                      : reportType === "productsSold"
                                        ? "Visualiza productos vendidos por cantidad y monto."
                                        : reportType === "categorySales"
                                          ? "Visualiza ventas de platos y bebidas agrupadas por categoría."
                                          : "Visualiza ventas por empleado en el periodo."
                                : currentView === "configuration"
                                  ? "Configura observaciones y subcategorías de tus productos."
                                  : currentView === "delivery"
                                    ? "Gestiona las ventas para llevar sin asignar mesa."
                                    : selectedCashTable
                                      ? `Procesa el pago de ${selectedCashTable.name}.`
                                      : "Selecciona una mesa para revisar su orden.";

    const isFloorsSection = currentView === "floors" || currentView === "cash";
    const isAdmin = user?.role?.toUpperCase() === "ADMIN";

    // Permisos para visibilidad del menú (ADMIN ve todo)
    const canSeeDashboard = isAdmin || hasPermission("branch.view");
    const canSeeProducts = isAdmin || hasPermission("products.view");
    const canSeeFloors = isAdmin || hasPermission("orders.create");
    const canSeeDelivery = isAdmin || hasPermission("point_of_sale");
    const canSeeConfiguration = isAdmin || hasPermission("config.manage");
    const canSeeMessages = isAdmin || hasPermission("messages.view");
    const canSeeEmployees = isAdmin || hasPermission("users.manage");
    const canSeePermissions = isAdmin || hasPermission("users.manage");
    const canSeePurchase = isAdmin || hasPermission("purchases.manage");
    const canSeeCashs =
        isAdmin ||
        hasPermission("sales.close") ||
        hasPermission("cash.register_movements");
    const canSeeInventory = isAdmin || hasPermission("products.view");
    const canSeeKardex = isAdmin || hasPermission("kardex.view");
    const canSeeReports =
        isAdmin ||
        hasPermission("reports.sales") ||
        hasPermission("reports.cancellations") ||
        hasPermission("reports.sold_products") ||
        hasPermission("reports.user_sales");

    // Tras login (login.tsx): abrir vista Mesas si el usuario tiene permiso
    useEffect(() => {
        try {
            if (sessionStorage.getItem("postLoginOpenFloors") !== "1") return;
            sessionStorage.removeItem("postLoginOpenFloors");
            if (canSeeFloors) {
                setCurrentView("floors");
            }
        } catch {
            /* sin sessionStorage */
        }
    }, [canSeeFloors]);

    // Si la vista actual no está permitida, redirigir a la primera permitida
    useEffect(() => {
        const allowed = (v: typeof currentView) =>
            (v === "dashboard" && canSeeDashboard) ||
            (v === "floors" && canSeeFloors) ||
            (v === "cash" && canSeeFloors) ||
            (v === "delivery" && canSeeDelivery) ||
            (v === "products" && canSeeProducts) ||
            (v === "configuration" && canSeeConfiguration) ||
            (v === "messages" && canSeeMessages) ||
            (v === "employees" && canSeeEmployees) ||
            (v === "permissions" && canSeePermissions) ||
            (v === "purchase" && canSeePurchase) ||
            (v === "cashs" && canSeeCashs) ||
            (v === "inventory" && canSeeInventory) ||
            (v === "kardex" && canSeeKardex) ||
            (v === "reports" && canSeeReports);
        if (!allowed(currentView)) {
            if (canSeeDashboard) setCurrentView("dashboard");
            else if (canSeeFloors) setCurrentView("floors");
            else if (canSeeDelivery) setCurrentView("delivery");
            else if (canSeeProducts) setCurrentView("products");
            else if (canSeeCashs) setCurrentView("cashs");
            else if (canSeeMessages) setCurrentView("messages");
            else if (canSeeEmployees) setCurrentView("employees");
            else if (canSeePermissions) setCurrentView("permissions");
            else if (canSeePurchase) setCurrentView("purchase");
            else if (canSeeInventory) setCurrentView("inventory");
            else if (canSeeKardex) setCurrentView("kardex");
            else if (canSeeReports) setCurrentView("reports");
            else if (canSeeConfiguration) setCurrentView("configuration");
        }
    }, [
        currentView,
        canSeeDashboard,
        canSeeFloors,
        canSeeDelivery,
        canSeeProducts,
        canSeeConfiguration,
        canSeeMessages,
        canSeeEmployees,
        canSeePermissions,
        canSeePurchase,
        canSeeCashs,
        canSeeInventory,
        canSeeKardex,
        canSeeReports,
    ]);

    return (
        <div
            style={{
                height: "100vh",
                width: "100vw",
                maxWidth: "100vw",
                backgroundColor: "#f8fafc",
                fontFamily:
                    "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                position: "fixed",
                top: 0,
                left: 0,
                overflow: "hidden",
                display: "flex",
            }}
        >
            {/* Overlay para móviles/tablets/laptops */}
            {isOverlay && sidebarOpen && (
                <div
                    className="fixed inset-0 z-[999] bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className="fixed z-[1000] flex h-screen flex-col overflow-x-hidden overflow-y-auto border-r border-slate-800/70 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-white shadow-2xl shadow-slate-950/40"
                style={{
                    width: displayedSidebarWidth,
                    transform:
                        isOverlay && !sidebarOpen
                            ? `translateX(-${displayedSidebarWidth})`
                            : "translateX(0)",
                    transition:
                        "width 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease",
                    boxShadow: sidebarOpen
                        ? "2px 0 10px rgba(0, 0, 0, 0.1)"
                        : "none",
                }}
            >
                {/* Header del Sidebar */}
                <div className="flex items-center justify-between border-b border-slate-800 p-5">
                    {sidebarOpen && (
                        <div>
                            <h2 className="m-0 bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-xl font-bold text-transparent">
                                SumApp
                            </h2>
                            <p className="mt-1 text-sm font-medium text-slate-400">
                                {companyData?.company.denomination}
                            </p>
                            {macAddress && (
                                <p className="mt-1 font-mono text-xs text-slate-500">
                                    MAC: {macAddress}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Información del Usuario */}
                <div className="border-b border-slate-800 p-6">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xl shadow-lg shadow-indigo-500/20">
                            👤
                        </div>
                        {sidebarOpen && (
                            <div>
                                <p className="m-0 text-sm font-semibold text-white">
                                    {user?.fullName}
                                </p>
                                <p className="m-0 text-xs text-slate-400">
                                    {roleDisplay(user?.role)}
                                </p>
                            </div>
                        )}
                    </div>

                    {sidebarOpen && (
                        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
                            <p className="mb-2 font-medium">
                                <strong>Sucursal:</strong>
                            </p>
                            {(companyData?.availableBranches?.length ?? 0) >
                            1 ? (
                                <select
                                    value={companyData?.branch.id ?? ""}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        if (id) {
                                            disconnect();
                                            switchToBranch(id);
                                        }
                                    }}
                                    disabled={switchingBranch}
                                    className="w-full cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 focus:border-indigo-500 focus:outline-none"
                                >
                                    {companyData?.availableBranches?.map(
                                        (b: any) => (
                                            <option key={b.id} value={b.id}>
                                                {b.name}
                                            </option>
                                        ),
                                    )}
                                </select>
                            ) : (
                                <p className="m-0 font-semibold text-white">
                                    {companyData?.branch.name}
                                </p>
                            )}
                            <p className="mt-2 m-0 border-t border-white/5 pt-2">
                                <strong>DNI:</strong> {user?.dni}
                            </p>
                        </div>
                    )}
                </div>

                {/* Menú de Navegación */}
                <nav className="flex-1 overflow-y-auto py-4 [scrollbar-width:thin]">
                    <div className="mb-2 px-6 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {sidebarOpen && "MENÚ"}
                    </div>

                    {/* Opciones del menú */}
                    <div className="flex flex-col gap-2">
                        {canSeeDashboard && (
                            <SidebarItem
                                view="dashboard"
                                icon="📊"
                                label="Panel"
                                isActive={currentView === "dashboard"}
                            />
                        )}

                        {canSeeProducts && (
                            <SidebarItem
                                view="products"
                                icon="🍽️"
                                label="Productos"
                                isActive={currentView === "products"}
                            />
                        )}

                        {canSeeFloors && (
                            <SidebarItem
                                view="floors"
                                icon="🪑"
                                label="Mesas"
                                isActive={isFloorsSection}
                            />
                        )}

                        {canSeeDelivery && (
                            <SidebarItem
                                view="delivery"
                                icon="🚗"
                                label="Punto de venta"
                                isActive={currentView === "delivery"}
                            />
                        )}

                        {canSeeConfiguration && (
                            <SidebarItem
                                view="configuration"
                                icon="⚙️"
                                label="Configuración"
                                isActive={currentView === "configuration"}
                            />
                        )}

                        {canSeeMessages && (
                            <SidebarItem
                                view="messages"
                                icon="💬"
                                label="Mensajes"
                                isActive={currentView === "messages"}
                            />
                        )}

                        {canSeeEmployees && (
                            <SidebarItem
                                view="employees"
                                icon="👥"
                                label="Empleados"
                                isActive={currentView === "employees"}
                            />
                        )}

                        {canSeePermissions && (
                            <SidebarItem
                                view="permissions"
                                icon="🔐"
                                label="Permisos"
                                isActive={currentView === "permissions"}
                            />
                        )}

                        {canSeePurchase && (
                            <SidebarItem
                                view="purchase"
                                icon="🛒"
                                label="Compras"
                                isActive={currentView === "purchase"}
                            />
                        )}

                        {canSeeCashs && (
                            <SidebarItem
                                view="cashs"
                                icon="💰"
                                label="Caja"
                                isActive={currentView === "cashs"}
                            />
                        )}

                        {canSeeInventory && (
                            <SidebarItem
                                view="inventory"
                                icon="📦"
                                label="Inventario"
                                isActive={currentView === "inventory"}
                            />
                        )}

                        {canSeeKardex && (
                            <SidebarItem
                                view="kardex"
                                icon="📋"
                                label="Kardex"
                                isActive={currentView === "kardex"}
                            />
                        )}

                        {canSeeReports && (
                            <SidebarItem
                                view="reports"
                                icon="📊"
                                label="Reportes"
                                isActive={currentView === "reports"}
                            />
                        )}
                    </div>
                </nav>

                {/* Footer del Sidebar */}
                <div className="border-t border-slate-800 p-6">
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-left text-sm font-semibold text-rose-300 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-300/50 hover:bg-rose-500/20 hover:text-rose-200 hover:shadow-lg hover:shadow-rose-500/20"
                    >
                        <span className="text-xl drop-shadow-[0_2px_4px_rgba(239,68,68,0.2)]">
                            🚪
                        </span>
                        {sidebarOpen && "Cerrar Sesión"}
                    </button>
                </div>
            </div>

            {/* Contenido Principal */}
            <div
                style={{
                    marginLeft: isOverlay ? "0px" : sidebarWidth,
                    width: isOverlay
                        ? "100vw"
                        : `calc(100vw - ${sidebarWidth})`,
                    maxWidth: isOverlay
                        ? "100vw"
                        : `calc(100vw - ${sidebarWidth})`,
                    minWidth: 0,
                    height: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    overflowY:
                        currentView === "cash" || currentView === "delivery"
                            ? "hidden"
                            : "auto",
                    overflowX: "hidden",
                    transition:
                        "margin-left 0.3s ease, width 0.3s ease, max-width 0.3s ease",
                    boxSizing: "border-box",
                }}
            >
                {/* Header Principal: título | sucursal centrada | empleado + notificaciones */}
                <header
                    className="flex items-center justify-between border-b border-slate-200 bg-white shadow-sm"
                    style={{
                        padding: headerPadding,
                        gap: isMobile ? "0.5rem" : "1rem",
                    }}
                >
                    {/* Sección Izquierda: Toggle + Título */}
                    <div className="flex min-w-0 items-center gap-2 md:gap-4 flex-1">
                        <button
                            onClick={toggleSidebar}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                        >
                            {sidebarOpen ? "⇤" : "☰"}
                        </button>
                        <div className="min-w-0">
                            <h1
                                className="m-0 truncate font-bold text-slate-800"
                                style={{
                                    fontSize: headerFontSize,
                                }}
                            >
                                {headerTitle}
                            </h1>
                            {!isMobile && (
                                <div
                                    className="mt-1 truncate text-slate-500"
                                    style={{
                                        fontSize: headerSubFontSize,
                                    }}
                                >
                                    {headerSubtitle}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sección Central: Sucursal (Solo Desktop) */}
                    {!isMobile && (
                        <div className="hidden md:flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                            <span>🏢</span>
                            {(companyData?.availableBranches?.length ?? 0) >
                            1 ? (
                                <select
                                    value={companyData?.branch.id ?? ""}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        if (id) {
                                            disconnect();
                                            switchToBranch(id);
                                        }
                                    }}
                                    disabled={switchingBranch}
                                    className="min-w-[140px] cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 disabled:cursor-wait disabled:opacity-70"
                                >
                                    {companyData?.availableBranches?.map(
                                        (b: any) => (
                                            <option key={b.id} value={b.id}>
                                                {b.name}
                                            </option>
                                        ),
                                    )}
                                </select>
                            ) : (
                                <span className="font-semibold text-slate-700">
                                    {companyData?.branch.name}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Sección Derecha: Usuario + Notificaciones */}
                    <div className="flex shrink-0 items-center gap-2 md:gap-4">
                        <div ref={userPopoverRef} className="relative">
                            <button
                                onClick={() =>
                                    setShowUserPopover((prev) => !prev)
                                }
                                className={`flex items-center gap-2 rounded-lg border py-2 text-sm transition-all ${
                                    isMobile
                                        ? "px-3 h-10"
                                        : "px-4 max-w-[240px]"
                                } ${
                                    showUserPopover
                                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                                }`}
                            >
                                <span title={user?.fullName ?? ""}>👤</span>
                                {!isMobile && (
                                    <span
                                        className="truncate font-semibold text-slate-700"
                                        title={user?.fullName ?? ""}
                                    >
                                        {user?.fullName ?? user?.firstName}
                                    </span>
                                )}
                            </button>

                            {showUserPopover && (
                                <>
                                    {isMobile && (
                                        <div
                                            className="fixed inset-0 z-[1199] bg-slate-950/40 backdrop-blur-[2px]"
                                            onClick={() =>
                                                setShowUserPopover(false)
                                            }
                                        />
                                    )}
                                    <div
                                        style={{
                                            position: isMobile
                                                ? "fixed"
                                                : "absolute",
                                            top: isMobile ? "15%" : "110%",
                                            left: isMobile ? "50%" : "auto",
                                            right: isMobile ? "auto" : 0,
                                            transform: isMobile
                                                ? "translate(-50%, -50%)"
                                                : "none",
                                            width: isMobile
                                                ? "min(340px, calc(100vw - 40px))"
                                                : "320px",
                                            backgroundColor: "white",
                                            borderRadius: "12px",
                                            border: "1px solid #e2e8f0",
                                            boxShadow:
                                                "0 12px 30px rgba(15, 23, 42, 0.18)",
                                            padding: "1rem",
                                            zIndex: 1200,
                                        }}
                                    >
                                        <div className="mb-4 flex items-center gap-3">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-2xl text-indigo-600">
                                                👤
                                            </div>
                                            <div className="min-w-0">
                                                <p className="m-0 truncate font-bold text-slate-900">
                                                    {user?.fullName}
                                                </p>
                                                <p className="m-0 text-xs font-medium text-slate-500">
                                                    {roleDisplay(user?.role)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3 rounded-lg bg-slate-50 p-3 text-sm">
                                            <div>
                                                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                                    Sucursal Actual
                                                </p>
                                                {(companyData?.availableBranches
                                                    ?.length ?? 0) > 1 ? (
                                                    <select
                                                        value={
                                                            companyData?.branch
                                                                .id ?? ""
                                                        }
                                                        onChange={(e) => {
                                                            const id =
                                                                e.target.value;
                                                            if (id) {
                                                                disconnect();
                                                                switchToBranch(
                                                                    id,
                                                                );
                                                                setShowUserPopover(
                                                                    false,
                                                                );
                                                            }
                                                        }}
                                                        disabled={
                                                            switchingBranch
                                                        }
                                                        className="w-full cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
                                                    >
                                                        {companyData?.availableBranches?.map(
                                                            (b: any) => (
                                                                <option
                                                                    key={b.id}
                                                                    value={b.id}
                                                                >
                                                                    {b.name}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                ) : (
                                                    <p className="m-0 font-semibold text-slate-700">
                                                        {
                                                            companyData?.branch
                                                                .name
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                            <div className="border-t border-slate-200 pt-2">
                                                <p className="m-0 text-xs text-slate-500">
                                                    <strong>DNI:</strong>{" "}
                                                    {user?.dni}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleLogout}
                                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                                        >
                                            <span>🚪</span> Cerrar Sesión
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <div
                            ref={notificationsRef}
                            className="relative shrink-0"
                        >
                            <button
                                type="button"
                                aria-label="Notificaciones de cocina"
                                onClick={() =>
                                    setShowNotifications((prev) => !prev)
                                }
                                className={`relative flex h-10 w-10 items-center justify-center rounded-full border text-[1.1rem] text-slate-600 transition ${
                                    showNotifications
                                        ? "border-slate-300 bg-slate-200"
                                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-200"
                                }`}
                            >
                                🔔
                                {unreadCount > 0 && (
                                    <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[0.6rem] font-bold text-white">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                )}
                            </button>
                            {showNotifications && (
                                <>
                                    {isMobile && (
                                        <div
                                            className="fixed inset-0 z-[1199] bg-slate-950/40 backdrop-blur-[2px]"
                                            onClick={() =>
                                                setShowNotifications(false)
                                            }
                                        />
                                    )}
                                    <div
                                        style={{
                                            position: isMobile
                                                ? "fixed"
                                                : "absolute",
                                            top: isMobile ? "15%" : "110%",
                                            left: isMobile ? "50%" : "auto",
                                            right: isMobile ? "auto" : 0,
                                            transform: isMobile
                                                ? "translate(-50%, -50%)"
                                                : "none",
                                            width: isMobile
                                                ? "min(360px, calc(100vw - 40px))"
                                                : "320px",
                                            maxHeight: isMobile
                                                ? "70vh"
                                                : "420px",
                                            overflowY: "auto",
                                            backgroundColor: "white",
                                            borderRadius: "12px",
                                            border: "1px solid #e2e8f0",
                                            boxShadow:
                                                "0 12px 30px rgba(15, 23, 42, 0.18)",
                                            padding: "0.75rem",
                                            zIndex: 1200,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                marginBottom: "0.5rem",
                                            }}
                                        >
                                            <div>
                                                <h3
                                                    style={{
                                                        margin: 0,
                                                        fontSize: "0.95rem",
                                                        fontWeight: 600,
                                                        color: "#2d3748",
                                                    }}
                                                >
                                                    Notificaciones
                                                </h3>
                                                <p
                                                    style={{
                                                        margin: "0.15rem 0 0",
                                                        fontSize: "0.75rem",
                                                        color: "#718096",
                                                    }}
                                                >
                                                    Mensajes y notificaciones de
                                                    cocina
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    refetchKitchenNotifications();
                                                    refetchBroadcastMessages();
                                                }}
                                                style={{
                                                    border: "none",
                                                    backgroundColor:
                                                        "transparent",
                                                    color: "#4a5568",
                                                    cursor: "pointer",
                                                    fontSize: "1rem",
                                                }}
                                                title="Actualizar"
                                            >
                                                ⟳
                                            </button>
                                        </div>
                                        {notificationsLoading ||
                                        broadcastMessagesLoading ? (
                                            <div
                                                style={{
                                                    padding: "1rem",
                                                    textAlign: "center",
                                                    color: "#4a5568",
                                                    fontSize: "0.85rem",
                                                }}
                                            >
                                                Cargando notificaciones...
                                            </div>
                                        ) : visibleNotifications.length ===
                                          0 ? (
                                            <div
                                                style={{
                                                    padding: "1rem",
                                                    textAlign: "center",
                                                    color: "#4a5568",
                                                    fontSize: "0.85rem",
                                                    backgroundColor: "#f7fafc",
                                                    borderRadius: "10px",
                                                }}
                                            >
                                                No tienes notificaciones
                                                pendientes.
                                            </div>
                                        ) : (
                                            visibleNotifications.map(
                                                (notification: any) => {
                                                    const isBroadcast =
                                                        notification.type ===
                                                        "broadcast";
                                                    const chefName =
                                                        notification?.preparedBy
                                                            ?.fullName ||
                                                        "Cocina";
                                                    const tableName =
                                                        notification?.operation
                                                            ?.table?.name ||
                                                        "Sin mesa";
                                                    const productName =
                                                        notification
                                                            ?.operationDetail
                                                            ?.productName;
                                                    const quantity =
                                                        notification
                                                            ?.operationDetail
                                                            ?.quantity;
                                                    const senderName =
                                                        notification?.sender
                                                            ?.fullName ||
                                                        "Usuario";
                                                    const recipientsLabel =
                                                        notification?.recipients ===
                                                        "ALL"
                                                            ? "Todos"
                                                            : notification?.recipients ===
                                                                "WAITERS"
                                                              ? "Mozos"
                                                              : notification?.recipients ===
                                                                  "COOKS"
                                                                ? "Cocineros"
                                                                : notification?.recipients ===
                                                                    "CASHIERS"
                                                                  ? "Cajeros"
                                                                  : notification?.recipients ===
                                                                      "ADMINS"
                                                                    ? "Administradores"
                                                                    : notification?.recipients;

                                                    return (
                                                        <div
                                                            key={
                                                                notification.id
                                                            }
                                                            style={{
                                                                border: "1px solid #e2e8f0",
                                                                borderRadius:
                                                                    "10px",
                                                                padding:
                                                                    "0.75rem",
                                                                marginBottom:
                                                                    "0.5rem",
                                                                backgroundColor:
                                                                    isBroadcast
                                                                        ? "#eff6ff"
                                                                        : "#fdf2f8",
                                                                position:
                                                                    "relative",
                                                            }}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (
                                                                        isBroadcast
                                                                    ) {
                                                                        handleMarkMessageRead(
                                                                            notification.id,
                                                                        );
                                                                    }
                                                                    handleDismissNotification(
                                                                        notification.id,
                                                                    );
                                                                }}
                                                                style={{
                                                                    position:
                                                                        "absolute",
                                                                    top: "8px",
                                                                    right: "8px",
                                                                    border: "none",
                                                                    backgroundColor:
                                                                        "transparent",
                                                                    color: "#a0aec0",
                                                                    cursor: "pointer",
                                                                    fontSize:
                                                                        "1rem",
                                                                    fontWeight: 700,
                                                                    lineHeight: 1,
                                                                }}
                                                                aria-label={
                                                                    isBroadcast
                                                                        ? "Marcar como leído y ocultar"
                                                                        : "Ocultar notificación"
                                                                }
                                                                title={
                                                                    isBroadcast
                                                                        ? "Marcar como leído y ocultar"
                                                                        : "Ocultar notificación"
                                                                }
                                                            >
                                                                ×
                                                            </button>
                                                            <div
                                                                style={{
                                                                    display:
                                                                        "flex",
                                                                    alignItems:
                                                                        "flex-start",
                                                                    gap: "0.75rem",
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        width: "36px",
                                                                        height: "36px",
                                                                        borderRadius:
                                                                            "9999px",
                                                                        backgroundColor:
                                                                            isBroadcast
                                                                                ? "#bfdbfe"
                                                                                : "#fbb6ce",
                                                                        display:
                                                                            "flex",
                                                                        alignItems:
                                                                            "center",
                                                                        justifyContent:
                                                                            "center",
                                                                        fontSize:
                                                                            "1.1rem",
                                                                    }}
                                                                >
                                                                    {isBroadcast
                                                                        ? "💬"
                                                                        : "🍽️"}
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        flex: 1,
                                                                    }}
                                                                >
                                                                    <p
                                                                        style={{
                                                                            margin: 0,
                                                                            fontSize:
                                                                                "0.9rem",
                                                                            fontWeight: 600,
                                                                            color: "#2d3748",
                                                                        }}
                                                                    >
                                                                        {
                                                                            notification.message
                                                                        }
                                                                    </p>
                                                                    <div
                                                                        style={{
                                                                            marginTop:
                                                                                "0.35rem",
                                                                            display:
                                                                                "flex",
                                                                            flexDirection:
                                                                                "column",
                                                                            gap: "0.25rem",
                                                                            fontSize:
                                                                                "0.75rem",
                                                                            color: "#4a5568",
                                                                        }}
                                                                    >
                                                                        {isBroadcast ? (
                                                                            <>
                                                                                <span>
                                                                                    👤
                                                                                    De:{" "}
                                                                                    {
                                                                                        senderName
                                                                                    }
                                                                                </span>
                                                                                <span>
                                                                                    📢
                                                                                    Para:{" "}
                                                                                    {
                                                                                        recipientsLabel
                                                                                    }
                                                                                </span>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <span>
                                                                                    👨‍🍳{" "}
                                                                                    {
                                                                                        chefName
                                                                                    }
                                                                                </span>
                                                                                <span>
                                                                                    🪑
                                                                                    Mesa{" "}
                                                                                    {
                                                                                        tableName
                                                                                    }
                                                                                </span>
                                                                                {productName && (
                                                                                    <span>
                                                                                        🧾{" "}
                                                                                        {quantity
                                                                                            ? `${quantity}× `
                                                                                            : ""}
                                                                                        {
                                                                                            productName
                                                                                        }
                                                                                    </span>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                        <span
                                                                            style={{
                                                                                color: "#a0aec0",
                                                                            }}
                                                                        >
                                                                            {formatRelativeTime(
                                                                                notification?.createdAt,
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                },
                                            )
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Contenido */}
                <main
                    style={{
                        flex: 1,
                        padding:
                            currentView === "cash" || currentView === "delivery"
                                ? "0.25rem"
                                : currentView === "dashboard"
                                  ? isSmall
                                      ? "1rem"
                                      : isMedium
                                        ? "1.5rem"
                                        : "2rem"
                                  : isSmall
                                    ? "0.75rem"
                                    : isMedium
                                      ? "0.875rem"
                                      : "1rem",
                        backgroundColor: "#f8fafc",
                        overflowY:
                            currentView === "cash" || currentView === "delivery"
                                ? "hidden"
                                : "auto",
                        overflowX: "hidden",
                        width: "100%",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 0,
                        minWidth: 0,
                        position: "relative",
                    }}
                >
                    {currentView === "dashboard" && children}
                    {currentView === "floors" && (
                        <Floor onOpenCash={handleOpenCash} />
                    )}
                    {currentView === "cash" && (
                        <CashPay
                            table={selectedCashTable}
                            onBack={handleBackFromCash}
                            onPaymentSuccess={() => {
                                // El WebSocket debería actualizar automáticamente las mesas
                                // pero podemos forzar un refetch si es necesario
                                console.log("✅ Pago procesado exitosamente");
                            }}
                            onTableChange={(newTable) => {
                                // Actualizar la mesa seleccionada cuando se cambia la mesa
                                console.log(
                                    "🔄 Mesa cambiada a:",
                                    newTable.name,
                                );
                                setSelectedCashTable(newTable);
                            }}
                        />
                    )}
                    {currentView === "cashs" && <Cashs />}
                    {currentView === "messages" && (
                        <Message
                            onBack={() => handleMenuClick("dashboard")}
                            onSuccess={() => {
                                // Opcional: puedes agregar lógica aquí después de enviar un mensaje exitosamente
                                console.log("✅ Mensaje enviado exitosamente");
                            }}
                        />
                    )}
                    {currentView === "employees" && <CreateUser />}
                    {currentView === "permissions" && <UserPermissions />}
                    {currentView === "products" && <Products />}
                    {currentView === "inventory" && <Inventories />}
                    {currentView === "kardex" && <Kardex />}
                    {currentView === "purchase" && <Purchase />}
                    {currentView === "reports" && (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                height: "100%",
                                gap: isSmall
                                    ? "1rem"
                                    : isMedium
                                      ? "1.25rem"
                                      : "1.5rem",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: isSmall ? "0.375rem" : "0.5rem",
                                    background: "white",
                                    padding: isSmall ? "0.375rem" : "0.5rem",
                                    borderRadius: "12px",
                                    width: "100%",
                                    maxWidth: "100%",
                                    boxSizing: "border-box",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                }}
                            >
                                <button
                                    onClick={() => setReportType("sales")}
                                    style={{
                                        padding: isSmall
                                            ? "0.375rem 0.75rem"
                                            : isMedium
                                              ? "0.45rem 1rem"
                                              : "0.5rem 1.5rem",
                                        borderRadius: "8px",
                                        border: "none",
                                        background:
                                            reportType === "sales"
                                                ? "#667eea"
                                                : "transparent",
                                        color:
                                            reportType === "sales"
                                                ? "white"
                                                : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                        transition: "all 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <span>📊</span>
                                    Ventas
                                </button>
                                <button
                                    onClick={() =>
                                        setReportType("cancellation")
                                    }
                                    style={{
                                        padding: isSmall
                                            ? "0.375rem 0.75rem"
                                            : isMedium
                                              ? "0.45rem 1rem"
                                              : "0.5rem 1.5rem",
                                        borderRadius: "8px",
                                        border: "none",
                                        background:
                                            reportType === "cancellation"
                                                ? "#ef4444"
                                                : "transparent",
                                        color:
                                            reportType === "cancellation"
                                                ? "white"
                                                : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                        transition: "all 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <span>🚫</span>
                                    Anulados
                                </button>
                                <button
                                    onClick={() =>
                                        setReportType("productsSold")
                                    }
                                    style={{
                                        padding: isSmall
                                            ? "0.375rem 0.75rem"
                                            : isMedium
                                              ? "0.45rem 1rem"
                                              : "0.5rem 1.5rem",
                                        borderRadius: "8px",
                                        border: "none",
                                        background:
                                            reportType === "productsSold"
                                                ? "#22c55e"
                                                : "transparent",
                                        color:
                                            reportType === "productsSold"
                                                ? "white"
                                                : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                        transition: "all 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <span>🛒</span>
                                    Productos vendidos
                                </button>
                                <button
                                    onClick={() =>
                                        setReportType("categorySales")
                                    }
                                    style={{
                                        padding: isSmall
                                            ? "0.375rem 0.75rem"
                                            : isMedium
                                              ? "0.45rem 1rem"
                                              : "0.5rem 1.5rem",
                                        borderRadius: "8px",
                                        border: "none",
                                        background:
                                            reportType === "categorySales"
                                                ? "#3b82f6"
                                                : "transparent",
                                        color:
                                            reportType === "categorySales"
                                                ? "white"
                                                : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                        transition: "all 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <span>📂</span>
                                    Por categoría
                                </button>
                                <button
                                    onClick={() => setReportType("employees")}
                                    style={{
                                        padding: isSmall
                                            ? "0.375rem 0.75rem"
                                            : isMedium
                                              ? "0.45rem 1rem"
                                              : "0.5rem 1.5rem",
                                        borderRadius: "8px",
                                        border: "none",
                                        background:
                                            reportType === "employees"
                                                ? "#f59e0b"
                                                : "transparent",
                                        color:
                                            reportType === "employees"
                                                ? "white"
                                                : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                        transition: "all 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <span>👤</span>
                                    Empleados
                                </button>
                            </div>
                            {reportType === "sales" ? (
                                <ReportSale />
                            ) : reportType === "cancellation" ? (
                                <ReportCancel />
                            ) : reportType === "productsSold" ? (
                                <ReportsProductsSold />
                            ) : reportType === "categorySales" ? (
                                <ReportCategorySales />
                            ) : (
                                <ReportEmployee />
                            )}
                        </div>
                    )}
                    {currentView === "configuration" && (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: isSmall ? "0.75rem" : "1rem",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: isSmall ? "0.375rem" : "0.5rem",
                                    background: "white",
                                    padding: isSmall ? "0.375rem" : "0.5rem",
                                    borderRadius: "12px",
                                    width: "100%",
                                    boxSizing: "border-box",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                }}
                            >
                                <button
                                    onClick={() =>
                                        setConfigurationTab("category")
                                    }
                                    style={{
                                        padding: isSmall
                                            ? "0.375rem 0.75rem"
                                            : isMedium
                                              ? "0.45rem 1rem"
                                              : "0.5rem 1.5rem",
                                        borderRadius: "8px",
                                        border: "none",
                                        background:
                                            configurationTab === "category"
                                                ? "#6366f1"
                                                : "transparent",
                                        color:
                                            configurationTab === "category"
                                                ? "white"
                                                : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                        transition: "all 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <span>📁</span>
                                    Categoría
                                </button>
                                <button
                                    onClick={() =>
                                        setConfigurationTab("subcategory")
                                    }
                                    style={{
                                        padding: isSmall
                                            ? "0.375rem 0.75rem"
                                            : isMedium
                                              ? "0.45rem 1rem"
                                              : "0.5rem 1.5rem",
                                        borderRadius: "8px",
                                        border: "none",
                                        background:
                                            configurationTab === "subcategory"
                                                ? "#3b82f6"
                                                : "transparent",
                                        color:
                                            configurationTab === "subcategory"
                                                ? "white"
                                                : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                        transition: "all 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <span>🗂️</span>
                                    Subcategoría
                                </button>
                                <button
                                    onClick={() =>
                                        setConfigurationTab("observation")
                                    }
                                    style={{
                                        padding: isSmall
                                            ? "0.375rem 0.75rem"
                                            : isMedium
                                              ? "0.45rem 1rem"
                                              : "0.5rem 1.5rem",
                                        borderRadius: "8px",
                                        border: "none",
                                        background:
                                            configurationTab === "observation"
                                                ? "#8b5cf6"
                                                : "transparent",
                                        color:
                                            configurationTab === "observation"
                                                ? "white"
                                                : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                        transition: "all 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <span>📝</span>
                                    Observaciones
                                </button>
                                <button
                                    onClick={() =>
                                        setConfigurationTab("printers")
                                    }
                                    style={{
                                        padding: isSmall
                                            ? "0.375rem 0.75rem"
                                            : isMedium
                                              ? "0.45rem 1rem"
                                              : "0.5rem 1.5rem",
                                        borderRadius: "8px",
                                        border: "none",
                                        background:
                                            configurationTab === "printers"
                                                ? "#0d9488"
                                                : "transparent",
                                        color:
                                            configurationTab === "printers"
                                                ? "white"
                                                : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                        transition: "all 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <span>🖨️</span>
                                    Impresoras
                                </button>
                                <button
                                    onClick={() =>
                                        setConfigurationTab("local_printers")
                                    }
                                    style={{
                                        padding: isSmall
                                            ? "0.375rem 0.75rem"
                                            : isMedium
                                              ? "0.45rem 1rem"
                                              : "0.5rem 1.5rem",
                                        borderRadius: "8px",
                                        border: "none",
                                        background:
                                            configurationTab ===
                                            "local_printers"
                                                ? "#0369a1"
                                                : "transparent",
                                        color:
                                            configurationTab ===
                                            "local_printers"
                                                ? "white"
                                                : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                        transition: "all 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <span>💻</span>
                                    Impresoras del equipo
                                </button>
                                <button
                                    onClick={() =>
                                        setConfigurationTab("floors_tables")
                                    }
                                    style={{
                                        padding: isSmall
                                            ? "0.375rem 0.75rem"
                                            : isMedium
                                              ? "0.45rem 1rem"
                                              : "0.5rem 1.5rem",
                                        borderRadius: "8px",
                                        border: "none",
                                        background:
                                            configurationTab === "floors_tables"
                                                ? "#059669"
                                                : "transparent",
                                        color:
                                            configurationTab === "floors_tables"
                                                ? "white"
                                                : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: isSmall
                                            ? "0.75rem"
                                            : isMedium
                                              ? "0.8125rem"
                                              : "0.875rem",
                                        transition: "all 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <span>🪑</span>
                                    Pisos y Mesas
                                </button>
                            </div>

                            {configurationTab === "floors_tables" && (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "1rem",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: "0.5rem",
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFloorsTablesSubTab("floors")
                                            }
                                            style={{
                                                padding: "0.5rem 1rem",
                                                borderRadius: "8px",
                                                border: "none",
                                                background:
                                                    floorsTablesSubTab ===
                                                    "floors"
                                                        ? "#059669"
                                                        : "#e5e7eb",
                                                color:
                                                    floorsTablesSubTab ===
                                                    "floors"
                                                        ? "white"
                                                        : "#4b5563",
                                                cursor: "pointer",
                                                fontWeight: 600,
                                                fontSize: "0.875rem",
                                            }}
                                        >
                                            Pisos
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFloorsTablesSubTab("tables")
                                            }
                                            style={{
                                                padding: "0.5rem 1rem",
                                                borderRadius: "8px",
                                                border: "none",
                                                background:
                                                    floorsTablesSubTab ===
                                                    "tables"
                                                        ? "#059669"
                                                        : "#e5e7eb",
                                                color:
                                                    floorsTablesSubTab ===
                                                    "tables"
                                                        ? "white"
                                                        : "#4b5563",
                                                cursor: "pointer",
                                                fontWeight: 600,
                                                fontSize: "0.875rem",
                                            }}
                                        >
                                            Mesas
                                        </button>
                                    </div>
                                    {floorsTablesSubTab === "floors" && (
                                        <FloorModule />
                                    )}
                                    {floorsTablesSubTab === "tables" && (
                                        <TableModule />
                                    )}
                                </div>
                            )}
                            {configurationTab === "category" && (
                                <CategoryModule />
                            )}
                            {configurationTab === "subcategory" && (
                                <Subcategory />
                            )}
                            {configurationTab === "observation" && (
                                <Observation />
                            )}
                            {configurationTab === "printers" && <Printers />}
                            {configurationTab === "local_printers" && (
                                <LocalPrinters />
                            )}
                        </div>
                    )}
                    {currentView === "delivery" && <Delivery />}
                </main>
            </div>
        </div>
    );
};

// Componente principal que envuelve con el WebSocketProvider
const LayoutDashboard: React.FC<LayoutDashboardProps> = ({ children }) => {
    return (
        <WebSocketProvider>
            <LayoutDashboardContent>{children}</LayoutDashboardContent>
        </WebSocketProvider>
    );
};

export default LayoutDashboard;
