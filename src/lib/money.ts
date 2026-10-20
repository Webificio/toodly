/**
 * Economia dei task: costo uomo, spese, ricavi (netto, IVA, lordo) e margine.
 * Tutti gli importi sono interi in centesimi, nella valuta della lista del task.
 * - costo uomo = durata stimata × tariffa oraria (tariffa del task, altrimenti quella della lista);
 *   si calcola solo se la durata è stata impostata, per non inventare costi sui task senza stima;
 * - spese e ricavo sono al netto di IVA; l'IVA (aliquota del task, altrimenti quella della lista) si applica solo al ricavo;
 * - margine = ricavo netto − (costo uomo + spese).
 */
import type { Task } from './types';

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'PLN'] as const;
export const DEFAULT_CURRENCY = 'EUR';
export const DEFAULT_VAT = 22;
export const VAT_RATES = [0, 4, 5, 10, 22] as const;
export const MAX_CENTS = 1e12;

export interface ListMoney {
	currency?: string | null;
	rate_cents?: number | null;
	vat_rate?: number | null;
}
export type TaskMoney = Pick<Task, 'duration_min' | 'rate_cents' | 'expense_cents' | 'revenue_cents' | 'vat_rate'>;

export interface Figures {
	labor: number;
	expense: number;
	/** labor + expense */
	cost: number;
	net: number;
	vat: number;
	gross: number;
	margin: number;
}
export type Totals = Map<string, Figures>;

export const zeroFigures = (): Figures => ({ labor: 0, expense: 0, cost: 0, net: 0, vat: 0, gross: 0, margin: 0 });
export function addFigures(a: Figures, b: Figures): Figures {
	return { labor: a.labor + b.labor, expense: a.expense + b.expense, cost: a.cost + b.cost, net: a.net + b.net, vat: a.vat + b.vat, gross: a.gross + b.gross, margin: a.margin + b.margin };
}
export const hasMoney = (f: Figures) => f.cost !== 0 || f.net !== 0;

export const currencyOf = (list?: ListMoney | null) => list?.currency || DEFAULT_CURRENCY;
export const vatOf = (task: Pick<Task, 'vat_rate'>, list?: ListMoney | null) => task.vat_rate ?? list?.vat_rate ?? DEFAULT_VAT;
export const rateOf = (task: Pick<Task, 'rate_cents'>, list?: ListMoney | null) => task.rate_cents ?? list?.rate_cents ?? 0;

/** Importi di un singolo task (senza sotto-task). */
export function figuresOf(task: TaskMoney, list?: ListMoney | null): Figures {
	const labor = task.duration_min != null && task.duration_min > 0 ? Math.round((rateOf(task, list) * task.duration_min) / 60) : 0;
	const expense = task.expense_cents ?? 0;
	const net = task.revenue_cents ?? 0;
	const gross = Math.round(net * (1 + vatOf(task, list) / 100));
	return { labor, expense, cost: labor + expense, net, vat: gross - net, gross, margin: net - labor - expense };
}

/** Somma per valuta degli importi dei task indicati. */
export function totalsOf(tasks: Iterable<TaskMoney & { list_id: string | null }>, listOf: (id: string | null) => ListMoney | undefined): Totals {
	const out: Totals = new Map();
	for (const t of tasks) {
		const list = listOf(t.list_id);
		const f = figuresOf(t, list);
		if (!hasMoney(f)) continue;
		const cur = currencyOf(list);
		out.set(cur, addFigures(out.get(cur) ?? zeroFigures(), f));
	}
	return out;
}

/** Gruppo di un task: quello della sua radice (i sotto-task non hanno gruppo proprio). */
export function rootGroupId(task: Pick<Task, 'id' | 'parent_id' | 'group_id'>, byId: Map<string, Pick<Task, 'id' | 'parent_id' | 'group_id'>>): string | null {
	let cur = task;
	for (let i = 0; i < 50 && cur.parent_id; i++) {
		const p = byId.get(cur.parent_id);
		if (!p) break;
		cur = p;
	}
	return cur.group_id ?? null;
}

/**
 * Totali per gruppo: ogni task vale i propri importi e il totale di un gruppo è la somma dei suoi task
 * (sotto-task compresi) e di quelli dei sottogruppi. La chiave `null` è «nessun gruppo».
 */
export function economyByGroup<T extends TaskMoney & Pick<Task, 'id' | 'parent_id' | 'group_id' | 'list_id'>>(
	tasks: T[],
	groups: { id: string; parent_id: string | null }[],
	listOf: (id: string | null) => ListMoney | undefined
): Map<string | null, Totals> {
	const byId = new Map(tasks.map((t) => [t.id, t as Pick<Task, 'id' | 'parent_id' | 'group_id'>]));
	const known = new Set(groups.map((g) => g.id));
	const own = new Map<string | null, T[]>();
	for (const t of tasks) {
		let g = rootGroupId(t, byId);
		if (g && !known.has(g)) g = null;
		const a = own.get(g) ?? [];
		a.push(t);
		own.set(g, a);
	}
	const kids = new Map<string, string[]>();
	for (const g of groups) if (g.parent_id && known.has(g.parent_id)) kids.set(g.parent_id, [...(kids.get(g.parent_id) ?? []), g.id]);
	const out = new Map<string | null, Totals>();
	const merge = (into: Totals, from: Totals) => {
		for (const [c, f] of from) into.set(c, addFigures(into.get(c) ?? zeroFigures(), f));
	};
	const calc = (id: string, depth = 0): Totals => {
		const done = out.get(id);
		if (done) return done;
		const tot = totalsOf(own.get(id) ?? [], listOf);
		out.set(id, tot);
		if (depth < 50) for (const k of kids.get(id) ?? []) merge(tot, calc(k, depth + 1));
		return tot;
	};
	for (const g of groups) calc(g.id);
	out.set(null, totalsOf(own.get(null) ?? [], listOf));
	return out;
}

