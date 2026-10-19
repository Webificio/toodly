<script lang="ts" module>
	/** Posizione sulla strada e orizzonte ricordati per (vista, set) finché l'app è aperta. */
	const saved = new Map<string, { cam: number; horizon: number }>();
</script>

<script lang="ts">
	import { Eye, EyeOff, LocateFixed } from '@lucide/svelte';
	import MapBar from './MapBar.svelte';
	import RoadCard from './RoadCard.svelte';
	import Checkbox from './Checkbox.svelte';
	import { buildRoad, camFor, CARD_H, HORIZONS } from '../road';
	import { paletteStyle } from '../graph';
	import { currentWorkspace } from '../db';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { handleSelectClick, selection, setVisibleOrder } from '../selection.svelte';
	import { nav, ui } from '../nav.svelte';
	import { inScope, sortTasks } from '../views';
	import { diffDays, todayISO } from '../dates';
	import { untrack } from 'svelte';

	/** Road: la strada del tempo. Le corsie sono i gruppi; la rotella (o i tasti) fa avanzare nel tempo. */
	const matched = $derived(store.tasks.filter((x) => inScope(x, nav.scope, store.filters, store.blockedIds)));
	const sorted = $derived(sortTasks(matched, 'manual'));
	const viewKey = $derived(`road|${currentWorkspace() ?? ''}|${nav.scope}`);
	let showDone = $state(false);
	let cam = $state(0);
	let horizon = $state<number>(14);
	let W = $state(900);
	let H = $state(560);
	let loadedKey = '';
	$effect.pre(() => {
		const k = viewKey;
		untrack(() => {
			if (loadedKey) saved.set(loadedKey, { cam, horizon });
			loadedKey = k;
			const s = saved.get(k);
			cam = s?.cam ?? 0;
			horizon = s?.horizon ?? 14;
		});
	});
	$effect(() => {
		saved.set(viewKey, { cam, horizon });
	});

	const today = $derived(todayISO());
	const model = $derived(buildRoad({ groups: store.groups, tasks: sorted, showDone, today, cam, horizon, ungroupedLabel: t('Senza gruppo'), width: W, height: H }));
	$effect(() => setVisibleOrder(model.taskOrder));

	// il task selezionato deve essere visibile: se è fuori dalla strada, avanza fino a lui
	$effect(() => {
		const id = ui.selectedTaskId;
		if (!id) return;
		untrack(() => {
			const tk = store.tasks.find((x) => x.id === id);
			if (!tk?.due_date) return;
			const next = camFor(diffDays(tk.due_date, today), cam, horizon);
			if (next !== cam) cam = next;
		});
	});

	const label = (d: number) => (d === 0 ? t('Oggi') : d < 7 ? t('{n} giorni', { n: d }) : d < 30 ? t('{n} settimane', { n: Math.round(d / 7) }) : t('{n} mesi', { n: Math.round(d / 30) }));
	const horizonLabel = (d: number) => (d === 7 ? t('1 sett.') : d === 14 ? t('2 sett.') : d === 30 ? t('1 mese') : t('3 mesi'));

	function wheel(node: HTMLElement) {
		const h = (e: WheelEvent) => {
			if (e.ctrlKey) return;
			e.preventDefault();
			cam = Math.max(0, Math.min(365, cam + (e.deltaY / 100) * Math.max(0.5, horizon / 14)));
		};
		node.addEventListener('wheel', h, { passive: false });
		return { destroy: () => node.removeEventListener('wheel', h) };
	}
	const cw = $derived(model.laneW * 0.94);
	const camDays = $derived(Math.round(cam));
	const camText = $derived(cam < 0.5 ? t('Oggi') : t('Tra {n} giorni', { n: camDays }));
</script>

