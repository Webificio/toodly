/**
 * Logica pura della vista «Matrix»: importanza (priorità) per urgenza (scadenza), in quattro quadranti.
 * Le bolle si respingono tra loro ma restano nella propria metà (alta/bassa priorità).
 */
import type { Group, Task } from './types';
import { diffDays } from './dates';
import { clip, groupInfo, labelRank } from './maps';

export const MX = { X0: 150, Y0: 90, W: 1200, H: 760, PAD: 60 };
export const SOON_DAYS = 7;
export const R = 14;

export type Quad = 'now' | 'plan' | 'squeeze' | 'later';
export const quadOf = (t: Task, today: string): Quad => {
	const soon = !!t.due_date && diffDays(t.due_date, today) <= SOON_DAYS;
	const high = t.priority >= 2;
	return high ? (soon ? 'now' : 'plan') : soon ? 'squeeze' : 'later';
};

export interface MatrixNode {
	task: Task;
	x: number;
	y: number;
	r: number;
	color: number;
	quad: Quad;
	label: string;
	rank: number;
	root: string;
}
export interface MatrixModel {
	nodes: MatrixNode[];
	counts: Record<Quad, number>;
	byTask: Map<string, MatrixNode>;
	taskOrder: string[];
	width: number;
	height: number;
}
export interface MatrixInput {
	groups: Group[];
	tasks: Task[];
	today: string;
	showDone: boolean;
	ungroupedLabel: string;
}

/** Posizione orizzontale (0…1) dalla scadenza: scaduti/imminenti a sinistra, lontani a destra, senza data in fondo. */
export function fx(due: string | null, today: string): number {
	if (!due) return 0.94;
	const d = diffDays(due, today);
	if (d <= SOON_DAYS) return (Math.max(d, -14) + 14) / (SOON_DAYS + 14) / 2;
	return 0.5 + (Math.min(d, 60) - SOON_DAYS) / (60 - SOON_DAYS) / 2 * 0.92;
}
/** Posizione verticale (0…1 dentro la propria metà) dalla priorità. */
const fy = (p: number) => ({ 3: 0.2, 2: 0.65, 1: 0.2, 0: 0.65 })[p] ?? 0.5;

export function buildMatrix(inp: MatrixInput): MatrixModel {
	const tasks = inp.tasks.filter((t) => inp.showDone || !t.completed);
	const gi = groupInfo(inp.groups, inp.tasks, inp.ungroupedLabel);
	const { X0, Y0, W, H } = MX;
	const iw = W - 80;
	const nodes: MatrixNode[] = tasks.map((t, i) => {
		const q = quadOf(t, inp.today);
		const top = t.priority >= 2;
		const jitter = ((i * 37) % 17) / 17 - 0.5;
		const x = X0 + 30 + fx(t.due_date, inp.today) * iw + jitter * 18;
		const y = (top ? Y0 : Y0 + H / 2) + 50 + fy(t.priority) * (H / 2 - 110) + (((i * 53) % 13) / 13 - 0.5) * 30;
		const days = t.due_date ? diffDays(t.due_date, inp.today) : null;
		const root = gi.rootOf(t);
		return { task: t, x, y, r: R + t.priority * 0.8, color: gi.color(root), quad: q, label: clip(t.title, 22), rank: labelRank(t, days), root };
	});
	// repulsione: gli ovali (più larghi che alti) si spostano, restando nella loro metà
	for (let it = 0; it < 260; it++) {
		for (let i = 0; i < nodes.length; i++)
			for (let j = i + 1; j < nodes.length; j++) {
				const a = nodes[i], b = nodes[j];
				const dx = (b.x - a.x) / 2.6, dy = b.y - a.y;
				const dist = Math.hypot(dx, dy) || 0.1;
				const min = 42;
				if (dist >= min) continue;
				const m = ((min - dist) / 2) * 0.5, ux = dx / dist, uy = dy / dist;
				a.x -= ux * m * 2.6; a.y -= uy * m; b.x += ux * m * 2.6; b.y += uy * m;
			}
		for (const n of nodes) {
			const top = n.task.priority >= 2;
			n.y = Math.min(Math.max(n.y, (top ? Y0 : Y0 + H / 2) + 56), (top ? Y0 + H / 2 : Y0 + H) - 26);
			n.x = Math.min(Math.max(n.x, X0 + 30), X0 + W - 160);
		}
	}
	const counts: Record<Quad, number> = { now: 0, plan: 0, squeeze: 0, later: 0 };
	for (const n of nodes) counts[n.quad]++;
	const order = [...nodes].sort((a, b) => a.rank - b.rank);
	return { nodes, counts, byTask: new Map(nodes.map((n) => [n.task.id, n])), taskOrder: order.map((n) => n.task.id), width: X0 + W + MX.PAD, height: Y0 + H + 70 };
}