// ---- formato e lettura ----------------------------------------------------------

/** Interpreta un importo digitato. null = vuoto, undefined = non valido. `decimal` è il separatore decimale del locale. */
export function parseMoney(text: string, decimal: ',' | '.' = '.'): number | null | undefined {
	const s = text.trim().replace(/[\s\u00a0]/g, '').replace(/[€$£]/g, '').replace(/^([\d.,]+)[A-Za-z]{3}$/, '$1');
	if (s === '') return null;
	if (!/^[\d.,]+$/.test(s)) return undefined;
	const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
	let dec = -1;
	if (lastDot >= 0 && lastComma >= 0) dec = Math.max(lastDot, lastComma);
	else if (lastDot >= 0 || lastComma >= 0) {
		const sep = lastDot >= 0 ? '.' : ',';
		const idx = s.lastIndexOf(sep);
		const count = s.split(sep).length - 1;
		const after = s.length - idx - 1;
		if (count > 1) dec = -1;
		else if (sep === decimal) dec = idx;
		else dec = after === 3 ? -1 : idx;
	}
	const int = (dec < 0 ? s : s.slice(0, dec)).replace(/\D/g, '');
	const frac = dec < 0 ? '' : s.slice(dec + 1).replace(/\D/g, '');
	if (!int && !frac) return undefined;
	const cents = Number(int || '0') * 100 + Math.round(Number('0.' + (frac || '0')) * 100);
	return Math.min(MAX_CENTS, cents);
}

/** Testo del campo: «1250», «12,50» (senza simbolo di valuta). */
export function formatAmount(cents: number, decimal: ',' | '.' = '.'): string {
	const v = cents / 100;
	return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', decimal);
}

/** Importo con valuta nel formato del locale: «1.250,00 €». */
export function formatMoney(cents: number, currency: string, loc: string): string {
	try {
		return new Intl.NumberFormat(loc, { style: 'currency', currency }).format(cents / 100);
	} catch {
		return (cents / 100).toFixed(2) + ' ' + currency;
	}
}

/** Simbolo della valuta nel locale («€», «$»). */
export function currencySymbol(currency: string, loc: string): string {
	try {
		return new Intl.NumberFormat(loc, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
	} catch {
		return currency;
	}
}

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface Summary {
	/** margine (o, senza ricavi, costo cambiato di segno) per valuta, separati da « · » */
	text: string;
	tip: string;
	tone: 'pos' | 'neg' | 'none';
}

/** Dettaglio degli importi su una riga (per i tooltip). */
export function detailLine(f: Figures, currency: string, tr: Translate, loc: string): string {
	return [
		tr('Costo uomo {x}', { x: formatMoney(f.labor, currency, loc) }),
		tr('Spese {x}', { x: formatMoney(f.expense, currency, loc) }),
		tr('Ricavi netti {x}', { x: formatMoney(f.net, currency, loc) }),
		tr('IVA {x}', { x: formatMoney(f.vat, currency, loc) }),
		tr('Ricavi lordi {x}', { x: formatMoney(f.gross, currency, loc) }),
		tr('Margine {x}', { x: formatMoney(f.margin, currency, loc) })
	].join(' · ');
}

/** Chip di un task: il margine se ha un ricavo, altrimenti il solo costo (neutro). Null se non ha importi. */
export function taskChip(task: TaskMoney, list: ListMoney | undefined, tr: Translate, loc: string): Summary | null {
	const f = figuresOf(task, list);
	if (!hasMoney(f)) return null;
	const c = currencyOf(list);
	const tip = detailLine(f, c, tr, loc);
	if (f.net > 0) return { text: formatMoney(f.margin, c, loc), tip, tone: f.margin < 0 ? 'neg' : 'pos' };
	return { text: formatMoney(f.cost, c, loc), tip, tone: 'none' };
}

/** Sintesi di una mappa di totali: testo breve per il badge e dettaglio per il tooltip. Null se non c'è nulla. */
export function summarize(totals: Totals, tr: Translate, loc: string): Summary | null {
	const cur = [...totals.keys()].sort();
	if (!cur.length) return null;
	const text: string[] = [];
	const tip: string[] = [];
	let neg = false, pos = false;
	for (const c of cur) {
		const f = totals.get(c)!;
		text.push(formatMoney(f.margin, c, loc));
		if (f.net > 0) (f.margin < 0 ? (neg = true) : (pos = true));
		tip.push(detailLine(f, c, tr, loc));
	}
	return { text: text.join(' · '), tip: tip.join('\n'), tone: neg ? 'neg' : pos ? 'pos' : 'none' };
}

/** Solo i ricavi netti per valuta («8.000 €»), con il dettaglio nel tooltip. Null se non ci sono ricavi. */
export function summarizeRevenue(totals: Totals, tr: Translate, loc: string): Summary | null {
	const cur = [...totals.keys()].sort().filter((c) => totals.get(c)!.net > 0);
	if (!cur.length) return null;
	return {
		text: cur.map((c) => formatMoney(totals.get(c)!.net, c, loc)).join(' · '),
		tip: cur.map((c) => detailLine(totals.get(c)!, c, tr, loc)).join('\n'),
		tone: 'none'
	};
}
