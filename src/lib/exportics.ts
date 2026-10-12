import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { store } from './store.svelte';
import { uiprefs } from './uiprefs.svelte';
import { buildIcs } from './ics';

/** Chiede dove salvare e scrive il `.ics` dei task con scadenza. `'empty'` se non c'è nulla, `null` se annullato. */
export async function exportIcs(): Promise<string | 'empty' | null> {
	const ics = buildIcs(store.tasks, { allDayTime: uiprefs.allDayTime });
	if (!ics) return 'empty';
	const dest = await saveDialog({ defaultPath: 'toodly.ics', filters: [{ name: 'iCalendar', extensions: ['ics'] }] });
	if (!dest) return null;
	await invoke('save_text_file', { path: dest, content: ics });
	return dest;
}
