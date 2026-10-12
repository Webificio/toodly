import { SvelteSet } from 'svelte/reactivity';
import { store } from './store.svelte';

const KEY = 'toodly.collapsedGroups';

/**
 * Gruppi collassati, ricordati per ogni vista di ogni set (es. una lista).
 * Formato in localStorage: { "<set>|<scope>": [id gruppo collassati…] }.
 * Il vecchio formato (un solo array globale) resta come valore iniziale per le viste mai salvate.
 */
type Saved = { legacy: string[]; views: Record<string, string[]> };

function read(): Saved {
	try {
		const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		if (Array.isArray(v)) return { legacy: v.filter((x) => typeof x === 'string'), views: {} };
		if (v && typeof v === 'object') {
			return { legacy: Array.isArray(v.legacy) ? v.legacy : [], views: v.views && typeof v.views === 'object' ? v.views : {} };
		}
	} catch {}
	return { legacy: [], views: {} };
}

/** Gruppi collassati della vista corrente (vedi `loadCollapsed`). */
export const collapsedGroups = new SvelteSet<string>();
let viewKey: string | null = null;

/** Passa a una vista: sostituisce l'insieme dei gruppi collassati con quello salvato per (set, vista). */
export function loadCollapsed(ws: string | null, scope: string) {
	const key = `${ws ?? ''}|${scope}`;
	if (key === viewKey) return;
	viewKey = key;
	const saved = read();
	const ids = saved.views[key] ?? saved.legacy;
	collapsedGroups.clear();
	for (const id of ids) collapsedGroups.add(id);
}

function persist() {
	if (viewKey === null) return;
	try {
		// riletto ad ogni salvataggio: altre finestre possono aver salvato altre viste nel frattempo
		const saved = read();
		saved.views[viewKey] = [...collapsedGroups].filter((id) => store.groupsById.has(id));
		localStorage.setItem(KEY, JSON.stringify(saved));
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
