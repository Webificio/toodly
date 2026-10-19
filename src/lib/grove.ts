/**
 * Logica pura della vista «Grove»: un albero per ogni gruppo radice. Le foglie sono i task aperti
 * (il colore dice quanto è vicina la scadenza, la grandezza la priorità), i frutti quelli completati,
 * le foglie cadute a terra quelli scaduti.
 */
import type { Group, Task } from './types';
import { diffDays } from './dates';
import { clip, groupInfo, labelRank } from './maps';

export const GROUND_PAD = 130;
export const TOP_PAD = 70;
export const SPACING = 36;
const GOLDEN = 2.39996;

/** Colore di una foglia secondo i giorni alla scadenza. */
export function leafColor(days: number | null): string {
	if (days === null) return '#7d8f78';
	if (days < 0) return '#c2410c';
	if (days <= 2) return '#f59e0b';
	if (days <= 7) return '#a3e635';
	if (days <= 14) return '#4ade80';
	return '#16a34a';
}
export const LEAF_LEGEND: { key: string; color: string; max: number | null }[] = [
	{ key: 'over', color: '#c2410c', max: -1 },
	{ key: '≤ 2', color: '#f59e0b', max: 2 },
	{ key: '≤ 7', color: '#a3e635', max: 7 },
	{ key: '≤ 14', color: '#4ade80', max: 14 },
	{ key: 'later', color: '#16a34a', max: null }
];

export interface GroveTree {
	root: string;
	name: string;
	color: number;
	cx: number;
	/** cima del tronco e centro/raggi della chioma */
	top: number;
	ccy: number;
	crx: number;
	cry: number;
	open: number;
	done: number;
}
export interface GroveLeaf {
	task: Task;
	x: number;
	y: number;
	r: number;
	rot: number;
	fill: string;
	kind: 'leaf' | 'fruit' | 'fallen';
	tree: number;
	/** punto di attacco al ramo (solo foglie e frutti) */
	label: string;
	rank: number;
	root: string;
	color: number;
}
export interface GroveModel {
	trees: GroveTree[];
	leaves: GroveLeaf[];
	byTask: Map<string, GroveLeaf>;
	taskOrder: string[];
	width: number;
	height: number;
	ground: number;
}
export interface GroveInput {
	groups: Group[];
	tasks: Task[];
	today: string;
	showDone: boolean;
	ungroupedLabel: string;
}

export function buildGrove(inp: GroveInput): GroveModel {
	const gi = groupInfo(inp.groups, inp.tasks, inp.ungroupedLabel);
	const tasks = inp.tasks.filter((t) => inp.showDone || !t.completed);
	const used = new Set(tasks.map((t) => gi.rootOf(t)));
	const roots = gi.roots.filter((r) => used.has(r));
	const per = roots.map((r) => tasks.filter((t) => gi.rootOf(t) === r));
	const size = per.map((ts) => {
		const n = ts.filter((t) => !t.completed && !(t.due_date && diffDays(t.due_date, inp.today) < 0)).length + ts.filter((t) => t.completed).length;
		const crx = Math.min(210, 78 + 24 * Math.sqrt(Math.max(n, 1)));
		return { crx, cry: crx * 0.95 };
	});
	const trunkH = (i: number) => size[i].cry * 0.55 + 50;
	const treeH = Math.max(...size.map((s, i) => trunkH(i) + s.cry * 1.7), 260);
	const ground = TOP_PAD + treeH;
	let x = 60;
	const trees: GroveTree[] = roots.map((r, i) => {
		const { crx, cry } = size[i];
		const cx = x + crx;
		x += crx * 2 + SPACING;
		const top = ground - trunkH(i) - cry * 0.7;
		const ts = per[i];
		return { root: r, name: gi.name(r), color: gi.color(r), cx, top, ccy: top - cry * 0.15, crx, cry, open: ts.filter((t) => !t.completed).length, done: ts.filter((t) => t.completed).length };
	});

	const leaves: GroveLeaf[] = [];
	trees.forEach((tr, i) => {
		const ts = per[i].slice().sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || b.priority - a.priority || a.sort - b.sort);
		const inCrown = ts.filter((t) => t.completed || !t.due_date || diffDays(t.due_date, inp.today) >= 0);
		const fallen = ts.filter((t) => !t.completed && t.due_date && diffDays(t.due_date, inp.today) < 0);
		inCrown.forEach((t, k) => {
			const ang = k * GOLDEN + i;
			const rad = Math.sqrt((k + 0.6) / (inCrown.length + 0.6));
			const days = t.due_date ? diffDays(t.due_date, inp.today) : null;
			const fruit = t.completed;
			leaves.push({
				task: t,
				x: tr.cx + Math.cos(ang) * tr.crx * 0.86 * rad,
				y: tr.ccy + Math.sin(ang) * tr.cry * 0.82 * rad,
				r: fruit ? 9 : 9 + t.priority * 3.4,
				rot: fruit ? 0 : (ang * 180) / Math.PI + 40,
				fill: fruit ? '#fbbf24' : leafColor(days),
				kind: fruit ? 'fruit' : 'leaf',
				tree: i,
				label: clip(t.title, 20),
				rank: labelRank(t, days),
				root: tr.root,
				color: tr.color
			});
		});
		fallen.forEach((t, k) => {
			const days = diffDays(t.due_date!, inp.today);
			leaves.push({
				task: t,
				x: tr.cx + ((k % 5) - 2) * Math.min(38, (tr.crx * 0.9) / 2.2),
				y: ground + 22 + Math.floor(k / 5) * 22,
				r: 9 + t.priority * 3,
				rot: 60 + ((k * 47) % 60),
				fill: leafColor(days),
				kind: 'fallen',
				tree: i,
				label: clip(t.title, 20),
				rank: labelRank(t, days),
				root: tr.root,
				color: tr.color
			});
		});
	});
	const maxFallRows = Math.max(0, ...trees.map((_, i) => Math.ceil(leaves.filter((l) => l.tree === i && l.kind === 'fallen').length / 5)));
	const order = [...leaves].sort((a, b) => a.rank - b.rank);
	return {
		trees,
		leaves,
		byTask: new Map(leaves.map((l) => [l.task.id, l])),
		taskOrder: order.map((l) => l.task.id),
		width: x - SPACING + 60,
		height: ground + GROUND_PAD + maxFallRows * 22,
		ground
	};
}
