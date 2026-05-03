import React, { useCallback, useEffect, useState } from "react";
import { useResponsive } from "../../hooks/useResponsive";
import { fetchSystemPrinters, type SystemPrinterInfo } from "../../utils/systemPrinters";
import {
	getIntegratedPrinterCashUiEnabled,
	setIntegratedPrinterCashUiEnabled,
	getLocalTicketPrinterStorage,
	setLocalTicketPrinterStorage,
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
	const [selectedPrinterName, setSelectedPrinterName] = useState(() =>
		getLocalTicketPrinterStorage(),
	);

	useEffect(() => {
		const sync = () => {
			setIntegratedPrinterCashUi(getIntegratedPrinterCashUiEnabled());
			setSelectedPrinterName(getLocalTicketPrinterStorage());
		};
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

	// Cargar impresoras al montar
	useEffect(() => {
		load();
	}, [load]);

	return (
		<div style={{ padding: "0.5rem 0", maxWidth: "960px" }}>
			<div style={{ marginBottom: "1rem" }}>
				<h2 style={{ margin: "0 0 0.35rem 0", fontSize: "1.25rem", color: "#0f172a" }}>
					Impresoras de este equipo
				</h2>
				<p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem", lineHeight: 1.5 }}>
					Configura la impresora física conectada directamente a <strong>esta PC</strong> (vía USB o integrada).
				</p>
			</div>

			<div
				style={{
					padding: "1rem",
					marginBottom: "1.5rem",
					borderRadius: "12px",
					border: "1px solid #e2e8f0",
					background: "#ffffff",
					boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
				}}
			>
				<label
					style={{
						display: "flex",
						alignItems: "flex-start",
						gap: "0.65rem",
						marginBottom: integratedPrinterCashUi ? "1.25rem" : "0",
						cursor: "pointer",
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
						Activa esta opción si este equipo tiene una impresora térmica conectada por USB o integrada.
					</span>
				</span>
			</label>

			{integratedPrinterCashUi && (
				<div
					style={{
						padding: "0.85rem 1rem",
						borderRadius: "10px",
						background: "#eff6ff",
						border: "1px solid #bfdbfe",
						marginBottom: "1.5rem",
						fontSize: "0.85rem",
						color: "#1e40af",
						display: "flex",
						gap: "0.75rem",
						alignItems: "flex-start",
					}}
				>
					<span style={{ fontSize: "1.1rem", marginTop: "-0.1rem" }}>ℹ️</span>
					<div>
						<strong>Importante:</strong> Para que la impresión funcione, el administrador debe haber
						habilitado la opción <code>use_integrated_printer</code> en el servidor para este equipo (MAC)
						y para cada tipo de documento (Boleta, Factura, etc.). Si no está habilitado en el servidor, el
						ticket no se enviará a esta impresora.
					</div>
				</div>
			)}

			{integratedPrinterCashUi && (
				<div
					style={{
						paddingTop: "1rem",
							borderTop: "1px solid #f1f5f9",
							display: "flex",
							flexDirection: "column",
							gap: "0.75rem",
						}}
					>
						<label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>
							Seleccionar impresora para tickets:
						</label>
						<div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
							<select
								value={selectedPrinterName}
								onChange={(e) => {
									const name = e.target.value;
									setSelectedPrinterName(name);
									setLocalTicketPrinterStorage(name);
								}}
								disabled={loading}
								style={{
									flex: 1,
									padding: "0.6rem 0.75rem",
									borderRadius: "8px",
									border: "1px solid #cbd5e1",
									background: "#fff",
									fontSize: "0.9rem",
									color: "#1e293b",
									outline: "none",
									cursor: "pointer",
								}}
							>
								<option value="">— Usar predeterminada del sistema —</option>
								{printers.map((p, i) => (
									<option key={`${p.name}-${i}`} value={p.name}>
										{p.displayName || p.name} {p.isSystemDefault ? "(Predeterminada)" : ""}
									</option>
								))}
							</select>
							<button
								type="button"
								onClick={() => void load()}
								disabled={loading}
								title="Actualizar lista de impresoras"
								style={{
									padding: "0.6rem",
									borderRadius: "8px",
									border: "1px solid #e2e8f0",
									background: "#f8fafc",
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke={loading ? "#94a3b8" : "#475569"}
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									style={{ animation: loading ? "spin 1s linear infinite" : "none" }}
								>
									<path d="M23 4v6h-6"></path>
									<path d="M1 20v-6h6"></path>
									<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
								</svg>
							</button>
						</div>
						{!selectedPrinterName && defaultPrinterName && (
							<p style={{ margin: 0, fontSize: "0.8rem", color: "#059669" }}>
								Actualmente se usará: <strong>{defaultPrinterName}</strong>
							</p>
						)}
						{selectedPrinterName && !printers.find(p => p.name === selectedPrinterName) && !loading && (
							<p style={{ margin: 0, fontSize: "0.8rem", color: "#dc2626" }}>
								⚠️ La impresora seleccionada ("{selectedPrinterName}") no parece estar conectada.
							</p>
						)}
					</div>
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

			<style>{`
				@keyframes spin {
					from { transform: rotate(0deg); }
					to { transform: rotate(360deg); }
				}
			`}</style>

			{/* Listado detallado opcional o informativo */}
			<details style={{ marginTop: "2rem" }}>
				<summary style={{ fontSize: "0.85rem", color: "#64748b", cursor: "pointer", outline: "none" }}>
					Ver detalles técnicos de impresoras
				</summary>
				<div style={{ marginTop: "1rem" }}>
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
										<span style={{ wordBreak: "break-word" }}>{p.description || "—"}</span>
										<span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{optionsHint(p.options)}</span>
									</div>
								))}
							</div>
						))}
				</div>
			</details>
		</div>
	);
};

export default LocalPrinters;
