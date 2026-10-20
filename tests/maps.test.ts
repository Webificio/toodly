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

import { buildCork, clampPos, corkEdges, noteSize, tilt } from '../src/lib/cork';

describe('Cork', () => {
	const ci = { groups, tasks, showDone: false, ungroupedLabel: 'Senza gruppo' };
	it('un gruppetto per gruppo radice, foglietti più grandi per priorità maggiore', () => {
		const m = buildCork(ci);
		expect(m.tags.map((g) => g.root)).toEqual(['w', 'p', UNGROUPED]);
		expect(m.byTask.has('e')).toBe(false);
		expect(noteSize(mkTask({ priority: 3 })).w).toBeGreaterThan(noteSize(mkTask({ priority: 0 })).w);
		expect(m.taskOrder.length).toBe(m.notes.length);
	});
	it('foglietti automatici non si sovrappongono', () => {
		const many = Array.from({ length: 30 }, (_, i) => mkTask({ id: 'n' + i, group_id: i % 2 ? 'w' : 'p', priority: (i % 4) as 0 | 1 | 2 | 3 }));
		const m = buildCork({ ...ci, tasks: many, showDone: true });
		for (let i = 0; i < m.notes.length; i++)
			for (let j = i + 1; j < m.notes.length; j++) expect(rectsOverlap(m.notes[i], m.notes[j])).toBe(false);
	});
	it('una posizione salvata vince su quella automatica', () => {
		const t = [mkTask({ id: 'a', group_id: 'w', board_x: 900, board_y: 700 })];
		const n = buildCork({ ...ci, tasks: t }).byTask.get('a')!;
		expect([n.x, n.y, n.auto]).toEqual([900, 700, false]);
		expect(buildCork({ ...ci, tasks: [mkTask({ id: 'b', group_id: 'w' })] }).byTask.get('b')!.auto).toBe(true);
	});
	it('la tavola cresce per contenere i foglietti spostati lontano', () => {
		const m = buildCork({ ...ci, tasks: [mkTask({ id: 'a', group_id: 'w', board_x: 3000, board_y: 2000 })] });
		expect(m.width).toBeGreaterThan(3000);
		expect(m.height).toBeGreaterThan(2000);
	});
	it('inclinazione stabile e contenuta; clampPos; fili', () => {
		expect(tilt('abc')).toBe(tilt('abc'));
		for (const id of ['a', 'zz', 'x12']) expect(Math.abs(tilt(id))).toBeLessThanOrEqual(3);
		expect(clampPos(-5, 10.6)).toEqual({ x: 0, y: 11 });
		const m = buildCork(ci);
		const e = corkEdges(m, [{ task_id: 'b', depends_on_id: 'a', created_at: '' }, { task_id: 'zz', depends_on_id: 'a', created_at: '' }]);
		expect(e.length).toBe(1);
		expect(e[0].late).toBe(true);
	});
});

import { buildRoad, camFor, persp } from '../src/lib/road';
describe('road', () => {
	const g = [] as any[];
	const base = { groups: g, showDone: false, today: '2026-10-19', cam: 0, horizon: 14, ungroupedLabel: 'x', width: 900, height: 600 };
	it('scala e ordine', () => {
		expect(persp(0, 14)).toBe(1);
		expect(persp(14, 14)).toBeLessThan(persp(7, 14));
		const m = buildRoad({ ...base, tasks: [mkTask({ id: 'a', due_date: '2026-10-19' }), mkTask({ id: 'b', due_date: '2026-10-26' }), mkTask({ id: 'c' }), mkTask({ id: 'd', due_date: '2027-03-01' })] });
		expect(m.items.map((i) => i.task.id)).toEqual(['b', 'a']);
		expect(m.taskOrder).toEqual(['a', 'b', 'c', 'd']);
		expect(m.rail.map((r) => r.why)).toEqual(['none', 'far']);
		expect(m.byTask.get('a')!.y).toBeGreaterThan(m.byTask.get('b')!.y);
	});
	it('scaduti in primo piano e camFor', () => {
		const m = buildRoad({ ...base, tasks: [mkTask({ id: 'a', due_date: '2026-10-15' })] });
		expect(m.items[0].over).toBe(true);
		expect(m.items[0].s).toBeGreaterThan(1);
		expect(camFor(30, 0, 14)).toBe(30);
		expect(camFor(5, 0, 14)).toBe(0);
		expect(camFor(-3, 0, 14)).toBe(0);
	});
	it('sfalsa le schede vicine nella stessa corsia', () => {
		const m = buildRoad({ ...base, tasks: [mkTask({ id: 'a', due_date: '2026-10-20' }), mkTask({ id: 'b', due_date: '2026-10-20' })] });
		expect(Math.abs(m.items[0].y - m.items[1].y)).toBeGreaterThan(10);
	});
});

