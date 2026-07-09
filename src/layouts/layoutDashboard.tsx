import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import {
    isTableSessionLockApiEnabled,
    releaseTableSessionLockImmediately,
} from "../hooks/useTableSessionLock";
import { useAuth } from "../hooks/useAuth";
import { useResponsive } from "../hooks/useResponsive";
import { useSwitchBranch } from "../hooks/useSwitchBranch";
// import { useIntegratedPrinterSyncFromServer } from "../hooks/useIntegratedPrinterSyncFromServer";
import { useUserPermissions } from "../hooks/useUserPermissions";
import { WebSocketProvider, useWebSocket } from "../context/WebSocketContext";
import { useToast } from "../context/ToastContext";
import Floor from "../modules/sales/floor";
import CashPay from "../modules/cash/cashPay";
import Cashs from "../modules/cash/cashs";
import Message from "../modules/cash/message";
import CreateUser from "../modules/user/createUser";
import UserPermissions from "../modules/user/UserPermissions";
import Products from "../modules/products/Products";
import Promotions from "../modules/promotions/Promotions";
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
import DevicePrintConfigs from "../modules/configuration/devicePrintConfigs";
import FloorModule from "../modules/configuration/floor";
import TableModule from "../modules/configuration/table";
import Delivery from "../modules/sales/delivery";
import BranchSettings from "../modules/branch/BranchSettings";
import { GET_MY_UNREAD_MESSAGES } from "../graphql/queries";
import {
    MARK_MESSAGE_READ,
    RELEASE_TABLE_SESSION_LOCK,
} from "../graphql/mutations";
import type { Table } from "../types/table";

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

type KitchenNotificationItem = {
    id: string;
    message: string;
    createdAt: string;
    isPending?: boolean;
};

const KitchenIcon = ({ className = "h-6 w-6" }: { className?: string }) => {
    const gradientId = React.useId().replace(/:/g, "");

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className={`drop-shadow-sm ${className}`}
            aria-hidden="true"
        >
            <defs>
                <linearGradient
                    id={`${gradientId}-top`}
                    x1="12"
                    y1="2"
                    x2="12"
                    y2="13"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0%" stopColor="#FFF7ED" />
                    <stop offset="100%" stopColor="#FDBA74" />
                </linearGradient>
                <linearGradient
                    id={`${gradientId}-body`}
                    x1="12"
                    y1="12"
                    x2="12"
                    y2="22"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0%" stopColor="#FB923C" />
                    <stop offset="100%" stopColor="#EA580C" />
                </linearGradient>
            </defs>
            <path
                fill={`url(#${gradientId}-top)`}
                d="M12 3.25c-4.1 0-7.25 2.55-7.5 6.05-.05.75.15 1.45.55 2.05.45.7 1.15 1.15 1.95 1.15h10c.8 0 1.5-.45 1.95-1.15.4-.6.6-1.3.55-2.05C19.25 5.8 16.1 3.25 12 3.25z"
            />
            <path
                fill="#C2410C"
                opacity="0.25"
                d="M5.25 12.25h13.5v1.1H5.25z"
            />
            <path
                fill={`url(#${gradientId}-body)`}
                d="M6.25 13.1h11.5v4.65c0 1.55-1.25 2.8-2.8 2.8h-5.9c-1.55 0-2.8-1.25-2.8-2.8V13.1z"
            />
        </svg>
    );
};

