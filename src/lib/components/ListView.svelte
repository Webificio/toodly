<script lang="ts">
	import { flip } from 'svelte/animate';
	import { SvelteSet } from 'svelte/reactivity';
	import { ChevronRight, Inbox } from '@lucide/svelte';
	import TaskRow from './TaskRow.svelte';
	import QuickInput from './QuickInput.svelte';
	import GroupRow from './GroupRow.svelte';
	import { FolderPlus } from '@lucide/svelte';
	import { collapsedGroups, toggleGroup, expandGroup } from '../groupui.svelte';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { setVisibleOrder } from '../selection.svelte';
	import { nav, ui } from '../nav.svelte';
	import { inScope, parseScope, sortTasks } from '../views';
	import { parseQuick } from '../quickparse';
	import { addDays, todayISO } from '../dates';
	import { mIn } from '../motion';
	import { drag, dropzone, type DropEvent } from '../dnd.svelte';
	import type { Group, Task } from '../types';

	const scopeInfo = $derived(parseScope(nav.scope));
	const matched = $derived(store.tasks.filter((t) => inScope(t, nav.scope, store.filters, store.blockedIds)));
	const matchedIds = $derived(new Set(matched.map((t) => t.id)));
	const sorted = $derived(sortTasks(matched, nav.sort));

	const collapsed = new SvelteSet<string>();
	let showDone = $state(true);
	let mark = $state<{ id: string; pos: 'before' | 'after' } | null>(null);

	const childMap = $derived.by(() => {
		const m = new Map<string, Task[]>();
		for (const t of sorted) {
			if (t.parent_id && matchedIds.has(t.parent_id)) {
				const a = m.get(t.parent_id) ?? [];
				a.push(t);
				m.set(t.parent_id, a);
			}
		}
		return m;
	});
	const isRoot = (t: Task) => !t.parent_id || !matchedIds.has(t.parent_id);

	interface Row { task: Task; depth: number; hasChildren: boolean }
	function flatten(roots: Task[], base = 0): Row[] {
		const out: Row[] = [];
		const walk = (t: Task, depth: number) => {
			const kids = childMap.get(t.id) ?? [];
			out.push({ task: t, depth, hasChildren: kids.length > 0 });
			if (!collapsed.has(t.id)) for (const k of kids) walk(k, depth + 1);
		};
		for (const r of roots) walk(r, base);
		return out;
	}
	const doneRows = $derived(flatten(sorted.filter((t) => isRoot(t) && t.completed)));

	// ---- gruppi (cartelle) ----------------------------------------------------
	/** Gruppo effettivo di un task (un riferimento a un gruppo inesistente vale "nessun gruppo"). */
	const groupOf = (t: Task) => (t.group_id && store.groupsById.has(t.group_id) ? t.group_id : null);

	type Item =
		| { kind: 'group'; group: Group; depth: number; count: number; collapsed: boolean }
		| { kind: 'add'; group: Group; depth: number }
		| { kind: 'row'; row: Row };

	let addingIn = $state<string | null>(null);

	const rootsByGroup = $derived.by(() => {
		const m = new Map<string | null, Task[]>();
		for (const t of sorted) {
			if (!isRoot(t) || t.completed) continue;
			const g = groupOf(t);
			const a = m.get(g) ?? [];
			a.push(t);
			m.set(g, a);
		}
		return m;
	});
	/** N. di task aperti (radice) in un gruppo, sottogruppi inclusi. */
	const counts = $derived.by(() => {
		const c = new Map<string, number>();
		const calc = (id: string): number => {
			const n = (rootsByGroup.get(id)?.length ?? 0) + store.groupChildren(id).reduce((sum, g) => sum + calc(g.id), 0);
			c.set(id, n);
			return n;
		};
		for (const g of store.groupChildren(null)) calc(g.id);
		return c;
	});

	const items = $derived.by(() => {
		const build = (parent: string | null, depth: number): Item[] => {
			const out: Item[] = [];
			// 1) prima i sottogruppi…
			for (const g of store.groupChildren(parent)) {
				const count = counts.get(g.id) ?? 0;
								const isCollapsed = collapsedGroups.has(g.id);
				out.push({ kind: 'group', group: g, depth, count, collapsed: isCollapsed });
				if (!isCollapsed) {
					if (addingIn === g.id) out.push({ kind: 'add', group: g, depth: depth + 1 });
					out.push(...build(g.id, depth + 1));
				}
			}
			// 2) …poi i task dello stesso livello
			for (const row of flatten(rootsByGroup.get(parent) ?? [], depth)) out.push({ kind: 'row', row });
			return out;
		};
		return build(null, 0);
	});
	const openRows = $derived(items.flatMap((i) => (i.kind === 'row' ? [i.row] : [])));
	$effect(() => setVisibleOrder([...openRows, ...doneRows].map((r) => r.task.id)));
	const doneCount = $derived(matched.filter((t) => t.completed).length);
	const itemKey = (i: Item) => (i.kind === 'row' ? 't:' + i.row.task.id : (i.kind === 'group' ? 'g:' : 'a:') + i.group.id);

	function addInGroup(group: Group, text: string) {
		const p = parseQuick(text, store.lists);
		if (!p.title) return;
		const t = todayISO();
		store.createTask({
			title: p.title,
			group_id: group.id,
			priority: p.priority || (nav.scope === 'important' ? 3 : 0),
			list_id: p.list_id ?? (scopeInfo.kind === 'list' ? scopeInfo.id : null),
			due_date: p.due_date ?? (nav.scope === 'today' ? t : nav.scope === 'next7' ? addDays(t, 1) : null)
		});
		addingIn = null;
	}

	// zona "livello principale": sposta fuori dai gruppi
	const dragging = $derived(drag.active && (drag.payload?.type === 'group' || (drag.payload?.type === 'task' && !!store.byId.get(drag.payload.id)?.group_id)));
	let overRoot = $state(false);
	async function dropRoot(e: DropEvent) {
		overRoot = false;
		const p = e.payload;
		if (p.type === 'group') await store.updateGroup(p.id, { parent_id: null });
		else if (p.type === 'task') await store.moveToGroup(p.id, null);
	}

	function add(text: string) {
		const p = parseQuick(text, store.lists);
		if (!p.title) return;
		const t = todayISO();
		store.createTask({
			title: p.title,
			priority: p.priority || (nav.scope === 'important' ? 3 : 0),
			list_id: p.list_id ?? (scopeInfo.kind === 'list' ? scopeInfo.id : null),
			due_date: p.due_date ?? (nav.scope === 'today' ? t : nav.scope === 'next7' ? addDays(t, 1) : null)
		});
	}

	// ---- riordino manuale ---------------------------------------------------
	function over(row: Row, e: DropEvent) {
		if (nav.sort !== 'manual') return;
		const pos = e.y < e.rect.top + e.rect.height / 2 ? 'before' : 'after';
		if (mark?.id !== row.task.id || mark.pos !== pos) mark = { id: row.task.id, pos };
	}
	async function drop(row: Row, e: DropEvent) {
		const m = mark;
		mark = null;
		if (nav.sort !== 'manual' || !m) return;
		const moved = store.byId.get(e.payload.id);
		if (!moved) return;
		// non si può inserire un task dentro la propria discendenza
		if (store.descendants(moved.id).some((d) => d.id === row.task.id)) return;
		const target = row.task;
		const parentId = target.parent_id && matchedIds.has(target.parent_id) ? target.parent_id : null;
		const tg = groupOf(target);
		const siblings = sorted.filter((t) => (parentId ? t.parent_id === parentId : isRoot(t) && groupOf(t) === tg) && t.completed === target.completed && t.id !== moved.id);
		let idx = siblings.findIndex((s) => s.id === target.id);
		if (idx < 0) idx = siblings.length;
		else if (m.pos === 'after') idx++;
		const extra: Partial<Task> = { parent_id: parentId, group_id: parentId ? null : tg };
		await store.reorder(moved.id, siblings.map((s) => s.id), idx, extra);
		if (parentId) {
			const parent = store.byId.get(parentId);
			if (parent && parent.list_id !== moved.list_id) await store.moveToList(moved.id, parent.list_id);
		}
	}
