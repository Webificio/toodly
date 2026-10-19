<script lang="ts">
	import { CalendarDays, Hash, Hourglass, ListTree, Repeat } from '@lucide/svelte';
	import Checkbox from './Checkbox.svelte';
	import TaskQuickActions from './TaskQuickActions.svelte';
	import { handleSelectClick, selection } from '../selection.svelte';
	import { store } from '../store.svelte';
	import { ui } from '../nav.svelte';
	import { t } from '../i18n.svelte';
	import { diffDays, relativeDay, todayISO } from '../dates';
	import { isOverdue } from '../views';
	import { paletteStyle } from '../graph';
	import type { Task } from '../types';

	/** Un foglietto della bacheca: stesse informazioni, colori, azioni rapide e pannello di modifica della Lista e della Graph. */
	let {
		task,
		x,
		y,
		w,
		h,
		rot,
		color,
		dragging = false,
		onpointerdown,
		onclickguard
	}: {
		task: Task;
		x: number;
		y: number;
		w: number;
		h: number;
		rot: number;
		color: number;
		dragging?: boolean;
		onpointerdown?: (e: PointerEvent) => void;
		/** true se il clic è la fine di un trascinamento e va ignorato */
		onclickguard?: () => boolean;
	} = $props();

	let menuOpen = $state(false);
	const pc = $derived(`var(--p${task.priority})`);
	const blocked = $derived(!task.completed && store.blockedIds.has(task.id));
	const late = $derived(isOverdue(task));
	const selected = $derived(ui.selectedTaskId === task.id);
	const multi = $derived(selection.has(task.id));
	const subs = $derived(store.children(task.id));
	const subsDone = $derived(subs.filter((s) => s.completed).length);
	const blockers = $derived(task.completed ? [] : store.blockers(task.id));
	const list = $derived(store.listOf(task.list_id));
	const dueCls = $derived(!task.due_date || task.completed ? 'text-muted' : late ? 'text-p3' : diffDays(task.due_date, todayISO()) === 0 ? 'text-accent' : 'text-muted');
</script>

<div
	class="gx cnote group absolute {dragging ? 'cnote-drag' : ''}"
	data-node
	style="{paletteStyle(color)}; left:{x}px; top:{y}px; width:{w}px; height:{h}px; --rot:{dragging ? rot * 1.6 : rot}deg"
>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		data-task
		data-task-id={task.id}
		class="cpaper size-full cursor-grab {task.completed ? 'cpaper-done' : ''} {blocked ? 'cpaper-blocked' : ''} {multi ? 'cpaper-multi' : selected ? 'cpaper-sel' : ''}"
		{onpointerdown}
		onclick={(e) => {
			if (onclickguard?.()) return;
			if (!handleSelectClick(e, task.id)) ui.selectedTaskId = task.id;
			else ui.selectedTaskId = null;
		}}
	>
		{#if task.priority > 0 && !task.completed}<span class="cflag" style="background:{pc}"></span>{/if}
		<div class="flex items-start gap-1.5 px-2 pt-3.5">
			<div class="mt-px shrink-0" data-nodrag><Checkbox checked={task.completed} color={pc} size={15} {blocked} onchange={(v) => store.setCompleted(task.id, v)} /></div>
			<span class="line-clamp-3 min-w-0 text-[12.5px] leading-[1.25] font-semibold break-words {task.completed ? 'line-through opacity-60' : ''}" title={task.title}>{task.title}</span>
		</div>
		<div class="absolute right-0 bottom-1 left-0 flex items-center gap-1.5 overflow-hidden px-2 text-[10.5px] whitespace-nowrap text-muted">
			{#if blockers.length}<span class="inline-flex shrink-0 items-center text-p2" title={t('In attesa di {x}', { x: blockers.map((b) => b.title).join(', ') })}><Hourglass size={10} /></span>{/if}
			{#if task.due_date}<span class="inline-flex shrink-0 items-center gap-0.5 font-medium {dueCls}"><CalendarDays size={10} />{relativeDay(task.due_date)}</span>{/if}
			{#if task.recurrence !== 'none'}<Repeat size={10} class="shrink-0" />{/if}
			{#if subs.length}<span class="inline-flex shrink-0 items-center gap-0.5"><ListTree size={10} />{subsDone}/{subs.length}</span>{/if}
			{#if task.tags.length && w >= 120}<span class="inline-flex min-w-0 items-center text-accent"><Hash size={9} /><span class="truncate">{task.tags[0]}</span></span>{/if}
			{#if list}<span class="ml-auto size-2 shrink-0 rounded-full" style="background:{list.color}" title={list.name}></span>{/if}
		</div>
	</div>
	<span class="cpin" aria-hidden="true"></span>

	<div data-nodismiss class="absolute -top-9 right-0 z-20 transition-opacity duration-100 {menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'} {dragging ? 'hidden' : ''}">
		<TaskQuickActions {task} onmenu={(o) => (menuOpen = o)} />
	</div>
</div>

<style>
	.cnote {
		transform: rotate(var(--rot));
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}
	.cnote:hover,
	.cnote:focus-within {
		z-index: 30;
		transform: rotate(0deg) scale(1.04);
	}
	.cnote-drag {
		z-index: 40;
		transform: rotate(var(--rot)) scale(1.07);
		transition: none;
	}
	.cnote-drag .cpaper {
		cursor: grabbing;
		box-shadow: 0 14px 22px rgb(0 0 0 / 0.38);
	}
	.cpaper {
		position: relative;
		border-radius: var(--r-item, 4px);
		background: color-mix(in srgb, var(--gacc) 34%, #fffef7);
		color: #25222d;
		box-shadow: 0 2px 3px rgb(0 0 0 / 0.28), 0 6px 12px rgb(0 0 0 / 0.16);
		border: 1px solid color-mix(in srgb, var(--gborder) 40%, transparent);
	}
	:global(.dark) .cpaper {
		background: color-mix(in srgb, var(--gacc) 26%, #2a2722);
		color: var(--fg);
		box-shadow: 0 2px 3px rgb(0 0 0 / 0.55), 0 6px 12px rgb(0 0 0 / 0.35);
	}
	.cpaper :global(.text-muted) {
		color: color-mix(in srgb, currentColor 62%, transparent);
	}
	.cpaper-done {
		opacity: 0.6;
		filter: saturate(0.5);
	}
	.cpaper-blocked {
		border-style: dashed;
		border-color: color-mix(in srgb, var(--p2) 70%, transparent);
	}
	.cpaper-sel {
		box-shadow: 0 0 0 3px var(--accent), 0 8px 16px rgb(0 0 0 / 0.3);
	}
	.cpaper-multi {
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 60%, transparent), 0 8px 16px rgb(0 0 0 / 0.3);
	}
	.cflag {
		position: absolute;
		top: 0;
		right: 8px;
		width: 12px;
		height: 20px;
		clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 74%, 0 100%);
		border-radius: 1px 1px 0 0;
	}
	.cpin {
		position: absolute;
		top: 2px;
		left: 50%;
		width: 11px;
		height: 11px;
		margin-left: -5.5px;
		border-radius: 9999px;
		background: radial-gradient(circle at 35% 30%, #fff 0 12%, #f87171 22%, #b91c1c 80%);
		box-shadow: 0 2px 3px rgb(0 0 0 / 0.5);
		pointer-events: none;
	}
</style>
