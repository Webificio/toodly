<script lang="ts">
	import Modal from './Modal.svelte';
	import { ui } from '../nav.svelte';
	import { t } from '../i18n.svelte';
	import { locale } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { addDays, diffDays, parseISO, startOfWeek, todayISO, toISO } from '../dates';

	let open = $state(false);
	$effect(() => {
		open = ui.statsOpen;
	});
	$effect(() => {
		if (!open) ui.statsOpen = false;
	});

	let asTable = $state(false);
	let hover = $state<number | null>(null);

	const WEEKS = 8;
	const today = $derived(todayISO());

	/** giorno locale (YYYY-MM-DD) di un timestamp ISO */
	const dayOf = (iso: string) => toISO(new Date(iso));

	const stats = $derived.by(() => {
		const tasks = store.tasks;
		const open = tasks.filter((x) => !x.completed);
		const done = tasks.filter((x) => x.completed && x.completed_at);
		const overdue = open.filter((x) => x.due_date && x.due_date < today);
		const d7 = addDays(today, -6);
		const d30 = addDays(today, -29);
		const doneDays = done.map((x) => ({ x, day: dayOf(x.completed_at!) }));
		const last7 = doneDays.filter((d) => d.day >= d7).length;
		const last30 = doneDays.filter((d) => d.day >= d30);
		// tempo medio tra creazione e completamento, sui completati degli ultimi 30 giorni
		const spans = last30.map((d) => Math.max(0, (new Date(d.x.completed_at!).getTime() - new Date(d.x.created_at).getTime()) / 86400000));
		const avg = spans.length ? spans.reduce((a, b) => a + b, 0) / spans.length : null;

		const thisWeek = startOfWeek(today);
		const weeks = Array.from({ length: WEEKS }, (_, i) => {
			const start = addDays(thisWeek, -7 * (WEEKS - 1 - i));
			const end = addDays(start, 6);
			return { start, end, n: doneDays.filter((d) => d.day >= start && d.day <= end).length, current: i === WEEKS - 1 };
		});

		// aperti per lista (le liste più cariche)
		const byList = store.listsSorted
			.map((l) => ({ id: l.id, name: l.name, color: l.color, n: open.filter((x) => x.list_id === l.id).length }))
			.filter((l) => l.n > 0)
			.sort((a, b) => b.n - a.n)
			.slice(0, 6);
		return { open: open.length, overdue: overdue.length, last7, last30: last30.length, avg, weeks, byList, total: tasks.length };
	});

	// ---- grafico a barre settimanale -------------------------------------------------
	const W = 520;
	const H = 176;
	const PAD = { l: 30, r: 8, t: 12, b: 26 };
	const niceMax = $derived.by(() => {
		const m = Math.max(1, ...stats.weeks.map((w) => w.n));
		const step = m <= 5 ? 1 : m <= 10 ? 2 : m <= 25 ? 5 : m <= 50 ? 10 : 20;
		return Math.ceil(m / step) * step;
	});
	const ticks = $derived([0, 0.5, 1].map((f) => Math.round(niceMax * f)));
	const innerH = H - PAD.t - PAD.b;
	const slot = (W - PAD.l - PAD.r) / WEEKS;
	const barW = 26;
	const yOf = (n: number) => PAD.t + innerH - (n / niceMax) * innerH;

	const fmtShort = $derived(new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }));
	const range = (w: { start: string; end: string }) => `${fmtShort.format(parseISO(w.start))} – ${fmtShort.format(parseISO(w.end))}`;
	const fmtAvg = (d: number) => (d < 1 ? t('meno di 1 giorno') : t('{n} giorni', { n: d.toFixed(1).replace(/\.0$/, '') }));
	const maxList = $derived(Math.max(1, ...stats.byList.map((l) => l.n)));
</script>

