import { t as tl } from './i18n.svelte';
import { invoke } from '@tauri-apps/api/core';
import { exec, select } from './db';
import { nextOccurrence } from './dates';
import { nowISO, uid } from './ids';
import { notifyDataChanged } from './windowing';
import { showToast } from './nav.svelte';
import { compareManual, sortBetween } from './views';
import { LIST_COLORS } from './types';
import type { Attachment, Dep, Filter, Group, List, Note, Priority, Rule, Status, Task } from './types';

type TaskRow = Omit<Task, 'completed'> & { completed: number };
type FilterRow = Omit<Filter, 'rules'> & { rules: string };

const TASK_COLUMNS = [
	'list_id', 'group_id', 'parent_id', 'title', 'description', 'completed', 'completed_at', 'priority', 'status',
	'due_date', 'start_time', 'end_time', 'recurrence', 'sort', 'updated_at'
] as const;

class Store {
	lists = $state<List[]>([]);
	groups = $state<Group[]>([]);
	tasks = $state<Task[]>([]);
	notes = $state<Note[]>([]);
	attachments = $state<Attachment[]>([]);
	filters = $state<Filter[]>([]);
	deps = $state<Dep[]>([]);
	ready = $state(false);

	byId = $derived(new Map(this.tasks.map((t) => [t.id, t])));
	/** Task "in attesa": hanno almeno un prerequisito non ancora completato. */
	blockedIds = $derived.by(() => {
		const set = new Set<string>();
		for (const d of this.deps) {
			const pre = this.byId.get(d.depends_on_id);
			const t = this.byId.get(d.task_id);
			if (pre && t && !pre.completed && !t.completed) set.add(d.task_id);
		}
		return set;
	});
	listsSorted = $derived([...this.lists].sort((a, b) => a.sort - b.sort));
	/** Lista predefinita: la prima in ordine. Ogni task appartiene sempre a una lista. */
	defaultListId = $derived(this.listsSorted[0]?.id ?? null);
	groupsById = $derived(new Map(this.groups.map((g) => [g.id, g])));
	filtersSorted = $derived([...this.filters].sort((a, b) => a.sort - b.sort));

	private queue: Promise<unknown> = Promise.resolve();

	/** Serializza le scritture sul DB per mantenere l'ordine delle operazioni. */
	private write<T>(fn: () => Promise<T>): Promise<T> {
		const p = this.queue.then(fn, fn);
		this.queue = p.catch(() => {});
		return p
			.then((r) => {
				notifyDataChanged();
				return r;
			})
			.catch((e) => {
				console.error('[toodly] errore di scrittura', e);
				this.reload();
				throw e;
			});
	}

	async reload() {
		const [lists, groups, tasks, notes, attachments, filters, deps] = await Promise.all([
			select<List>('SELECT * FROM lists'),
			select<Group>('SELECT * FROM task_groups'),
			select<TaskRow>('SELECT * FROM tasks'),
			select<Note>('SELECT * FROM notes ORDER BY created_at ASC'),
			select<Attachment>('SELECT * FROM attachments ORDER BY created_at ASC'),
			select<FilterRow>('SELECT * FROM filters'),
			select<Dep>('SELECT * FROM task_deps')
		]);
		this.lists = lists;
		this.groups = groups;
		this.tasks = tasks.map((t) => ({ ...t, completed: !!t.completed }));
		this.notes = notes;
		this.attachments = attachments;
		this.filters = filters.map((f) => ({ ...f, rules: safeRules(f.rules) }));
		this.deps = deps;
		await this.ensureDefaultList();
		this.ready = true;
	}

	/** Ogni set ha almeno una lista e nessun task è senza lista (dati vecchi o importati compresi). */
	private async ensureDefaultList() {
		if (!this.lists.length) await this.createList(tl('Generale'), LIST_COLORS[0]);
		const def = this.defaultListId;
		if (!def) return;
		const orphans = this.tasks.filter((t) => !t.list_id || !this.lists.some((l) => l.id === t.list_id));
		if (!orphans.length) return;
		for (const t of orphans) t.list_id = def;
		await this.write(() => exec('UPDATE tasks SET list_id = $1 WHERE list_id IS NULL OR list_id NOT IN (SELECT id FROM lists)', [def]));
	}

	// ----- Lettura -----------------------------------------------------------

