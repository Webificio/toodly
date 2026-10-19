<script lang="ts">
	import { Eye, EyeOff, LayoutGrid, Spline } from '@lucide/svelte';
	import MapBar from './MapBar.svelte';
	import MapCanvas from './MapCanvas.svelte';
	import CorkNote from './CorkNote.svelte';
	import { buildCork, clampPos, corkEdges, type CorkModel } from '../cork';
	import { paletteStyle } from '../graph';
	import { currentWorkspace } from '../db';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { selection, setVisibleOrder } from '../selection.svelte';
	import { nav, ui, showToast } from '../nav.svelte';
	import { inScope, sortTasks } from '../views';

	/** Cork: bacheca di sughero. I foglietti si trascinano dove si vuole e la posizione resta salvata. */
	const matched = $derived(store.tasks.filter((x) => inScope(x, nav.scope, store.filters, store.blockedIds)));
	const sorted = $derived(sortTasks(matched, 'manual'));
	let showDone = $state(false);
	let strings = $state(true);

	const base = $derived(buildCork({ groups: store.groups, tasks: sorted, showDone, ungroupedLabel: t('Senza gruppo') }));
	// posizioni provvisorie durante il trascinamento (il DB si aggiorna solo al rilascio)
	let live = $state<Record<string, { x: number; y: number }>>({});
	let draggingIds = $state<string[]>([]);
	const model = $derived.by<CorkModel>(() => {
		if (!Object.keys(live).length) return base;
		const notes = base.notes.map((n) => (live[n.task.id] ? { ...n, ...live[n.task.id] } : n));
		return { ...base, notes, byTask: new Map(notes.map((n) => [n.task.id, n])) };
	});
	const edges = $derived(strings ? corkEdges(model, store.deps) : []);
	$effect(() => setVisibleOrder(base.taskOrder));

	const crumbOf = (id: string) => model.byTask.get(id);
	const focus = $derived.by(() => {
		const n = ui.selectedTaskId ? model.byTask.get(ui.selectedTaskId) : null;
		return n ? { id: n.task.id, x: n.x + n.w / 2, y: n.y + n.h / 2 } : null;
	});
	const dots = $derived(model.notes.map((n) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2, c: 'var(--accent)', o: n.task.completed ? 0.25 : 0.75 })));
	const viewKey = $derived(`cork|${currentWorkspace() ?? ''}|${nav.scope}`);
	const placed = $derived(base.notes.filter((n) => !n.auto).length);

	// ---- trascinamento --------------------------------------------------------------------
	let boardEl = $state<HTMLDivElement>();
	let justDragged = false;
	const guard = () => justDragged;

	function noteDown(e: PointerEvent, id: string) {
		if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, a, [data-nodrag]')) return;
		const ids = selection.has(id) && selection.size > 1 ? [...selection].filter((x) => base.byTask.has(x)) : [id];
		const start = new Map(ids.map((i) => [i, { x: base.byTask.get(i)!.x, y: base.byTask.get(i)!.y }]));
		const r = boardEl!.getBoundingClientRect();
		const eff = r.width / boardEl!.offsetWidth || 1;
		const x0 = e.clientX;
		const y0 = e.clientY;
		let moved = false;
		const move = (m: PointerEvent) => {
			const dx = (m.clientX - x0) / eff;
			const dy = (m.clientY - y0) / eff;
			if (!moved && Math.abs(dx) + Math.abs(dy) < 4 / eff) return;
			if (!moved) {
				moved = true;
				draggingIds = ids;
			}
			const next: Record<string, { x: number; y: number }> = {};
			for (const [i, p] of start) next[i] = clampPos(p.x + dx, p.y + dy);
			live = next;
		};
		const up = async () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
			if (!moved) return;
			justDragged = true;
			setTimeout(() => (justDragged = false), 0);
			const final = live;
			await store.batch(t('Posizione'), async () => {
				for (const [i, p] of Object.entries(final)) await store.updateTask(i, { board_x: p.x, board_y: p.y });
			});
			live = {};
			draggingIds = [];
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', up);
	}

	/** Rimette tutti i foglietti al loro posto automatico, per gruppo. */
	async function arrange() {
		const ids = base.notes.filter((n) => !n.auto).map((n) => n.task.id);
		if (!ids.length) return showToast(t('I foglietti sono già in ordine'));
		await store.batch(t('Posizione'), async () => {
			for (const i of ids) await store.updateTask(i, { board_x: null, board_y: null });
		});
		showToast(t('Foglietti riordinati per gruppo'));
	}
