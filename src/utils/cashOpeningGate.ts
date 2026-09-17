export type CashRegisterOpeningStatus = {
    id: string;
    isActive?: boolean | null;
    status?: string | null;
    currentOpening?: { id: string } | null;
};

export const CASH_OPENING_REQUIRED_MESSAGE =
    "Debe abrir la caja antes de registrar pedidos o delivery. Vaya al módulo Caja y realice la apertura.";

export function isCashRegisterOpen(
    register: CashRegisterOpeningStatus,
): boolean {
    return (
        register.isActive !== false &&
        register.status === "OPEN" &&
        Boolean(register.currentOpening?.id)
    );
}

export function hasAnyOpenCashRegister(
    registers: CashRegisterOpeningStatus[],
): boolean {
    return registers.some(isCashRegisterOpen);
}
