/** Esportazione dei task con scadenza in formato iCalendar (.ics, RFC 5545). Funzioni pure: niente Tauri. */
import { addDays, recurrenceDays } from './dates';
import type { Task } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const dateStr = (iso: string) => iso.replace(/-/g, '');
const dateTimeStr = (iso: string, hhmm: string) => `${dateStr(iso)}T${hhmm.replace(':', '')}00`;

/** Testo: escape di `\`, `;`, `,` e a capo. */
export const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Righe di max 75 byte (UTF-8), con continuazione «CRLF + spazio». */
export function icsFold(line: string): string {
	const enc = new TextEncoder();
	if (enc.encode(line).length <= 75) return line;
	const out: string[] = [];
	let cur = '';
	let bytes = 0;
	let limit = 75;
	for (const ch of line) {
		const b = enc.encode(ch).length;
		if (bytes + b > limit) {
			out.push(cur);
			cur = '';
			bytes = 0;
			limit = 74; // lo spazio iniziale della continuazione conta
		}
		cur += ch;
		bytes += b;
	}
	if (cur) out.push(cur);
	return out.join('\r\n ');
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Regola RRULE equivalente alla ripetizione del task (null se non si ripete). */
export function icsRrule(t: Pick<Task, 'recurrence' | 'recur_until' | 'start_time'>): string | null {
	let r: string;
	switch (t.recurrence) {
		case 'daily': r = 'FREQ=DAILY'; break;
		case 'weekly': r = 'FREQ=WEEKLY'; break;
		case 'monthly': r = 'FREQ=MONTHLY'; break;
		case 'yearly': r = 'FREQ=YEARLY'; break;
		case 'weekdays': r = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'; break;
		case 'monthend': r = 'FREQ=MONTHLY;BYMONTHDAY=-1'; break;
		default: {
			const days = recurrenceDays(t.recurrence);
			if (!days.length) return null;
			r = 'FREQ=WEEKLY;BYDAY=' + days.map((d) => DAYS[d]).join(',');
		}
	}
	if (t.recur_until) r += ';UNTIL=' + dateStr(t.recur_until) + (t.start_time ? 'T235959' : '');
	return r;
}

function descriptionOf(t: Task): string {
	const plain = t.description.replace(/[#*_`>~\[\]]/g, '').replace(/\n{2,}/g, '\n').trim();
	return plain.length > 500 ? plain.slice(0, 500) + '…' : plain;
}

export interface IcsOptions {
	prodId?: string;
	/** ora (HH:MM) usata per i promemoria dei task senza orario */
	allDayTime?: string;
	includeCompleted?: boolean;
	now?: Date;
}

/** Costruisce il calendario: un VEVENT per ogni task con scadenza. */
export function buildIcs(tasks: Task[], opts: IcsOptions = {}): string {
	const now = opts.now ?? new Date();
	const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
	const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${opts.prodId ?? '-//toodly//toodly//IT'}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
	let n = 0;
	for (const t of tasks) {
		if (!t.due_date || (t.completed && !opts.includeCompleted)) continue;
		n++;
		const ev: string[] = ['BEGIN:VEVENT', `UID:${t.id}@toodly`, `DTSTAMP:${stamp}`];
		if (t.start_time) {
			const end = t.end_time && t.end_time > t.start_time ? t.end_time : null;
			ev.push(`DTSTART:${dateTimeStr(t.due_date, t.start_time)}`);
			if (end) ev.push(`DTEND:${dateTimeStr(t.due_date, end)}`);
			else ev.push(`DURATION:PT30M`);
		} else {
			// evento di un giorno sulla scadenza (l'inizio del task è solo un dato di pianificazione)
			ev.push(`DTSTART;VALUE=DATE:${dateStr(t.due_date)}`, `DTEND;VALUE=DATE:${dateStr(addDays(t.due_date, 1))}`);
		}
		ev.push(`SUMMARY:${icsEscape((t.completed ? '✓ ' : '') + t.title)}`);
		const desc = descriptionOf(t);
		if (desc) ev.push(`DESCRIPTION:${icsEscape(desc)}`);
		if (t.tags.length) ev.push(`CATEGORIES:${t.tags.map(icsEscape).join(',')}`);
		if (t.priority) ev.push(`PRIORITY:${t.priority === 3 ? 1 : t.priority === 2 ? 5 : 9}`);
		const rr = icsRrule(t);
		if (rr) ev.push(`RRULE:${rr}`);
		if (t.remind_min != null) {
			const [h, m] = (opts.allDayTime ?? '09:00').split(':').map(Number);
			// con orario: prima dell'inizio; senza orario: a partire da mezzanotte, spostato all'ora predefinita
			const trigger = t.start_time ? `-PT${t.remind_min}M` : `PT${Math.max(0, h * 60 + m - t.remind_min)}M`;
			ev.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(t.title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
		}
		ev.push('END:VEVENT');
		lines.push(...ev);
	}
	lines.push('END:VCALENDAR');
	if (!n) return '';
	return lines.map(icsFold).join('\r\n') + '\r\n';
}
