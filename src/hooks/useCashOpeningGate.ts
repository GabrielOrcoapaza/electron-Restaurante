import { useQuery } from "@apollo/client";
import { useAuth } from "./useAuth";
import { GET_CASH_REGISTERS } from "../graphql/queries";
import {
    CASH_OPENING_REQUIRED_MESSAGE,
    hasAnyOpenCashRegister,
    type CashRegisterOpeningStatus,
} from "../utils/cashOpeningGate";

export function useCashOpeningGate() {
    const { companyData } = useAuth();
    const branchId = companyData?.branch?.id ?? "";
    const requiresCashOpening = Boolean(
        companyData?.branch?.allowCashOpenings,
    );

    const { data, loading, refetch } = useQuery(GET_CASH_REGISTERS, {
        variables: { branchId },
        skip: !branchId || !requiresCashOpening,
        fetchPolicy: "network-only",
        pollInterval: requiresCashOpening ? 30_000 : 0,
    });

    const registers: CashRegisterOpeningStatus[] =
        data?.cashRegistersByBranch ?? [];
    const hasOpenCashRegister = hasAnyOpenCashRegister(registers);
    const isBlocked = requiresCashOpening && !hasOpenCashRegister;

    return {
        requiresCashOpening,
        hasOpenCashRegister,
        isBlocked,
        loading: requiresCashOpening && loading,
        refetch,
        message: CASH_OPENING_REQUIRED_MESSAGE,
    };
}
