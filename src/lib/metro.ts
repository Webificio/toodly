/**
 * Vista «Metro»: una linea per gruppo, una stazione per task, il tempo scorre da sinistra a destra.
 * Le dipendenze sono i collegamenti tra una linea e l'altra. Logica pura: il disegno sta in MetroView.svelte.
 */
import type { Dep, Group, Task } from './types';
import { diffDays, formatDayShort } from './dates';
import { mmLabel } from './graph';
import { clip, groupInfo, labelRank, lateDep } from './maps';
import type { MapEdge } from './orbit';

export const COL_W = 96;
export const LANE_H = 120;
export const PAD_X = 150;
export const PAD_TOP = 70;
export const STATION_R = 9;

export interface MetroCol {
	/** data ISO, 'late' (scaduti, raggruppati) o 'none' (senza data) */
	key: string;
	x: number;
	label: string;
}
export interface MetroStation {
	task: Task;
	x: number;
	y: number;
	line: number;
	days: number | null;
	label: string;
	rank: number;
	/** etichetta sopra (true) o sotto (false) la linea */
	above: boolean;
	r: number;
}
export interface MetroLine {
	root: string;
	name: string;
	color: number;
	y: number;
	x1: number;
	x2: number;
}
export interface MetroModel {
	lines: MetroLine[];
	stations: MetroStation[];
	cols: MetroCol[];
	todayX: number | null;
	width: number;
	height: number;
	byTask: Map<string, MetroStation>;
	taskOrder: string[];
}
export interface MetroInput {
	groups: Group[];
	tasks: Task[];
	today: string;
	showDone: boolean;
	ungroupedLabel: string;
	lateLabel: string;
	noDateLabel: string;
}

export function buildMetro(inp: MetroInput): MetroModel {
	const info = groupInfo(inp.groups, inp.tasks, inp.ungroupedLabel);
	const vis = inp.tasks.filter((t) => inp.showDone || !t.completed);
	const roots = info.roots.filter((r) => vis.some((t) => info.rootOf(t) === r));
	const keyOf = (t: Task) => (!t.due_date ? 'none' : t.due_date < inp.today ? 'late' : t.due_date);
	const dates = [...new Set(vis.map(keyOf).filter((k) => k !== 'late' && k !== 'none'))].sort();
	const keys = [...(vis.some((t) => keyOf(t) === 'late') ? ['late'] : []), ...dates, ...(vis.some((t) => keyOf(t) === 'none') ? ['none'] : [])];
	const cols: MetroCol[] = keys.map((k, i) => ({ key: k, x: PAD_X + i * COL_W, label: k === 'late' ? inp.lateLabel : k === 'none' ? inp.noDateLabel : formatDayShort(k) }));
	const colX = new Map(cols.map((c) => [c.key, c.x]));

	const stations: MetroStation[] = [];
	const lines: MetroLine[] = [];
	let y = PAD_TOP + 40;
	roots.forEach((root, li) => {
		const ts = vis.filter((t) => info.rootOf(t) === root);
		const stack = new Map<string, number>();
		const sorted = [...ts].sort((a, b) => keyOf(a).localeCompare(keyOf(b)) || b.priority - a.priority || a.sort - b.sort || a.id.localeCompare(b.id));
		let maxStack = 1;
		for (const t of sorted) {
			const k = keyOf(t);
			const s = stack.get(k) ?? 0;
			stack.set(k, s + 1);
			maxStack = Math.max(maxStack, s + 1);
		}
		const used = new Map<string, number>();
		let first = Infinity, last = -Infinity;
		const laneY = y + ((maxStack - 1) * 44) / 2;
		for (const t of sorted) {
			const k = keyOf(t);
			const s = used.get(k) ?? 0;
			used.set(k, s + 1);
			const x = colX.get(k)!;
			first = Math.min(first, x);
			last = Math.max(last, x);
			const days = t.due_date ? diffDays(t.due_date, inp.today) : null;
			// le stazioni dello stesso giorno si dispongono a ventaglio sopra e sotto la linea
			const off = s === 0 ? 0 : (s % 2 ? -1 : 1) * Math.ceil(s / 2) * 44;
			stations.push({ task: t, x, y: laneY + off, line: li, days, label: clip(t.title, 22), rank: labelRank(t, days), above: off <= 0, r: STATION_R + t.priority * 0.8 });
		}
		lines.push({ root, name: info.name(root), color: info.color(root), y: laneY, x1: PAD_X - 40, x2: (last === -Infinity ? PAD_X : last) + 40 });
		y += Math.max(LANE_H, maxStack * 44 + 70);
	});
	const today = inp.today;
	let todayX: number | null = null;
	const dc = cols.filter((c) => c.key !== 'late' && c.key !== 'none');
	if (dc.length) {
		const before = dc.filter((c) => c.key <= today).pop();
		const after = dc.find((c) => c.key >= today);
		if (before && after) {
			const span = diffDays(after.key, before.key);
			todayX = span === 0 ? before.x : before.x + ((after.x - before.x) * diffDays(today, before.key)) / span;
		} else if (after && !before) todayX = after.x - COL_W / 2;
		else if (before && !after) todayX = before.x + COL_W / 2;
	} else if (cols.some((c) => c.key === 'late')) todayX = cols[0].x + COL_W / 2;
	const order = [...stations].sort((a, b) => a.line - b.line || a.x - b.x || a.y - b.y);
	return {
		lines,
		stations,
		cols,
		todayX,
		width: PAD_X + Math.max(1, cols.length) * COL_W + 60,
		height: y + 20,
		byTask: new Map(stations.map((s) => [s.task.id, s])),
		taskOrder: order.map((s) => s.task.id)
	};
}

