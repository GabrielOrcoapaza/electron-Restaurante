import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ApolloProvider } from '@apollo/client';
import { client } from './apollo/client';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { KitchenProvider } from './context/KitchenContext';
import { WebSocketProvider } from './context/WebSocketContext';
import './index.css'; // importa los estilos de Tailwind
import './styles/responsive.css'; // escalado según resolución de pantalla (debe ir después para sobrescribir base)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <ApolloProvider client={client}>
        <AuthProvider>
          <WebSocketProvider>
            <KitchenProvider>
              <App />
            </KitchenProvider>
          </WebSocketProvider>
        </AuthProvider>
      </ApolloProvider>
    </ToastProvider>
  </React.StrictMode>
);
