const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL || "";
const API_MEDIA_URL = GRAPHQL_URL
	? GRAPHQL_URL.replace("/graphql", "/media/")
	: "/media/";

/**
 * URL absoluta para imágenes en /media (paths relativos del backend).
 */
export function getFullImageUrl(
	path: string | null | undefined,
	origin?: string,
): string {
	if (!path) return "";
	if (path.startsWith("http") || path.startsWith("data:")) return path;

	const baseOrigin =
		origin ||
		(typeof window !== "undefined" ? window.location.origin : "");

	try {
		if (!path || path === "NULL" || path === "null") return "";

		if (path.startsWith("/media/")) {
			const base = API_MEDIA_URL.replace(/\/media\/?$/, "");
			const url = new URL(path, base || baseOrigin || "http://localhost");
			return url.toString();
		}

		const mediaBase = API_MEDIA_URL.startsWith("http")
			? API_MEDIA_URL
			: `${baseOrigin}${API_MEDIA_URL.startsWith("/") ? "" : "/"}${API_MEDIA_URL}`;

		const url = new URL(path, mediaBase || baseOrigin || "http://localhost");
		return url.toString();
	} catch (err) {
		console.warn("Error construyendo URL de imagen:", err, {
			path,
			API_MEDIA_URL,
		});
		return `${API_MEDIA_URL}${path}`.replace(/\/+/g, "/");
	}
}

/** True si el valor es una ruta/URL de archivo, no datos base64 embebidos. */
export function isLikelyImagePath(value: string): boolean {
	const t = value.trim();
	if (!t) return false;
	if (
		t.startsWith("http://") ||
		t.startsWith("https://") ||
		t.startsWith("/") ||
		t.startsWith("branches/") ||
		t.startsWith("companies/")
	) {
		return true;
	}
	if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(t)) return true;
	if (t.includes("/") && t.length < 200 && !t.startsWith("data:")) return true;
	return false;
}
