/**
 * URLs tuf4ctur4 para comprobante electrónico (PDF oficial, CDR, XML firmado).
 *
 * PDF:  https://ng.tuf4ctur4.net.pe/operations/print_invoice/{sunatOperationId}/
 *       El ID de la URL es el OperationId de tuf4ctur4 (IssuedDocument.sunat_operation_id),
 *       NO el id local del IssuedDocument en SumApp.
 * CDR/XML: preferir rutas guardadas en IssuedDocument (cdr_path, signed_xml_path);
 *          si no hay, construir por RUC + serie + número.
 */

import {
	invokeElectronDownloadRemoteFile,
	isElectronRenderer,
} from "./electronPrint";
import type { IssuedDocumentReportSource } from "./buildIssuedDocumentReportJson";
import type { CompanyData } from "../context/AuthContext";

const PRINT_INVOICE_BASE =
	import.meta.env.VITE_PRINT_INVOICE_BASE_URL?.trim() ||
	"https://ng.tuf4ctur4.net.pe";

const SUNAT_FILES_BASE =
	import.meta.env.VITE_SUNAT_FILES_BASE_URL?.trim() ||
	"https://tuf4ctur4.net.pe";

export type IssuedDocumentSunatSource = {
	id: string;
	serial: string;
	number: string | number;
	sunatOperationId?: string | number | null;
	cdrPath?: string | null;
	signedXmlPath?: string | null;
	xmlPath?: string | null;
	document: {
		code: string;
	};
};

export type IssuedDocumentSunatUrls = {
	printInvoiceUrl: string;
	/** OperationId tuf4ctur4 usado en print_invoice (sunat_operation_id). */
	printInvoiceOperationId: string;
	/** Id local IssuedDocument en SumApp (referencia). */
	issuedDocumentLocalId: string;
	cdrXmlUrl: string;
	signedXmlUrl: string;
	cdrFilename: string;
	signedXmlFilename: string;
	pdfFilename: string;
	fileBaseName: string;
	companyRuc: string;
	cdrDownloadCandidates: string[];
	signedXmlDownloadCandidates: string[];
};

export type IssuedDocumentSunatDownloadKind = "pdf" | "cdr" | "xml";

function normalizeRuc(ruc: string | null | undefined): string {
	return String(ruc || "").replace(/\D/g, "");
}

function normalizeSunatNumber(number: string | number | null | undefined): string {
	const raw = String(number ?? "").trim();
	if (!raw) return "0";
	const stripped = raw.replace(/^0+/, "");
	return stripped || "0";
}

function normalizeSunatSerial(serial: string | null | undefined): string {
	return String(serial || "").trim().toUpperCase();
}

function normalizeDocCode(code: string | null | undefined): string {
	const c = String(code || "").trim();
	return c.padStart(2, "0");
}

function readStoredPath(
	doc: IssuedDocumentSunatSource & Record<string, unknown>,
	camelKey: keyof IssuedDocumentSunatSource,
	snakeKey: string,
): string | null {
	const raw = doc as Record<string, unknown>;
	const value = doc[camelKey] ?? raw[snakeKey];
	return String(value ?? "").trim() || null;
}

function resolveStoredSunatUrl(storedPath: string | null | undefined): string | null {
	const p = String(storedPath || "").trim();
	if (!p) return null;
	if (p.startsWith("http://") || p.startsWith("https://")) return p;
	const base = SUNAT_FILES_BASE.replace(/\/+$/, "");
	if (p.startsWith("/")) return `${base}${p}`;
	return `${base}/${p}`;
}

export function isElectronicBillingDocumentCode(
	code: string | null | undefined,
): boolean {
	const c = String(code || "").trim();
	return c === "01" || c === "03";
}

function readSunatOperationId(
	doc: IssuedDocumentSunatSource,
): string | null {
	const raw = doc as Record<string, unknown>;
	const value = doc.sunatOperationId ?? raw.sunat_operation_id;
	const id = String(value ?? "").trim();
	if (!id || id === "0") return null;
	return id;
}

/**
 * ID para /operations/print_invoice/{id}/ en tuf4ctur4.
 * Factura/boleta: sunat_operation_id (OperationId de facturación electrónica).
 * Nota de venta u otros: id local del IssuedDocument como respaldo.
 */
export function resolvePrintInvoiceId(
	doc: IssuedDocumentSunatSource,
): string | null {
	if (isElectronicBillingDocumentCode(doc.document?.code)) {
		return readSunatOperationId(doc);
	}
	const localId = String(doc.id ?? "").trim();
	return localId || null;
}

export function resolveIssuedDocumentLocalId(
	doc: Pick<IssuedDocumentSunatSource, "id">,
): string | null {
	const id = String(doc.id ?? "").trim();
	return id || null;
}

/** Comprobante oficial disponible en tuf4ctur4. */
export function canOpenOfficialIssuedDocument(
	doc: IssuedDocumentSunatSource,
): boolean {
	if (isElectronicBillingDocumentCode(doc.document?.code)) {
		return Boolean(readSunatOperationId(doc));
	}
	return Boolean(resolveIssuedDocumentLocalId(doc));
}

