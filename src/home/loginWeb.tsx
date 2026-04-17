import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@apollo/client";
import { WEB_LOGIN } from "../graphql/mutations";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../context/ToastContext";
import VirtualKeyboard from "../components/VirtualKeyboard";
import { useResponsive } from "../hooks/useResponsive";

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
        <div className="fixed inset-0 z-[1000] flex h-screen w-screen items-center justify-center overflow-hidden font-['Outfit']">
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                    backgroundImage:
                        "url('https://images.unsplash.com/photo-1517248135467-4c7ed9d42c77?auto=format&fit=crop&q=80&w=1920')",
                    filter: "brightness(0.58)",
                }}
            />
            <div
                className={`absolute inset-0 backdrop-blur-md ${
                    isDarkTheme
                        ? "bg-gradient-to-br from-slate-900/70 via-slate-900/55 to-emerald-950/60"
                        : "bg-gradient-to-br from-emerald-400/35 via-slate-900/65 to-emerald-900/45"
                }`}
            />

            <div className="relative z-10 w-full max-w-6xl px-4 md:px-6">
                <div
                    className={`grid overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl md:grid-cols-2 ${
                        isDarkTheme
                            ? "border-slate-700/80 bg-slate-900/80 text-slate-100"
                            : "border-white/30 bg-white/90 text-slate-900"
                    }`}
                >
                    <aside
                        className="relative hidden h-full flex-col justify-between p-10 md:flex overflow-hidden"
                    >
                        {/* Background for Aside */}
                        <div 
                            className="absolute inset-0 z-0"
                            style={{
                                backgroundImage: "url('https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&q=80&w=1000')",
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                filter: 'brightness(0.4) saturate(1.2)'
                            }}
                        />
                        <div 
                            className={`absolute inset-0 z-[1] ${
                                isDarkTheme 
                                ? "bg-emerald-950/80" 
                                : "bg-emerald-800/70"
                            }`}
                        />

                        <div className="absolute -right-16 -top-16 z-[2] h-56 w-56 rounded-full bg-white/10 blur-2xl" />
                        <div className="absolute -bottom-20 -left-10 z-[2] h-56 w-56 rounded-full bg-black/20 blur-3xl" />
                        
                        <div className="relative z-10">
                            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
                                Plataforma Restaurantes
                            </div>
                            <h2 className="text-4xl font-black leading-tight">
                                Gestiona tu operación en tiempo real
                            </h2>
                            <p className="mt-4 max-w-sm text-sm text-white/85">
                                Pedidos, caja e inventario sincronizados en una
                                sola experiencia.
                            </p>
                        </div>
                        <div className="relative z-10 space-y-3 text-sm">
                            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                                ✓ Inicio rápido y seguro
                            </div>
                            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                                ✓ Compatible con teclado virtual
                            </div>
                            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                                ✓ Soporte modo oscuro y claro
                            </div>
                        </div>
                    </aside>

                    <div className="p-6 md:p-10">
                        <div className="mb-8 text-center">
                            <div className="mb-4 flex items-center justify-center gap-2.5">
                                <span className="text-4xl">🍽️</span>
                                <h1 className="text-3xl font-black">
                                    Sum
                                    <span className="text-emerald-500">app</span>
                                </h1>
                            </div>
                            <div className="mx-auto mb-3 h-1 w-20 rounded-full bg-emerald-500" />
                            <h2 className="text-2xl font-bold">
                                Acceso al Sistema
                            </h2>
                            <p
                                className={`mt-2 text-sm ${
                                    isDarkTheme
                                        ? "text-slate-300"
                                        : "text-slate-500"
                                }`}
                            >
                                Ingresa las credenciales de tu empresa
                            </p>
                        </div>

                        <form
                            className="flex flex-col gap-4"
                            onSubmit={handleSubmit}
                        >
                            <div
                                className={`group flex items-center rounded-xl border-2 transition-all ${
                                    focusedInput === "ruc"
                                        ? "border-emerald-500 bg-white shadow-[0_0_0_4px_rgba(16,185,129,0.18)]"
                                        : isDarkTheme
                                          ? "border-slate-700 bg-slate-800/90"
                                          : "border-transparent bg-slate-100"
                                }`}
                            >
                                <span className="pl-4 text-lg opacity-70">
                                    🏢
                                </span>
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
                                    className={`w-full bg-transparent px-4 py-3.5 text-base font-medium outline-none ${
                                        isDarkTheme
                                            ? "text-slate-100 placeholder:text-slate-400"
                                            : "text-slate-800 placeholder:text-slate-500"
                                    }`}
                                />
                            </div>

                            <div
                                className={`group flex items-center rounded-xl border-2 transition-all ${
                                    focusedInput === "usuario"
                                        ? "border-emerald-500 bg-white shadow-[0_0_0_4px_rgba(16,185,129,0.18)]"
                                        : isDarkTheme
                                          ? "border-slate-700 bg-slate-800/90"
                                          : "border-transparent bg-slate-100"
                                }`}
                            >
                                <span className="pl-4 text-lg opacity-70">
                                    👤
                                </span>
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
                                    className={`w-full bg-transparent px-4 py-3.5 text-base font-medium outline-none ${
                                        isDarkTheme
                                            ? "text-slate-100 placeholder:text-slate-400"
                                            : "text-slate-800 placeholder:text-slate-500"
                                    }`}
                                />
                            </div>

                            <div
                                className={`group flex items-center rounded-xl border-2 transition-all ${
                                    focusedInput === "password"
                                        ? "border-emerald-500 bg-white shadow-[0_0_0_4px_rgba(16,185,129,0.18)]"
                                        : isDarkTheme
                                          ? "border-slate-700 bg-slate-800/90"
                                          : "border-transparent bg-slate-100"
                                }`}
                            >
                                <span className="pl-4 text-lg opacity-70">
                                    🔒
                                </span>
                                <input
                                    ref={passwordRef}
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Contraseña"
                                    onFocus={() => setFocusedInput("password")}
                                    onBlur={() => setFocusedInput(null)}
                                    className={`w-full bg-transparent px-4 py-3.5 text-base font-medium outline-none ${
                                        isDarkTheme
                                            ? "text-slate-100 placeholder:text-slate-400"
                                            : "text-slate-800 placeholder:text-slate-500"
                                    }`}
                                />
                                <button
                                    type="button"
                                    className="pr-4 text-xl"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                >
                                    {showPassword ? "🙈" : "👁️"}
                                </button>
                            </div>

                            <div
                                className="my-1 flex cursor-pointer items-center gap-2.5"
                                onClick={() => setRememberMe(!rememberMe)}
                            >
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) =>
                                        setRememberMe(e.target.checked)
                                    }
                                    className="h-[18px] w-[18px] cursor-pointer accent-emerald-600"
                                />
                                <span
                                    className={`text-sm font-semibold ${
                                        isDarkTheme
                                            ? "text-slate-300"
                                            : "text-slate-500"
                                    }`}
                                >
                                    Recuérdame
                                </span>
                            </div>

                            <button
                                type="submit"
                                className={`mt-2 flex items-center justify-center gap-2.5 rounded-xl bg-emerald-600 px-4 py-4 text-base font-bold text-white shadow-[0_10px_25px_-5px_rgba(5,150,105,0.4)] transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70`}
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-b-transparent" />
                                ) : (
                                    <>INICIAR SESIÓN</>
                                )}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <button
                                className={`text-sm font-semibold transition ${
                                    isDarkTheme
                                        ? "text-slate-300 hover:text-rose-400"
                                        : "text-slate-500 hover:text-rose-500"
                                }`}
                                onClick={() => navigate("/")}
                            >
                                ← Volver al inicio
                            </button>
                        </div>
                    </div>
                </div>

                {virtualKeyboardOpen && (
                    <div
                        className={`fixed inset-x-0 bottom-0 z-[1000] border-t p-5 backdrop-blur-md ${
                            isDarkTheme
                                ? "border-slate-700 bg-slate-900/95"
                                : "border-slate-200 bg-white/95"
                        }`}
                    >
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
