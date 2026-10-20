<script lang="ts">
	import { CalendarDays, Eye, EyeOff, Hourglass } from '@lucide/svelte';
	import MapBar from './MapBar.svelte';
	import Checkbox from './Checkbox.svelte';
	import TaskQuickActions from './TaskQuickActions.svelte';
	import { MOSAIC_MODES, MOSAIC_MODES_ECONOMY, buildMosaic, type MosaicBy } from '../mosaic';
	import MoneyChip from './MoneyChip.svelte';
	import { chipOf, ecoShow } from '../economy.svelte';
	import { figuresOf } from '../money';
	import { groupInfo } from '../maps';
	import { paletteStyle } from '../graph';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { handleSelectClick, selection, setVisibleOrder } from '../selection.svelte';
	import { nav, ui } from '../nav.svelte';
	import { inScope, isOverdue, sortTasks } from '../views';
	import { relativeDay, todayISO } from '../dates';

	/** Mosaic: griglia a tessere; più grande = più importante e/o più vicino alla scadenza. */
	const matched = $derived(store.tasks.filter((x) => inScope(x, nav.scope, store.filters, store.blockedIds)));
	const sorted = $derived(sortTasks(matched, 'manual'));
	const modes = $derived(ecoShow('mosaic') ? MOSAIC_MODES_ECONOMY : MOSAIC_MODES);
	let by = $state<MosaicBy>(readBy());
	/** senza Economia (o con la vista disattivata) la dimensione «per importo» ricade su «entrambe» */
	const eff = $derived<MosaicBy>(modes.includes(by) ? by : 'both');
	let showDone = $state(false);
	let W = $state(900);
	let H = $state(560);
	let menuFor = $state<string | null>(null);
	function readBy(): MosaicBy {
		try {
			const v = localStorage.getItem('toodly.mosaicBy');
			return MOSAIC_MODES_ECONOMY.includes(v as MosaicBy) ? (v as MosaicBy) : 'both';
		} catch {
			return 'both';
		}
	}
	function setBy(m: MosaicBy) {
		by = m;
		try {
			localStorage.setItem('toodly.mosaicBy', m);
		} catch {}
	}
	const names: Record<MosaicBy, string> = $derived({ priority: t('Priorità'), deadline: t('Vicinanza'), both: t('Entrambe'), amount: t('Importo') });
	const info = $derived(groupInfo(store.groups, sorted, t('Senza gruppo')));
	const tiles = $derived(buildMosaic(sorted, todayISO(), eff, showDone, Math.max(W - 2, 50), Math.max(H - 2, 50), (x) => { const f = figuresOf(x, store.listOf(x.list_id)); return f.net > 0 ? f.net : f.cost; }));
	$effect(() => setVisibleOrder(tiles.map((x) => x.id)));
</script>