export function buildPrintInvoiceUrl(
	doc: IssuedDocumentSunatSource,
): string | null {
	const printId = resolvePrintInvoiceId(doc);
	if (!printId) return null;
	const printBase = PRINT_INVOICE_BASE.replace(/\/+$/, "");
	return `${printBase}/operations/print_invoice/${printId}/`;
}

export function officialDocumentUnavailableMessage(
	doc: IssuedDocumentSunatSource,
): string {
	if (
		isElectronicBillingDocumentCode(doc.document?.code) &&
		!readSunatOperationId(doc)
	) {
		return "Este comprobante electrónico aún no tiene OperationId de facturación (sunatOperationId). Espere a que SUNAT lo procese o contacte soporte.";
	}
	return "No se pudo generar la URL del comprobante oficial.";
}

/** CDR / XML firmado: solo comprobantes electrónicos SUNAT (01 factura, 03 boleta). */
export function canDownloadSunatXmlFiles(
	doc: IssuedDocumentSunatSource,
	companyRuc: string | null | undefined,
): boolean {
	const ruc = normalizeRuc(companyRuc);
	if (ruc.length !== 11) return false;
	if (!isElectronicBillingDocumentCode(doc.document.code)) return false;
	if (!String(doc.serial || "").trim()) return false;
	if (doc.number == null || String(doc.number).trim() === "") return false;
	return true;
}

/** @deprecated Use canDownloadSunatXmlFiles */
export function canBuildIssuedDocumentSunatUrls(
	doc: IssuedDocumentSunatSource,
	companyRuc: string | null | undefined,
): boolean {
	return canDownloadSunatXmlFiles(doc, companyRuc);
}

function buildSunatFileBaseNameVariants(
	ruc: string,
	docCode: string,
	serial: string,
	rawNumber: string | number,
): string[] {
	const normalized = normalizeSunatNumber(rawNumber);
	const padded = normalized.padStart(8, "0");
	const variants = [`${ruc}-${docCode}-${serial}-${normalized}`];
	if (padded !== normalized) {
		variants.push(`${ruc}-${docCode}-${serial}-${padded}`);
	}
	return variants;
}

function buildFallbackXmlUrls(
	ruc: string,
	docCode: string,
	serial: string,
	rawNumber: string | number,
): Array<{ fileBaseName: string; cdrXmlUrl: string; signedXmlUrl: string }> {
	const baseRoot = SUNAT_FILES_BASE.replace(/\/+$/, "");
	return buildSunatFileBaseNameVariants(ruc, docCode, serial, rawNumber).map(
		(fileBaseName) => ({
			fileBaseName,
			cdrXmlUrl: `${baseRoot}/API_SUNAT/files/facturacion_electronica/CDR/${ruc}/R-${fileBaseName}.xml`,
			signedXmlUrl: `${baseRoot}/API_SUNAT/files/facturacion_electronica/FIRMA/${ruc}/${fileBaseName}.xml`,
		}),
	);
}

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const u of urls) {
		const value = String(u ?? "").trim();
		if (!value || seen.has(value)) continue;
		seen.add(value);
		out.push(value);
	}
	return out;
}

export function buildIssuedDocumentSunatUrls(
	doc: IssuedDocumentSunatSource,
	companyRuc: string | null | undefined,
): IssuedDocumentSunatUrls | null {
	if (!canDownloadSunatXmlFiles(doc, companyRuc)) return null;

	const ruc = normalizeRuc(companyRuc);
	const docCode = normalizeDocCode(doc.document.code);
	const serial = normalizeSunatSerial(doc.serial);
	const docRaw = doc as IssuedDocumentSunatSource & Record<string, unknown>;
	const printInvoiceOperationId = resolvePrintInvoiceId(doc);
	const printInvoiceUrl = printInvoiceOperationId
		? buildPrintInvoiceUrl(doc)
		: null;
	const issuedDocumentLocalId = resolveIssuedDocumentLocalId(doc) ?? "";
	const cdrFromDb = resolveStoredSunatUrl(
		readStoredPath(docRaw, "cdrPath", "cdr_path"),
	);
	const signedFromDb = resolveStoredSunatUrl(
		readStoredPath(docRaw, "signedXmlPath", "signed_xml_path"),
	);

	const fallbackVariants = buildFallbackXmlUrls(
		ruc,
		docCode,
		serial,
		doc.number,
	);
	const primary = fallbackVariants[0];
	if (!primary) return null;

	const cdrDownloadCandidates = uniqueUrls([
		cdrFromDb,
		...fallbackVariants.map((v) => v.cdrXmlUrl),
	]);
	const signedXmlDownloadCandidates = uniqueUrls([
		signedFromDb,
		...fallbackVariants.map((v) => v.signedXmlUrl),
	]);

	return {
		printInvoiceUrl: printInvoiceUrl ?? "",
		printInvoiceOperationId: printInvoiceOperationId ?? "",
		issuedDocumentLocalId,
		cdrXmlUrl: cdrDownloadCandidates[0] ?? primary.cdrXmlUrl,
		signedXmlUrl: signedXmlDownloadCandidates[0] ?? primary.signedXmlUrl,
		cdrFilename: `R-${primary.fileBaseName}.xml`,
		signedXmlFilename: `${primary.fileBaseName}.xml`,
		pdfFilename: `${primary.fileBaseName}.pdf`,
		fileBaseName: primary.fileBaseName,
		companyRuc: ruc,
		cdrDownloadCandidates,
		signedXmlDownloadCandidates,
	};
}

