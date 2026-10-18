/**
 * Vista «Graph»: logica pura (nessuna dipendenza da Svelte, dallo store o dal DOM).
 * Dai gruppi e dai task calcola i nodi (gruppi, task, riga «nuovo task»), i connettori ad angolo retto
 * e la posizione di ognuno. Le posizioni sono sempre decise qui: l'ordine manuale (campo `sort`)
 * determina soltanto la sequenza dei fratelli.
 */
import type { Dep, Group, Task } from './types';
import { taskStart } from './dates';

// ---- palette dei gruppi ------------------------------------------------------------
/**
 * Una ventina di tinte tra il blu e il violetto, usate a rotazione per i gruppi radice.
 * `h` è la tinta (hue); `l` è un piccolo scarto di luminosità (in punti percentuali) che
 * distingue due gruppi vicini. Le tonalità definitive per tema chiaro/scuro stanno nel CSS di GraphView
 * (variabili `--gh` e `--gl`), così il cambio di tema non richiede alcun ricalcolo.
 */
export const PALETTE: ReadonlyArray<{ h: number; l: number }> = [
	{ h: 222, l: 0 },
	{ h: 268, l: 0 },
	{ h: 245, l: -3 },
	{ h: 285, l: 2 },
	{ h: 208, l: 3 },
	{ h: 258, l: -2 },
	{ h: 276, l: -4 },
	{ h: 232, l: 3 },
	{ h: 296, l: 0 },
	{ h: 216, l: -3 },
	{ h: 262, l: 4 },
	{ h: 280, l: -1 },
	{ h: 238, l: -4 },
	{ h: 302, l: 3 },
	{ h: 212, l: 1 },
	{ h: 272, l: 3 },
	{ h: 250, l: 2 },
	{ h: 290, l: -3 },
	{ h: 226, l: -1 },
	{ h: 254, l: -5 }
];

/** Voce della palette per un indice qualunque (anche negativo): la rotazione è circolare. */
export function paletteAt(i: number) {
	const n = PALETTE.length;
	return PALETTE[((Math.trunc(i) % n) + n) % n];
}

/** Valore dello stile inline che attiva i colori di un gruppo (vedi il CSS di GraphView). */
export function paletteStyle(i: number): string {
	const p = paletteAt(i);
	return `--gh:${p.h};--gl:${p.l}%`;
}

// ---- misure ----------------------------------------------------------------------
export const L = {
	ROOT_W: 208,
	ROOT_H: 56,
	SUB_W: 184,
	SUB_H: 42,
	CARD_W: 184,
	CARD_H: 62,
	ADD_W: 184,
	ADD_H: 34,
	/** spazio verticale tra due fratelli */
	VGAP: 10,
	/** spazio tra un nodo e il primo dei suoi figli */
	FIRST_GAP: 18,
	/** spazio orizzontale tra le colonne dei gruppi radice */
	COL_GAP: 64,
	/** rientro dei figli di un gruppo / di un task, e posizione della «dorsale» rispetto al padre */
	GROUP_INDENT: 34,
	GROUP_SPINE: 16,
	TASK_INDENT: 30,
	TASK_SPINE: 14
} as const;

/** Id del «gruppo» che raccoglie i task senza gruppo. */
export const UNGROUPED = '';

// ---- modello -----------------------------------------------------------------------
export interface GroupCount {
	total: number;
	high: number;
	medium: number;
}

export interface GNode {
	/** chiave stabile per il disegno: `g:<id>`, `t:<id>`, `a:<id>` */
	key: string;
	kind: 'group' | 'task' | 'add';
	/** id del gruppo o del task; per `add` l'id del gruppo ('' = senza gruppo) */
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	/** indice di palette (quello del gruppo radice da cui discende) */
	color: number;
	depth: number;
	// gruppo
	group?: Group | null;
	name?: string;
	root?: boolean;
	collapsed?: boolean;
	count?: GroupCount;
	// task
	task?: Task;
	/** gruppo effettivo del task (null = nessuno) */
	groupId?: string | null;
	/** task padre visualizzato (null = il task sta direttamente sotto un gruppo) */
	parentTaskId?: string | null;
	hasChildren?: boolean;
	open?: boolean;
	/** posizione tra i fratelli ancora da fare (0 per i completati) */
	num?: number;
}

