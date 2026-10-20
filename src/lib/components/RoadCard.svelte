<script lang="ts">
	import { CalendarDays, ChevronLeft, ChevronRight, Hourglass } from '@lucide/svelte';
	import Checkbox from './Checkbox.svelte';
	import TaskQuickActions from './TaskQuickActions.svelte';
	import MoneyChip from './MoneyChip.svelte';
	import { chipOf, ecoShow } from '../economy.svelte';
	import { handleSelectClick, selection } from '../selection.svelte';
	import { store } from '../store.svelte';
	import { ui } from '../nav.svelte';
	import { t } from '../i18n.svelte';
	import { addDays, relativeDay, todayISO } from '../dates';
	import { paletteStyle } from '../graph';
	import type { Task } from '../types';

	/** Una scheda sulla strada: disegnata a grandezza naturale e rimpicciolita dalla prospettiva; al passaggio del mouse torna a grandezza piena. */
	let {
		task,
		x,
		y,
		w,
		h,
		s,
		color,
		over,
		z
	}: { task: Task; x: number; y: number; w: number; h: number; s: number; color: number; over: boolean; z: number } = $props();

	let menuOpen = $state(false);
	const pc = $derived(`var(--p${task.priority})`);
	const blocked = $derived(!task.completed && store.blockedIds.has(task.id));
	const selected = $derived(ui.selectedTaskId === task.id);
	const multi = $derived(selection.has(task.id));
	const list = $derived(store.listOf(task.list_id));
	const small = $derived(s < 0.3);
	function shift(e: MouseEvent, dir: -1 | 1) {
		e.stopPropagation();
		const n = (e.shiftKey ? 7 : 1) * dir;
		if (!task.due_date) return void store.updateTask(task.id, { due_date: todayISO() });
		store.updateTask(task.id, { due_date: addDays(task.due_date, n), ...(task.start_date ? { start_date: addDays(task.start_date, n) } : {}) });
	}
</script>

<div class="gx rcard group absolute" data-node style="{paletteStyle(color)}; left:{x - w / 2}px; top:{y - h}px; width:{w}px; height:{h}px; --s:{s}; z-index:{z}">
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		data-task
		data-task-id={task.id}
		title={task.title}
		class="rbody relative size-full cursor-pointer overflow-hidden rounded-[9px] {task.completed ? 'rdone' : ''} {blocked ? 'rblocked' : ''} {over ? 'rover' : ''} {multi ? 'rmulti' : selected ? 'rsel' : ''}"
		onclick={(e) => {
			if (!handleSelectClick(e, task.id)) ui.selectedTaskId = task.id;
			else ui.selectedTaskId = null;
		}}
	>
		<span class="absolute inset-y-0 left-0 w-1" style="background:{task.priority > 0 && !task.completed ? pc : 'var(--gborder)'}"></span>
		<div class="flex items-start gap-1.5 pt-2 pr-2 pl-3">
			<div class="mt-px shrink-0" data-nodrag><Checkbox checked={task.completed} color={pc} size={15} {blocked} onchange={(v) => store.setCompleted(task.id, v)} /></div>
			<span class="line-clamp-2 min-w-0 text-[12.5px] leading-[1.25] font-semibold break-words {task.completed ? 'line-through opacity-60' : ''}">{task.title}</span>
		</div>
		{#if !small}
			<div class="absolute right-0 bottom-1.5 left-0 flex items-center gap-1.5 overflow-hidden pr-2 pl-3 text-[10.5px] whitespace-nowrap {over ? 'text-p3' : 'text-muted'}">
				{#if blocked}<Hourglass size={10} class="shrink-0 text-p2" />{/if}
				{#if task.due_date}<span class="inline-flex shrink-0 items-center gap-0.5 font-medium"><CalendarDays size={10} />{relativeDay(task.due_date)}</span>{/if}
				{#if ecoShow('road')}<MoneyChip money={chipOf(task)} />{/if}
				{#if list}<span class="ml-auto size-2 shrink-0 rounded-full" style="background:{list.color}" title={list.name}></span>{/if}
			</div>
		{/if}
		</div>
	{#if over}<span class="rtag">{t('Scaduto')}</span>{/if}

	<div data-nodismiss class="absolute -top-8 right-0 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-elev px-0.5 shadow-pop transition-opacity duration-100 {menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'}">
		{#if !task.completed}<button class="icon-btn size-6" data-nodrag title={t('Un giorno prima (Maiusc: una settimana)')} aria-label={t('Un giorno prima (Maiusc: una settimana)')} disabled={!task.due_date} onclick={(e) => shift(e, -1)}><ChevronLeft size={14} /></button>{/if}
		{#if !task.completed}<button class="icon-btn size-6" data-nodrag title={task.due_date ? t('Un giorno dopo (Maiusc: una settimana)') : t('Imposta a oggi')} aria-label={t('Un giorno dopo (Maiusc: una settimana)')} onclick={(e) => shift(e, 1)}><ChevronRight size={14} /></button>{/if}
		<TaskQuickActions {task} onmenu={(o) => (menuOpen = o)} />
	</div>
</div>

<style>
	.rcard {
		transform: scale(var(--s));
		transform-origin: 50% 100%;
		transition: transform 0.14s ease;
	}
	.rcard:hover,
	.rcard:focus-within {
		transform: scale(max(var(--s), 1));
		z-index: 900 !important;
	}
	.rbody {
		background: color-mix(in srgb, var(--gfill) 55%, var(--elev));
		border: 1.5px solid var(--gborder);
		box-shadow: 0 6px 14px rgb(0 0 0 / 0.3);
	}
	.rdone {
		opacity: 0.55;
	}
	.rblocked {
		border-style: dashed;
	}
	.rover {
		border-color: var(--p3);
	}
	.rsel {
		box-shadow: 0 0 0 3px var(--accent), 0 8px 18px rgb(0 0 0 / 0.35);
	}
	.rmulti {
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 60%, transparent), 0 8px 18px rgb(0 0 0 / 0.35);
	}
	.rtag {
		position: absolute;
		top: -13px;
		left: 8px;
		padding: 1px 6px;
		border-radius: 5px 5px 0 0;
		background: var(--p3);
		color: #fff;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
</style>
