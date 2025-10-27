import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginCompany from './home/loginCompany';
import Login from './home/login';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Routes>
            {/* Ruta principal - redirige a loginCompany */}
            <Route path="/" element={<Navigate to="/login-company" replace />} />
            
            {/* Ruta del login de empresa (primera pantalla) */}
            <Route path="/login-company" element={<LoginCompany />} />
            
            {/* Ruta del login de empleado (segunda pantalla - requiere login de empresa) */}
            <Route 
              path="/login-employee" 
              element={
                <ProtectedRoute requireCompany={true}>
                  <Login />
                </ProtectedRoute>
              } 
            />
            
            {/* Ruta del Dashboard (requiere autenticación completa) */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute requireUser={true}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* Ruta catch-all - redirige a loginCompany */}
            <Route path="*" element={<Navigate to="/login-company" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;