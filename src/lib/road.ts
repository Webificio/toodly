/**
 * Logica pura della vista «Road»: una strada in prospettiva che va verso l'orizzonte. Le corsie sono i gruppi radice,
 * la distanza è il tempo: i task di oggi sono in primo piano, quelli lontani sfumano verso l'orizzonte.
 */
import type { Group, Task } from './types';
import { diffDays } from './dates';
import { groupInfo } from './maps';

/** Orizzonti disponibili, in giorni. */
export const HORIZONS = [7, 14, 30, 90] as const;
export const CARD_H = 74;

export interface RoadLane {
	root: string;
	name: string;
	color: number;
	count: number;
}
export interface RoadItem {
	task: Task;
	lane: number;
	color: number;
	/** giorni dalla posizione della «telecamera» (negativo = alle spalle) */
	dd: number;
	/** scala di prospettiva */
	s: number;
	/** centro orizzontale e base della scheda, in px dello scenario */
	x: number;
	y: number;
	/** scaduto rispetto a oggi */
	over: boolean;
}
export interface RoadTick {
	d: number;
	y: number;
	s: number;
}
export interface RoadModel {
	lanes: RoadLane[];
	items: RoadItem[];
	/** senza data o oltre l'orizzonte */
	rail: { task: Task; color: number; why: 'none' | 'far' }[];
	ticks: RoadTick[];
	/** card dal più vicino al più lontano, poi il resto: ordine per le frecce su/giù */
	taskOrder: string[];
	byTask: Map<string, RoadItem>;
	hz: number;
	laneW: number;
	vpx: number;
	base: number;
}

export interface RoadInput {
	groups: Group[];
	tasks: Task[];
	showDone: boolean;
	today: string;
	/** giorni di avanzamento sulla strada (0 = oggi) */
	cam: number;
	horizon: number;
	ungroupedLabel: string;
	width: number;
	height: number;
}

export const persp = (dd: number, horizon: number) => 1 / (1 + Math.max(dd, 0) / (horizon / 1.75));

export function buildRoad(inp: RoadInput): RoadModel {
	const { width: W, height: H, horizon, cam } = inp;
	const tasks = inp.tasks.filter((t) => inp.showDone || !t.completed);
	const gi = groupInfo(inp.groups, inp.tasks, inp.ungroupedLabel);
	const used = new Set(tasks.map((t) => gi.rootOf(t)));
	const roots = gi.roots.filter((r) => used.has(r));
	const lanes: RoadLane[] = roots.map((r) => ({ root: r, name: gi.name(r), color: gi.color(r), count: tasks.filter((t) => gi.rootOf(t) === r).length }));
	const n = Math.max(lanes.length, 1);
	const laneW = Math.max(60, Math.min(170, (W - 60) / (n + 0.4)));
	const hz = Math.round(H * 0.3);
	const base = H - 4 - CARD_H * 1.0;
	const vpx = W / 2;
	const laneOf = new Map(roots.map((r, i) => [r, i]));

	const items: RoadItem[] = [];
	const rail: RoadModel['rail'] = [];
	for (const t of tasks) {
		const root = gi.rootOf(t);
		const color = gi.color(root);
		if (!t.due_date) {
			rail.push({ task: t, color, why: 'none' });
			continue;
		}
		const off = diffDays(t.due_date, inp.today);
		const dd = off - cam;
		if (dd > horizon) {
			rail.push({ task: t, color, why: 'far' });
			continue;
		}
		const behind = Math.min(-dd, 3);
		const s = dd >= 0 ? persp(dd, horizon) : 1 + behind * 0.04;
		const y = dd >= 0 ? hz + (base - hz) * s : Math.min(H - 4, base + behind * 30);
		const lane = laneOf.get(root) ?? 0;
		const x = vpx + (lane - (n - 1) / 2) * laneW * s;
		items.push({ task: t, lane, color, dd, s, x, y, over: off < 0 && !t.completed });
	}
	// dal lontano al vicino; nella stessa corsia le schede vicine si sfalsano verso l'orizzonte
	items.sort((a, b) => b.dd - a.dd || a.task.sort - b.task.sort);
	const placed = new Map<number, RoadItem[]>();
	for (const it of items) {
		const mine = placed.get(it.lane) ?? [];
		const step = CARD_H * it.s * 0.42;
		for (let guard = 0; guard < 12 && mine.some((p) => Math.abs(p.y - it.y) < step * 0.98); guard++) it.y -= step;
		mine.push(it);
		placed.set(it.lane, mine);
	}
	const ticks: RoadTick[] = [];
	for (const d of [0, 3, 7, 14, 30, 60, 90]) {
		const rel = d - cam;
		if (rel < 0 || rel > horizon) continue;
		const s = persp(rel, horizon);
		ticks.push({ d, y: hz + (base - hz) * s, s });
	}
	const near = [...items].sort((a, b) => a.dd - b.dd || a.task.sort - b.task.sort);
	const taskOrder = [...near.map((i) => i.task.id), ...rail.map((r) => r.task.id)];
	return { lanes, items, rail, ticks, taskOrder, byTask: new Map(items.map((i) => [i.task.id, i])), hz, laneW, vpx, base };
}

/** Avanzamento necessario perché un task con scadenza `off` (giorni da oggi) sia visibile. */
export function camFor(off: number, cam: number, horizon: number): number {
	const dd = off - cam;
	if (dd >= 0 && dd <= horizon) return cam;
	return Math.max(0, off);
}
