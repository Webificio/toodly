/**
 * Logica comune alle viste «Orbit» e «Metro» (pura: nessuna dipendenza da Svelte, dallo store o dal DOM).
 * I gruppi radice sono gli «spicchi» di Orbit e le «linee» di Metro; i task dei sottogruppi e i sotto-task
 * stanno sul gruppo radice da cui discendono. I colori sono quelli della Graph (stessa palette, stessa rotazione).
 */
import type { Group, Task } from './types';
import { taskStart } from './dates';
import { UNGROUPED } from './graph';

export { UNGROUPED };

// ---- gruppi ----------------------------------------------------------------------
export interface GroupInfo {
	/** gruppi radice, nell'ordine di visualizzazione (come nella Graph); `UNGROUPED` in fondo se serve */
	roots: string[];
	/** nome di un gruppo radice (`UNGROUPED` → etichetta «Senza gruppo») */
	name(root: string): string;
	/** gruppo radice di un task ('' = nessun gruppo) */
	rootOf(t: Task): string;
	/** indice di palette (lo stesso della Graph) */
	color(root: string): number;
	/** percorso leggibile, es. «Platform 2.0 › Backend API › Auth & Billing» ('' se senza gruppo) */
	crumb(t: Task): string;
}

export function groupInfo(groups: Group[], tasks: Task[], ungroupedLabel: string): GroupInfo {
	const byG = new Map(groups.map((g) => [g.id, g]));
	const byT = new Map(tasks.map((t) => [t.id, t]));
	const isRoot = (g: Group) => !g.parent_id || !byG.has(g.parent_id);
	const rootGroups = groups.filter(isRoot);
	const roots = [...rootGroups].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)).map((g) => g.id);
	const rank = new Map<string, number>();
	[...rootGroups].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).forEach((g, i) => rank.set(g.id, i));

	/** gruppo effettivo di un task: quello del task più in alto della sua catena di padri */
	const groupOf = (t: Task): string | null => {
		let cur = t;
		for (let i = 0; i < 50 && cur.parent_id && byT.has(cur.parent_id); i++) cur = byT.get(cur.parent_id)!;
		return cur.group_id && byG.has(cur.group_id) ? cur.group_id : null;
	};
	const rootOfGroup = (gid: string): string => {
		let g = byG.get(gid)!;
		for (let i = 0; i < 50 && g.parent_id && byG.has(g.parent_id); i++) g = byG.get(g.parent_id)!;
		return g.id;
	};
	const rootOf = (t: Task) => {
		const g = groupOf(t);
		return g ? rootOfGroup(g) : UNGROUPED;
	};
	return {
		roots: [...roots, UNGROUPED],
		name: (r) => (r === UNGROUPED ? ungroupedLabel : (byG.get(r)?.name ?? '')),
		rootOf,
		color: (r) => (r === UNGROUPED ? rank.size : (rank.get(r) ?? 0)),
		crumb: (t) => {
			const g = groupOf(t);
			if (!g) return '';
			const path: string[] = [];
			let cur: Group | undefined = byG.get(g);
			for (let i = 0; i < 50 && cur; i++) {
				path.unshift(cur.name);
				cur = cur.parent_id ? byG.get(cur.parent_id) : undefined;
			}
			return path.join(' › ');
		}
	};
}

// ---- dipendenze --------------------------------------------------------------------
/** In ritardo: il prerequisito non è finito e scade dopo l'inizio del task che aspetta (stessa regola di Gantt e Graph). */
export const lateDep = (pre: Task, post: Task) => !pre.completed && !!pre.due_date && pre.due_date >= taskStart(post);

// ---- etichette -----------------------------------------------------------------------
export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}
export const rectsOverlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Larghezza stimata di un'etichetta (carattere medio ≈ 6,1 px a 11,5 px di corpo). */
export const labelWidth = (text: string) => Math.ceil(text.length * 6.1);
export const clip = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/**
 * Sceglie quali etichette mostrare: le più importanti (rango minore) per prime, saltando quelle che toccherebbero
 * un'altra etichetta già scelta o un ostacolo (le bolle degli altri task). Le nascoste restano leggibili al passaggio del mouse.
 */
export function pickLabels(cands: { id: string; rect: Rect; rank: number }[], obstacles: (Rect & { id?: string })[]): Set<string> {
	const chosen: Rect[] = [];
	const out = new Set<string>();
	for (const c of [...cands].sort((a, b) => a.rank - b.rank)) {
		if (obstacles.some((o) => o.id !== c.id && rectsOverlap(c.rect, o))) continue;
		if (chosen.some((r) => rectsOverlap(c.rect, r))) continue;
		chosen.push(c.rect);
		out.add(c.id);
	}
	return out;
}

export interface MapLabel {
	x: number;
	y: number;
	anchor: 'start' | 'middle' | 'end';
	/** rotazione in gradi (Metro) */
	rot: number;
	text: string;
}

/** Ordine d'importanza di un'etichetta: priorità alta, poi scadenza vicina. */
export const labelRank = (t: Task, days: number | null) => (3 - t.priority) * 1000 + (t.completed ? 500 : 0) + (days === null ? 400 : Math.abs(days));

/** Coordinate polari → cartesiane (0° = in alto, in senso orario). */
export const polar = (cx: number, cy: number, r: number, deg: number) => ({ x: cx + r * Math.sin((deg * Math.PI) / 180), y: cy - r * Math.cos((deg * Math.PI) / 180) });
