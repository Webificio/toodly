<script lang="ts" module>
	/** Posizione e zoom ricordati per (vista, set) finché l'app è aperta. */
	const savedViews = new Map<string, { s: number; l: number; t: number }>();
</script>

<script lang="ts">
	import { onMount, tick, untrack, type Snippet } from 'svelte';
	import { ChevronDown, ChevronUp, Inbox, Minus } from '@lucide/svelte';
	import { fitScale } from '../graph';
	import { t } from '../i18n.svelte';
	import { ui } from '../nav.svelte';

	/**
	 * Tela comune a Orbit e Metro: area scorrevole con zoom (Ctrl + rotella, cursori), spostamento trascinando lo sfondo,
	 * minimappa e ricentratura sul task selezionato. Il contenuto è disegnato in coordinate «del modello» dentro `children`.
	 */
	let {
		width,
		height,
		viewKey,
		focus = null,
		dots = [],
		empty = false,
		emptyTitle = '',
		emptyHint = '',
		fitMin = 0.4,
		tools,
		children
	}: {
		width: number;
		height: number;
		viewKey: string;
		/** punto del task selezionato (coordinate del modello) */
		focus?: { id: string; x: number; y: number } | null;
		dots?: { x: number; y: number; c: string; o: number }[];
		empty?: boolean;
		emptyTitle?: string;
		emptyHint?: string;
		fitMin?: number;
		tools?: Snippet;
		children: Snippet<[{ s: number }]>;
	} = $props();

	const PAD = 60;
	const Z_MIN = 0.2;
	const Z_MAX = 2;
	let scroller: HTMLDivElement;
	let s = $state(1);
	let sl = $state(0);
	let st = $state(0);
	let cw = $state(800);
	let ch = $state(600);
	let panning = $state(false);

	const spW = $derived((width + 2 * PAD) * s);
	const spH = $derived((height + 2 * PAD) * s);
	const k = () => (scroller && scroller.offsetWidth ? scroller.getBoundingClientRect().width / scroller.offsetWidth : 1);

	function remember() {
		if (scroller) savedViews.set(viewKey, { s, l: scroller.scrollLeft, t: scroller.scrollTop });
	}
	function onScroll() {
		sl = scroller.scrollLeft;
		st = scroller.scrollTop;
		remember();
	}
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
	async function fit(min = Z_MIN) {
		s = fitScale(width + 2 * PAD, height + 2 * PAD, scroller.clientWidth, scroller.clientHeight, min, 1);
		await tick();
		scroller.scrollLeft = Math.max(0, (spW - scroller.clientWidth) / 2);
		scroller.scrollTop = Math.max(0, (spH - scroller.clientHeight) / 2);
		remember();
	}
	function wheel(node: HTMLElement) {
		const h = (e: WheelEvent) => {
			if (!(e.ctrlKey || e.metaKey)) return;
			e.preventDefault();
			setZoom(s * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
		};
		node.addEventListener('wheel', h, { passive: false });
		return { destroy: () => node.removeEventListener('wheel', h) };
	}
	function panStart(e: PointerEvent) {
		if ((e.button !== 0 && e.button !== 1) || (e.target as HTMLElement).closest('[data-node], [data-ui], button, input, a')) return;
		e.preventDefault();
		const x0 = e.clientX, y0 = e.clientY, l0 = scroller.scrollLeft, t0 = scroller.scrollTop, kk = k();
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

	// minimappa
	const MW = 148;
	const MH = 104;
	let mmEl: SVGSVGElement;
	const mm = $derived.by(() => {
		const w = width + 2 * PAD;
		const h = height + 2 * PAD;
		const ms = Math.min(MW / w, MH / h);
		return { ms, ox: (MW - w * ms) / 2, oy: (MH - h * ms) / 2 };
	});
	const vp = $derived({ x: mm.ox + (sl / s) * mm.ms, y: mm.oy + (st / s) * mm.ms, w: (cw / s) * mm.ms, h: (ch / s) * mm.ms });
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
		const gx = inside ? p0.x - (vp.x + vp.w / 2) : 0;
		const gy = inside ? p0.y - (vp.y + vp.h / 2) : 0;
		const go = (m: PointerEvent) => {
			const p = mmPoint(m);
			scroller.scrollLeft = ((p.x - gx - mm.ox) / mm.ms) * s - scroller.clientWidth / 2;
			scroller.scrollTop = ((p.y - gy - mm.oy) / mm.ms) * s - scroller.clientHeight / 2;
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
		} else await fit(first ? fitMin : Z_MIN);
	}
	let lastKey = '';
	$effect(() => {
		const key = viewKey;
		if (lastKey && key !== lastKey && scroller) untrack(() => restore(false));
		lastKey = key;
	});
	// un task selezionato fuori dalla vista viene portato al centro
	$effect(() => {
		const f = focus;
		void ui.selectedTaskId;
		if (!f || !scroller) return;
		untrack(() => {
			const x = (f.x + PAD) * s;
			const y = (f.y + PAD) * s;
			const l = scroller.scrollLeft, tp = scroller.scrollTop, m = 50;
			if (x < l + m || x > l + scroller.clientWidth - m || y < tp + m || y > tp + scroller.clientHeight - m) scroller.scrollTo({ left: x - scroller.clientWidth / 2, top: y - scroller.clientHeight / 2, behavior: 'smooth' });
		});
	});
</script>

<div class="relative min-h-0 flex-1 border-t border-border">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div bind:this={scroller} use:wheel class="graph-scroll absolute inset-0 overflow-auto {panning ? 'cursor-grabbing' : 'cursor-grab'}" data-scroll="xy" onscroll={onScroll} onpointerdown={panStart}>
		<div class="relative" style="width:{spW}px; height:{spH}px">
			<div class="absolute origin-top-left" style="left:{PAD * s}px; top:{PAD * s}px; width:{width}px; height:{height}px; transform:scale({s})">
				{@render children({ s })}
			</div>
		</div>
	</div>

	{#if empty}
		<div class="pointer-events-none absolute inset-0 grid place-items-center">
			<div class="grid max-w-[380px] place-items-center gap-2 text-center text-muted">
				<Inbox size={36} strokeWidth={1.4} class="text-faint" />
				<p class="font-medium text-fg">{emptyTitle}</p>
				<p class="text-[12.5px]">{emptyHint}</p>
			</div>
		</div>
	{/if}

	{#if tools}
		<div class="absolute top-3 right-4 z-30 flex items-center gap-1 rounded-lg border border-border bg-elev p-0.5 shadow-sm" data-ui>{@render tools()}</div>
	{/if}

	<div class="absolute bottom-3 left-3 z-30 flex flex-col gap-2" data-ui>
		<div class="flex items-stretch gap-2">
			<svg bind:this={mmEl} width={MW} height={MH} class="shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border bg-elev/90 shadow-sm backdrop-blur-sm" role="img" aria-label={t('Minimappa')} onpointerdown={mmStart}>
				{#each dots as d, i (i)}
					<circle cx={mm.ox + (d.x + PAD) * mm.ms} cy={mm.oy + (d.y + PAD) * mm.ms} r="1.8" style="fill:{d.c}; opacity:{d.o}" />
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
</div>

<style>
	input[type='range'] {
		accent-color: var(--accent);
	}
</style>
