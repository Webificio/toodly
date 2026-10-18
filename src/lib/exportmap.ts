import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';

/** Chiede dove salvare e scrive il `.md` con il diagramma di Orbit o del Metro. Restituisce il percorso, `'empty'` se `md` è vuoto, `null` se annullato. */
export async function exportMapMd(md: string, title: string, kind: 'orbit' | 'metro'): Promise<string | 'empty' | null> {
	if (!md) return 'empty';
	const safe = title.replace(/[\\/:*?"<>|]+/g, '_').trim() || kind;
	const dest = await saveDialog({ defaultPath: `${safe} - ${kind}.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] });
	if (!dest) return null;
	await invoke('save_text_file', { path: dest, content: md });
	return dest;
}
