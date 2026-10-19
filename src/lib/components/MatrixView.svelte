<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';
	import MapBar from './MapBar.svelte';
	import MapCanvas from './MapCanvas.svelte';
	import MapNode from './MapNode.svelte';
	import { MX, buildMatrix, type Quad } from '../matrix';
	import { groupInfo, labelWidth, pickLabels, type MapLabel } from '../maps';
	import { currentWorkspace } from '../db';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { setVisibleOrder } from '../selection.svelte';
	import { nav, ui } from '../nav.svelte';
	import { inScope, sortTasks } from '../views';
	import { todayISO } from '../dates';

	/** Matrix: importanza per scadenza. In alto i task di priorità alta e media, a sinistra quelli scaduti o entro una settimana. */
	const matched = $derived(store.tasks.filter((x) => inScope(x, nav.scope, store.filters, store.blockedIds)));
	const sorted = $derived(sortTasks(matched, 'manual'));
	let showDone = $state(false);
	const model = $derived(buildMatrix({ groups: store.groups, tasks: sorted, today: todayISO(), showDone, ungroupedLabel: t('Senza gruppo') }));
	const info = $derived(groupInfo(store.groups, sorted, t('Senza gruppo')));
	$effect(() => setVisibleOrder(model.taskOrder));

	const labels = $derived.by(() => {
		const obstacles = model.nodes.map((n) => ({ id: n.task.id, x: n.x - n.r, y: n.y - n.r, w: n.r * 2, h: n.r * 2 }));
		const cands = model.nodes.map((n) => {
			const w = labelWidth(n.label);
			return { id: n.task.id, n, rect: { x: n.x + n.r + 5, y: n.y - 7, w, h: 14 }, rank: n.rank };
		});
		const ok = pickLabels(cands, obstacles);
		const out = new Map<string, MapLabel>();
		for (const c of cands) if (ok.has(c.id)) out.set(c.id, { x: c.rect.x, y: c.n.y, anchor: 'start', rot: 0, text: c.n.label });
		return out;
	});
	const focus = $derived.by(() => {
		const n = ui.selectedTaskId ? model.byTask.get(ui.selectedTaskId) : null;
		return n ? { id: n.task.id, x: n.x, y: n.y } : null;
	});
	const dots = $derived(model.nodes.map((n) => ({ x: n.x, y: n.y, c: 'var(--accent)', o: n.task.completed ? 0.25 : 0.7 })));
	const viewKey = $derived(`matrix|${currentWorkspace() ?? ''}|${nav.scope}`);

	const { X0, Y0, W, H } = MX;
	const quads: { q: Quad; name: string; col: number; row: number; color: string }[] = $derived([
		{ q: 'now', name: t('Da fare ora'), col: 0, row: 0, color: 'var(--accent)' },
		{ q: 'plan', name: t('Da pianificare'), col: 1, row: 0, color: 'var(--ok, #34d399)' },
		{ q: 'squeeze', name: t('Da incastrare'), col: 0, row: 1, color: 'var(--p2)' },
		{ q: 'later', name: t('Più avanti'), col: 1, row: 1, color: 'var(--muted)' }
	]);
</script>

<div class="flex h-full min-w-0 flex-1 flex-col">
	<MapBar />
	<MapCanvas width={model.width} height={model.height} {viewKey} {focus} {dots} empty={model.nodes.length === 0} emptyTitle={t('Niente da mostrare nella Matrix')} emptyHint={t('Scrivi un task nella barra qui sopra, oppure crea un gruppo.')} fitMin={0.5}>
		{#snippet tools()}
			<button class="btn h-7 border-transparent bg-transparent" title={t('Mostra completati')} onclick={() => (showDone = !showDone)}>
				{#if showDone}<Eye size={14} />{:else}<EyeOff size={14} />{/if}{t('Completati')}
			</button>
		{/snippet}
		{#snippet children()}
			<svg aria-hidden="true" class="pointer-events-none absolute top-0 left-0 overflow-visible" width={model.width} height={model.height}>
				{#each quads as z (z.q)}
					<rect x={X0 + (z.col * W) / 2 + 4} y={Y0 + (z.row * H) / 2 + 4} width={W / 2 - 8} height={H / 2 - 8} rx="16" style="fill:{z.color}" opacity={z.q === 'now' ? 0.1 : 0.06} />
					<text x={X0 + (z.col * W) / 2 + 22} y={Y0 + (z.row * H) / 2 + 36} font-size="18" font-weight="700" style="fill:{z.color}">{z.name}</text>
					<text x={X0 + ((z.col + 1) * W) / 2 - 20} y={Y0 + (z.row * H) / 2 + 36} font-size="14" font-weight="600" text-anchor="end" style="fill:{z.color}" opacity="0.8">{model.counts[z.q]}</text>
				{/each}
				<text x={X0 - 14} y={Y0 + 34} font-size="11" font-weight="600" text-anchor="end" style="fill:var(--faint)">{t('priorità alta')}</text>
				<text x={X0 - 14} y={Y0 + H - 16} font-size="11" font-weight="600" text-anchor="end" style="fill:var(--faint)">{t('priorità bassa')}</text>
				<text x={X0 + 8} y={Y0 + H + 26} font-size="11" font-weight="600" style="fill:var(--faint)">{t('← scaduti / imminenti')}</text>
				<text x={X0 + W / 2} y={Y0 + H + 26} font-size="11" font-weight="600" text-anchor="middle" style="fill:var(--faint)">{t('scadenza')}</text>
				<text x={X0 + W - 4} y={Y0 + H + 26} font-size="11" font-weight="600" text-anchor="end" style="fill:var(--faint)">{t('più avanti →')}</text>
			</svg>
			{#each model.taskOrder as id (id)}
				{@const n = model.byTask.get(id)!}
				<MapNode task={n.task} x={n.x} y={n.y} r={n.r} color={n.color} crumb={info.crumb(n.task)} label={labels.get(id) ?? null} cardBelow={n.y < Y0 + 170} />
			{/each}
		{/snippet}
	</MapCanvas>
</div>