import { squarify, weight } from '../src/lib/mosaic';
describe('mosaic', () => {
	it('squarify riempie l\'area senza sovrapposizioni', () => {
		const tiles = squarify([{ id: 'a', v: 5 }, { id: 'b', v: 3 }, { id: 'c', v: 2 }, { id: 'd', v: 1 }], 0, 0, 400, 300);
		expect(tiles.reduce((s, t) => s + t.w * t.h, 0)).toBeCloseTo(120000, 0);
		expect(tiles[0].id).toBe('a');
		for (const t of tiles) expect(t.x + t.w).toBeLessThanOrEqual(400.001);
	});
	it('pesi', () => {
		const today = '2026-10-19';
		const hi = mkTask({ id: 'h', priority: 3, due_date: '2026-10-20' });
		const lo = mkTask({ id: 'l', priority: 0, due_date: '2026-12-01' });
		for (const m of ['priority', 'deadline', 'both'] as const) expect(weight(hi, today, m)).toBeGreaterThan(weight(lo, today, m));
		expect(weight(mkTask({ id: 'o', due_date: '2026-10-10' }), today, 'deadline')).toBeGreaterThan(weight(mkTask({ id: 'x', due_date: '2026-10-19' }), today, 'deadline'));
	});
});

import { buildRidge, durationOf, fmtDur, ridgePoints } from '../src/lib/ridge';
describe('ridge', () => {
	it('durata e formato', () => {
		expect(durationOf(mkTask({ id: 'a' }))).toBe(30);
		expect(durationOf(mkTask({ id: 'a', duration_min: 90 }))).toBe(90);
		expect(durationOf(mkTask({ id: 'a', start_time: '09:00', end_time: '10:15' }))).toBe(75);
		expect(fmtDur(90)).toBe('1h 30m');
		expect(fmtDur(120)).toBe('2h');
		expect(fmtDur(45)).toBe('45m');
	});
	it('carico per giorno, scaduti e senza data', () => {
		const m = buildRidge({
			tasks: [
				mkTask({ id: 'a', due_date: '2026-10-20', duration_min: 240 }),
				mkTask({ id: 'b', due_date: '2026-10-20', duration_min: 180 }),
				mkTask({ id: 'c', due_date: '2026-10-21' }),
				mkTask({ id: 'd', due_date: '2026-10-10' }),
				mkTask({ id: 'e' }),
				mkTask({ id: 'f', due_date: '2026-10-20', completed: true })
			],
			today: '2026-10-19', offset: 0, span: 7, capMin: 360, showDone: false
		});
		expect(m.days[0].key).toBe('late');
		const d20 = m.days.find((d) => d.key === '2026-10-20')!;
		expect(d20.minutes).toBe(420);
		expect(d20.over).toBe(true);
		expect(m.days.find((d) => d.key === '2026-10-21')!.minutes).toBe(30);
		expect(m.undated).toBe(1);
		expect(m.peak).toBe(420);
		expect(ridgePoints([60, 120], 0, 100, 500, 40)[0]).toEqual([0, 500]);
	});
});

