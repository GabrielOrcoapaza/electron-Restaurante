import React from "react";

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
});

export type PosProductCardProps = {
    name: string;
    price: number;
    imageUrl?: string;
    quantity: number;
    badge?: string;
    disabled?: boolean;
    onAdd: () => void;
    onRemove: () => void;
};

export const PosProductCard: React.FC<PosProductCardProps> = ({
    name,
    price,
    imageUrl,
    quantity,
    badge,
    disabled,
    onAdd,
    onRemove,
}) => {
    const hasQty = quantity > 0;

    return (
        <div
            className={`relative flex flex-col overflow-hidden rounded-lg border bg-white ${
                hasQty
                    ? "border-[#3b82f6] shadow-md shadow-blue-100"
                    : "border-slate-200"
            } ${disabled ? "opacity-50" : ""}`}
        >
            {badge && (
                <div className="absolute left-0 top-0 z-10">
                    <span className="block origin-top-left -rotate-45 bg-emerald-500 px-6 py-0.5 text-[9px] font-bold text-white">
                        {badge}
                    </span>
                </div>
            )}

            {hasQty && (
                <>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        className="absolute left-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white"
                    >
                        −
                    </button>
                    <span className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[#3b82f6] text-xs font-bold text-white">
                        {quantity}
                    </span>
                </>
            )}

            <button
                type="button"
                disabled={disabled}
                onClick={onAdd}
                className="relative aspect-[4/3] w-full overflow-hidden disabled:cursor-not-allowed"
            >
                {hasQty && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3b82f6] text-2xl font-light text-white">
                            +
                        </span>
                    </div>
                )}
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-50 text-3xl">
                        🍽️
                    </div>
                )}
            </button>

            <div className="flex flex-1 flex-col gap-1 p-2.5">
                <p className="line-clamp-2 text-[10px] font-semibold uppercase leading-tight text-slate-800">
                    {name}
                </p>
                <p className="mt-auto text-sm font-bold text-slate-900">
                    {currencyFormatter.format(price)}
                </p>
            </div>
        </div>
    );
};
