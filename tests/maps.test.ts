import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/i18n.svelte', () => ({ t: (s: string) => s, locale: () => 'it', i18n: { lang: 'it' } }));

import { UNGROUPED, groupInfo, lateDep, pickLabels, polar, rectsOverlap, clip } from '../src/lib/maps';
import { BANDS, bandOf, buildOrbit, orbitEdges, sectorPath } from '../src/lib/orbit';
import { buildMetro, metroEdges } from '../src/lib/metro';
import type { Group } from '../src/lib/types';
import { mkTask } from './helpers';

const grp = (id: string, name: string, parent: string | null = null, sort = 0, created = '2026-01-01'): Group => ({ id, name, parent_id: parent, sort, created_at: created });
const groups = [grp('w', 'WORK', null, 1, '2026-01-01'), grp('p', 'PERS', null, 2, '2026-01-02'), grp('ps', 'Sub', 'p', 1, '2026-01-03')];
const today = '2026-06-10';
const tasks = [
	mkTask({ id: 'a', group_id: 'w', due_date: '2026-06-01', priority: 3 }),
	mkTask({ id: 'b', group_id: 'w', due_date: '2026-06-10' }),
	mkTask({ id: 'b1', group_id: null, parent_id: 'b', due_date: '2026-06-12' }),
	mkTask({ id: 'c', group_id: 'ps', due_date: '2026-06-25' }),
	mkTask({ id: 'd', group_id: null, due_date: null }),
	mkTask({ id: 'e', group_id: 'p', due_date: '2026-09-01', completed: true })
];

describe('groupInfo', () => {
	const gi = groupInfo(groups, tasks, 'Senza gruppo');
	it('assegna ogni task al gruppo radice (anche via sotto-gruppo e task padre)', () => {
		expect(gi.rootOf(tasks[2])).toBe('w');
		expect(gi.rootOf(tasks[3])).toBe('p');
		expect(gi.rootOf(tasks[4])).toBe(UNGROUPED);
		expect(gi.roots).toEqual(['w', 'p', UNGROUPED]);
	});
	it('nomi, colori e percorso', () => {
		expect(gi.name(UNGROUPED)).toBe('Senza gruppo');
		expect(gi.color('w')).toBe(0);
		expect(gi.color('p')).toBe(1);
		expect(gi.crumb(tasks[3])).toBe('PERS › Sub');
		expect(gi.crumb(tasks[4])).toBe('');
	});
});

describe('utilità', () => {
	it('lateDep: prerequisito aperto che scade dopo l\'inizio', () => {
		expect(lateDep(mkTask({ due_date: '2026-06-10' }), mkTask({ start_date: '2026-06-10' }))).toBe(true);
		expect(lateDep(mkTask({ due_date: '2026-06-09' }), mkTask({ start_date: '2026-06-10' }))).toBe(false);
		expect(lateDep(mkTask({ due_date: '2026-06-12', completed: true }), mkTask({ start_date: '2026-06-10' }))).toBe(false);
	});
	it('rectsOverlap, clip, polar', () => {
		expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
		expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
		expect(clip('abcdefghij', 5)).toBe('abcd…');
		const p = polar(100, 100, 50, 90);
		expect(Math.round(p.x)).toBe(150);
		expect(Math.round(p.y)).toBe(100);
	});
	it('pickLabels: salta le etichette che si toccano e rispetta il rango', () => {
		const r = (x: number) => ({ x, y: 0, w: 20, h: 10 });
		const s = pickLabels([{ id: 'a', rect: r(0), rank: 2 }, { id: 'b', rect: r(10), rank: 1 }, { id: 'c', rect: r(40), rank: 3 }], []);
		expect([...s].sort()).toEqual(['b', 'c']);
		expect([...pickLabels([{ id: 'a', rect: r(0), rank: 1 }], [{ id: 'z', ...r(5) }])]).toEqual([]);
	});
});

