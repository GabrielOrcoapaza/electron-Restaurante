import { useEffect, useState } from "react";
import { isElectronRenderer } from "../utils/electronPrint";

type MandatoryUpdatePhase = "downloading" | "ready" | "error";

type MandatoryUpdatePayload = {
    phase?: string;
    version?: string;
    percent?: number;
    message?: string;
};

const MandatoryUpdateOverlay = () => {
    const [visible, setVisible] = useState(false);
    const [phase, setPhase] = useState<MandatoryUpdatePhase>("downloading");
    const [version, setVersion] = useState<string | null>(null);
    const [percent, setPercent] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!isElectronRenderer()) return;

        const nodeRequire = (
            window as unknown as { require?: (id: string) => unknown }
        ).require;
        if (typeof nodeRequire !== "function") return;

        const electron = nodeRequire("electron") as {
            ipcRenderer?: {
                on: (
                    channel: string,
                    listener: (
                        event: unknown,
                        payload: MandatoryUpdatePayload,
                    ) => void,
                ) => void;
                removeListener: (
                    channel: string,
                    listener: (
                        event: unknown,
                        payload: MandatoryUpdatePayload,
                    ) => void,
                ) => void;
            };
        };
        const ipc = electron.ipcRenderer;
        if (!ipc) return;

        const onStatus = (_event: unknown, payload: MandatoryUpdatePayload) => {
            if (payload.phase === "idle") {
                setVisible(false);
                setErrorMessage(null);
                return;
            }
            if (payload.phase === "error") {
                setVisible(true);
                setPhase("error");
                setErrorMessage(
                    payload.message?.trim() ||
                        "No se pudo descargar la actualización.",
                );
                return;
            }
            if (payload.phase === "downloading" || payload.phase === "ready") {
                setVisible(true);
                setPhase(payload.phase);
                setErrorMessage(null);
            }
            if (payload.version) setVersion(payload.version);
            if (typeof payload.percent === "number") {
                setPercent(Math.max(0, Math.min(100, Math.round(payload.percent))));
            }
        };

        ipc.on("mandatory-update-status", onStatus);
        return () => {
            ipc.removeListener("mandatory-update-status", onStatus);
        };
    }, []);

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 p-6 backdrop-blur-sm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mandatory-update-title"
        >
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
                <h2
                    id="mandatory-update-title"
                    className="text-lg font-bold text-white"
                >
                    {phase === "error"
                        ? "Error al descargar"
                        : "Actualización obligatoria"}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                    {phase === "error"
                        ? "No se pudo completar la descarga de la actualización obligatoria."
                        : phase === "ready"
                          ? "La actualización está lista. SumApp se reiniciará para instalarla."
                          : "Hay una nueva versión disponible. Debe actualizar para continuar."}
                </p>
                {phase === "error" && errorMessage && (
                    <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                        {errorMessage}
                    </p>
                )}
                {phase === "error" && (
                    <p className="mt-3 text-xs text-slate-400">
                        Puede continuar con la versión actual. Intente de nuevo al
                        reiniciar SumApp.
                    </p>
                )}
                {version && (
                    <p className="mt-1 text-xs font-semibold text-indigo-300">
                        Versión {version}
                    </p>
                )}
                {phase === "downloading" && (
                    <div className="mt-5">
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                            <div
                                className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                                style={{ width: `${percent || 8}%` }}
                            />
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                            Descargando… {percent > 0 ? `${percent}%` : ""}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MandatoryUpdateOverlay;
