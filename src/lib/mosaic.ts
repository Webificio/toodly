/**
 * Logica pura della vista «Mosaic»: una griglia a tessere (treemap) in cui la superficie di ogni task
 * dipende dalla priorità, dalla vicinanza della scadenza o da entrambe.
 */
import type { Task } from './types';
import { diffDays } from './dates';

export type MosaicBy = 'priority' | 'deadline' | 'both' | 'amount';
export const MOSAIC_MODES: MosaicBy[] = ['priority', 'deadline', 'both'];
/** Con «Economia» attiva si aggiunge la dimensione per importo. */
export const MOSAIC_MODES_ECONOMY: MosaicBy[] = [...MOSAIC_MODES, 'amount'];

/** Peso di un task: più grande = più importante e/o più vicino alla scadenza (scaduti pesano di più). */
export function weight(t: Task, today: string, by: MosaicBy): number {
	const pr = (1 + t.priority) ** 1.5;
	const d = t.due_date ? diffDays(t.due_date, today) : null;
	const urg = d === null ? 0.12 : (3 / (3 + Math.max(d, 0))) * (d < 0 ? 1.7 : 1);
	const w = by === 'priority' ? pr : by === 'deadline' ? 1 + urg * 6 : by === 'amount' ? 1 : pr * urg + 0.35;
	return t.completed ? w * 0.5 : w;
}

export interface Tile {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Treemap «squarified» (Bruls et al.): tessere quasi quadrate, ordinate dalla più grande. */
export function squarify(items: { id: string; v: number }[], x: number, y: number, w: number, h: number): Tile[] {
	const list = [...items].filter((i) => i.v > 0).sort((a, b) => b.v - a.v || a.id.localeCompare(b.id));
	const total = list.reduce((s, i) => s + i.v, 0);
	if (!list.length || w <= 0 || h <= 0) return [];
	const scale = (w * h) / total;
	const areas = list.map((i) => ({ id: i.id, a: i.v * scale }));
	const out: Tile[] = [];
	let rx = x, ry = y, rw = w, rh = h;
	const worst = (row: { a: number }[], side: number) => {
		const s = row.reduce((t, i) => t + i.a, 0);
		const mx = Math.max(...row.map((i) => i.a)), mn = Math.min(...row.map((i) => i.a));
		return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
	};
	let i = 0;
	while (i < areas.length) {
		const side = Math.min(rw, rh);
		const row = [areas[i]];
		let j = i + 1;
		while (j < areas.length && worst([...row, areas[j]], side) <= worst(row, side)) row.push(areas[j++]);
		const s = row.reduce((t, r) => t + r.a, 0);
		if (rw >= rh) {
			const cw = s / rh;
			let cy = ry;
			for (const r of row) { const ch = r.a / cw; out.push({ id: r.id, x: rx, y: cy, w: cw, h: ch }); cy += ch; }
			rx += cw; rw -= cw;
		} else {
			const ch = s / rw;
			let cx = rx;
			for (const r of row) { const cw = r.a / ch; out.push({ id: r.id, x: cx, y: ry, w: cw, h: ch }); cx += cw; }
			ry += ch; rh -= ch;
		}
		i = j;
	}
	return out;
}

/**
 * `amountOf` (solo per `by === 'amount'`) dà l'importo di un task in centesimi: la superficie è proporzionale
 * all'importo, con una base minima (2% del massimo) perché i task senza importi restino visibili.
 */
export function buildMosaic(tasks: Task[], today: string, by: MosaicBy, showDone: boolean, w: number, h: number, amountOf?: (t: Task) => number) {
	const vis = tasks.filter((t) => showDone || !t.completed);
	const amounts = by === 'amount' && amountOf ? vis.map((t) => Math.max(0, amountOf(t))) : null;
	const base = amounts ? Math.max(1, Math.max(0, ...amounts) * 0.02) : 0;
	const tiles = squarify(vis.map((t, i) => ({ id: t.id, v: amounts ? (amounts[i] + base) * (t.completed ? 0.5 : 1) : weight(t, today, by) })), 0, 0, w, h);
	const byId = new Map(vis.map((t) => [t.id, t]));
	return tiles.map((t) => ({ ...t, task: byId.get(t.id)! }));
}