export interface GEdge {
	key: string;
	d: string;
	color: number;
}

export interface GraphModel {
	nodes: GNode[];
	edges: GEdge[];
	width: number;
	height: number;
	/** id dei task nell'ordine di disegno (serve alla selezione a intervallo) */
	taskOrder: string[];
	byTask: Map<string, GNode>;
}

export interface GraphInput {
	groups: Group[];
	/** task della vista, già ordinati (ordine manuale) */
	tasks: Task[];
	collapsedGroups: ReadonlySet<string>;
	collapsedTasks: ReadonlySet<string>;
	showDone: boolean;
	/** gruppo in cui si sta scrivendo un nuovo task ('' = senza gruppo) */
	addingIn: string | null;
	ungroupedLabel: string;
}

/** Connettore ad angolo retto con lo spigolo arrotondato: dalla «dorsale» (sx, sy) al bordo sinistro di un figlio. */
export function elbow(sx: number, sy: number, tx: number, ty: number, r = 8): string {
	const rr = Math.max(0, Math.min(r, tx - sx, ty - sy));
	return `M${sx},${sy} V${ty - rr} Q${sx},${ty} ${sx + rr},${ty} H${tx}`;
}

const byGroupOrder = (a: Group, b: Group) => a.sort - b.sort || a.name.localeCompare(b.name);

