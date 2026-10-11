import { invoke } from '@tauri-apps/api/core';

/** Chiave storica (preferenza globale): usata solo come valore iniziale per le finestre che non hanno ancora una larghezza propria. */
const LEGACY_KEY = 'toodly.sidebarWidth';
export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 480;
export const SIDEBAR_DEFAULT = 240;

const clamp = (n: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(n)));

function legacy(): number {
	try {
		const v = Number(localStorage.getItem(LEGACY_KEY));
		return v ? clamp(v) : SIDEBAR_DEFAULT;
	} catch {
		return SIDEBAR_DEFAULT;
	}
}

/** Larghezza della sidebar di questa finestra (salvata dal backend per finestra, in windows.json). */
export const panel = $state({ sidebar: SIDEBAR_DEFAULT });

/** Ripristina la larghezza salvata per questa finestra. */
export async function initSidebar() {
	const saved = await invoke<number | null>('window_sidebar').catch(() => null);
	panel.sidebar = saved ? clamp(saved) : legacy();
}

export function setSidebarWidth(w: number, persist = false) {
	panel.sidebar = clamp(w);
	if (persist) invoke('set_sidebar_width', { width: panel.sidebar }).catch(() => {});
}