import { buildGrove, leafColor } from '../src/lib/grove';
describe('grove', () => {
	it('colori per scadenza', () => {
		expect(leafColor(-1)).toBe('#c2410c');
		expect(leafColor(1)).toBe('#f59e0b');
		expect(leafColor(30)).toBe('#16a34a');
		expect(leafColor(null)).toBe('#7d8f78');
	});
	it('foglie, frutti e foglie cadute', () => {
		const m = buildGrove({
			groups: [], today: '2026-10-19', showDone: true, ungroupedLabel: 'x',
			tasks: [mkTask({ id: 'a', due_date: '2026-10-25' }), mkTask({ id: 'b', due_date: '2026-10-01' }), mkTask({ id: 'c', completed: true })]
		});
		expect(m.byTask.get('a')!.kind).toBe('leaf');
		expect(m.byTask.get('b')!.kind).toBe('fallen');
		expect(m.byTask.get('b')!.y).toBeGreaterThan(m.ground);
		expect(m.byTask.get('c')!.kind).toBe('fruit');
		expect(m.trees).toHaveLength(1);
		expect(m.trees[0].done).toBe(1);
	});
});

import { blockRange, buildSlotDay, firstFit, freeSlots, layoutColumns, placePatch, snap } from '../src/lib/slot';
describe('slot', () => {
	it('intervalli e durata', () => {
		expect(blockRange(mkTask({ id: 'a' }))).toBeNull();
		expect(blockRange(mkTask({ id: 'a', start_time: '10:00', end_time: '11:30' }))).toEqual({ start: 600, end: 690 });
		expect(blockRange(mkTask({ id: 'a', start_time: '10:00', duration_min: 45 }))).toEqual({ start: 600, end: 645 });
		expect(blockRange(mkTask({ id: 'a', start_time: '10:00' }))).toEqual({ start: 600, end: 630 });
		expect(snap(607)).toBe(600);
		expect(snap(608)).toBe(615);
	});
	it('colonne per blocchi sovrapposti', () => {
		const l = layoutColumns([{ start: 600, end: 660 }, { start: 630, end: 700 }, { start: 720, end: 780 }]);
		expect(l[0]).toEqual({ col: 0, cols: 2 });
		expect(l[1]).toEqual({ col: 1, cols: 2 });
		expect(l[2]).toEqual({ col: 0, cols: 1 });
	});
	it('spazi liberi e primo che entra', () => {
		const f = freeSlots([{ start: 9 * 60, end: 10 * 60 }, { start: 14 * 60, end: 15 * 60 }]);
		expect(f).toEqual([{ start: 480, end: 540 }, { start: 600, end: 840 }, { start: 900, end: 1140 }]);
		expect(firstFit(f, 90)).toBe(600);
		expect(firstFit(f, 45)).toBe(480);
		expect(firstFit(f, 300)).toBeNull();
	});
	it('giornata: blocchi, vassoio, pianificato', () => {
		const d = buildSlotDay(
			[
				mkTask({ id: 'a', due_date: '2026-10-19', start_time: '09:00', end_time: '10:00' }),
				mkTask({ id: 'b', due_date: '2026-10-19' }),
				mkTask({ id: 'c', due_date: '2026-10-10' }),
				mkTask({ id: 'd' }),
				mkTask({ id: 'e', due_date: '2026-10-20', start_time: '09:00' })
			],
			'2026-10-19', '2026-10-19', true
		);
		expect(d.blocks.map((b) => b.task.id)).toEqual(['a']);
		expect(d.tray.due.map((t) => t.id)).toEqual(['b']);
		expect(d.tray.late.map((t) => t.id)).toEqual(['c']);
		expect(d.tray.none.map((t) => t.id)).toEqual(['d']);
		expect(d.planned).toBe(60);
		expect(placePatch(mkTask({ id: 'x' }), '2026-10-19', 600, 90)).toEqual({ due_date: '2026-10-19', start_time: '10:00', end_time: '11:30' });
	});
});