	children(id: string): Task[] {
		return this.tasks.filter((t) => t.parent_id === id).sort(compareManual);
	}
	descendants(id: string): Task[] {
		const out: Task[] = [];
		const stack = [id];
		while (stack.length) {
			const cur = stack.pop()!;
			for (const t of this.tasks) {
				if (t.parent_id === cur) {
					out.push(t);
					stack.push(t.id);
				}
			}
		}
		return out;
	}
	/** Prerequisiti di `id` (task da cui dipende). */
	prereqs(id: string): Task[] {
		return this.deps.filter((d) => d.task_id === id).map((d) => this.byId.get(d.depends_on_id)).filter((t): t is Task => !!t);
	}
	/** Task che dipendono da `id`. */
	dependents(id: string): Task[] {
		return this.deps.filter((d) => d.depends_on_id === id).map((d) => this.byId.get(d.task_id)).filter((t): t is Task => !!t);
	}
	/** Prerequisiti ancora da completare. */
	blockers(id: string): Task[] {
		return this.prereqs(id).filter((t) => !t.completed);
	}
	/** Aggiungere `dependsOn` come prerequisito di `id` creerebbe un ciclo? */
	wouldCycle(id: string, dependsOn: string): boolean {
		if (id === dependsOn) return true;
		const seen = new Set<string>();
		const stack = [dependsOn];
		while (stack.length) {
			const cur = stack.pop()!;
			if (cur === id) return true;
			if (seen.has(cur)) continue;
			seen.add(cur);
			for (const d of this.deps) if (d.task_id === cur) stack.push(d.depends_on_id);
		}
		return false;
	}
	notesOf(id: string) {
		return this.notes.filter((n) => n.task_id === id);
	}
	attachmentsOf(id: string) {
		return this.attachments.filter((a) => a.task_id === id);
	}
	listOf(id: string | null) {
		return id ? this.lists.find((l) => l.id === id) : undefined;
	}

	// ----- Task --------------------------------------------------------------

	async createTask(input: Partial<Task> & { title: string }): Promise<Task> {
		const parent = input.parent_id ? this.byId.get(input.parent_id) : undefined;
		const now = nowISO();
		const task: Task = {
			id: uid(),
			list_id: parent ? parent.list_id : (input.list_id ?? this.defaultListId),
			group_id: parent ? null : (input.group_id ?? null),
			parent_id: input.parent_id ?? null,
			title: input.title,
			description: input.description ?? '',
			completed: false,
			completed_at: null,
			priority: (input.priority ?? 0) as Priority,
			status: input.status ?? 'todo',
			due_date: input.due_date ?? null,
			start_time: input.start_time ?? null,
			end_time: input.end_time ?? null,
			recurrence: input.recurrence ?? 'none',
			sort: input.sort ?? Date.now(),
			created_at: now,
			updated_at: now
		};
		if (task.status === 'done') {
			task.completed = true;
			task.completed_at = now;
		}
		this.tasks.push(task);
		await this.write(() => this.insertTask(task));
		return this.byId.get(task.id) ?? task;
	}

