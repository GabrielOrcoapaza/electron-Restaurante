export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Efectivo",
    YAPE: "Yape",
    PLIN: "Plin",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
    RAPPI: "Rappi",
    PEDIDO_YA: "Pedido Ya",
    LLAMA_FOOD: "LlamaFood",
    CREDITO: "Crédito",
    OTROS: "Otros",
};

const PAYMENT_METHOD_LABEL_LOOKUP = Object.fromEntries(
    Object.entries(PAYMENT_METHOD_LABELS).map(([code, label]) => [
        label.trim().toUpperCase(),
        code,
    ]),
);

/** Unifica códigos del backend (p. ej. "Pedido Ya", "PEDIDO YA" → PEDIDO_YA). */
export function normalizePaymentMethodCode(
    method?: string | null,
): string {
    const trimmed = (method ?? "").trim();
    if (!trimmed) return "OTROS";

    const upper = trimmed.toUpperCase();
    if (PAYMENT_METHOD_LABELS[upper]) return upper;

    const fromLabel = PAYMENT_METHOD_LABEL_LOOKUP[upper];
    if (fromLabel) return fromLabel;

    const underscored = upper.replace(/[\s-]+/g, "_");
    if (PAYMENT_METHOD_LABELS[underscored]) return underscored;

    return underscored;
}

export function getPaymentMethodLabel(method?: string | null): string {
    if (!(method ?? "").trim()) return "—";
    const code = normalizePaymentMethodCode(method);
    return (
        PAYMENT_METHOD_LABELS[code] ??
        code.replace(/_/g, " ")
    );
}
