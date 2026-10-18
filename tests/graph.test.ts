import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/i18n.svelte', () => ({ t: (s: string) => s, locale: () => 'it', i18n: { lang: 'it' } }));

import { PALETTE, UNGROUPED, buildGraph, depEdges, depPath, elbow, fitScale, graphToMermaid, L, paletteAt, paletteStyle, type GNode, type GraphInput } from '../src/lib/graph';
import type { Group } from '../src/lib/types';
import { mkTask } from './helpers';

const grp = (id: string, name: string, parent: string | null = null, sort = 0, created = '2026-01-01T00:00:00.000Z'): Group => ({ id, name, parent_id: parent, sort, created_at: created });

function input(over: Partial<GraphInput> = {}): GraphInput {
	return { groups: [], tasks: [], collapsedGroups: new Set(), collapsedTasks: new Set(), showDone: true, addingIn: null, ungroupedLabel: 'Senza gruppo', ...over };
}
const overlap = (a: GNode, b: GNode) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('palette', () => {
	it('ha una ventina di voci, tutte diverse, in gamma blu–violetto', () => {
		expect(PALETTE.length).toBe(20);
		expect(new Set(PALETTE.map((p) => `${p.h}/${p.l}`)).size).toBe(20);
		for (const p of PALETTE) expect(p.h >= 200 && p.h <= 310).toBe(true);
	});
	it('ruota in modo circolare, anche con indici negativi', () => {
		expect(paletteAt(0)).toEqual(paletteAt(20));
		expect(paletteAt(21)).toEqual(paletteAt(1));
		expect(paletteAt(-1)).toEqual(paletteAt(19));
		expect(paletteStyle(1)).toBe('--gh:268;--gl:0%');
	});
});

