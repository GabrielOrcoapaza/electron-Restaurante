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
