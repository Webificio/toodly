import { showToast } from './nav.svelte';
import { t } from './i18n.svelte';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { currentWorkspace } from './db';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const windowLabel = (): string => {
	try {
		return getCurrentWindow().label;
	} catch {
		return 'browser';
	}
};

export const DATA_CHANGED = 'data-changed';

/** Avvisa le finestre che usano lo stesso spazio dati (es. il Quick Add) che i dati sono cambiati. */
export function notifyDataChanged() {
	emit(DATA_CHANGED, { origin: windowLabel(), ws: currentWorkspace() }).catch(() => {});
}

export function onDataChanged(cb: () => void): Promise<UnlistenFn> {
	const me = windowLabel();
	return listen<{ origin: string; ws: string | null }>(DATA_CHANGED, (e) => {
		if (e.payload?.origin !== me && e.payload?.ws === currentWorkspace()) cb();
	});
}

/** Nuova finestra = nuovo spazio dati vuoto e indipendente. */
export const openWindow = () =>
	invoke('open_window', { route: null }).catch((e) => {
		console.error(e);
		showToast(t('Impossibile aprire una nuova finestra'));
	});
export const reportRoute = (route: string) => invoke('report_route', { route }).catch(() => {});
export const windowReady = () => invoke('window_ready').catch(() => {});
export const hideQuick = () => invoke('hide_quick').catch(() => {});
export const quitApp = () => invoke('quit_app');
export const openExternal = (url: string) => invoke('open_external', { url }).catch(() => {});
