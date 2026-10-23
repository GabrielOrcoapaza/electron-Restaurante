import React, { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { useAuth } from "../../hooks/useAuth";
import { useUserPermissions } from "../../hooks/useUserPermissions";
import { GET_CONGLOMERATE_CATALOG_ACCESS } from "../../graphql/queries";
import WarehousesTab from "./WarehousesTab";
import MasterIngredientsTab from "./MasterIngredientsTab";
import WarehouseTransfersTab from "./WarehouseTransfersTab";
import ConglomerateTransfersTab from "./ConglomerateTransfersTab";
import ConglomerateCatalogTab from "./ConglomerateCatalogTab";

type TabKey =
    | "almacenes"
    | "ingredientes"
    | "transferencias"
    | "conglomerado"
    | "catalogo";

const Warehouses: React.FC = () => {
    const { companyData, user } = useAuth();
    const { hasPermission } = useUserPermissions();
    const isAdmin = (user?.role || "").toUpperCase() === "ADMIN";
    const branchId = companyData?.branch?.id;

    const usesWarehouses = !!companyData?.company?.usesWarehouses;
    const usesMasterIngredients = !!companyData?.company?.usesMasterIngredients;
    const usesConglomerateTransfers =
        !!companyData?.company?.usesConglomerateTransfers;

    const canManageWarehouses =
        isAdmin || hasPermission("warehouses.manage");
    const canManageMasterIngredients =
        isAdmin || hasPermission("master_ingredients.manage");
    const canManageConglomerate =
        isAdmin || hasPermission("conglomerate_transfers.manage");

    // La pestaña del catálogo solo se muestra a administradores de la empresa master
    // del conglomerado (gobernanza estricta, validada también en backend).
    const { data: catalogAccessData } = useQuery(
        GET_CONGLOMERATE_CATALOG_ACCESS,
        {
            skip: !usesConglomerateTransfers || !canManageConglomerate,
            fetchPolicy: "network-only",
        },
    );
    const canManageConglomerateCatalog =
        !!catalogAccessData?.conglomerateCatalogAccess?.canManage;

    const tabs = useMemo(() => {
        const list: { key: TabKey; label: string; icon: string }[] = [];
        if (usesWarehouses && canManageWarehouses) {
            list.push({ key: "almacenes", label: "Almacenes", icon: "🏬" });
        }
        if (usesMasterIngredients && canManageMasterIngredients) {
            list.push({
                key: "ingredientes",
                label: "Ingredientes Maestros",
                icon: "🧺",
            });
            list.push({
                key: "transferencias",
                label: "Transferencias",
                icon: "🔁",
            });
        }
        if (usesConglomerateTransfers && canManageConglomerate) {
            list.push({
                key: "conglomerado",
                label: "Transferencias entre Empresas",
                icon: "🤝",
            });
        }
        if (
            usesConglomerateTransfers &&
            canManageConglomerate &&
            canManageConglomerateCatalog
        ) {
            list.push({
                key: "catalogo",
                label: "Catálogo del conglomerado",
                icon: "📚",
            });
        }
        return list;
    }, [
        usesWarehouses,
        usesMasterIngredients,
        usesConglomerateTransfers,
        canManageWarehouses,
        canManageMasterIngredients,
        canManageConglomerate,
        canManageConglomerateCatalog,
    ]);

    const [activeTab, setActiveTab] = useState<TabKey | null>(null);
    const currentTab = activeTab && tabs.some((t) => t.key === activeTab)
        ? activeTab
        : tabs[0]?.key ?? null;

    if (!branchId) {
        return (
            <div className="flex min-h-[400px] items-center justify-center rounded-[32px] bg-white p-8 shadow-sm dark:bg-slate-900">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    No se encontró información de la sucursal activa.
                </p>
            </div>
        );
    }

    if (tabs.length === 0) {
        return (
            <div className="flex min-h-[400px] items-center justify-center rounded-[32px] bg-white p-8 shadow-sm dark:bg-slate-900">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-3xl dark:bg-slate-800">
                        🏬
                    </div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Función no disponible
                    </h3>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                        El control de almacenes múltiples y/o las
                        transferencias entre sucursales no están habilitados
                        para su empresa.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
            <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-indigo-600 text-2xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                    🏬
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                        Almacenes
                    </h1>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 sm:text-sm">
                        Almacenes, ingredientes maestros y transferencias
                        entre sucursales
                    </p>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto rounded-[28px] border border-slate-100 bg-white p-2 shadow-sm dark:border-slate-800/50 dark:bg-slate-900">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
                            currentTab === tab.key
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                        }`}
                    >
                        <span className="text-base">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {currentTab === "almacenes" && <WarehousesTab branchId={branchId} />}
            {currentTab === "ingredientes" && (
                <MasterIngredientsTab branchId={branchId} />
            )}
            {currentTab === "transferencias" && (
                <WarehouseTransfersTab branchId={branchId} />
            )}
            {currentTab === "conglomerado" && (
                <ConglomerateTransfersTab branchId={branchId} />
            )}
            {currentTab === "catalogo" && <ConglomerateCatalogTab />}
        </div>
    );
};

export default Warehouses;
