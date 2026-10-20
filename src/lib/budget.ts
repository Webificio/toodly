/**
 * Logica pura della vista «Budget»: ricavi, costi e margine per gruppo e per periodo (scadenza del task).
 * Per ogni gruppo: una colonna per periodo visibile, «Fuori periodo» (con data ma fuori dall'intervallo),
 * «Senza data» e il totale generale.
 */
import { addDays, addMonths, startOfMonth, startOfWeek } from './dates';
import { addFigures, currencyOf, figuresOf, formatAmount, hasMoney, rootGroupId, zeroFigures, type Figures, type ListMoney } from './money';
import type { Task } from './types';

export type Gran = 'week' | 'month';
export interface Period {
	key: string;
	from: string;
	to: string; // incluso
}

export function periodAnchor(iso: string, gran: Gran): string {
	return gran === 'week' ? startOfWeek(iso) : startOfMonth(iso);
}

/** Primo giorno del periodo spostato di `offset` periodi (anche negativi) rispetto a quello che contiene `iso`. */
export function shiftPeriod(iso: string, gran: Gran, offset: number): string {
	const start = periodAnchor(iso, gran);
	return gran === 'week' ? addDays(start, 7 * offset) : addMonths(start, offset);
}

/** `n` periodi consecutivi a partire dal periodo che contiene `anchor`. */
export function periodsFrom(anchor: string, gran: Gran, n: number): Period[] {
	const start = periodAnchor(anchor, gran);
	const out: Period[] = [];
	for (let i = 0; i < n; i++) {
		const from = gran === 'week' ? addDays(start, 7 * i) : addMonths(start, i);
		const next = gran === 'week' ? addDays(start, 7 * (i + 1)) : addMonths(start, i + 1);
		out.push({ key: from, from, to: addDays(next, -1) });
	}
	return out;
}

export interface BudgetCells {
	periods: Figures[];
	outside: Figures;
	undated: Figures;
	total: Figures;
}
export interface BudgetRow {
	/** id del gruppo, null = «nessun gruppo» */
	id: string | null;
	depth: number;
	cells: BudgetCells;
}
export interface BudgetModel {
	periods: Period[];
	rows: BudgetRow[];
	total: BudgetCells;
	/** valute presenti (con importi) tra i task considerati */
	currencies: string[];
}

const emptyCells = (n: number): BudgetCells => ({ periods: Array.from({ length: n }, zeroFigures), outside: zeroFigures(), undated: zeroFigures(), total: zeroFigures() });
function addCells(a: BudgetCells, b: BudgetCells) {
	a.periods = a.periods.map((f, i) => addFigures(f, b.periods[i]));
	a.outside = addFigures(a.outside, b.outside);
	a.undated = addFigures(a.undated, b.undated);
	a.total = addFigures(a.total, b.total);
}
const nonZero = (c: BudgetCells) => hasMoney(c.total);

export function buildBudget(opts: {
	tasks: Task[];
	groups: { id: string; parent_id: string | null; sort: number; name: string }[];
	listOf: (id: string | null) => ListMoney | undefined;
	periods: Period[];
	currency: string;
	showDone: boolean;
}): BudgetModel {
	const { periods, currency } = opts;
	const tasks = opts.tasks.filter((t) => opts.showDone || !t.completed);
	const byId = new Map(tasks.map((t) => [t.id, t]));
	const known = new Set(opts.groups.map((g) => g.id));
	const own = new Map<string | null, BudgetCells>();
	const currencies = new Set<string>();
	for (const t of tasks) {
		const list = opts.listOf(t.list_id);
		const f = figuresOf(t, list);
		if (!hasMoney(f)) continue;
		const cur = currencyOf(list);
		currencies.add(cur);
		if (cur !== currency) continue;
		let g = rootGroupId(t, byId);
		if (g && !known.has(g)) g = null;
		const cells = own.get(g) ?? emptyCells(periods.length);
		own.set(g, cells);
		if (!t.due_date) cells.undated = addFigures(cells.undated, f);
		else {
			const i = periods.findIndex((p) => t.due_date! >= p.from && t.due_date! <= p.to);
			if (i >= 0) cells.periods[i] = addFigures(cells.periods[i], f);
			else cells.outside = addFigures(cells.outside, f);
		}
		cells.total = addFigures(cells.total, f);
	}
	const kids = (parent: string | null) =>
		opts.groups.filter((g) => (g.parent_id && known.has(g.parent_id) ? g.parent_id : null) === parent).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
	const rolled = new Map<string, BudgetCells>();
	const roll = (id: string, depth = 0): BudgetCells => {
		const done = rolled.get(id);
		if (done) return done;
		const c = emptyCells(periods.length);
		if (own.has(id)) addCells(c, own.get(id)!);
		rolled.set(id, c);
		if (depth < 50) for (const k of kids(id)) addCells(c, roll(k.id, depth + 1));
		return c;
	};
	const rows: BudgetRow[] = [];
	const total = emptyCells(periods.length);
	const walk = (parent: string | null, depth: number) => {
		for (const g of kids(parent)) {
			const c = roll(g.id);
			if (nonZero(c)) rows.push({ id: g.id, depth, cells: c });
			if (depth === 0) addCells(total, c);
			walk(g.id, depth + 1);
		}
	};
	walk(null, 0);
	const loose = own.get(null);
	if (loose && nonZero(loose)) {
		rows.push({ id: null, depth: 0, cells: loose });
		addCells(total, loose);
	}
	return { periods, rows, total, currencies: [...currencies].sort() };
}

// ---- CSV ---------------------------------------------------------------------------

export interface CsvTask {
	task: Task;
	group: string;
	list: string;
	listMoney?: ListMoney;
}

function csvCell(v: string, sep: string): string {
	return /["\r\n]/.test(v) || v.includes(sep) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

/** CSV dei task con importi: separatore «;» e virgola decimale in italiano, «,» e punto altrove. */
export function buildCsv(items: CsvTask[], headers: string[], loc: string): string {
	const it = loc.startsWith('it');
	const sep = it ? ';' : ',';
	const dec: ',' | '.' = it ? ',' : '.';
	const money = (c: number) => (c / 100).toFixed(2).replace('.', dec);
	const lines = [headers.map((h) => csvCell(h, sep)).join(sep)];
	for (const { task, group, list, listMoney } of items) {
		const f = figuresOf(task, listMoney);
		if (!hasMoney(f)) continue;
		const row = [
			task.title,
			group,
			list,
			task.due_date ?? '',
			currencyOf(listMoney),
			task.duration_min != null ? formatAmount(Math.round((task.duration_min * 100) / 60), dec) : '',
			money(f.labor),
			money(f.expense),
			money(f.net),
			String(task.vat_rate ?? listMoney?.vat_rate ?? 22).replace('.', dec),
			money(f.vat),
			money(f.gross),
			money(f.margin)
		];
		lines.push(row.map((c) => csvCell(c, sep)).join(sep));
	}
	return '﻿' + lines.join('\r\n') + '\r\n';
}
