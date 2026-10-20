<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';
	import MapBar from './MapBar.svelte';
	import MapExport from './MapExport.svelte';
	import MapCanvas from './MapCanvas.svelte';
	import MapNode from './MapNode.svelte';
	import { ecoShow, rootMoney } from '../economy.svelte';
	import { BANDS, CORE_R, OUTER_R, buildOrbit, orbitToMermaid, orbitEdges, sectorPath, type Band } from '../orbit';
	import { groupInfo } from '../maps';
	import { paletteStyle } from '../graph';
	import { currentWorkspace } from '../db';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { setVisibleOrder } from '../selection.svelte';
	import { nav, ui } from '../nav.svelte';
	import { inScope, sortTasks } from '../views';
	import { todayISO } from '../dates';

	/** Orbit: oggi al centro, anelli = fasce di tempo, spicchi = gruppi. Più un task è vicino al centro, più è urgente. */
	const matched = $derived(store.tasks.filter((x) => inScope(x, nav.scope, store.filters, store.blockedIds)));
	const sorted = $derived(sortTasks(matched, 'manual'));
	let showDone = $state(false);

	const model = $derived(buildOrbit({ groups: store.groups, tasks: sorted, today: todayISO(), showDone, ungroupedLabel: t('Senza gruppo') }));
	const info = $derived(groupInfo(store.groups, sorted, t('Senza gruppo')));
	const deps = $derived(orbitEdges(model, store.deps));
	$effect(() => setVisibleOrder(model.taskOrder));

	const bandLabel = (b: Band) => ({ late: t('Scaduti'), today: t('Oggi'), week: t('Entro 7 giorni'), month: t('Entro 30 giorni'), later: t('Oltre'), none: t('Senza data') })[b];
	const focus = $derived.by(() => {
		const n = ui.selectedTaskId ? model.byTask.get(ui.selectedTaskId) : null;
		return n ? { id: n.task.id, x: n.x, y: n.y } : null;
	});
	const dots = $derived(model.nodes.map((n) => ({ x: n.x, y: n.y, c: 'var(--accent)', o: n.task.completed ? 0.25 : 0.7 })));
	const viewKey = $derived(`orbit|${currentWorkspace() ?? ''}|${nav.scope}`);
	const nowCount = $derived(model.nodes.filter((n) => n.band === 'late' || n.band === 'today').length);
	const sectorLabel = (a: number, b: number) => {
		const mid = (a + b) / 2;
		const rad = (mid * Math.PI) / 180;
		return { x: model.c + (OUTER_R + 26) * Math.sin(rad), y: model.c - (OUTER_R + 26) * Math.cos(rad), right: Math.sin(rad) >= 0 };
	};
</script>

<div class="flex h-full min-w-0 flex-1 flex-col">
	<MapBar />
	<MapCanvas
		width={model.size}
		height={model.size}
		{viewKey}
		{focus}
		{dots}
		empty={model.nodes.length === 0}
		emptyTitle={t('Niente da mostrare in Orbit')}
		emptyHint={t('Scrivi un task nella barra qui sopra, oppure crea un gruppo.')}
		fitMin={0.5}
	>
		{#snippet tools()}
			<button class="btn h-7 border-transparent bg-transparent" title={t('Mostra completati')} onclick={() => (showDone = !showDone)}>
				{#if showDone}<Eye size={14} />{:else}<EyeOff size={14} />{/if}{t('Completati')}
			</button>
			<MapExport kind="orbit" build={(ti) => orbitToMermaid({ groups: store.groups, tasks: sorted, today: todayISO(), showDone, ungroupedLabel: t('Senza gruppo') }, ti, { late: t('Scaduti'), today: t('Oggi'), week: t('Entro 7 giorni'), month: t('Entro 30 giorni'), later: t('Oltre'), none: t('Senza data') })} />
		{/snippet}
		{#snippet children()}
			<svg aria-hidden="true" class="pointer-events-none absolute top-0 left-0 overflow-visible" width={model.size} height={model.size}>
				{#each model.sectors as sec (sec.root)}
					<g class="gx" style={paletteStyle(sec.color)}>
						<path d={sectorPath(model.c, CORE_R + 8, OUTER_R, sec.start, sec.end)} style="fill:var(--gacc)" opacity="0.07" />
						<path d={sectorPath(model.c, OUTER_R, OUTER_R + 6, sec.start, sec.end)} style="fill:var(--gacc)" opacity="0.9" />
					</g>
				{/each}
				{#each BANDS as b (b.id)}
					<circle cx={model.c} cy={model.c} r={b.r} fill="none" stroke="var(--border)" stroke-width="1" stroke-dasharray={b.id === 'none' ? '3 5' : ''} />
				{/each}
				<circle cx={model.c} cy={model.c} r={CORE_R} style="fill:var(--elev); stroke:var(--accent)" stroke-width="2" />
				{#each deps as d (d.key)}
					<path d={d.d} fill="none" stroke-width="1.4" stroke-dasharray="5 4" style="stroke:{d.late ? 'var(--p3)' : 'var(--muted)'}" opacity="0.85" />
				{/each}
				{#each BANDS as b (b.id)}
					<text x={model.c} y={model.c - b.r - 5} text-anchor="middle" font-size="10.5" style="fill:var(--faint); paint-order:stroke; stroke:var(--bg); stroke-width:3px">{bandLabel(b.id)}</text>
				{/each}
				<text x={model.c} y={model.c - 4} text-anchor="middle" font-size="22" font-weight="700" style="fill:var(--fg)">{nowCount}</text>
				<text x={model.c} y={model.c + 14} text-anchor="middle" font-size="10.5" style="fill:var(--muted)">{t('da fare ora')}</text>
				{#each model.sectors as sec (sec.root)}
					{@const p = sectorLabel(sec.start, sec.end)}
					<text class="gx" x={p.x} y={p.y} text-anchor={p.right ? 'start' : 'end'} dominant-baseline="middle" font-size="12" font-weight="600" style="{paletteStyle(sec.color)}; fill:var(--gacc)">{sec.name} · {sec.count}{#if ecoShow('orbit')}{@const mm = rootMoney(sec.root)}{#if mm} · {mm.text}<title>{mm.tip}</title>{/if}{/if}</text>
				{/each}
			</svg>
			{#each model.taskOrder as id (id)}
				{@const n = model.byTask.get(id)!}
				<MapNode task={n.task} x={n.x} y={n.y} r={n.r} color={n.color} crumb={info.crumb(n.task)} label={n.label} cardBelow={n.y < model.c} />
			{/each}
		{/snippet}
	</MapCanvas>
</div>