</script>

<div class="flex h-full min-w-0 flex-1 flex-col">
	<MapBar />
	<MapCanvas width={model.width} height={model.height} {viewKey} {focus} {dots} empty={model.notes.length === 0} emptyTitle={t('La bacheca è vuota')} emptyHint={t('Scrivi un task nella barra qui sopra, oppure crea un gruppo.')} fitMin={0.5}>
		{#snippet tools()}
			<button class="btn h-7 border-transparent bg-transparent" title={t('Mostra completati')} onclick={() => (showDone = !showDone)}>
				{#if showDone}<Eye size={14} />{:else}<EyeOff size={14} />{/if}{t('Completati')}
			</button>
			<span class="h-4 w-px bg-border"></span>
			<button class="btn h-7 border-transparent bg-transparent {strings ? 'text-accent' : ''}" title={t('Mostra i fili delle dipendenze')} aria-pressed={strings} onclick={() => (strings = !strings)}><Spline size={14} />{t('Fili')}</button>
			<button class="btn h-7 border-transparent bg-transparent" title={t('Rimette i foglietti per gruppo')} disabled={!placed} onclick={arrange}><LayoutGrid size={14} />{t('Riordina')}</button>
		{/snippet}
		{#snippet children()}
			<div bind:this={boardEl} class="cork-board relative" style="width:{model.width}px; height:{model.height}px">
				<svg aria-hidden="true" class="pointer-events-none absolute top-0 left-0 overflow-visible" width={model.width} height={model.height}>
					{#each edges as d (d.key)}
						<path d={d.d} fill="none" stroke-width="2.4" stroke-linecap="round" style="stroke:{d.late ? 'var(--p3)' : '#d4a373'}" opacity="0.92" />
					{/each}
				</svg>
				{#each model.tags as g (g.root)}
					<div class="gx ctag absolute" style="{paletteStyle(g.color)}; left:{g.x}px; top:{g.y}px">
						<span class="ctag-dot"></span>{g.name}<span class="ctag-n">{g.count}</span>
					</div>
				{/each}
				{#each model.taskOrder as id (id)}
					{@const n = model.byTask.get(id)!}
					<CorkNote task={n.task} x={n.x} y={n.y} w={n.w} h={n.h} rot={n.rot} color={n.color} dragging={draggingIds.includes(id)} onpointerdown={(e) => noteDown(e, id)} onclickguard={guard} />
				{/each}
			</div>
		{/snippet}
	</MapCanvas>
</div>

<style>
	.cork-board {
		border-radius: 18px;
		background-color: #c9a37b;
		background-image: radial-gradient(circle at 20% 30%, rgb(120 80 40 / 0.35) 0 1.2px, transparent 1.6px), radial-gradient(circle at 70% 60%, rgb(90 55 25 / 0.3) 0 1.6px, transparent 2px), radial-gradient(circle at 45% 85%, rgb(255 230 190 / 0.35) 0 1px, transparent 1.4px);
		background-size: 17px 17px, 23px 23px, 13px 13px;
		box-shadow: inset 0 0 0 10px #8a6a47, inset 0 0 40px rgb(0 0 0 / 0.35);
	}
	:global(.dark) .cork-board {
		background-color: #3a2e23;
		background-image: radial-gradient(circle at 20% 30%, rgb(0 0 0 / 0.35) 0 1.2px, transparent 1.6px), radial-gradient(circle at 70% 60%, rgb(255 220 170 / 0.06) 0 1.6px, transparent 2px), radial-gradient(circle at 45% 85%, rgb(255 220 170 / 0.08) 0 1px, transparent 1.4px);
		box-shadow: inset 0 0 0 10px #231a12, inset 0 0 50px rgb(0 0 0 / 0.55);
	}
	.ctag {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 26px;
		padding: 0 12px 0 10px;
		border-radius: 3px;
		background: #f6f1e4;
		color: #3b2d1d;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		box-shadow: 0 2px 4px rgb(0 0 0 / 0.35);
		transform: rotate(-1deg);
		white-space: nowrap;
	}
	.ctag-dot {
		width: 9px;
		height: 9px;
		border-radius: 9999px;
		background: var(--gacc);
	}
	.ctag-n {
		font-weight: 600;
		opacity: 0.55;
		letter-spacing: 0;
	}
</style>
