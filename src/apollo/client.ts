import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { setContext } from '@apollo/client/link/context';

// URL de tu backend Django GraphQL (ajusta según tu configuración)
const httpLink = createHttpLink({
  uri: 'http://192.168.1.22:8000/graphql', // Puerto 8000 según tu settings
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

// Crear el cliente Apollo
export const client = new ApolloClient({
  link: authLink.concat(httpLink),
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