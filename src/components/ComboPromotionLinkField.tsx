import React, { useMemo } from "react";
import { useQuery } from "@apollo/client";
import { GET_PROMOTIONS_BY_BRANCH } from "../graphql/queries";

interface ComboPromotionLinkFieldProps {
    branchId: string;
    value: string;
    onChange: (promotionId: string) => void;
    labelClass?: string;
    fieldClass?: string;
    labelFontSize?: string;
    inputPadding?: string;
    inputFontSize?: string;
}

export const ComboPromotionLinkField: React.FC<ComboPromotionLinkFieldProps> = ({
    branchId,
    value,
    onChange,
    labelClass = "mb-2 block font-medium text-slate-600 dark:text-slate-300",
    fieldClass = "w-full rounded-lg border border-slate-300 bg-white text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
    labelFontSize,
    inputPadding,
    inputFontSize,
}) => {
    const { data, loading } = useQuery(GET_PROMOTIONS_BY_BRANCH, {
        variables: { branchId, includeInactive: true },
        skip: !branchId,
        fetchPolicy: "network-only",
    });

    const comboPromotions = useMemo(() => {
        const raw = data?.promotionsByBranch || [];
        return raw
            .filter((p: { promotionType?: string }) => p.promotionType === "COMBO")
            .sort((a: { name: string }, b: { name: string }) =>
                a.name.localeCompare(b.name, "es"),
            );
    }, [data]);

    return (
        <div className="rounded-xl border border-orange-200 bg-orange-50/80 p-4 dark:border-orange-900/40 dark:bg-orange-950/20">
            <label className={labelClass} style={{ fontSize: labelFontSize }}>
                Promoción combo / menú vinculada *
            </label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required
                className={fieldClass}
                style={{
                    padding: inputPadding,
                    fontSize: inputFontSize,
                    boxSizing: "border-box",
                }}
            >
                <option value="">
                    {loading
                        ? "Cargando promociones..."
                        : "Seleccionar promoción COMBO..."}
                </option>
                {comboPromotions.map(
                    (promo: {
                        id: string;
                        name: string;
                        isActive?: boolean;
                        scopes?: unknown[];
                    }) => (
                        <option key={promo.id} value={promo.id}>
                            {promo.name}
                            {!promo.isActive ? " (inactiva)" : ""}
                            {promo.scopes?.length
                                ? ` — ${promo.scopes.length} scope(s)`
                                : " — sin scopes"}
                        </option>
                    ),
                )}
            </select>
            <p className="mt-2 text-xs text-orange-800/80 dark:text-orange-200/80">
                Primero crea la promoción tipo <strong>COMBO</strong> con sus
                scopes en Promociones. Luego selecciónala aquí para que el
                producto muestre las opciones al vender.
            </p>
            {!loading && comboPromotions.length === 0 && (
                <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                    No hay promociones COMBO en esta sucursal. Créala en el
                    módulo Promociones antes de continuar.
                </p>
            )}
        </div>
    );
};
