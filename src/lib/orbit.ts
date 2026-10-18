/**
 * Vista «Orbit» (radar): al centro c'è oggi, ogni anello è una fascia di tempo e ogni spicchio un gruppo.
 * Più un task è vicino al centro, più è urgente. Logica pura: il disegno sta in OrbitView.svelte.
 */
import type { Dep, Group, Task } from './types';
import { diffDays } from './dates';
import { mmLabel } from './graph';
import { clip, groupInfo, labelRank, labelWidth, lateDep, pickLabels, polar, type MapLabel } from './maps';

export type Band = 'late' | 'today' | 'week' | 'month' | 'later' | 'none';
export const BANDS: ReadonlyArray<{ id: Band; r: number }> = [
	{ id: 'late', r: 120 },
	{ id: 'today', r: 190 },
	{ id: 'week', r: 270 },
	{ id: 'month', r: 350 },
	{ id: 'later', r: 430 },
	{ id: 'none', r: 510 }
];
export const CORE_R = 54;
export const OUTER_R = 560;
export const bandOf = (days: number | null): Band => (days === null ? 'none' : days < 0 ? 'late' : days === 0 ? 'today' : days <= 7 ? 'week' : days <= 30 ? 'month' : 'later');
const radiusOf = (b: Band) => BANDS.find((x) => x.id === b)!.r;

export interface OrbitNode {
	task: Task;
	x: number;
	y: number;
	r: number;
	band: Band;
	days: number | null;
	root: string;
	color: number;
	label: MapLabel | null;
}
export interface OrbitSector {
	root: string;
	name: string;
	color: number;
	start: number;
	end: number;
	count: number;
}
export interface OrbitModel {
	nodes: OrbitNode[];
	sectors: OrbitSector[];
	/** centro e lato del quadrato di disegno */
	c: number;
	size: number;
	byTask: Map<string, OrbitNode>;
	taskOrder: string[];
}
export interface OrbitInput {
	groups: Group[];
	tasks: Task[];
	today: string;
	showDone: boolean;
	ungroupedLabel: string;
}

export const nodeRadius = (t: Task) => 9 + t.priority * 1.5;
const GAP = 3;
const MIN_SECTOR = 28;

export function buildOrbit(inp: OrbitInput): OrbitModel {
	const size = OUTER_R * 2 + 340;
	const c = size / 2;
	const info = groupInfo(inp.groups, inp.tasks, inp.ungroupedLabel);
	const vis = inp.tasks.filter((t) => inp.showDone || !t.completed);
	const perRoot = new Map<string, Task[]>();
	for (const t of vis) {
		const r = info.rootOf(t);
		(perRoot.get(r) ?? perRoot.set(r, []).get(r)!).push(t);
	}
	const roots = info.roots.filter((r) => perRoot.has(r));

	// ampiezza degli spicchi: radice quadrata del numero di task, con un minimo
	const weights = roots.map((r) => Math.sqrt(perRoot.get(r)!.length) + 0.6);
	const free = 360 - GAP * roots.length;
	const raw = weights.map((w) => (w / weights.reduce((a, b) => a + b, 0)) * free);
	const widths = raw.map((w) => Math.max(w, Math.min(MIN_SECTOR, free / Math.max(1, roots.length))));
	const k = free / (widths.reduce((a, b) => a + b, 0) || 1);
	const sectors: OrbitSector[] = [];
	const nodes: OrbitNode[] = [];
	let a0 = GAP / 2;
	roots.forEach((root, i) => {
		const w = widths[i] * k;
		const sec: OrbitSector = { root, name: info.name(root), color: info.color(root), start: a0, end: a0 + w, count: perRoot.get(root)!.length };
		sectors.push(sec);
		a0 += w + GAP;
		const byBand = new Map<Band, { t: Task; days: number | null }[]>();
		for (const t of perRoot.get(root)!) {
			const days = t.due_date ? diffDays(t.due_date, inp.today) : null;
			const b = bandOf(days);
			(byBand.get(b) ?? byBand.set(b, []).get(b)!).push({ t, days });
		}
		for (const [band, items] of byBand) {
			items.sort((x, y) => (x.days ?? 1e9) - (y.days ?? 1e9) || x.t.sort - y.t.sort || x.t.id.localeCompare(y.t.id));
			const r0 = radiusOf(band);
			const arc = (sec.end - sec.start - 6) * (Math.PI / 180) * r0;
			const lanes = Math.max(1, Math.ceil((items.length * 30) / Math.max(30, arc)));
			for (let l = 0; l < lanes; l++) {
				const mem = items.filter((_, idx) => idx % lanes === l);
				const rr = r0 + (l - (lanes - 1) / 2) * 28;
				mem.forEach((it, j) => {
					const ang = sec.start + 3 + ((j + 0.5) / mem.length) * (sec.end - sec.start - 6) + (l % 2 ? 0 : 0);
					const p = polar(c, c, rr, ang);
					nodes.push({ task: it.t, x: p.x, y: p.y, r: nodeRadius(it.t), band, days: it.days, root, color: sec.color, label: null });
				});
			}
		}
	});

	// etichette: scelte per importanza, senza toccare altre etichette né altre bolle
	const obstacles = nodes.map((n) => ({ id: n.task.id, x: n.x - n.r - 1, y: n.y - n.r - 1, w: n.r * 2 + 2, h: n.r * 2 + 2 }));
	const cands = nodes.map((n) => {
		const text = clip(n.task.title);
		const w = labelWidth(text);
		const right = n.x >= c;
		const x = right ? n.x + n.r + 5 : n.x - n.r - 5;
		return { id: n.task.id, n, text, right, rect: { x: right ? x : x - w, y: n.y - 8, w, h: 16 }, rank: labelRank(n.task, n.days) };
	});
	const shown = pickLabels(cands, obstacles);
	for (const cd of cands) if (shown.has(cd.id)) cd.n.label = { x: cd.right ? cd.rect.x : cd.rect.x + cd.rect.w, y: cd.n.y, anchor: cd.right ? 'start' : 'end', rot: 0, text: cd.text };

	const order = [...nodes].sort((a, b) => sectors.findIndex((s) => s.root === a.root) - sectors.findIndex((s) => s.root === b.root) || (a.days ?? 1e9) - (b.days ?? 1e9) || a.task.id.localeCompare(b.task.id));
	return { nodes, sectors, c, size, byTask: new Map(nodes.map((n) => [n.task.id, n])), taskOrder: order.map((n) => n.task.id) };
}

