<script lang="ts">
	import { Lock } from '@lucide/svelte';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { ui, go, nav } from '../nav.svelte';
	import { formatWeekday, addDays, parseISO, startOfMonth, startOfWeek, todayISO } from '../dates';
	import { draggable, dropzone } from '../dnd.svelte';
	import type { Task } from '../types';

	let { tasks, anchor }: { tasks: Task[]; anchor: string } = $props();

	const today = todayISO();
	const month = $derived(parseISO(anchor).getMonth());
	const start = $derived(startOfWeek(startOfMonth(anchor)));
	const days = $derived(Array.from({ length: 42 }, (_, i) => addDays(start, i)));
	const WEEKDAYS = $derived(Array.from({ length: 7 }, (_, i) => formatWeekday(addDays('2024-01-01', i))));
	const MAX = 3;
	let overDay = $state<string | null>(null);

	const byDay = $derived.by(() => {
		const m = new Map<string, Task[]>();
		for (const t of tasks) {
			if (!t.due_date) continue;
			const a = m.get(t.due_date) ?? [];
			a.push(t);
			m.set(t.due_date, a);
		}
		for (const a of m.values()) a.sort((x, y) => (x.start_time ?? '99').localeCompare(y.start_time ?? '99') || y.priority - x.priority);
		return m;
	});

	async function create(day: string) {
		const created = await store.createTask({ title: t('Nuovo task'), due_date: day });
		ui.selectedTaskId = created.id;
	}
</script>

<div class="flex h-full min-w-0 flex-1 flex-col">
	<div class="grid grid-cols-7 border-b border-border text-center text-[11px] font-semibold tracking-wide text-muted uppercase">
		{#each WEEKDAYS as w}<div class="py-2">{w}</div>{/each}
	</div>
	<div class="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
		{#each days as day (day)}
			{@const list = byDay.get(day) ?? []}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex min-h-0 flex-col gap-0.5 overflow-hidden border-r border-b border-border p-1 transition-colors {parseISO(day).getMonth() === month ? '' : 'bg-sidebar/40 text-faint'} {overDay === day ? 'bg-active' : ''}"
				ondblclick={() => create(day)}
				use:dropzone={{
					accept: (p) => p?.type === 'task',
					over: () => (overDay = day),
					leave: () => (overDay = null),
					drop: (e) => {
						overDay = null;
						store.updateTask(e.payload.id, { due_date: day });
					}
				}}
			>
				<div class="flex justify-end px-0.5">
					<span class="grid size-6 place-items-center rounded-full text-[12px] {day === today ? 'bg-accent font-bold text-accent-fg' : ''}">{parseISO(day).getDate()}</span>
				</div>
				{#each list.slice(0, MAX) as t (t.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="cursor-grab truncate rounded-md px-1.5 py-0.5 text-[11.5px] leading-4 {t.completed ? 'line-through opacity-50' : ''}"
						style="background:color-mix(in srgb, var(--p{t.priority}) 16%, transparent);border-left:2.5px solid var(--p{t.priority})"
						use:draggable={{ payload: () => ({ type: 'task', id: t.id }), label: () => t.title }}
						onclick={() => (ui.selectedTaskId = t.id)}
					>
						{#if store.blockedIds.has(t.id)}<Lock size={10} class="inline text-p2" />{/if}
						{#if t.start_time}<span class="text-muted">{t.start_time}</span>{/if}
						{t.title}
					</div>
				{/each}
				{#if list.length > MAX}
					<button class="px-1.5 text-left text-[11px] text-muted hover:text-fg" onclick={() => go({ cal: 'week', d: day })}>+{list.length - MAX} {t('altri')}</button>
				{/if}
			</div>
		{/each}
	</div>
</div>
