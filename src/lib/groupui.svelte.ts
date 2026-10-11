import { SvelteSet } from 'svelte/reactivity';

const KEY = 'toodly.collapsedGroups';

function load(): string[] {
	try {
		const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		return Array.isArray(v) ? v : [];
	} catch {
		return [];
	}
}

/** Gruppi collassati (preferenza locale, condivisa tra finestre via localStorage). */
export const collapsedGroups = new SvelteSet<string>(load());

function persist() {
	try {
		localStorage.setItem(KEY, JSON.stringify([...collapsedGroups]));
	} catch {}
}

export function toggleGroup(id: string) {
	if (collapsedGroups.has(id)) collapsedGroups.delete(id);
	else collapsedGroups.add(id);
	persist();
}
export function expandGroup(id: string) {
	if (collapsedGroups.delete(id)) persist();
}
