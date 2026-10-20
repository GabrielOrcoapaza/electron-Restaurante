import React, { useMemo, useState } from "react";

interface SuggestionInputProps {
    value: string;
    onChange: (value: string) => void;
    /** Lista de sugerencias; el usuario puede elegir una o escribir texto libre. */
    suggestions: string[];
    placeholder?: string;
    /** Clases Tailwind del <input> (para adaptarse al contexto del modal). */
    inputClassName?: string;
}

/**
 * Input de texto libre con autocomplete: al enfocar o escribir muestra las
 * sugerencias que coinciden (insensible a mayúsculas); Enter o click eligen la
 * resaltada. El campo NUNCA obliga a elegir una sugerencia.
 */
const SuggestionInput: React.FC<SuggestionInputProps> = ({
    value,
    onChange,
    suggestions,
    placeholder,
    inputClassName,
}) => {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const filtered = useMemo(() => {
        const term = value.trim().toLowerCase();
        if (!term) return suggestions;
        return suggestions.filter((s) => s.toLowerCase().includes(term));
    }, [suggestions, value]);

    const select = (s: string) => {
        onChange(s);
        setOpen(false);
        setActiveIndex(-1);
    };

    return (
        <div className="relative">
            <input
                type="text"
                value={value}
                placeholder={placeholder}
                onChange={(e) => {
                    onChange(e.target.value);
                    setOpen(true);
                    setActiveIndex(-1);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                    setOpen(false);
                    setActiveIndex(-1);
                }}
                onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setOpen(true);
                        setActiveIndex((i) =>
                            Math.min(i + 1, filtered.length - 1),
                        );
                    } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveIndex((i) => Math.max(i - 1, -1));
                    } else if (
                        e.key === "Enter" &&
                        open &&
                        activeIndex >= 0 &&
                        filtered[activeIndex]
                    ) {
                        e.preventDefault();
                        select(filtered[activeIndex]);
                    } else if (e.key === "Escape") {
                        setOpen(false);
                    }
                }}
                className={inputClassName}
            />
            {open && filtered.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
                    {filtered.map((s, i) => (
                        <button
                            key={s}
                            type="button"
                            // onMouseDown con preventDefault: sin esto, el blur
                            // del input cierra el dropdown antes del onClick.
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => select(s)}
                            onMouseEnter={() => setActiveIndex(i)}
                            className={`block w-full px-3 py-2 text-left text-xs font-bold ${
                                i === activeIndex
                                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                                    : "text-slate-700 dark:text-slate-200"
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SuggestionInput;
