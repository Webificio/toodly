<script lang="ts">
	import { CalendarDays, Hourglass } from '@lucide/svelte';
	import Checkbox from './Checkbox.svelte';
	import TaskQuickActions from './TaskQuickActions.svelte';
	import { handleSelectClick, selection } from '../selection.svelte';
	import { store } from '../store.svelte';
	import { ui } from '../nav.svelte';
	import { t } from '../i18n.svelte';
	import { relativeDay, diffDays, todayISO } from '../dates';
	import { isOverdue } from '../views';
	import { paletteStyle } from '../graph';
	import type { MapLabel } from '../maps';
	import type { Task } from '../types';

	/**
	 * Un task su Orbit o Metro: una bolla nel colore del gruppo, un'etichetta (se c'è posto) e,
	 * al passaggio del mouse o con la tastiera, la scheda con checkbox, dettagli e azioni rapide (come nella Graph).
	 */
	let {
		task,
		x,
		y,
		r,
		color,
		crumb = '',
		label = null,
		cardBelow = false
	}: { task: Task; x: number; y: number; r: number; color: number; crumb?: string; label?: MapLabel | null; cardBelow?: boolean } = $props();

	let menuOpen = $state(false);
	const pc = $derived(`var(--p${task.priority})`);
	const blocked = $derived(!task.completed && store.blockedIds.has(task.id));
	const late = $derived(isOverdue(task));
	const selected = $derived(ui.selectedTaskId === task.id);
	const multi = $derived(selection.has(task.id));
	const list = $derived(store.listOf(task.list_id));
	const dueCls = $derived(!task.due_date || task.completed ? 'text-muted' : late ? 'text-p3' : diffDays(task.due_date, todayISO()) === 0 ? 'text-accent' : 'text-muted');
</script>

<div class="gx mnode group absolute" data-node style="{paletteStyle(color)}; left:{x - r}px; top:{y - r}px; width:{r * 2}px; height:{r * 2}px">
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		data-task
		data-task-id={task.id}
		class="mbub size-full cursor-pointer rounded-full {task.completed ? 'mbub-done' : ''} {blocked ? 'mbub-blocked' : ''} {late ? 'mbub-late' : ''} {multi ? 'mbub-multi' : selected ? 'mbub-sel' : ''}"
		title={task.title}
		onclick={(e) => {
			if (!handleSelectClick(e, task.id)) ui.selectedTaskId = task.id;
			else ui.selectedTaskId = null;
		}}
	>
		{#if task.priority > 0 && !task.completed}<span class="mdot" style="background:{pc}"></span>{/if}
	</div>

	{#if label}
		<span
			class="pointer-events-none absolute text-[11.5px] leading-none whitespace-nowrap {task.completed ? 'text-faint line-through' : 'text-fg'} {selected ? 'font-semibold' : ''}"
			style="left:{label.x - (x - r)}px; top:{label.y - (y - r)}px; transform:translate({label.anchor === 'start' ? '0' : label.anchor === 'end' ? '-100%' : '-50%'}, -50%) rotate({label.rot}deg); transform-origin:{label.anchor === 'start' ? '0 50%' : label.anchor === 'end' ? '100% 50%' : '50% 50%'}"
		>{label.text}</span>
	{/if}

	<!-- scheda al passaggio del mouse -->
	<div
		data-nodismiss
		class="absolute left-1/2 z-40 w-[236px] -translate-x-1/2 {cardBelow ? 'top-full pt-2' : 'bottom-full pb-2'} {menuOpen || selected ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'} transition-opacity duration-100"
	>
		<div class="flex flex-col gap-1.5 rounded-xl border border-border bg-elev p-2 shadow-pop" style="border-color:color-mix(in srgb, var(--gacc) 45%, var(--border))">
			<div class="flex items-start gap-1.5">
				<div class="mt-px shrink-0"><Checkbox checked={task.completed} color={pc} size={16} {blocked} onchange={(v) => store.setCompleted(task.id, v)} /></div>
				<span class="min-w-0 text-[12.5px] leading-[1.3] break-words {task.completed ? 'text-muted line-through' : ''}">{task.title}</span>
			</div>
			{#if crumb}<div class="truncate text-[11px] text-muted" style="color:var(--gacc)">{crumb}</div>{/if}
			<div class="flex min-w-0 items-center gap-2 text-[11px] whitespace-nowrap text-muted">
				{#if blocked}<span class="inline-flex shrink-0 items-center text-p2" title={t('In attesa di {x}', { x: store.blockers(task.id).map((b) => b.title).join(', ') })}><Hourglass size={11} /></span>{/if}
				{#if task.due_date}<span class="inline-flex shrink-0 items-center gap-1 {dueCls}"><CalendarDays size={11} />{relativeDay(task.due_date)}{#if task.start_time}&nbsp;{task.start_time}{/if}</span>{:else}<span>{t('Senza data')}</span>{/if}
				{#if list}<span class="ml-auto inline-flex min-w-0 items-center gap-1"><span class="size-2 shrink-0 rounded-full" style="background:{list.color}"></span><span class="truncate">{list.name}</span></span>{/if}
			</div>
			<div class="-mx-0.5"><TaskQuickActions {task} onmenu={(o) => (menuOpen = o)} /></div>
		</div>
	</div>
</div>

<style>
	.mnode:hover,
	.mnode:focus-within {
		z-index: 35;
	}
	.mbub {
		position: relative;
		background: var(--gfill);
		border: 2px solid var(--gborder);
		transition: transform 0.12s, box-shadow 0.12s, background 0.12s;
	}
	.mbub:hover {
		transform: scale(1.18);
	}
	.mbub-done {
		background: var(--elev);
		opacity: 0.55;
	}
	.mbub-blocked {
		border-style: dashed;
	}
	.mbub-late {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--p3) 70%, transparent);
	}
	.mbub-sel {
		box-shadow: 0 0 0 2px var(--elev), 0 0 0 4px var(--accent);
	}
	.mbub-multi {
		box-shadow: 0 0 0 2px var(--elev), 0 0 0 4px color-mix(in srgb, var(--accent) 60%, transparent);
	}
	.mdot {
		position: absolute;
		right: -2px;
		top: -2px;
		width: 7px;
		height: 7px;
		border-radius: 9999px;
		border: 1.5px solid var(--elev);
	}
</style>
