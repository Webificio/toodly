import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { openWorkspaceDb } from './db';
import { TABLES, type TableName } from './schema';
import { wipeWorkspace } from './workspace';
import { listDatasets, createDataset, uniqueName } from './datasets';
import { nowISO } from './ids';
import { t, locale } from './i18n.svelte';

export interface WinState {
	label: string;
	route: string;
	x: number | null;
	y: number | null;
	w: number | null;
	h: number | null;
	maximized: boolean;
	ws: string | null;
	sidebar?: number | null;
}

export type WorkspaceData = Partial<Record<TableName, Record<string, unknown>[]>>;

export interface Backup {
	path: string;
	manifest: {
		app: string;
		formatVersion: number;
		exportedAt: string;
		workspaces: string[];
		datasets?: { id: string; name: string }[];
		windows: WinState[];
		prefs: Record<string, string>;
	};
	workspaces: { id: string; name: string; data: WorkspaceData }[];
	counts: { datasets: number; tasks: number; lists: number; groups: number; attachments: number };
}

/** Versione del formato del file di esportazione (manifest.formatVersion). */
export const EXPORT_FORMAT_VERSION = 1;
const PREF_PREFIX = 'toodly.';
const DEFAULT_ROUTE = '/?scope=today&mode=list';

function localPrefs(): Record<string, string> {
	const out: Record<string, string> = {};
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k && k.startsWith(PREF_PREFIX)) out[k] = localStorage.getItem(k) ?? '';
		}
	} catch {}
	return out;
}

const stamp = () => nowISO().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');

// ---------------------------------------------------------------------------
// Esportazione
// ---------------------------------------------------------------------------

/** Salva in uno ZIP: tutti i set di dati (anche non aperti), allegati, layout delle finestre e preferenze locali. */
export async function exportAll(): Promise<{ path: string; datasets: number; tasks: number; files: number } | null> {
	const dest = await saveDialog({
		defaultPath: `toodly-backup-${stamp()}.zip`,
		filters: [{ name: 'ZIP', extensions: ['zip'] }]
	});
	if (!dest) return null;
	return writeBackup(dest);
}

/** Scrive il backup completo in `dest` (percorso già scelto). */
async function writeBackup(dest: string): Promise<{ path: string; datasets: number; tasks: number; files: number }> {
	const sets = await listDatasets();
	const wins = await invoke<WinState[]>('list_windows');

	const workspaces: { id: string; data: string }[] = [];
	const attachments: { ws: string; id: string; name: string; path: string }[] = [];
	let tasks = 0;
	for (const ds of sets) {
		const db = await openWorkspaceDb(ds.id);
		const data: WorkspaceData = {};
		for (const table of TABLES) data[table] = await db.select<Record<string, unknown>[]>(`SELECT * FROM ${table}`);
		tasks += data.tasks?.length ?? 0;
		for (const a of data.attachments ?? []) attachments.push({ ws: ds.id, id: String(a.id), name: String(a.name), path: String(a.path) });
		workspaces.push({ id: ds.id, data: JSON.stringify(data) });
	}
	const manifest = {
		app: 'toodly',
		format: 2,
		exportedAt: nowISO(),
		workspaces: sets.map((d) => d.id),
		datasets: sets.map((d) => ({ id: d.id, name: d.name })),
		windows: wins,
		prefs: localPrefs()
	};
	const files = await invoke<number>('export_zip', { dest, manifest: JSON.stringify(manifest), workspaces, attachments });
	return { path: dest, datasets: sets.length, tasks, files };
}

// ---------------------------------------------------------------------------
// Importazione
// ---------------------------------------------------------------------------

