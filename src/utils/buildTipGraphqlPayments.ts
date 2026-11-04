import { normalizeGraphQLId } from "./sanitizeGraphQLVariables";

export type TipPaymentLine = {
    method: string;
    amount: number;
    referenceNumber: string;
};

const referenceMethods = new Set(["YAPE", "PLIN", "TRANSFER"]);

export function buildTipGraphqlPayments(params: {
    lines: TipPaymentLine[];
    tipWaiterId: string;
    cashRegisterId: string;
    paymentDate: string;
}): Array<{
    cashRegisterId: string;
    paymentType: string;
    paymentMethod: string;
    transactionType: string;
    totalAmount: number;
    paidAmount: number;
    paymentDate: string;
    dueDate: null;
    referenceNumber: string | null;
    notes: null;
    paymentPurpose: string;
    tipWaiterId: string;
}> {
    const waiterId = normalizeGraphQLId(params.tipWaiterId);
    if (!waiterId) return [];

    return params.lines
        .filter((line) => Number(line.amount) > 0.001)
        .map((line) => ({
            cashRegisterId: params.cashRegisterId,
            paymentType: "CASH",
            paymentMethod: line.method,
            transactionType: "INCOME",
            totalAmount: Number(line.amount),
            paidAmount: Number(line.amount),
            paymentDate: params.paymentDate,
            dueDate: null,
            referenceNumber: referenceMethods.has(line.method)
                ? line.referenceNumber?.trim() || null
                : null,
            notes: null,
            paymentPurpose: "TIP",
            tipWaiterId: waiterId,
        }));
}
