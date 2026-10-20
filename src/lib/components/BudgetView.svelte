<script lang="ts">
	import { ChevronLeft, ChevronRight, Download, Eye, EyeOff } from '@lucide/svelte';
	import { t, locale } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { nav } from '../nav.svelte';
	import { showToast } from '../nav.svelte';
	import { inScope } from '../views';
	import { parseISO, formatDayShort, todayISO } from '../dates';
	import { buildBudget, periodsFrom, shiftPeriod, type Gran } from '../budget';
	import { addFigures, formatMoney, zeroFigures, type Figures } from '../money';
	import { exportBudgetCsv } from '../exportbudget';

	/** Budget: ricavi, costi e margine stimati per gruppo e per periodo (scadenza dei task). */
	const matched = $derived(store.tasks.filter((x) => inScope(x, nav.scope, store.filters, store.blockedIds)));

	const read = (k: string, def: string) => {
		try {
			return localStorage.getItem(k) ?? def;
		} catch {
			return def;
		}
	};
	const write = (k: string, v: string) => {
		try {
			localStorage.setItem(k, v);
		} catch {}
	};
	let gran = $state<Gran>(read('toodly.budgetGran', 'month') === 'week' ? 'week' : 'month');
	let metric = $state<'margin' | 'net' | 'cost'>((['margin', 'net', 'cost'] as const).find((m) => m === read('toodly.budgetMetric', 'margin')) ?? 'margin');
	let curSel = $state('EUR');
	let showDone = $state(true);
	let offset = $state(0);
	const COUNT = $derived(gran === 'month' ? 6 : 8);

	const setGran = (g: Gran) => { gran = g; offset = 0; write('toodly.budgetGran', g); };
	const setMetric = (m: 'margin' | 'net' | 'cost') => { metric = m; write('toodly.budgetMetric', m); };

	const periods = $derived(periodsFrom(shiftPeriod(todayISO(), gran, offset), gran, COUNT));

	const build = (currency: string) => buildBudget({ tasks: matched, groups: store.groups, listOf: (id) => store.listOf(id), periods, currency, showDone });
	const first = $derived(build(curSel));
	const cur = $derived(first.currencies.includes(curSel) ? curSel : (first.currencies[0] ?? 'EUR'));
	const model = $derived(cur === curSel ? first : build(cur));

	const fm = (c: number) => formatMoney(c, cur, locale());
	const pick = (f: Figures) => (metric === 'margin' ? f.margin : metric === 'net' ? f.net : f.cost);
	const label = (from: string) =>
		gran === 'month' ? new Intl.DateTimeFormat(locale(), { month: 'short', year: '2-digit' }).format(parseISO(from)) : formatDayShort(from);
	const visible = $derived(model.total.periods.reduce((a, f) => addFigures(a, f), zeroFigures()));
	const maxBar = $derived(Math.max(1, ...model.total.periods.map((f) => Math.max(f.net, f.cost))));
	const gname = (id: string | null) => (id ? (store.groupsById.get(id)?.name ?? '') : t('Senza gruppo'));
	const empty = $derived(model.currencies.length === 0);

	async function exportCsv() {
		const r = await exportBudgetCsv(matched.filter((x) => showDone || !x.completed));
		if (r === 'empty') showToast(t('Nessun importo da esportare'));
		else if (r) showToast(t('CSV salvato'));
	}

	const cards = $derived([
		{ k: 'net', label: t('Ricavi netti'), v: visible.net },
		{ k: 'vat', label: t('IVA'), v: visible.vat },
		{ k: 'gross', label: t('Ricavi lordi'), v: visible.gross },
		{ k: 'labor', label: t('Costo uomo'), v: visible.labor },
		{ k: 'expense', label: t('Spese'), v: visible.expense },
		{ k: 'margin', label: t('Margine'), v: visible.margin }
	]);
	const tone = (v: number) => (v < 0 ? 'color:var(--p3)' : '');
</script>

