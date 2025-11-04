import { ApolloClient, InMemoryCache, createHttpLink, split, from } from "@apollo/client";
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { createClient } from 'graphql-ws';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';

// URL de tu backend Django GraphQL (ajusta según tu configuración)
const httpLink = createHttpLink({
  uri: 'http://192.168.1.22:8000/graphql', // Puerto 8000 según tu settings
});

// Link para manejar errores de autenticación
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, extensions }) => {
      console.error(`GraphQL error: ${message}`);
      
      // Si el error es de token expirado o firma expirada, limpiar el localStorage
      if (message?.includes('expir') || message?.includes('firma') || 
          extensions?.code === 'UNAUTHENTICATED' || extensions?.code === 'UNAUTHORIZED') {
        console.log('🧹 Token expirado o inválido, limpiando localStorage...');
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('userPhoto');
      }
    });
  }
  
  if (networkError) {
    console.error(`Network error: ${networkError}`);
  }
});

// Link para agregar headers de autenticación si es necesario
const authLink = setContext((_, { headers }) => {
  // Obtener el token del localStorage si existe
  const token = localStorage.getItem('token');
  
  return {
    headers: {
      ...headers,
      authorization: token ? `JWT ${token}` : "",
    }
  }
});

// WebSocket link para suscripciones en tiempo real
const wsClient = createClient({
  url: 'ws://192.168.1.22:8000/ws/restaurant/',
  connectionParams: () => {
    const token = localStorage.getItem('token');
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
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  from([errorLink, authLink.concat(httpLink)])
);

// Crear el cliente Apollo
export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
});

export default client;