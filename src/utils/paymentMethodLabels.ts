export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Efectivo",
    YAPE: "Yape",
    PLIN: "Plin",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
    RAPPI: "Rappi",
    PEDIDO_YA: "Pedido Ya",
    OTROS: "Otros",
};

export function getPaymentMethodLabel(method?: string | null): string {
    const code = (method || "").trim().toUpperCase();
    if (!code) return "—";
    return PAYMENT_METHOD_LABELS[code] ?? code;
}