import { describeDuration, formatHours, normalizeMinutes, parseHours, splitDuration } from '../src/lib/duration';
describe('durata stimata', () => {
	const tr = (k: string, p?: Record<string, string | number>) => (p ? k.replace(/\{(\w+)\}/g, (_, n) => String(p[n])) : k);
	it('parsing delle ore', () => {
		expect(parseHours('')).toBeNull();
		expect(parseHours('0.5')).toBe(30);
		expect(parseHours('1,5')).toBe(90);
		expect(parseHours('8 h')).toBe(480);
		expect(parseHours('1.2')).toBe(60); // arrotondato alla mezz'ora
		expect(parseHours('0')).toBe(30); // minimo mezz'ora
		expect(parseHours('abc')).toBeUndefined();
		expect(parseHours('1.2.3')).toBeUndefined();
		expect(parseHours('-2')).toBeUndefined();
		expect(parseHours('99999')).toBe(2000 * 60);
	});
	it('formato del campo e normalizzazione', () => {
		expect(formatHours(30)).toBe('0.5');
		expect(formatHours(90, ',')).toBe('1,5');
		expect(formatHours(45)).toBe('0.75');
		expect(formatHours(480)).toBe('8');
		expect(normalizeMinutes(10)).toBe(30);
	});
	it('scomposizione con giorni da 8 h, settimane da 5 giorni, mesi da 20 giorni', () => {
		expect(splitDuration(172.5 * 60)).toEqual({ months: 1, weeks: 0, days: 1, hours: 4, minutes: 30 });
		expect(splitDuration(40 * 60)).toEqual({ months: 0, weeks: 1, days: 0, hours: 0, minutes: 0 });
	});
	it('testo leggibile', () => {
		expect(describeDuration(30, tr, 'it')).toBe('30 min');
		expect(describeDuration(90, tr, 'it')).toBe('1 h 30 min');
		expect(describeDuration(480, tr, 'it')).toBe('{n} giorno'.replace('{n}', '1'));
		expect(describeDuration(720, tr, 'it')).toBe('1 giorno e 4 h');
		expect(describeDuration(960, tr, 'it')).toBe('2 giorni');
		expect(describeDuration(172.5 * 60, tr, 'it')).toBe('1 mese, 1 giorno e 4 h 30 min');
		expect(describeDuration(40 * 60, tr, 'en')).toBe('1 settimana');
		expect(describeDuration(80 * 60, tr, 'en')).toBe('2 settimane');
	});
});

