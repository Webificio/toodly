/**
 * Durata stimata: conversioni e testo leggibile.
 * Il valore si salva in minuti; il campo lo mostra in ore con la mezz'ora come .5.
 * Convenzione lavorativa: 1 giorno = 8 h, 1 settimana = 5 giorni, 1 mese = 20 giorni.
 */
export const DEFAULT_DURATION_MIN = 30;
export const STEP_MIN = 30;
export const MAX_DURATION_H = 2000;
export const DAY_MIN = 8 * 60;
export const WEEK_MIN = 5 * DAY_MIN;
export const MONTH_MIN = 20 * DAY_MIN;

/** Interpreta il testo digitato (ore; punto o virgola). Restituisce i minuti normalizzati, null se vuoto, undefined se non valido. */
export function parseHours(text: string): number | null | undefined {
	const s = text.trim().replace(/\s*h$/i, '').replace(',', '.');
	if (s === '') return null;
	if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return undefined;
	const h = Number(s);
	if (!Number.isFinite(h)) return undefined;
	return normalizeMinutes(h * 60);
}

/** Arrotonda alla mezz'ora più vicina, minimo 30 minuti, massimo MAX_DURATION_H. */
export function normalizeMinutes(min: number): number {
	const steps = Math.round(min / STEP_MIN);
	return Math.min(MAX_DURATION_H * 60, Math.max(1, steps) * STEP_MIN);
}

/** Minuti → testo del campo: «1.5», «8», «0.25» (fino a 2 decimali, senza zeri inutili). Il separatore decimale segue il locale. */
export function formatHours(min: number, decimal = '.'): string {
	return String(Math.round((min / 60) * 100) / 100).replace('.', decimal);
}

export interface DurationParts {
	months: number;
	weeks: number;
	days: number;
	hours: number;
	minutes: number;
}

/** Scompone i minuti dall'unità più grande alla più piccola. */
export function splitDuration(min: number): DurationParts {
	let r = Math.max(0, Math.round(min));
	const months = Math.floor(r / MONTH_MIN); r -= months * MONTH_MIN;
	const weeks = Math.floor(r / WEEK_MIN); r -= weeks * WEEK_MIN;
	const days = Math.floor(r / DAY_MIN); r -= days * DAY_MIN;
	const hours = Math.floor(r / 60);
	return { months, weeks, days, hours, minutes: r - hours * 60 };
}

export type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * Testo leggibile, localizzato: «30 min», «1 h 30 min», «1 giorno», «1 mese, 1 giorno e 4 h 30 min».
 * `tr` è la funzione di traduzione, `loc` il locale BCP-47 (regole dei plurali e congiunzione dell'elenco).
 */
export function describeDuration(min: number, tr: Translate, loc: string): string {
	const p = splitDuration(min);
	let plural: (n: number) => boolean;
	try {
		const pr = new Intl.PluralRules(loc);
		plural = (n) => pr.select(n) !== 'one';
	} catch {
		plural = (n) => n !== 1;
	}
	const unit = (n: number, one: string, many: string) => tr(plural(n) ? many : one, { n });
	const parts: string[] = [];
	if (p.months) parts.push(unit(p.months, '{n} mese', '{n} mesi'));
	if (p.weeks) parts.push(unit(p.weeks, '{n} settimana', '{n} settimane'));
	if (p.days) parts.push(unit(p.days, '{n} giorno', '{n} giorni'));
	const time = [p.hours ? tr('{n} h', { n: p.hours }) : '', p.minutes ? tr('{n} min', { n: p.minutes }) : ''].filter(Boolean).join(' ');
	if (time) parts.push(time);
	if (!parts.length) return tr('{n} min', { n: 0 });
	try {
		return new Intl.ListFormat(loc, { style: 'long', type: 'conjunction' }).format(parts);
	} catch {
		return parts.join(', ');
	}
}
