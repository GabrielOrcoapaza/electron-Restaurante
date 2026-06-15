import {
    HashRouter as Router,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useKitchen } from "./context/KitchenContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginCompany from "./home/loginCompany";
import Login from "./home/login";
import LoginWeb from "./home/loginWeb";
import LandingPage from "./home/landing/LandingPage";
import FullMenuPage from "./home/landing/FullMenuPage";
import AppShell from "./components/AppShell";
import LoginKitchen from "./modules/kitchen/LoginKitchen";
import KitchenScreen from "./modules/kitchen/KitchenScreen";
import "./App.css";

const isElectron = navigator.userAgent.toLowerCase().includes("electron");

// Componente para proteger rutas de cocina
const ProtectedKitchenRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated } = useKitchen();
    if (!isAuthenticated) {
        return <Navigate to="/login-kitchen" replace />;
    }
    return <>{children}</>;
};

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

    const RootComponent = () => {
        // Si estamos en Electron, ir siempre al flujo de login (empresa o empleado)
        if (isElectron) {
            return <RedirectToLogin />;
        }
        // En Web, mostrar Landing
        return <LandingPage />;
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
                {/* Ruta principal - Landing para web, Redirección para Electron */}
                <Route path="/" element={<RootComponent />} />

                {/* Ruta del login de empresa (primera pantalla) - solo si no hay datos guardados */}
                <Route
                    path="/login-company"
                    element={<LoginCompanyWrapper />}
                />

                {/* Ruta del login web (RUC, Usuario, Password) */}
                <Route path="/login" element={<LoginWeb />} />

                {/* Ruta del login de empleado (segunda pantalla - requiere login de empresa) */}
                <Route
                    path="/login-employee"
                    element={
                        <ProtectedRoute requireCompany={true}>
                            <Login />
                        </ProtectedRoute>
                    }
                />

                {/* Rutas para la cocina */}
                <Route path="/login-kitchen" element={<LoginKitchen />} />

                <Route
                    path="/kitchen"
                    element={
                        <ProtectedKitchenRoute>
                            <KitchenScreen />
                        </ProtectedKitchenRoute>
                    }
                />

                {/* Ruta principal del sistema (requiere autenticación completa) */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute requireUser={true}>
                            <AppShell />
                        </ProtectedRoute>
                    }
                />

                {/* Ruta para ver la carta completa */}
                <Route path="/carta/:companyId" element={<FullMenuPage />} />

                {/* Ruta catch-all - redirige a la raíz para evitar bloqueos por login */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </div>
    );
};

function App() {
    return (
        <Router>
            <AppRoutes />
        </Router>
    );
}

export default App;
