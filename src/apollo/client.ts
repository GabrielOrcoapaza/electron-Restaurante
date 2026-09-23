import {
    ApolloClient,
    InMemoryCache,
    createHttpLink,
    split,
    from,
    ApolloLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { fromPromise } from "@apollo/client/link/utils";
import { createClient } from "graphql-ws";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { sanitizeGraphQLVariables } from "../utils/sanitizeGraphQLVariables";
import { isTokenExpired } from "../utils/jwt";
import {
    clearAllAuthStorage,
    ensureValidAccessToken,
    refreshAccessToken,
    isGraphqlAuthError,
} from "../utils/tokenRefresh";

const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL;
const wsUrl = import.meta.env.VITE_WS_URL;

const httpLink = createHttpLink({
    uri: graphqlUrl,
});

const sanitizeVariablesLink = new ApolloLink((operation, forward) => {
    if (operation.variables) {
        operation.variables = sanitizeGraphQLVariables(operation.variables);
    }
    return forward(operation);
});

const errorLink = onError(
    ({ graphQLErrors, networkError, operation, forward }) => {
        if (graphQLErrors) {
            for (const { message, extensions } of graphQLErrors) {
                console.error(`GraphQL error: ${message}`, {
                    operation: operation?.operationName,
                    code: extensions?.code,
                });

                const isAuthError = isGraphqlAuthError(
                    message,
                    extensions?.code,
                );
                if (!isAuthError) continue;

                if (operation.operationName === "RefreshToken") {
                    clearAllAuthStorage();
                    continue;
                }

                const context = operation.getContext();
                if (context._authRetry) {
                    clearAllAuthStorage();
                    continue;
                }

                return fromPromise(
                    refreshAccessToken().catch(() => null),
                ).flatMap((newToken) => {
                    if (!newToken) {
                        clearAllAuthStorage();
                        return forward(operation);
                    }

                    operation.setContext({
                        ...context,
                        _authRetry: true,
                        headers: {
                            ...(context.headers ?? {}),
                            authorization: `JWT ${newToken}`,
                        },
                    });
                    return forward(operation);
                });
            }
        }

        if (networkError) {
            console.error(`Network error: ${networkError}`);
        }
    },
);

const authLink = setContext(async (_, { headers }) => {
    const token = await ensureValidAccessToken();

    return {
        headers: {
            ...headers,
            authorization: token ? `JWT ${token}` : "",
        },
    };
});

const wsClient = createClient({
    url: wsUrl,
    connectionParams: async () => {
        const token = await ensureValidAccessToken();
        if (!token || isTokenExpired(token)) {
            return {};
        }
        return {
            authorization: `JWT ${token}`,
        };
    },
});

const wsLink = new GraphQLWsLink(wsClient);

const splitLink = split(
    ({ query }) => {
        const definition = getMainDefinition(query);
        return (
            definition.kind === "OperationDefinition" &&
            definition.operation === "subscription"
        );
    },
    wsLink,
    from([errorLink, sanitizeVariablesLink, authLink.concat(httpLink)]),
);

export const client = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
    devtools: { enabled: false },
    defaultOptions: {
        watchQuery: {
            errorPolicy: "all",
        },
        query: {
            errorPolicy: "all",
        },
    },
});

export default client;