/** Chiede lo ZIP all'utente e lo legge/valida. */
export async function pickAndReadBackup(): Promise<Backup | null> {
	const picked = await openDialog({ multiple: false, directory: false, filters: [{ name: 'ZIP', extensions: ['zip'] }] });
	if (!picked) return null;
	const path = typeof picked === 'string' ? picked : (picked as { path: string }).path;
	const raw = await invoke<{ manifest: string; workspaces: { id: string; data: string }[] }>('read_backup', { path });
	const manifest = JSON.parse(raw.manifest) as Backup['manifest'];
	// Il manifest e la sua versione vengono letti per primi; ogni versione ha il proprio lettore.
	switch (manifest.formatVersion) {
		case 1:
			break; // formato attuale
		default:
			throw new Error(`UNSUPPORTED_VERSION:${manifest.formatVersion}`);
	}
	const names = new Map((manifest.datasets ?? []).map((d) => [d.id, d.name]));
	const workspaces = raw.workspaces.map((w) => ({ id: w.id, name: names.get(w.id) ?? w.id, data: JSON.parse(w.data) as WorkspaceData }));
	const sum = (k: TableName) => workspaces.reduce((n, w) => n + (w.data[k]?.length ?? 0), 0);
	return {
		path,
		manifest: { ...manifest, windows: manifest.windows ?? [], prefs: manifest.prefs ?? {} },
		workspaces,
		counts: { datasets: workspaces.length, tasks: sum('tasks'), lists: sum('lists'), groups: sum('task_groups'), attachments: sum('attachments') }
	};
}

/** Ordina le righe con riferimento al padre (parent_id) in modo che i genitori vengano prima. */
function parentsFirst(rows: Record<string, unknown>[]): Record<string, unknown>[] {
	const byId = new Map(rows.map((r) => [String(r.id), r]));
	const out: Record<string, unknown>[] = [];
	const seen = new Set<string>();
	const visit = (r: Record<string, unknown>, depth = 0) => {
		const id = String(r.id);
		if (seen.has(id) || depth > 100) return;
		const p = r.parent_id ? byId.get(String(r.parent_id)) : undefined;
		if (p) visit(p, depth + 1);
		seen.add(id);
		out.push(r);
	};
	for (const r of rows) visit(r);
	return out;
}

/**
 * Inserisce i dati di un dump in uno spazio dati. Gli ID sono univoci (uuid): le righe già presenti
 * vengono ignorate, quindi si può importare più volte lo stesso backup senza duplicati.
 * Ritorna gli allegati effettivamente inseriti.
 */
async function insertWorkspaceData(ws: string, data: WorkspaceData, srcWs: string, zipPath: string) {
	const db = await openWorkspaceDb(ws);
	const inserted: { id: string; task_id: string; name: string }[] = [];
	for (const table of TABLES) {
		let rows = data[table] ?? [];
		if (table === 'task_groups' || table === 'tasks') rows = parentsFirst(rows);
		if (!rows.length) continue;
		const cols = (await db.select<{ name: string }[]>(`PRAGMA table_info(${table})`)).map((c) => c.name);
		for (const r of rows) {
			const keys = Object.keys(r).filter((k) => cols.includes(k));
			if (!keys.length) continue;
			const sql = `INSERT OR IGNORE INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(', ')})`;
			try {
				const res = await db.execute(sql, keys.map((k) => r[k] ?? null));
				if (table === 'attachments' && res.rowsAffected > 0) inserted.push({ id: String(r.id), task_id: String(r.task_id), name: String(r.name) });
			} catch (e) {
				console.warn('[toodly] riga non importata', table, e);
			}
		}
	}
	if (inserted.length) {
		const done = await invoke<{ id: string; path: string; size: number }[]>('extract_attachments', {
			path: zipPath,
			items: inserted.map((a) => ({ ws: srcWs, id: a.id, task_id: a.task_id, name: a.name }))
		});
		for (const d of done) await db.execute('UPDATE attachments SET path = $2, size = $3 WHERE id = $1', [d.id, d.path, d.size]);
	}
}

/**
 * ACCODA: aggiunge i set del backup come nuovi set separati, senza toccare quelli esistenti.
 * Se un nome coincide con uno già presente (o con un altro set importato) viene reso univoco
 * con un suffisso (2), (3)…
 */
export async function importAppendSets(b: Backup) {
	const taken = (await listDatasets()).map((d) => d.name);
	for (const w of b.workspaces) {
		const name = uniqueName(w.name, taken);
		taken.push(name);
		const ds = await createDataset(name);
		await insertWorkspaceData(ds.id, w.data, w.id, b.path);
	}
}

const newWindowLabel = () => 'w-' + Date.now().toString(16) + Math.floor(Math.random() * 0xfffff).toString(16).padStart(5, '0');

