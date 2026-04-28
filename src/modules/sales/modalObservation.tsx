import React, { useState, useEffect, useRef } from "react";
import { useResponsive } from "../../hooks/useResponsive";
import VirtualKeyboard from "../../components/VirtualKeyboard";

type Observation = {
    id: string;
    note: string;
};

type ModalObservationProps = {
    isOpen: boolean;
    onClose: () => void;
    observations: Observation[];
    selectedObservationIds: Set<string>;
    onApply: (selectedIds: Set<string>, manualNotes: string) => void;
    productName: string;
    currentNotes: string;
    canEdit: boolean;
};

const ModalObservation: React.FC<ModalObservationProps> = ({
    isOpen,
    onClose,
    observations,
    selectedObservationIds,
    onApply,
    productName,
    currentNotes,
    canEdit,
}) => {
    const { breakpoint } = useResponsive();
    const isSmall = breakpoint === "sm";
    const isMedium = breakpoint === "md";
    const isSmallDesktop = breakpoint === "lg";

    const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
    const [manualNotes, setManualNotes] = useState<string>("");
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const shouldMoveCursorToEndRef = useRef(false);

    const moveCursorToEnd = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const end = textarea.value.length;
        textarea.focus();
        textarea.setSelectionRange(end, end);
    };

    const normalizeEnumeratedManualNotes = (text: string): string => {
        if (!text) return "";
        let normalized = text;
        // "1, Con arroz" -> "1 Con arroz"
        normalized = normalized.replace(/(\d+[.)]?)\s*,\s*(?=\p{L})/gu, "$1 ");
        // "Con arroz2 Con ensalada" -> "Con arroz, 2 Con ensalada"
        normalized = normalized.replace(/(\p{L})\s*(\d+[.)]?\s+)/gu, "$1, $2");
        return normalized;
    };

    // El teclado virtual solo edita la parte de notas manuales, así se conservan comas y cualquier carácter
    const handleVirtualKeyPress = (key: string) => {
        if (!canEdit) return;

        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentText = manualNotes;

        let textToInsert = key;
        // Si escribe un nuevo índice ("2", "3", etc.) justo después de texto, agregamos separador.
        if (/^\d$/.test(key)) {
            const textBefore = currentText.substring(0, start).trimEnd();
            if (/[\p{L})]$/u.test(textBefore)) {
                textToInsert = `, ${key}`;
            }
        }

        const newText =
            currentText.substring(0, start) +
            textToInsert +
            currentText.substring(end);
        setManualNotes(newText);

        // Reposicionar el cursor después del renderizado
        const newPos = start + textToInsert.length;
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    const handleVirtualBackspace = () => {
        if (!canEdit) return;

        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentText = manualNotes;

        if (start === 0 && end === 0) return;

        let newText = "";
        let newPos = 0;

        if (start !== end) {
            // Borrar selección
            newText =
                currentText.substring(0, start) + currentText.substring(end);
            newPos = start;
        } else {
            // Borrar un carácter atrás
            newText =
                currentText.substring(0, start - 1) +
                currentText.substring(start);
            newPos = start - 1;
        }

        setManualNotes(newText);

        // Reposicionar el cursor después del renderizado
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    // Semilla inicial al abrir
    useEffect(() => {
        if (!isOpen) return;
        setLocalSelected(new Set(selectedObservationIds));
        setManualNotes(currentNotes || "");

        // Auto-enfocar el textarea al abrir y mover el cursor al final
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const length = textareaRef.current.value.length;
                textareaRef.current.setSelectionRange(length, length);
            }
        }, 50);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Sincronizar los chips (localSelected) con el contenido del texto
    useEffect(() => {
        if (!isOpen) return;
        const newSelected = new Set<string>();
        observations.forEach((obs) => {
            const escapedNote = obs.note.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(
                `(^|,\\s*)\\d*[.)]?\\s*${escapedNote}(\\s*,|$)`,
                "u",
            );
            if (regex.test(manualNotes)) {
                newSelected.add(obs.id);
            }
        });

        // Solo actualizar si hay cambios reales para evitar re-renders infinitos
        setLocalSelected((prev) => {
            if (
                prev.size === newSelected.size &&
                Array.from(prev).every((id) => newSelected.has(id))
            ) {
                return prev;
            }
            return newSelected;
        });
    }, [manualNotes, observations, isOpen]);

    useEffect(() => {
        if (!shouldMoveCursorToEndRef.current) return;
        shouldMoveCursorToEndRef.current = false;
        requestAnimationFrame(() => {
            moveCursorToEnd();
        });
    }, [localSelected, manualNotes]);

    if (!isOpen) return null;

    const modalPadding = isSmall
        ? "1rem"
        : isMedium
          ? "1.25rem"
          : isSmallDesktop
            ? "1.5rem"
            : "2rem";
    const modalMaxWidth = isSmall
        ? "95%"
        : isMedium
          ? "580px"
          : isSmallDesktop
            ? "680px"
            : "760px";
    const titleFontSize = isSmall ? "1rem" : isMedium ? "1.125rem" : "1.25rem";

    const handleToggle = (observationId: string) => {
        if (!canEdit) return;

        const obs = observations.find((o) => o.id === observationId);
        if (!obs) return;

        // Comportamiento de "Sello": Solo agregar, no borrar.
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentText = manualNotes;

        let textToInsert = obs.note;
        const textBefore = currentText.substring(0, start).trimEnd();

        // Lógica de separador inteligente
        if (textBefore !== "") {
            if (/(^|,\s*)\d+[.)]?$/u.test(textBefore)) {
                // Si lo anterior es un número (ej: "1"), solo un espacio
                textToInsert = ` ${obs.note}`;
            } else if (!textBefore.endsWith(",")) {
                // Si no hay coma, la ponemos
                textToInsert = `, ${obs.note}`;
            } else {
                // Si ya hay coma, solo espacio
                textToInsert = ` ${obs.note}`;
            }
        }

        const newText =
            currentText.substring(0, start) +
            textToInsert +
            currentText.substring(end);

        // Aseguramos que después de una etiqueta siempre haya una coma y espacio
        let finalizedText = newText;
        if (!finalizedText.trimEnd().endsWith(",")) {
            finalizedText = finalizedText.trimEnd() + ", ";
        }

        setManualNotes(finalizedText);

        // Reposicionar el cursor al final de lo insertado
        const newPos = start + textToInsert.length + 2;
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    const handleApply = () => {
        // Aplicamos la normalización final antes de guardar
        const finalNotes = normalizeEnumeratedManualNotes(manualNotes.trim());
        onApply(localSelected, finalNotes);
        onClose();
    };

    const handleCancel = () => {
        setLocalSelected(new Set(selectedObservationIds));
        setManualNotes(currentNotes || "");
        onClose();
    };

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10000,
                padding: "1rem",
            }}
        >
            <div
                style={{
                    backgroundColor: "white",
                    borderRadius: "20px",
                    padding: modalPadding,
                    maxWidth: modalMaxWidth,
                    width: "100%",
                    maxHeight: "95vh",
                    minHeight: "50vh",
                    overflowY: "auto",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                    position: "relative",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Botón cerrar */}
                <button
                    onClick={handleCancel}
                    style={{
                        position: "absolute",
                        top: "1rem",
                        right: "1rem",
                        background: "none",
                        border: "none",
                        fontSize: "1.5rem",
                        cursor: "pointer",
                        color: "#64748b",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#f1f5f9")
                    }
                    onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                    }
                >
                    ✕
                </button>

                <h2
                    style={{
                        margin: "0 0 1rem",
                        paddingRight: "2.25rem",
                        fontSize: titleFontSize,
                        fontWeight: 700,
                        color: "#1e293b",
                        lineHeight: 1.3,
                    }}
                >
                    📋{" "}
                    {productName?.trim()
                        ? `Observaciones de ${productName.trim()}`
                        : "Observaciones"}
                </h2>

                {/* Lista de observaciones guardadas (solo si existen) */}
                {observations.length > 0 && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: "0.75rem",
                            marginBottom: "1.5rem",
                        }}
                    >
                        {observations.map((observation) => {
                            const isSelected = localSelected.has(
                                observation.id,
                            );
                            return (
                                <button
                                    key={observation.id}
                                    type="button"
                                    onClick={() => handleToggle(observation.id)}
                                    disabled={!canEdit}
                                    style={{
                                        fontSize: isSmall
                                            ? "0.875rem"
                                            : isMedium
                                              ? "0.9375rem"
                                              : "1rem",
                                        color: isSelected
                                            ? "#0369a1"
                                            : "#0c4a6e",
                                        padding: "0.5rem 1rem",
                                        background: isSelected
                                            ? "#dbeafe"
                                            : "white",
                                        borderRadius: "999px",
                                        border: isSelected
                                            ? "2px solid #3b82f6"
                                            : "1px solid #e0f2fe",
                                        cursor: canEdit
                                            ? "pointer"
                                            : "not-allowed",
                                        textAlign: "center",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        transition: "all 0.2s ease",
                                        opacity: canEdit ? 1 : 0.6,
                                        whiteSpace: "nowrap",
                                        fontWeight: isSelected ? 600 : 400,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (canEdit) {
                                            e.currentTarget.style.background =
                                                isSelected
                                                    ? "#bfdbfe"
                                                    : "#f0f9ff";
                                            e.currentTarget.style.transform =
                                                "scale(1.05)";
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (canEdit) {
                                            e.currentTarget.style.background =
                                                isSelected
                                                    ? "#dbeafe"
                                                    : "white";
                                            e.currentTarget.style.transform =
                                                "scale(1)";
                                        }
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: isSmall
                                                ? "1rem"
                                                : "1.125rem",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {isSelected ? "✓" : "○"}
                                    </span>
                                    <span>{observation.note}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Campo para escribir observaciones - siempre visible (con o sin observaciones guardadas) */}
                <div
                    style={{
                        marginBottom: "1rem",
                    }}
                >
                    <label
                        style={{
                            display: "block",
                            fontSize: isSmall ? "0.875rem" : "0.9375rem",
                            fontWeight: 600,
                            color: "#1e293b",
                            marginBottom: "0.5rem",
                        }}
                    >
                        {observations.length > 0
                            ? "📝 Notas adicionales:"
                            : "📝 Escribe la observación al plato:"}
                    </label>
                    <textarea
                        ref={textareaRef}
                        value={manualNotes}
                        onChange={(e) => {
                            setManualNotes(e.target.value);
                        }}
                        disabled={!canEdit}
                        placeholder={
                            observations.length > 0
                                ? "Las observaciones seleccionadas aparecerán aquí. Puedes agregar notas adicionales..."
                                : "Ej: Sin cebolla, bien cocido, sin sal..."
                        }
                        style={{
                            width: "100%",
                            minHeight: "80px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e0",
                            padding: "0.75rem",
                            fontSize: isSmall ? "0.875rem" : "0.9375rem",
                            resize: "vertical",
                            background: canEdit ? "white" : "#f1f5f9",
                            color: canEdit ? "#1a202c" : "#64748b",
                            fontFamily: "inherit",
                            lineHeight: "1.5",
                        }}
                    />
                    {!canEdit && (
                        <p
                            style={{
                                fontSize: "0.75rem",
                                color: "#94a3b8",
                                margin: "0.5rem 0 0 0",
                                fontStyle: "italic",
                            }}
                        >
                            Las notas no se pueden editar para este producto
                        </p>
                    )}
                </div>

                {/* Teclado virtual (compacto para que se vean bien Cancelar y Aplicar) */}
                {canEdit && (
                    <div style={{ marginTop: "0.5rem", maxWidth: "100%" }}>
                        <VirtualKeyboard
                            onKeyPress={handleVirtualKeyPress}
                            onBackspace={handleVirtualBackspace}
                            onClear={() => {
                                if (!canEdit) return;
                                setManualNotes("");
                                setLocalSelected(new Set());
                            }}
                            disabled={!canEdit}
                            compact={true}
                        />
                    </div>
                )}

                {/* Botones de acción */}
                <div
                    style={{
                        display: "flex",
                        gap: "0.75rem",
                        justifyContent: "flex-end",
                        borderTop: "1px solid #e2e8f0",
                        paddingTop: "0.75rem",
                        marginTop: "0.75rem",
                    }}
                >
                    <button
                        onClick={handleCancel}
                        style={{
                            padding: isSmall
                                ? "0.5rem 1rem"
                                : "0.625rem 1.25rem",
                            background: "#f1f5f9",
                            border: "1px solid #cbd5e0",
                            color: "#475569",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: isSmall ? "0.875rem" : "0.9375rem",
                            transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#e2e8f0";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#f1f5f9";
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!canEdit}
                        style={{
                            padding: isSmall
                                ? "0.5rem 1rem"
                                : "0.625rem 1.25rem",
                            background: canEdit
                                ? "linear-gradient(135deg, #667eea, #764ba2)"
                                : "#cbd5e0",
                            border: "none",
                            color: "white",
                            borderRadius: "8px",
                            cursor: canEdit ? "pointer" : "not-allowed",
                            fontWeight: 700,
                            fontSize: isSmall ? "0.875rem" : "0.9375rem",
                            opacity: canEdit ? 1 : 0.6,
                            transition: "all 0.2s ease",
                            boxShadow: canEdit
                                ? "0 2px 6px rgba(102, 126, 234, 0.3)"
                                : "none",
                        }}
                        onMouseEnter={(e) => {
                            if (canEdit) {
                                e.currentTarget.style.transform =
                                    "translateY(-2px)";
                                e.currentTarget.style.boxShadow =
                                    "0 4px 10px rgba(102, 126, 234, 0.4)";
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (canEdit) {
                                e.currentTarget.style.transform =
                                    "translateY(0)";
                                e.currentTarget.style.boxShadow =
                                    "0 2px 6px rgba(102, 126, 234, 0.3)";
                            }
                        }}
                    >
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalObservation;
