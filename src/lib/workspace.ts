import { invoke } from '@tauri-apps/api/core';
import { openWorkspaceDb, closeWorkspaceDb } from './db';
import { TABLES } from './schema';

/**
 * Svuota completamente uno spazio dati: allegati su disco, righe di tutte le tabelle,
 * poi chiude la connessione (così i file possono essere eliminati).
 */
export async function wipeWorkspace(ws: string) {
	try {
		const db = await openWorkspaceDb(ws);
		const tasks = await db.select<{ id: string }[]>('SELECT id FROM tasks');
		for (const t of tasks) await invoke('delete_task_attachments', { taskId: t.id }).catch(() => {});
		for (const table of [...TABLES].reverse()) await db.execute(`DELETE FROM ${table}`);
	} catch (e) {
		console.error('[toodly] svuotamento spazio dati', ws, e);
	}
	await closeWorkspaceDb(ws);
}
