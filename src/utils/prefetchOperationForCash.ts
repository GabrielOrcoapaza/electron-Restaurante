import type { ApolloClient } from "@apollo/client";
import { GET_OPERATION_BY_ID_FOR_CASH } from "../graphql/queries";
import { normalizeGraphQLId } from "./sanitizeGraphQLVariables";

/** Precarga la operación en caché Apollo antes de montar CashPay (p. ej. al pulsar Caja). */
export function prefetchOperationForCash(
    client: ApolloClient<object>,
    operationId: string | number | null | undefined,
): void {
    const id = normalizeGraphQLId(operationId);
    if (!id) return;
    void client
        .query({
            query: GET_OPERATION_BY_ID_FOR_CASH,
            variables: { operationId: id },
            fetchPolicy: "cache-first",
        })
        .catch(() => {
            /* prefetch best-effort */
        });
}
