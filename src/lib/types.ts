import { t } from './i18n.svelte';

export type Priority = 0 | 1 | 2 | 3; // 0 nessuna, 1 bassa, 2 media, 3 alta
export type Status = 'todo' | 'doing' | 'done';
/** 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'weekdays' | 'monthend' | 'dow:1,4' (giorni della settimana, 0 = domenica) */
export type Recurrence = string;

export interface Task {
	id: string;
	list_id: string | null;
	group_id: string | null;
	parent_id: string | null;
	title: string;
	description: string;
	completed: boolean;
	completed_at: string | null;
	priority: Priority;
	status: Status;
	remind_min: number | null; // promemoria: minuti prima dell'inizio (null = nessuno)
	tags: string[]; // etichette (minuscole, senza spazi)
	milestone: boolean; // traguardo: nel Gantt è un rombo sulla scadenza
	in_gantt: boolean; // false: nel Gantt resta una riga sottile, senza barra
	start_date: string | null; // YYYY-MM-DD, inizio (Gantt); null = data di creazione
	due_date: string | null; // YYYY-MM-DD
	start_time: string | null; // HH:MM
	end_time: string | null; // HH:MM
	recurrence: Recurrence;
	recur_until: string | null; // ultima data utile della ripetizione
	sort: number;
	created_at: string;
	updated_at: string;
}

export interface List {
	id: string;
	name: string;
	color: string;
	sort: number;
	created_at: string;
}

export interface Group {
	id: string;
	parent_id: string | null;
	name: string;
	sort: number;
	created_at: string;
}

export interface Note {
	id: string;
	task_id: string;
	text: string;
	created_at: string;
}

export interface Attachment {
	id: string;
	task_id: string;
	name: string;
	path: string;
	size: number;
	created_at: string;
}

export interface Dep {
	task_id: string;
	depends_on_id: string;
	created_at: string;
}

export type RuleField = 'priority' | 'due' | 'list' | 'status' | 'completed' | 'title' | 'blocked' | 'tag';
export interface Rule {
	field: RuleField;
	op: string;
	value: string;
}
export interface Filter {
	id: string;
	name: string;
	match_mode: 'and' | 'or';
	rules: Rule[];
	sort: number;
	created_at: string;
}

export type Mode = 'list' | 'kanban' | 'calendar' | 'gantt';
export type SortMode = 'manual' | 'priority' | 'due';

export const PRIORITIES: { value: Priority; label: string; cls: string }[] = [
	{ value: 3, get label() { return t('Alta'); }, cls: 'p3' },
	{ value: 2, get label() { return t('Media'); }, cls: 'p2' },
	{ value: 1, get label() { return t('Bassa'); }, cls: 'p1' },
	{ value: 0, get label() { return t('Nessuna'); }, cls: 'p0' }
];

export const STATUSES: { value: Status; label: string }[] = [
	{ value: 'todo', get label() { return t('Da Fare'); } },
	{ value: 'doing', get label() { return t('In Corso'); } },
	{ value: 'done', get label() { return t('Fatto'); } }
];

export const RECURRENCES: { value: Recurrence; label: string }[] = [
	{ value: 'none', get label() { return t('Non si ripete'); } },
	{ value: 'daily', get label() { return t('Ogni giorno'); } },
	{ value: 'weekly', get label() { return t('Ogni settimana'); } },
	{ value: 'monthly', get label() { return t('Ogni mese'); } },
	{ value: 'weekdays', get label() { return t('Nei giorni feriali'); } },
	{ value: 'monthend', get label() { return t('Ultimo giorno del mese'); } },
	{ value: 'yearly', get label() { return t('Ogni anno'); } }
];

export const LIST_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#64748b'];
