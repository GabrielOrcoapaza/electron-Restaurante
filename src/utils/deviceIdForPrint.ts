/**
 * Identificador del equipo cliente (PC con SumApp) para impresión en backend.
 * DevicePrintConfig suele estar ligado a la MAC; priorizar getMacAddress() en Electron.
 */
export async function resolveClientDeviceIdForPrint(deps: {
	getMacAddress: () => Promise<string>;
	getDeviceId: () => string;
	logPrefix?: string;
}): Promise<string> {
	const prefix = deps.logPrefix ?? "[deviceId]";
	try {
		const id = await deps.getMacAddress();
		if (id?.trim()) {
			const trimmed = id.trim();
			console.log(
				`${prefix} device_id para backend:`,
				trimmed,
				trimmed.includes(":")
					? "(MAC de la PC ✓)"
					: "(id local de este equipo)",
			);
			return trimmed;
		}
	} catch (error) {
		console.error(`${prefix} Error al obtener MAC:`, error);
	}

	const fallback = deps.getDeviceId();
	console.warn(`${prefix} Fallback getDeviceId():`, fallback);
	return fallback;
}
