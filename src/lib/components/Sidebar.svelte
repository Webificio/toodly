<script lang="ts">
	import { Sun, CalendarRange, Flag, Layers, Plus, Settings, AppWindow, Filter as FilterIcon, FilterX, FileDown, Pencil, ListPlus, ChartColumn, Hash } from '@lucide/svelte';
	import { t } from '../i18n.svelte';
	import MoneyChip from './MoneyChip.svelte';
	import { ecoShow, sumOf } from '../economy.svelte';
	import { store } from '../store.svelte';
	import { nav, go, ui, showToast } from '../nav.svelte';
	import { exportListMd } from '../exportmd';
	import { inScope } from '../views';
	import { openWindow } from '../windowing';
	import { dropzone } from '../dnd.svelte';
	import { panel } from '../layoutui.svelte';

	const smart = [
		{ id: 'today', label: 'Oggi', icon: Sun },
		{ id: 'next7', label: 'Prossimi 7 giorni', icon: CalendarRange },
		{ id: 'important', label: 'Importanti', icon: Flag },
		{ id: 'all', label: 'Tutti i task', icon: Layers }
	];

	const counts = $derived.by(() => {
		const open = store.tasks.filter((t) => !t.completed);
		const c: Record<string, number> = {};
		for (const s of smart) c[s.id] = open.filter((t) => inScope(t, s.id, store.filters, store.blockedIds)).length;
		for (const l of store.lists) c['list:' + l.id] = open.filter((t) => t.list_id === l.id).length;
		for (const [g, n] of store.tagList) c['tag:' + g] = n;
		for (const f of store.filters) c['filter:' + f.id] = open.filter((t) => inScope(t, 'filter:' + f.id, store.filters, store.blockedIds)).length;
		return c;
	});
	/** margine per lista (solo con Economia attiva e la barra laterale abilitata) */
	const listMoney = $derived.by(() => {
		const out: Record<string, ReturnType<typeof sumOf>> = {};
		if (!ecoShow('sidebar')) return out;
		for (const l of store.lists) out['list:' + l.id] = sumOf(store.tasks.filter((x) => x.list_id === l.id));
		return out;
	});
	async function exportList(id: string) {
		try {
			const dest = await exportListMd(id);
			if (dest) showToast(t('Lista esportata in Markdown'));
		} catch (e) {
			console.error(e);
			showToast(t('Esportazione non riuscita'));
		}
	}
	let overList = $state<string | null>(null);
	const filterActive = $derived(nav.scope.startsWith('filter:'));
</script>

