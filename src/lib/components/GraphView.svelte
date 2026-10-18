<script lang="ts" module>
	/** Posizione e zoom ricordati per (set, vista) finché l'app è aperta: passando ad altre viste e tornando non si perde il punto. */
	const savedViews = new Map<string, { s: number; l: number; t: number }>();
</script>

<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown, Eye, EyeOff, FolderPlus, Inbox, LayoutTemplate, Minus } from '@lucide/svelte';
	import GraphGroup from './GraphGroup.svelte';
	import GraphTask from './GraphTask.svelte';
	import QuickInput from './QuickInput.svelte';
	import { buildGraph, depEdges, fitScale, paletteStyle, UNGROUPED, type GNode } from '../graph';
	import { collapsedGroups, expandGroup, loadCollapsed, toggleGroup } from '../groupui.svelte';
	import { currentWorkspace } from '../db';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { setVisibleOrder } from '../selection.svelte';
	import { nav, ui } from '../nav.svelte';
	import { inScope, parseScope, sortTasks } from '../views';
	import { parseQuick } from '../quickparse';
	import { addDays, todayISO } from '../dates';
	import { drag, dropzone, type DropEvent } from '../dnd.svelte';
	import type { Task } from '../types';

	// ---- dati della vista --------------------------------------------------------------
	const scopeInfo = $derived(parseScope(nav.scope));
	const matched = $derived(store.tasks.filter((x) => inScope(x, nav.scope, store.filters, store.blockedIds)));
	const sorted = $derived(sortTasks(matched, 'manual'));

	// gruppi chiusi/aperti: stesso stato della Lista e del Gantt per la stessa vista di questo set
	$effect.pre(() => {
		loadCollapsed(currentWorkspace(), nav.scope);
	});

	let showDone = $state(true);
	let addingIn = $state<string | null>(null);
	let ungroupedCollapsed = $state(false);
	const collapsedTasks = new SvelteSet<string>();

	const model = $derived(
		buildGraph({
			groups: store.groups,
			tasks: sorted,
			collapsedGroups: new Set([...collapsedGroups, ...(ungroupedCollapsed ? [UNGROUPED] : [])]),
			collapsedTasks,
			showDone,
			addingIn,
			ungroupedLabel: t('Senza gruppo')
		})
	);
	const deps = $derived(depEdges(model, store.deps));
	$effect(() => setVisibleOrder(model.taskOrder));

	const groupName = (gid: string) => (gid ? (store.groupsById.get(gid)?.name ?? '') : t('Senza gruppo'));

	// ---- aggiunta di task e gruppi (la barra è quella della Lista) -----------------------
	/** nella vista di un'etichetta i nuovi task la ricevono */
	const scopeTags = (tags: string[]) => (scopeInfo.kind === 'tag' ? [...tags, scopeInfo.id] : tags);

	function create(text: string, gid: string | null) {
		const p = parseQuick(text, store.lists);
		if (!p.title) return false;
		const today = todayISO();
		store.createTask({
			title: p.title,
			group_id: gid,
			tags: scopeTags(p.tags),
			priority: p.priority || (nav.scope === 'important' ? 3 : 0),
			list_id: p.list_id ?? (scopeInfo.kind === 'list' ? scopeInfo.id : null),
			due_date: p.due_date ?? (nav.scope === 'today' ? today : nav.scope === 'next7' ? addDays(today, 1) : null)
		});
		return true;
	}
	const add = (text: string) => void create(text, null);
	function addInGroup(gid: string, text: string) {
		if (create(text, gid || null)) addingIn = null;
	}
	function startAdding(gid: string) {
		if (gid) expandGroup(gid);
		else ungroupedCollapsed = false;
		addingIn = addingIn === gid ? null : gid;
	}
	function toggleNode(n: GNode) {
		if (n.id === UNGROUPED) ungroupedCollapsed = !ungroupedCollapsed;
		else toggleGroup(n.id);
	}
	function collapseAll() {
		for (const g of store.groups) if (!collapsedGroups.has(g.id)) toggleGroup(g.id);
		ungroupedCollapsed = true;
	}
	function expandAll() {
		for (const id of [...collapsedGroups]) toggleGroup(id);
		ungroupedCollapsed = false;
		collapsedTasks.clear();
	}

	// ---- riordino e spostamento (come nella Lista) ---------------------------------------------
	let mark = $state<{ id: string; pos: 'before' | 'after' } | null>(null);
	function overTask(n: GNode, e: DropEvent) {
		const pos = e.y < e.rect.top + e.rect.height / 2 ? 'before' : 'after';
		if (mark?.id !== n.id || mark.pos !== pos) mark = { id: n.id, pos };
	}
	async function dropTask(n: GNode, e: DropEvent) {
		const m = mark;
		mark = null;
		if (!m || !n.task) return;
		const moved = store.byId.get(e.payload.id);
		if (!moved) return;
		// non si può inserire un task dentro la propria discendenza
		if (store.descendants(moved.id).some((d) => d.id === n.id)) return;
		const parentId = n.parentTaskId ?? null;
		const gid = n.groupId ?? null;
		const siblings = model.nodes
			.filter((x) => x.kind === 'task' && x.id !== moved.id && (x.parentTaskId ?? null) === parentId && (parentId ? true : (x.groupId ?? null) === gid))
			.map((x) => x.id);
		let idx = siblings.indexOf(n.id);
		if (idx < 0) idx = siblings.length;
		else if (m.pos === 'after') idx++;
		const extra: Partial<Task> = { parent_id: parentId, group_id: parentId ? null : gid };
		await store.reorder(moved.id, siblings, idx, extra);
		if (parentId) {
			const parent = store.byId.get(parentId);
			if (parent && parent.list_id !== moved.list_id) await store.moveToList(moved.id, parent.list_id);
		}
	}

	// zona «livello principale»: porta fuori dai gruppi
	const dragging = $derived(drag.active && (drag.payload?.type === 'group' || (drag.payload?.type === 'task' && !!store.byId.get(drag.payload.id)?.group_id)));
	let overRoot = $state(false);
	async function dropRoot(e: DropEvent) {
		overRoot = false;
		const p = e.payload;
		if (p.type === 'group') await store.updateGroup(p.id, { parent_id: null });
		else if (p.type === 'task') await store.moveToGroup(p.id, null);
	}

	// ---- area scorrevole e zoom -----------------------------------------------------------
	const PAD = 80;
	const Z_MIN = 0.2;
	const Z_MAX = 2;
	let scroller: HTMLDivElement;
	let s = $state(1);
	let sl = $state(0);
	let st = $state(0);
	let cw = $state(800);
	let ch = $state(600);
	let panning = $state(false);

	const viewKey = $derived(`${currentWorkspace() ?? ''}|${nav.scope}`);
	const spW = $derived((model.width + 2 * PAD) * s);
	const spH = $derived((model.height + 2 * PAD) * s);

	/** Rapporto tra le coordinate del puntatore e quelle dell'elemento (diverso da 1 se l'interfaccia è ingrandita con lo zoom del documento). */
	const k = () => (scroller && scroller.offsetWidth ? scroller.getBoundingClientRect().width / scroller.offsetWidth : 1);

	function remember() {
		if (scroller) savedViews.set(viewKey, { s, l: scroller.scrollLeft, t: scroller.scrollTop });
	}
	function onScroll() {
		sl = scroller.scrollLeft;
		st = scroller.scrollTop;
		remember();
	}

	/** Cambia lo zoom tenendo fermo il punto sotto il puntatore (o il centro della vista). */
	async function setZoom(next: number, clientX?: number, clientY?: number) {
		const ns = Math.min(Z_MAX, Math.max(Z_MIN, Math.round(next * 100) / 100));
		if (ns === s) return;
		const r = scroller.getBoundingClientRect();
		const kk = k();
		const vx = clientX === undefined ? scroller.clientWidth / 2 : (clientX - r.left) / kk;
		const vy = clientY === undefined ? scroller.clientHeight / 2 : (clientY - r.top) / kk;
		const ux = (scroller.scrollLeft + vx) / s;
		const uy = (scroller.scrollTop + vy) / s;
		s = ns;
		await tick();
		scroller.scrollLeft = ux * ns - vx;
		scroller.scrollTop = uy * ns - vy;
		remember();
	}
	const zoomBy = (f: number) => setZoom(s * f);

	/** Adatta tutto il grafo alla finestra (senza ingrandire oltre il 100%). */
	async function fit(min = Z_MIN) {
		s = fitScale(model.width + 2 * PAD, model.height + 2 * PAD, scroller.clientWidth, scroller.clientHeight, min, 1);
		await tick();
		scroller.scrollLeft = Math.max(0, (spW - scroller.clientWidth) / 2);
		scroller.scrollTop = 0;
		remember();
	}

	// Ctrl + rotella (e pizzico sul trackpad): zoom; la rotella da sola scorre l'area
	function wheel(node: HTMLElement) {
		const h = (e: WheelEvent) => {
			if (!(e.ctrlKey || e.metaKey)) return;
			e.preventDefault();
			setZoom(s * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
		};
		node.addEventListener('wheel', h, { passive: false });
		return { destroy: () => node.removeEventListener('wheel', h) };
	}

	// trascinando lo sfondo ci si sposta
	function panStart(e: PointerEvent) {
		if ((e.button !== 0 && e.button !== 1) || (e.target as HTMLElement).closest('[data-node], [data-ui], button, input, a')) return;
		e.preventDefault();
		const x0 = e.clientX;
		const y0 = e.clientY;
		const l0 = scroller.scrollLeft;
		const t0 = scroller.scrollTop;
		const kk = k();
		let moved = false;
		panning = true;
		const move = (m: PointerEvent) => {
			if (Math.abs(m.clientX - x0) + Math.abs(m.clientY - y0) > 3) moved = true;
			scroller.scrollLeft = l0 - (m.clientX - x0) / kk;
			scroller.scrollTop = t0 - (m.clientY - y0) / kk;
		};
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
			panning = false;
			if (moved) {
				// il clic di fine trascinamento non deve chiudere il pannello del task
				const swallow = (ev: Event) => {
					ev.stopPropagation();
					ev.preventDefault();
				};
				window.addEventListener('click', swallow, { capture: true, once: true });
				setTimeout(() => window.removeEventListener('click', swallow, true), 0);
			}
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', up);
	}

	// ---- minimappa: si vede sempre tutto, col riquadro della vista attuale ---------------------
	const MW = 148;
	const MH = 104;
	let mmEl: SVGSVGElement;
	const mm = $derived.by(() => {
		const w = model.width + 2 * PAD;
		const h = model.height + 2 * PAD;
		const ms = Math.min(MW / w, MH / h);
		return { ms, ox: (MW - w * ms) / 2, oy: (MH - h * ms) / 2 };
	});
	const vp = $derived({ x: mm.ox + (sl / s) * mm.ms, y: mm.oy + (st / s) * mm.ms, w: (cw / s) * mm.ms, h: (ch / s) * mm.ms });
	const mmX = (n: GNode) => mm.ox + (n.x + PAD) * mm.ms;
	const mmY = (n: GNode) => mm.oy + (n.y + PAD) * mm.ms;

	function mmPoint(e: PointerEvent) {
		const r = mmEl.getBoundingClientRect();
		const kk = r.width / MW || 1;
		return { x: (e.clientX - r.left) / kk, y: (e.clientY - r.top) / kk };
	}
	function mmStart(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		const p0 = mmPoint(e);
		const inside = p0.x >= vp.x && p0.x <= vp.x + vp.w && p0.y >= vp.y && p0.y <= vp.y + vp.h;
		// se si afferra il riquadro lo si sposta restando dov'è stato preso; altrimenti la vista si centra sul punto
		const gx = inside ? p0.x - (vp.x + vp.w / 2) : 0;
		const gy = inside ? p0.y - (vp.y + vp.h / 2) : 0;
		const go = (m: PointerEvent) => {
			const p = mmPoint(m);
			const ux = (p.x - gx - mm.ox) / mm.ms;
			const uy = (p.y - gy - mm.oy) / mm.ms;
			scroller.scrollLeft = ux * s - scroller.clientWidth / 2;
			scroller.scrollTop = uy * s - scroller.clientHeight / 2;
		};
		go(e);
		const up = () => {
			window.removeEventListener('pointermove', go);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
		};
		window.addEventListener('pointermove', go);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', up);
	}

	// ---- avvio, cambio di vista, task selezionato ---------------------------------------------
	onMount(() => {
		cw = scroller.clientWidth;
		ch = scroller.clientHeight;
		const ro = new ResizeObserver(() => {
			cw = scroller.clientWidth;
			ch = scroller.clientHeight;
		});
		ro.observe(scroller);
		restore(true);
		return () => {
			remember();
			ro.disconnect();
		};
	});
	async function restore(first: boolean) {
		await tick();
		const v = savedViews.get(viewKey);
		if (v) {
			s = v.s;
			await tick();
			scroller.scrollLeft = v.l;
			scroller.scrollTop = v.t;
		} else await fit(first ? 0.55 : Z_MIN);
	}
	let lastKey = '';
	$effect(() => {
		const key = viewKey;
		if (lastKey && key !== lastKey && scroller) untrack(() => restore(false));
		lastKey = key;
	});

	// un task selezionato fuori dalla vista (tastiera, ricerca…) viene portato al centro
	$effect(() => {
		const id = ui.selectedTaskId;
		if (!id || !scroller) return;
		untrack(() => {
			const n = model.byTask.get(id);
			if (!n) return;
			const x0 = (n.x + PAD) * s;
			const y0 = (n.y + PAD) * s;
			const x1 = x0 + n.w * s;
			const y1 = y0 + n.h * s;
			const l = scroller.scrollLeft;
			const tp = scroller.scrollTop;
			const m = 24;
			if (x0 < l + m || x1 > l + scroller.clientWidth - m || y0 < tp + m || y1 > tp + scroller.clientHeight - m) {
				scroller.scrollTo({ left: (x0 + x1) / 2 - scroller.clientWidth / 2, top: (y0 + y1) / 2 - scroller.clientHeight / 2, behavior: 'smooth' });
			}
		});
	});
</script>

<div class="flex h-full min-w-0 flex-1 flex-col">
	<!-- barra di aggiunta: la stessa della Lista -->
	<div class="flex items-center gap-2 px-4 pt-4 pb-3">
		<div class="min-w-0 flex-1"><QuickInput onsubmit={add} placeholder={t('Aggiungi un task…   (!alta  @domani  #lista)')} /></div>
		<button class="btn h-10 shrink-0" title={t('Nuovo task da un modello')} onclick={() => (ui.templatesOpen = true)}><LayoutTemplate size={16} />{t('Modello')}</button>
		<button class="btn h-10 shrink-0" title={t('Nuovo gruppo')} onclick={() => (ui.groupEditor = 'new')}><FolderPlus size={16} />{t('Gruppo')}</button>
	</div>

	<div class="relative min-h-0 flex-1 border-t border-border">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={scroller}
			use:wheel
			class="graph-scroll absolute inset-0 overflow-auto {panning ? 'cursor-grabbing' : 'cursor-grab'}"
			data-scroll="xy"
			onscroll={onScroll}
			onpointerdown={panStart}
		>
			<div class="relative" style="width:{spW}px; height:{spH}px; background-image:radial-gradient(circle, color-mix(in srgb, var(--faint) 55%, transparent) 1px, transparent 1.4px); background-size:{28 * s}px {28 * s}px; background-position:{PAD * s}px {PAD * s}px">
				<div class="absolute origin-top-left" style="left:{PAD * s}px; top:{PAD * s}px; width:{model.width}px; height:{model.height}px; transform:scale({s})">
					<!-- connettori gruppo → figli -->
					<svg aria-hidden="true" class="pointer-events-none absolute top-0 left-0 overflow-visible" width={model.width} height={model.height}>
						{#each model.edges as e (e.key)}
							<path d={e.d} class="gx" fill="none" stroke-width="1.7" stroke-linecap="round" style="{paletteStyle(e.color)}; stroke:var(--gacc); opacity:0.85" />
						{/each}
					</svg>
					<!-- dipendenze, come nel Gantt -->
					<svg aria-hidden="true" class="pointer-events-none absolute top-0 left-0 overflow-visible" width={model.width} height={model.height}>
						<defs>
							<marker id="graph-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" style="fill:var(--muted)" /></marker>
							<marker id="graph-arrow-late" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" style="fill:var(--p3)" /></marker>
						</defs>
						{#each deps as d (d.key)}
							<path d={d.d} fill="none" stroke-width="1.4" stroke-dasharray="5 4" style="stroke:{d.late ? 'var(--p3)' : 'var(--muted)'}" marker-end="url(#{d.late ? 'graph-arrow-late' : 'graph-arrow'})" opacity="0.9" />
						{/each}
					</svg>

					{#each model.nodes as n (n.key)}
						<div class="gx gnode absolute" data-node style="{paletteStyle(n.color)}; left:{n.x}px; top:{n.y}px; width:{n.w}px; height:{n.h}px">
							{#if n.kind === 'group'}
								<GraphGroup node={n} ontoggle={() => toggleNode(n)} onaddtask={() => startAdding(n.id)} />
							{:else if n.kind === 'task' && n.task}
								<GraphTask
									task={n.task}
									num={n.num ?? 0}
									hasChildren={n.hasChildren}
									open={n.open}
									showList={scopeInfo.kind !== 'list'}
									dropMark={mark?.id === n.id ? mark.pos : null}
									ontoggleopen={() => (collapsedTasks.has(n.id) ? collapsedTasks.delete(n.id) : collapsedTasks.add(n.id))}
									onover={(e) => overTask(n, e)}
									onleave={() => (mark = null)}
									ondrop={(e) => dropTask(n, e)}
								/>
							{:else if n.kind === 'add'}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div class="flex h-full items-center" onkeydown={(e) => e.key === 'Escape' && (addingIn = null)}>
									<div class="w-full"><QuickInput compact autofocus placeholder={t('Nuovo task in «{name}»…', { name: groupName(n.id) })} onsubmit={(x) => addInGroup(n.id, x)} /></div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>

		{#if model.nodes.length === 0}
			<div class="pointer-events-none absolute inset-0 grid place-items-center">
				<div class="grid max-w-[380px] place-items-center gap-2 text-center text-muted">
					<Inbox size={36} strokeWidth={1.4} class="text-faint" />
					<p class="font-medium text-fg">{t('Niente da mostrare nel grafo')}</p>
					<p class="text-[12.5px]">{t('Scrivi un task nella barra qui sopra, oppure crea un gruppo.')}</p>
				</div>
			</div>
		{/if}

		<!-- comandi in alto a destra -->
		<div class="absolute top-3 right-4 z-30 flex items-center gap-1 rounded-lg border border-border bg-elev p-0.5 shadow-sm" data-ui>
			<button class="btn h-7 border-transparent bg-transparent" title={t('Mostra completati')} onclick={() => (showDone = !showDone)}>
				{#if showDone}<Eye size={14} />{:else}<EyeOff size={14} />{/if}{t('Completati')}
			</button>
			<span class="h-4 w-px bg-border"></span>
			<button class="icon-btn size-7" title={t('Comprimi tutto')} aria-label={t('Comprimi tutto')} onclick={collapseAll}><ChevronsDownUp size={15} /></button>
			<button class="icon-btn size-7" title={t('Espandi tutto')} aria-label={t('Espandi tutto')} onclick={expandAll}><ChevronsUpDown size={15} /></button>
		</div>

		<!-- minimappa e zoom, in basso a sinistra -->
		<div class="absolute bottom-3 left-3 z-30 flex flex-col gap-2" data-ui>
			<div class="flex items-stretch gap-2">
				<svg
					bind:this={mmEl}
					width={MW}
					height={MH}
					class="shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border bg-elev/90 shadow-sm backdrop-blur-sm"
					role="img"
					aria-label={t('Minimappa')}
					onpointerdown={mmStart}
				>
					{#each model.nodes as n (n.key)}
						{#if n.kind !== 'add'}
							<rect
								class="gx"
								x={mmX(n)}
								y={mmY(n)}
								width={Math.max(1.5, n.w * mm.ms)}
								height={Math.max(1.5, n.h * mm.ms)}
								rx="1"
								style="{paletteStyle(n.color)}; fill:var(--gacc); opacity:{n.kind === 'group' ? 0.95 : n.task?.completed ? 0.22 : 0.5}"
							/>
						{/if}
					{/each}
					<rect x={vp.x} y={vp.y} width={Math.max(4, vp.w)} height={Math.max(4, vp.h)} rx="2" fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke="var(--accent)" stroke-width="1.5" />
				</svg>
				<div class="flex flex-col justify-between rounded-lg border border-border bg-elev/90 p-0.5 shadow-sm backdrop-blur-sm">
					<button class="icon-btn size-6" title={t('Ingrandisci')} aria-label={t('Ingrandisci')} onclick={() => zoomBy(1.2)}><ChevronUp size={15} /></button>
					<button class="icon-btn size-6" title={t('Adatta alla finestra')} aria-label={t('Adatta alla finestra')} onclick={() => fit()}><Minus size={15} /></button>
					<button class="icon-btn size-6" title={t('Riduci')} aria-label={t('Riduci')} onclick={() => zoomBy(1 / 1.2)}><ChevronDown size={15} /></button>
				</div>
			</div>
			<label class="flex w-[190px] items-center gap-2 rounded-lg border border-border bg-elev/90 px-2.5 py-1.5 text-[12px] text-muted shadow-sm backdrop-blur-sm" title={t('Ctrl + rotella: zoom · trascina lo sfondo per spostarti')}>
				<span class="shrink-0">{t('Zoom')}</span>
				<input type="range" min={Z_MIN} max={Z_MAX} step="0.05" value={s} class="min-w-0 flex-1" oninput={(e) => setZoom(+e.currentTarget.value)} />
				<span class="w-9 shrink-0 text-right tabular-nums">{Math.round(s * 100)}%</span>
			</label>
		</div>

		{#if dragging}
			<div
				class="fixed bottom-6 left-1/2 z-40 grid h-11 w-[min(520px,70vw)] -translate-x-1/2 place-items-center rounded-xl border border-dashed bg-elev text-[12.5px] shadow-pop transition-colors {overRoot ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted'}"
				use:dropzone={{ accept: (p) => p?.type === 'group' || p?.type === 'task', over: () => (overRoot = true), leave: () => (overRoot = false), drop: dropRoot }}
			>{t('Sposta fuori dai gruppi (livello principale)')}</div>
		{/if}
	</div>
</div>

<style>
	/* Colori dei gruppi: `--gh` (tinta) e `--gl` (scarto di luminosità) arrivano da graph.ts; qui le due tonalità per tema chiaro e scuro. */
	:global(.gx) {
		--gfill: hsl(var(--gh) 56% calc(44% + var(--gl)));
		--gborder: hsl(var(--gh) 60% calc(34% + var(--gl)));
		--gacc: hsl(var(--gh) 58% calc(50% + var(--gl)));
	}
	:global(.dark .gx) {
		--gfill: hsl(var(--gh) 50% calc(33% + var(--gl)));
		--gborder: hsl(var(--gh) 72% calc(62% + var(--gl)));
		--gacc: hsl(var(--gh) 78% calc(70% + var(--gl)));
	}
	/* i nodi scivolano al nuovo posto quando il grafo si riorganizza */
	.gnode {
		transition: left 0.2s ease, top 0.2s ease;
	}
	input[type='range'] {
		accent-color: var(--accent);
	}
</style>
