<script lang="ts">
	import { Lock } from '@lucide/svelte';
	import { CalendarClock } from '@lucide/svelte';
	import { t as tt } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { ui } from '../nav.svelte';
	import { draggable, dropzone } from '../dnd.svelte';
	import { relativeDay } from '../dates';
	import { sortTasks } from '../views';
	import type { Task } from '../types';

	let { tasks }: { tasks: Task[] } = $props();
	let over = $state(false);
	const items = $derived(sortTasks(tasks.filter((t) => !t.completed && !t.start_time), 'due'));
</script>

<aside
	class="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar/50 {over ? 'bg-active' : ''}"
	use:dropzone={{
		accept: (p) => p?.type === 'task',
		over: () => (over = true),
		leave: () => (over = false),
		drop: (e) => {
			over = false;
			store.updateTask(e.payload.id, { start_time: null, end_time: null });
		}
	}}
>
	<div class="flex items-center gap-2 px-4 pt-4 pb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">
		<CalendarClock size={14} /> {tt('Non pianificati')} <span class="ml-auto font-normal">{items.length}</span>
	</div>
	<div class="flex-1 space-y-1.5 overflow-y-auto px-3 pb-4" data-scroll="y">
		{#each items as t (t.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div
				class="cursor-grab rounded-lg border border-border bg-panel px-2.5 py-2 text-[13px] shadow-sm hover:border-accent/50"
				style="border-left:3px solid var(--p{t.priority})"
				use:draggable={{ payload: () => ({ type: 'task', id: t.id }), label: () => t.title }}
				onclick={() => (ui.selectedTaskId = t.id)}
			>
				<div class="truncate">{#if store.blockedIds.has(t.id)}<Lock size={11} class="mr-1 inline text-p2" />{/if}{t.title}</div>
				{#if t.due_date}<div class="mt-0.5 text-[11px] text-muted">{relativeDay(t.due_date)}</div>{/if}
			</div>
		{:else}
			<p class="px-1 pt-4 text-center text-[12px] text-faint">{tt('Tutto pianificato 🎯')}</p>
		{/each}
		<p class="px-1 pt-3 text-[11px] leading-snug text-faint">{tt("Trascina un task sulla griglia oraria per fissarne l'orario (time-blocking).")}</p>
	</div>
</aside>