<Modal bind:open title={t('Statistiche')} width={580}>
	<div class="space-y-5 text-[13px]">
		<!-- numeri chiave -->
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
			{#each [
				{ label: t('Completati (7 giorni)'), value: String(stats.last7), tone: '' },
				{ label: t('Completati (30 giorni)'), value: String(stats.last30), tone: '' },
				{ label: t('Aperti'), value: String(stats.open), tone: '' },
				{ label: t('In ritardo'), value: String(stats.overdue), tone: stats.overdue ? 'late' : '' }
			] as tile}
				<div class="rounded-xl border border-border bg-panel px-3 py-2.5">
					<div class="text-[11.5px] text-muted">{tile.label}</div>
					<div class="mt-0.5 text-[24px] leading-none font-semibold tabular-nums {tile.tone === 'late' ? 'text-p3' : ''}">{tile.value}</div>
				</div>
			{/each}
		</div>
		<p class="text-[12.5px] text-muted">
			{#if stats.avg !== null}{t('Tempo medio tra creazione e completamento (ultimi 30 giorni)')}: <strong class="text-fg">{fmtAvg(stats.avg)}</strong>{:else}{t('Completa qualche task per vedere il tempo medio di chiusura.')}{/if}
		</p>

		<!-- completati per settimana -->
		<section>
			<div class="mb-1.5 flex items-center gap-2">
				<h4 class="text-[11.5px] font-semibold tracking-wider text-muted uppercase">{t('Completati per settimana')}</h4>
				<button class="ml-auto text-[12px] text-accent hover:underline" onclick={() => (asTable = !asTable)}>{asTable ? t('Mostra grafico') : t('Mostra tabella')}</button>
			</div>
			{#if asTable}
				<table class="w-full text-left text-[12.5px]">
					<thead class="text-muted"><tr><th class="py-1 font-medium">{t('Settimana')}</th><th class="py-1 text-right font-medium">{t('Completati')}</th></tr></thead>
					<tbody>
						{#each stats.weeks as w}
							<tr class="border-t border-border"><td class="py-1">{range(w)}{w.current ? ' · ' + t('in corso') : ''}</td><td class="py-1 text-right tabular-nums">{w.n}</td></tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<div class="relative">
					<svg viewBox="0 0 {W} {H}" class="block w-full" role="img" aria-label={t('Completati per settimana')}>
						{#each ticks as tk}
							<line x1={PAD.l} x2={W - PAD.r} y1={yOf(tk)} y2={yOf(tk)} style="stroke:var(--border)" stroke-width="1" />
							<text x={PAD.l - 6} y={yOf(tk) + 3.5} text-anchor="end" font-size="10.5" style="fill:var(--muted)">{tk}</text>
						{/each}
						{#each stats.weeks as w, i}
							{@const cx = PAD.l + slot * i + slot / 2}
							{@const y = yOf(w.n)}
							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
							<g
								tabindex="0"
								role="img"
								aria-label="{range(w)}: {w.n}"
								class="outline-none"
								onpointerenter={() => (hover = i)}
								onpointerleave={() => (hover = null)}
								onfocus={() => (hover = i)}
								onblur={() => (hover = null)}
							>
								<rect x={cx - slot / 2} y={PAD.t} width={slot} height={innerH} fill="transparent" />
								{#if w.n > 0}
									<path
										d="M{cx - barW / 2},{PAD.t + innerH} V{y + 4} a4,4 0 0 1 4,-4 H{cx + barW / 2 - 4} a4,4 0 0 1 4,4 V{PAD.t + innerH} Z"
										style="fill:var(--accent)"
										opacity={hover === null || hover === i ? (w.current ? 0.65 : 1) : 0.45}
									/>
								{:else}
									<rect x={cx - barW / 2} y={PAD.t + innerH - 1.5} width={barW} height="1.5" style="fill:var(--border)" />
								{/if}
								<text x={cx} y={H - 8} text-anchor="middle" font-size="10.5" style="fill:var(--muted)">{fmtShort.format(parseISO(w.start))}</text>
							</g>
						{/each}
					</svg>
					{#if hover !== null}
						{@const w = stats.weeks[hover]}
						<div
							class="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-border bg-elev px-2.5 py-1.5 text-[12px] shadow-pop"
							style="left:{((PAD.l + slot * hover + slot / 2) / W) * 100}%; top:0"
						>
							<div class="text-muted">{range(w)}{w.current ? ' · ' + t('in corso') : ''}</div>
							<div class="font-semibold tabular-nums">{w.n} {t('completati')}</div>
						</div>
					{/if}
				</div>
				<p class="mt-1 text-[11.5px] text-faint">{t('La barra più chiara è la settimana in corso.')}</p>
			{/if}
		</section>

		<!-- aperti per lista -->
		{#if stats.byList.length}
			<section>
				<h4 class="mb-1.5 text-[11.5px] font-semibold tracking-wider text-muted uppercase">{t('Task aperti per lista')}</h4>
				<div class="space-y-1.5">
					{#each stats.byList as l (l.id)}
						<div class="flex items-center gap-2.5">
							<span class="size-2.5 shrink-0 rounded-full" style="background:{l.color}"></span>
							<span class="w-32 shrink-0 truncate">{l.name}</span>
							<div class="h-2 flex-1 overflow-hidden rounded-full bg-hover"><div class="h-full rounded-full" style="width:{(l.n / maxList) * 100}%; background:{l.color}"></div></div>
							<span class="w-8 shrink-0 text-right tabular-nums">{l.n}</span>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<p class="text-[11.5px] text-faint">{t('Le statistiche riguardano il set di dati di questa finestra ({n} task).', { n: stats.total })}</p>
	</div>
</Modal>