describe('buildGraph: struttura', () => {
	const groups = [grp('w', 'WORK', null, 1, '2026-01-01'), grp('p', 'PERSONALE', null, 2, '2026-01-02'), grp('ps', 'Sub', 'p', 1, '2026-01-03')];
	const tasks = [
		mkTask({ id: 'a', group_id: 'w', title: 'A', sort: 1 }),
		mkTask({ id: 'b', group_id: 'w', title: 'B', sort: 2, priority: 3 }),
		mkTask({ id: 'b1', group_id: null, parent_id: 'b', title: 'B1', sort: 1 }),
		mkTask({ id: 'c', group_id: 'p', title: 'C', sort: 1, priority: 2 }),
		mkTask({ id: 'd', group_id: 'ps', title: 'D', sort: 1 }),
		mkTask({ id: 'e', group_id: null, title: 'E', sort: 1 })
	];
	const m = buildGraph(input({ groups, tasks }));
	const node = (key: string) => m.nodes.find((n) => n.key === key)!;

	it('crea un nodo per gruppo, per task e per il gruppo «Senza gruppo»', () => {
		expect(m.nodes.filter((n) => n.kind === 'group').map((n) => n.id)).toEqual(['w', 'p', 'ps', UNGROUPED]);
		expect(m.nodes.filter((n) => n.kind === 'task').length).toBe(6);
		expect(node('g:').name).toBe('Senza gruppo');
	});
	it('i gruppi radice stanno in orizzontale, da sinistra a destra, a y = 0', () => {
		const roots = m.nodes.filter((n) => n.kind === 'group' && n.root);
		expect(roots.every((r) => r.y === 0)).toBe(true);
		for (let i = 1; i < roots.length; i++) expect(roots[i].x).toBeGreaterThanOrEqual(roots[i - 1].x + roots[i - 1].w + L.COL_GAP);
	});
	it('nessun nodo si sovrappone a un altro', () => {
		for (let i = 0; i < m.nodes.length; i++) for (let j = i + 1; j < m.nodes.length; j++) expect(overlap(m.nodes[i], m.nodes[j])).toBe(false);
	});
	it('i figli stanno sotto e a destra del padre; i sotto-task sono annidati', () => {
		const w = node('g:w');
		for (const k of ['t:a', 't:b']) {
			expect(node(k).y).toBeGreaterThan(w.y + w.h);
			expect(node(k).x).toBe(w.x + L.GROUP_INDENT);
		}
		const b = node('t:b');
		const b1 = node('t:b1');
		expect(b1.y).toBeGreaterThan(b.y + b.h);
		expect(b1.x).toBe(b.x + L.TASK_INDENT);
		expect(b1.parentTaskId).toBe('b');
	});
	it('sottogruppi e task prima nei sottogruppi, poi i task (come nella Lista)', () => {
		const ps = node('g:ps');
		const c = node('t:c');
		expect(ps.y).toBeLessThan(c.y);
		expect(ps.root).toBe(false);
		expect(node('t:d').x).toBe(ps.x + L.GROUP_INDENT);
	});
	it('i colori sono quelli del gruppo radice; radici diverse hanno colori diversi', () => {
		expect(node('g:w').color).toBe(0);
		expect(node('g:p').color).toBe(1);
		expect(node('g:ps').color).toBe(1);
		expect(node('t:d').color).toBe(1);
		expect(node('t:b1').color).toBe(0);
		expect(node('g:').color).toBe(2);
	});
	it('un connettore per ogni nodo non radice, più i collegamenti tra le radici', () => {
		const nonRoot = m.nodes.filter((n) => !(n.kind === 'group' && n.root)).length;
		const roots = m.nodes.filter((n) => n.kind === 'group' && n.root).length;
		expect(m.edges.length).toBe(nonRoot + (roots - 1));
		expect(new Set(m.edges.map((e) => e.key)).size).toBe(m.edges.length);
	});
	it('contatori: solo task aperti, sottogruppi inclusi; priorità a parte', () => {
		expect(node('g:w').count).toEqual({ total: 2, high: 1, medium: 0 });
		expect(node('g:p').count).toEqual({ total: 2, high: 0, medium: 1 });
		expect(node('g:ps').count).toEqual({ total: 1, high: 0, medium: 0 });
	});
	it('ordine dei task = ordine di disegno; dimensioni del grafo coprono tutti i nodi', () => {
		expect(m.taskOrder).toEqual(['a', 'b', 'b1', 'd', 'c', 'e']); // i sottogruppi (con i loro task) precedono i task del gruppo
		for (const n of m.nodes) {
			expect(n.x + n.w).toBeLessThanOrEqual(m.width);
			expect(n.y + n.h).toBeLessThanOrEqual(m.height);
		}
	});
	it('numerazione progressiva tra i fratelli, ignorando i completati', () => {
		const t2 = [
			mkTask({ id: 'x1', group_id: 'w', sort: 1 }),
			mkTask({ id: 'x2', group_id: 'w', sort: 2, completed: true }),
			mkTask({ id: 'x3', group_id: 'w', sort: 3 })
		];
		const mm = buildGraph(input({ groups, tasks: t2 }));
		expect(mm.byTask.get('x1')!.num).toBe(1);
		expect(mm.byTask.get('x2')!.num).toBe(0);
		expect(mm.byTask.get('x3')!.num).toBe(2);
	});
});

