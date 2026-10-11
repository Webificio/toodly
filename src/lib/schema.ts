import type Database from '@tauri-apps/plugin-sql';

/**
 * Schema SQLite. Ogni finestra ha un proprio file database (nome dinamico), quindi le
 * migrazioni sono eseguite qui all'apertura di ciascun database. Tutti i passi sono
 * idempotenti: si possono rieseguire su database già migrati (anche dal vecchio sistema
 * di migrazioni del backend).
 */
const STEPS: string[] = [
	`CREATE TABLE IF NOT EXISTS lists (
		id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#6366f1',
		sort REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
	`CREATE TABLE IF NOT EXISTS tasks (
		id TEXT PRIMARY KEY NOT NULL,
		list_id TEXT REFERENCES lists(id) ON DELETE SET NULL,
		parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
		title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
		completed INTEGER NOT NULL DEFAULT 0, completed_at TEXT,
		priority INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'todo',
		due_date TEXT, start_time TEXT, end_time TEXT,
		recurrence TEXT NOT NULL DEFAULT 'none', sort REAL NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
	`CREATE INDEX IF NOT EXISTS idx_tasks_list ON tasks(list_id)`,
	`CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id)`,
	`CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date)`,
	`CREATE TABLE IF NOT EXISTS notes (
		id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
		text TEXT NOT NULL, created_at TEXT NOT NULL)`,
	`CREATE INDEX IF NOT EXISTS idx_notes_task ON notes(task_id)`,
	`CREATE TABLE IF NOT EXISTS attachments (
		id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
		name TEXT NOT NULL, path TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
	`CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id)`,
	`CREATE TABLE IF NOT EXISTS filters (
		id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, match_mode TEXT NOT NULL DEFAULT 'and',
		rules TEXT NOT NULL DEFAULT '[]', sort REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
	// dipendenze tra task
	`CREATE TABLE IF NOT EXISTS task_deps (
		task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
		depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
		created_at TEXT NOT NULL, PRIMARY KEY (task_id, depends_on_id))`,
	`CREATE INDEX IF NOT EXISTS idx_deps_on ON task_deps(depends_on_id)`,
	// gruppi / sottogruppi
	`CREATE TABLE IF NOT EXISTS task_groups (
		id TEXT PRIMARY KEY NOT NULL,
		parent_id TEXT REFERENCES task_groups(id) ON DELETE SET NULL,
		name TEXT NOT NULL, sort REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
	`CREATE INDEX IF NOT EXISTS idx_task_groups_parent ON task_groups(parent_id)`
];

/** Tabelle in ordine di dipendenza (i genitori prima dei figli): usato da export / import. */
export const TABLES = ['lists', 'task_groups', 'tasks', 'notes', 'attachments', 'filters', 'task_deps'] as const;
export type TableName = (typeof TABLES)[number];

export async function ensureSchema(db: Database) {
	for (const sql of STEPS) await db.execute(sql);
	// colonna aggiunta in una versione successiva: ALTER non è idempotente → si controlla prima
	const cols = await db.select<{ name: string }[]>('PRAGMA table_info(tasks)');
	if (!cols.some((c) => c.name === 'group_id')) {
		await db.execute('ALTER TABLE tasks ADD COLUMN group_id TEXT REFERENCES task_groups(id) ON DELETE SET NULL');
	}
	await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id)');
}
