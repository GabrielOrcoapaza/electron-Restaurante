import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ApolloProvider } from '@apollo/client';
import { client } from './apollo/client';
import { ToastProvider } from './context/ToastContext';
import './index.css'; // importa los estilos de Tailwind

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ApolloProvider>
  </React.StrictMode>
);
