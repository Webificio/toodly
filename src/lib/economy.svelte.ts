/**
 * Economia nelle viste: interruttore per vista, totali per gruppo della vista corrente e chip dei task.
 * Tutto è inerte (e non calcola nulla) con «Economia» spenta o con la vista disattivata in Impostazioni.
 */
import { store } from './store.svelte';
import { nav } from './nav.svelte';
import { inScope } from './views';
import { uiprefs } from './uiprefs.svelte';
import { t, locale } from './i18n.svelte';
import { economyByGroup, summarize, summarizeRevenue, taskChip, totalsOf, type Summary } from './money';
import { UNGROUPED } from './graph';
import type { Task } from './types';

/** Viste e superfici in cui si possono mostrare gli importi (Impostazioni → Economia). */
export const ECONOMY_VIEWS = ['list', 'kanban', 'calendar', 'gantt', 'graph', 'orbit', 'metro', 'cork', 'road', 'matrix', 'mosaic', 'ridge', 'grove', 'slot', 'stats', 'sidebar'] as const;

/** Mostrare gli importi in questa vista (di default quella corrente)? */
export const ecoShow = (view?: string): boolean => uiprefs.showEconomy && !uiprefs.economyOff.includes(view ?? nav.mode);

class Eco {
	/** Totali per gruppo dei task della vista corrente (sottogruppi e sotto-task compresi); calcolati solo quando servono. */
	scoped = $derived(
		economyByGroup(
			store.tasks.filter((x) => inScope(x, nav.scope, store.filters, store.blockedIds)),
			store.groups,
			(id) => store.listOf(id)
		)
	);
}
export const eco = new Eco();

/** Margine di un gruppo nella vista corrente (null senza importi). */
export function groupMoney(id: string | null): Summary | null {
	const tot = eco.scoped.get(id);
	return tot ? summarize(tot, t, locale()) : null;
}
/** Chip di un task. */
export const chipOf = (task: Task): Summary | null => taskChip(task, store.listOf(task.list_id), t, locale());
/** Sintesi (margine + dettaglio) di un insieme di task, per valuta. */
export const sumOf = (tasks: Iterable<Task>): Summary | null => summarize(totalsOf(tasks, (id) => store.listOf(id)), t, locale());
/** Ricavi netti di un insieme di task. */
export const revenueOf = (tasks: Iterable<Task>): Summary | null => summarizeRevenue(totalsOf(tasks, (id) => store.listOf(id)), t, locale());
/** Margine del gruppo radice usato da Orbit, Metro e Road (`UNGROUPED` = task senza gruppo). */
export const rootMoney = (root: string): Summary | null => groupMoney(root === UNGROUPED ? null : root);
