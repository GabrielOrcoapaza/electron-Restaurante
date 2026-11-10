import { useEffect, useRef, useState } from "react";
import { isElectronRenderer } from "../utils/electronPrint";

type MandatoryUpdatePhase =
    | "notice"
    | "downloading"
    | "ready"
    | "error";

type MandatoryUpdatePayload = {
    phase?: string;
    version?: string;
    currentVersion?: string;
    percent?: number;
    message?: string;
};

const MANDATORY_MESSAGE =
    "Hay una nueva versión de SumApp disponible que es obligatoria, luego no quiero quejas por que no funciona el sistema.";

function getIpcRenderer():
    | {
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
          ) => Promise<
              | { ok?: boolean; message?: string }
              | MandatoryUpdatePayload
              | null
          >;
      }
    | undefined {
    if (!isElectronRenderer()) return undefined;
    const nodeRequire = (
        window as unknown as { require?: (id: string) => unknown }
    ).require;
    if (typeof nodeRequire !== "function") return undefined;
    const electron = nodeRequire("electron") as {
        ipcRenderer?: ReturnType<typeof getIpcRenderer>;
    };
    return electron.ipcRenderer;
}

const MandatoryUpdateOverlay = () => {
    const [visible, setVisible] = useState(false);
    const [phase, setPhase] = useState<MandatoryUpdatePhase>("notice");
    const [latestVersion, setLatestVersion] = useState<string | null>(null);
    const [currentVersion, setCurrentVersion] = useState<string | null>(null);
    const [percent, setPercent] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const autoInstallStarted = useRef(false);

    const applyStatusPayload = (payload: MandatoryUpdatePayload) => {
        if (payload.phase === "idle") {
            setVisible(false);
            setErrorMessage(null);
            setBusy(false);
            autoInstallStarted.current = false;
            return;
        }
        if (payload.phase === "error") {
            setVisible(true);
            setPhase("error");
            setBusy(false);
            setErrorMessage(
                payload.message?.trim() ||
                    "No se pudo descargar la actualización.",
            );
        } else if (
            payload.phase === "notice" ||
            payload.phase === "downloading" ||
            payload.phase === "ready"
        ) {
            setVisible(true);
            setPhase(payload.phase);
            if (payload.phase === "downloading") {
                setBusy(true);
            } else {
                setBusy(false);
            }
            if (payload.phase === "ready") {
                setErrorMessage(null);
            }
        }
        if (payload.version) setLatestVersion(payload.version);
        if (payload.currentVersion) {
            setCurrentVersion(payload.currentVersion);
        }
        if (typeof payload.percent === "number") {
            setPercent(
                Math.max(0, Math.min(100, Math.round(payload.percent))),
            );
        }
    };

    useEffect(() => {
        const ipc = getIpcRenderer();
        if (!ipc) return;

        void (async () => {
            try {
                const cached = await ipc.invoke("mandatory-update-sync");
                if (cached && typeof cached === "object" && "phase" in cached) {
                    applyStatusPayload(cached as MandatoryUpdatePayload);
                }
            } catch {
                /* no empaquetado o IPC aún no registrado */
            }
        })();

        const onStatus = (_event: unknown, payload: MandatoryUpdatePayload) => {
            applyStatusPayload(payload);
        };

        ipc.on("mandatory-update-status", onStatus);
        return () => {
            ipc.removeListener("mandatory-update-status", onStatus);
        };
    }, []);

    const invokeInstall = async () => {
        const ipc = getIpcRenderer();
        if (!ipc) return;
        setBusy(true);
        try {
            await ipc.invoke("mandatory-update-install");
        } catch {
            setBusy(false);
        }
    };

    useEffect(() => {
        if (phase !== "ready" || autoInstallStarted.current) return;
        autoInstallStarted.current = true;
        void invokeInstall();
    }, [phase]);

    const handleActualizar = async () => {
        const ipc = getIpcRenderer();
        if (!ipc) return;

        if (phase === "ready") {
            await invokeInstall();
            return;
        }

        setBusy(true);
        setPhase("downloading");
        setPercent(0);
        setErrorMessage(null);
        try {
            const result = await ipc.invoke("mandatory-update-continue");
            if (!result?.ok && result?.message) {
                setPhase("error");
                setErrorMessage(result.message);
                setBusy(false);
            }
        } catch (err: unknown) {
            setPhase("error");
            setErrorMessage(
                err instanceof Error
                    ? err.message
                    : "Error al iniciar la descarga.",
            );
            setBusy(false);
        }
    };

    if (!visible) return null;

    const showProgress =
        phase === "downloading" || phase === "ready" || percent > 0;
    const progressWidth =
        phase === "ready" ? 100 : phase === "downloading" ? percent || 4 : 0;
    const showActualizarButton = phase === "error" || phase === "ready";
    const buttonLabel =
        phase === "ready"
            ? busy
                ? "Instalando…"
                : "Actualizar"
            : busy
              ? "Preparando…"
              : "Actualizar";

    return (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#808080] p-4"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mandatory-update-heading"
        >
            <div
                className="w-full max-w-[520px] overflow-hidden rounded-sm border border-[#707070] bg-[#f0f0f0] shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
                onKeyDown={(e) => {
                    if (e.key === "Escape") e.preventDefault();
                }}
            >
                <div className="flex items-center gap-2 border-b border-[#a0a0a0] bg-gradient-to-b from-[#fafafa] to-[#ececec] px-3 py-1.5">
                    <img
                        src="./SumApp.ico"
                        alt=""
                        className="h-4 w-4"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                                "none";
                        }}
                    />
                    <span className="text-[13px] text-[#1a1a1a]">Update</span>
                </div>

                <div className="px-6 pb-4 pt-5">
                    <h2
                        id="mandatory-update-heading"
                        className="text-[22px] font-normal text-[#1a1a1a]"
                    >
                        Update Available
                    </h2>

                    <p className="mt-3 text-[13px] leading-snug text-[#1a1a1a]">
                        Current version:{" "}
                        <span className="font-semibold">
                            {currentVersion ?? "—"}
                        </span>
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-[#1a1a1a]">
                        Latest version:{" "}
                        <span className="font-semibold">
                            {latestVersion ?? "—"}
                        </span>
                    </p>

                    <div className="mt-4 rounded-sm border border-amber-300/80 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-950">
                        {MANDATORY_MESSAGE}
                    </div>

                    {phase === "error" && errorMessage ? (
                        <p className="mt-3 text-[12px] text-red-800">
                            {errorMessage}
                        </p>
                    ) : null}

                    <div
                        className="mt-5 h-[22px] overflow-hidden rounded-sm border border-[#bdbdbd] bg-[#e8e8e8]"
                        aria-hidden={!showProgress}
                    >
                        {showProgress ? (
                            <div
                                className="h-full bg-[#0078d4] transition-all duration-300"
                                style={{ width: `${progressWidth}%` }}
                            />
                        ) : null}
                    </div>

                    {phase === "notice" || phase === "downloading" ? (
                        <p className="mt-2 text-center text-[11px] text-[#444]">
                            {phase === "notice"
                                ? "Preparando actualización obligatoria…"
                                : percent > 0
                                  ? `${percent}% completado`
                                  : "Iniciando descarga…"}
                        </p>
                    ) : null}

                    {phase === "ready" && !busy ? (
                        <p className="mt-2 text-[12px] text-[#333]">
                            Descarga completa. SumApp se reiniciará para
                            instalar la actualización.
                        </p>
                    ) : null}
                </div>

                {showActualizarButton ? (
                    <div className="flex justify-end gap-2 border-t border-[#c8c8c8] bg-[#f0f0f0] px-4 py-3">
                        <button
                            type="button"
                            onClick={() => void handleActualizar()}
                            disabled={busy}
                            className="min-w-[100px] rounded-sm border border-[#707070] bg-gradient-to-b from-[#fdfdfd] to-[#e5e5e5] px-5 py-1.5 text-[13px] text-[#1a1a1a] shadow-sm enabled:hover:from-white enabled:hover:to-[#ececec] disabled:cursor-default disabled:opacity-60"
                        >
                            {buttonLabel}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default MandatoryUpdateOverlay;
