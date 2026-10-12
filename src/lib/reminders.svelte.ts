import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { store } from './store.svelte';
import { uiprefs } from './uiprefs.svelte';
import { relativeDay } from './dates';
import { showToast } from './nav.svelte';
import { t } from './i18n.svelte';
import type { Task } from './types';

/**
 * Promemoria: ogni finestra controlla i task del proprio set; l'elenco di quelli già notificati sta in
 * localStorage (condiviso tra finestre) per non ripetere la stessa notifica. Funziona finché l'app è in
 * esecuzione (anche nel tray) e solo per i set aperti in una finestra.
 */
const KEY = 'toodly-internal.reminded';
const TICK_MS = 20_000;
/** oltre questo ritardo un promemoria non viene più notificato (app chiusa a lungo) */
const GRACE_MS = 12 * 3600 * 1000;
const KEEP_MS = 3 * 24 * 3600 * 1000;

type Seen = Record<string, number>;
function readSeen(): Seen {
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
	} catch {
		return {};
	}
}
function writeSeen(m: Seen) {
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {}
}

/** Istante di inizio del task: scadenza + orario (senza orario vale l'ora predefinita dei task «tutto il giorno»). */
export function startInstant(task: Task): Date | null {
	if (!task.due_date) return null;
	const [y, m, d] = task.due_date.split('-').map(Number);
	const [hh, mm] = (task.start_time ?? uiprefs.allDayTime).split(':').map(Number);
	return new Date(y, m - 1, d, hh || 0, mm || 0);
}
export function reminderTime(task: Task): Date | null {
	if (task.remind_min == null || task.completed) return null;
	const s = startInstant(task);
	return s ? new Date(s.getTime() - task.remind_min * 60000) : null;
}
const keyOf = (task: Task) => `${task.id}|${task.due_date}|${task.start_time ?? ''}|${task.remind_min}`;

/** Chiede il permesso di notificare (da un gesto dell'utente). Restituisce true se concesso. */
export async function ensureNotificationPermission(): Promise<boolean> {
	try {
		if (await isPermissionGranted()) return true;
		return (await requestPermission()) === 'granted';
	} catch {
		return false;
	}
}

async function notify(title: string, body: string) {
	try {
		if (await isPermissionGranted()) {
			sendNotification({ title, body });
			return;
		}
	} catch {
		/* plugin non disponibile: si ripiega sul messaggio nell'app */
	}
	showToast(`${title} — ${body}`, null, 9000);
}

function bodyOf(task: Task): string {
	const when = task.due_date ? relativeDay(task.due_date) + (task.start_time ? ' ' + task.start_time : '') : '';
	const list = store.listOf(task.list_id)?.name;
	return [when, list].filter(Boolean).join(' · ') || t('Promemoria');
}

/** Notifica di prova (Impostazioni). */
export async function testNotification() {
	const ok = await ensureNotificationPermission();
	if (!ok) showToast(t('Notifiche non consentite dal sistema'));
	await notify('toodly', t('Le notifiche funzionano'));
}

function tick() {
	if (!uiprefs.remindersEnabled || !store.ready) return;
	const now = Date.now();
	const seen = readSeen();
	for (const task of store.tasks) {
		const at = reminderTime(task);
		if (!at) continue;
		const age = now - at.getTime();
		if (age < 0 || age > GRACE_MS) continue;
		const key = keyOf(task);
		if (seen[key]) continue;
		// piccolo ritardo casuale e nuovo controllo: due finestre non notificano lo stesso promemoria
		setTimeout(() => {
			const cur = readSeen();
			if (cur[key]) return;
			cur[key] = Date.now();
			writeSeen(cur);
			notify(task.title, bodyOf(task));
		}, Math.random() * 700);
	}
	// pulizia delle voci vecchie
	let dirty = false;
	for (const [k, at] of Object.entries(seen)) if (now - at > KEEP_MS) (delete seen[k], (dirty = true));
	if (dirty) writeSeen(seen);
}

/** Avvia il controllo periodico; restituisce la funzione che lo ferma. */
export function startReminders(): () => void {
	const first = setTimeout(tick, 3000);
	const id = setInterval(tick, TICK_MS);
	return () => {
		clearTimeout(first);
		clearInterval(id);
	};
}
