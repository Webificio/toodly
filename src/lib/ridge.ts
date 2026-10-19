/**
 * Logica pura della vista «Ridge»: il carico di lavoro giorno per giorno come un profilo di montagne.
 * Il carico di un giorno è la somma delle durate stimate dei task che scadono quel giorno.
 */
import type { Task } from './types';
import { addDays, diffDays, toMinutes } from './dates';

export const DEFAULT_MIN = 30;
export const DEFAULT_CAP_H = 6;

/** Durata di un task: quella stimata, altrimenti l'intervallo orario se c'è, altrimenti 30 minuti. */
export function durationOf(t: Pick<Task, 'duration_min' | 'start_time' | 'end_time'>): number {
	if (t.duration_min != null && t.duration_min > 0) return t.duration_min;
	const a = toMinutes(t.start_time), b = toMinutes(t.end_time);
	if (a !== null && b !== null && b > a) return b - a;
	return DEFAULT_MIN;
}

/** «1h 30m», «45m», «2h». */
export function fmtDur(min: number): string {
	const h = Math.floor(min / 60), m = Math.round(min % 60);
	return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

export interface RidgeDay {
	/** data ISO, oppure 'late' per la colonna degli scaduti */
	key: string;
	minutes: number;
	tasks: Task[];
	over: boolean;
	weekend: boolean;
}
export interface RidgeModel {
	days: RidgeDay[];
	/** minuti massimi tra i giorni */
	peak: number;
	undated: number;
	taskOrder: string[];
	byTask: Map<string, string>;
}
export interface RidgeInput {
	tasks: Task[];
	today: string;
	/** primo giorno mostrato, in giorni da oggi */
	offset: number;
	span: number;
	capMin: number;
	showDone: boolean;
}

export function buildRidge(inp: RidgeInput): RidgeModel {
	const tasks = inp.tasks.filter((t) => inp.showDone || !t.completed);
	const start = addDays(inp.today, inp.offset);
	const days: RidgeDay[] = Array.from({ length: inp.span }, (_, i) => {
		const key = addDays(start, i);
		const dow = new Date(key + 'T00:00:00').getDay();
		return { key, minutes: 0, tasks: [], over: false, weekend: dow === 0 || dow === 6 };
	});
	const late: RidgeDay = { key: 'late', minutes: 0, tasks: [], over: false, weekend: false };
	let undated = 0;
	for (const t of tasks) {
		if (!t.due_date) {
			undated++;
			continue;
		}
		if (diffDays(t.due_date, inp.today) < 0 && !t.completed) {
			late.tasks.push(t);
			continue;
		}
		const i = diffDays(t.due_date, start);
		if (i >= 0 && i < inp.span) days[i].tasks.push(t);
	}
	const all = late.tasks.length ? [late, ...days] : days;
	for (const d of all) {
		d.tasks.sort((a, b) => b.priority - a.priority || a.sort - b.sort);
		d.minutes = d.tasks.reduce((s, t) => s + (t.completed ? 0 : durationOf(t)), 0);
		d.over = d.minutes > inp.capMin;
	}
	const byTask = new Map<string, string>();
	for (const d of all) for (const t of d.tasks) byTask.set(t.id, d.key);
	return { days: all, peak: Math.max(0, ...all.map((d) => d.minutes)), undated, taskOrder: all.flatMap((d) => d.tasks.map((t) => t.id)), byTask };
}

/** Punti del profilo: una cima per giorno e un avvallamento tra l'uno e l'altro (come un crinale). */
export function ridgePoints(minutes: number[], x0: number, step: number, base: number, k: number): [number, number][] {
	const n = minutes.length;
	const pts: [number, number][] = [[x0, base]];
	for (let i = 0; i < n; i++) {
		const h = minutes[i] / 60;
		const nxt = i + 1 < n ? minutes[i + 1] / 60 : 0;
		pts.push([x0 + i * step + step / 2, base - h * k]);
		pts.push([x0 + (i + 1) * step, base - Math.min(h, nxt) * k * 0.4]);
	}
	pts[pts.length - 1] = [x0 + n * step, base];
	return pts;
}
