import { useEffect, useState } from "react";
import { isElectronRenderer } from "../utils/electronPrint";

type MandatoryUpdatePhase =
    | "notice"
    | "downloading"
    | "ready"
    | "error";

type MandatoryUpdatePayload = {
    phase?: string;
    version?: string;
    percent?: number;
    message?: string;
};

const DIALOG_TITLE = "Actualización obligatoria";

function buildDownloadMessage(version: string | null, percent: number): string {
    const versionLabel = version ? `Versión ${version}. ` : "";
    const progress =
        percent > 0
            ? `Descargando… ${percent}% completado.`
            : "Iniciando descarga…";
    return `${versionLabel}${progress} Espere a que termine; luego podrá reiniciar SumApp para instalar.`;
}

function buildErrorMessage(errorMessage: string | null): string {
    const detail = errorMessage?.trim()
        ? ` Detalle: ${errorMessage.trim()}.`
        : "";
    return `No se pudo completar la descarga de la actualización obligatoria.${detail} Puede seguir con la versión actual; verifique su conexión e intente de nuevo al reiniciar SumApp.`;
}

const MandatoryUpdateOverlay = () => {
    const [visible, setVisible] = useState(false);
    const [phase, setPhase] = useState<MandatoryUpdatePhase>("notice");
    const [version, setVersion] = useState<string | null>(null);
    const [percent, setPercent] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [installing, setInstalling] = useState(false);
    const [continuing, setContinuing] = useState(false);

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
                invoke: (
                    channel: string,
                ) => Promise<{ ok?: boolean; message?: string }>;
            };
        };
        const ipc = electron.ipcRenderer;
        if (!ipc) return;

        const onStatus = (_event: unknown, payload: MandatoryUpdatePayload) => {
            if (payload.phase === "idle") {
                setVisible(false);
                setErrorMessage(null);
                setInstalling(false);
                setContinuing(false);
                return;
            }
            if (payload.phase === "error") {
                setVisible(true);
                setPhase("error");
                setContinuing(false);
                setErrorMessage(
                    payload.message?.trim() ||
                        "No se pudo descargar la actualización.",
                );
                return;
            }
            if (
                payload.phase === "notice" ||
                payload.phase === "downloading" ||
                payload.phase === "ready"
            ) {
                setVisible(true);
                setPhase(payload.phase);
                setErrorMessage(null);
                if (payload.phase === "downloading") {
                    setContinuing(false);
                }
            }
            if (payload.version) setVersion(payload.version);
            if (typeof payload.percent === "number") {
                setPercent(
                    Math.max(0, Math.min(100, Math.round(payload.percent))),
                );
            }
        };

        ipc.on("mandatory-update-status", onStatus);
        return () => {
            ipc.removeListener("mandatory-update-status", onStatus);
        };
    }, []);

    const handleEntendido = async () => {
        const nodeRequire = (
            window as unknown as { require?: (id: string) => unknown }
        ).require;
        if (typeof nodeRequire !== "function") return;
        const electron = nodeRequire("electron") as {
            ipcRenderer?: {
                invoke: (
                    channel: string,
                ) => Promise<{ ok?: boolean; message?: string }>;
            };
        };
        const ipc = electron.ipcRenderer;
        if (!ipc) return;
        setContinuing(true);
        setPhase("downloading");
        setPercent(0);
        try {
            const result = await ipc.invoke("mandatory-update-continue");
            if (!result?.ok && result?.message) {
                setPhase("error");
                setErrorMessage(result.message);
                setContinuing(false);
            }
        } catch (err: unknown) {
            setPhase("error");
            setErrorMessage(
                err instanceof Error
                    ? err.message
                    : "Error al iniciar la descarga.",
            );
            setContinuing(false);
        }
    };

    const handleRestart = async () => {
        const nodeRequire = (
            window as unknown as { require?: (id: string) => unknown }
        ).require;
        if (typeof nodeRequire !== "function") return;
        const electron = nodeRequire("electron") as {
            ipcRenderer?: {
                invoke: (channel: string) => Promise<{ ok?: boolean }>;
            };
        };
        const ipc = electron.ipcRenderer;
        if (!ipc) return;
        setInstalling(true);
        try {
            await ipc.invoke("mandatory-update-install");
        } catch {
            setInstalling(false);
        }
    };

    const handleDismissError = async () => {
        setVisible(false);
        const nodeRequire = (
            window as unknown as { require?: (id: string) => unknown }
        ).require;
        if (typeof nodeRequire !== "function") return;
        const electron = nodeRequire("electron") as {
            ipcRenderer?: {
                invoke: (channel: string) => Promise<unknown>;
            };
        };
        const ipc = electron.ipcRenderer;
        if (ipc) {
            try {
                await ipc.invoke("mandatory-update-dismiss-error");
            } catch {
                /* ignore */
            }
        }
    };

    if (!visible) return null;

    const blockSystem =
        phase === "notice" || phase === "downloading" || phase === "ready";

    return (
        <div
            className={`fixed inset-0 z-[99999] flex items-center justify-center p-6 ${
                blockSystem
                    ? "bg-slate-950"
                    : "bg-slate-950/75 backdrop-blur-sm"
            }`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mandatory-update-title"
        >
            <div className="w-full max-w-lg rounded-lg border border-slate-300 bg-white p-6 text-left shadow-2xl dark:border-slate-600 dark:bg-slate-900">
                <h2
                    id="mandatory-update-title"
                    className="text-base font-semibold text-slate-900 dark:text-white"
                >
                    {DIALOG_TITLE}
                </h2>

                {phase === "notice" && (
                    <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                        <p>
                            Hay una nueva versión de SumApp disponible que es
                            obligatoria, luego no quiero quejas por que no
                            funciona el sistema.
                        </p>
                        <p className="text-slate-600 dark:text-slate-300">
                            {version
                                ? `Versión ${version}. `
                                : ""}
                            Pulse «Entendido» para iniciar la descarga. Debe
                            instalar la actualización para continuar.
                        </p>
                        <button
                            type="button"
                            onClick={() => void handleEntendido()}
                            disabled={continuing}
                            className="mt-2 w-full rounded-md border border-indigo-500 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100 disabled:opacity-60 dark:bg-indigo-950 dark:text-indigo-100 dark:hover:bg-indigo-900"
                        >
                            {continuing ? "Preparando…" : "Entendido"}
                        </button>
                    </div>
                )}

                {phase === "downloading" && (
                    <div className="mt-4 space-y-4 text-sm text-slate-700 dark:text-slate-200">
                        <p>{buildDownloadMessage(version, percent)}</p>
                        <div
                            className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
                            aria-hidden
                        >
                            <div
                                className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                                style={{ width: `${percent || 8}%` }}
                            />
                        </div>
                    </div>
                )}

                {phase === "ready" && (
                    <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                        <p>
                            La actualización está lista. SumApp se reiniciará
                            ahora para instalarla.
                        </p>
                        {version ? (
                            <p className="text-slate-600 dark:text-slate-300">
                                Versión {version}
                            </p>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => void handleRestart()}
                            disabled={installing}
                            className="mt-2 w-full rounded-md border border-indigo-500 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100 disabled:opacity-60 dark:bg-indigo-950 dark:text-indigo-100 dark:hover:bg-indigo-900"
                        >
                            {installing ? "Reiniciando…" : "Reiniciar ahora"}
                        </button>
                    </div>
                )}

                {phase === "error" && (
                    <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                        <p>{buildErrorMessage(errorMessage)}</p>
                        <button
                            type="button"
                            onClick={() => void handleDismissError()}
                            className="mt-2 w-full rounded-md border border-slate-400 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-500 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                            Continuar con la versión actual
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MandatoryUpdateOverlay;
