import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@apollo/client";
import { WEB_LOGIN } from "../graphql/mutations";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../context/ToastContext";
import VirtualKeyboard from "../components/VirtualKeyboard";
import { useResponsive } from "../hooks/useResponsive";
import "./loginWeb.css";

const LoginWeb: React.FC = () => {
    const navigate = useNavigate();
    const { loginUser, loginCompany } = useAuth();
    const { showToast } = useToast();
    const { isMobile, isTablet } = useResponsive();

    const [formData, setFormData] = useState({
        ruc: "",
        usuario: "",
        password: "",
    });

    const [showPassword, setShowPassword] = useState(false);
    const [focusedInput, setFocusedInput] = useState<
        "ruc" | "usuario" | "password" | null
    >(null);
    const [virtualKeyboardOpen, setVirtualKeyboardOpen] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [isDarkTheme, setIsDarkTheme] = useState(
        () => localStorage.getItem("sumaq-theme") === "dark",
    );

    // Recuperar credenciales al cargar el componente
    useEffect(() => {
        const savedRuc = localStorage.getItem("remember_ruc");
        const savedUser = localStorage.getItem("remember_user");
        const savedPass = localStorage.getItem("remember_pass");

        if (savedRuc || savedUser) {
            setFormData({
                ruc: savedRuc || "",
                usuario: savedUser || "",
                password: savedPass || "",
            });
            setRememberMe(true);
        }
    }, []);

    useEffect(() => {
        const syncTheme = () => {
            setIsDarkTheme(localStorage.getItem("sumaq-theme") === "dark");
        };
        window.addEventListener("storage", syncTheme);
        return () => window.removeEventListener("storage", syncTheme);
    }, []);

    const rucRef = useRef<HTMLInputElement>(null);
    const usuarioRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    const [webLoginMutation, { loading }] = useMutation(WEB_LOGIN);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.ruc || !formData.usuario || !formData.password) {
            showToast("Por favor completa todos los campos", "warning");
            return;
        }

        try {
            const { data } = await webLoginMutation({
                variables: {
                    ruc: formData.ruc,
                    usuario: formData.usuario,
                    password: formData.password,
                },
            });

            if (data?.webLogin?.success) {
                const { token, refreshToken, user, branch, company } =
                    data.webLogin;

                // Simular la estructura de CompanyData que espera el contexto
                // Nota: Si faltan datos como floors/categories, la app podría fallar en algunas partes,
                // pero aquí seguimos la solicitud del usuario de usar esta mutación.
                loginCompany({
                    company: company,
                    branch: {
                        ...branch,
                        isActive: true, // Asumimos activo si el login fue exitoso
                        floors: [],
                        categories: [],
                        tables: [],
                    },
                });

                loginUser(token, refreshToken, user);

                // Guardar o limpiar credenciales según el checkbox de "Recuérdame"
                if (rememberMe) {
                    localStorage.setItem("remember_ruc", formData.ruc);
                    localStorage.setItem("remember_user", formData.usuario);
                    localStorage.setItem("remember_pass", formData.password);
                } else {
                    localStorage.removeItem("remember_ruc");
                    localStorage.removeItem("remember_user");
                    localStorage.removeItem("remember_pass");
                }

                showToast(
                    `¡Bienvenido, ${user.fullName || user.firstName || "usuario"}!`,
                    "success",
                );
                // Pre-establecer la vista en Mesas al iniciar sesión
                localStorage.setItem("currentDashboardView", "floors");
                navigate("/dashboard");
            } else {
                showToast(
                    data?.webLogin?.message || "Error en el inicio de sesión",
                    "error",
                );
            }
        } catch (err: any) {
            showToast(err.message || "Error de conexión", "error");
        }
    };

    const handleVirtualKeyPress = (key: string) => {
        if (focusedInput === "ruc")
            setFormData((prev) => ({ ...prev, ruc: prev.ruc + key }));
        else if (focusedInput === "usuario")
            setFormData((prev) => ({ ...prev, usuario: prev.usuario + key }));
        else if (focusedInput === "password")
            setFormData((prev) => ({ ...prev, password: prev.password + key }));
    };

    const handleVirtualBackspace = () => {
        if (focusedInput === "ruc")
            setFormData((prev) => ({ ...prev, ruc: prev.ruc.slice(0, -1) }));
        else if (focusedInput === "usuario")
            setFormData((prev) => ({
                ...prev,
                usuario: prev.usuario.slice(0, -1),
            }));
        else if (focusedInput === "password")
            setFormData((prev) => ({
                ...prev,
                password: prev.password.slice(0, -1),
        }));
    };

    return (
        <div className={`landing-container ${isDarkTheme ? "dark-mode" : ""}`}>
            <div className="login-web-container">
                <div className="login-card">
                    {/* Aside Panel */}
                    <aside className="login-aside" style={{ backgroundImage: `url(https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1974)` }}>
                        <div className="login-aside-overlay" />
                        
                        <div className="aside-content">
                            <span className="aside-badge">Plataforma Sumapp</span>
                            <h2>Gestiona tu operación en tiempo real</h2>
                            <p>Pedidos, caja e inventario sincronizados en una sola experiencia premium.</p>
                        </div>

                        <div className="aside-features">
                            <div className="feature-tag">✓ Inicio rápido y seguro</div>
                            <div className="feature-tag">✓ Compatible con teclado virtual</div>
                            <div className="feature-tag">✓ Soporte modo oscuro y claro</div>
                        </div>
                    </aside>

                    {/* Main Login Panel */}
                    <main className="login-main">
                        <header className="login-header">
                            <div className="login-brand">
                                🍽️ Sum<span>app</span>
                            </div>
                            <h2>Acceso al Sistema</h2>
                            <p>Ingresa las credenciales de tu empresa</p>
                        </header>

                        <form className="login-form" onSubmit={handleSubmit}>
                            <div className={`input-group ${focusedInput === "ruc" ? "focused" : ""}`}>
                                <span className="input-icon">🏢</span>
                                <input
                                    ref={rucRef}
                                    type="text"
                                    name="ruc"
                                    value={formData.ruc}
                                    onChange={handleChange}
                                    placeholder="RUC de la empresa"
                                    onFocus={() => setFocusedInput("ruc")}
                                    onBlur={() => setFocusedInput(null)}
                                    maxLength={11}
                                    autoComplete="off"
                                />
                            </div>

                            <div className={`input-group ${focusedInput === "usuario" ? "focused" : ""}`}>
                                <span className="input-icon">👤</span>
                                <input
                                    ref={usuarioRef}
                                    type="text"
                                    name="usuario"
                                    value={formData.usuario}
                                    onChange={handleChange}
                                    placeholder="Usuario o DNI"
                                    onFocus={() => setFocusedInput("usuario")}
                                    onBlur={() => setFocusedInput(null)}
                                    autoComplete="off"
                                />
                            </div>

                            <div className={`input-group ${focusedInput === "password" ? "focused" : ""}`}>
                                <span className="input-icon">🔒</span>
                                <input
                                    ref={passwordRef}
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Contraseña"
                                    onFocus={() => setFocusedInput("password")}
                                    onBlur={() => setFocusedInput(null)}
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? "🙈" : "👁️"}
                                </button>
                            </div>

                            <label className="remember-me">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <span>Recuérdame</span>
                            </label>

                            <button type="submit" className="submit-btn" disabled={loading}>
                                {loading ? <div className="spinner" /> : "INICIAR SESIÓN"}
                            </button>
                        </form>

                        <div className="back-link">
                            <button onClick={() => navigate("/")}>
                                ← Volver al inicio
                            </button>
                        </div>
                    </main>
                </div>

                {/* Virtual Keyboard */}
                {virtualKeyboardOpen && (
                    <div className="fixed inset-x-0 bottom-0 z-[1000] p-5 backdrop-blur-md border-t border-color glass-bg">
                        <VirtualKeyboard
                            onKeyPress={handleVirtualKeyPress}
                            onBackspace={handleVirtualBackspace}
                            onClose={() => setVirtualKeyboardOpen(false)}
                            tight={isMobile || isTablet}
                        />
                    </div>
                )}

                {!virtualKeyboardOpen && (
                    <button
                        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-2xl text-white shadow-lg transition hover:scale-105"
                        onClick={() => setVirtualKeyboardOpen(true)}
                    >
                        ⌨️
                    </button>
                )}
            </div>
        </div>
    );
};

export default LoginWeb;