{#snippet item(id: string, label: string, color: string | null, Icon: typeof Sun | null, edit?: () => void, raw?: boolean, exp?: () => void)}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="group relative flex h-8 items-center rounded-lg transition-colors {nav.scope === id ? 'bg-active font-semibold' : 'hover:bg-hover'} {overList === id ? 'ring-2 ring-accent' : ''}"
		use:dropzone={{
			accept: (p) => p?.type === 'task' && id.startsWith('list:'),
			over: () => (overList = id),
			leave: () => (overList = null),
			drop: (e) => { overList = null; store.moveToList(e.payload.id, id.slice(5)); }
		}}
	>
		<button class="flex h-full min-w-0 flex-1 items-center gap-2.5 px-2.5 text-left" onclick={() => go({ scope: id })}>
			{#if Icon}<Icon size={16} class={nav.scope === id ? 'text-accent' : 'text-muted'} />
			{:else if color}<span class="mx-[3px] size-[10px] shrink-0 rounded-full" style="background:{color}"></span>{/if}
			<span class="truncate">{raw ? label : t(label)}</span>
		</button>
		{#if exp}
			<button class="icon-btn mr-0.5 size-6 opacity-0 group-hover:opacity-100" title={t('Esporta in .md')} aria-label={t('Esporta in .md')} onclick={exp}><FileDown size={12} /></button>
		{/if}
		{#if edit}
			<button class="icon-btn mr-0.5 size-6 opacity-0 group-hover:opacity-100" aria-label={t('Modifica')} onclick={edit}><Pencil size={12} /></button>
		{/if}
		{#if listMoney[id]}<MoneyChip money={listMoney[id]} class="mr-1.5" />{/if}
		<span class="mr-2.5 text-[11.5px] text-muted tabular-nums">{counts[id] || ''}</span>
	</div>
{/snippet}

<nav class="flex h-full shrink-0 flex-col bg-sidebar select-none" style="width:{panel.sidebar}px">
	<div class="flex items-center gap-2 px-4 pt-4 pb-3">
		<img src="/logo.png" alt="" class="size-7 object-contain" draggable="false" />
		<span class="text-[20px] leading-none" style="font-family: 'Quicksand', var(--font-sans); font-weight: 700">toodly</span>
	</div>

	<div class="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3" data-scroll="y">
		{#each smart as s (s.id)}
			{@render item(s.id, s.label, null, s.icon)}
		{/each}

		<div class="flex items-center px-2.5 pt-5 pb-1 text-[11px] font-semibold tracking-wider text-faint uppercase">
			{t('Liste')}
			<button class="icon-btn ml-auto size-6" aria-label={t('Nuova lista')} onclick={() => (ui.listEditor = 'new')}><Plus size={14} /></button>
		</div>
		{#each store.listsSorted as l (l.id)}
			{@render item('list:' + l.id, l.name, l.color, null, () => (ui.listEditor = l.id), true, () => exportList(l.id))}
		{:else}
			<p class="px-2.5 py-1 text-[12px] text-faint">{t('Nessuna lista')}</p>
		{/each}

		{#if store.tagList.length}
			<div class="flex items-center px-2.5 pt-5 pb-1 text-[11px] font-semibold tracking-wider text-faint uppercase">{t('Etichette')}</div>
			{#each store.tagList as [g] (g)}
				{@render item('tag:' + g, g, null, Hash, undefined, true)}
			{/each}
		{/if}

		<div class="flex items-center px-2.5 pt-5 pb-1 text-[11px] font-semibold tracking-wider text-faint uppercase">
			{t('Filtri')}
			<button class="icon-btn ml-auto size-6" aria-label={t('Nuovo filtro')} onclick={() => (ui.filterEditor = 'new')}><Plus size={14} /></button>
		</div>
		<!-- sempre presente: toglie il filtro attivo e torna a «Tutti i task» -->
		<button
			class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-colors {filterActive ? 'hover:bg-hover' : 'cursor-default text-faint'}"
			disabled={!filterActive}
			onclick={() => go({ scope: 'all' })}
		>
			<FilterX size={16} class={filterActive ? 'text-muted' : 'text-faint'} />
			<span class="truncate">{t('Nessun filtro')}</span>
		</button>
		{#each store.filtersSorted as f (f.id)}
			{@render item('filter:' + f.id, f.name, null, FilterIcon, () => (ui.filterEditor = f.id), true)}
		{/each}
	</div>

	<div class="flex items-center gap-1 border-t border-border p-2">
		<button class="btn btn-ghost flex-1 justify-start" onclick={() => openWindow()} title={t('Apri una nuova finestra (Ctrl+N)')}>
			<AppWindow size={15} /> {t('Nuova finestra')}
		</button>
		<button class="icon-btn" aria-label={t('Aggiungi più task da testo')} title={t('Aggiungi più task da testo') + ' (Ctrl+Shift+I)'} onclick={() => (ui.bulkOpen = true)}><ListPlus size={16} /></button>
		<button class="icon-btn" aria-label={t('Statistiche')} title={t('Statistiche')} onclick={() => (ui.statsOpen = true)}><ChartColumn size={16} /></button>
		<button class="icon-btn" aria-label={t('Impostazioni')} onclick={() => (ui.settingsOpen = true)}><Settings size={16} /></button>
	</div>
</nav>