/**
 * Descarga el PDF oficial desde tuf4ctur4 (print_invoice/{sunatOperationId}/).
 * Formato = plantilla CPE del RUC en tuf4ct. Sin réplica HTML local.
 */
export async function downloadOfficialIssuedDocumentPdf(
	doc: IssuedDocumentSunatSource & IssuedDocumentReportSource,
	filename: string,
	_companyData?: CompanyData | null,
): Promise<{ ok: boolean; message?: string }> {
	const printInvoiceUrl = buildPrintInvoiceUrl(doc);

	if (!printInvoiceUrl) {
		return {
			ok: false,
			message: officialDocumentUnavailableMessage(doc),
		};
	}

	if (!isElectronRenderer()) {
		return {
			ok: false,
			message:
				"La descarga del PDF oficial solo funciona en SumApp escritorio (Windows).",
		};
	}

	try {
		const { invokeElectronDownloadOfficialDocumentPdf } = await import(
			"./electronPrint"
		);
		const result = await invokeElectronDownloadOfficialDocumentPdf(
			printInvoiceUrl,
			filename,
			null,
		);
		return {
			ok: result.ok,
			message:
				result.message ||
				(result.ok
					? "PDF oficial (tuf4ct) guardado en Descargas."
					: "No se pudo descargar el PDF oficial desde tuf4ctur4."),
		};
	} catch (error) {
		const msg =
			error instanceof Error
				? error.message
				: "Error al descargar el comprobante oficial.";
		return { ok: false, message: msg };
	}
}

/** @deprecated Usar downloadOfficialIssuedDocumentPdf */
export async function openOfficialIssuedDocument(
	doc: IssuedDocumentSunatSource,
): Promise<{ ok: boolean; message?: string }> {
	return downloadOfficialIssuedDocumentPdf(
		doc as IssuedDocumentSunatSource & IssuedDocumentReportSource,
		`${String(doc.serial || "doc")}-${String(doc.number || "")}.pdf`.replace(
			/[^\w.-]/g,
			"_",
		),
	);
}

export async function downloadIssuedDocumentSunatFile(
	urls: IssuedDocumentSunatUrls,
	kind: IssuedDocumentSunatDownloadKind,
): Promise<{ ok: boolean; message?: string }> {
	if (kind === "pdf") {
		if (!urls.printInvoiceUrl) {
			return {
				ok: false,
				message: "No hay URL del comprobante oficial.",
			};
		}
		if (!isElectronRenderer()) {
			return {
				ok: false,
				message:
					"La descarga del PDF oficial solo funciona en SumApp escritorio.",
			};
		}
		try {
			const { invokeElectronDownloadOfficialDocumentPdf } = await import(
				"./electronPrint"
			);
			const result = await invokeElectronDownloadOfficialDocumentPdf(
				urls.printInvoiceUrl,
				urls.pdfFilename,
				null,
			);
			return {
				ok: result.ok,
				message:
					result.message ||
					(result.ok
						? "PDF oficial (tuf4ct) guardado en Descargas."
						: "No se pudo descargar el PDF oficial desde tuf4ctur4."),
			};
		} catch (error) {
			const msg =
				error instanceof Error ? error.message : "Error al descargar PDF.";
			return { ok: false, message: msg };
		}
	}

	const urlCandidates =
		kind === "cdr"
			? urls.cdrDownloadCandidates
			: urls.signedXmlDownloadCandidates;

	if (!isElectronRenderer()) {
		const target = urlCandidates[0];
		if (!target) return { ok: false, message: "URL no disponible." };
		window.open(target, "_blank", "noopener,noreferrer");
		return { ok: true, message: "Archivo abierto en una pestaña nueva." };
	}

	let lastMessage = "No se pudo descargar el archivo.";
	for (let i = 0; i < urlCandidates.length; i += 1) {
		const candidate = urlCandidates[i];
		const variantFilename =
			kind === "cdr" ? urls.cdrFilename : urls.signedXmlFilename;
		try {
			const result = await invokeElectronDownloadRemoteFile(
				candidate,
				i === 0 ? variantFilename : `${i + 1}_${variantFilename}`,
			);
			if (result.ok) {
				return {
					ok: true,
					message:
						result.message || `Archivo guardado: ${variantFilename}`,
				};
			}
			lastMessage = result.message || lastMessage;
		} catch (error) {
			lastMessage =
				error instanceof Error ? error.message : lastMessage;
		}
	}

	return { ok: false, message: lastMessage };
}
