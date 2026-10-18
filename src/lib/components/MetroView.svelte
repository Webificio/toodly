<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';
	import MapBar from './MapBar.svelte';
	import MapExport from './MapExport.svelte';
	import MapCanvas from './MapCanvas.svelte';
	import MapNode from './MapNode.svelte';
	import { PAD_TOP, buildMetro, metroToMermaid, metroEdges } from '../metro';
	import { groupInfo, labelWidth, pickLabels, type MapLabel } from '../maps';
	import { paletteStyle } from '../graph';
	import { currentWorkspace } from '../db';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { setVisibleOrder } from '../selection.svelte';
	import { nav, ui } from '../nav.svelte';
	import { inScope, sortTasks } from '../views';
	import { todayISO } from '../dates';

	/** Metro: una linea per gruppo, una stazione per task, il tempo scorre verso destra. Le dipendenze sono i cambi tra le linee. */
	const matched = $derived(store.tasks.filter((x) => inScope(x, nav.scope, store.filters, store.blockedIds)));
	const sorted = $derived(sortTasks(matched, 'manual'));
	let showDone = $state(false);

	const model = $derived(buildMetro({ groups: store.groups, tasks: sorted, today: todayISO(), showDone, ungroupedLabel: t('Senza gruppo'), lateLabel: t('Scaduti'), noDateLabel: t('Senza data') }));
	const info = $derived(groupInfo(store.groups, sorted, t('Senza gruppo')));
	const deps = $derived(metroEdges(model, store.deps));
	$effect(() => setVisibleOrder(model.taskOrder));

	// etichette: sopra o sotto la stazione, solo dove c'è posto
	const labels = $derived.by(() => {
		const obstacles = model.stations.map((s) => ({ id: s.task.id, x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 }));
		const cands = model.stations.map((s) => {
			const w = labelWidth(s.label);
			const y = s.above ? s.y - s.r - 18 : s.y + s.r + 4;
			return { id: s.task.id, s, rect: { x: s.x - w / 2, y, w, h: 14 }, rank: s.rank };
		});
		const ok = pickLabels(cands, obstacles);
		const out = new Map<string, MapLabel>();
		for (const c of cands) if (ok.has(c.id)) out.set(c.id, { x: c.s.x, y: c.rect.y + 7, anchor: 'middle', rot: 0, text: c.s.label });
		return out;
	});
	const focus = $derived.by(() => {
		const n = ui.selectedTaskId ? model.byTask.get(ui.selectedTaskId) : null;
		return n ? { id: n.task.id, x: n.x, y: n.y } : null;
	});
	const dots = $derived(model.stations.map((s) => ({ x: s.x, y: s.y, c: 'var(--accent)', o: s.task.completed ? 0.25 : 0.7 })));
	const viewKey = $derived(`metro|${currentWorkspace() ?? ''}|${nav.scope}`);
	const lineOf = (i: number) => model.lines[i];
</script>

<div class="flex h-full min-w-0 flex-1 flex-col">
	<MapBar />
	<MapCanvas
		width={model.width}
		height={model.height}
		{viewKey}
		{focus}
		{dots}
		empty={model.stations.length === 0}
		emptyTitle={t('Niente da mostrare nel Metro')}
		emptyHint={t('Scrivi un task nella barra qui sopra, oppure crea un gruppo.')}
		fitMin={0.5}
	>
		{#snippet tools()}
			<button class="btn h-7 border-transparent bg-transparent" title={t('Mostra completati')} onclick={() => (showDone = !showDone)}>
				{#if showDone}<Eye size={14} />{:else}<EyeOff size={14} />{/if}{t('Completati')}
			</button>
			<MapExport kind="metro" build={(ti) => metroToMermaid({ groups: store.groups, tasks: sorted, today: todayISO(), showDone, ungroupedLabel: t('Senza gruppo'), lateLabel: t('Scaduti'), noDateLabel: t('Senza data') }, store.deps, ti)} />
		{/snippet}
		{#snippet children()}
			<svg aria-hidden="true" class="pointer-events-none absolute top-0 left-0 overflow-visible" width={model.width} height={model.height}>
				{#each model.cols as c (c.key)}
					<line x1={c.x} x2={c.x} y1={PAD_TOP - 8} y2={model.height - 10} stroke="var(--border)" stroke-width="1" stroke-dasharray="2 6" />
					<text x={c.x} y={PAD_TOP - 18} text-anchor="middle" font-size="11" style="fill:{c.key === 'late' ? 'var(--p3)' : 'var(--muted)'}">{c.label}</text>
				{/each}
				{#if model.todayX !== null}
					<line x1={model.todayX} x2={model.todayX} y1={PAD_TOP - 8} y2={model.height - 10} style="stroke:var(--accent)" stroke-width="2" />
					<text x={model.todayX} y={PAD_TOP - 38} text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--accent)">{t('Oggi')}</text>
				{/if}
				{#each model.lines as l (l.root)}
					<g class="gx" style={paletteStyle(info.color(l.root))}>
						<line x1={l.x1} x2={l.x2} y1={l.y} y2={l.y} stroke-width="9" stroke-linecap="round" style="stroke:var(--gacc)" opacity="0.9" />
						<text x={l.x1 - 14} y={l.y} text-anchor="end" dominant-baseline="middle" font-size="12" font-weight="700" style="fill:var(--gacc)">{l.name}</text>
					</g>
				{/each}
				{#each model.stations as s (s.task.id)}
					{#if s.y !== lineOf(s.line).y}
						<line x1={s.x} x2={s.x} y1={lineOf(s.line).y} y2={s.y} stroke-width="5" class="gx" style="{paletteStyle(info.color(lineOf(s.line).root))}; stroke:var(--gacc)" opacity="0.9" />
					{/if}
				{/each}
				{#each deps as d (d.key)}
					<path d={d.d} fill="none" stroke-width="1.5" stroke-dasharray="5 4" style="stroke:{d.late ? 'var(--p3)' : 'var(--muted)'}" opacity="0.9" />
				{/each}
			</svg>
			{#each model.taskOrder as id (id)}
				{@const s = model.byTask.get(id)!}
				<MapNode task={s.task} x={s.x} y={s.y} r={s.r} color={info.color(lineOf(s.line).root)} crumb={info.crumb(s.task)} label={labels.get(id) ?? null} cardBelow={s.line === 0 && !s.above ? true : s.y < 150} />
			{/each}
		{/snippet}
	</MapCanvas>
</div>
