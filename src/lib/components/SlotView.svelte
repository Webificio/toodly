<script lang="ts">
	import { ArrowRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, EyeOff, X } from '@lucide/svelte';
	import { onMount, untrack } from 'svelte';
	import MapBar from './MapBar.svelte';
	import Checkbox from './Checkbox.svelte';
	import TaskQuickActions from './TaskQuickActions.svelte';
	import { MIN_BLOCK, buildSlotDay, clampStart, firstFit, placePatch, snap, unplacePatch, SNAP } from '../slot';
	import { durationOf, fmtDur } from '../ridge';
	import { groupInfo } from '../maps';
	import { paletteStyle } from '../graph';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { handleSelectClick, selection, setVisibleOrder } from '../selection.svelte';
	import { nav, ui, showToast } from '../nav.svelte';
	import { inScope, sortTasks } from '../views';
	import { addDays, formatDayLong, fromMinutes, todayISO } from '../dates';
	import type { Task } from '../types';

	/** Slot: la giornata a incastro. I task senza ora si trascinano negli spazi liberi (o si infilano col pulsante →). */
	const matched = $derived(store.tasks.filter((x) => inScope(x, nav.scope, store.filters, store.blockedIds)));
	const sorted = $derived(sortTasks(matched, 'manual'));
	const info = $derived(groupInfo(store.groups, sorted, t('Senza gruppo')));
	const today = $derived(todayISO());
	let day = $state(todayISO());
	let showDone = $state(true);
	const model = $derived(buildSlotDay(sorted, day, today, showDone));
	$effect(() => setVisibleOrder(model.taskOrder));

	// il task selezionato porta con sé il suo giorno
	$effect(() => {
		const id = ui.selectedTaskId;
		if (!id) return;
		untrack(() => {
			const tk = store.tasks.find((x) => x.id === id);
			if (tk?.due_date && tk.start_time && tk.due_date !== day) day = tk.due_date;
		});
	});

	const PH = 64;
	const pxm = PH / 60;
	const hours = $derived(Array.from({ length: (model.to - model.from) / 60 + 1 }, (_, i) => model.from + i * 60));
	const Y = (m: number) => (m - model.from) * pxm;
	const hhmm = (m: number) => fromMinutes(Math.min(m, 24 * 60 - 1));
	let scroller = $state<HTMLDivElement>();
	let timeline = $state<HTMLDivElement>();
	onMount(() => {
		const first = model.blocks[0]?.start ?? 8 * 60;
		scroller?.scrollTo({ top: Math.max(0, Y(Math.min(first, 9 * 60)) - 40) });
	});

	// ---- trascinamento ---------------------------------------------------------------
	/** posizioni provvisorie dei blocchi mossi o ridimensionati: id → {start,end} */
	let live = $state<Record<string, { start: number; end: number }>>({});
	let drag = $state<{ id: string; len: number; x: number; y: number; at: number | null } | null>(null);
	let justDragged = false;
	const guard = () => justDragged;
	const endGuard = () => {
		justDragged = true;
		setTimeout(() => (justDragged = false), 0);
	};
	const minuteAt = (clientY: number) => {
		const r = timeline!.getBoundingClientRect();
		const eff = r.height / timeline!.offsetHeight || 1;
		return model.from + (clientY - r.top) / eff / pxm;
	};
	const inside = (cx: number, cy: number) => {
		const r = timeline!.getBoundingClientRect();
		return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
	};

	function blockDown(e: PointerEvent, id: string, mode: 'move' | 'resize') {
		if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, select, a, [data-nodrag]')) return;
		if (mode === 'resize') e.stopPropagation();
		const b = model.blocks.find((x) => x.task.id === id)!;
		const t0 = minuteAt(e.clientY);
		const len = b.end - b.start;
		let moved = false;
		const move = (m: PointerEvent) => {
			const d = minuteAt(m.clientY) - t0;
			if (!moved && Math.abs(d) * pxm < 4) return;
			moved = true;
			if (mode === 'move') {
				const s = clampStart(snap(b.start + d), len);
				live = { [id]: { start: s, end: s + len } };
			} else {
				const en = Math.min(24 * 60, Math.max(b.start + MIN_BLOCK, snap(b.end + d)));
				live = { [id]: { start: b.start, end: en } };
			}
		};
		const up = async () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
			const l = live[id];
			live = {};
			if (!moved || !l) return;
			endGuard();
			if (l.start === b.start && l.end === b.end) return;
			const patch: Partial<Task> = { start_time: hhmm(l.start), end_time: hhmm(l.end) };
			if (mode === 'resize' && b.task.duration_min != null) patch.duration_min = l.end - l.start;
			await store.updateTask(id, patch);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', up);
	}

	function trayDown(e: PointerEvent, tk: Task) {
		if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, select, a, [data-nodrag]')) return;
		const x0 = e.clientX, y0 = e.clientY;
		const len = durationOf(tk);
		let moved = false;
		const move = (m: PointerEvent) => {
			if (!moved && Math.abs(m.clientX - x0) + Math.abs(m.clientY - y0) < 6) return;
			moved = true;
			drag = { id: tk.id, len, x: m.clientX, y: m.clientY, at: inside(m.clientX, m.clientY) ? clampStart(snap(minuteAt(m.clientY)), len) : null };
		};
		const up = async () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
			const d = drag;
			drag = null;
			if (!moved) return;
			endGuard();
			if (d?.at != null) await store.updateTask(tk.id, placePatch(tk, day, d.at, len));
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', up);
	}

	/** Mette il task nel primo spazio libero in cui entra (da adesso in poi se il giorno è oggi). */
	async function fit(tk: Task) {
		const len = durationOf(tk);
		const nowMin = day === today ? new Date().getHours() * 60 + Math.ceil(new Date().getMinutes() / SNAP) * SNAP : 0;
		const at = firstFit(model.free, len, nowMin) ?? firstFit(model.free, len);
		if (at === null) return showToast(t('Nessuno spazio libero abbastanza lungo'));
		await store.updateTask(tk.id, placePatch(tk, day, at, len));
	}
	/** Sposta il blocco di 30 minuti (con Maiusc 15). */
	function nudge(b: { task: Task; start: number; end: number }, dir: -1 | 1, e: MouseEvent) {
		e.stopPropagation();
		const step = e.shiftKey ? 15 : 30;
		const s = clampStart(b.start + dir * step, b.end - b.start);
		store.updateTask(b.task.id, { start_time: hhmm(s), end_time: hhmm(s + b.end - b.start) });
	}
	const durChoices = [15, 30, 45, 60, 90, 120, 180, 240];
	let menuFor = $state<string | null>(null);
	const nowMin = $derived(day === today ? new Date().getHours() * 60 + new Date().getMinutes() : null);
	const trayCount = $derived(model.tray.due.length + model.tray.late.length + model.tray.none.length);
	const sections = $derived([
		{ key: 'due', title: t('Del giorno'), list: model.tray.due },
		{ key: 'late', title: t('Scaduti'), list: model.tray.late },
		{ key: 'none', title: t('Senza data'), list: model.tray.none }
	].filter((s) => s.list.length));