export interface MapEdge {
	key: string;
	d: string;
	late: boolean;
}
/** Collegamenti di dipendenza: archi che si incurvano verso il centro. */
export function orbitEdges(model: OrbitModel, deps: Dep[]): MapEdge[] {
	const out: MapEdge[] = [];
	for (const dep of deps) {
		const a = model.byTask.get(dep.depends_on_id);
		const b = model.byTask.get(dep.task_id);
		if (!a || !b) continue;
		const mx = (a.x + b.x) / 2;
		const my = (a.y + b.y) / 2;
		const cx = mx + (model.c - mx) * 0.45;
		const cy = my + (model.c - my) * 0.45;
		out.push({ key: `${dep.depends_on_id}>${dep.task_id}`, d: `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`, late: lateDep(a.task, b.task) });
	}
	return out;
}

/** Settore a corona per lo sfondo di uno spicchio. */
export function sectorPath(c: number, r1: number, r2: number, a1: number, a2: number): string {
	const p = (r: number, a: number) => polar(c, c, r, a);
	const big = a2 - a1 > 180 ? 1 : 0;
	const s1 = p(r2, a1), e1 = p(r2, a2), s2 = p(r1, a2), e2 = p(r1, a1);
	return `M${s1.x},${s1.y} A${r2},${r2} 0 ${big} 1 ${e1.x},${e1.y} L${s2.x},${s2.y} A${r1},${r1} 0 ${big} 0 ${e2.x},${e2.y} Z`;
}

// ---- esportazione Mermaid ----------------------------------------------------------
const BAND_NAME: Record<Band, string> = { late: 'Scaduti', today: 'Oggi', week: 'Entro 7 giorni', month: 'Entro 30 giorni', later: 'Oltre', none: 'Senza data' };

/**
 * Mappa mentale Mermaid (`mindmap`) di Orbit: al centro il titolo, poi un ramo per gruppo (spicchio), poi un ramo per
 * fascia di tempo (anello) con i task dalla scadenza più vicina. Le dipendenze non sono rappresentabili in una mappa mentale.
 * `bands` traduce i nomi delle fasce. Restituisce '' se non c'è nulla.
 */
export function orbitToMermaid(inp: OrbitInput, title: string, bands: Partial<Record<Band, string>> = {}): string {
	const m = buildOrbit(inp);
	if (!m.nodes.length) return '';
	const out: string[] = [];
	let id = 0;
	const clean = (title.replace(/\s+/g, ' ').trim() || 'Orbit').replace(/[()"]/g, ' ');
	out.push(`  root((${clean}))`);
	for (const sec of m.sectors) {
		out.push(`    g${++id}["${mmLabel(sec.name)} · ${sec.count}"]`);
		const mine = m.nodes.filter((n) => n.root === sec.root);
		for (const b of BANDS) {
			const inBand = mine.filter((n) => n.band === b.id).sort((x, y) => (x.days ?? 1e9) - (y.days ?? 1e9) || x.task.id.localeCompare(y.task.id));
			if (!inBand.length) continue;
			out.push(`      b${++id}["${mmLabel(bands[b.id] ?? BAND_NAME[b.id])}"]`);
			for (const n of inBand) out.push(`        t${++id}["${mmLabel(n.task.title)}${n.task.due_date ? `<br/>${n.task.due_date}` : ''}"]`);
		}
	}
	return [`# ${clean}`, '', '```mermaid', 'mindmap', ...out, '```', ''].join('\n');
}