import { economyByGroup, figuresOf, formatAmount, formatMoney, parseMoney, summarize, totalsOf } from '../src/lib/money';
import { buildBudget, buildCsv, periodsFrom, shiftPeriod } from '../src/lib/budget';
describe('economia', () => {
	const eur = { currency: 'EUR', rate_cents: 5000, vat_rate: 22 };
	const usd = { currency: 'USD', rate_cents: null, vat_rate: 0 };
	const listOf = (id: string | null) => (id === 'l1' ? eur : id === 'l2' ? usd : undefined);
	it('importi digitati', () => {
		expect(parseMoney('')).toBeNull();
		expect(parseMoney('1250')).toBe(125000);
		expect(parseMoney('12,5', ',')).toBe(1250);
		expect(parseMoney('12.5', ',')).toBe(1250);
		expect(parseMoney('1.250,50', ',')).toBe(125050);
		expect(parseMoney('1,250.50', '.')).toBe(125050);
		expect(parseMoney('1.250', ',')).toBe(125000); // migliaia nel locale con la virgola
		expect(parseMoney('€ 99')).toBe(9900);
		expect(parseMoney('abc')).toBeUndefined();
		expect(parseMoney('-5')).toBeUndefined();
		expect(formatAmount(125050, ',')).toBe('1250,50');
		expect(formatAmount(125000)).toBe('1250');
	});
	it('costo, IVA e margine di un task', () => {
		const f = figuresOf(mkTask({ id: 'a', duration_min: 90, expense_cents: 2000, revenue_cents: 20000 }), eur);
		expect(f).toEqual({ labor: 7500, expense: 2000, cost: 9500, net: 20000, vat: 4400, gross: 24400, margin: 10500 });
		// senza durata niente costo uomo; tariffa del task e aliquota del task prevalgono su quelle della lista
		expect(figuresOf(mkTask({ id: 'b' }), eur).labor).toBe(0);
		const g = figuresOf(mkTask({ id: 'c', duration_min: 60, rate_cents: 10000, revenue_cents: 10000, vat_rate: 10 }), eur);
		expect(g.labor).toBe(10000);
		expect(g.vat).toBe(1000);
		expect(formatMoney(1250050, 'EUR', 'it')).toContain('12.500,50');
	});
	it('totali per valuta e per gruppo (sottogruppi e sotto-task compresi)', () => {
		const tasks = [
			mkTask({ id: 'p', list_id: 'l1', group_id: 'g1', revenue_cents: 10000 }),
			mkTask({ id: 's', list_id: 'l1', parent_id: 'p', group_id: null, duration_min: 60 }), // sotto-task: gruppo del padre
			mkTask({ id: 'c', list_id: 'l1', group_id: 'g2', expense_cents: 500 }),
			mkTask({ id: 'u', list_id: 'l2', group_id: 'g1', revenue_cents: 700 }),
			mkTask({ id: 'n', list_id: 'l1', group_id: null, revenue_cents: 100 })
		];
		const groups = [{ id: 'g1', parent_id: null }, { id: 'g2', parent_id: 'g1' }];
		const m = economyByGroup(tasks, groups, listOf);
		const g1 = m.get('g1')!;
		expect(g1.get('EUR')!.net).toBe(10000);
		expect(g1.get('EUR')!.cost).toBe(5000 + 500); // 1 h × 50 + spese del sottogruppo
		expect(g1.get('USD')!.net).toBe(700);
		expect(m.get('g2')!.get('EUR')!.cost).toBe(500);
		expect(m.get(null)!.get('EUR')!.net).toBe(100);
		expect(totalsOf(tasks, listOf).get('EUR')!.net).toBe(10100);
		const s = summarize(g1, (k, p) => (p ? k.replace(/\{(\w+)\}/g, (_, n) => String(p[n])) : k), 'it')!;
		expect(s.tone).toBe('pos');
		expect(s.text.split(' · ')).toHaveLength(2); // una voce per valuta
	});
	it('periodi e budget', () => {
		const ps = periodsFrom('2026-10-20', 'month', 3);
		expect(ps.map((p) => p.from)).toEqual(['2026-10-01', '2026-11-01', '2026-12-01']);
		expect(ps[0].to).toBe('2026-10-31');
		expect(periodsFrom('2026-10-20', 'week', 1)[0]).toEqual({ key: '2026-10-19', from: '2026-10-19', to: '2026-10-25' });
		expect(shiftPeriod('2026-10-20', 'month', -2)).toBe('2026-08-01');
		const tasks = [
			mkTask({ id: 'a', list_id: 'l1', group_id: 'g', due_date: '2026-10-05', revenue_cents: 1000 }),
			mkTask({ id: 'b', list_id: 'l1', group_id: 'g', due_date: '2026-11-10', expense_cents: 400 }),
			mkTask({ id: 'c', list_id: 'l1', group_id: 'g', due_date: '2027-05-01', revenue_cents: 50 }),
			mkTask({ id: 'd', list_id: 'l1', group_id: null, revenue_cents: 7 }),
			mkTask({ id: 'e', list_id: 'l1', group_id: 'g', due_date: '2026-10-06', revenue_cents: 99, completed: true }),
			mkTask({ id: 'x', list_id: 'l2', group_id: 'g', due_date: '2026-10-05', revenue_cents: 5 })
		];
		const groups = [{ id: 'g', parent_id: null, sort: 1, name: 'G' }];
		const m = buildBudget({ tasks, groups, listOf, periods: ps, currency: 'EUR', showDone: false });
		expect(m.currencies).toEqual(['EUR', 'USD']);
		expect(m.rows.map((r) => r.id)).toEqual(['g', null]);
		const row = m.rows[0].cells;
		expect(row.periods[0].net).toBe(1000);
		expect(row.periods[1].expense).toBe(400);
		expect(row.outside.net).toBe(50);
		expect(m.rows[1].cells.undated.net).toBe(7);
		expect(m.total.total.net).toBe(1057);
		expect(buildBudget({ tasks, groups, listOf, periods: ps, currency: 'EUR', showDone: true }).total.total.net).toBe(1156);
	});
	it('CSV', () => {
		const t1 = mkTask({ id: 'a', title: 'Prova; "x"', list_id: 'l1', duration_min: 90, revenue_cents: 10000 });
		const csv = buildCsv([{ task: t1, group: 'G', list: 'L', listMoney: eur }], ['A', 'B'], 'it');
		const lines = csv.replace('﻿', '').trim().split('\r\n');
		expect(lines[1]).toBe('"Prova; ""x""";G;L;;EUR;1,50;75,00;0,00;100,00;22;22,00;122,00;25,00');
	});
});

