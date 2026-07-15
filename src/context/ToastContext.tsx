import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import './Toast.css'; // We will create this for animations

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    persistent?: boolean;
    durationMs?: number;
}

interface ToastContextType {
    showToast: (
        message: string,
        type: ToastType,
        persistent?: boolean,
        durationMs?: number,
    ) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Fallback no-op cuando se usa fuera del provider (evita crash en transiciones/navegación)
const noopToast = (() => {
    const fn = (
        _message: string,
        _type: ToastType,
        _persistent?: boolean,
        _durationMs?: number,
    ) => {};
    return { showToast: fn };
})();

export const useToast = () => {
    const context = useContext(ToastContext);
    return context ?? noopToast;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback(
        (
            message: string,
            type: ToastType,
            persistent = false,
            durationMs = 3000,
        ) => {
            const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            setToasts((prev) => [
                ...prev,
                { id, message, type, persistent, durationMs },
            ]);

            if (!persistent) {
                setTimeout(() => {
                    removeToast(id);
                }, durationMs);
            }
        },
        [removeToast],
    );

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="toast-container">
                {toasts.map((toast) => (
                    <div key={toast.id} className={`toast toast-${toast.type} toast-enter`}>
                        <div className="toast-icon">
                            {toast.type === 'success' && '✅'}
                            {toast.type === 'error' && '❌'}
                            {toast.type === 'warning' && '⚠️'}
                            {toast.type === 'info' && 'ℹ️'}
                        </div>
                        <div className="toast-message">{toast.message}</div>
                        {toast.persistent && (
                            <button 
                                onClick={() => removeToast(toast.id)} 
                                className="toast-close"
                                aria-label="Cerrar notificación"
                            >
                                ×
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
