/**
 * Modelli di task: un task (con i suoi sotto-task) salvato per essere ricreato in un attimo.
 * Stanno in localStorage (`toodly.templates`): valgono per tutti i set di dati e finiscono nei backup.
 * Le date sono salvate come distanza in giorni dal task principale, così si adattano alla data scelta.
 */
import { addDays, diffDays, taskStart, todayISO } from './dates';
import { store } from './store.svelte';
import { t } from './i18n.svelte';
import type { Priority, Task } from './types';

export interface TplNode {
	title: string;
	description: string;
	priority: Priority;
	tags: string[];
	in_gantt: boolean;
	milestone: boolean;
	recurrence: string;
	/** giorni di distanza dalla data di riferimento (null = nessuna data) */
	dueOff: number | null;
	startOff: number | null;
	start_time: string | null;
	end_time: string | null;
	remind_min: number | null;
	/** durata stimata in minuti (assente nei modelli salvati prima: durata predefinita) */
	duration_min?: number | null;
	/** economia (assente nei modelli salvati prima) */
	rate_cents?: number | null;
	expense_cents?: number | null;
	revenue_cents?: number | null;
	vat_rate?: number | null;
	children: TplNode[];
}
export interface Template {
	id: string;
	name: string;
	created_at: string;
	root: TplNode;
}

const KEY = 'toodly.templates';
const MAX_DEPTH = 6;

export const templates = $state<{ list: Template[] }>({ list: [] });

export function loadTemplates() {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		templates.list = Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === 'string' && x.root && typeof x.name === 'string') : [];
	} catch {
		templates.list = [];
	}
}
function persist() {
	try {
		localStorage.setItem(KEY, JSON.stringify(templates.list));
	} catch {}
}

function nodeOf(task: Task, ref: string, depth: number): TplNode {
	return {
		title: task.title,
		description: task.description,
		priority: task.priority,
		tags: [...task.tags],
		in_gantt: task.in_gantt,
		milestone: task.milestone,
		recurrence: task.recurrence,
		dueOff: task.due_date ? diffDays(task.due_date, ref) : null,
		startOff: task.due_date ? diffDays(taskStart(task), ref) : null,
		start_time: task.start_time,
		end_time: task.end_time,
		remind_min: task.remind_min,
		duration_min: task.duration_min,
		rate_cents: task.rate_cents,
		expense_cents: task.expense_cents,
		revenue_cents: task.revenue_cents,
		vat_rate: task.vat_rate,
		children: depth >= MAX_DEPTH ? [] : store.children(task.id).map((c) => nodeOf(c, ref, depth + 1))
	};
}

/** Salva il task (con i sotto-task) come modello. Restituisce il modello creato. */
export function saveTemplateFrom(taskId: string, name?: string): Template | null {
	const task = store.byId.get(taskId);
	if (!task) return null;
	loadTemplates();
	const ref = task.due_date ?? taskStart(task);
	const tpl: Template = {
		id: Math.random().toString(36).slice(2) + Date.now().toString(36),
		name: (name ?? task.title).trim() || t('Modello'),
		created_at: new Date().toISOString(),
		root: nodeOf(task, ref, 0)
	};
	templates.list = [...templates.list, tpl];
	persist();
	return tpl;
}

export function deleteTemplate(id: string) {
	templates.list = templates.list.filter((x) => x.id !== id);
	persist();
}
export function renameTemplate(id: string, name: string) {
	const n = name.trim();
	if (!n) return;
	templates.list = templates.list.map((x) => (x.id === id ? { ...x, name: n } : x));
	persist();
}

export function countNodes(n: TplNode): number {
	return 1 + n.children.reduce((a, c) => a + countNodes(c), 0);
}

export interface UseOpts {
	/** data di riferimento (i task con date si spostano di conseguenza) */
	base: string;
	list_id?: string | null;
	group_id?: string | null;
	tags?: string[];
}

/** Crea i task del modello (un'unica operazione annullabile). Restituisce l'id del task principale. */
export async function useTemplate(tpl: Template, opts: UseOpts): Promise<string | null> {
	let rootId: string | null = null;
	await store.batch(
		t('Nuovo da modello'),
		async () => {
			const make = async (n: TplNode, parentId: string | null): Promise<string> => {
				const created = await store.createTask({
					title: n.title,
					description: n.description,
					priority: n.priority,
					parent_id: parentId,
					list_id: parentId ? undefined : (opts.list_id ?? undefined),
					group_id: parentId ? undefined : (opts.group_id ?? undefined),
					tags: [...n.tags, ...(parentId ? [] : (opts.tags ?? []))],
					in_gantt: n.in_gantt,
					milestone: n.milestone,
					recurrence: n.recurrence,
					due_date: n.dueOff == null ? null : addDays(opts.base, n.dueOff),
					start_date: n.startOff == null ? undefined : addDays(opts.base, n.startOff),
					start_time: n.start_time,
					end_time: n.end_time,
					remind_min: n.dueOff == null ? null : n.remind_min,
					duration_min: n.duration_min ?? null,
					rate_cents: n.rate_cents ?? null,
					expense_cents: n.expense_cents ?? null,
					revenue_cents: n.revenue_cents ?? null,
					vat_rate: n.vat_rate ?? null
				});
				for (const c of n.children) await make(c, created.id);
				return created.id;
			};
			rootId = await make(tpl.root, null);
		},
		true
	);
	return rootId;
}

export const defaultBase = () => todayISO();
