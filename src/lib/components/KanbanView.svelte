<script lang="ts">
	import { flip } from 'svelte/animate';
	import { Plus } from '@lucide/svelte';
	import Checkbox from './Checkbox.svelte';
	import TaskMeta from './TaskMeta.svelte';
	import QuickInput from './QuickInput.svelte';
	import { store } from '../store.svelte';
	import { selection, handleSelectClick, setVisibleOrder } from '../selection.svelte';
	import { t as tt } from '../i18n.svelte';
	import { nav, ui } from '../nav.svelte';
	import { compareManual, inScope, parseScope } from '../views';
	import { parseQuick } from '../quickparse';
	import { addDays, todayISO } from '../dates';
	import { drag, draggable, dropzone, type DropEvent } from '../dnd.svelte';
	import { mIn } from '../motion';
	import { PRIORITIES, STATUSES, type Priority, type Status, type Task } from '../types';

	interface Col { key: string; label: string; color: string }
	const columns = $derived<Col[]>(
		nav.group === 'status'
			? STATUSES.map((s) => ({ key: s.value, label: s.label, color: s.value === 'done' ? 'var(--p1)' : s.value === 'doing' ? 'var(--p2)' : 'var(--p0)' }))
			: PRIORITIES.map((p) => ({ key: String(p.value), label: p.label, color: `var(--p${p.value})` }))
	);

	const scopeInfo = $derived(parseScope(nav.scope));
	const roots = $derived(store.tasks.filter((t) => !t.parent_id && inScope(t, nav.scope, store.filters, store.blockedIds)));

	function inCol(t: Task, key: string) {
		return nav.group === 'status' ? (t.completed ? 'done' : t.status === 'doing' ? 'doing' : 'todo') === key : String(t.priority) === key;
	}
	const byCol = $derived(Object.fromEntries(columns.map((c) => [c.key, roots.filter((t) => inCol(t, c.key)).sort(compareManual)])) as Record<string, Task[]>);

	$effect(() => setVisibleOrder(columns.flatMap((c) => byCol[c.key].map((x) => x.id))));

	let drop = $state<{ col: string; index: number } | null>(null);
	const visIndex = (key: string, i: number) => byCol[key].slice(0, i).filter((t) => t.id !== drag.payload?.id).length;
	const visLen = (key: string) => byCol[key].filter((t) => t.id !== drag.payload?.id).length;

	function indexAt(e: DropEvent): number {
		const cards = Array.from(e.el.querySelectorAll<HTMLElement>('[data-card]'))
			.filter((c) => !c.classList.contains('drag-source'));
		let i = 0;
		for (const c of cards) {
			const r = c.getBoundingClientRect();
			if (e.y > r.top + r.height / 2) i++;
		}
		return i;
	}

	async function onDrop(col: Col, e: DropEvent) {
		const d = drop;
		drop = null;
		const moved = store.byId.get(e.payload.id);
		if (!moved || !d) return;
		const ordered = byCol[col.key].filter((t) => t.id !== moved.id).map((t) => t.id);
		if (nav.group === 'status') {
			await store.setStatus(moved.id, col.key as Status);
			await store.reorder(moved.id, ordered, d.index);
		} else {
			await store.reorder(moved.id, ordered, d.index, { priority: Number(col.key) as Priority });
		}
	}

	function add(col: Col, text: string) {
		const p = parseQuick(text, store.lists);
		if (!p.title) return;
		const t = todayISO();
		store.createTask({
			title: p.title,
			priority: nav.group === 'priority' ? (Number(col.key) as Priority) : p.priority,
			status: nav.group === 'status' ? (col.key as Status) : 'todo',
			list_id: p.list_id ?? (scopeInfo.kind === 'list' ? scopeInfo.id : null),
			due_date: p.due_date ?? (nav.scope === 'today' ? t : nav.scope === 'next7' ? addDays(t, 1) : null)
		});
	}
	let adding = $state<string | null>(null);
</script>

<div class="flex h-full gap-4 overflow-x-auto overflow-y-hidden p-5" data-scroll="xy">
	{#each columns as col (col.key)}
		<section
			class="flex max-h-full w-72 shrink-0 flex-col rounded-2xl bg-sidebar/70 ring-1 ring-border"
			use:dropzone={{
				accept: (p) => p?.type === 'task',
				over: (e) => {
					const index = indexAt(e);
					if (drop?.col !== col.key || drop.index !== index) drop = { col: col.key, index };
				},
				leave: () => (drop = null),
				drop: (e) => onDrop(col, e)
			}}
		>
			<header class="flex items-center gap-2 px-3.5 pt-3 pb-2">
				<span class="size-2.5 rounded-full" style="background:{col.color}"></span>
				<h3 class="text-[13px] font-semibold">{col.label}</h3>
				<span class="text-[12px] text-muted">{byCol[col.key].length}</span>
				<button class="icon-btn ml-auto" aria-label={tt('Aggiungi')} onclick={() => (adding = adding === col.key ? null : col.key)}><Plus size={15} /></button>
			</header>
			<div class="flex min-h-12 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-3" data-scroll="y">
				{#if adding === col.key}
					<div in:mIn={{ y: -6 }}>
						<QuickInput compact autofocus placeholder={tt('Titolo…')} onsubmit={(t) => add(col, t)} />
					</div>
				{/if}
				{#each byCol[col.key] as task, i (task.id)}
					<div animate:flip={{ duration: 200 }} in:mIn|local={{ y: 8, duration: 0.22 }} class="flex flex-col gap-2">
						{#if drop?.col === col.key && task.id !== drag.payload?.id && drop.index === visIndex(col.key, i)}<div class="-my-1 h-0.5 rounded bg-accent"></div>{/if}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div
							data-card
							data-task
							class="cursor-grab rounded-xl border bg-panel p-3 shadow-sm {store.blockedIds.has(task.id) ? 'border-dashed border-p2/60' : 'border-border'} transition-colors hover:border-accent/50 {selection.has(task.id) ? 'border-accent bg-accent/10 ring-1 ring-accent/40' : ui.selectedTaskId === task.id ? 'border-accent' : ''}"
							use:draggable={{ payload: () => ({ type: 'task', id: task.id }), label: () => task.title }}
							onclick={(e) => { if (!handleSelectClick(e, task.id)) ui.selectedTaskId = task.id; else ui.selectedTaskId = null; }}
						>
							<div class="flex items-start gap-2">
								<div class="mt-px"><Checkbox checked={task.completed} blocked={store.blockedIds.has(task.id)} color="var(--p{task.priority})" size={16} onchange={(v) => store.setCompleted(task.id, v)} /></div>
								<span class="min-w-0 flex-1 text-[13.5px] leading-5 {task.completed ? 'text-muted line-through' : ''}">{task.title}</span>
							</div>
							<div class="mt-2 pl-6"><TaskMeta {task} showList={scopeInfo.kind !== 'list'} /></div>
						</div>
					</div>
				{/each}
				{#if drop?.col === col.key && drop.index >= visLen(col.key)}<div class="-my-1 h-0.5 rounded bg-accent"></div>{/if}
				{#if byCol[col.key].length === 0 && !(drop?.col === col.key)}
					<p class="py-6 text-center text-[12px] text-faint">{tt('Trascina qui un task')}</p>
				{/if}
			</div>
		</section>
	{/each}
</div>
