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
import { createClient } from "graphql-ws";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { sanitizeGraphQLVariables } from "../utils/sanitizeGraphQLVariables";

// Helper para verificar si un token JWT ha expirado
const isTokenExpired = (token: string | null): boolean => {
    if (!token) return true;
    try {
        // Un JWT tiene 3 partes separadas por puntos. La segunda es el payload en base64.
        const parts = token.split('.');
        if (parts.length !== 3) return true;
        
        const payload = JSON.parse(atob(parts[1]));
        const now = Math.floor(Date.now() / 1000);
        
        // El campo 'exp' es el timestamp de expiración
        return payload.exp < now;
    } catch (e) {
        console.warn("⚠️ Error decodificando token para verificar expiración:", e);
        return true;
    }
};

// Función para limpiar el almacenamiento local de forma consistente
const clearAllAuthStorage = () => {
    console.log("🧹 Limpiando almacenamiento de autenticación por expiración...");
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userData");
    localStorage.removeItem("userPhoto");
    
    // Disparar un evento storage manualmente para que la misma pestaña lo escuche (vía AuthContext)
    window.dispatchEvent(new StorageEvent('storage', {
        key: null,
        newValue: null,
        oldValue: null,
        storageArea: localStorage,
        url: window.location.href
    }));
};

const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL;
const wsUrl = import.meta.env.VITE_WS_URL;
// URL de tu backend Django GraphQL (ajusta según tu configuración)
const httpLink = createHttpLink({
    uri: graphqlUrl,
});

const sanitizeVariablesLink = new ApolloLink((operation, forward) => {
    if (operation.variables) {
        operation.variables = sanitizeGraphQLVariables(operation.variables);
    }
    return forward(operation);
});

// Link para manejar errores de autenticación
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
    if (graphQLErrors) {
        graphQLErrors.forEach(({ message, extensions, path }) => {
            console.error(`GraphQL error: ${message}`, {
                operation: operation?.operationName,
                path: Array.isArray(path) ? path.join(".") : path,
                code: extensions?.code,
            });

            // Si el error es de token expirado o firma expirada, limpiar el localStorage
            if (
                message?.includes("expir") ||
                message?.includes("firma") ||
                extensions?.code === "UNAUTHENTICATED" ||
                extensions?.code === "UNAUTHORIZED"
            ) {
                clearAllAuthStorage();
            }
        });
    }

    if (networkError) {
        console.error(`Network error: ${networkError}`);
    }
});

// Link para agregar headers de autenticación si es necesario
const authLink = setContext((_, { headers }) => {
    // Obtener el token del localStorage
    let token = localStorage.getItem("token");

    // Si el token existe pero ya expiró, lo limpiamos antes de mandarlo
    if (token && isTokenExpired(token)) {
        console.warn("🚫 Token detectado como expirado antes de enviar la petición. Limpiando...");
        clearAllAuthStorage();
        token = null;
    }

    return {
        headers: {
            ...headers,
            authorization: token ? `JWT ${token}` : "",
        },
    };
});

// WebSocket link para suscripciones en tiempo real
const wsClient = createClient({
    url: wsUrl,
    connectionParams: () => {
        const token = localStorage.getItem("token");
        // No enviamos el token si sabemos que está expirado
        if (token && isTokenExpired(token)) {
            return {};
        }
        return {
            authorization: token ? `JWT ${token}` : "",
        };
    },
});

const wsLink = new GraphQLWsLink(wsClient);

// Split link: HTTP para queries/mutations, WebSocket para subscriptions
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

// Crear el cliente Apollo
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