<div class="flex h-full min-w-0 flex-1 flex-col">
	<MapBar />
	<div class="flex shrink-0 flex-wrap items-center gap-1 px-4 pb-2 text-[12px]">
		<span class="text-muted">{t('Dimensione in base a')}</span>
		<div class="flex rounded-lg border border-border p-0.5">
			{#each modes as m (m)}
				<button class="rounded-md px-2 py-0.5 {eff === m ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg'}" aria-pressed={eff === m} onclick={() => setBy(m)}>{names[m]}</button>
			{/each}
		</div>
		<button class="btn h-7 border-transparent bg-transparent" title={t('Mostra completati')} onclick={() => (showDone = !showDone)}>
			{#if showDone}<Eye size={14} />{:else}<EyeOff size={14} />{/if}{t('Completati')}
		</button>
		<span class="ml-auto text-faint">{t('Più grande = più importante e più vicino alla scadenza')}</span>
	</div>
	<div class="min-h-0 flex-1 px-4 pb-4">
		<div class="relative size-full overflow-hidden rounded-2xl border border-border" bind:clientWidth={W} bind:clientHeight={H}>
			{#if tiles.length === 0}
				<div class="grid size-full place-items-center text-center text-muted"><div><div class="text-[15px] font-medium text-fg">{t('Niente da mostrare nel Mosaic')}</div><div class="text-[12.5px]">{t('Scrivi un task nella barra qui sopra, oppure crea un gruppo.')}</div></div></div>
			{/if}
			{#each tiles as tl (tl.id)}
				{@const tk = tl.task}
				{@const late = isOverdue(tk)}
				{@const blocked = !tk.completed && store.blockedIds.has(tk.id)}
				{@const sel = ui.selectedTaskId === tk.id}
				{@const big = tl.w > 150 && tl.h > 80}
				{@const fs = Math.max(11, Math.min(20, Math.sqrt(tl.w * tl.h) / 9.5))}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div
					data-task
					data-task-id={tk.id}
					title={tk.title}
					class="gx mtile group absolute cursor-pointer overflow-hidden {tk.completed ? 'opacity-55' : ''} {blocked ? 'mt-blocked' : ''} {late ? 'mt-late' : ''} {selection.has(tk.id) ? 'mt-multi' : sel ? 'mt-sel' : ''}"
					style="{paletteStyle(info.color(info.rootOf(tk)))}; left:{tl.x + 1}px; top:{tl.y + 1}px; width:{tl.w - 3}px; height:{tl.h - 3}px"
					onclick={(e) => {
						if (!handleSelectClick(e, tk.id)) ui.selectedTaskId = tk.id;
						else ui.selectedTaskId = null;
					}}
				>
					{#if tk.priority > 0 && !tk.completed}<span class="absolute inset-y-0 left-0 w-1.5" style="background:var(--p{tk.priority})"></span>{/if}
					<div class="flex items-start gap-2 p-2.5 pl-3.5">
						<div class="mt-px shrink-0" data-nodrag><Checkbox checked={tk.completed} color="var(--p{tk.priority})" size={fs > 14 ? 17 : 15} {blocked} onchange={(v) => store.setCompleted(tk.id, v)} /></div>
						<span class="min-w-0 leading-[1.2] font-semibold break-words {tk.completed ? 'line-through' : ''}" style="font-size:{fs}px">{tk.title}</span>
					</div>
					{#if tl.h > 52}
						<div class="absolute right-0 bottom-0 left-0 flex items-center gap-2 px-3.5 pb-2 text-[11px] whitespace-nowrap {late ? 'text-p3 font-semibold' : 'text-muted'}">
							{#if blocked}<Hourglass size={11} class="shrink-0 text-p2" />{/if}
							{#if tk.due_date}<span class="inline-flex items-center gap-1"><CalendarDays size={11} />{relativeDay(tk.due_date)}</span>{/if}
							{#if ecoShow('mosaic')}<MoneyChip money={chipOf(tk)} />{/if}
							{#if big}<span class="ml-auto min-w-0 truncate" style="color:var(--gacc)">{info.name(info.rootOf(tk))}</span>{/if}
						</div>
					{/if}
					<div data-nodismiss class="absolute top-1 right-1 z-10 rounded-lg border border-border bg-elev shadow-pop transition-opacity duration-100 {menuFor === tk.id ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'}">
						<TaskQuickActions task={tk} onmenu={(o) => (menuFor = o ? tk.id : null)} />
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.mtile {
		border-radius: 11px;
		background: color-mix(in srgb, var(--gfill) 70%, var(--elev));
		border: 1.5px solid var(--gborder);
		transition: filter 0.12s;
	}
	.mtile:hover {
		filter: brightness(1.06);
	}
	.mt-blocked {
		border-style: dashed;
	}
	.mt-late {
		border-color: var(--p3);
		border-width: 2.5px;
	}
	.mt-sel {
		box-shadow: inset 0 0 0 2px var(--accent);
	}
	.mt-multi {
		box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent) 60%, transparent);
	}
</style>