</script>

<div class="flex h-full min-w-0 flex-1 flex-col select-none">
	<MapBar />
	<div class="flex shrink-0 flex-wrap items-center gap-1.5 px-4 pb-2 text-[12px]">
		<button class="icon-btn size-7" title={t('Giorno prima')} aria-label={t('Giorno prima')} onclick={() => (day = addDays(day, -1))}><ChevronLeft size={15} /></button>
		<button class="btn h-7 border-transparent bg-transparent font-medium" title={t('Torna a oggi')} disabled={day === today} onclick={() => (day = today)}><CalendarDays size={14} />{day === today ? t('Oggi') + ' · ' : ''}{formatDayLong(day)}</button>
		<button class="icon-btn size-7" title={t('Giorno dopo')} aria-label={t('Giorno dopo')} onclick={() => (day = addDays(day, 1))}><ChevronRight size={15} /></button>
		<button class="btn h-7 border-transparent bg-transparent" title={t('Mostra completati')} onclick={() => (showDone = !showDone)}>
			{#if showDone}<Eye size={14} />{:else}<EyeOff size={14} />{/if}{t('Completati')}
		</button>
		<span class="ml-auto"><span class="font-semibold">{t('Pianificato {x}', { x: fmtDur(model.planned) })}</span> · <span class="text-ok font-semibold" style="color:var(--ok,#22a06b)">{t('Libero {x}', { x: fmtDur(model.freeMin) })}</span></span>
	</div>

	<div class="flex min-h-0 flex-1 gap-3 px-4 pb-4">
		<div bind:this={scroller} class="min-w-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-elev">
			<div bind:this={timeline} class="relative ml-[58px] mr-3" style="height:{Y(model.to)}px; margin-top:12px; margin-bottom:12px">
				{#each hours as h (h)}
					<div class="absolute right-0 left-0 border-t border-border" style="top:{Y(h)}px"></div>
					<span class="absolute -left-[52px] w-[44px] -translate-y-1/2 text-right text-[11px] text-faint" style="top:{Y(h)}px">{fromMinutes(Math.min(h, 1439))}</span>
				{/each}
				{#each model.free as f (f.start)}
					<div class="pointer-events-none absolute right-1 left-1 rounded-lg border border-dashed" style="top:{Y(f.start) + 2}px; height:{(f.end - f.start) * pxm - 4}px; border-color:color-mix(in srgb, var(--ok,#22a06b) 55%, transparent); background:color-mix(in srgb, var(--ok,#22a06b) 7%, transparent)">
						{#if (f.end - f.start) * pxm >= 28}<span class="absolute top-1 right-2 text-[11px] font-semibold" style="color:var(--ok,#22a06b)">{t('libero {x}', { x: fmtDur(f.end - f.start) })}</span>{/if}
					</div>
				{/each}
				{#if nowMin !== null && nowMin >= model.from && nowMin <= model.to}
					<div class="pointer-events-none absolute right-0 left-0 z-20 h-0.5" style="top:{Y(nowMin)}px; background:var(--p3)"><span class="absolute -top-[3px] -left-1 size-2 rounded-full" style="background:var(--p3)"></span></div>
				{/if}

				{#each model.blocks as b (b.task.id)}
					{@const tk = b.task}
					{@const lv = live[tk.id]}
					{@const s = lv?.start ?? b.start}
					{@const e = lv?.end ?? b.end}
					{@const blocked = !tk.completed && store.blockedIds.has(tk.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
					<div
						data-task
						data-task-id={tk.id}
						title="{tk.title} · {hhmm(s)}–{hhmm(e)}"
						class="gx sblock group absolute cursor-grab overflow-hidden {tk.completed ? 'opacity-55' : ''} {blocked ? 'sb-blocked' : ''} {selection.has(tk.id) ? 'sb-multi' : ui.selectedTaskId === tk.id ? 'sb-sel' : ''} {lv ? 'z-30 cursor-grabbing shadow-pop' : 'z-10'}"
						style="{paletteStyle(info.color(info.rootOf(tk)))}; top:{Y(s) + 1}px; height:{Math.max((e - s) * pxm - 2, 20)}px; left:calc({(b.col / b.cols) * 100}% + 4px); width:calc({100 / b.cols}% - 8px)"
						onpointerdown={(ev) => blockDown(ev, tk.id, 'move')}
						onclick={(ev) => {
							if (guard()) return;
							if (!handleSelectClick(ev, tk.id)) ui.selectedTaskId = tk.id;
							else ui.selectedTaskId = null;
						}}
					>
						<span class="absolute inset-y-0 left-0 w-1.5" style="background:var(--gacc)"></span>
						<div class="flex items-start gap-1.5 py-1 pr-2 pl-3">
							<div class="mt-px shrink-0" data-nodrag><Checkbox checked={tk.completed} color="var(--p{tk.priority})" size={15} {blocked} onchange={(v) => store.setCompleted(tk.id, v)} /></div>
							<span class="min-w-0 truncate text-[12.5px] font-semibold {tk.completed ? 'line-through' : ''}">{tk.title}</span>
							<span class="ml-auto shrink-0 text-[11px] text-muted">{hhmm(s)}–{hhmm(e)}</span>
						</div>
						{#if (e - s) * pxm >= 52}<div class="truncate pl-3 text-[11px]" style="color:var(--gacc)">{info.crumb(tk) || info.name(info.rootOf(tk))}</div>{/if}
						<div data-nodismiss data-nodrag class="absolute top-0.5 right-0.5 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-elev px-0.5 shadow-pop transition-opacity duration-100 {menuFor === tk.id ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'}">
							<button class="icon-btn size-6" title={t('Mezz’ora prima (Maiusc: 15 minuti)')} aria-label={t('Mezz’ora prima (Maiusc: 15 minuti)')} onclick={(ev) => nudge(b, -1, ev)}><ChevronUp size={14} /></button>
							<button class="icon-btn size-6" title={t('Mezz’ora dopo (Maiusc: 15 minuti)')} aria-label={t('Mezz’ora dopo (Maiusc: 15 minuti)')} onclick={(ev) => nudge(b, 1, ev)}><ChevronDown size={14} /></button>
							<button class="icon-btn size-6" title={t('Togli dall’orario')} aria-label={t('Togli dall’orario')} onclick={(ev) => { ev.stopPropagation(); store.updateTask(tk.id, unplacePatch()); }}><X size={14} /></button>
							<TaskQuickActions task={tk} onmenu={(o) => (menuFor = o ? tk.id : null)} />
						</div>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize" onpointerdown={(ev) => blockDown(ev, tk.id, 'resize')}></div>
					</div>
				{/each}

				{#if drag && drag.at !== null}
					{@const dt = store.tasks.find((x) => x.id === drag!.id)}
					<div class="pointer-events-none absolute right-1 left-1 z-40 rounded-lg border-2 border-dashed px-3 py-1 text-[12.5px] font-semibold" style="top:{Y(drag.at)}px; height:{Math.max(drag.len * pxm, 20)}px; border-color:var(--accent); background:color-mix(in srgb, var(--accent) 18%, transparent)">
						{dt?.title} <span class="font-normal text-muted">· {hhmm(drag.at)}–{hhmm(drag.at + drag.len)}</span>
					</div>
				{/if}
			</div>
		</div>

		<aside class="flex w-[290px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-elev">
			<div class="border-b border-border px-3 py-2.5">
				<div class="text-[13.5px] font-semibold">{t('Da sistemare')} <span class="text-muted">{trayCount}</span></div>
				<div class="text-[11px] text-faint">{t('Trascina in uno spazio libero, oppure premi → per il primo che entra')}</div>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto p-1.5">
				{#each sections as sec (sec.key)}
					<div class="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{sec.title}</div>
					{#each sec.list as tk (tk.id)}
						{@const blocked = store.blockedIds.has(tk.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div
							data-task
							data-task-id={tk.id}
							class="gx group mb-1 cursor-grab rounded-lg border-l-[3px] border-y border-r border-y-border border-r-border px-2 py-1.5 text-[12.5px] hover:bg-hover {selection.has(tk.id) || ui.selectedTaskId === tk.id ? 'bg-accent-soft' : ''} {drag?.id === tk.id ? 'opacity-40' : ''}"
							style="{paletteStyle(info.color(info.rootOf(tk)))}; border-left-color:var(--gborder)"
							onpointerdown={(ev) => trayDown(ev, tk)}
							onclick={(ev) => {
								if (guard()) return;
								if (!handleSelectClick(ev, tk.id)) ui.selectedTaskId = tk.id;
								else ui.selectedTaskId = null;
							}}
						>
							<div class="flex items-start gap-1.5">
								<div class="mt-px shrink-0" data-nodrag><Checkbox checked={tk.completed} color="var(--p{tk.priority})" size={15} {blocked} onchange={(v) => store.setCompleted(tk.id, v)} /></div>
								<span class="min-w-0 flex-1">{tk.title}</span>
								<button class="icon-btn size-6 shrink-0" data-nodrag title={t('Mettilo nel primo spazio libero')} aria-label={t('Mettilo nel primo spazio libero')} onclick={(ev) => { ev.stopPropagation(); fit(tk); }}><ArrowRight size={14} /></button>
							</div>
							<div class="mt-1 flex flex-wrap items-center gap-1 pl-[21px] text-[11px] text-muted" data-nodrag>
								<select class="rounded border border-border bg-transparent px-1 py-0.5 text-[11px]" title={t('Durata stimata')} value={String(durationOf(tk))} onclick={(ev) => ev.stopPropagation()} onchange={(ev) => store.updateTask(tk.id, { duration_min: Number(ev.currentTarget.value) })}>
									{#each [...new Set([...durChoices, durationOf(tk)])].sort((a, b) => a - b) as m (m)}<option value={String(m)}>{fmtDur(m)}{tk.duration_min == null && m === 30 ? ' · ' + t('predefinita') : ''}</option>{/each}
								</select>
								<span class="min-w-0 truncate" style="color:var(--gacc)">{info.name(info.rootOf(tk))}</span>
								<div class="w-full {menuFor === tk.id ? '' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}"><TaskQuickActions task={tk} onmenu={(o) => (menuFor = o ? tk.id : null)} /></div>
							</div>
						</div>
					{/each}
				{:else}
					<div class="px-3 py-8 text-center text-[12.5px] text-muted">{t('Tutto sistemato')}</div>
				{/each}
			</div>
		</aside>
	</div>
	{#if drag}
		{@const dt = store.tasks.find((x) => x.id === drag!.id)}
		<div class="pointer-events-none fixed z-[2000] max-w-[240px] truncate rounded-lg border border-accent bg-elev px-2.5 py-1.5 text-[12.5px] font-semibold shadow-pop" style="left:{drag.x + 12}px; top:{drag.y + 8}px">{dt?.title} · {fmtDur(drag.len)}</div>
	{/if}
</div>

<style>
	.sblock {
		border-radius: 9px;
		background: color-mix(in srgb, var(--gfill) 60%, var(--elev));
		border: 1.5px solid var(--gborder);
		touch-action: none;
	}
	.sb-blocked {
		border-style: dashed;
	}
	.sb-sel {
		box-shadow: 0 0 0 2px var(--accent);
	}
	.sb-multi {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 60%, transparent);
	}
</style>
