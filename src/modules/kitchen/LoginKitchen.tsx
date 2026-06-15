import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../hooks/useResponsive";
import { useToast } from "../../context/ToastContext";
import { useKitchen } from "../../context/KitchenContext";
import VirtualKeyboard from "../../components/VirtualKeyboard";

const LoginKitchen: React.FC = () => {
    const navigate = useNavigate();
    const { companyData, getDeviceId, clearCompanyData } = useAuth();
    const { isMobile, isTablet } = useResponsive();
    const { showToast } = useToast();
    const { login, isAuthenticated } = useKitchen();

    const [formData, setFormData] = useState({
        dni: "",
        password: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [focusedInput, setFocusedInput] = useState<"dni" | "password" | null>(
        null,
    );
    const [virtualKeyboardOpen, setVirtualKeyboardOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const keyboardActive = focusedInput !== null || virtualKeyboardOpen;
    const passwordInputRef = useRef<HTMLInputElement>(null);
    const dniInputRef = useRef<HTMLInputElement>(null);
    const [showConfirmExit, setShowConfirmExit] = useState(false);
    const [deviceId, setDeviceId] = useState("");

    useEffect(() => {
        setDeviceId(getDeviceId());
    }, [getDeviceId]);

    useEffect(() => {
        if (isAuthenticated) {
            navigate("/kitchen");
        }
        // Solo verificar companyData en Electron
        const isElectron =
            typeof navigator !== "undefined" &&
            navigator.userAgent.toLowerCase().includes("electron");
        if (isElectron && !companyData) {
            showToast(
                "Primero debes iniciar sesión con los datos de la empresa",
                "warning",
            );
            navigate("/login-company");
        }
    }, [companyData, navigate, showToast, isAuthenticated]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.dni) {
            showToast("Por favor ingresa tu DNI", "warning");
            return;
        }

        if (!formData.password) {
            showToast("Por favor ingresa tu contraseña", "warning");
            return;
        }

        await performLogin(formData.dni, formData.password);
    };

    const performLogin = async (dni: string, password: string) => {
        if (!deviceId) {
            showToast("Error al obtener el ID del dispositivo", "error");
            return;
        }

        setLoading(true);
        try {
            const result = await login(dni, password, deviceId);
            if (result.success) {
                showToast(`¡Bienvenido!`, "success");
            } else {
                showToast(result.message, "error");
            }
        } catch (err: any) {
            showToast(err.message || "Error en el login", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleBackToCompany = () => {
        setShowConfirmExit(true);
    };

    const confirmExit = () => {
        clearCompanyData();
        navigate("/login-company", { replace: true });
    };

    const handleVirtualKeyPress = (key: string) => {
        if (focusedInput === "dni") {
            setFormData((prev) => ({ ...prev, dni: prev.dni + key }));
        } else if (focusedInput === "password") {
            setFormData((prev) => ({ ...prev, password: prev.password + key }));
        }
    };

    const handleVirtualBackspace = () => {
        if (focusedInput === "dni") {
            setFormData((prev) => ({ ...prev, dni: prev.dni.slice(0, -1) }));
        } else if (focusedInput === "password") {
            setFormData((prev) => ({
                ...prev,
                password: prev.password.slice(0, -1),
            }));
        }
    };

    const closeVirtualKeyboard = () => {
        setVirtualKeyboardOpen(false);
        setFocusedInput(null);
        dniInputRef.current?.blur();
        passwordInputRef.current?.blur();
    };

    const activateVirtualKeyboard = () => {
        setVirtualKeyboardOpen(true);
        if (formData.dni && !formData.password) {
            setFocusedInput("password");
            setTimeout(() => passwordInputRef.current?.focus(), 100);
        } else {
            setFocusedInput("dni");
            setTimeout(() => dniInputRef.current?.focus(), 100);
        }
    };

    return (
        <div className="login-user-wrapper">
            <div className="login-bg-image"></div>
            <div className="login-overlay"></div>

            <div
                className={`fullscreen-glass-card ${keyboardActive ? "keyboard-active" : ""}`}
            >
                <div className="card-header">
                    <div className="header-top-row">
                        <div className="header-info">
                            <div className="user-icon-ring">
                                <span className="user-icon">🍳</span>
                            </div>
                            <h2 className="text-xl font-bold text-gray-800">
                                Login Cocina
                            </h2>
                        </div>

                        <div className="header-actions">
                            {(() => {
                                const isElectron =
                                    typeof navigator !== "undefined" &&
                                    navigator.userAgent
                                        .toLowerCase()
                                        .includes("electron");
                                if (isElectron) {
                                    return (
                                        <button
                                            type="button"
                                            className="btn-back"
                                            onClick={handleBackToCompany}
                                        >
                                            🔙{" "}
                                            <span className="action-text">
                                                Cambiar Local
                                            </span>
                                        </button>
                                    );
                                }
                                // En web, mostrar botón para volver a la Landing
                                return (
                                    <button
                                        type="button"
                                        className="btn-back"
                                        onClick={() => navigate("/")}
                                    >
                                        🔙{" "}
                                        <span className="action-text">
                                            Volver
                                        </span>
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                <div className="card-body">
                    <div className="flex-1 flex flex-col justify-center items-center">
                        <form
                            className="password-area w-full max-w-md"
                            onSubmit={handleSubmit}
                        >
                            <div className="password-header text-center mb-8">
                                <h2 className="text-2xl font-bold text-gray-800">
                                    Acceso a Cocina
                                </h2>
                                <p className="text-gray-600">
                                    Ingresa tus credenciales para acceder
                                </p>
                            </div>

                            <div className="space-y-6">
                                <div
                                    className={`password-input-group ${focusedInput === "dni" ? "focused" : ""}`}
                                >
                                    <span className="pass-icon">👤</span>
                                    <input
                                        ref={dniInputRef}
                                        type="text"
                                        name="dni"
                                        value={formData.dni}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                dni: e.target.value,
                                            }))
                                        }
                                        placeholder="DNI"
                                        className="pass-input"
                                        onFocus={() => setFocusedInput("dni")}
                                    />
                                </div>

                                <div
                                    className={`password-input-group ${focusedInput === "password" ? "focused" : ""}`}
                                >
                                    <span className="pass-icon">🔒</span>
                                    <input
                                        ref={passwordInputRef}
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        name="password"
                                        value={formData.password}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                password: e.target.value,
                                            }))
                                        }
                                        placeholder="••••••••"
                                        className="pass-input"
                                        onFocus={() =>
                                            setFocusedInput("password")
                                        }
                                    />
                                    <button
                                        type="button"
                                        className="pass-toggle"
                                        onClick={() =>
                                            setShowPassword(!showPassword)
                                        }
                                    >
                                        {showPassword ? "🙈" : "👁️"}
                                    </button>
                                </div>
                            </div>

                            <div className="action-buttons mt-8">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-submit w-full"
                                >
                                    {loading ? "⏳" : "🚀 Iniciar Sesión"}
                                </button>
                            </div>
                        </form>
                    </div>

                    {keyboardActive && (
                        <div
                            className="keyboard-overlay visible"
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            <div className="keyboard-container">
                                <VirtualKeyboard
                                    onKeyPress={handleVirtualKeyPress}
                                    onBackspace={handleVirtualBackspace}
                                    compact
                                    tight={isMobile || isTablet}
                                    onClose={closeVirtualKeyboard}
                                    onEnter={() => {
                                        if (
                                            focusedInput === "password" ||
                                            formData.password
                                        ) {
                                            passwordInputRef.current?.form?.requestSubmit();
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {!keyboardActive && (
                    <button
                        type="button"
                        className="btn-float-virtual-keyboard"
                        onClick={activateVirtualKeyboard}
                        title="Teclado virtual"
                        aria-label="Teclado virtual"
                    >
                        <span className="float-kb-icon" aria-hidden>
                            ⌨️
                        </span>
                    </button>
                )}
            </div>

            {showConfirmExit && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <span className="modal-emoji">👋</span>
                        <h3>¿Cambiar sucursal/empresa?</h3>
                        <p>
                            Se cerrará la conexión actual. Deberás volver a
                            colocar el RUC para acceder.
                        </p>
                        <div className="modal-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => setShowConfirmExit(false)}
                            >
                                Mejor No
                            </button>
                            <button
                                className="btn-confirm"
                                onClick={confirmExit}
                            >
                                Sí, Cambiar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        :root {
          --primary: #FF6B6B;
          --primary-hover: #ff5252;
          --secondary: #FFA726;
          --bg-card: rgba(255, 255, 255, 0.95);
          --text-dark: #2d3748;
          --text-muted: #718096;
          --border-color: #e2e8f0;
          --input-bg: rgba(247, 250, 252, 0.9);
        }

        .login-user-wrapper {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          width: 100vw; height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          z-index: 99999;
          overflow: hidden;
          background: #000;
        }

        .login-bg-image {
          position: absolute;
          inset: -5%;
          width: 110%; height: 110%;
          background-image: url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1920');
          background-size: cover;
          background-position: center;
          z-index: 1;
          filter: brightness(1.2);
          animation: smoothZoom 40s infinite alternate ease-in-out;
        }

        @keyframes smoothZoom {
          0% { transform: scale(1) translate(0, 0); }
          100% { transform: scale(1.05) translate(-1%, -1%); }
        }

        .login-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 107, 107, 0.65) 0%, rgba(255, 167, 38, 0.7) 50%, rgba(171, 71, 188, 0.6) 100%);
          backdrop-filter: blur(8px);
          z-index: 2;
        }

        .fullscreen-glass-card {
          position: relative;
          z-index: 10;
          background: var(--bg-card);
          backdrop-filter: blur(25px);
          box-shadow: 0 40px 80px rgba(0,0,0,0.3);
          width: 98vw;
          height: 96vh;
          border-radius: 2rem;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: popUpCard 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: padding-bottom 0.4s ease;
        }

        @keyframes popUpCard {
          0% { opacity: 0; transform: scale(0.95) translateY(40px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }

        .card-header {
          display: flex;
          flex-direction: column;
          padding: 1.5rem 3rem;
          background: rgba(255, 255, 255, 0.7);
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
          gap: 1.5rem;
          transition: all 0.3s ease;
        }

        .header-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .user-icon-ring {
          width: 3.5rem; height: 3.5rem;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          border-radius: 1rem;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 5px 15px rgba(255, 107, 107, 0.4);
        }

        .user-icon { font-size: 1.7rem; color: white; }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }

        .btn-back, .btn-update {
           padding: 0.6rem 1.2rem;
           border-radius: 0.75rem;
           font-weight: 700;
           font-size: 0.9rem;
           cursor: pointer;
           border: none;
           display: flex;
           align-items: center;
           gap: 0.5rem;
           transition: all 0.2s;
        }

        .btn-back {
           background: white; color: var(--text-dark); border: 1px solid var(--border-color);
           box-shadow: 0 2px 5px rgba(0,0,0,0.02);
        }
        .btn-back:hover { background: #f8fafc; transform: translateY(-2px); }

        .card-body {
          flex: 1; display: flex; padding: 1.5rem 3rem; gap: 2.5rem; min-height: 0;
        }

        .password-area {
           flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0; max-width: 450px;
        }

        .password-header {
          display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;
        }

        .password-input-group {
           display: flex; align-items: center; gap: 1rem; background: var(--input-bg);
           border: 2px solid var(--border-color); border-radius: 1rem; padding: 1rem 1.25rem;
           transition: all 0.2s;
        }
        .password-input-group.focused {
          border-color: var(--secondary);
          background: white;
          box-shadow: 0 0 0 4px rgba(255, 167, 38, 0.15);
        }
        .pass-icon { font-size: 1.5rem; opacity: 0.7; }
        .pass-input {
           flex: 1; border: none; outline: none; background: transparent;
           font-size: 1.2rem; font-weight: 500; color: var(--text-dark);
        }
        .pass-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .pass-toggle {
           border: none; background: none; cursor: pointer; font-size: 1.5rem;
           padding: 0.25rem; transition: transform 0.1s;
        }
        .pass-toggle:disabled { opacity: 0.3; cursor: not-allowed; }
        .pass-toggle:hover { transform: scale(1.1); }

        .action-buttons {
           display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.5rem;
        }

        .btn-submit {
           padding: 1rem 2rem;
           background: linear-gradient(135deg, var(--primary), var(--secondary));
           color: white;
           border: none;
           border-radius: 1rem;
           font-size: 1.2rem;
           font-weight: 700;
           cursor: pointer;
           transition: all 0.2s;
           box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
        }
        .btn-submit:hover:not(:disabled) {
           filter: brightness(1.05);
           transform: translateY(-2px);
           box-shadow: 0 8px 25px rgba(255, 107, 107, 0.5);
        }
        .btn-submit:disabled {
           opacity: 0.5;
           cursor: not-allowed;
        }

        .btn-float-virtual-keyboard {
          position: absolute;
          left: max(1rem, calc(1rem + env(safe-area-inset-left, 0px)));
          bottom: max(1rem, calc(1rem + env(safe-area-inset-bottom, 0px)));
          z-index: 45;
          width: 3.5rem;
          height: 3.5rem;
          padding: 0;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          cursor: pointer;
          border: none;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.45), 0 2px 8px rgba(0, 0, 0, 0.12);
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        .btn-float-virtual-keyboard:hover {
          filter: brightness(1.06);
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(99, 102, 241, 0.5), 0 4px 12px rgba(0, 0, 0, 0.14);
        }
        .btn-float-virtual-keyboard:active {
          transform: translateY(0);
        }
        .float-kb-icon {
          font-size: 1.45rem;
          line-height: 1;
        }

        .keyboard-overlay {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          width: auto;
          max-width: none;
          transform: translateY(100%);
          max-height: min(40vh, 300px);
          z-index: 55;
          padding: 0.4rem 0.4rem max(0.5rem, env(safe-area-inset-bottom));
          box-sizing: border-box;
          overflow-x: hidden;
          overflow-y: auto;
          scrollbar-width: auto;
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          border: 1px solid #cbd5e1;
          border-radius: 1rem;
          background: rgba(248, 250, 252, 0.98);
          backdrop-filter: blur(12px);
          box-shadow: 0 -8px 32px rgba(0,0,0, 0.1), 0 4px 16px rgba(0,0,0, 0.06);
          transition: transform 0.36s cubic-bezier(0.16, 1, 0.35, 1), opacity 0.26s ease, visibility 0.36s;
        }
        .keyboard-overlay.visible {
          transform: translateY(0);
          pointer-events: auto;
          opacity: 1;
          visibility: visible;
        }
        .keyboard-overlay .keyboard-container {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
        }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          z-index: 100000; padding: 1rem;
        }
        .modal-content {
          background: white; border-radius: 1.5rem; padding: 2rem;
          max-width: 400px; width: 100%; text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .modal-emoji { font-size: 4rem; display: block; margin-bottom: 1rem; }
        .modal-content h3 { font-size: 1.5rem; color: var(--text-dark); margin-bottom: 1rem; }
        .modal-content p { color: var(--text-muted); margin-bottom: 1.5rem; }
        .modal-actions { display: flex; gap: 1rem; justify-content: center; }
        .btn-cancel, .btn-confirm {
          padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 600; font-size: 1rem;
          cursor: pointer; border: none; transition: all 0.2s;
        }
        .btn-cancel { background: #f1f5f9; color: var(--text-dark); }
        .btn-cancel:hover { background: #e2e8f0; }
        .btn-confirm { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; }
        .btn-confirm:hover { filter: brightness(1.05); transform: translateY(-2px); }
      `}</style>
        </div>
    );
};

export default LoginKitchen;
