import { SvelteSet } from 'svelte/reactivity';

/** Selezione multipla di task (Ctrl/Cmd+clic, Maiusc+clic per intervalli). */
export const selection = new SvelteSet<string>();

let order: string[] = [];
let anchor: string | null = null;

/** Ordine visivo corrente (per la selezione a intervallo): lo imposta la vista attiva. */
export function setVisibleOrder(ids: string[]) {
	order = ids;
}
export function visibleOrder() {
	return order;
}

export function clearSelection() {
	selection.clear();
	anchor = null;
}

export function toggleSelected(id: string) {
	if (selection.has(id)) selection.delete(id);
	else selection.add(id);
	anchor = id;
}

export function selectRange(id: string) {
	const a = anchor && order.includes(anchor) ? order.indexOf(anchor) : -1;
	const b = order.indexOf(id);
	if (a < 0 || b < 0) return toggleSelected(id);
	const [from, to] = a < b ? [a, b] : [b, a];
	for (let i = from; i <= to; i++) selection.add(order[i]);
}

export function selectAll() {
	for (const id of order) selection.add(id);
}

/**
 * Gestisce il clic su un task. Ritorna true se il clic è stato "consumato" dalla selezione
 * (Ctrl/Cmd, Maiusc, oppure una selezione già attiva); altrimenti la vista apre il dettaglio.
 */
export function handleSelectClick(e: MouseEvent, id: string): boolean {
	if (e.shiftKey) {
		selectRange(id);
		window.getSelection()?.removeAllRanges();
		return true;
	}
	if (e.ctrlKey || e.metaKey || selection.size > 0) {
		toggleSelected(id);
		return true;
	}
	return false;
}
