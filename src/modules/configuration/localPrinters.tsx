import React, { useCallback, useEffect, useState } from "react";
import { useResponsive } from "../../hooks/useResponsive";
import { fetchSystemPrinters, type SystemPrinterInfo } from "../../utils/systemPrinters";
import {
	getIntegratedPrinterCashUiEnabled,
	setIntegratedPrinterCashUiEnabled,
} from "../../utils/localPrinterPreference";

function optionsHint(opts?: Record<string, string>): string {
	if (!opts || Object.keys(opts).length === 0) return "—";
	const entries = Object.entries(opts);
	if (entries.length <= 3) {
		return entries.map(([k, v]) => `${k}: ${v}`).join("; ");
	}
	return `${entries.length} opciones (ver detalle en sistema)`;
}

const LocalPrinters: React.FC = () => {
	const { breakpoint } = useResponsive();
	const compact = breakpoint === "xs" || breakpoint === "sm";
	const [printers, setPrinters] = useState<SystemPrinterInfo[]>([]);
	const [defaultPrinterName, setDefaultPrinterName] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
	const [integratedPrinterCashUi, setIntegratedPrinterCashUi] = useState(() =>
		getIntegratedPrinterCashUiEnabled(),
	);

	useEffect(() => {
		const sync = () => setIntegratedPrinterCashUi(getIntegratedPrinterCashUiEnabled());
		window.addEventListener("sumapp-integrated-printer-cash-ui", sync);
		window.addEventListener("storage", sync);
		return () => {
			window.removeEventListener("sumapp-integrated-printer-cash-ui", sync);
			window.removeEventListener("storage", sync);
		};
	}, []);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetchSystemPrinters();
			if (res.ok) {
				setPrinters(res.printers);
				setDefaultPrinterName(res.defaultPrinterName ?? null);
				setLastLoadedAt(new Date());
				if (res.printers.length === 0) {
					setError("No se encontraron impresoras en el sistema.");
				}
			} else {
				setPrinters([]);
				setDefaultPrinterName(null);
				setError(res.message || "No se pudo obtener la lista de impresoras.");
			}
		} catch (e: unknown) {
			setPrinters([]);
			setDefaultPrinterName(null);
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	}, []);

	return (
		<div style={{ padding: "0.5rem 0", maxWidth: "960px" }}>
			<div style={{ marginBottom: "1rem" }}>
				<h2 style={{ margin: "0 0 0.35rem 0", fontSize: "1.25rem", color: "#0f172a" }}>
					Impresoras de este equipo
				</h2>
				<p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem", lineHeight: 1.5 }}>
					Listado de impresoras instaladas en el sistema operativo de <strong>esta PC</strong> (SumApp
					Electron). Es independiente de las impresoras registradas en el servidor o la Raspberry.
				</p>
			</div>

			<label
				style={{
					display: "flex",
					alignItems: "flex-start",
					gap: "0.65rem",
					padding: "0.85rem 1rem",
					marginBottom: "1rem",
					borderRadius: "10px",
					border: "1px solid #cbd5e1",
					background: "#f8fafc",
					cursor: "pointer",
					maxWidth: "720px",
				}}
			>
				<input
					type="checkbox"
					checked={integratedPrinterCashUi}
					onChange={(e) => {
						const on = e.target.checked;
						setIntegratedPrinterCashUi(on);
						setIntegratedPrinterCashUiEnabled(on);
					}}
					style={{ marginTop: "0.2rem", width: "1.1rem", height: "1.1rem", flexShrink: 0 }}
				/>
				<span style={{ fontSize: "0.9rem", color: "#334155", lineHeight: 1.45 }}>
					<strong>Impresora integrada en esta caja (USB)</strong>
					<br />
					<span style={{ color: "#64748b", fontSize: "0.85rem" }}>
						Coincide con <strong>DevicePrintConfig.use_integrated_printer</strong> en el admin de Django
						(mismo <code style={{ fontSize: "0.8rem" }}>device_id</code> que la MAC de esta PC). Puedes
						cambiarlo aquí o en el servidor; al iniciar sesión se sincroniza desde el API si está
						disponible.
					</span>
				</span>
			</label>

			<div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
				<button
					type="button"
					onClick={() => void load()}
					disabled={loading}
					style={{
						padding: "0.5rem 1.25rem",
						borderRadius: "8px",
						border: "none",
						background: loading ? "#94a3b8" : "#0369a1",
						color: "white",
						fontWeight: 600,
						cursor: loading ? "not-allowed" : "pointer",
						fontSize: "0.9rem",
					}}
				>
					{loading ? "Detectando…" : "Detectar impresoras"}
				</button>
				{lastLoadedAt && (
					<span style={{ fontSize: "0.8rem", color: "#64748b" }}>
						Última lectura: {lastLoadedAt.toLocaleString("es-PE")}
					</span>
				)}
			</div>

			{error && (
				<div
					style={{
						padding: "0.75rem 1rem",
						borderRadius: "8px",
						background: "#fef2f2",
						color: "#b91c1c",
						fontSize: "0.875rem",
						marginBottom: "1rem",
					}}
				>
					{error}
				</div>
			)}

			{defaultPrinterName && (
				<div
					style={{
						padding: "0.85rem 1rem",
						borderRadius: "10px",
						background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
						border: "1px solid #6ee7b7",
						marginBottom: "1rem",
						fontSize: "0.9rem",
						color: "#065f46",
					}}
				>
					<strong>Impresora predeterminada del sistema:</strong>{" "}
					<span style={{ fontWeight: 600 }}>{defaultPrinterName}</span>
					<div style={{ fontSize: "0.8rem", marginTop: "0.35rem", color: "#047857", opacity: 0.95 }}>
						Es la que usa Windows/macOS/Linux por defecto al imprimir. En la tabla, la fila coincidente
						aparece marcada.
					</div>
				</div>
			)}

			{printers.length > 0 && !defaultPrinterName && lastLoadedAt && !loading && (
				<div
					style={{
						padding: "0.75rem 1rem",
						borderRadius: "10px",
						background: "#fffbeb",
						border: "1px solid #fcd34d",
						marginBottom: "1rem",
						fontSize: "0.85rem",
						color: "#92400e",
					}}
				>
					No se pudo obtener el nombre de la impresora predeterminada (consulta a Windows falló o está
					restringida). Cierre SumApp por completo, ejecute{" "}
					<code style={{ fontSize: "0.8rem" }}>npm run build-electron</code> y abra de nuevo la app. Si usa
					Windows 11, compruebe que PowerShell no esté deshabilitado.
				</div>
			)}

			{printers.length > 0 &&
				(compact ? (
					<div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
						{printers.map((p, i) => (
							<div
								key={`${p.name}-${i}`}
								style={{
									border: p.isSystemDefault ? "2px solid #059669" : "1px solid #e2e8f0",
									borderRadius: "10px",
									padding: "0.85rem 1rem",
									background: p.isSystemDefault ? "#f0fdf4" : "#fff",
									fontSize: "0.875rem",
									color: "#334155",
								}}
							>
								{p.isSystemDefault && (
									<div
										style={{
											display: "inline-block",
											marginBottom: "0.4rem",
											padding: "0.15rem 0.5rem",
											borderRadius: "6px",
											background: "#059669",
											color: "white",
											fontSize: "0.7rem",
											fontWeight: 700,
										}}
									>
										Predeterminada
									</div>
								)}
								<div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>{p.displayName || p.name || "—"}</div>
								<div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.25rem" }}>
									<strong>SO:</strong> {p.name || "—"}
								</div>
								<div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.25rem" }}>
									<strong>Descripción:</strong> {p.description || "—"}
								</div>
								<div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{optionsHint(p.options)}</div>
							</div>
						))}
					</div>
				) : (
					<div
						style={{
							border: "1px solid #e2e8f0",
							borderRadius: "10px",
							overflow: "hidden",
							background: "#fff",
						}}
					>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "90px 1.1fr 1.1fr 1fr 1fr",
								gap: "0.5rem",
								padding: "0.65rem 1rem",
								background: "#f8fafc",
								fontWeight: 700,
								fontSize: "0.75rem",
								color: "#475569",
								textTransform: "uppercase",
								letterSpacing: "0.02em",
							}}
						>
							<span>Defecto</span>
							<span>Nombre (SO)</span>
							<span>Nombre visible</span>
							<span>Descripción</span>
							<span>Opciones</span>
						</div>
						{printers.map((p, i) => (
							<div
								key={`${p.name}-${i}`}
								style={{
									display: "grid",
									gridTemplateColumns: "90px 1.1fr 1.1fr 1fr 1fr",
									gap: "0.5rem",
									padding: "0.65rem 1rem",
									borderTop: "1px solid #f1f5f9",
									fontSize: "0.875rem",
									color: "#334155",
									alignItems: "start",
									background: p.isSystemDefault ? "#f0fdf4" : undefined,
								}}
							>
								<span>
									{p.isSystemDefault ? (
										<span
											style={{
												display: "inline-block",
												padding: "0.2rem 0.45rem",
												borderRadius: "6px",
												background: "#059669",
												color: "white",
												fontSize: "0.65rem",
												fontWeight: 700,
											}}
										>
											Sí
										</span>
									) : (
										<span style={{ color: "#cbd5e1" }}>—</span>
									)}
								</span>
								<span style={{ wordBreak: "break-word" }}>{p.name || "—"}</span>
								<span style={{ wordBreak: "break-word" }}>{p.displayName || "—"}</span>
								<span style={{ wordBreak: "break-word", color: "#64748b" }}>{p.description || "—"}</span>
								<span style={{ wordBreak: "break-word", fontSize: "0.8rem", color: "#64748b" }}>
									{optionsHint(p.options)}
								</span>
							</div>
						))}
					</div>
				))}

			{!loading && printers.length === 0 && !error && (
				<p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
					Pulse <strong>Detectar impresoras</strong> para cargar la lista.
				</p>
			)}
		</div>
	);
};

export default LocalPrinters;
