<script lang="ts">
	import { selection, handleSelectClick } from '../selection.svelte';
	import { tick } from 'svelte';
	import { ChevronRight, GripVertical } from '@lucide/svelte';
	import Checkbox from './Checkbox.svelte';
	import TaskMeta from './TaskMeta.svelte';
	import TaskQuickActions from './TaskQuickActions.svelte';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { ui } from '../nav.svelte';
	import { drawStrike } from '../motion';
	import { draggable, dropzone, type DropEvent } from '../dnd.svelte';
	import type { Task } from '../types';

	let {
		task,
		depth = 0,
		hasChildren = false,
		expanded = true,
		sortable = false,
		showList = true,
		dropMark = null,
		ontoggleexpand,
		onover,
		onleave,
		ondrop
	}: {
		task: Task;
		depth?: number;
		hasChildren?: boolean;
		expanded?: boolean;
		sortable?: boolean;
		showList?: boolean;
		dropMark?: 'before' | 'after' | null;
		ontoggleexpand?: () => void;
		onover?: (e: DropEvent) => void;
		onleave?: () => void;
		ondrop?: (e: DropEvent) => void;
	} = $props();

	let menuOpen = $state(false);
	let completing = $state(false);
	let strike = $state<HTMLElement>();
	const color = $derived(`var(--p${task.priority})`);
	const blocked = $derived(!task.completed && store.blockedIds.has(task.id));
	const selected = $derived(ui.selectedTaskId === task.id);

	function toggle(v: boolean) {
		if (v && !task.completed) {
			// anima lo sbarramento, poi sposta il task tra i completati
			completing = true;
			tick().then(() => strike && drawStrike(strike));
			setTimeout(async () => {
				await store.setCompleted(task.id, true);
				completing = false;
			}, 650);
		} else if (!v) {
			store.setCompleted(task.id, false);
		}
	}
	const struck = $derived(task.completed || completing);
</script>

<div
	class="group relative"
	use:dropzone={{ accept: (p) => p?.type === 'task' && p.id !== task.id, over: onover, leave: onleave, drop: ondrop }}
	use:draggable={{ payload: () => ({ type: 'task', id: task.id }), label: () => task.title, disabled: !sortable, handle: '[data-grip]' }}
>
	{#if dropMark === 'before'}<div class="pointer-events-none absolute -top-px right-2 left-2 z-10 h-0.5 rounded bg-accent"></div>{/if}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		data-task
		class="flex cursor-pointer items-start gap-2 rounded-lg py-1.5 pr-3 transition-colors duration-100 hover:bg-hover {selection.has(task.id) ? 'bg-accent/15 ring-1 ring-accent/40 hover:bg-accent/20' : selected ? 'bg-active hover:bg-active' : ''}"
		style="padding-left:{6 + depth * 26}px"
		onclick={(e) => { if (!handleSelectClick(e, task.id)) ui.selectedTaskId = task.id; else ui.selectedTaskId = null; }}
	>
		<span data-grip class="mt-0.5 -mr-1 grid w-4 shrink-0 place-items-center text-faint {sortable ? 'cursor-grab opacity-0 group-hover:opacity-100' : 'opacity-0'}">
			<GripVertical size={14} />
		</span>
		{#if hasChildren}
			<span class="mt-px grid w-4 shrink-0 place-items-center">
				<button class="grid place-items-center text-faint hover:text-fg" onclick={(e) => { e.stopPropagation(); ontoggleexpand?.(); }} aria-label={t('Espandi')}>
					<ChevronRight size={14} class="transition-transform duration-150 {expanded ? 'rotate-90' : ''}" />
				</button>
			</span>
		{/if}
		<div class="mt-px"><Checkbox checked={struck} {color} {blocked} onchange={toggle} /></div>
		<div class="min-w-0 flex-1">
			<div class="relative inline-block max-w-full transition-opacity duration-300 {struck ? 'opacity-45' : blocked ? 'opacity-70' : ''}">
				<span class="block truncate text-[14px] leading-5">{task.title}</span>
				{#if struck}
					<span bind:this={strike} class="pointer-events-none absolute top-1/2 right-0 left-0 h-px bg-current" style={task.completed && !completing ? '' : 'transform:scaleX(0)'}></span>
				{/if}
			</div>
			<div class="{struck ? 'opacity-45' : ''}"><TaskMeta {task} {showList} /></div>
		</div>
	</div>
	<div data-nodismiss class="absolute top-1 right-2 z-10 transition-opacity duration-100 {menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'}">
		<TaskQuickActions {task} onmenu={(o) => (menuOpen = o)} />
	</div>
	{#if dropMark === 'after'}<div class="pointer-events-none absolute -bottom-px right-2 left-2 z-10 h-0.5 rounded bg-accent"></div>{/if}
</div>
