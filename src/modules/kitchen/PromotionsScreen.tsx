import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { GET_ACTIVE_PROMOTIONS } from "../../graphql/queries";
import { useKitchen } from "../../context/KitchenContext";

interface Promotion {
    id: string;
    name: string;
    photoUrl?: string;
    promotionType: string;
    discountPercent?: number;
    discountAmount?: number;
    buyQuantity?: number;
    getQuantity?: number;
    giftProduct?: { id: string; name: string };
    giftQuantity?: number;
    minPurchaseAmount?: number;
    appliesTo: string;
    priority: number;
    isValidNow: boolean;
}

const getPromotionBadge = (type: string) => {
    const badges: Record<string, string> = {
        PERCENTAGE: "PORCENTAJE",
        FIXED_AMOUNT: "MONTO FIJO",
        BUY_X_GET_Y: "2x1",
        GIFT: "REGALO",
    };
    return badges[type] || type;
};

const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

const PromotionsScreen: React.FC = () => {
    const navigate = useNavigate();
    const { kitchenBranchId } = useKitchen();

    const { data, loading, error, refetch } = useQuery(GET_ACTIVE_PROMOTIONS, {
        variables: { branchId: kitchenBranchId },
        skip: !kitchenBranchId,
        pollInterval: 5 * 60 * 1000, // 5 minutos
    });

    const promotions: Promotion[] = useMemo(
        () => data?.activePromotions || [],
        [data]
    );

    return (
        <div className="min-h-screen bg-[#060E1F] text-white">
            {/* TopBar */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#2A3F5F] bg-[#0D2137] px-8 py-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/kitchen")}
                        className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1A2E45] text-2xl transition-all hover:bg-[#1E3A5F]"
                    >
                        ←
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold">Promociones</h1>
                        <p className="text-sm text-[#8A9BBE]">
                            Promociones activas de la sucursal
                        </p>
                    </div>
                </div>
            </div>

            {/* Contenido principal */}
            <div className="p-8">
                {loading && (
                    <div className="flex h-64 items-center justify-center">
                        <div className="text-lg text-[#8A9BBE]">
                            Cargando promociones...
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex h-64 items-center justify-center">
                        <div className="rounded-lg bg-red-900/30 px-8 py-4 text-center text-red-300">
                            <p className="font-semibold">Error al cargar</p>
                            <p className="text-sm">{error.message}</p>
                            <button
                                onClick={() => refetch()}
                                className="mt-4 rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold hover:bg-red-700"
                            >
                                Reintentar
                            </button>
                        </div>
                    </div>
                )}

                {!loading && !error && promotions.length === 0 && (
                    <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
                        <div className="text-5xl">🏷️</div>
                        <p className="text-lg text-[#8A9BBE]">
                            No hay promociones activas en este momento
                        </p>
                    </div>
                )}

                {!loading && !error && promotions.length > 0 && (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {promotions.map((promotion) => (
                            <div
                                key={promotion.id}
                                className="relative overflow-hidden rounded-2xl border border-[#2A3F5F] bg-[#0D2137] p-6 transition-all hover:border-[#4CAF50] hover:shadow-lg"
                            >
                                {promotion.isValidNow && (
                                    <div className="absolute right-4 top-4 rounded-full bg-[#4CAF50] px-4 py-1 text-xs font-bold uppercase tracking-wider">
                                        VÁLIDA HOY
                                    </div>
                                )}

                                {promotion.photoUrl ? (
                                    <div className="mb-4 h-40 w-full overflow-hidden rounded-xl">
                                        <img
                                            src={promotion.photoUrl}
                                            alt={promotion.name}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="mb-4 flex h-40 w-full items-center justify-center rounded-xl bg-[#1A2E45] text-5xl">
                                        🏷️
                                    </div>
                                )}

                                <div className="mb-3 flex items-center gap-2">
                                    <span className="rounded-full bg-[#FF6F00] px-3 py-1 text-xs font-bold uppercase">
                                        {getPromotionBadge(promotion.promotionType)}
                                    </span>
                                </div>

                                <h3 className="mb-2 text-xl font-bold">
                                    {promotion.name}
                                </h3>

                                <div className="mb-4 space-y-1 text-sm text-[#8A9BBE]">
                                    {promotion.promotionType === "PERCENTAGE" && (
                                        <p className="text-3xl font-bold text-[#4CAF50]">
                                            -{promotion.discountPercent}%
                                        </p>
                                    )}
                                    {promotion.promotionType === "FIXED_AMOUNT" && (
                                        <p className="text-3xl font-bold text-[#4CAF50]">
                                            -${promotion.discountAmount}
                                        </p>
                                    )}
                                    {promotion.promotionType === "BUY_X_GET_Y" && (
                                        <p className="text-3xl font-bold text-[#4CAF50]">
                                            ¡{promotion.buyQuantity}x{promotion.getQuantity}!
                                        </p>
                                    )}
                                    {promotion.promotionType === "GIFT" && (
                                        <p className="text-xl font-bold text-[#4CAF50]">
                                            +{promotion.giftQuantity}x{" "}
                                            {promotion.giftProduct?.name}
                                        </p>
                                    )}
                                </div>

                                {promotion.minPurchaseAmount && (
                                    <p className="mb-2 text-xs text-[#8A9BBE]">
                                        Compra mínima: ${promotion.minPurchaseAmount}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PromotionsScreen;