export function buildGraph(inp: GraphInput): GraphModel {
	const { groups, tasks, collapsedGroups, collapsedTasks, showDone, addingIn, ungroupedLabel } = inp;
	const groupById = new Map(groups.map((g) => [g.id, g]));
	const isRootGroup = (g: Group) => !g.parent_id || !groupById.has(g.parent_id);
	const childGroups = (parent: string | null) =>
		groups.filter((g) => (parent === null ? isRootGroup(g) : g.parent_id === parent)).sort(byGroupOrder);

	// ---- task visibili: i completati si possono nascondere, ma non se hanno discendenti ancora aperti
	const byId = new Map(tasks.map((t) => [t.id, t]));
	const keep = new Set<string>();
	for (const t of tasks) {
		if (showDone || !t.completed) keep.add(t.id);
	}
	if (!showDone) {
		for (const t of tasks) {
			if (t.completed) continue;
			for (let cur = t.parent_id ? byId.get(t.parent_id) : undefined, guard = 0; cur && guard < 50; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined, guard++) keep.add(cur.id);
		}
	}
	const shown = tasks.filter((t) => keep.has(t.id));
	const ids = new Set(shown.map((t) => t.id));
	const effGroup = (t: Task) => (t.group_id && groupById.has(t.group_id) ? t.group_id : null);

	const kids = new Map<string, Task[]>();
	const roots = new Map<string | null, Task[]>();
	const push = <K>(m: Map<K, Task[]>, k: K, t: Task) => {
		const a = m.get(k) ?? [];
		a.push(t);
		m.set(k, a);
	};
	for (const t of shown) {
		if (t.parent_id && ids.has(t.parent_id)) push(kids, t.parent_id, t);
		else push(roots, effGroup(t), t);
	}

	// ---- contatori dei gruppi: task aperti (radice), sottogruppi compresi
	const counts = new Map<string, GroupCount>();
	const countOf = (gid: string): GroupCount => {
		const hit = counts.get(gid);
		if (hit) return hit;
		const own = (roots.get(gid) ?? []).filter((t) => !t.completed);
		const n: GroupCount = { total: own.length, high: own.filter((t) => t.priority === 3).length, medium: own.filter((t) => t.priority === 2).length };
		counts.set(gid, n);
		for (const g of childGroups(gid)) {
			const s = countOf(g.id);
			n.total += s.total;
			n.high += s.high;
			n.medium += s.medium;
		}
		return n;
	};

	// ---- colore: i gruppi radice ruotano nella palette (per ordine di creazione, quindi stabile)
	const rootRank = new Map<string, number>();
	[...groups]
		.filter(isRootGroup)
		.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
		.forEach((g, i) => rootRank.set(g.id, i));

	const nodes: GNode[] = [];
	const edges: GEdge[] = [];
	const taskOrder: string[] = [];
	const byTask = new Map<string, GNode>();
	const place = (n: GNode) => {
		nodes.push(n);
		if (n.kind === 'task') {
			taskOrder.push(n.id);
			byTask.set(n.id, n);
		}
		return n;
	};

	const groupNode = (g: Group | null, x: number, y: number, depth: number, color: number, root: boolean): GNode => {
		const gid = g ? g.id : UNGROUPED;
		const total = g ? countOf(g.id) : countUngrouped();
		return {
			key: 'g:' + gid,
			kind: 'group',
			id: gid,
			x,
			y,
			w: root ? L.ROOT_W : L.SUB_W,
			h: root ? L.ROOT_H : L.SUB_H,
			color,
			depth,
			group: g,
			name: g ? g.name : ungroupedLabel,
			root,
			collapsed: g ? collapsedGroups.has(g.id) : collapsedGroups.has('__none__'),
			count: total
		};
	};
	const countUngrouped = (): GroupCount => {
		const own = (roots.get(null) ?? []).filter((t) => !t.completed);
		return { total: own.length, high: own.filter((t) => t.priority === 3).length, medium: own.filter((t) => t.priority === 2).length };
	};
	const taskNode = (t: Task, x: number, y: number, depth: number, color: number, parentTaskId: string | null, num: number): GNode => {
		const c = kids.get(t.id) ?? [];
		return {
			key: 't:' + t.id,
			kind: 'task',
			id: t.id,
			x,
			y,
			w: L.CARD_W,
			h: L.CARD_H,
			color,
			depth,
			task: t,
			groupId: effGroup(t),
			parentTaskId,
			hasChildren: c.length > 0,
			open: !collapsedTasks.has(t.id),
			num
		};
	};
	const addNode = (gid: string, x: number, y: number, depth: number, color: number): GNode => ({ key: 'a:' + gid, kind: 'add', id: gid, x, y, w: L.ADD_W, h: L.ADD_H, color, depth });

	/** progressivo tra i fratelli ancora da fare (i completati non sono numerati) */
	const numbering = (list: Task[]) => {
		let n = 0;
		return list.map((t) => (t.completed ? 0 : ++n));
	};

	/** Sotto-task di un task: pila rientrata sotto di esso. Ritorna il bordo inferiore. */
	const fillTask = (tn: GNode): number => {
		let bottom = tn.y + tn.h;
		const list = kids.get(tn.id) ?? [];
		if (!list.length || !tn.open) return bottom;
		const sx = tn.x + L.TASK_SPINE;
		const sy = tn.y + tn.h;
		const cx = tn.x + L.TASK_INDENT;
		let y = sy + L.FIRST_GAP;
		const nums = numbering(list);
		list.forEach((t, i) => {
			const n = place(taskNode(t, cx, y, tn.depth + 1, tn.color, tn.id, nums[i]));
			edges.push({ key: 'e:' + n.key, d: elbow(sx, sy, n.x, n.y + n.h / 2), color: tn.color });
			bottom = fillTask(n);
			y = bottom + L.VGAP;
		});
		return bottom;
	};

	/** Contenuto di un gruppo: riga «nuovo task», sottogruppi, poi i task. Ritorna il bordo inferiore. */
	const fillGroup = (gn: GNode, withSubgroups: boolean): number => {
		let bottom = gn.y + gn.h;
		if (gn.collapsed) return bottom;
		const sx = gn.x + L.GROUP_SPINE;
		const sy = gn.y + gn.h;
		const cx = gn.x + L.GROUP_INDENT;
		let y = sy + L.FIRST_GAP;
		const link = (n: GNode) => edges.push({ key: 'e:' + n.key, d: elbow(sx, sy, n.x, n.y + n.h / 2), color: gn.color });
		if (addingIn === gn.id) {
			const n = place(addNode(gn.id, cx, y, gn.depth + 1, gn.color));
			link(n);
			bottom = n.y + n.h;
			y = bottom + L.VGAP;
		}
		if (withSubgroups) {
			for (const sub of childGroups(gn.id)) {
				const n = place(groupNode(sub, cx, y, gn.depth + 1, gn.color, false));
				link(n);
				bottom = fillGroup(n, true);
				y = bottom + L.VGAP;
			}
		}
		const list = roots.get(gn.id === UNGROUPED ? null : gn.id) ?? [];
		const nums = numbering(list);
		list.forEach((t, i) => {
			const n = place(taskNode(t, cx, y, gn.depth + 1, gn.color, null, nums[i]));
			link(n);
			bottom = fillTask(n);
			y = bottom + L.VGAP;
		});
		return bottom;
	};

	// ---- gruppi radice, uno accanto all'altro; in fondo i task senza gruppo
	let x = 0;
	let height = 0;
	let prev: GNode | null = null;
	const column = (rootNode: GNode, withSub: boolean) => {
		const start = nodes.length;
		place(rootNode);
		const bottom = fillGroup(rootNode, withSub);
		let right = rootNode.x + rootNode.w;
		for (let i = start; i < nodes.length; i++) right = Math.max(right, nodes[i].x + nodes[i].w);
		height = Math.max(height, bottom);
		if (prev) edges.push({ key: 'r:' + rootNode.key, d: `M${prev.x + prev.w},${prev.y + prev.h / 2} H${rootNode.x}`, color: prev.color });
		prev = rootNode;
		x = right + L.COL_GAP;
	};
	for (const g of childGroups(null)) column(groupNode(g, x, 0, 0, rootRank.get(g.id) ?? 0, true), true);
	if ((roots.get(null) ?? []).length > 0 || addingIn === UNGROUPED) column(groupNode(null, x, 0, 0, rootRank.size, true), false);

	let width = 0;
	for (const n of nodes) width = Math.max(width, n.x + n.w);
	return { nodes, edges, width, height, taskOrder, byTask };
}