</script>

<div class="flex h-full flex-col" data-scroll="y">
	<div class="flex min-h-0 w-full flex-1 flex-col px-4 pt-4">
		<div class="flex items-center gap-2">
			<div class="min-w-0 flex-1"><QuickInput onsubmit={add} placeholder={t('Aggiungi un task…   (!alta  @domani  #lista)')} /></div>
			<button class="btn h-10 shrink-0" title={t('Nuovo gruppo')} onclick={() => (ui.groupEditor = 'new')}><FolderPlus size={16} />{t('Gruppo')}</button>
		</div>
		<div class="mt-3 min-h-0 flex-1 overflow-auto pb-24" data-scroll="y">
			{#if items.length === 0 && doneRows.length === 0}
				<div class="grid place-items-center gap-2 pt-24 text-center text-muted" in:mIn={{ y: 8 }}>
					<Inbox size={36} strokeWidth={1.4} class="text-faint" />
					<p>{t('Nessun task qui. Scrivine uno nella barra qui sopra.')}</p>
				</div>
			{/if}
			{#if dragging}
				<div
					class="fixed bottom-6 left-1/2 z-30 grid h-11 w-[min(520px,70vw)] -translate-x-1/2 place-items-center rounded-xl border border-dashed bg-elev text-[12.5px] shadow-pop transition-colors {overRoot ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted'}"
					use:dropzone={{ accept: (p) => p?.type === 'group' || p?.type === 'task', over: () => (overRoot = true), leave: () => (overRoot = false), drop: dropRoot }}
					in:mIn={{ y: -6, duration: 0.18 }}
				>{t('Sposta fuori dai gruppi (livello principale)')}</div>
			{/if}
			{#each items as it (itemKey(it))}
				<div animate:flip={{ duration: 220 }} in:mIn|local={{ y: -6, duration: 0.22 }}>
					{#if it.kind === 'group'}
						<GroupRow
							group={it.group}
							depth={it.depth}
							count={it.count}
							collapsed={it.collapsed}
							ontoggle={() => toggleGroup(it.group.id)}
							onaddtask={() => { expandGroup(it.group.id); addingIn = addingIn === it.group.id ? null : it.group.id; }}
						/>
					{:else if it.kind === 'add'}
						<div style="padding-left:{6 + it.depth * 26 + 20}px" class="py-1 pr-2">
							<QuickInput compact autofocus placeholder={t('Nuovo task in «{name}»…', { name: it.group.name })} onsubmit={(x) => addInGroup(it.group, x)} />
						</div>
					{:else}
						{@const row = it.row}
						<TaskRow
							task={row.task}
							depth={row.depth}
							hasChildren={row.hasChildren}
							expanded={!collapsed.has(row.task.id)}
							sortable={nav.sort === 'manual'}
							showList={scopeInfo.kind !== 'list'}
							dropMark={mark?.id === row.task.id ? mark.pos : null}
							ontoggleexpand={() => (collapsed.has(row.task.id) ? collapsed.delete(row.task.id) : collapsed.add(row.task.id))}
							onover={(e) => over(row, e)}
							onleave={() => (mark = null)}
							ondrop={(e) => drop(row, e)}
						/>
					{/if}
				</div>
			{/each}

			{#if doneCount > 0}
				<button class="mt-5 mb-1 flex items-center gap-1.5 px-2 text-[12px] font-medium text-muted hover:text-fg" onclick={() => (showDone = !showDone)}>
					<ChevronRight size={14} class="transition-transform duration-150 {showDone ? 'rotate-90' : ''}" />
					{t('Completati')} · {doneCount}
				</button>
				{#if showDone}
					{#each doneRows as row (row.task.id)}
						<div animate:flip={{ duration: 220 }} in:mIn|local={{ y: -6, duration: 0.22 }}>
							<TaskRow task={row.task} depth={row.depth} hasChildren={row.hasChildren} expanded={!collapsed.has(row.task.id)} showList={scopeInfo.kind !== 'list'}
								ontoggleexpand={() => (collapsed.has(row.task.id) ? collapsed.delete(row.task.id) : collapsed.add(row.task.id))} />
						</div>
					{/each}
				{/if}
			{/if}
		</div>
	</div>
</div>