<div class="flex h-full min-w-0 flex-1 flex-col overflow-y-auto" data-scroll="y">
	<div class="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-4 pb-3 text-[12.5px]">
		<div class="flex rounded-lg bg-hover p-0.5">
			{#each [['month', 'Mese'], ['week', 'Settimana']] as [id, lab]}
				<button class="h-7 rounded-md px-2.5 font-medium {gran === id ? 'bg-panel shadow-sm' : 'text-muted hover:text-fg'}" onclick={() => setGran(id as Gran)}>{t(lab)}</button>
			{/each}
		</div>
		<div class="flex items-center gap-1">
			<button class="icon-btn size-7" aria-label={t('Precedente')} onclick={() => (offset -= 1)}><ChevronLeft size={15} /></button>
			<button class="btn h-7" disabled={offset === 0} onclick={() => (offset = 0)}>{t('Oggi')}</button>
			<button class="icon-btn size-7" aria-label={t('Successivo')} onclick={() => (offset += 1)}><ChevronRight size={15} /></button>
		</div>
		<div class="flex rounded-lg bg-hover p-0.5">
			{#each [['margin', 'Margine'], ['net', 'Ricavi'], ['cost', 'Costi']] as [id, lab]}
				<button class="h-7 rounded-md px-2.5 font-medium {metric === id ? 'bg-panel shadow-sm' : 'text-muted hover:text-fg'}" onclick={() => setMetric(id as 'margin' | 'net' | 'cost')}>{t(lab)}</button>
			{/each}
		</div>
		{#if model.currencies.length > 1}
			<div class="flex rounded-lg bg-hover p-0.5">
				{#each model.currencies as c}
					<button class="h-7 rounded-md px-2.5 font-medium {cur === c ? 'bg-panel shadow-sm' : 'text-muted hover:text-fg'}" onclick={() => (curSel = c)}>{c}</button>
				{/each}
			</div>
		{/if}
		<button class="btn h-7" title={showDone ? t('Nascondi completati') : t('Mostra completati')} onclick={() => (showDone = !showDone)}>
			{#if showDone}<Eye size={14} />{:else}<EyeOff size={14} />{/if}{t('Completati')}
		</button>
		<button class="btn ml-auto h-7" title={t('Esporta in CSV')} onclick={exportCsv}><Download size={14} />CSV</button>
	</div>

	{#if empty}
		<div class="mx-4 rounded-xl border border-dashed border-border px-6 py-12 text-center text-[13px] text-muted">
			{t('Nessun importo in questa vista. Imposta tariffa, spese o ricavi nel pannello del task (sezione Economia).')}
		</div>
	{:else}
		<div class="grid shrink-0 grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-3 lg:grid-cols-6">
			{#each cards as c (c.k)}
				<div class="rounded-xl border border-border bg-panel px-3 py-2">
					<div class="text-[11px] tracking-wide text-muted uppercase">{c.label}</div>
					<div class="text-[15px] font-semibold tabular-nums" style={c.k === 'margin' ? tone(c.v) : ''}>{fm(c.v)}</div>
				</div>
			{/each}
		</div>
		<div class="px-4 pb-1 text-[11.5px] text-faint">{t('Periodo visibile')}: {label(model.periods[0].from)} – {label(model.periods[model.periods.length - 1].from)}</div>

		<div class="shrink-0 px-4 pb-3">
			<div class="mb-1 flex items-center gap-4 text-[11.5px] text-muted">
				<span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm" style="background:var(--ok,#22a06b)"></span>{t('Ricavi netti')}</span>
				<span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm" style="background:var(--p3)"></span>{t('Costi')}</span>
			</div>
			<div class="grid items-end gap-2" style="grid-template-columns:repeat({model.periods.length},minmax(0,1fr))">
				{#each model.periods as p, i (p.key)}
					{@const f = model.total.periods[i]}
					<div class="flex flex-col items-center gap-1" title={`${label(p.from)}\n${t('Ricavi netti')} ${fm(f.net)}\n${t('Costi')} ${fm(f.cost)}\n${t('Margine')} ${fm(f.margin)}`}>
						<div class="flex h-24 w-full items-end justify-center gap-1">
							<div class="w-1/3 rounded-t" style="height:{Math.round((f.net / maxBar) * 100)}%;background:var(--ok,#22a06b);min-height:{f.net ? 2 : 0}px"></div>
							<div class="w-1/3 rounded-t" style="height:{Math.round((f.cost / maxBar) * 100)}%;background:var(--p3);min-height:{f.cost ? 2 : 0}px"></div>
						</div>
						<div class="text-[11px] text-muted">{label(p.from)}</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="px-4 pb-6">
			<div class="overflow-x-auto rounded-xl border border-border">
				<table class="w-full min-w-[640px] border-collapse text-[12.5px]">
					<thead>
						<tr class="bg-hover text-left text-[11.5px] text-muted">
							<th class="px-3 py-2 font-semibold">{t('Gruppo')}</th>
							{#each model.periods as p (p.key)}<th class="px-2 py-2 text-right font-semibold whitespace-nowrap">{label(p.from)}</th>{/each}
							<th class="px-2 py-2 text-right font-semibold whitespace-nowrap">{t('Fuori periodo')}</th>
							<th class="px-2 py-2 text-right font-semibold whitespace-nowrap">{t('Senza data')}</th>
							<th class="px-3 py-2 text-right font-semibold">{t('Totale')}</th>
						</tr>
					</thead>
					<tbody>
						{#each model.rows as r (r.id ?? 'none')}
							<tr class="border-t border-border">
								<td class="px-3 py-1.5 whitespace-nowrap" style="padding-left:{12 + r.depth * 18}px"><span class={r.depth === 0 ? 'font-semibold' : ''}>{gname(r.id)}</span></td>
								{#each r.cells.periods as f, i (i)}
									<td class="px-2 py-1.5 text-right tabular-nums" style={metric === 'margin' ? tone(f.margin) : ''}>{pick(f) ? fm(pick(f)) : '–'}</td>
								{/each}
								<td class="px-2 py-1.5 text-right tabular-nums text-muted" style={metric === 'margin' ? tone(r.cells.outside.margin) : ''}>{pick(r.cells.outside) ? fm(pick(r.cells.outside)) : '–'}</td>
								<td class="px-2 py-1.5 text-right tabular-nums text-muted" style={metric === 'margin' ? tone(r.cells.undated.margin) : ''}>{pick(r.cells.undated) ? fm(pick(r.cells.undated)) : '–'}</td>
								<td class="px-3 py-1.5 text-right font-semibold tabular-nums" style={metric === 'margin' ? tone(r.cells.total.margin) : ''}>{fm(pick(r.cells.total))}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="border-t-2 border-border bg-hover font-semibold">
							<td class="px-3 py-2">{t('Totale')}</td>
							{#each model.total.periods as f, i (i)}
								<td class="px-2 py-2 text-right tabular-nums" style={metric === 'margin' ? tone(f.margin) : ''}>{pick(f) ? fm(pick(f)) : '–'}</td>
							{/each}
							<td class="px-2 py-2 text-right tabular-nums">{pick(model.total.outside) ? fm(pick(model.total.outside)) : '–'}</td>
							<td class="px-2 py-2 text-right tabular-nums">{pick(model.total.undated) ? fm(pick(model.total.undated)) : '–'}</td>
							<td class="px-3 py-2 text-right tabular-nums" style={metric === 'margin' ? tone(model.total.total.margin) : ''}>{fm(pick(model.total.total))}</td>
						</tr>
					</tfoot>
				</table>
			</div>
			<p class="mt-2 text-[11.5px] text-faint">{t('Importi stimati, attribuiti alla scadenza del task. Spese e ricavi sono al netto di IVA; il margine è ricavo netto meno costo uomo e spese.')}</p>
		</div>
	{/if}
</div>
