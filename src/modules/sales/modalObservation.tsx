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
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all animate-in fade-in duration-200"
            onClick={handleCancel}
        >
            <div
                className="relative flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-colors duration-200 dark:border-slate-800 dark:bg-slate-950"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
                        <span className="text-xl">📋</span>
                        {productName?.trim()
                            ? `Observaciones: ${productName.trim()}`
                            : "Observaciones"}
                    </h2>
                    <button
                        onClick={handleCancel}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                        aria-label="Cerrar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    <div className="flex flex-col gap-6">
                        {/* Lista de observaciones predefinidas */}
                        {observations.length > 0 && (
                            <div className="flex flex-col gap-3">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Opciones Rápidas
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {observations.map((observation) => {
                                        const isSelected = localSelected.has(observation.id);
                                        return (
                                            <button
                                                key={observation.id}
                                                type="button"
                                                onClick={() => handleToggle(observation.id)}
                                                disabled={!canEdit}
                                                className={`group relative flex items-center gap-2 overflow-hidden rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                                                    isSelected
                                                        ? "border-indigo-200 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20 dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-300"
                                                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-indigo-900/50 dark:hover:bg-indigo-900/10"
                                                } ${!canEdit && "cursor-not-allowed opacity-50"}`}
                                            >
                                                <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
                                                    isSelected 
                                                    ? "border-indigo-500 bg-indigo-500 text-[10px] text-white" 
                                                    : "border-slate-300 dark:border-slate-700"
                                                }`}>
                                                    {isSelected && "✓"}
                                                </span>
                                                {observation.note}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Campo de texto */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                {observations.length > 0 ? "Notas adicionales" : "Escribe la observación"}
                            </label>
                            <textarea
                                ref={textareaRef}
                                value={manualNotes}
                                onChange={(e) => setManualNotes(e.target.value)}
                                disabled={!canEdit}
                                className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-600 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-900/50"
                                placeholder={
                                    observations.length > 0
                                        ? "Las opciones seleccionadas se añadirán aquí..."
                                        : "Ej: Sin cebolla, bien cocido, sin sal..."
                                }
                            />
                            {!canEdit && (
                                <p className="text-[10px] italic text-slate-400 dark:text-slate-500">
                                    Las notas no se pueden editar para este producto
                                </p>
                            )}
                        </div>

                        {/* Teclado Virtual */}
                        {canEdit && (
                            <div className="mt-2 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Teclado Táctil
                                    </label>
                                    <button 
                                        onClick={() => { setManualNotes(""); setLocalSelected(new Set()); }}
                                        className="text-[10px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-600"
                                    >
                                        Limpiar Todo
                                    </button>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-900/30">
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
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 border-t border-slate-100 p-6 dark:border-slate-800">
                    <button
                        onClick={handleCancel}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!canEdit}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black uppercase tracking-widest text-white transition-all shadow-lg ${
                            !canEdit 
                            ? "bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none" 
                            : "bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-indigo-600/30 active:translate-y-0"
                        }`}
                    >
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalObservation;
