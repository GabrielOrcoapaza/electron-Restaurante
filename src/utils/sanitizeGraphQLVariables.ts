/** Convierte IDs vacíos o inválidos en `undefined` (no enviar a GraphQL). */
export function normalizeGraphQLId(value: unknown): string | undefined {
	if (value == null) return undefined;
	const s = String(value).trim();
	if (s === "") return undefined;
	return s;
}

/** Omite `""` en claves tipo ID GraphQL (no aplica a deviceId/MAC). */
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
		if (
			typeof value === "string" &&
			value === "" &&
			isGraphQLIdVariableKey(key)
		) {
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

function isGraphQLIdVariableKey(key: string): boolean {
	if (/^deviceId$/i.test(key)) return false;
	return /^(id|.*Id|.*_id)$/i.test(key);
}