import { summarizeRevenue, taskChip } from '../src/lib/money';
import { buildMosaic as buildMosaicAmount } from '../src/lib/mosaic';
describe('economia nelle viste', () => {
	const tr = (k: string, p?: Record<string, string | number>) => (p ? k.replace(/\{(\w+)\}/g, (_, n) => String(p[n])) : k);
	const eur = { currency: 'EUR', rate_cents: 5000, vat_rate: 22 };
	it('chip del task', () => {
		expect(taskChip(mkTask({ id: 'a' }), eur, tr, 'it')).toBeNull();
		const withRev = taskChip(mkTask({ id: 'a', duration_min: 60, revenue_cents: 20000 }), eur, tr, 'it')!;
		expect(withRev.tone).toBe('pos');
		expect(withRev.text).toContain('150');
		const loss = taskChip(mkTask({ id: 'a', duration_min: 120, revenue_cents: 5000 }), eur, tr, 'it')!;
		expect(loss.tone).toBe('neg');
		const costOnly = taskChip(mkTask({ id: 'a', expense_cents: 2500 }), eur, tr, 'it')!;
		expect(costOnly.tone).toBe('none');
		expect(costOnly.text).toContain('25');
		expect(costOnly.text).not.toContain('-');
	});
	it('solo ricavi per valuta', () => {
		const t = totalsOf([mkTask({ id: 'a', revenue_cents: 1000 }), mkTask({ id: 'b', expense_cents: 500 })], () => eur);
		const s = summarizeRevenue(t, tr, 'it')!;
		expect(s.text).toContain('10');
		expect(summarizeRevenue(totalsOf([mkTask({ id: 'c', expense_cents: 500 })], () => eur), tr, 'it')).toBeNull();
	});
	it('mosaico per importo', () => {
		const tasks = [mkTask({ id: 'big', revenue_cents: 90000 }), mkTask({ id: 'small', revenue_cents: 10000 }), mkTask({ id: 'none' })];
		const tiles = buildMosaicAmount(tasks, '2026-10-20', 'amount', false, 400, 200, (x) => x.revenue_cents ?? 0);
		const area = (id: string) => { const q = tiles.find((x) => x.id === id)!; return q.w * q.h; };
		expect(tiles).toHaveLength(3); // il task senza importo resta visibile
		expect(area('big')).toBeGreaterThan(area('small') * 5);
		expect(area('none')).toBeGreaterThan(0);
	});
});
