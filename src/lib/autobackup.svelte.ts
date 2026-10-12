/**
 * Backup automatico periodico in una cartella scelta dall'utente.
 * Le impostazioni stanno in `toodly-internal.*`: sono legate a questo computer e non finiscono nei backup.
 */
import { autoBackupTo } from './backup';

export type AutoMode = 'off' | 'daily' | 'weekly';

const K_MODE = 'toodly-internal.autoBackup';
const K_DIR = 'toodly-internal.autoBackupDir';
const K_KEEP = 'toodly-internal.autoBackupKeep';
const K_LAST = 'toodly-internal.autoBackupLast';
const K_LOCK = 'toodly-internal.autoBackupLock';

export const autoBackup = $state<{ mode: AutoMode; dir: string; keep: number; last: string | null; running: boolean; error: string }>({
	mode: 'off',
	dir: '',
	keep: 7,
	last: null,
	running: false,
	error: ''
});

function get(k: string): string | null {
	try {
		return localStorage.getItem(k);
	} catch {
		return null;
	}
}
function put(k: string, v: string) {
	try {
		localStorage.setItem(k, v);
	} catch {}
}

export function loadAutoBackup() {
	const m = get(K_MODE);
	autoBackup.mode = m === 'daily' || m === 'weekly' ? m : 'off';
	autoBackup.dir = get(K_DIR) ?? '';
	const k = Number(get(K_KEEP));
	autoBackup.keep = [3, 7, 14, 30].includes(k) ? k : 7;
	autoBackup.last = get(K_LAST);
}

export function setAutoMode(m: AutoMode) {
	autoBackup.mode = m;
	put(K_MODE, m);
}
export function setAutoDir(d: string) {
	autoBackup.dir = d;
	put(K_DIR, d);
}
export function setAutoKeep(n: number) {
	autoBackup.keep = n;
	put(K_KEEP, String(n));
}

const HOUR = 3600_000;
const interval = (m: AutoMode) => (m === 'weekly' ? 7 * 24 * HOUR - HOUR : m === 'daily' ? 24 * HOUR - HOUR : Infinity);

/** Esegue un backup ora. `force` ignora la pianificazione. Restituisce true se è stato scritto. */
export async function runAutoBackup(force = false): Promise<boolean> {
	loadAutoBackup();
	if (!autoBackup.dir || (!force && autoBackup.mode === 'off')) return false;
	const now = Date.now();
	if (!force) {
		const last = autoBackup.last ? Date.parse(autoBackup.last) : 0;
		if (now - last < interval(autoBackup.mode)) return false;
	}
	// più finestre aperte: ne basta una (blocco condiviso + piccola attesa casuale)
	const lock = Number(get(K_LOCK) ?? 0);
	if (!force && now - lock < 2 * 60_000) return false;
	if (!force) {
		put(K_LOCK, String(now));
		await new Promise((r) => setTimeout(r, 200 + Math.random() * 600));
		if (Number(get(K_LOCK)) !== now) return false;
	}
	autoBackup.running = true;
	autoBackup.error = '';
	try {
		await autoBackupTo(autoBackup.dir, autoBackup.keep);
		const iso = new Date().toISOString();
		autoBackup.last = iso;
		put(K_LAST, iso);
		return true;
	} catch (e) {
		console.error('backup automatico non riuscito', e);
		autoBackup.error = e instanceof Error ? e.message : String(e);
		return false;
	} finally {
		autoBackup.running = false;
		put(K_LOCK, '0');
	}
}

/** Controlla all'avvio (dopo qualche secondo) e poi ogni 30 minuti. Restituisce la funzione di arresto. */
export function startAutoBackup(): () => void {
	loadAutoBackup();
	const first = setTimeout(() => void runAutoBackup(), 20_000);
	const iv = setInterval(() => void runAutoBackup(), 30 * 60_000);
	return () => {
		clearTimeout(first);
		clearInterval(iv);
	};
}