describe('Orbit', () => {
	it('bandOf', () => {
		expect([bandOf(-1), bandOf(0), bandOf(3), bandOf(7), bandOf(8), bandOf(30), bandOf(31), bandOf(null)]).toEqual(['late', 'today', 'week', 'week', 'month', 'month', 'later', 'none']);
	});
	const m = buildOrbit({ groups, tasks, today, showDone: false, ungroupedLabel: 'Senza gruppo' });
	it('esclude i completati se non richiesti e li include altrimenti', () => {
		expect(m.byTask.has('e')).toBe(false);
		expect(buildOrbit({ groups, tasks, today, showDone: true, ungroupedLabel: 'x' }).byTask.has('e')).toBe(true);
	});
	it('gli spicchi coprono 360° senza sovrapporsi', () => {
		expect(m.sectors.map((s) => s.root)).toEqual(['w', 'p', UNGROUPED]);
		for (let i = 1; i < m.sectors.length; i++) expect(m.sectors[i].start).toBeGreaterThanOrEqual(m.sectors[i - 1].end);
		expect(m.sectors[m.sectors.length - 1].end).toBeLessThanOrEqual(360);
	});
	it('ogni task sta nell\'anello della sua fascia e dentro il suo spicchio', () => {
		const n = m.byTask.get('a')!;
		expect(n.band).toBe('late');
		const d = Math.hypot(n.x - m.c, n.y - m.c);
		expect(Math.abs(d - BANDS[0].r)).toBeLessThan(30);
		expect(m.byTask.get('d')!.band).toBe('none');
		expect(m.taskOrder.length).toBe(m.nodes.length);
	});
	it('molti task non si sovrappongono', () => {
		const many = Array.from({ length: 40 }, (_, i) => mkTask({ id: 'x' + i, group_id: 'w', due_date: '2026-06-' + String(11 + (i % 3)) }));
		const mm = buildOrbit({ groups, tasks: many, today, showDone: true, ungroupedLabel: 'x' });
		for (let i = 0; i < mm.nodes.length; i++)
			for (let j = i + 1; j < mm.nodes.length; j++) expect(Math.hypot(mm.nodes[i].x - mm.nodes[j].x, mm.nodes[i].y - mm.nodes[j].y)).toBeGreaterThan(14);
	});
	it('archi di dipendenza e path di spicchio', () => {
		const e = orbitEdges(m, [{ task_id: 'b', depends_on_id: 'a', created_at: '' }, { task_id: 'zz', depends_on_id: 'a', created_at: '' }]);
		expect(e.length).toBe(1);
		expect(e[0].late).toBe(true);
		expect(sectorPath(100, 10, 50, 0, 90)).toMatch(/^M.*Z$/);
	});
});

describe('Metro', () => {
	const m = buildMetro({ groups, tasks, today, showDone: false, ungroupedLabel: 'Senza gruppo', lateLabel: 'Scaduti', noDateLabel: 'Senza data' });
	it('colonne: scaduti, date crescenti, senza data', () => {
		expect(m.cols.map((c) => c.key)).toEqual(['late', '2026-06-10', '2026-06-12', '2026-06-25', 'none']);
		for (let i = 1; i < m.cols.length; i++) expect(m.cols[i].x).toBeGreaterThan(m.cols[i - 1].x);
	});
	it('una linea per gruppo, stazioni sulla colonna della data', () => {
		expect(m.lines.map((l) => l.root)).toEqual(['w', 'p', UNGROUPED]);
		expect(m.byTask.get('a')!.x).toBe(m.cols[0].x);
		expect(m.byTask.get('b1')!.line).toBe(0);
		expect(m.byTask.get('b')!.y).toBe(m.lines[0].y);
	});
	it('oggi cade sulla colonna di oggi', () => {
		expect(m.todayX).toBe(m.cols[1].x);
	});
	it('stazioni dello stesso giorno e linea non si sovrappongono', () => {
		const same = [1, 2, 3].map((i) => mkTask({ id: 's' + i, group_id: 'w', due_date: '2026-06-11' }));
		const mm = buildMetro({ groups, tasks: same, today, showDone: true, ungroupedLabel: 'x', lateLabel: 'l', noDateLabel: 'n' });
		const ys = mm.stations.map((s) => s.y);
		expect(new Set(ys).size).toBe(3);
	});
	it('collegamenti', () => {
		const e = metroEdges(m, [{ task_id: 'c', depends_on_id: 'a', created_at: '' }]);
		expect(e[0].d).toMatch(/^M/);
		expect(e[0].late).toBe(true);
	});
});

import { orbitToMermaid } from '../src/lib/orbit';
import { metroToMermaid } from '../src/lib/metro';

describe('Mermaid', () => {
	const oi = { groups, tasks, today, showDone: false, ungroupedLabel: 'Senza gruppo' };
	it('Orbit: mindmap con gruppi → fasce → task', () => {
		const md = orbitToMermaid(oi, 'Tutti i task');
		expect(md).toContain('```mermaid\nmindmap');
		expect(md).toContain('root((Tutti i task))');
		expect(md).toMatch(/\["WORK · 3"\]/);
		expect(md).toContain('["Scaduti"]');
		expect(md).toContain('<br/>2026-06-01');
		expect(md).not.toContain('<br/>2026-09-01'); // completato escluso
		expect(orbitToMermaid({ ...oi, tasks: [] }, 'x')).toBe('');
	});
	const mi = { ...oi, lateLabel: 'Scaduti', noDateLabel: 'Senza data' };
	it('Metro: una linea per gruppo, stazioni concatenate, dipendenze tratteggiate, classi', () => {
		const md = metroToMermaid(mi, [{ task_id: 'c', depends_on_id: 'a', created_at: '' }], 'Tutti i task');
		expect(md).toContain('flowchart LR');
		expect(md).toContain('subgraph l1["WORK"]');
		expect(md).toMatch(/s1 --> s2/);
		expect(md).toMatch(/s1 -\.-> s\d/);
		expect(md).toContain('class s1 ');
		expect(metroToMermaid({ ...mi, tasks: [] }, [], 'x')).toBe('');
	});
});
