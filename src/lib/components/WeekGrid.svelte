<script lang="ts">
	import { Lock } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { store } from '../store.svelte';
	import { t as tt } from '../i18n.svelte';
	import { ui } from '../nav.svelte';
	import { addDays, formatWeekday, fromMinutes, parseISO, startOfWeek, todayISO, toMinutes } from '../dates';
	import { drag, draggable, dropzone } from '../dnd.svelte';
	import type { Task } from '../types';

	let { tasks, anchor }: { tasks: Task[]; anchor: string } = $props();

	const HOUR_H = 52;
	const SNAP = 15;
	const HOURS = Array.from({ length: 24 }, (_, i) => i);
	const days = $derived(Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)));
	const today = $derived(todayISO());

	interface Ev { t: Task; s: number; e: number; col: number; n: number }

	function place(list: Task[]): Ev[] {
		const evs = list
			.map((t) => {
				const s = toMinutes(t.start_time)!;
				let e = toMinutes(t.end_time) ?? s + 60;
				if (e <= s) e = s + 30;
				return { t, s, e, col: 0, n: 1 };
			})
			.sort((a, b) => a.s - b.s || b.e - a.e);
		const out: Ev[] = [];
		let cluster: Ev[] = [];
		let cols: number[] = [];
		let clusterEnd = -1;
		const flush = () => {
			for (const c of cluster) c.n = cols.length;
			out.push(...cluster);
			cluster = [];
			cols = [];
			clusterEnd = -1;
		};
		for (const ev of evs) {
			if (cluster.length && ev.s >= clusterEnd) flush();
			let c = cols.findIndex((end) => end <= ev.s);
			if (c < 0) {
				c = cols.length;
				cols.push(ev.e);
			} else cols[c] = ev.e;
			ev.col = c;
			cluster.push(ev);
			clusterEnd = Math.max(clusterEnd, ev.e);
		}
		flush();
		return out;
	}

	const timedByDay = $derived(
		Object.fromEntries(days.map((d) => [d, place(tasks.filter((t) => t.due_date === d && t.start_time))])) as Record<string, Ev[]>
	);
	const allDayByDay = $derived(Object.fromEntries(days.map((d) => [d, tasks.filter((t) => t.due_date === d && !t.start_time)])) as Record<string, Task[]>);

	// anteprima del drop e ridimensionamento
	let preview = $state<{ day: string; s: number; dur: number } | null>(null);
	let resizing = $state<{ id: string; e: number } | null>(null);
	let overAllDay = $state<string | null>(null);
	let now = $state(new Date());
	let scroller: HTMLDivElement;

	onMount(() => {
		scroller.scrollTop = Math.max(0, (new Date().getHours() - 2) * HOUR_H);
		const i = setInterval(() => (now = new Date()), 30000);
		return () => clearInterval(i);
	});

	const snap = (m: number) => Math.round(m / SNAP) * SNAP;
	function durationOf(t: Task) {
		const s = toMinutes(t.start_time);
		const e = toMinutes(t.end_time);
		return s !== null && e !== null && e > s ? e - s : 60;
	}
	function startFrom(e: { y: number; rect: DOMRect; payload: any }, dur: number) {
		const raw = ((e.y - e.rect.top) / HOUR_H) * 60 - (e.payload.grabMin ?? 0);
		return Math.max(0, Math.min(24 * 60 - dur, snap(raw)));
	}

	let grabMin = 0;
	function grab(ev: PointerEvent) {
		const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
		grabMin = ((ev.clientY - r.top) / HOUR_H) * 60;
	}

	function startResize(ev: PointerEvent, e: Ev) {
		ev.stopPropagation();
		ev.preventDefault();
		const startY = ev.clientY;
		const baseEnd = e.e;
		resizing = { id: e.t.id, e: baseEnd };
		const move = (m: PointerEvent) => {
			const end = snap(baseEnd + ((m.clientY - startY) / HOUR_H) * 60);
			resizing = { id: e.t.id, e: Math.max(e.s + SNAP, Math.min(24 * 60 - 1, end)) };
		};
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			if (resizing) store.updateTask(e.t.id, { end_time: fromMinutes(resizing.e) });
			resizing = null;
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}

	async function createAt(day: string, ev: MouseEvent, el: HTMLElement) {
		if ((ev.target as HTMLElement).closest('[data-event]')) return;
		const rect = el.getBoundingClientRect();
		const s = Math.max(0, Math.min(23 * 60, Math.floor(((ev.clientY - rect.top) / HOUR_H) * 2) * 30));
		const t = await store.createTask({ title: tt('Nuovo task'), due_date: day, start_time: fromMinutes(s), end_time: fromMinutes(Math.min(s + 60, 24 * 60 - 1)) });
		ui.selectedTaskId = t.id;
	}

	const nowTop = $derived(((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_H);
</script>

<div class="flex h-full min-w-0 flex-1 flex-col">
	<!-- intestazione giorni + riga "tutto il giorno" -->
	<div class="flex border-b border-border pr-[var(--sbw,0px)]">
		<div class="w-14 shrink-0"></div>
		{#each days as day (day)}
			<div class="min-w-0 flex-1 border-l border-border">
				<div class="py-1.5 text-center">
					<div class="text-[11px] tracking-wide text-muted uppercase">{formatWeekday(day)}</div>
					<div class="mx-auto grid size-7 place-items-center rounded-full text-[14px] font-semibold {day === today ? 'bg-accent text-accent-fg' : ''}">{parseISO(day).getDate()}</div>
				</div>
				<div
					class="min-h-7 space-y-0.5 px-1 pb-1 transition-colors {overAllDay === day ? 'bg-active' : ''}"
					use:dropzone={{
						accept: (p) => p?.type === 'task',
						over: () => (overAllDay = day),
						leave: () => (overAllDay = null),
						drop: (e) => {
							overAllDay = null;
							store.updateTask(e.payload.id, { due_date: day, start_time: null, end_time: null });
						}
					}}
				>
					{#each allDayByDay[day] as t (t.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div
							class="cursor-grab truncate rounded px-1.5 py-0.5 text-[11.5px] {t.completed ? 'line-through opacity-50' : ''}"
							style="background:color-mix(in srgb, var(--p{t.priority}) 18%, transparent);border-left:2.5px solid var(--p{t.priority})"
							use:draggable={{ payload: () => ({ type: 'task', id: t.id }), label: () => t.title }}
							onclick={() => (ui.selectedTaskId = t.id)}
						>{#if store.blockedIds.has(t.id)}<Lock size={10} class="mr-0.5 inline text-p2" />{/if}{t.title}</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<!-- griglia oraria -->
	<div class="min-h-0 flex-1 overflow-y-auto" bind:this={scroller} data-scroll="y">
		<div class="flex" style="height:{24 * HOUR_H}px">
			<div class="relative w-14 shrink-0">
				{#each HOURS as h}
					<div class="absolute right-2 -translate-y-1/2 text-[10.5px] text-faint" style="top:{h * HOUR_H}px;{h === 0 ? 'display:none' : ''}">{String(h).padStart(2, '0')}:00</div>
				{/each}
			</div>
			{#each days as day (day)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="relative min-w-0 flex-1 border-l border-border"
					style="background-image:repeating-linear-gradient(to bottom, transparent 0, transparent {HOUR_H - 1}px, var(--border) {HOUR_H - 1}px, var(--border) {HOUR_H}px)"
					ondblclick={(ev) => createAt(day, ev, ev.currentTarget as HTMLElement)}
					use:dropzone={{
						accept: (p) => p?.type === 'task',
						over: (e) => {
							const t = store.byId.get(e.payload.id);
							const dur = t ? durationOf(t) : 60;
							const s = startFrom(e, dur);
							if (preview?.day !== day || preview.s !== s) preview = { day, s, dur };
						},
						leave: () => (preview = null),
						drop: (e) => {
							const p = preview;
							preview = null;
							if (!p) return;
							store.updateTask(e.payload.id, { due_date: day, start_time: fromMinutes(p.s), end_time: fromMinutes(Math.min(p.s + p.dur, 24 * 60 - 1)) });
						}
					}}
				>
					{#if day === today}
						<div class="pointer-events-none absolute right-0 left-0 z-20 h-px bg-p3" style="top:{nowTop}px">
							<span class="absolute -top-[3px] -left-[3px] size-[7px] rounded-full bg-p3"></span>
						</div>
					{/if}
					{#if preview?.day === day && drag.active}
						<div class="pointer-events-none absolute right-1 left-1 z-10 rounded-md border-2 border-dashed border-accent bg-accent/15" style="top:{(preview.s / 60) * HOUR_H}px;height:{(preview.dur / 60) * HOUR_H}px">
							<span class="px-1.5 text-[11px] font-medium text-accent">{fromMinutes(preview.s)}–{fromMinutes(Math.min(preview.s + preview.dur, 1439))}</span>
						</div>
					{/if}
					{#each timedByDay[day] as ev (ev.t.id)}
						{@const end = resizing?.id === ev.t.id ? resizing.e : ev.e}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div
							data-event
							class="group absolute cursor-grab overflow-hidden rounded-md px-1.5 py-1 text-[11.5px] leading-4 shadow-sm {ev.t.completed ? 'line-through opacity-50' : ''}"
							style="top:{(ev.s / 60) * HOUR_H}px;height:{Math.max(((end - ev.s) / 60) * HOUR_H - 2, 18)}px;left:calc({(ev.col / ev.n) * 100}% + 2px);width:calc({100 / ev.n}% - 4px);background:color-mix(in srgb, var(--p{ev.t.priority}) 22%, var(--panel));border-left:3px solid var(--p{ev.t.priority})"
							use:draggable={{ payload: () => ({ type: 'task', id: ev.t.id, grabMin }), label: () => ev.t.title }}
							onpointerdown={grab}
							onclick={() => (ui.selectedTaskId = ev.t.id)}
						>
							<div class="truncate font-medium">{#if store.blockedIds.has(ev.t.id)}<Lock size={10} class="mr-0.5 inline text-p2" />{/if}{ev.t.title}</div>
							<div class="truncate text-[10.5px] text-muted">{fromMinutes(ev.s)}–{fromMinutes(end)}</div>
							<div data-nodrag class="absolute right-0 bottom-0 left-0 h-2 cursor-ns-resize" onpointerdown={(e) => startResize(e, ev)}></div>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</div>
</div>