/** Collegamenti tra stazioni: curve a S, tratteggiate; rosse se il prerequisito è in ritardo. */
export function metroEdges(model: MetroModel, deps: Dep[]): MapEdge[] {
	const out: MapEdge[] = [];
	for (const dep of deps) {
		const a = model.byTask.get(dep.depends_on_id);
		const b = model.byTask.get(dep.task_id);
		if (!a || !b) continue;
		let d: string;
		if (b.x > a.x) {
			const dx = Math.max(30, (b.x - a.x) / 2);
			d = `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
		} else {
			const bulge = Math.max(a.y, b.y) + 46;
			d = `M${a.x},${a.y} C${a.x + 40},${bulge} ${b.x - 40},${bulge} ${b.x},${b.y}`;
		}
		out.push({ key: `${dep.depends_on_id}>${dep.task_id}`, d, late: lateDep(a.task, b.task) });
	}
	return out;
}

// ---- esportazione Mermaid ----------------------------------------------------------
/**
 * Diagramma Mermaid (`flowchart LR`) del Metro: ogni linea è un `subgraph` con le stazioni in ordine di data collegate da frecce piene;
 * le dipendenze (cambi tra linee) sono frecce tratteggiate. Completati, in corso, priorità alta e in ritardo sono classi
 * (`done`, `doing`, `crit`, `late`). Restituisce '' se non c'è nulla.
 */
export function metroToMermaid(inp: MetroInput, deps: Dep[], title: string): string {
	const m = buildMetro(inp);
	if (!m.stations.length) return '';
	const ids = new Map<string, string>();
	const lines: string[] = [];
	const cls = { done: [] as string[], doing: [] as string[], crit: [] as string[], late: [] as string[] };
	let n = 0;
	m.lines.forEach((l, li) => {
		lines.push(`    subgraph l${li + 1}["${mmLabel(l.name)}"]`);
		lines.push('        direction LR');
		const mine = m.stations.filter((s) => s.line === li).sort((a, b) => a.x - b.x || a.y - b.y || a.task.id.localeCompare(b.task.id));
		for (const s of mine) {
			const id = 's' + ++n;
			ids.set(s.task.id, id);
			lines.push(`        ${id}["${mmLabel(s.task.title)}${s.task.due_date ? `<br/>${s.task.due_date}` : ''}"]`);
			if (s.task.completed) cls.done.push(id);
			else {
				if (s.task.status === 'doing') cls.doing.push(id);
				if (s.task.priority === 3) cls.crit.push(id);
				if (s.days !== null && s.days < 0) cls.late.push(id);
			}
		}
		for (let i = 1; i < mine.length; i++) lines.push(`        ${ids.get(mine[i - 1].task.id)} --> ${ids.get(mine[i].task.id)}`);
		lines.push('    end');
	});
	for (const d of deps) {
		const a = ids.get(d.depends_on_id);
		const b = ids.get(d.task_id);
		if (a && b) lines.push(`    ${a} -.-> ${b}`);
	}
	lines.push('    classDef done fill:#e5e7eb,stroke:#9ca3af,color:#6b7280', '    classDef doing stroke:#f59e0b,stroke-width:2px', '    classDef crit stroke:#ef4444,stroke-width:2px', '    classDef late stroke:#ef4444,stroke-dasharray:4 3');
	for (const k of ['done', 'doing', 'crit', 'late'] as const) if (cls[k].length) lines.push(`    class ${cls[k].join(',')} ${k}`);
	return [`# ${title.replace(/\s+/g, ' ').trim()}`, '', '```mermaid', 'flowchart LR', ...lines, '```', ''].join('\n');
}
