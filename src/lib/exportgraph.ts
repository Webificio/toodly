import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { graphToMermaid, type GraphInput } from './graph';
import type { Dep } from './types';

/** Chiede dove salvare e scrive il `.md` col diagramma del Graph. Restituisce il percorso, `'empty'` se non c'è nulla da esportare, `null` se annullato. */
export async function exportGraphMd(inp: Pick<GraphInput, 'groups' | 'tasks' | 'showDone' | 'ungroupedLabel'>, deps: Dep[], title: string): Promise<string | 'empty' | null> {
	const md = graphToMermaid(inp, deps, title);
	if (!md) return 'empty';
	const safe = title.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'graph';
	const dest = await saveDialog({ defaultPath: `${safe} - graph.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] });
	if (!dest) return null;
	await invoke('save_text_file', { path: dest, content: md });
	return dest;
}
