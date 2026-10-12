import { addDays, diffDays, todayISO, toMinutes } from './dates';
import type { Filter, Rule, SortMode, Task } from './types';

export interface ScopeInfo {
	kind: 'smart' | 'list' | 'filter' | 'tag';
	id: string;
}

export function parseScope(scope: string): ScopeInfo {
	if (scope.startsWith('list:')) return { kind: 'list', id: scope.slice(5) };
	if (scope.startsWith('tag:')) return { kind: 'tag', id: scope.slice(4) };
	if (scope.startsWith('filter:')) return { kind: 'filter', id: scope.slice(7) };
	return { kind: 'smart', id: scope };
}

function dueMatches(t: Task, value: string): boolean {
	const today = todayISO();
	switch (value) {
		case 'none':
			return !t.due_date;
		case 'any':
			return !!t.due_date;
		case 'overdue':
			return !!t.due_date && t.due_date < today && !t.completed;
		case 'today':
			return t.due_date === today;
		case 'tomorrow':
			return t.due_date === addDays(today, 1);
		case 'next7':
			return !!t.due_date && t.due_date >= today && t.due_date <= addDays(today, 6);
		default:
			if (value.startsWith('date:')) return t.due_date === value.slice(5);
			return false;
	}
}

export function ruleMatches(t: Task, r: Rule, blocked?: Set<string>): boolean {
	const neg = r.op === '!=';
	let res: boolean;
	switch (r.field) {
		case 'priority': {
			const v = Number(r.value);
			if (r.op === '>=') return t.priority >= v;
			if (r.op === '<=') return t.priority <= v;
			res = t.priority === v;
			break;
		}
		case 'due':
			res = dueMatches(t, r.value);
			break;
		case 'list':
			res = r.value === 'inbox' ? t.list_id === null : t.list_id === r.value;
			break;
		case 'status':
			res = t.status === r.value;
			break;
		case 'completed':
			res = t.completed === (r.value === 'true');
			break;
		case 'blocked':
			res = !!blocked?.has(t.id) === (r.value === 'true');
			break;
		case 'tag':
			res = t.tags.includes(r.value.toLowerCase());
			break;
		case 'title':
			res = t.title.toLowerCase().includes(r.value.toLowerCase());
			break;
		default:
			res = true;
	}
	return neg ? !res : res;
}

export function filterMatches(t: Task, f: Filter, blocked?: Set<string>): boolean {
	if (f.rules.length === 0) return true;
	return f.match_mode === 'or' ? f.rules.some((r) => ruleMatches(t, r, blocked)) : f.rules.every((r) => ruleMatches(t, r, blocked));
}

/** Il task appartiene alla vista `scope`? (i completati sono inclusi: li separa la UI) */
export function inScope(t: Task, scope: string, filters: Filter[], blocked?: Set<string>): boolean {
	const s = parseScope(scope);
	const today = todayISO();
	if (s.kind === 'list') return t.list_id === s.id;
	if (s.kind === 'tag') return t.tags.includes(s.id);
	if (s.kind === 'filter') {
		const f = filters.find((x) => x.id === s.id);
		return f ? filterMatches(t, f, blocked) : false;
	}
	switch (s.id) {
		case 'inbox':
			return t.list_id === null;
		case 'important':
			return t.priority === 3;
		case 'today':
			return !!t.due_date && (t.completed ? t.due_date === today : t.due_date <= today);
		case 'next7': {
			if (!t.due_date) return false;
			if (t.completed) return t.due_date >= today && t.due_date <= addDays(today, 6);
			return t.due_date <= addDays(today, 6);
		}
		default:
			return true;
	}
}

export function compareManual(a: Task, b: Task): number {
	return a.sort - b.sort || a.created_at.localeCompare(b.created_at);
}

export function sortTasks(tasks: Task[], mode: SortMode): Task[] {
	const arr = [...tasks];
	if (mode === 'priority') arr.sort((a, b) => b.priority - a.priority || compareManual(a, b));
	else if (mode === 'due')
		arr.sort((a, b) => {
			if (a.due_date !== b.due_date) {
				if (!a.due_date) return 1;
				if (!b.due_date) return -1;
				return a.due_date.localeCompare(b.due_date);
			}
			const ta = toMinutes(a.start_time) ?? 9999;
			const tb = toMinutes(b.start_time) ?? 9999;
			return ta - tb || compareManual(a, b);
		});
	else arr.sort(compareManual);
	return arr;
}

export function isOverdue(t: Task): boolean {
	return !!t.due_date && !t.completed && diffDays(t.due_date, todayISO()) < 0;
}

/** Calcola il valore `sort` per inserire un elemento tra due vicini. */
export function sortBetween(prev: number | undefined, next: number | undefined): { value: number; needsRenumber: boolean } {
	if (prev === undefined && next === undefined) return { value: Date.now(), needsRenumber: false };
	if (prev === undefined) return { value: next! - 1000, needsRenumber: false };
	if (next === undefined) return { value: prev + 1000, needsRenumber: false };
	const value = (prev + next) / 2;
	return { value, needsRenumber: Math.abs(next - prev) < 1e-6 };
}