/**
 * SOVRASCRIVI: elimina tutti i set attuali, ricrea quelli del backup (con nuovi
 * identificativi) e ripristina finestre, layout e preferenze. Le finestre attuali vengono chiuse.
 */
export async function importReplace(b: Backup) {
	const old = await listDatasets();
	for (const d of old) await wipeWorkspace(d.id);

	const map = new Map<string, string>();
	const taken: string[] = []; // i set attuali sono stati eliminati: l'univocità vale solo tra quelli importati
	for (const w of b.workspaces) {
		const name = uniqueName(w.name, taken);
		taken.push(name);
		const ds = await createDataset(name, old.map((d) => d.id));
		map.set(w.id, ds.id);
		await insertWorkspaceData(ds.id, w.data, w.id, b.path);
	}

	const used = new Set<string>();
	let layout: WinState[] = [];
	for (const w of b.manifest.windows) {
		const nid = w.ws ? map.get(w.ws) : undefined;
		if (!nid || used.has(nid)) continue;
		used.add(nid);
		layout.push({ ...w, label: newWindowLabel(), ws: nid });
	}
	if (layout.length === 0) {
		const first = [...map.values()][0] ?? null;
		layout = [{ label: newWindowLabel(), route: DEFAULT_ROUTE, x: null, y: null, w: null, h: null, maximized: false, ws: first }];
	}

	try {
		for (const [k, v] of Object.entries(b.manifest.prefs)) if (k.startsWith(PREF_PREFIX)) localStorage.setItem(k, v);
	} catch {}

	await invoke('replace_layout', { windows: layout, removeDatasets: old.map((d) => d.id) });
}

/**
 * CANCELLA TUTTO: svuota ed elimina tutti i set (task, liste, gruppi, note, allegati), azzera le
 * preferenze locali e il layout delle finestre; resta una sola finestra con un set vuoto nuovo.
 */
export async function resetAllData() {
	const old = await listDatasets();
	for (const d of old) await wipeWorkspace(d.id);
	const fresh = await createDataset(t('Dati principali'), old.map((d) => d.id));
	try {
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k && k.startsWith(PREF_PREFIX)) keys.push(k);
		}
		for (const k of keys) localStorage.removeItem(k);
	} catch {}
	const layout: WinState[] = [{ label: newWindowLabel(), route: DEFAULT_ROUTE, x: null, y: null, w: null, h: null, maximized: false, ws: fresh.id }];
	await invoke('replace_layout', { windows: layout, removeDatasets: old.map((d) => d.id) });
}

export const backupLabel = (b: Backup) => {
	try {
		return new Date(b.manifest.exportedAt).toLocaleString(locale());
	} catch {
		return b.manifest.exportedAt;
	}
};

/** Messaggio localizzato per un errore di lettura del backup (codici prodotti da `read_backup` e da `pickAndReadBackup`). */
export function backupErrorText(e: unknown): string {
	const m = String((e as Error)?.message ?? e).replace(/^Error: /, '');
	const [code, arg = ''] = [m.split(':')[0], m.slice(m.indexOf(':') + 1)];
	switch (code) {
		case 'BAD_ZIP':
			return t('Il file non è uno zip valido');
		case 'NOT_BACKUP':
		case 'BAD_MANIFEST':
		case 'NO_VERSION':
			return t('Non è un backup di toodly valido');
		case 'UNSUPPORTED_VERSION':
			return t('Versione del formato di backup non supportata ({n}): aggiorna toodly', { n: arg });
		case 'MISSING_FILE':
			return t('File mancante nello zip: {name}', { name: arg });
		default:
			return m;
	}
}

/** Backup automatico: salva `toodly-auto-<data>.zip` in `dir` e tiene solo gli ultimi `keep` file automatici. */
export async function autoBackupTo(dir: string, keep: number) {
	const sep = dir.includes('\\') ? '\\' : '/';
	const dest = dir.replace(/[\\/]+$/, '') + sep + `toodly-auto-${stamp()}.zip`;
	const r = await writeBackup(dest);
	try {
		await invoke('prune_backups', { dir, keep });
	} catch (e) {
		console.error('pulizia vecchi backup non riuscita', e);
	}
	return r;
}
