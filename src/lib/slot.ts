/**
 * Logica pura della vista «Slot»: la giornata a incastro. I task con data e ora sono blocchi sulla linea del tempo,
 * quelli senza ora aspettano nel vassoio e si trascinano (o si infilano) negli spazi liberi, secondo la loro durata stimata.
 */
import type { Task } from './types';
import { diffDays, fromMinutes, toMinutes } from './dates';
import { durationOf } from './ridge';

/** Fascia di lavoro in cui si cercano gli spazi liberi (08:00–19:00). */
export const WORK_START = 8 * 60;
export const WORK_END = 19 * 60;
export const SNAP = 15;
export const MIN_BLOCK = 15;

export const snap = (m: number) => Math.round(m / SNAP) * SNAP;
export const clampStart = (start: number, len: number) => Math.max(0, Math.min(start, 24 * 60 - len));

export interface SlotBlock {
	task: Task;
	start: number;
	end: number;
	/** colonna e numero di colonne quando i blocchi si sovrappongono */
	col: number;
	cols: number;
}
export interface SlotFree {
	start: number;
	end: number;
}
export interface SlotDay {
	blocks: SlotBlock[];
	free: SlotFree[];
	tray: { due: Task[]; late: Task[]; none: Task[] };
	planned: number;
	freeMin: number;
	taskOrder: string[];
	/** estremi visibili della linea del tempo, in minuti (multipli di 60) */
	from: number;
	to: number;
}

/** Inizio e fine di un task con orario: l'intervallo se c'è, altrimenti l'inizio più la durata stimata. */
export function blockRange(t: Task): { start: number; end: number } | null {
	const a = toMinutes(t.start_time);
	if (a === null) return null;
	const b = toMinutes(t.end_time);
	const end = b !== null && b > a ? b : Math.min(a + durationOf({ ...t, start_time: null, end_time: null }), 24 * 60);
	return { start: a, end };
}

/** Affianca i blocchi che si sovrappongono (assegnazione greedy a colonne). */
export function layoutColumns(items: { start: number; end: number }[]): { col: number; cols: number }[] {
	const order = items.map((_, i) => i).sort((a, b) => items[a].start - items[b].start || items[a].end - items[b].end);
	const out = items.map(() => ({ col: 0, cols: 1 }));
	let group: number[] = [];
	let groupEnd = -1;
	const closeGroup = () => {
		const n = Math.max(1, ...group.map((i) => out[i].col + 1));
		for (const i of group) out[i].cols = n;
		group = [];
	};
	const colEnds: number[] = [];
	for (const i of order) {
		if (items[i].start >= groupEnd && group.length) {
			closeGroup();
			colEnds.length = 0;
		}
		let c = colEnds.findIndex((e) => e <= items[i].start);
		if (c < 0) c = colEnds.length;
		colEnds[c] = items[i].end;
		out[i].col = c;
		group.push(i);
		groupEnd = Math.max(groupEnd, items[i].end);
	}
	if (group.length) closeGroup();
	return out;
}

/** Spazi liberi nella fascia di lavoro, da 15 minuti in su. */
export function freeSlots(busy: { start: number; end: number }[], from = WORK_START, to = WORK_END): SlotFree[] {
	const sorted = [...busy].sort((a, b) => a.start - b.start);
	const out: SlotFree[] = [];
	let cur = from;
	for (const b of sorted) {
		if (b.start > cur) out.push({ start: cur, end: Math.min(b.start, to) });
		cur = Math.max(cur, b.end);
		if (cur >= to) break;
	}
	if (cur < to) out.push({ start: cur, end: to });
	return out.filter((f) => f.end - f.start >= SNAP);
}

/** Primo spazio libero in cui entra una durata (restituisce l'inizio) o null. */
export function firstFit(free: SlotFree[], len: number, notBefore = 0): number | null {
	for (const f of free) {
		const s = Math.max(f.start, notBefore);
		const st = Math.ceil(s / SNAP) * SNAP;
		if (st + len <= f.end) return st;
	}
	return null;
}

export function buildSlotDay(tasks: Task[], day: string, today: string, showDone: boolean): SlotDay {
	const open = tasks.filter((t) => showDone || !t.completed);
	const timed = open.filter((t) => t.due_date === day && t.start_time).map((t) => ({ t, r: blockRange(t)! }));
	const lay = layoutColumns(timed.map((x) => x.r));
	const blocks: SlotBlock[] = timed.map((x, i) => ({ task: x.t, start: x.r.start, end: x.r.end, ...lay[i] }));
	blocks.sort((a, b) => a.start - b.start || a.task.sort - b.task.sort);
	const byPrio = (a: Task, b: Task) => b.priority - a.priority || a.sort - b.sort;
	const pending = open.filter((t) => !t.completed);
	const due = pending.filter((t) => t.due_date === day && !t.start_time).sort(byPrio);
	const late = pending.filter((t) => t.due_date && t.due_date < today && t.due_date !== day).sort(byPrio);
	const none = pending.filter((t) => !t.due_date).sort(byPrio);
	const busy = blocks.map((b) => ({ start: b.start, end: b.end }));
	const free = freeSlots(busy);
	const lo = Math.min(7 * 60, ...blocks.map((b) => Math.floor(b.start / 60) * 60));
	const hi = Math.max(21 * 60, ...blocks.map((b) => Math.ceil(b.end / 60) * 60));
	return {
		blocks,
		free,
		tray: { due, late, none },
		planned: blocks.filter((b) => !b.task.completed).reduce((s, b) => s + (b.end - b.start), 0),
		freeMin: free.reduce((s, f) => s + (f.end - f.start), 0),
		taskOrder: [...blocks.map((b) => b.task.id), ...due.map((t) => t.id), ...late.map((t) => t.id), ...none.map((t) => t.id)],
		from: lo,
		to: hi
	};
}

/** Patch per mettere un task a una certa ora del giorno, mantenendo (o fissando) la sua lunghezza. */
export function placePatch(task: Task, day: string, start: number, len: number): Partial<Task> {
	const s = clampStart(start, len);
	return { due_date: day, start_time: fromMinutes(s), end_time: fromMinutes(Math.min(s + len, 24 * 60 - 1)) };
}
export const unplacePatch = (): Partial<Task> => ({ start_time: null, end_time: null });
export const isPast = (day: string, today: string) => diffDays(day, today) < 0;
