import Database from '@tauri-apps/plugin-sql';
import { ensureSchema } from './schema';

/**
 * I dati sono organizzati in "set": ciascuno è un file SQLite indipendente, salvato anche quando
 * nessuna finestra lo usa. Ogni finestra lavora su un solo set alla volta (scelto all'apertura)
 * e due finestre non possono aprire lo stesso set. L'identificativo del set è un id univoco
 * ("main" = database storico di toodly).
 */
let workspace: string | null = null;
const dbs = new Map<string, Promise<Database>>();

export const currentWorkspace = () => workspace;
export function setWorkspace(id: string) {
	workspace = id;
}

export const dbFileName = (ws: string) => (ws === 'main' ? 'toodly.db' : `ds-${ws}.db`);

/** Apre (e se serve migra) il database di uno spazio dati. */
export function openWorkspaceDb(ws: string): Promise<Database> {
	let p = dbs.get(ws);
	if (!p) {
		p = (async () => {
			const db = await Database.load('sqlite:' + dbFileName(ws));
			await ensureSchema(db);
			return db;
		})();
		p.catch(() => dbs.delete(ws));
		dbs.set(ws, p);
	}
	return p;
}

/** Chiude la connessione e la dimentica (prima di eliminare i file). */
export async function closeWorkspaceDb(ws: string) {
	const p = dbs.get(ws);
	dbs.delete(ws);
	try {
		const db = await (p ?? Database.load('sqlite:' + dbFileName(ws)));
		await db.close();
	} catch {}
}

export function getDb(): Promise<Database> {
	if (!workspace) return Promise.reject(new Error('nessuno spazio dati selezionato'));
	return openWorkspaceDb(workspace);
}

export async function exec(sql: string, params: unknown[] = []) {
	const db = await getDb();
	return db.execute(sql, params);
}

export async function select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
	const db = await getDb();
	return db.select<T[]>(sql, params);
}
