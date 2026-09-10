/**
 * Fecha y hora en calendario local del dispositivo (no UTC).
 * Evita el desfase típico de `toISOString().split('T')[0]` alrededor de medianoche.
 */

export function formatLocalDateYYYYMMDD(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** HH:MM:SS hora local */
export function formatLocalTimeHHMMSS(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${min}:${s}`;
}

/** Instantáneo en ISO (UTC) para paymentDate; el instante es correcto y al mostrar en local coincide con el momento del pago. */
export function formatInstantISO(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Interpreta fecha/hora de emisión guardadas como calendario local (YYYY-MM-DD + HH:MM o HH:MM:SS).
 */
export function parseLocalEmissionDateTime(dateYYYYMMDD: string, timeStr: string): Date {
  const t = timeStr.trim();
  const isoTime = t.split(':').length === 2 ? `${t}:00` : t;
  return new Date(`${dateYYYYMMDD}T${isoTime}`);
}

/** Offset local tipo +05:00 / -05:00 para GraphQL DateTime (evita datetimes naive en backend). */
export function formatLocalTimezoneOffset(date: Date = new Date()): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const mins = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${mins}`;
}

/** Inicio del día local con offset (p. ej. 2026-09-01T00:00:00-05:00). */
export function toLocalRangeStartISO(dateYYYYMMDD: string): string {
  const anchor = parseLocalEmissionDateTime(dateYYYYMMDD, '00:00:00');
  return `${dateYYYYMMDD}T00:00:00${formatLocalTimezoneOffset(anchor)}`;
}

/** Fin del día local con offset (p. ej. 2026-09-10T23:59:59.999-05:00). */
export function toLocalRangeEndISO(dateYYYYMMDD: string): string {
  const anchor = parseLocalEmissionDateTime(dateYYYYMMDD, '23:59:59');
  return `${dateYYYYMMDD}T23:59:59.999${formatLocalTimezoneOffset(anchor)}`;
}
