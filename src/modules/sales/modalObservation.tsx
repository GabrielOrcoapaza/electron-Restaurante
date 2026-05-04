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
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
            style={{
                zIndex: 10000,
            }}
            onClick={handleCancel}
        >
            <div
                className="relative w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                style={{
                    padding: modalPadding,
                    maxWidth: modalMaxWidth,
                    width: "100%",
                    maxHeight: "95vh",
                    minHeight: "50vh",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Botón cerrar */}
                <button
                    onClick={handleCancel}
                    className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    style={{
                        background: "none",
                        border: "none",
                        fontSize: "1.5rem",
                        cursor: "pointer",
                    }}
                >
                    ✕
                </button>

                <h2
                    className="text-slate-800 dark:text-slate-100"
                    style={{
                        margin: "0 0 1rem",
                        paddingRight: "2.25rem",
                        fontSize: titleFontSize,
                        fontWeight: 700,
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
                                    className={`inline-flex items-center gap-2 rounded-full border text-center transition-all duration-150 ${
                                        isSelected
                                            ? "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
                                    } ${canEdit ? "" : "cursor-not-allowed opacity-60"}`}
                                    style={{
                                        fontSize: isSmall
                                            ? "0.875rem"
                                            : isMedium
                                              ? "0.9375rem"
                                              : "1rem",
                                        padding: "0.5rem 1rem",
                                        borderRadius: "999px",
                                        textAlign: "center",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        whiteSpace: "nowrap",
                                        fontWeight: isSelected ? 600 : 400,
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
                        className="text-slate-800 dark:text-slate-100"
                        style={{
                            display: "block",
                            fontSize: isSmall ? "0.875rem" : "0.9375rem",
                            fontWeight: 600,
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
                        className="w-full rounded-lg border border-slate-300 bg-white p-3 font-inherit leading-6 text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                        placeholder={
                            observations.length > 0
                                ? "Las observaciones seleccionadas aparecerán aquí. Puedes agregar notas adicionales..."
                                : "Ej: Sin cebolla, bien cocido, sin sal..."
                        }
                        style={{
                            minHeight: "80px",
                            fontSize: isSmall ? "0.875rem" : "0.9375rem",
                            resize: "vertical",
                        }}
                    />
                    {!canEdit && (
                        <p
                            className="text-slate-400 dark:text-slate-500"
                            style={{
                                fontSize: "0.75rem",
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
                    className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700"
                    style={{
                        display: "flex",
                        gap: "0.75rem",
                        justifyContent: "flex-end",
                    }}
                >
                    <button
                        onClick={handleCancel}
                        className="rounded-lg border border-slate-300 bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        style={{
                            padding: isSmall
                                ? "0.5rem 1rem"
                                : "0.625rem 1.25rem",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: isSmall ? "0.875rem" : "0.9375rem",
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!canEdit}
                        className="rounded-lg border border-indigo-300 bg-indigo-600 text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 dark:border-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-700"
                        style={{
                            padding: isSmall
                                ? "0.5rem 1rem"
                                : "0.625rem 1.25rem",
                            borderRadius: "8px",
                            cursor: canEdit ? "pointer" : "not-allowed",
                            fontWeight: 700,
                            fontSize: isSmall ? "0.875rem" : "0.9375rem",
                            opacity: canEdit ? 1 : 0.6,
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
