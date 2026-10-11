import { invoke } from '@tauri-apps/api/core';
import { wipeWorkspace } from './workspace';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { t, locale } from './i18n.svelte';

export interface DatasetInfo {
	id: string;
	name: string;
	created_at: string; // secondi epoch (stringa) oppure ISO
	/** etichetta della finestra che lo usa, se aperto */
	window: string | null;
}

export const listDatasets = () => invoke<DatasetInfo[]>('list_datasets');
/** Traduce i codici di errore del backend sul nome del set in messaggi per l'utente. */
function nameError(e: unknown): Error {
	const code = String(e);
	if (code.includes('NAME_REQUIRED')) return new Error(t('Il nome del set è obbligatorio'));
	if (code.includes('NAME_TAKEN')) return new Error(t('Esiste già un set con questo nome'));
	return e instanceof Error ? e : new Error(code);
}

/** `ignore`: id dei set che stanno per essere sostituiti (non contano per l'univocità del nome). */
export const createDataset = (name: string, ignore: string[] = []) =>
	invoke<{ id: string; name: string; created_at: string }>('create_dataset', { name, ignore }).catch((e) => {
		throw nameError(e);
	});
export const renameDataset = (id: string, name: string) =>
	invoke<void>('rename_dataset', { id, name }).catch((e) => {
		throw nameError(e);
	});

/** Controllo immediato (lato interfaccia) di obbligatorietà e unicità; ritorna il messaggio d'errore o null. */
export function checkName(name: string, sets: { id: string; name: string }[], exceptId?: string): string | null {
	const n = name.trim();
	if (!n) return t('Il nome del set è obbligatorio');
	const l = n.toLowerCase();
	if (sets.some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === l)) return t('Esiste già un set con questo nome');
	return null;
}

/** Rende univoco un nome aggiungendo (2), (3)… se già presente (confronto senza maiuscole). */
export function uniqueName(base: string, taken: Iterable<string>): string {
	const set = new Set([...taken].map((x) => x.trim().toLowerCase()));
	const b = base.trim() || t('Nuovo set di dati');
	if (!set.has(b.toLowerCase())) return b;
	for (let i = 2; i < 10000; i++) {
		const c = `${b} (${i})`;
		if (!set.has(c.toLowerCase())) return c;
	}
	return b;
}

/** Titolo della finestra: "toodly - nomeset". */
export async function refreshWindowTitle(id: string | null) {
	try {
		const name = id ? (await listDatasets()).find((d) => d.id === id)?.name : undefined;
		await getCurrentWindow().setTitle(name ? `toodly - ${name}` : 'toodly');
	} catch {}
}
export const assignDataset = (id: string) => invoke<void>('assign_dataset', { id });
export const windowDataset = () => invoke<string | null>('window_dataset');

/** Elimina definitivamente un set: allegati, righe, file database. */
export async function deleteDataset(id: string) {
	await wipeWorkspace(id);
	await invoke('remove_dataset', { id });
}

export function formatCreated(s: string): string {
	const n = Number(s);
	const d = Number.isFinite(n) && n > 1e9 ? new Date(n * 1000) : new Date(s);
	return isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale());
}
