import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { store } from './store.svelte';
import { compareManual } from './views';
import type { Task } from './types';

const PRIO: Record<number, string> = { 3: ' !alta', 2: ' !media', 1: ' !bassa' };

function taskLines(t: Task, depth: number, out: string[]) {
	const pad = '  '.repeat(depth);
	const meta = (PRIO[t.priority] ?? '') + (t.due_date ? ` @${t.due_date}` : '');
	out.push(`${pad}- [${t.completed ? 'x' : ' '}] ${t.title.replace(/\s+/g, ' ').trim()}${meta}`);
	for (const line of t.description.split(/\r?\n/)) if (line.trim()) out.push(`${pad}  > ${line.trim()}`);
	for (const c of store.children(t.id)) taskLines(c, depth + 1, out);
}

/**
 * Markdown di una lista: i task senza gruppo per primi, poi i gruppi come intestazioni
 * (`#`, `##`…, in base all'annidamento) con i loro task. Il formato è reimportabile con
 * «Aggiungi più task da testo». Sono esportati solo i gruppi che contengono task della lista.
 */
export function listToMarkdown(listId: string): string {
	const inList = store.tasks.filter((t) => t.list_id === listId && !t.parent_id);
	const out: string[] = [];
	const byGroup = (gid: string | null) =>
		inList
			.filter((t) => (t.group_id && store.groupsById.has(t.group_id) ? t.group_id : null) === gid)
			.sort(compareManual);
	const hasTasks = (gid: string): boolean => byGroup(gid).length > 0 || store.groupChildren(gid).some((g) => hasTasks(g.id));

	for (const t of byGroup(null)) taskLines(t, 0, out);
	const walk = (parent: string | null, level: number) => {
		for (const g of store.groupChildren(parent)) {
			if (!hasTasks(g.id)) continue;
			if (out.length) out.push('');
			out.push(`${'#'.repeat(Math.min(level, 6))} ${g.name}`);
			out.push('');
			for (const t of byGroup(g.id)) taskLines(t, 0, out);
			walk(g.id, level + 1);
		}
	};
	walk(null, 1);
	return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

/** Chiede dove salvare e scrive il file `.md` della lista. Restituisce il percorso o `null` se annullato. */
export async function exportListMd(listId: string): Promise<string | null> {
	const list = store.lists.find((l) => l.id === listId);
	if (!list) return null;
	const safe = list.name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'lista';
	const dest = await saveDialog({ defaultPath: `${safe}.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] });
	if (!dest) return null;
	await invoke('save_text_file', { path: dest, content: listToMarkdown(listId) });
	return dest;
}