describe('buildGraph: stati', () => {
	const groups = [grp('w', 'WORK'), grp('s', 'Sub', 'w')];
	const tasks = [mkTask({ id: 'a', group_id: 'w' }), mkTask({ id: 'b', group_id: 's' })];
	it('un gruppo compresso nasconde il contenuto ma mostra il contatore', () => {
		const m = buildGraph(input({ groups, tasks, collapsedGroups: new Set(['w']) }));
		expect(m.nodes.map((n) => n.key)).toEqual(['g:w']);
		expect(m.nodes[0].collapsed).toBe(true);
		expect(m.nodes[0].count!.total).toBe(2);
		expect(m.edges.length).toBe(0);
	});
	it('un task compresso nasconde i suoi sotto-task', () => {
		const t = [mkTask({ id: 'p', group_id: 'w' }), mkTask({ id: 'k', parent_id: 'p' })];
		const open = buildGraph(input({ groups, tasks: t }));
		const closed = buildGraph(input({ groups, tasks: t, collapsedTasks: new Set(['p']) }));
		expect(open.byTask.has('k')).toBe(true);
		expect(closed.byTask.has('k')).toBe(false);
		expect(closed.byTask.get('p')!.hasChildren).toBe(true);
		expect(closed.byTask.get('p')!.open).toBe(false);
	});
	it('senza «completati» sparisce il task finito, ma resta se ha discendenti aperti', () => {
		const t = [
			mkTask({ id: 'done', group_id: 'w', completed: true }),
			mkTask({ id: 'par', group_id: 'w', completed: true }),
			mkTask({ id: 'kid', parent_id: 'par' }),
			mkTask({ id: 'open', group_id: 'w' })
		];
		const m = buildGraph(input({ groups, tasks: t, showDone: false }));
		expect(m.byTask.has('done')).toBe(false);
		expect(m.byTask.has('par')).toBe(true);
		expect(m.byTask.has('kid')).toBe(true);
		expect(m.byTask.has('open')).toBe(true);
		expect(buildGraph(input({ groups, tasks: t, showDone: true })).byTask.has('done')).toBe(true);
	});
	it('«Senza gruppo» compare solo se serve; la riga di inserimento occupa un posto', () => {
		expect(buildGraph(input({ groups, tasks: [] })).nodes.some((n) => n.id === UNGROUPED)).toBe(false);
		expect(buildGraph(input({ groups, tasks: [mkTask({ id: 'z' })] })).nodes.some((n) => n.id === UNGROUPED)).toBe(true);
		const m = buildGraph(input({ groups, tasks, addingIn: 'w' }));
		const add = m.nodes.find((n) => n.kind === 'add')!;
		expect(add.id).toBe('w');
		expect(add.y).toBeLessThan(m.nodes.find((n) => n.key === 'g:s')!.y);
		for (let i = 0; i < m.nodes.length; i++) for (let j = i + 1; j < m.nodes.length; j++) expect(overlap(m.nodes[i], m.nodes[j])).toBe(false);
	});
	it('un gruppo vuoto compare comunque; senza dati il grafo è vuoto', () => {
		expect(buildGraph(input({ groups })).nodes.map((n) => n.key)).toEqual(['g:w', 'g:s']);
		const e = buildGraph(input());
		expect(e.nodes).toEqual([]);
		expect(e.width).toBe(0);
	});
	it('ordina i gruppi per `sort` e poi per nome', () => {
		const g = [grp('b', 'B', null, 2), grp('a2', 'Z', null, 1), grp('a1', 'A', null, 1)];
		expect(buildGraph(input({ groups: g })).nodes.map((n) => n.id)).toEqual(['a1', 'a2', 'b']);
	});
});

