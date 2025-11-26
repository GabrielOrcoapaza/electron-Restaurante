import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import LoginCompany from './home/loginCompany';
import Login from './home/login';
import Dashboard from './components/Dashboard';
import './App.css';

// Componente interno que necesita acceso al AuthContext
const AppRoutes = () => {
  const { companyData } = useAuth();
  
  // Componente para redirigir según si hay datos de compañía
  const RedirectToLogin = () => {
    // Si ya hay datos de compañía guardados, ir directamente al login de empleado
    if (companyData) {
      return <Navigate to="/login-employee" replace />;
    }
    
    // Si no hay datos de compañía, ir al login de compañía
    return <Navigate to="/login-company" replace />;
  };

  // Componente wrapper para LoginCompany que verifica si ya hay datos de compañía
  const LoginCompanyWrapper = () => {
    // Si ya hay datos de compañía, redirigir al login de empleado
    if (companyData) {
      return <Navigate to="/login-employee" replace />;
    }
    
    // Si no hay datos de compañía, mostrar el formulario de login de compañía
    return <LoginCompany />;
  };

  return (
    <div className="App">
      <Routes>
        {/* Ruta principal - redirige según si hay datos de compañía */}
        <Route path="/" element={<RedirectToLogin />} />
        
        {/* Ruta del login de empresa (primera pantalla) - solo si no hay datos guardados */}
        <Route path="/login-company" element={<LoginCompanyWrapper />} />
        
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
        
        {/* Ruta catch-all - redirige según si hay datos de compañía */}
        <Route path="*" element={<RedirectToLogin />} />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;