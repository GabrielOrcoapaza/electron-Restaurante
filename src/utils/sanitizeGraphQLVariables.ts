const ID_LIKE_KEY = /^(id|.*Id|.*_id)$/i;

/** Convierte IDs vacíos o inválidos en `undefined` (no enviar a GraphQL). */
export function normalizeGraphQLId(value: unknown): string | undefined {
	if (value == null) return undefined;
	const s = String(value).trim();
	if (s === "") return undefined;
	return s;
}

/** Reemplaza `""` por `null` en claves tipo ID dentro de variables GraphQL. */
export function sanitizeGraphQLVariables<T>(variables: T): T {
	if (variables == null) return variables;

	if (Array.isArray(variables)) {
		return variables.map((item) => sanitizeGraphQLVariables(item)) as T;
	}

	if (typeof variables !== "object") {
		return variables;
	}

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(
		variables as Record<string, unknown>,
	)) {
		if (typeof value === "string" && value === "" && ID_LIKE_KEY.test(key)) {
			// Omitir IDs vacíos: evita enviar null a campos ID! (p. ej. floorId).
			continue;
		}
		if (value != null && typeof value === "object") {
			result[key] = sanitizeGraphQLVariables(value);
			continue;
		}
		result[key] = value;
	}
	return result as T;
}