<div class="flex h-full min-w-0 flex-1 flex-col">
	<MapBar />
	<div class="flex shrink-0 flex-wrap items-center gap-1 px-4 pb-2 text-[12px]">
		<span class="text-muted">{t('Orizzonte')}</span>
		<div class="flex rounded-lg border border-border p-0.5">
			{#each HORIZONS as h (h)}
				<button class="rounded-md px-2 py-0.5 {horizon === h ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg'}" aria-pressed={horizon === h} onclick={() => (horizon = h)}>{horizonLabel(h)}</button>
			{/each}
		</div>
		<button class="btn h-7 border-transparent bg-transparent" title={t('Torna a oggi')} disabled={cam === 0} onclick={() => (cam = 0)}><LocateFixed size={14} />{camText}</button>
		<button class="btn h-7 border-transparent bg-transparent" title={t('Mostra completati')} onclick={() => (showDone = !showDone)}>
			{#if showDone}<Eye size={14} />{:else}<EyeOff size={14} />{/if}{t('Completati')}
		</button>
		<span class="ml-auto text-faint">{t('Rotella: avanza nel tempo')}</span>
	</div>

	<div class="flex min-h-0 flex-1 gap-3 px-4 pb-4">
		<div class="road isolate relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-border" bind:clientWidth={W} bind:clientHeight={H} use:wheel>
			{#if model.items.length === 0}
				<div class="absolute inset-0 z-10 grid place-items-center text-center text-muted">
					<div><div class="text-[15px] font-medium text-fg">{t('La strada è libera')}</div><div class="text-[12.5px]">{t('Nessun task con scadenza in questo tratto.')}</div></div>
				</div>
			{/if}
			<svg aria-hidden="true" class="pointer-events-none absolute inset-0" width={W} height={H}>
				<ellipse class="rglow" cx={model.vpx} cy={model.hz} rx={W * 0.32} ry="60" />
				<line class="rhz" x1="0" y1={model.hz} x2={W} y2={model.hz} />
				{#if model.lanes.length}
					{@const n = model.lanes.length}
					{@const f = (H - model.hz) / (model.base - model.hz)}
					<polygon class="rroad" points="{model.vpx - 2},{model.hz} {model.vpx + 2},{model.hz} {model.vpx + (n / 2) * model.laneW * f},{H} {model.vpx - (n / 2) * model.laneW * f},{H}" />
					{#each Array.from({ length: n + 1 }, (_, i) => i) as i (i)}
						<line class="rlane {i === 0 || i === n ? 'redge' : ''}" x1={model.vpx} y1={model.hz} x2={model.vpx + (i - n / 2) * model.laneW * f} y2={H} />
					{/each}
					{#each model.ticks as tk (tk.d)}
						<line class="rtick {tk.d === 0 ? 'rtoday' : ''}" x1={model.vpx - (n / 2) * model.laneW * tk.s} y1={tk.y} x2={model.vpx + (n / 2) * model.laneW * tk.s} y2={tk.y} />
						<text class="rtl {tk.d === 0 ? 'rtl-on' : ''}" x={W - 10} y={tk.y + 4} text-anchor="end">{label(tk.d)}</text>
					{/each}
				{/if}
			</svg>
			<div class="absolute top-2 left-3 z-20 flex max-w-[60%] flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted">
				{#each model.lanes as l (l.root)}
					<span class="gx inline-flex items-center gap-1" style={paletteStyle(l.color)}><span class="size-2.5 rounded-[3px]" style="background:var(--gacc)"></span>{l.name}</span>
				{/each}
			</div>
			{#each model.items as it (it.task.id)}
				<RoadCard task={it.task} x={it.x} y={it.y} w={cw} h={CARD_H} s={it.s} color={it.color} over={it.over} z={Math.round(it.s * 100) + Math.round(it.y / 10)} />
			{/each}
		</div>

		{#if model.rail.length}
			<aside class="flex w-[200px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-elev">
				<div class="border-b border-border px-3 py-2 text-[11.5px] font-semibold tracking-wide text-muted uppercase">{t('Fuori strada')}</div>
				<div class="min-h-0 flex-1 overflow-y-auto p-1.5">
					{#each model.rail as r (r.task.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div
							data-task
							data-task-id={r.task.id}
							class="gx flex cursor-pointer items-start gap-1.5 rounded-lg border-l-[3px] px-2 py-1.5 text-[12px] hover:bg-hover {selection.has(r.task.id) || ui.selectedTaskId === r.task.id ? 'bg-accent-soft' : ''}"
							style="{paletteStyle(r.color)}; border-color:var(--gborder)"
							onclick={(e) => {
								if (!handleSelectClick(e, r.task.id)) ui.selectedTaskId = r.task.id;
								else ui.selectedTaskId = null;
							}}
						>
							<div class="mt-px shrink-0" data-nodrag><Checkbox checked={r.task.completed} color="var(--p{r.task.priority})" size={14} onchange={(v) => store.setCompleted(r.task.id, v)} /></div>
							<div class="min-w-0"><div class="line-clamp-2 {r.task.completed ? 'line-through opacity-60' : ''}">{r.task.title}</div><div class="text-[10.5px] text-faint">{r.why === 'none' ? t('Senza data') : t('Oltre l’orizzonte')}</div></div>
						</div>
					{/each}
				</div>
			</aside>
		{/if}
	</div>
</div>

<style>
	.road {
		background: linear-gradient(to bottom, #cfd8f5 0, #f1f3fb 30%, #e8e9f3 30%, #d4d6e6 100%);
		--rline: #2b2c3d;
	}
	:global(.dark) .road {
		background: linear-gradient(to bottom, #0e0f13 0, #26244f 30%, #1c1d33 30%, #101118 100%);
		--rline: #e8e8f2;
	}
	.rglow {
		fill: var(--accent);
		opacity: 0.22;
		filter: blur(18px);
	}
	.rhz {
		stroke: var(--accent);
		stroke-opacity: 0.6;
	}
	.rroad {
		fill: color-mix(in srgb, var(--rline) 9%, transparent);
	}
	.rlane {
		stroke: var(--rline);
		stroke-opacity: 0.16;
		stroke-dasharray: 10 8;
	}
	.rlane.redge {
		stroke-opacity: 0.35;
		stroke-dasharray: none;
		stroke-width: 2;
	}
	.rtick {
		stroke: var(--rline);
		stroke-opacity: 0.12;
	}
	.rtick.rtoday {
		stroke: var(--accent);
		stroke-opacity: 0.7;
		stroke-width: 2;
	}
	.rtl {
		fill: var(--muted);
		font-size: 11px;
	}
	.rtl-on {
		fill: var(--accent);
		font-weight: 650;
	}
</style>
