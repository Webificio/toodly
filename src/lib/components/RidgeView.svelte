<script lang="ts">
	import { CalendarDays, ChevronLeft, ChevronRight, Eye, EyeOff, Minus, Plus } from '@lucide/svelte';
	import MapBar from './MapBar.svelte';
	import Checkbox from './Checkbox.svelte';
	import TaskQuickActions from './TaskQuickActions.svelte';
	import { DEFAULT_CAP_H, buildRidge, durationOf, fmtDur, ridgePoints } from '../ridge';
	import { groupInfo } from '../maps';
	import { paletteStyle } from '../graph';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { handleSelectClick, selection, setVisibleOrder } from '../selection.svelte';
	import { nav, ui } from '../nav.svelte';
	import { inScope, sortTasks } from '../views';
	import { addDays, diffDays, formatDayLong, formatDayShort, formatWeekday, todayISO } from '../dates';
	import { untrack } from 'svelte';

	/** Ridge: il carico dei prossimi giorni come un profilo di montagne; sopra la capacità giornaliera la cima diventa rossa. */
	const matched = $derived(store.tasks.filter((x) => inScope(x, nav.scope, store.filters, store.blockedIds)));
	const sorted = $derived(sortTasks(matched, 'manual'));
	const info = $derived(groupInfo(store.groups, sorted, t('Senza gruppo')));
	const today = $derived(todayISO());

	const num = (k: string, def: number) => {
		try {
			const v = Number(localStorage.getItem(k));
			return v > 0 ? v : def;
		} catch {
			return def;
		}
	};
	const save = (k: string, v: number) => {
		try {
			localStorage.setItem(k, String(v));
		} catch {}
	};
	let capH = $state(num('toodly.ridgeCap', DEFAULT_CAP_H));
	let span = $state(num('toodly.ridgeSpan', 14));
	let offset = $state(0);
	let showDone = $state(false);
	let selDay = $state<string | null>(null);
	let W = $state(900);
	let H = $state(420);
	const setCap = (v: number) => {
		capH = Math.min(16, Math.max(0.5, v));
		save('toodly.ridgeCap', capH);
	};
	const setSpan = (v: number) => {
		span = v;
		save('toodly.ridgeSpan', v);
	};

	const model = $derived(buildRidge({ tasks: sorted, today, offset, span, capMin: capH * 60, showDone }));
	$effect(() => setVisibleOrder(model.taskOrder));
	const day = $derived(model.days.find((d) => d.key === selDay) ?? null);

	// il task selezionato porta con sé il suo giorno (e sposta la finestra se serve)
	$effect(() => {
		const id = ui.selectedTaskId;
		if (!id) return;
		untrack(() => {
			const tk = store.tasks.find((x) => x.id === id);
			if (!tk?.due_date) return;
			if (!tk.completed && tk.due_date < today) return void (selDay = 'late');
			const i = diffDays(tk.due_date, addDays(today, offset));
			if (i < 0 || i >= span) offset = Math.max(0, diffDays(tk.due_date, today) - Math.floor(span / 2));
			selDay = tk.due_date;
		});
	});
	$effect(() => {
		if (selDay === null && model.days.length) selDay = model.days.find((d) => d.key === today)?.key ?? model.days[0].key;
	});

	// geometria del grafico
	const L = 56, R = 16, TOP = 46, BOT = 52;
	const cols = $derived(model.days.length);
	const step = $derived(Math.max(10, (W - L - R) / Math.max(cols, 1)));
	const base = $derived(H - BOT);
	const maxH = $derived(Math.max(capH * 1.25, (model.peak / 60) * 1.1, 2));
	const k = $derived((base - TOP) / maxH);
	const pts = $derived(ridgePoints(model.days.map((d) => d.minutes), L, step, base, k));
	const poly = $derived(pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
	const yc = $derived(base - capH * k);
	const gridH = $derived([1, 2, 4, 6, 8, 10, 12, 16].filter((h) => h < maxH && Math.abs(h - capH) > 0.6));
	const overCount = $derived(model.days.filter((d) => d.over).length);
	const cx = (i: number) => L + i * step + step / 2;
	const label = (key: string) => (key === 'late' ? t('Scaduti') : formatWeekday(key));

	function shift(task: (typeof sorted)[number], n: number) {
		if (!task.due_date) return;
		store.updateTask(task.id, { due_date: addDays(task.due_date, n), ...(task.start_date ? { start_date: addDays(task.start_date, n) } : {}) });
	}
	const durChoices = [15, 30, 45, 60, 90, 120, 180, 240];
	let menuFor = $state<string | null>(null);
</script>

<div class="flex h-full min-w-0 flex-1 flex-col">
	<MapBar />
	<div class="flex shrink-0 flex-wrap items-center gap-1.5 px-4 pb-2 text-[12px]">
		<button class="icon-btn size-7" title={t('Indietro')} aria-label={t('Indietro')} disabled={offset <= 0} onclick={() => (offset = Math.max(0, offset - 7))}><ChevronLeft size={15} /></button>
		<button class="btn h-7 border-transparent bg-transparent" title={t('Torna a oggi')} disabled={offset === 0} onclick={() => (offset = 0)}><CalendarDays size={14} />{formatDayShort(addDays(today, offset))}</button>
		<button class="icon-btn size-7" title={t('Avanti')} aria-label={t('Avanti')} onclick={() => (offset += 7)}><ChevronRight size={15} /></button>
		<div class="ml-1 flex rounded-lg border border-border p-0.5">
			{#each [7, 14, 28] as n (n)}
				<button class="rounded-md px-2 py-0.5 {span === n ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg'}" aria-pressed={span === n} onclick={() => setSpan(n)}>{t('{n} giorni', { n })}</button>
			{/each}
		</div>
		<span class="ml-2 text-muted">{t('Capacità')}</span>
		<div class="flex items-center rounded-lg border border-border">
			<button class="icon-btn size-7" aria-label={t('Meno')} onclick={() => setCap(capH - 0.5)}><Minus size={13} /></button>
			<span class="min-w-[58px] text-center font-medium">{t('{h} ore/giorno', { h: capH })}</span>
			<button class="icon-btn size-7" aria-label={t('Più')} onclick={() => setCap(capH + 0.5)}><Plus size={13} /></button>
		</div>
		<button class="btn h-7 border-transparent bg-transparent" title={t('Mostra completati')} onclick={() => (showDone = !showDone)}>
			{#if showDone}<Eye size={14} />{:else}<EyeOff size={14} />{/if}{t('Completati')}
		</button>
		<span class="ml-auto {overCount ? 'font-semibold text-p3' : 'text-faint'}">{overCount ? t('{n} giorni oltre la capacità', { n: overCount }) : t('Nessun giorno oltre la capacità')}{#if model.undated} · {t('{n} senza data', { n: model.undated })}{/if}</span>
	</div>

	<div class="flex min-h-0 flex-1 gap-3 px-4 pb-4">
		<div class="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-elev" bind:clientWidth={W} bind:clientHeight={H}>
			<svg class="absolute inset-0" width={W} height={H} role="img" aria-label={t('Carico di lavoro per giorno')}>
				<defs>
					<clipPath id="rg-under"><rect x="0" y={yc} width={W} height={H} /></clipPath>
					<clipPath id="rg-over"><rect x="0" y="0" width={W} height={yc} /></clipPath>
					<linearGradient id="rg-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent)" stop-opacity=".75" /><stop offset="1" style="stop-color:var(--accent)" stop-opacity=".16" /></linearGradient>
				</defs>
				{#each model.days as d, i (d.key)}
					{#if d.weekend}<rect x={L + i * step} y={TOP - 14} width={step} height={base - TOP + 14 + 40} style="fill:var(--muted)" opacity="0.07" />{/if}
					{#if d.key === selDay}<rect x={L + i * step} y={TOP - 14} width={step} height={base - TOP + 14 + 40} style="fill:var(--accent)" opacity="0.12" />{/if}
				{/each}
				{#each gridH as h (h)}
					<line x1={L} x2={L + cols * step} y1={base - h * k} y2={base - h * k} stroke="var(--border)" stroke-dasharray="2 6" />
					<text x={L - 8} y={base - h * k + 4} text-anchor="end" font-size="10.5" style="fill:var(--faint)">{h}h</text>
				{/each}
				<line x1={L} x2={L + cols * step} y1={base} y2={base} stroke="var(--border)" />
				<polygon points={poly} fill="url(#rg-fill)" clip-path="url(#rg-under)" />
				<polygon points={poly} style="fill:var(--p3)" fill-opacity="0.85" clip-path="url(#rg-over)" />
				<polyline points={poly} fill="none" style="stroke:var(--fg)" stroke-opacity="0.5" stroke-width="1.6" stroke-linejoin="round" />
				<line x1={L} x2={L + cols * step} y1={yc} y2={yc} style="stroke:var(--fg)" stroke-opacity="0.6" stroke-dasharray="6 5" />
				<text x={L - 8} y={yc + 4} text-anchor="end" font-size="11" font-weight="600" style="fill:var(--muted)">{t('capacità')}</text>
				{#each model.days as d, i (d.key)}
					{#if d.minutes > 0}
						<text x={cx(i)} y={base - (d.minutes / 60) * k - 8} text-anchor="middle" font-size="11.5" font-weight="650" style="fill:{d.over ? 'var(--p3)' : 'var(--fg)'}" paint-order="stroke" stroke="var(--elev)" stroke-width="3">{step >= 30 || d.key === selDay ? fmtDur(d.minutes) : ''}</text>
					{/if}
					<text x={cx(i)} y={base + 20} text-anchor="middle" font-size="12" font-weight={d.key === today ? 700 : 600} style="fill:{d.key === today ? 'var(--accent)' : d.key === 'late' ? 'var(--p3)' : 'var(--muted)'}">{step >= 30 || d.key === 'late' ? label(d.key) : ''}</text>
					<text x={cx(i)} y={base + 36} text-anchor="middle" font-size="11" style="fill:var(--faint)">{d.key === 'late' ? '' : step >= 22 ? new Date(d.key + 'T00:00:00').getDate() : ''}</text>
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
					<rect class="cursor-pointer" x={L + i * step} y={TOP - 14} width={step} height={base - TOP + 14 + 40} fill="transparent" onclick={() => (selDay = d.key)}>
						<title>{d.key === 'late' ? t('Scaduti') : formatDayLong(d.key)} · {fmtDur(d.minutes)}</title>
					</rect>
				{/each}
			</svg>
		</div>

		<aside class="flex w-[350px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-elev">
			{#if day}
				<div class="border-b border-border px-3 py-2.5">
					<div class="text-[13.5px] font-semibold">{day.key === 'late' ? t('Scaduti') : formatDayLong(day.key)} · {fmtDur(day.minutes)}</div>
					{#if day.over}<div class="text-[11.5px] font-semibold text-p3">{t('{x} oltre la capacità', { x: fmtDur(day.minutes - capH * 60) })}</div>
					{:else}<div class="text-[11.5px] text-muted">{t('{x} liberi', { x: fmtDur(Math.max(0, capH * 60 - day.minutes)) })}</div>{/if}
				</div>
				<div class="min-h-0 flex-1 overflow-y-auto p-1.5">
					{#each day.tasks as tk (tk.id)}
						{@const blocked = !tk.completed && store.blockedIds.has(tk.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div
							data-task
							data-task-id={tk.id}
							class="gx group flex cursor-pointer flex-col gap-1 rounded-lg border-l-[3px] px-2 py-1.5 text-[12.5px] hover:bg-hover {selection.has(tk.id) || ui.selectedTaskId === tk.id ? 'bg-accent-soft' : ''}"
							style="{paletteStyle(info.color(info.rootOf(tk)))}; border-color:var(--gborder)"
							onclick={(e) => {
								if (!handleSelectClick(e, tk.id)) ui.selectedTaskId = tk.id;
								else ui.selectedTaskId = null;
							}}
						>
							<div class="flex items-start gap-1.5">
								<div class="mt-px shrink-0" data-nodrag><Checkbox checked={tk.completed} color="var(--p{tk.priority})" size={15} {blocked} onchange={(v) => store.setCompleted(tk.id, v)} /></div>
								<span class="min-w-0 flex-1 {tk.completed ? 'line-through opacity-60' : ''}">{tk.title}</span>
							</div>
							<div class="flex flex-wrap items-center gap-1 pl-[21px] text-[11px] text-muted" data-nodrag>
								<button class="icon-btn size-5" title={t('Un giorno prima (Maiusc: una settimana)')} aria-label={t('Un giorno prima (Maiusc: una settimana)')} disabled={tk.completed} onclick={(e) => { e.stopPropagation(); shift(tk, e.shiftKey ? -7 : -1); }}><ChevronLeft size={13} /></button>
								<button class="icon-btn size-5" title={t('Un giorno dopo (Maiusc: una settimana)')} aria-label={t('Un giorno dopo (Maiusc: una settimana)')} disabled={tk.completed} onclick={(e) => { e.stopPropagation(); shift(tk, e.shiftKey ? 7 : 1); }}><ChevronRight size={13} /></button>
								<select class="rounded border border-border bg-transparent px-1 py-0.5 text-[11px]" title={t('Durata stimata')} value={String(durationOf(tk))} onclick={(e) => e.stopPropagation()} onchange={(e) => store.updateTask(tk.id, { duration_min: Number(e.currentTarget.value) })}>
									{#each [...new Set([...durChoices, durationOf(tk)])].sort((a, b) => a - b) as m (m)}<option value={String(m)}>{fmtDur(m)}</option>{/each}
								</select>
								<div class="w-full {menuFor === tk.id ? '' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}"><TaskQuickActions task={tk} onmenu={(o) => (menuFor = o ? tk.id : null)} /></div>
							</div>
						</div>
					{:else}
						<div class="px-3 py-6 text-center text-[12.5px] text-muted">{t('Giornata libera')}</div>
					{/each}
				</div>
			{:else}
				<div class="grid flex-1 place-items-center px-4 text-center text-[12.5px] text-muted">{t('Scegli un giorno nel grafico')}</div>
			{/if}
		</aside>
	</div>
</div>
