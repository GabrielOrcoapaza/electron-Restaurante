/**
 * Texto del código QR SUNAT para comprobantes electrónicos (boleta/factura).
 * Formato: RUC|tipo|serie|número|IGV|total|fecha|tipo doc cliente|nro doc|hash|
 */

import type { CompanyData } from "../context/AuthContext";
import type { IssuedDocumentReportSource } from "./buildIssuedDocumentReportJson";
import { roundMoney2 } from "./taxAmounts";
import { isElectronicBillingDocumentCode } from "./issuedDocumentSunatUrls";

function readHashCode(doc: IssuedDocumentReportSource): string {
	const raw = doc as IssuedDocumentReportSource & Record<string, unknown>;
	const value =
		doc.hashCode ??
		raw.hash_code ??
		raw.qr_data ??
		raw.qrData ??
		"";
	return String(value).trim();
}

function receptorDocType(
	documentType?: string | null,
	documentNumber?: string | null,
): string {
	const t = String(documentType ?? "").trim().toUpperCase();
	const num = String(documentNumber ?? "").trim();
	if (t === "6" || t === "RUC") return "6";
	if (t === "1" || t === "DNI") return "1";
	if (!t && num.length === 11) return "6";
	if (!t && num.length === 8) return "1";
	return "1";
}

function receptorDocNumber(
	documentNumber?: string | null,
): string {
	const num = String(documentNumber ?? "").trim();
	if (num) return num;
	return "00000000";
}

/**
 * @returns Texto para qr_data o null si no hay datos suficientes.
 */
export function buildSunatQrData(
	doc: IssuedDocumentReportSource,
	companyData?: CompanyData | null,
): string | null {
	if (!isElectronicBillingDocumentCode(doc.document?.code)) {
		return null;
	}

	const hashRaw = readHashCode(doc);
	if (!hashRaw) return null;

	// El backend a veces guarda la cadena QR completa (con pipes).
	if (hashRaw.includes("|")) {
		return hashRaw;
	}

	const ruc = String(companyData?.company?.ruc ?? "")
		.replace(/\D/g, "")
		.trim();
	const docCode = String(doc.document?.code ?? "").padStart(2, "0");
	const serial = String(doc.serial ?? "").trim();
	const number = String(doc.number ?? "").trim();
	const emissionDate = String(doc.emissionDate ?? "").trim().slice(0, 10);

	if (!ruc || ruc.length !== 11 || !serial || !number || !emissionDate) {
		return hashRaw;
	}

	const igv = roundMoney2(doc.igvAmount).toFixed(2);
	const total = roundMoney2(doc.totalAmount).toFixed(2);
	const tipoReceptor = receptorDocType(
		doc.person?.documentType,
		doc.person?.documentNumber,
	);
	const nroReceptor = receptorDocNumber(
		doc.person?.documentType,
	);

	return `${ruc}|${docCode}|${serial}|${number}|${igv}|${total}|${emissionDate}|${tipoReceptor}|${nroReceptor}|${hashRaw}|`;
}
