/**
 * Vista «Cork» (bacheca di sughero): ogni task è un foglietto che si trascina dove si vuole; la posizione si salva nel task
 * (`board_x`, `board_y`). I task senza posizione stanno nel «gruppetto» del loro gruppo radice, in una griglia automatica.
 * Logica pura: il disegno sta in CorkView.svelte.
 */
import type { Dep, Group, Task } from './types';
import { groupInfo, lateDep, UNGROUPED } from './maps';
import type { MapEdge } from './orbit';

export const NOTE_W: Record<number, number> = { 0: 112, 1: 120, 2: 134, 3: 150 };
export const NOTE_H: Record<number, number> = { 0: 78, 1: 84, 2: 94, 3: 106 };
const CELL_W = 176;
const CELL_H = 138;
const TAG_H = 44;
const GAP = 56;
const MARGIN = 70;
export const BOARD_MIN_W = 1500;
export const BOARD_MIN_H = 900;

export const noteSize = (t: Task) => ({ w: NOTE_W[t.priority] ?? 112, h: NOTE_H[t.priority] ?? 78 });

/** Piccola inclinazione stabile (−3…3 gradi) ricavata dall'id, così un foglietto non «balla» quando la vista si ridisegna. */
export function tilt(id: string): number {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
	return ((Math.abs(h) % 61) - 30) / 10;
}

export interface CorkNote {
	task: Task;
	x: number;
	y: number;
	w: number;
	h: number;
	rot: number;
	root: string;
	color: number;
	/** true: posto automatico (il task non è mai stato spostato) */
	auto: boolean;
}
export interface CorkTag {
	root: string;
	name: string;
	color: number;
	x: number;
	y: number;
	count: number;
}
export interface CorkModel {
	notes: CorkNote[];
	tags: CorkTag[];
	width: number;
	height: number;
	byTask: Map<string, CorkNote>;
	taskOrder: string[];
}
export interface CorkInput {
	groups: Group[];
	tasks: Task[];
	showDone: boolean;
	ungroupedLabel: string;
}

export function buildCork(inp: CorkInput): CorkModel {
	const info = groupInfo(inp.groups, inp.tasks, inp.ungroupedLabel);
	const vis = inp.tasks.filter((t) => inp.showDone || !t.completed);
	const roots = info.roots.filter((r) => vis.some((t) => info.rootOf(t) === r));

	// 1. gruppetti: una griglia per gruppo radice, disposti a righe che vanno a capo
	const notes: CorkNote[] = [];
	const tags: CorkTag[] = [];
	let cx = MARGIN;
	let cy = MARGIN;
	let rowH = 0;
	const maxRowW = BOARD_MIN_W - MARGIN;
	for (const root of roots) {
		const ts = vis.filter((t) => info.rootOf(t) === root).sort((a, b) => b.priority - a.priority || (a.due_date ?? '9').localeCompare(b.due_date ?? '9') || a.sort - b.sort || a.id.localeCompare(b.id));
		const cols = Math.max(1, Math.min(5, Math.ceil(Math.sqrt(ts.length * 1.5))));
		const rows = Math.ceil(ts.length / cols);
		const w = cols * CELL_W;
		const h = TAG_H + rows * CELL_H;
		if (cx > MARGIN && cx + w > maxRowW) {
			cx = MARGIN;
			cy += rowH + GAP;
			rowH = 0;
		}
		tags.push({ root, name: info.name(root), color: info.color(root), x: cx, y: cy, count: ts.length });
		ts.forEach((t, i) => {
			const { w: nw, h: nh } = noteSize(t);
			const col = i % cols;
			const row = Math.floor(i / cols);
			const auto = t.board_x == null || t.board_y == null;
			notes.push({
				task: t,
				x: auto ? cx + col * CELL_W + (CELL_W - nw) / 2 : t.board_x!,
				y: auto ? cy + TAG_H + row * CELL_H + 6 : t.board_y!,
				w: nw,
				h: nh,
				rot: tilt(t.id),
				root,
				color: info.color(root),
				auto
			});
		});
		cx += w + GAP;
		rowH = Math.max(rowH, h);
	}

	let width = BOARD_MIN_W;
	let height = BOARD_MIN_H;
	for (const n of notes) {
		width = Math.max(width, n.x + n.w + MARGIN);
		height = Math.max(height, n.y + n.h + MARGIN);
	}
	for (const g of tags) height = Math.max(height, g.y + TAG_H + MARGIN);
	const order = [...notes].sort((a, b) => roots.indexOf(a.root) - roots.indexOf(b.root) || a.y - b.y || a.x - b.x || a.task.id.localeCompare(b.task.id));
	return { notes, tags, width, height, byTask: new Map(notes.map((n) => [n.task.id, n])), taskOrder: order.map((n) => n.task.id) };
}

/** Posizione dello spillo di un foglietto (in alto al centro). */
export const pinOf = (n: Pick<CorkNote, 'x' | 'y' | 'w'>) => ({ x: n.x + n.w / 2, y: n.y + 9 });

/** Fili tra gli spilli: curve che si afflosciano verso il basso; rossi se il prerequisito è in ritardo. */
export function corkEdges(model: CorkModel, deps: Dep[]): MapEdge[] {
	const out: MapEdge[] = [];
	for (const dep of deps) {
		const a = model.byTask.get(dep.depends_on_id);
		const b = model.byTask.get(dep.task_id);
		if (!a || !b) continue;
		const p = pinOf(a);
		const q = pinOf(b);
		const sag = 34 + Math.min(120, Math.hypot(q.x - p.x, q.y - p.y) * 0.12);
		out.push({ key: `${dep.depends_on_id}>${dep.task_id}`, d: `M${p.x},${p.y} Q${(p.x + q.x) / 2},${Math.max(p.y, q.y) + sag} ${q.x},${q.y}`, late: lateDep(a.task, b.task) });
	}
	return out;
}

/** Posizione valida (non negativa, arrotondata) per un foglietto rilasciato in (x, y). */
export const clampPos = (x: number, y: number) => ({ x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) });

export { UNGROUPED };
