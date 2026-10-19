<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';
	import MapBar from './MapBar.svelte';
	import MapCanvas from './MapCanvas.svelte';
	import MapNode from './MapNode.svelte';
	import { LEAF_LEGEND, buildGrove } from '../grove';
	import { groupInfo, labelWidth, pickLabels, type MapLabel } from '../maps';
	import { paletteStyle } from '../graph';
	import { currentWorkspace } from '../db';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { setVisibleOrder } from '../selection.svelte';
	import { nav, ui } from '../nav.svelte';
	import { inScope, sortTasks } from '../views';
	import { todayISO } from '../dates';

	/** Grove: un albero per gruppo. Le foglie sono i task aperti, i frutti quelli completati, a terra restano gli scaduti. */
	const matched = $derived(store.tasks.filter((x) => inScope(x, nav.scope, store.filters, store.blockedIds)));
	const sorted = $derived(sortTasks(matched, 'manual'));
	let showDone = $state(true);
	const model = $derived(buildGrove({ groups: store.groups, tasks: sorted, today: todayISO(), showDone, ungroupedLabel: t('Senza gruppo') }));
	const info = $derived(groupInfo(store.groups, sorted, t('Senza gruppo')));
	$effect(() => setVisibleOrder(model.taskOrder));

	const labels = $derived.by(() => {
		const obstacles = model.leaves.map((l) => ({ id: l.task.id, x: l.x - l.r, y: l.y - l.r, w: l.r * 2, h: l.r * 2 }));
		const cands = model.leaves
			.filter((l) => l.kind !== 'fruit')
			.map((l) => ({ id: l.task.id, l, rect: { x: l.x + l.r + 4, y: l.y - 7, w: labelWidth(l.label), h: 14 }, rank: l.rank }));
		const ok = pickLabels(cands, obstacles);
		const out = new Map<string, MapLabel>();
		for (const c of cands) if (ok.has(c.id)) out.set(c.id, { x: c.rect.x, y: c.l.y, anchor: 'start', rot: 0, text: c.l.label });
		return out;
	});
	const focus = $derived.by(() => {
		const n = ui.selectedTaskId ? model.byTask.get(ui.selectedTaskId) : null;
		return n ? { id: n.task.id, x: n.x, y: n.y } : null;
	});
	const dots = $derived(model.leaves.map((l) => ({ x: l.x, y: l.y, c: l.fill, o: 0.85 })));
	const viewKey = $derived(`grove|${currentWorkspace() ?? ''}|${nav.scope}`);
	const legendLabel = (k: string) => (k === 'over' ? t('scaduti') : k === 'later' ? t('oltre') : k.replace('≤ ', '≤ ') + ' ' + t('g'));
</script>

<div class="flex h-full min-w-0 flex-1 flex-col">
	<MapBar />
	<MapCanvas width={model.width} height={model.height} {viewKey} {focus} {dots} empty={model.leaves.length === 0} emptyTitle={t('Il boschetto è vuoto')} emptyHint={t('Scrivi un task nella barra qui sopra, oppure crea un gruppo.')} fitMin={0.5}>
		{#snippet tools()}
			<button class="btn h-7 border-transparent bg-transparent" title={t('Mostra completati')} onclick={() => (showDone = !showDone)}>
				{#if showDone}<Eye size={14} />{:else}<EyeOff size={14} />{/if}{t('Frutti')}
			</button>
			<span class="h-4 w-px bg-border"></span>
			{#each LEAF_LEGEND as l (l.key)}
				<span class="inline-flex items-center gap-1 text-[11px] text-muted"><span class="inline-block size-2.5" style="background:{l.color};border-radius:0 100% 0 100%"></span>{legendLabel(l.key)}</span>
			{/each}
		{/snippet}
		{#snippet children()}
			<svg aria-hidden="true" class="pointer-events-none absolute top-0 left-0 overflow-visible" width={model.width} height={model.height}>
				<rect class="g-sky" x="-60" y="-60" width={model.width + 120} height={model.ground + 60} />
				<rect class="g-ground" x="-60" y={model.ground} width={model.width + 120} height={model.height - model.ground + 60} />
				<path class="g-hill" d="M-60,{model.ground} Q{model.width * 0.3},{model.ground - 16} {model.width * 0.55},{model.ground} T{model.width + 60},{model.ground} L{model.width + 60},{model.ground + 30} L-60,{model.ground + 30} Z" />
				{#each model.trees as tr (tr.root)}
					{@const sc = tr.crx / 120}
					<g class="gx" style={paletteStyle(tr.color)}>
						<path d="M{tr.cx - 10 * sc},{model.ground} Q{tr.cx - 4 * sc},{(model.ground + tr.top) / 2} {tr.cx - 4},{tr.top + 24} L{tr.cx + 4},{tr.top + 24} Q{tr.cx + 4 * sc},{(model.ground + tr.top) / 2} {tr.cx + 10 * sc},{model.ground} Z" class="g-trunk" />
						<ellipse cx={tr.cx} cy={tr.ccy} rx={tr.crx} ry={tr.cry} style="fill:var(--gacc)" opacity="0.1" />
						<ellipse cx={tr.cx} cy={tr.ccy} rx={tr.crx * 0.78} ry={tr.cry * 0.78} style="fill:var(--gacc)" opacity="0.08" />
						{#each model.leaves.filter((l) => l.tree === model.trees.indexOf(tr) && l.kind !== 'fallen') as l (l.task.id)}
							<path d="M{tr.cx},{tr.top + 34} Q{(tr.cx + l.x) / 2},{(tr.top + l.y) / 2 + 10} {l.x},{l.y}" fill="none" class="g-branch" stroke-width={1.3 * sc} />
						{/each}
						<text x={tr.cx} y={model.ground + 56} text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--gacc)">{tr.name}</text>
						<text x={tr.cx} y={model.ground + 74} text-anchor="middle" font-size="11" style="fill:var(--muted)">{t('{o} aperti · {d} completati', { o: tr.open, d: tr.done })}</text>
						<rect x={tr.cx - 50} y={model.ground + 82} width="100" height="5" rx="2.5" style="fill:var(--border)" />
						<rect x={tr.cx - 50} y={model.ground + 82} width={(100 * tr.done) / Math.max(tr.open + tr.done, 1)} height="5" rx="2.5" style="fill:#fbbf24" />
					</g>
				{/each}
			</svg>
			{#each model.taskOrder as id (id)}
				{@const l = model.byTask.get(id)!}
				<MapNode task={l.task} x={l.x} y={l.y} r={l.r} color={l.color} crumb={info.crumb(l.task)} label={labels.get(id) ?? null} cardBelow={l.y < 170} fill={l.fill} leaf={l.kind === 'fruit' ? null : l.rot} />
			{/each}
		{/snippet}
	</MapCanvas>
</div>

<style>
	.g-sky {
		fill: #dfeee6;
	}
	.g-ground {
		fill: #bcd3c0;
	}
	.g-hill {
		fill: #cfe3d1;
	}
	.g-trunk {
		fill: #7a5a3d;
	}
	.g-branch {
		stroke: #8b6b4c;
		stroke-opacity: 0.7;
	}
	:global(.dark) .g-sky {
		fill: #121b1b;
	}
	:global(.dark) .g-ground {
		fill: #0c1512;
	}
	:global(.dark) .g-hill {
		fill: #12201a;
	}
	:global(.dark) .g-trunk {
		fill: #3b2a1d;
	}
	:global(.dark) .g-branch {
		stroke: #5b4430;
	}
</style>
