/**
 * Convierte un monto a texto en español (Perú): "TREINTA Y SEIS CON 0/100 SOLES".
 */

const UNITS = [
	"",
	"UNO",
	"DOS",
	"TRES",
	"CUATRO",
	"CINCO",
	"SEIS",
	"SIETE",
	"OCHO",
	"NUEVE",
	"DIEZ",
	"ONCE",
	"DOCE",
	"TRECE",
	"CATORCE",
	"QUINCE",
	"DIECISEIS",
	"DIECISIETE",
	"DIECIOCHO",
	"DIECINUEVE",
];

const TENS = [
	"",
	"",
	"VEINTE",
	"TREINTA",
	"CUARENTA",
	"CINCUENTA",
	"SESENTA",
	"SETENTA",
	"OCHENTA",
	"NOVENTA",
];

const HUNDREDS = [
	"",
	"CIENTO",
	"DOSCIENTOS",
	"TRESCIENTOS",
	"CUATROCIENTOS",
	"QUINIENTOS",
	"SEISCIENTOS",
	"SETECIENTOS",
	"OCHOCIENTOS",
	"NOVECIENTOS",
];

function under100(n: number): string {
	if (n === 0) return "";
	if (n < 20) return UNITS[n];
	if (n < 30) return n === 20 ? "VEINTE" : `VEINTI${UNITS[n - 20].toLowerCase()}`.toUpperCase();
	const tens = Math.floor(n / 10);
	const units = n % 10;
	return units === 0 ? TENS[tens] : `${TENS[tens]} Y ${UNITS[units]}`;
}

function under1000(n: number): string {
	if (n === 0) return "";
	if (n === 100) return "CIEN";
	const hundreds = Math.floor(n / 100);
	const rest = n % 100;
	const h = hundreds > 0 ? HUNDREDS[hundreds] : "";
	const r = under100(rest);
	return [h, r].filter(Boolean).join(" ");
}

function chunkToWords(n: number): string {
	if (n === 0) return "";
	if (n === 1) return "UN";
	if (n < 1000) return under1000(n);
	const thousands = Math.floor(n / 1000);
	const rest = n % 1000;
	const t =
		thousands === 1 ? "MIL" : `${chunkToWords(thousands)} MIL`;
	const r = under1000(rest);
	return [t, r].filter(Boolean).join(" ");
}

function integerToWords(n: number): string {
	if (n === 0) return "CERO";
	if (n < 0) return `MENOS ${integerToWords(-n)}`;

	const millions = Math.floor(n / 1_000_000);
	const thousands = Math.floor((n % 1_000_000) / 1000);
	const rest = n % 1000;

	const parts: string[] = [];
	if (millions > 0) {
		parts.push(
			millions === 1 ? "UN MILLON" : `${chunkToWords(millions)} MILLONES`,
		);
	}
	if (thousands > 0) {
		parts.push(
			thousands === 1 ? "MIL" : `${chunkToWords(thousands)} MIL`,
		);
	}
	if (rest > 0 || parts.length === 0) {
		parts.push(under1000(rest) || "CERO");
	}
	return parts.join(" ");
}

export function amountToWordsPe(amount: number): string {
	const safe = Math.abs(Number(amount) || 0);
	const whole = Math.floor(safe);
	const cents = Math.round((safe - whole) * 100);
	return `${integerToWords(whole)} CON ${cents}/100 SOLES`;
}
