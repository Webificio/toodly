import type { Task } from '../src/lib/types';

/** Task di prova con valori predefiniti ragionevoli. */
export function mkTask(over: Partial<Task> = {}): Task {
	return {
		id: 't1',
		list_id: 'l1',
		group_id: null,
		parent_id: null,
		title: 'Task',
		description: '',
		completed: false,
		completed_at: null,
		priority: 0,
		status: 'todo',
		milestone: false,
		in_gantt: true,
		tags: [],
		remind_min: null,
		start_date: null,
		due_date: null,
		start_time: null,
		end_time: null,
		recurrence: 'none',
		recur_until: null,
		sort: 0,
		created_at: '2026-01-01T10:00:00.000Z',
		updated_at: '2026-01-01T10:00:00.000Z',
		...over
	} as Task;
}