// ---- dipendenze --------------------------------------------------------------------
export interface DepEdge {
	key: string;
	d: string;
	late: boolean;
}

/** Curva dal task prerequisito `a` al task che dipende da esso `b`. */
export function depPath(a: GNode, b: GNode): string {
	const y1 = a.y + a.h / 2;
	const y2 = b.y + b.h / 2;
	if (b.x >= a.x + a.w + 24) {
		// b sta a destra: da bordo destro di a a bordo sinistro di b
		const x1 = a.x + a.w;
		const dx = Math.max(40, (b.x - x1) / 2);
		return `M${x1},${y1} C${x1 + dx},${y1} ${b.x - dx},${y2} ${b.x},${y2}`;
	}
	// stessa colonna (o b a sinistra): parentesi sul lato destro, dal bordo destro di a a quello di b
	const x1 = a.x + a.w;
	const x2 = b.x + b.w;
	const bulge = Math.max(x1, x2) + 36;
	return `M${x1},${y1} C${bulge},${y1} ${bulge},${y2} ${x2},${y2}`;
}

/** Frecce delle dipendenze tra i task disegnati. `late`: il prerequisito non è finito e la scadenza è dopo l'inizio del task che aspetta. */
export function depEdges(model: GraphModel, deps: Dep[]): DepEdge[] {
	const out: DepEdge[] = [];
	for (const dep of deps) {
		const pre = model.byTask.get(dep.depends_on_id);
		const post = model.byTask.get(dep.task_id);
		if (!pre?.task || !post?.task) continue;
		const late = !pre.task.completed && !!pre.task.due_date && pre.task.due_date >= taskStart(post.task);
		out.push({ key: `${dep.depends_on_id}>${dep.task_id}`, d: depPath(pre, post), late });
	}
	return out;
}

/** Fattore di zoom che fa stare `w`×`h` in `vw`×`vh`, limitato a [min, max]. */
export function fitScale(w: number, h: number, vw: number, vh: number, min = 0.2, max = 1): number {
	if (w <= 0 || h <= 0 || vw <= 0 || vh <= 0) return max;
	return Math.min(max, Math.max(min, Math.min(vw / w, vh / h)));
}
