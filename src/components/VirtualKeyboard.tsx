import React, { useState } from "react";

type VirtualKeyboardProps = {
    onKeyPress: (key: string) => void;
    onBackspace: () => void;
    onClear?: () => void;
    disabled?: boolean;
    compact?: boolean;
    onClose?: () => void;
    /** Si se define, muestra tecla Enter y la ejecuta (p. ej. confirmar búsqueda en order) */
    onEnter?: () => void;
    /** Con `compact`, reduce aún más teclas (p. ej. móviles < 480px) */
    tight?: boolean;
};

// Filas del teclado en español (minúsculas y con shift)
const ROW1 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const ROW2 = ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"];
const ROW3 = ["z", "x", "c", "v", "b", "n", "m", ",", "."];
const NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const SYMBOLS = ["@", "#", "$", "%", "&", "*", "-", "+", "=", "/"];

const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
    onKeyPress,
    onBackspace,
    onClear,
    disabled = false,
    compact = false,
    onClose,
    onEnter,
    tight = false,
}) => {
    const [shift, setShift] = useState(false);
    const [isCapsLock, setIsCapsLock] = useState(false);
    const [isHoldingShift, setIsHoldingShift] = useState(false);
    const [showNumbers, setShowNumbers] = useState(false);
    const isTight = Boolean(compact && tight);
    const backspaceTimerRef = React.useRef<ReturnType<
        typeof setTimeout
    > | null>(null);
    const shiftTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const isLongPressRef = React.useRef(false);
    const isShiftLongPressRef = React.useRef(false);

    const handleBackspaceStart = () => {
        if (disabled) return;
        isLongPressRef.current = false;
        backspaceTimerRef.current = setTimeout(() => {
            if (onClear) {
                onClear();
                isLongPressRef.current = true;
            }
        }, 800);
    };

    const handleBackspaceEnd = () => {
        if (backspaceTimerRef.current) {
            clearTimeout(backspaceTimerRef.current);
            backspaceTimerRef.current = null;
        }
        if (!isLongPressRef.current && !disabled) {
            onBackspace();
        }
        isLongPressRef.current = false;
    };

    const handleShiftStart = () => {
        if (disabled) return;
        isShiftLongPressRef.current = false;
        setIsHoldingShift(true);

        shiftTimerRef.current = setTimeout(() => {
            setIsCapsLock((prev) => !prev);
            setShift(false);
            isShiftLongPressRef.current = true;
        }, 800);
    };

    const handleShiftEnd = () => {
        if (shiftTimerRef.current) {
            clearTimeout(shiftTimerRef.current);
            shiftTimerRef.current = null;
        }

        setIsHoldingShift(false);

        if (!isShiftLongPressRef.current && !disabled) {
            if (isCapsLock) {
                setIsCapsLock(false);
                setShift(false);
            } else {
                setShift((prev) => !prev);
            }
        }
        isShiftLongPressRef.current = false;
    };

    const handleShiftLeave = () => {
        if (shiftTimerRef.current) {
            clearTimeout(shiftTimerRef.current);
            shiftTimerRef.current = null;
        }
        setIsHoldingShift(false);
        isShiftLongPressRef.current = false;
    };

    const handleKey = (key: string) => {
        if (disabled) return;
        if (key === "⇧") {
            return;
        }
        if (key === "123") {
            setShowNumbers(true);
            return;
        }
        if (key === "ABC") {
            setShowNumbers(false);
            return;
        }
        if (key === "⌫") {
            return;
        }
        if (key === "↵") {
            onEnter?.();
            return;
        }

        const shouldBeUpper = isCapsLock || shift || isHoldingShift;
        const char =
            key === " "
                ? " "
                : shouldBeUpper && key.length === 1
                  ? key.toUpperCase()
                  : key.toLowerCase();
        onKeyPress(char);

        if (shift && !isCapsLock && key !== " ") {
            setShift(false);
        }
    };

    // Teclas escalables con rem; compact / tight para tablets y móviles
    const keyStyle: React.CSSProperties = {
        flex: 1,
        minWidth: isTight ? "1.3rem" : compact ? "1.75rem" : "2rem",
        height: isTight ? "2.4rem" : compact ? "2.9rem" : "4.25rem",
        padding: isTight
            ? "0.12rem 0.08rem"
            : compact
              ? "0.25rem 0.2rem"
              : "0.5rem 0.35rem",
        fontSize: isTight ? "1.35rem" : compact ? "1.75rem" : "2.3rem",
        fontWeight: 700,
        border: "1px solid #cbd5e0",
        borderRadius: "0.5rem",
        background: "#fff",
        color: "#1e293b",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        transition: "all 0.15s ease",
    };
    const keyClassName =
        "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700";
    const specialKeyClassName =
        "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600";
    const closeBtnClassName =
        "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

    const specialKeyStyle: React.CSSProperties = {
        ...keyStyle,
        background: "#e2e8f0",
        color: "#475569",
        flex: "0 0 auto",
        minWidth: isTight ? "2rem" : compact ? "2.5rem" : "3.5rem",
    };

    const spaceKeyStyle: React.CSSProperties = {
        ...keyStyle,
        flex: 1,
        minWidth: isTight ? "2.6rem" : compact ? "3.75rem" : "7.5rem",
        background: "#e2e8f0",
        color: "#334155",
        border: "2px solid #94a3b8",
        fontWeight: 700,
        fontSize: isTight ? "0.62rem" : compact ? "0.75rem" : "0.95rem",
    };

    const enterKeyStyle: React.CSSProperties = {
        ...specialKeyStyle,
        minWidth: isTight ? "2.75rem" : compact ? "3.5rem" : "4.5rem",
        maxWidth: isTight ? "3.5rem" : compact ? "4.5rem" : "5.5rem",
        fontSize: isTight ? "0.58rem" : compact ? "0.68rem" : "0.85rem",
        fontWeight: 800,
        background: "#cbd5e1",
        color: "#1e293b",
    };

    const rowStyle: React.CSSProperties = {
        display: "flex",
        width: "100%",
        gap: isTight ? "0.12rem" : compact ? "0.25rem" : "0.375rem",
        justifyContent: "stretch",
        marginBottom: isTight ? "0.12rem" : compact ? "0.2rem" : "0.375rem",
    };

    const containerStyle: React.CSSProperties = {
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        padding: isTight
            ? "0.3rem 0.35rem"
            : compact
              ? "0.4rem 0.6rem"
              : "0.9rem",
        background: "#f8fafc",
        borderRadius: "0.625rem",
        border: "1px solid #e2e8f0",
    };

    if (showNumbers) {
        return (
            <div
                className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                style={containerStyle}
            >
                {onClose && (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            marginBottom: "0.5rem",
                        }}
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            className={closeBtnClassName}
                        >
                            Cerrar
                        </button>
                    </div>
                )}
                <div style={rowStyle}>
                    {NUMBERS.map((k) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => handleKey(k)}
                            className={keyClassName}
                            style={keyStyle}
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            {k}
                        </button>
                    ))}
                </div>
                <div style={rowStyle}>
                    {SYMBOLS.map((k) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => handleKey(k)}
                            className={keyClassName}
                            style={keyStyle}
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            {k}
                        </button>
                    ))}
                </div>
                <div style={rowStyle}>
                    <button
                        type="button"
                        onClick={() => setShowNumbers(false)}
                        className={specialKeyClassName}
                        style={specialKeyStyle}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        ABC
                    </button>
                    <button
                        type="button"
                        onClick={() => handleKey(" ")}
                        className={specialKeyClassName}
                        style={spaceKeyStyle}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        Espacio
                    </button>
                    {onEnter && (
                        <button
                            type="button"
                            onClick={() => handleKey("↵")}
                            className={specialKeyClassName}
                            style={enterKeyStyle}
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            Enter
                        </button>
                    )}
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            handleBackspaceStart();
                        }}
                        onMouseUp={handleBackspaceEnd}
                        onMouseLeave={handleBackspaceEnd}
                        onTouchStart={(e) => {
                            e.preventDefault();
                            handleBackspaceStart();
                        }}
                        onTouchEnd={handleBackspaceEnd}
                        onContextMenu={(e) => e.preventDefault()}
                        className={specialKeyClassName}
                        style={specialKeyStyle}
                    >
                        ⌫
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
            style={containerStyle}
        >
            {onClose && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginBottom: "0.5rem",
                    }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className={closeBtnClassName}
                    >
                        Cerrar
                    </button>
                </div>
            )}
            <div style={rowStyle}>
                {ROW1.map((k) => (
                    <button
                        key={k}
                        type="button"
                        onClick={() => handleKey(k)}
                        className={keyClassName}
                        style={keyStyle}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        {isCapsLock || shift || isHoldingShift
                            ? k.toUpperCase()
                            : k}
                    </button>
                ))}
            </div>
            <div style={rowStyle}>
                {ROW2.map((k) => (
                    <button
                        key={k}
                        type="button"
                        onClick={() => handleKey(k)}
                        className={keyClassName}
                        style={keyStyle}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        {isCapsLock || shift || isHoldingShift
                            ? k.toUpperCase()
                            : k}
                    </button>
                ))}
            </div>
            <div style={rowStyle}>
                <button
                    type="button"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        handleShiftStart();
                    }}
                    onMouseUp={handleShiftEnd}
                    onMouseLeave={handleShiftLeave}
                    onTouchStart={(e) => {
                        e.preventDefault();
                        handleShiftStart();
                    }}
                    onTouchEnd={handleShiftEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    className={specialKeyClassName}
                    style={{
                        ...specialKeyStyle,
                        background: isCapsLock
                            ? "#818cf8"
                            : shift || isHoldingShift
                              ? "#c7d2fe"
                              : "#e2e8f0",
                        color: isCapsLock ? "white" : "#475569",
                        position: "relative",
                    }}
                >
                    ⇧
                    {isCapsLock && (
                        <div
                            style={{
                                position: "absolute",
                                top: "4px",
                                right: "4px",
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "white",
                                boxShadow: "0 0 4px rgba(255,255,255,0.8)",
                            }}
                        />
                    )}
                </button>
                {ROW3.map((k) => (
                    <button
                        key={k}
                        type="button"
                        onClick={() => handleKey(k)}
                        className={keyClassName}
                        style={keyStyle}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        {(isCapsLock || shift || isHoldingShift) &&
                        k.length === 1
                            ? k.toUpperCase()
                            : k}
                    </button>
                ))}
                <button
                    type="button"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        handleBackspaceStart();
                    }}
                    onMouseUp={handleBackspaceEnd}
                    onMouseLeave={handleBackspaceEnd}
                    onTouchStart={(e) => {
                        e.preventDefault();
                        handleBackspaceStart();
                    }}
                    onTouchEnd={handleBackspaceEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    className={specialKeyClassName}
                    style={specialKeyStyle}
                >
                    ⌫
                </button>
            </div>
            <div style={rowStyle}>
                <button
                    type="button"
                    onClick={() => setShowNumbers(true)}
                    className={specialKeyClassName}
                    style={specialKeyStyle}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    123
                </button>
                <button
                    type="button"
                    onClick={() => handleKey(" ")}
                    className={specialKeyClassName}
                    style={spaceKeyStyle}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    Espacio
                </button>
                {onEnter && (
                    <button
                        type="button"
                        onClick={() => handleKey("↵")}
                        className={specialKeyClassName}
                        style={enterKeyStyle}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        Enter
                    </button>
                )}
            </div>
        </div>
    );
};

export default VirtualKeyboard;