	private insertTask(t: Task) {
		return exec(
			`INSERT INTO tasks (id, list_id, group_id, parent_id, title, description, completed, completed_at, priority, status,
			 due_date, start_time, end_time, recurrence, sort, created_at, updated_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
			[t.id, t.list_id, t.group_id, t.parent_id, t.title, t.description, t.completed ? 1 : 0, t.completed_at, t.priority,
				t.status, t.due_date, t.start_time, t.end_time, t.recurrence, t.sort, t.created_at, t.updated_at]
		);
	}

	/** Aggiornamento ottimistico: UI subito, DB in coda. */
	async updateTask(id: string, patch: Partial<Task>) {
		const t = this.byId.get(id);
		if (!t) return;
		const full: Partial<Task> = { ...patch, updated_at: nowISO() };
		Object.assign(t, full);
		const keys = TASK_COLUMNS.filter((k) => k in full);
		const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
		const vals = keys.map((k) => {
			const v = (full as Record<string, unknown>)[k];
			return typeof v === 'boolean' ? (v ? 1 : 0) : v;
		});
		await this.write(() => exec(`UPDATE tasks SET ${sets} WHERE id = $1`, [id, ...vals]));
	}

	async setCompleted(id: string, value: boolean) {
		const t = this.byId.get(id);
		if (!t || t.completed === value) return;
		if (value) {
			const b = this.blockers(id);
			if (b.length) {
				showToast(`${tl('In attesa di')}: ${b.map((x) => x.title).slice(0, 2).join(', ')}${b.length > 2 ? '…' : ''}`);
				return;
			}
		}
		const now = nowISO();
		await this.updateTask(id, {
			completed: value,
			completed_at: value ? now : null,
			status: value ? 'done' : 'todo'
		});
		if (value) {
			// completare un task completa anche le sue sotto-attività
			for (const c of this.descendants(id)) {
				if (!c.completed) await this.updateTask(c.id, { completed: true, completed_at: now, status: 'done' });
			}
			if (t.recurrence !== 'none' && t.due_date) await this.spawnNextOccurrence(t);
		}
	}

	private async spawnNextOccurrence(t: Task) {
		const shift = (d: string | null) => (d ? nextOccurrence(d, t.recurrence) : d);
		const next = await this.createTask({
			list_id: t.list_id,
			group_id: t.group_id,
			parent_id: t.parent_id,
			title: t.title,
			description: t.description,
			priority: t.priority,
			due_date: shift(t.due_date),
			start_time: t.start_time,
			end_time: t.end_time,
			recurrence: t.recurrence,
			sort: t.sort
		});
		for (const c of this.children(t.id)) {
			await this.createTask({
				parent_id: next.id,
				title: c.title,
				priority: c.priority,
				due_date: shift(c.due_date),
				sort: c.sort
			});
		}
	}

	async setStatus(id: string, status: Status) {
		const t = this.byId.get(id);
		if (!t) return;
		if (status === 'done') return this.setCompleted(id, true);
		if (t.completed) {
			await this.updateTask(id, { completed: false, completed_at: null, status });
		} else if (t.status !== status) {
			await this.updateTask(id, { status });
		}
	}

	async deleteTask(id: string) {
		const ids = [id, ...this.descendants(id).map((d) => d.id)];
		const set = new Set(ids);
		this.tasks = this.tasks.filter((t) => !set.has(t.id));
		this.notes = this.notes.filter((n) => !set.has(n.task_id));
		this.attachments = this.attachments.filter((a) => !set.has(a.task_id));
		this.deps = this.deps.filter((d) => !set.has(d.task_id) && !set.has(d.depends_on_id));
		await this.write(async () => {
			for (const tid of ids) {
				await exec('DELETE FROM task_deps WHERE task_id = $1 OR depends_on_id = $1', [tid]);
				await invoke('delete_task_attachments', { taskId: tid }).catch(() => {});
				await exec('DELETE FROM notes WHERE task_id = $1', [tid]);
				await exec('DELETE FROM attachments WHERE task_id = $1', [tid]);
			}
			for (const tid of ids.reverse()) await exec('DELETE FROM tasks WHERE id = $1', [tid]);
		});
	}

	async moveToList(id: string, listId: string | null) {
		listId = listId ?? this.defaultListId;
		const all = [id, ...this.descendants(id).map((d) => d.id)];
		for (const tid of all) await this.updateTask(tid, { list_id: listId });
	}

	/**
	 * Riordina `id` dentro un contenitore: `ordered` è l'elenco ordinato degli ID
	 * (senza `id`) e `index` la posizione di inserimento.
	 */
	async reorder(id: string, ordered: string[], index: number, extra: Partial<Task> = {}) {
		const get = (i: number) => (i >= 0 && i < ordered.length ? this.byId.get(ordered[i])?.sort : undefined);
		const { value, needsRenumber } = sortBetween(get(index - 1), get(index));
		await this.updateTask(id, { ...extra, sort: value });
		if (needsRenumber) {
			const finalOrder = [...ordered];
			finalOrder.splice(index, 0, id);
			const base = Date.now();
			for (let i = 0; i < finalOrder.length; i++) await this.updateTask(finalOrder[i], { sort: base + i * 1000 });
		}
	}

	async addDep(taskId: string, dependsOnId: string): Promise<boolean> {
		if (this.wouldCycle(taskId, dependsOnId)) return false;
		if (this.deps.some((d) => d.task_id === taskId && d.depends_on_id === dependsOnId)) return true;
		const d: Dep = { task_id: taskId, depends_on_id: dependsOnId, created_at: nowISO() };
		this.deps.push(d);
		await this.write(() =>
			exec('INSERT OR IGNORE INTO task_deps (task_id, depends_on_id, created_at) VALUES ($1,$2,$3)', [d.task_id, d.depends_on_id, d.created_at])
		);
		return true;
	}
	async removeDep(taskId: string, dependsOnId: string) {
		this.deps = this.deps.filter((d) => !(d.task_id === taskId && d.depends_on_id === dependsOnId));
		await this.write(() => exec('DELETE FROM task_deps WHERE task_id = $1 AND depends_on_id = $2', [taskId, dependsOnId]));
	}

	// ----- Note e allegati -----------------------------------------------------

	async addNote(taskId: string, text: string) {
		const n: Note = { id: uid(), task_id: taskId, text, created_at: nowISO() };
		this.notes.push(n);
		await this.write(() =>
			exec('INSERT INTO notes (id, task_id, text, created_at) VALUES ($1,$2,$3,$4)', [n.id, n.task_id, n.text, n.created_at])
		);
	}
	async deleteNote(id: string) {
		this.notes = this.notes.filter((n) => n.id !== id);
		await this.write(() => exec('DELETE FROM notes WHERE id = $1', [id]));
	}
	async updateNote(id: string, text: string) {
		const n = this.notes.find((x) => x.id === id);
		if (n) n.text = text;
		await this.write(() => exec('UPDATE notes SET text = $2 WHERE id = $1', [id, text]));
	}

	/** Copia il file nella cartella dati dell'app e registra percorso assoluto e nome nel DB. */
	async addAttachment(taskId: string, srcPath: string) {
		const info = await invoke<{ path: string; name: string; size: number }>('add_attachment', { taskId, src: srcPath });
		const a: Attachment = { id: uid(), task_id: taskId, name: info.name, path: info.path, size: info.size, created_at: nowISO() };
		this.attachments.push(a);
		await this.write(() =>
			exec('INSERT INTO attachments (id, task_id, name, path, size, created_at) VALUES ($1,$2,$3,$4,$5,$6)', [a.id, a.task_id, a.name, a.path, a.size, a.created_at])
		);
	}
	async removeAttachment(id: string) {
		const a = this.attachments.find((x) => x.id === id);
		if (!a) return;
		this.attachments = this.attachments.filter((x) => x.id !== id);
		await this.write(async () => {
			await invoke('delete_attachment_file', { path: a.path }).catch(() => {});
			await exec('DELETE FROM attachments WHERE id = $1', [id]);
		});
	}
	openAttachment(path: string) {
		return invoke('open_attachment', { path });
	}

	// ----- Liste ---------------------------------------------------------------

	async createList(name: string, color: string): Promise<List> {
		const l: List = { id: uid(), name, color, sort: Date.now(), created_at: nowISO() };
		this.lists.push(l);
		await this.write(() =>
			exec('INSERT INTO lists (id, name, color, sort, created_at) VALUES ($1,$2,$3,$4,$5)', [l.id, l.name, l.color, l.sort, l.created_at])
		);
		return l;
	}
	async updateList(id: string, patch: Partial<Pick<List, 'name' | 'color'>>) {
		const l = this.lists.find((x) => x.id === id);
		if (!l) return;
		Object.assign(l, patch);
		await this.write(() => exec('UPDATE lists SET name = $2, color = $3 WHERE id = $1', [id, l.name, l.color]));
	}
	/** Elimina una lista; i suoi task passano alla lista predefinita. L'ultima lista non si può eliminare. */
	async deleteList(id: string) {
		const target = this.listsSorted.find((l) => l.id !== id);
		if (!target) return;
		for (const t of this.tasks) if (t.list_id === id) t.list_id = target.id;
		this.lists = this.lists.filter((l) => l.id !== id);
		await this.write(async () => {
			await exec('UPDATE tasks SET list_id = $2 WHERE list_id = $1', [id, target.id]);
			await exec('DELETE FROM lists WHERE id = $1', [id]);
		});
	}

	// ----- Gruppi (cartelle) ------------------------------------------------------

	/** Sottogruppi diretti di `parentId` (null = livello principale), in ordine manuale. */
	groupChildren(parentId: string | null): Group[] {
		return this.groups
			.filter((g) => g.parent_id === parentId)
			.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
	}
	groupDescendants(id: string): Group[] {
		const out: Group[] = [];
		const walk = (p: string) => {
			for (const g of this.groups) if (g.parent_id === p) (out.push(g), walk(g.id));
		};
		walk(id);
		return out;
	}
	/** Percorso "A / B / C" del gruppo. */
	groupPath(id: string | null): string {
		const parts: string[] = [];
		let cur = id ? this.groupsById.get(id) : undefined;
		for (let i = 0; cur && i < 50; i++) {
			parts.unshift(cur.name);
			cur = cur.parent_id ? this.groupsById.get(cur.parent_id) : undefined;
		}
		return parts.join(' / ');
	}
	/** `id` può diventare figlio di `parentId`? (no se coincide o è un suo discendente) */
	canNest(id: string, parentId: string | null): boolean {
		if (!parentId) return true;
		return parentId !== id && !this.groupDescendants(id).some((g) => g.id === parentId);
	}

	async createGroup(name: string, parentId: string | null, sort = Date.now()): Promise<Group> {
		const g: Group = { id: uid(), parent_id: parentId, name, sort, created_at: nowISO() };
		this.groups.push(g);
		await this.write(() =>
			exec('INSERT INTO task_groups (id, parent_id, name, sort, created_at) VALUES ($1,$2,$3,$4,$5)', [g.id, g.parent_id, g.name, g.sort, g.created_at])
		);
		return g;
	}
	async updateGroup(id: string, patch: Partial<Pick<Group, 'name' | 'parent_id' | 'sort'>>) {
		const g = this.groupsById.get(id);
		if (!g) return;
		if (patch.parent_id !== undefined && !this.canNest(id, patch.parent_id)) return;
		Object.assign(g, patch);
		await this.write(() => exec('UPDATE task_groups SET name = $2, parent_id = $3, sort = $4 WHERE id = $1', [id, g.name, g.parent_id, g.sort]));
	}
	/** Elimina il gruppo: sottogruppi e task salgono al gruppo padre. */
	async deleteGroup(id: string) {
		const g = this.groupsById.get(id);
		if (!g) return;
		const parent = g.parent_id;
		for (const x of this.groups) if (x.parent_id === id) x.parent_id = parent;
		for (const t of this.tasks) if (t.group_id === id) t.group_id = parent;
		this.groups = this.groups.filter((x) => x.id !== id);
		await this.write(async () => {
			await exec('UPDATE task_groups SET parent_id = $2 WHERE parent_id = $1', [id, parent]);
			await exec('UPDATE tasks SET group_id = $2 WHERE group_id = $1', [id, parent]);
			await exec('DELETE FROM task_groups WHERE id = $1', [id]);
		});
	}
	async moveToGroup(id: string, groupId: string | null) {
		const t = this.byId.get(id);
		if (!t || t.group_id === groupId) return;
		await this.updateTask(id, { group_id: groupId });
	}

	// ----- Filtri personalizzati -----------------------------------------------

	async saveFilter(f: { id?: string; name: string; match_mode: 'and' | 'or'; rules: Rule[] }): Promise<string> {
		const rules = $state.snapshot(f.rules) as Rule[];
		if (f.id) {
			const cur = this.filters.find((x) => x.id === f.id);
			if (cur) Object.assign(cur, { name: f.name, match_mode: f.match_mode, rules });
			const id = f.id;
			await this.write(() =>
				exec('UPDATE filters SET name = $2, match_mode = $3, rules = $4 WHERE id = $1', [id, f.name, f.match_mode, JSON.stringify(rules)])
			);
			return id;
		}
		const nf: Filter = { id: uid(), name: f.name, match_mode: f.match_mode, rules, sort: Date.now(), created_at: nowISO() };
		this.filters.push(nf);
		await this.write(() =>
			exec('INSERT INTO filters (id, name, match_mode, rules, sort, created_at) VALUES ($1,$2,$3,$4,$5,$6)', [nf.id, nf.name, nf.match_mode, JSON.stringify(nf.rules), nf.sort, nf.created_at])
		);
		return nf.id;
	}
	async deleteFilter(id: string) {
		this.filters = this.filters.filter((f) => f.id !== id);
		await this.write(() => exec('DELETE FROM filters WHERE id = $1', [id]));
	}
}

function safeRules(s: string): Rule[] {
	try {
		const v = JSON.parse(s);
		return Array.isArray(v) ? v : [];
	} catch {
		return [];
	}
}

export const store = new Store();