// Componente interno que usa el WebSocket
const LayoutDashboardContent: React.FC = () => {
    const navigate = useNavigate();
    const { user, companyData, logout, getMacAddress } = useAuth();
    const [macAddress, setMacAddress] = useState<string>("");
    const { disconnect, subscribe } = useWebSocket();
    const { switchToBranch, loading: switchingBranch } = useSwitchBranch();
    const { breakpoint, isMobile } = useResponsive();
    const { showToast } = useToast();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Dark Mode
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem("darkMode");
        if (saved !== null) {
            return saved === "true";
        }
        return (
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
        );
    });

    // Internet Status
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
    const isMobileOnly = breakpoint === "xs";
    const isSmall = breakpoint === "sm"; // 640px - 767px
    const isMedium = breakpoint === "md"; // 768px - 1023px
    const isSmallDesktop = breakpoint === "lg"; // 1024px - 1279px

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
        | "floors"
        | "cash"
        | "cashs"
        | "messages"
        | "employees"
        | "permissions"
        | "products"
        | "promotions"
        | "inventory"
        | "kardex"
        | "purchase"
        | "reports"
        | "configuration"
        | "delivery"
        | "branch"
    >(() => {
        const savedView = localStorage.getItem("currentDashboardView");
        const validViews = [
            "floors",
            "cash",
            "cashs",
            "messages",
            "employees",
            "permissions",
            "products",
            "promotions",
            "inventory",
            "kardex",
            "purchase",
            "reports",
            "configuration",
            "delivery",
            "branch",
        ];
        return savedView && validViews.includes(savedView)
            ? (savedView as any)
            : "floors";
    });

    useEffect(() => {
        if (currentView) {
            localStorage.setItem("currentDashboardView", currentView);
        }
    }, [currentView]);

    // Dark Mode Effect
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        localStorage.setItem("darkMode", isDarkMode.toString());
    }, [isDarkMode]);

    // Internet Status Effects
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const [configurationTab, setConfigurationTab] = useState<
        | "category"
        | "subcategory"
        | "observation"
        | "printers"
        | "local_printers"
        | "devices"
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
    /** Mesa abierta en Caja (para liberar candado aunque `selectedCashTable` se nullifique al cambiar de vista). */
    const lastCashTableIdRef = useRef<string | null>(null);
    const [floorsTablesRefreshNonce, setFloorsTablesRefreshNonce] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showKitchenNotifications, setShowKitchenNotifications] =
        useState(false);
    const [showUserPopover, setShowUserPopover] = useState(false);
    const notificationsRef = useRef<HTMLDivElement | null>(null);
    const kitchenNotificationsRef = useRef<HTMLDivElement | null>(null);
    const userPopoverRef = useRef<HTMLDivElement | null>(null);
    const [hiddenNotificationIds, setHiddenNotificationIds] = useState<
        string[]
    >([]);
    const [kitchenNotifications, setKitchenNotifications] = useState<
        KitchenNotificationItem[]
    >([]);
    const [hiddenKitchenNotificationIds, setHiddenKitchenNotificationIds] =
        useState<string[]>([]);

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
    const [releaseTableSessionLockMutation] = useMutation(
        RELEASE_TABLE_SESSION_LOCK,
    );

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
        const unsubscribeBroadcast = subscribe(
            "broadcast_message",
            (message: any) => {
                // Actualizar notificaciones inmediatamente cuando llegue un mensaje broadcast
                console.log(
                    "📬 Mensaje broadcast recibido por WebSocket:",
                    message,
                );
                refetchBroadcastMessages();

                // Abrir automáticamente el modal de notificaciones si el mensaje no es del propio usuario
                if (message?.sender_id !== user?.id) {
                    setShowNotifications(true);
                }
            },
        );

        const unsubscribeKitchenNotification = subscribe(
            "kitchen_notification",
            (notification: any) => {
                console.log(
                    "🍳 Notificación de cocina recibida por WebSocket:",
                    notification,
                );

                let message = "";
                let toastType: "success" | "info" = "info";

                if (notification.is_pending) {
                    message = `Nuevo pedido: ${notification.product_name} para ${notification.table_name}`;
                    toastType = "info";
                } else if (notification.product_name.startsWith("Orden #")) {
                    // Full order completion
                    message = `${notification.product_name} lista para ${notification.table_name}, preparada por ${notification.prepared_by}`;
                    toastType = "info";
                } else {
                    // Single item completion
                    const quantityText =
                        notification.quantity > 1
                            ? `${notification.quantity}x `
                            : "";
                    message = `${quantityText}${notification.product_name} listo para ${notification.table_name} (Orden #${notification.operation_number})`;
                    toastType = "success";
                }

                showToast(message, toastType, true);

                const notificationId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                setKitchenNotifications((prev) => [
                    {
                        id: notificationId,
                        message,
                        createdAt: new Date().toISOString(),
                        isPending: Boolean(notification.is_pending),
                    },
                    ...prev,
                ].slice(0, 50));
            },
        );

        return () => {
            unsubscribeBroadcast();
            unsubscribeKitchenNotification();
        };
    }, [subscribe, refetchBroadcastMessages, user?.id, showToast]);

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

    // Solo mensajes broadcast
    const allNotifications = useMemo(
        () =>
            broadcastMessages
                .map((m: any) => ({
                    ...m,
                    type: "broadcast",
                }))
                .sort((a: any, b: any) => {
                    // Ordenar por fecha, más recientes primero
                    const dateA = new Date(a.createdAt || 0).getTime();
                    const dateB = new Date(b.createdAt || 0).getTime();
                    return dateB - dateA;
                }),
        [broadcastMessages],
    );

    const visibleNotifications = allNotifications.filter(
        (notification: any) =>
            !hiddenNotificationIds.includes(notification?.id),
    );
    const unreadCount = visibleNotifications.length;

    const visibleKitchenNotifications = kitchenNotifications.filter(
        (notification) => !hiddenKitchenNotificationIds.includes(notification.id),
    );
    const unreadKitchenCount = visibleKitchenNotifications.length;

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
            setHiddenNotificationIds((prev) => (prev.length === 0 ? prev : []));
            return;
        }
        setHiddenNotificationIds((prev) => {
            const next = prev.filter((hiddenId) =>
                allNotifications.some(
                    (notification: any) => notification?.id === hiddenId,
                ),
            );
            // Evitar actualización si el array es idéntico en contenido
            if (next.length === prev.length) return prev;
            return next;
        });
    }, [allNotifications]);
    // Usar useRef para evitar el bucle
    const hasShownNotificationsRef = useRef(false);
    // Abrir al cargar o cuando cambian los pendientes (nuevo aviso o cierre con ×); no forzar reapertura si solo repitió el mismo set tras un refetch
    useEffect(() => {
        if (broadcastMessagesLoading) {
            return;
        }
        // Solo abrir notificaciones una vez cuando hay nuevos elementos
        if (visibleNotificationIdsKey && !hasShownNotificationsRef.current) {
            setShowNotifications(true);
            hasShownNotificationsRef.current = true;
        } else if (!visibleNotificationIdsKey) {
            setShowNotifications(false);
            hasShownNotificationsRef.current = false;
        }
    }, [visibleNotificationIdsKey, broadcastMessagesLoading]);
    useEffect(() => {
        if (!showNotifications && !showKitchenNotifications && !showUserPopover) {
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
                kitchenNotificationsRef.current &&
                !kitchenNotificationsRef.current.contains(event.target as Node)
            ) {
                setShowKitchenNotifications(false);
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
    }, [showNotifications, showKitchenNotifications, showUserPopover]);

    const handleDismissNotification = (notificationId: string) => {
        setHiddenNotificationIds((prev) =>
            prev.includes(notificationId) ? prev : [...prev, notificationId],
        );
    };

    const handleDismissKitchenNotification = (notificationId: string) => {
        setHiddenKitchenNotificationIds((prev) =>
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

    const handleMenuClick = async (
        view:
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
            | "delivery"
            | "branch",
    ) => {
        const leavingCash = currentView === "cash";
        if (leavingCash) {
            const tid = lastCashTableIdRef.current;
            const uid = user?.id;
            lastCashTableIdRef.current = null;
            if (tid && uid && isTableSessionLockApiEnabled()) {
                try {
                    await releaseTableSessionLockImmediately(
                        releaseTableSessionLockMutation,
                        tid,
                        String(uid),
                    );
                } catch {
                    /* el desmontaje de CashPay puede programar otro release */
                }
            }
            if (view === "floors") {
                setFloorsTablesRefreshNonce((n) => n + 1);
            }
        }
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
        lastCashTableIdRef.current = String(table.id);
        setSelectedCashTable(table);
        setCurrentView("cash");
    };

    const handleBackFromCash = async () => {
        const t = selectedCashTable;
        const uid = user?.id;
        lastCashTableIdRef.current = null;
        if (t?.id && uid && isTableSessionLockApiEnabled()) {
            try {
                await releaseTableSessionLockImmediately(
                    releaseTableSessionLockMutation,
                    String(t.id),
                    String(uid),
                );
            } catch {
                /* noop */
            }
        }
        setFloorsTablesRefreshNonce((n) => n + 1);
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
            className={`group relative flex w-full items-center gap-4 px-8 ${isMobile ? "py-5" : "py-4"} text-left transition-all duration-200 ${
                isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
        >
            <span
                className={`${isMobile ? "text-2xl" : "text-xl"} transition-transform duration-200 ${isActive ? "scale-110" : ""}`}
            >
                {icon}
            </span>
            {sidebarOpen && (
                <span
                    className={`${isMobile ? "text-base" : "text-sm"} font-medium tracking-wide ${
                        isActive ? "font-semibold" : ""
                    }`}
                >
                    {label}
                </span>
            )}
            {isActive && sidebarOpen && (
                <div className="absolute right-6 h-1 w-1 rounded-full bg-indigo-500 dark:bg-indigo-400" />
            )}
            {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-500 dark:bg-indigo-400" />
            )}
        </button>
    );

    const headerTitle =
        currentView === "floors"
            ? "Mesas"
            : currentView === "messages"
              ? "Mensajes"
              : currentView === "employees"
                ? "Empleados"
                : currentView === "permissions"
                  ? "Permisos"
                  : currentView === "products"
                    ? "Productos"
                    : currentView === "promotions"
                      ? "Promociones"
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
                                    : currentView === "branch"
                                      ? "Sede"
                                      : "Caja";

    const headerSubtitle =
        currentView === "floors"
            ? "Gestiona la ocupación y las órdenes de tus mesas."
            : currentView === "messages"
              ? "Envía mensajes a cocina, mozos u otros usuarios."
              : currentView === "employees"
                ? "Administra los empleados de tu empresa."
                : currentView === "permissions"
                  ? "Asigna permisos personalizados por usuario (solo administrador)."
                  : currentView === "products"
                    ? "Administra los productos de tu menú."
                    : currentView === "promotions"
                      ? "Crea y edita combos, descuentos, NxM y regalos."
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
                                    : currentView === "branch"
                                      ? "Consulta y edita la configuración de la sucursal activa."
                                      : selectedCashTable
                                      ? `Procesa el pago de ${selectedCashTable.name}.`
                                      : "Selecciona una mesa para revisar su orden.";

    const isFloorsSection = currentView === "floors" || currentView === "cash";
    const isAdmin = user?.role?.toUpperCase() === "ADMIN";

    // Permisos para visibilidad del menú (ADMIN ve todo)
    const canSeeProducts = isAdmin || hasPermission("products.view");
    const canSeePromotions = canSeeProducts;
    const canSeeFloors = isAdmin || hasPermission("orders.create");
    const canSeeDelivery = isAdmin || hasPermission("point_of_sale");
    const canSeeConfiguration = isAdmin || hasPermission("config.manage");
    const canSeeBranch = isAdmin || hasPermission("config.manage");
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
            (v === "floors" && canSeeFloors) ||
            (v === "cash" && canSeeFloors) ||
            (v === "delivery" && canSeeDelivery) ||
            (v === "products" && canSeeProducts) ||
            (v === "promotions" && canSeePromotions) ||
            (v === "configuration" && canSeeConfiguration) ||
            (v === "branch" && canSeeBranch) ||
            (v === "messages" && canSeeMessages) ||
            (v === "employees" && canSeeEmployees) ||
            (v === "permissions" && canSeePermissions) ||
            (v === "purchase" && canSeePurchase) ||
            (v === "cashs" && canSeeCashs) ||
            (v === "inventory" && canSeeInventory) ||
            (v === "kardex" && canSeeKardex) ||
            (v === "reports" && canSeeReports);
        if (!allowed(currentView)) {
            if (canSeeFloors) setCurrentView("floors");
            else if (canSeeDelivery) setCurrentView("delivery");
            else if (canSeeProducts) setCurrentView("products");
            else if (canSeePromotions) setCurrentView("promotions");
            else if (canSeeCashs) setCurrentView("cashs");
            else if (canSeeMessages) setCurrentView("messages");
            else if (canSeeEmployees) setCurrentView("employees");
            else if (canSeePermissions) setCurrentView("permissions");
            else if (canSeePurchase) setCurrentView("purchase");
            else if (canSeeInventory) setCurrentView("inventory");
            else if (canSeeKardex) setCurrentView("kardex");
            else if (canSeeReports) setCurrentView("reports");
            else if (canSeeConfiguration) setCurrentView("configuration");
            else if (canSeeBranch) setCurrentView("branch");
        }
    }, [
        currentView,
        canSeeFloors,
        canSeeDelivery,
        canSeeProducts,
        canSeePromotions,
        canSeeConfiguration,
        canSeeBranch,
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
                className="fixed z-[1000] flex h-screen flex-col overflow-x-hidden overflow-y-auto border-r border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                style={{
                    width: displayedSidebarWidth,
                    transform:
                        isOverlay && !sidebarOpen
                            ? `translateX(-${displayedSidebarWidth})`
                            : "translateX(0)",
                    transition:
                        "width 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease",
                    boxShadow: sidebarOpen
                        ? "0 0 0 1px rgba(0, 0, 0, 0.05), 0 20px 25px -5px rgba(0, 0, 0, 0.05)"
                        : "none",
                }}
            >
                {/* Header del Sidebar */}
                <div className="flex items-center justify-between border-b border-slate-100 p-8 dark:border-slate-800">
                    {sidebarOpen && (
                        <div>
                            <h2 className="m-0 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                SumApp
                            </h2>
                            <p className="mt-2 text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
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

                {/* Menú de Navegación */}
                <nav className="flex-1 overflow-y-auto py-8 [scrollbar-width:thin]">
                    {sidebarOpen && (
                        <div className="mb-2 px-8 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                            Menú
                        </div>
                    )}

                    {/* Opciones del menú */}
                    <div className="flex flex-col">
                        {canSeeProducts && (
                            <SidebarItem
                                view="products"
                                icon="🍽️"
                                label="Productos"
                                isActive={currentView === "products"}
                            />
                        )}

                        {canSeePromotions && (
                            <SidebarItem
                                view="promotions"
                                icon="🏷️"
                                label="Promociones"
                                isActive={currentView === "promotions"}
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

                        {canSeeBranch && (
                            <SidebarItem
                                view="branch"
                                icon="🏢"
                                label="Sede"
                                isActive={currentView === "branch"}
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
                <div className="border-t border-slate-100 p-8 dark:border-slate-800">
                    <button
                        onClick={handleLogout}
                        className="group flex w-full items-center gap-4 px-1 py-3 text-left text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400"
                    >
                        <span className="text-xl transition-transform duration-200 group-hover:scale-110">
                            🚪
                        </span>
                        {sidebarOpen && (
                            <span className="tracking-wide">Cerrar Sesión</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Contenido Principal */}
            <div
                className="bg-slate-50 dark:bg-slate-950"
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
                    className="flex items-center justify-between border-b border-slate-100 bg-white px-8 py-6 dark:border-slate-800 dark:bg-slate-950"
                    style={{
                        gap: isMobile ? "0.75rem" : "1.5rem",
                    }}
                >
                    {/* Sección Izquierda: Toggle + Título */}
                    <div className="flex min-w-0 items-center gap-4 flex-1">
                        <button
                            onClick={toggleSidebar}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                        >
                            {sidebarOpen ? "⇤" : "☰"}
                        </button>
                        <div className="min-w-0">
                            <h1
                                className="m-0 truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white"
                                style={{
                                    fontSize: headerFontSize,
                                }}
                            >
                                {headerTitle}
                            </h1>
                            {!isMobile && (
                                <div
                                    className="mt-1 truncate text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500"
                                    style={{
                                        fontSize: headerSubFontSize,
                                    }}
                                >
                                    {headerSubtitle}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sección Central: Sucursal (Solo Desktop y Solo Administradores) */}
                    {!isMobile && isAdmin && (
                        <div className="hidden md:flex items-center gap-3 rounded-xl bg-slate-50 px-6 py-3 text-sm dark:bg-slate-800">
                            <span className="text-lg">🏢</span>
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
                                    className="min-w-[160px] cursor-pointer border-none bg-transparent text-sm font-semibold text-slate-700 outline-none disabled:cursor-wait disabled:opacity-70 dark:text-slate-200"
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
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    {companyData?.branch.name}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Sección Derecha: Internet Status, Dark Mode, Usuario + Notificaciones */}
                    <div className="flex shrink-0 items-center gap-3">
                        {/* Internet Status */}
                        <div
                            className="relative"
                            title={
                                isOnline
                                    ? "Conectado a internet"
                                    : "Sin conexión"
                            }
                        >
                            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-xl dark:bg-slate-800">
                                {isOnline ? (
                                    <span className="text-green-600 dark:text-green-400">
                                        🌐
                                    </span>
                                ) : (
                                    <span className="text-red-500 animate-pulse">
                                        ❌
                                    </span>
                                )}
                            </span>
                        </div>

                        {/* Dark Mode Toggle */}
                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-xl text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                            title={
                                isDarkMode
                                    ? "Cambiar a modo claro"
                                    : "Cambiar a modo oscuro"
                            }
                        >
                            {isDarkMode ? "☀️" : "🌙"}
                        </button>

                        <div ref={userPopoverRef} className="relative">
                            <button
                                onClick={() =>
                                    setShowUserPopover((prev) => !prev)
                                }
                                className={`group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all duration-200 ${
                                    isMobile ? "h-12" : "max-w-[240px]"
                                } ${
                                    showUserPopover
                                        ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                                        : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                }`}
                            >
                                <span
                                    className="text-xl transition-transform duration-200 group-hover:scale-110"
                                    title={user?.fullName ?? ""}
                                >
                                    👤
                                </span>
                                {!isMobile && (
                                    <span
                                        className="truncate font-semibold tracking-wide text-slate-700 dark:text-slate-200"
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
                                            className="fixed inset-0 z-[1199] bg-slate-950/30 backdrop-blur-sm"
                                            onClick={() =>
                                                setShowUserPopover(false)
                                            }
                                        />
                                    )}
                                    <div className="absolute right-0 top-[110%] z-[1200] w-80 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
                                        <div className="mb-6 flex items-center gap-4">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-3xl dark:bg-slate-800">
                                                👤
                                            </div>
                                            <div className="min-w-0">
                                                <p className="m-0 truncate font-bold text-slate-900 dark:text-white">
                                                    {user?.fullName}
                                                </p>
                                                <p className="m-0 mt-1 text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                    {roleDisplay(user?.role)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
                                            <div>
                                                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                                    Sucursal Actual
                                                </p>
                                                <p className="font-medium text-slate-700 dark:text-slate-200">
                                                    {companyData?.branch.name}
                                                </p>
                                            </div>
                                            <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
                                                <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                                                    <strong className="font-medium">
                                                        DNI:
                                                    </strong>{" "}
                                                    {user?.dni}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleLogout}
                                            className="group mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-red-900/30 dark:hover:bg-red-900/10 dark:hover:text-red-400"
                                        >
                                            <span className="text-xl transition-transform duration-200 group-hover:scale-110">
                                                🚪
                                            </span>{" "}
                                            Cerrar Sesión
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
                                aria-label="Notificaciones de mensajes"
                                onClick={() => {
                                    setShowKitchenNotifications(false);
                                    setShowNotifications((prev) => !prev);
                                }}
                                className={`group relative flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-[1.15rem] text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100 ${
                                    showNotifications
                                        ? "bg-slate-100 dark:bg-slate-700"
                                        : ""
                                }`}
                            >
                                🔔
                                {unreadCount > 0 && (
                                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[0.65rem] font-bold text-white shadow-sm shadow-rose-500/20">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                )}
                            </button>
                            {showNotifications && (
                                <>
                                    {isMobile && (
                                        <div
                                            className="fixed inset-0 z-[1199] bg-slate-950/30 backdrop-blur-sm"
                                            onClick={() =>
                                                setShowNotifications(false)
                                            }
                                        />
                                    )}
                                    <div
                                        className={`${isMobile ? "fixed inset-x-4 top-[80px]" : "absolute right-0 top-[110%] w-[400px]"} z-[1200] max-h-[calc(100vh-120px)] sm:max-h-[500px] overflow-y-auto rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-2xl shadow-slate-900/20 backdrop-blur-md scrollbar-thin scrollbar-thumb-slate-200 dark:border-slate-800 dark:bg-slate-950/95 dark:scrollbar-thumb-slate-800`}
                                    >
                                        <div className="mb-4 flex items-center justify-between">
                                            <div>
                                                <h3 className="m-0 text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                                                    Notificaciones
                                                </h3>
                                                <p className="m-0 mt-1 text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                                    Mensajes
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    refetchBroadcastMessages();
                                                }}
                                                className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                                                title="Actualizar"
                                            >
                                                ⟳
                                            </button>
                                        </div>
                                        {broadcastMessagesLoading ? (
                                            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                                Cargando notificaciones...
                                            </div>
                                        ) : visibleNotifications.length ===
                                          0 ? (
                                            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                                No tienes notificaciones
                                                pendientes.
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {visibleNotifications.map(
                                                    (notification: any) => {
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
                                                                className="group relative overflow-hidden rounded-2xl border border-slate-200 p-5 text-sm transition-all hover:shadow-md bg-blue-50/50 dark:bg-blue-900/10 dark:border-slate-800"
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleMarkMessageRead(
                                                                            notification.id,
                                                                        );
                                                                        handleDismissNotification(
                                                                            notification.id,
                                                                        );
                                                                    }}
                                                                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/50 text-slate-400 opacity-0 transition-all duration-200 hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100 dark:bg-slate-800/50 dark:hover:bg-rose-900/30"
                                                                    aria-label="Marcar como leído y ocultar"
                                                                    title="Marcar como leído y ocultar"
                                                                >
                                                                    ×
                                                                </button>
                                                                <div className="flex items-start gap-3">
                                                                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                                                        💬
                                                                    </div>
                                                                    <div className="min-w-0 flex-1 pr-4">
                                                                        <p className="m-0 text-sm font-bold leading-tight text-slate-900 dark:text-white">
                                                                            {
                                                                                notification.message
                                                                            }
                                                                        </p>
                                                                        <div className="mt-3 flex flex-col gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
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
                                                                            <span className="mt-1 text-slate-400 dark:text-slate-500">
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
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <div
                            ref={kitchenNotificationsRef}
                            className="relative shrink-0"
                        >
                            <button
                                type="button"
                                aria-label="Notificaciones de cocina"
                                title="Notificaciones de cocina"
                                onClick={() => {
                                    setShowNotifications(false);
                                    setShowKitchenNotifications((prev) => !prev);
                                }}
                                className={`group relative flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-[1.15rem] transition-all duration-200 hover:bg-orange-50 dark:bg-slate-800 dark:hover:bg-orange-900/20 ${
                                    showKitchenNotifications
                                        ? "bg-orange-50 dark:bg-orange-900/20"
                                        : ""
                                }`}
                            >
                                <span className="inline-flex items-center justify-center text-[1.15rem] leading-none">
                                    <KitchenIcon className="h-[1.2em] w-[1.2em]" />
                                </span>
                                {unreadKitchenCount > 0 && (
                                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[0.65rem] font-bold text-white shadow-sm shadow-orange-500/20">
                                        {unreadKitchenCount > 9
                                            ? "9+"
                                            : unreadKitchenCount}
                                    </span>
                                )}
                            </button>
                            {showKitchenNotifications && (
                                <>
                                    {isMobile && (
                                        <div
                                            className="fixed inset-0 z-[1199] bg-slate-950/30 backdrop-blur-sm"
                                            onClick={() =>
                                                setShowKitchenNotifications(
                                                    false,
                                                )
                                            }
                                        />
                                    )}
                                    <div
                                        className={`${isMobile ? "fixed inset-x-4 top-[80px]" : "absolute right-0 top-[110%] w-[400px]"} z-[1200] max-h-[calc(100vh-120px)] sm:max-h-[500px] overflow-y-auto rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-2xl shadow-slate-900/20 backdrop-blur-md scrollbar-thin scrollbar-thumb-slate-200 dark:border-slate-800 dark:bg-slate-950/95 dark:scrollbar-thumb-slate-800`}
                                    >
                                        <div className="mb-4 flex items-center justify-between">
                                            <div>
                                                <h3 className="m-0 text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                                                    Cocina
                                                </h3>
                                                <p className="m-0 mt-1 text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                                    Pedidos y avisos
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setKitchenNotifications([]);
                                                    setHiddenKitchenNotificationIds(
                                                        [],
                                                    );
                                                }}
                                                className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                                                title="Limpiar todo"
                                            >
                                                ⟳
                                            </button>
                                        </div>
                                        {visibleKitchenNotifications.length ===
                                        0 ? (
                                            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                                No hay avisos de cocina por
                                                ahora.
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {visibleKitchenNotifications.map(
                                                    (notification) => (
                                                        <div
                                                            key={
                                                                notification.id
                                                            }
                                                            className={`group relative overflow-hidden rounded-2xl border p-5 text-sm transition-all hover:shadow-md dark:border-slate-800 ${
                                                                notification.isPending
                                                                    ? "border-orange-200 bg-orange-50/50 dark:bg-orange-900/10"
                                                                    : "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10"
                                                            }`}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleDismissKitchenNotification(
                                                                        notification.id,
                                                                    )
                                                                }
                                                                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/50 text-slate-400 opacity-0 transition-all duration-200 hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100 dark:bg-slate-800/50 dark:hover:bg-rose-900/30"
                                                                aria-label="Ocultar aviso de cocina"
                                                                title="Ocultar"
                                                            >
                                                                ×
                                                            </button>
                                                            <div className="flex items-start gap-3">
                                                                <div
                                                                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                                                        notification.isPending
                                                                            ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                                                                            : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                                    }`}
                                                                >
                                                                    <KitchenIcon className="h-6 w-6" />
                                                                </div>
                                                                <div className="min-w-0 flex-1 pr-4">
                                                                    <p className="m-0 text-sm font-bold leading-tight text-slate-900 dark:text-white">
                                                                        {
                                                                            notification.message
                                                                        }
                                                                    </p>
                                                                    <span className="mt-3 block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                                                        {formatRelativeTime(
                                                                            notification.createdAt,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Contenido */}
                <main
                    className={`flex flex-1 flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 ${
                        currentView === "cash" || currentView === "delivery"
                            ? "p-1 overflow-hidden"
                            : "p-4 overflow-y-auto"
                    }`}
                >
                    {currentView === "floors" && (
                        <Floor
                            onOpenCash={handleOpenCash}
                            tablesRefreshNonce={floorsTablesRefreshNonce}
                        />
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
                            onBack={() => handleMenuClick("floors")}
                            onSuccess={() => {
                                // Opcional: puedes agregar lógica aquí después de enviar un mensaje exitosamente
                                console.log("✅ Mensaje enviado exitosamente");
                            }}
                        />
                    )}
                    {currentView === "employees" && <CreateUser />}
                    {currentView === "permissions" && <UserPermissions />}
                    {currentView === "products" && <Products />}
                    {currentView === "promotions" && <Promotions />}
                    {currentView === "inventory" && <Inventories />}
                    {currentView === "kardex" && <Kardex />}
                    {currentView === "purchase" && <Purchase />}
                    {currentView === "reports" && (
                        <div className="flex h-full flex-col gap-4">
                            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                                <button
                                    onClick={() => setReportType("sales")}
                                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                        reportType === "sales"
                                            ? "bg-indigo-600 text-white dark:bg-indigo-500"
                                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <span>📊</span>
                                    Ventas
                                </button>
                                <button
                                    onClick={() =>
                                        setReportType("cancellation")
                                    }
                                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                        reportType === "cancellation"
                                            ? "bg-red-600 text-white dark:bg-red-500"
                                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <span>🚫</span>
                                    Anulados
                                </button>
                                <button
                                    onClick={() =>
                                        setReportType("productsSold")
                                    }
                                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                        reportType === "productsSold"
                                            ? "bg-green-600 text-white dark:bg-green-500"
                                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <span>🛒</span>
                                    Productos vendidos
                                </button>
                                <button
                                    onClick={() =>
                                        setReportType("categorySales")
                                    }
                                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                        reportType === "categorySales"
                                            ? "bg-blue-600 text-white dark:bg-blue-500"
                                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <span>📂</span>
                                    Por categoría
                                </button>
                                <button
                                    onClick={() => setReportType("employees")}
                                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                        reportType === "employees"
                                            ? "bg-amber-500 text-white"
                                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
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
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                                <button
                                    onClick={() =>
                                        setConfigurationTab("category")
                                    }
                                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                        configurationTab === "category"
                                            ? "bg-violet-600 text-white dark:bg-violet-500"
                                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <span>📁</span>
                                    Categoría
                                </button>
                                <button
                                    onClick={() =>
                                        setConfigurationTab("subcategory")
                                    }
                                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                        configurationTab === "subcategory"
                                            ? "bg-blue-600 text-white dark:bg-blue-500"
                                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <span>🗂️</span>
                                    Subcategoría
                                </button>
                                <button
                                    onClick={() =>
                                        setConfigurationTab("observation")
                                    }
                                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                        configurationTab === "observation"
                                            ? "bg-purple-600 text-white dark:bg-purple-500"
                                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <span>📝</span>
                                    Observaciones
                                </button>
                                <button
                                    onClick={() =>
                                        setConfigurationTab("printers")
                                    }
                                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                        configurationTab === "printers"
                                            ? "bg-teal-600 text-white dark:bg-teal-500"
                                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <span>🖨️</span>
                                    Impresoras de red
                                </button>
                                <button
                                    onClick={() =>
                                        setConfigurationTab("local_printers")
                                    }
                                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                        configurationTab === "local_printers"
                                            ? "bg-sky-700 text-white"
                                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <span>💻</span>
                                    Impresoras locales
                                </button>
                                <button
                                    onClick={() =>
                                        setConfigurationTab("floors_tables")
                                    }
                                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                        configurationTab === "floors_tables"
                                            ? "bg-emerald-600 text-white"
                                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <span>🪑</span>
                                    Pisos y Mesas
                                </button>
                                <button
                                    onClick={() =>
                                        setConfigurationTab("devices")
                                    }
                                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                        configurationTab === "devices"
                                            ? "bg-amber-600 text-white dark:bg-amber-500"
                                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <span>📱</span>
                                    Dispositivos
                                </button>
                            </div>

                            {configurationTab === "floors_tables" && (
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFloorsTablesSubTab("floors")
                                            }
                                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                                floorsTablesSubTab === "floors"
                                                    ? "bg-emerald-600 text-white"
                                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                            }`}
                                        >
                                            Pisos
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFloorsTablesSubTab("tables")
                                            }
                                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                                floorsTablesSubTab === "tables"
                                                    ? "bg-emerald-600 text-white"
                                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                            }`}
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
                            {configurationTab === "devices" && (
                                <DevicePrintConfigs />
                            )}
                        </div>
                    )}
                    {currentView === "delivery" && <Delivery />}
                    {currentView === "branch" && <BranchSettings />}
                </main>
            </div>
        </div>
    );
};

// Componente principal que envuelve con el WebSocketProvider
const LayoutDashboard: React.FC = () => {
    return (
        <WebSocketProvider>
            <LayoutDashboardContent />
        </WebSocketProvider>
    );
};

export default LayoutDashboard;
