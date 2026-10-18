<script lang="ts">
	import { CalendarDays, ChevronRight, Hash, Hourglass, Link2, ListTree, Repeat } from '@lucide/svelte';
	import Checkbox from './Checkbox.svelte';
	import TaskQuickActions from './TaskQuickActions.svelte';
	import { handleSelectClick, selection } from '../selection.svelte';
	import { store } from '../store.svelte';
	import { ui } from '../nav.svelte';
	import { uiprefs } from '../uiprefs.svelte';
	import { t } from '../i18n.svelte';
	import { diffDays, relativeDay, todayISO } from '../dates';
	import { isOverdue } from '../views';
	import { draggable, dropzone, type DropEvent } from '../dnd.svelte';
	import type { Task } from '../types';

	/** Carta di un task nella vista Graph: stessi colori, stesse azioni e stesso pannello di modifica della Lista. */
	let {
		task,
		num = 0,
		hasChildren = false,
		open = true,
		showList = true,
		dropMark = null,
		ontoggleopen,
		onover,
		onleave,
		ondrop
	}: {
		task: Task;
		num?: number;
		hasChildren?: boolean;
		open?: boolean;
		showList?: boolean;
		dropMark?: 'before' | 'after' | null;
		ontoggleopen?: () => void;
		onover?: (e: DropEvent) => void;
		onleave?: () => void;
		ondrop?: (e: DropEvent) => void;
	} = $props();

	let menuOpen = $state(false);
	const color = $derived(`var(--p${task.priority})`);
	const blocked = $derived(!task.completed && store.blockedIds.has(task.id));
	const selected = $derived(ui.selectedTaskId === task.id);
	const list = $derived(store.listOf(task.list_id));
	const subs = $derived(store.children(task.id));
	const subsDone = $derived(subs.filter((s) => s.completed).length);
	const blockers = $derived(task.completed ? [] : store.blockers(task.id));
	const unlocks = $derived(task.completed ? 0 : store.dependents(task.id).filter((d) => !d.completed).length);
	const dueCls = $derived(
		!task.due_date || task.completed ? 'text-muted' : isOverdue(task) ? 'text-p3' : diffDays(task.due_date, todayISO()) === 0 ? 'text-accent' : 'text-muted'
	);
</script>

<div
	class="group relative h-full"
	use:dropzone={{ accept: (p) => p?.type === 'task' && p.id !== task.id, over: onover, leave: onleave, drop: ondrop }}
	use:draggable={{ payload: () => ({ type: 'task', id: task.id }), label: () => task.title }}
>
	{#if dropMark === 'before'}<div class="pointer-events-none absolute -top-[6px] right-0 left-0 z-10 h-0.5 rounded bg-accent"></div>{/if}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		data-task
		data-task-id={task.id}
		class="gcard flex h-full cursor-pointer flex-col justify-between gap-1 overflow-hidden rounded-lg border px-2 py-1.5 {blocked ? 'border-dashed' : ''} {selection.has(task.id) ? 'gcard-multi' : selected ? 'gcard-sel' : ''}"
		onclick={(e) => {
			if (!handleSelectClick(e, task.id)) ui.selectedTaskId = task.id;
			else ui.selectedTaskId = null;
		}}
	>
		<div class="flex min-h-0 items-start gap-1.5 transition-opacity duration-300 {task.completed ? 'opacity-45' : blocked ? 'opacity-70' : ''}">
			<div class="mt-px shrink-0"><Checkbox checked={task.completed} {color} size={16} {blocked} onchange={(v) => store.setCompleted(task.id, v)} /></div>
			{#if uiprefs.showNumbers && num > 0}<span class="min-w-[1.1em] shrink-0 text-right text-[12.5px] leading-[1.3] font-semibold tabular-nums" style="color:var(--gacc)">{num}</span>{/if}
			<span class="line-clamp-2 min-w-0 text-[12.5px] leading-[1.3] break-words {task.completed ? 'line-through' : ''}" title={task.title}>{task.title}</span>
		</div>
		<div class="flex min-w-0 items-center gap-2 overflow-hidden text-[11px] whitespace-nowrap text-muted transition-opacity duration-300 {task.completed ? 'opacity-45' : ''}">
			{#if blockers.length}
				<span class="inline-flex shrink-0 items-center text-p2" title={t('In attesa di {x}', { x: blockers.map((b) => b.title).join(', ') })}><Hourglass size={11} /></span>
			{/if}
			{#if unlocks}<span class="inline-flex shrink-0 items-center gap-0.5" title={t('Task che aspettano questo')}><Link2 size={11} />{unlocks}</span>{/if}
			{#if task.due_date}
				<span class="inline-flex shrink-0 items-center gap-1 {dueCls}"><CalendarDays size={11} />{relativeDay(task.due_date)}{#if task.start_time}&nbsp;{task.start_time}{/if}</span>
			{/if}
			{#if task.recurrence !== 'none'}<span class="shrink-0"><Repeat size={11} /></span>{/if}
			{#if subs.length}<span class="inline-flex shrink-0 items-center gap-1"><ListTree size={11} />{subsDone}/{subs.length}</span>{/if}
			{#if task.tags.length}
				<span class="inline-flex min-w-0 items-center text-accent"><Hash size={10} /><span class="max-w-[52px] truncate">{task.tags[0]}</span>{#if task.tags.length > 1}<span class="ml-0.5">+{task.tags.length - 1}</span>{/if}</span>
			{/if}
			{#if showList && list}<span class="size-2 shrink-0 rounded-full" style="background:{list.color}" title={list.name}></span>{/if}
			{#if hasChildren}
				<button
					class="ml-auto grid shrink-0 place-items-center text-faint hover:text-fg"
					aria-label={t('Espandi')}
					data-nodrag
					onclick={(e) => {
						e.stopPropagation();
						ontoggleopen?.();
					}}><ChevronRight size={14} class="transition-transform duration-150 {open ? 'rotate-90' : ''}" /></button
				>
			{/if}
		</div>
	</div>
	<div data-nodismiss class="absolute -top-9 right-0 z-20 transition-opacity duration-100 {menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'}">
		<TaskQuickActions {task} onmenu={(o) => (menuOpen = o)} />
	</div>
	{#if dropMark === 'after'}<div class="pointer-events-none absolute -bottom-[6px] right-0 left-0 z-10 h-0.5 rounded bg-accent"></div>{/if}
</div>

<style>
	.gcard {
		background: var(--elev);
		border-color: color-mix(in srgb, var(--gacc) 30%, var(--border));
		transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
	}
	.gcard:hover {
		border-color: var(--gacc);
	}
	.gcard-sel {
		background: var(--active);
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}
	.gcard-multi {
		background: color-mix(in srgb, var(--accent) 15%, var(--elev));
		border-color: var(--accent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent);
	}
</style>