describe('connettori e dipendenze', () => {
	it('elbow: angolo arrotondato, mai oltre lo spazio disponibile', () => {
		expect(elbow(10, 20, 40, 100)).toBe('M10,20 V92 Q10,100 18,100 H40');
		expect(elbow(10, 20, 14, 100)).toBe('M10,20 V96 Q10,100 14,100 H14');
	});
	const groups = [grp('w', 'W'), grp('p', 'P', null, 2)];
	const tasks = [mkTask({ id: 'a', group_id: 'w', due_date: '2026-10-20' }), mkTask({ id: 'b', group_id: 'p', start_date: '2026-10-18' }), mkTask({ id: 'c', group_id: 'w', start_date: '2026-11-01' })];
	const m = buildGraph(input({ groups, tasks }));
	it('una freccia per ogni dipendenza tra task disegnati', () => {
		const e = depEdges(m, [{ task_id: 'b', depends_on_id: 'a', created_at: '' }, { task_id: 'b', depends_on_id: 'zzz', created_at: '' }]);
		expect(e.length).toBe(1);
		expect(e[0].key).toBe('a>b');
	});
	it('«in ritardo»: prerequisito non finito con scadenza dopo l’inizio di chi aspetta', () => {
		expect(depEdges(m, [{ task_id: 'b', depends_on_id: 'a', created_at: '' }])[0].late).toBe(true);
		expect(depEdges(m, [{ task_id: 'c', depends_on_id: 'a', created_at: '' }])[0].late).toBe(false);
		const done = buildGraph(input({ groups, tasks: tasks.map((t) => (t.id === 'a' ? { ...t, completed: true } : t)) }));
		expect(depEdges(done, [{ task_id: 'b', depends_on_id: 'a', created_at: '' }])[0].late).toBe(false);
	});
	it('depPath: S a destra tra colonne diverse; parentesi a destra nella stessa colonna', () => {
		const a = m.byTask.get('a')!;
		const b = m.byTask.get('b')!;
		const c = m.byTask.get('c')!;
		expect(depPath(a, b)).toMatch(/^M\d+,\d+ C/);
		const same = depPath(a, c);
		const bulge = a.x + a.w + 36;
		expect(same).toContain(`${bulge},`);
	});
});

describe('fitScale', () => {
	it('riduce per far stare il grafo, ma non ingrandisce oltre il massimo', () => {
		expect(fitScale(2000, 500, 1000, 800)).toBeCloseTo(0.5);
		expect(fitScale(400, 300, 1000, 800)).toBe(1);
		expect(fitScale(100000, 100000, 1000, 800)).toBe(0.2);
		expect(fitScale(0, 0, 1000, 800)).toBe(1);
	});
});

describe('graphToMermaid', () => {
	const groups = [grp('w', 'WORK', null, 1, '2026-01-01'), grp('s', 'Sub', 'w', 1, '2026-01-02'), grp('e', 'Vuoto', null, 2, '2026-01-03')];
	const tasks = [
		mkTask({ id: 'a', group_id: 'w', title: 'A "uno"', sort: 1, due_date: '2026-10-20', priority: 3 }),
		mkTask({ id: 'a1', parent_id: 'a', title: 'A1', sort: 1, completed: true }),
		mkTask({ id: 'b', group_id: 's', title: 'B', sort: 1, status: 'doing', milestone: true }),
		mkTask({ id: 'c', group_id: null, title: 'C', sort: 1 })
	];
	const deps = [{ task_id: 'b', depends_on_id: 'a', created_at: '' }];
	const gen = (over = {}) => graphToMermaid({ groups, tasks, showDone: true, ungroupedLabel: 'Senza gruppo', ...over }, deps, 'Titolo');

	it('è vuoto senza task', () => {
		expect(graphToMermaid({ groups, tasks: [], showDone: true, ungroupedLabel: 'x' }, [], 'T')).toBe('');
	});
	it('produce un flowchart con subgraph annidati, sotto-task e dipendenze', () => {
		const md = gen();
		expect(md).toContain('```mermaid');
		expect(md).toContain('flowchart LR');
		expect(md).toContain('subgraph g1["WORK"]');
		expect(md).toContain('subgraph g2["Sub"]');
		expect(md).toContain('subgraph g3["Senza gruppo"]');
		expect(md).not.toContain('Vuoto');
		expect(md).toContain('t2["A #quot;uno#quot;<br/>2026-10-20"]');
		expect(md).toMatch(/t2 --> t3/);
		expect(md).toMatch(/t2 -\.-> t1/);
		expect(md).toContain('t1{"B"}');
	});
	it('assegna le classi done / doing / crit', () => {
		const md = gen();
		expect(md).toContain('class t3 done');
		expect(md).toContain('class t1 doing');
		expect(md).toContain('class t2 crit');
	});
	it('rispetta «mostra completati»', () => {
		expect(gen({ showDone: false })).not.toContain('A1');
	});
});
