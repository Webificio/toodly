import { locale, t } from './i18n.svelte';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseISO(s: string): Date {
	const [y, m, d] = s.split('-').map(Number);
	return new Date(y, (m || 1) - 1, d || 1);
}
export function todayISO(): string {
	return toISO(new Date());
}
export function addDays(iso: string, n: number): string {
	const d = parseISO(iso);
	d.setDate(d.getDate() + n);
	return toISO(d);
}
export function addMonths(iso: string, n: number): string {
	const d = parseISO(iso);
	const day = d.getDate();
	d.setDate(1);
	d.setMonth(d.getMonth() + n);
	const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
	d.setDate(Math.min(day, last));
	return toISO(d);
}
/** Lunedì della settimana che contiene `iso`. */
export function startOfWeek(iso: string): string {
	const d = parseISO(iso);
	const dow = (d.getDay() + 6) % 7;
	d.setDate(d.getDate() - dow);
	return toISO(d);
}
export function startOfMonth(iso: string): string {
	const d = parseISO(iso);
	d.setDate(1);
	return toISO(d);
}
/** Giorni della settimana (0 = domenica … 6 = sabato) di una ripetizione `dow:1,4`. */
export function recurrenceDays(rec: string): number[] {
	if (!rec.startsWith('dow:')) return [];
	return [...new Set(rec.slice(4).split(',').filter((x) => x.trim() !== '').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
}
export function nextOccurrence(iso: string, rec: string): string {
	if (rec.startsWith('dow:')) {
		const days = recurrenceDays(rec);
		if (!days.length) return iso;
		for (let i = 1; i <= 7; i++) {
			const c = addDays(iso, i);
			if (days.includes(parseISO(c).getDay())) return c;
		}
		return iso;
	}
	switch (rec) {
		case 'weekdays': {
			let c = addDays(iso, 1);
			while ([0, 6].includes(parseISO(c).getDay())) c = addDays(c, 1);
			return c;
		}
		case 'monthend': {
			const x = parseISO(iso);
			return toISO(new Date(x.getFullYear(), x.getMonth() + 2, 0));
		}
		case 'daily':
			return addDays(iso, 1);
		case 'weekly':
			return addDays(iso, 7);
		case 'monthly':
			return addMonths(iso, 1);
		case 'yearly':
			return addMonths(iso, 12);
		default:
			return iso;
	}
}
/** Data di inizio effettiva di un task: `start_date`, altrimenti il giorno di creazione. */
export function taskStart(t: { start_date: string | null; created_at: string }): string {
	return t.start_date ?? toISO(new Date(t.created_at));
}
export function diffDays(a: string, b: string): number {
	return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000);
}

export function toMinutes(t: string | null): number | null {
	if (!t) return null;
	const [h, m] = t.split(':').map(Number);
	return h * 60 + (m || 0);
}
export function fromMinutes(min: number): string {
	const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
	return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(kind: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
	const loc = locale();
	const k = loc + kind;
	let f = cache.get(k);
	if (!f) cache.set(k, (f = new Intl.DateTimeFormat(loc, opts)));
	return f;
}

export const formatDayShort = (iso: string) => fmt('day', { day: 'numeric', month: 'short' }).format(parseISO(iso));
export const formatDayLong = (iso: string) => fmt('dayLong', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseISO(iso));
export const formatMonth = (iso: string) => fmt('month', { month: 'long', year: 'numeric' }).format(parseISO(iso));
export const formatWeekday = (iso: string) => fmt('wd', { weekday: 'short' }).format(parseISO(iso));
export const formatStamp = (isoTs: string) =>
	fmt('stamp', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(isoTs));

/** Etichetta relativa: Oggi, Domani, Ieri, "12 ott". */
export function relativeDay(iso: string): string {
	const d = diffDays(iso, todayISO());
	if (d === 0) return t('Oggi');
	if (d === 1) return t('Domani');
	if (d === -1) return t('Ieri');
	return formatDayShort(iso);
}

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
