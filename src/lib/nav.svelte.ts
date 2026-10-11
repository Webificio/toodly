import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { Mode, SortMode } from './types';
import type { Backup } from './backup';
import { todayISO } from './dates';

/** Stato di navigazione della finestra, interamente codificato nella query string
 *  (così il backend può salvarlo e ricrearlo al riavvio). */
export const nav = {
	get scope(): string {
		return page.url.searchParams.get('scope') ?? 'today';
	},
	get mode(): Mode {
		const m = page.url.searchParams.get('mode');
		return m === 'kanban' || m === 'calendar' ? m : 'list';
	},
	get sort(): SortMode {
		const s = page.url.searchParams.get('sort');
		return s === 'priority' || s === 'due' ? s : 'manual';
	},
	get group(): 'status' | 'priority' {
		return page.url.searchParams.get('group') === 'priority' ? 'priority' : 'status';
	},
	get cal(): 'month' | 'week' {
		return page.url.searchParams.get('cal') === 'month' ? 'month' : 'week';
	},
	get date(): string {
		return page.url.searchParams.get('d') ?? todayISO();
	},
	get quick(): boolean {
		return page.url.searchParams.get('quick') === '1';
	},
	get search(): string {
		return page.url.search;
	}
};

export function go(patch: Record<string, string | null>) {
	const u = new URL(page.url.href);
	for (const [k, v] of Object.entries(patch)) {
		if (v === null) u.searchParams.delete(k);
		else u.searchParams.set(k, v);
	}
	goto(u.pathname + u.search, { replace: true, reset: false });
}

export interface ConfirmReq {
	title: string;
	message: string;
	label: string;
	danger?: boolean;
	run: () => void | Promise<void>;
}

export const ui = $state<{ confirm: ConfirmReq | null; selectedTaskId: string | null; settingsOpen: boolean; bulkOpen: boolean; filterEditor: string | null | 'new'; listEditor: string | null | 'new'; groupEditor: string | null; importPlan: Backup | null; pickDataset: boolean; dataOpen: boolean; datasetId: string | null; closeAsk: boolean; aboutOpen: boolean }>({
	confirm: null,
	selectedTaskId: null,
	settingsOpen: false,
	bulkOpen: false,
	filterEditor: null,
	listEditor: null,
	groupEditor: null,
	importPlan: null,
	pickDataset: false,
	dataOpen: false,
	datasetId: null,
	closeAsk: false,
	aboutOpen: false
});

export const toast = $state<{ msg: string; id: number }>({ msg: '', id: 0 });
export function showToast(msg: string) {
	toast.msg = msg;
	toast.id++;
	const id = toast.id;
	setTimeout(() => {
		if (toast.id === id) toast.msg = '';
	}, 2600);
}

/** Apre la modale di conferma globale. */
export function askConfirm(req: ConfirmReq) {
	ui.confirm = req;
}
