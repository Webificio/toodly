import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { store } from './store.svelte';
import { t } from './i18n.svelte';
import { diffDays, taskStart } from './dates';
import type { Task } from './types';

/** Testo sicuro per Mermaid: i due punti separano i campi, `;` e `#` hanno un significato nella sintassi. */
const clean = (s: string) =>
	s.replace(/\s+/g, ' ').replace(/:/g, '∶').replace(/;/g, ',').replace(/#/g, '＃').replace(/%%/g, '%').trim() || '-';

/**
 * Diagramma Mermaid (`gantt`) dei task passati: le cartelle e sottocartelle diventano sezioni
 * («Cartella / Sottocartella»), i sotto-task seguono il padre con il prefisso «↳».
 * Sono inclusi solo i task con scadenza e con «Mostra nel Gantt» attivo; la durata è in giorni
 * (inizio e scadenza compresi). Restituisce '' se non c'è nulla da esportare.
 */
export function ganttToMermaid(tasks: Task[], title: string): string {
	const ids = new Set(tasks.map((x) => x.id));
	const kids = new Map<string, Task[]>();
	const roots = new Map<string | null, Task[]>();
	for (const x of tasks) {
		if (x.parent_id && ids.has(x.parent_id)) {
			const a = kids.get(x.parent_id) ?? [];
			a.push(x);
			kids.set(x.parent_id, a);
		} else {
			const g = x.group_id && store.groupsById.has(x.group_id) ? x.group_id : null;
			const a = roots.get(g) ?? [];
			a.push(x);
			roots.set(g, a);
		}
	}

	let n = 0;
	const out: string[] = [];
	const addTask = (x: Task, depth: number, lines: string[]) => {
		if (x.in_gantt && x.due_date) {
			let start = taskStart(x);
			if (start > x.due_date) start = x.due_date;
			const tags: string[] = [];
			if (x.completed) tags.push('done');
			else {
				if (x.status === 'doing') tags.push('active');
				if (x.priority === 3) tags.push('crit');
			}
			n++;
			if (x.milestone) lines.push(`        ${'↳ '.repeat(depth)}${clean(x.title)} :${[...tags, 'milestone', 't' + n, x.due_date, '0d'].join(', ')}`);
			else lines.push(`        ${'↳ '.repeat(depth)}${clean(x.title)} :${[...tags, 't' + n, start, diffDays(x.due_date, start) + 1 + 'd'].join(', ')}`);
		}
		for (const k of kids.get(x.id) ?? []) addTask(k, depth + 1, lines);
	};
	const emit = (name: string, list: Task[]) => {
		const lines: string[] = [];
		for (const x of list) addTask(x, 0, lines);
		if (lines.length) out.push(`    section ${clean(name)}`, ...lines);
	};
	const walk = (parent: string | null, path: string[]) => {
		for (const g of store.groupChildren(parent)) {
			const p = [...path, g.name];
			walk(g.id, p);
			emit(p.join(' / '), roots.get(g.id) ?? []);
		}
	};
	walk(null, []);
	emit(t('Nessun gruppo'), roots.get(null) ?? []);
	if (!n) return '';

	return [
		`# ${title.replace(/\s+/g, ' ').trim()}`,
		'',
		'```mermaid',
		'gantt',
		`    title ${clean(title)}`,
		'    dateFormat YYYY-MM-DD',
		'    axisFormat %d/%m',
		...out,
		'```',
		''
	].join('\n');
}

/** Chiede dove salvare e scrive il `.md` col diagramma. Restituisce il percorso, `'empty'` se non c'è nulla da esportare, `null` se annullato. */
export async function exportGanttMd(tasks: Task[], title: string): Promise<string | 'empty' | null> {
	const md = ganttToMermaid(tasks, title);
	if (!md) return 'empty';
	const safe = title.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'gantt';
	const dest = await saveDialog({ defaultPath: `${safe} - gantt.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] });
	if (!dest) return null;
	await invoke('save_text_file', { path: dest, content: md });
	return dest;
}
