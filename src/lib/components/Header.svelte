<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { List as ListIcon, Columns3, CalendarDays, ChartGantt, Network, ArrowUpDown, ChevronLeft, ChevronRight, Check, Undo2, Redo2, CircleAlert, LoaderCircle, Search } from '@lucide/svelte';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { nav, go, ui } from '../nav.svelte';
	import { parseScope } from '../views';
	import { addDays, addMonths, formatDayShort, formatMonth, startOfWeek, todayISO } from '../dates';

	const modes = [
		{ id: 'list', label: 'Lista', icon: ListIcon },
		{ id: 'kanban', label: 'Kanban', icon: Columns3 },
		{ id: 'calendar', label: 'Calendario', icon: CalendarDays },
		{ id: 'gantt', label: 'Gantt', icon: ChartGantt },
		{ id: 'graph', label: 'Graph', icon: Network }
	] as const;
	const sorts = [
		{ id: 'manual', label: 'Manuale (trascina)', short: 'Manuale' },
		{ id: 'priority', label: 'Priorità', short: 'Priorità' },
		{ id: 'due', label: 'Data di scadenza', short: 'Data di scadenza' }
	] as const;

	const SMART: Record<string, string> = { today: 'Oggi', next7: 'Prossimi 7 giorni', important: 'Importanti', all: 'Tutti i task', inbox: 'Inbox' };
	const title = $derived.by(() => {
		const s = parseScope(nav.scope);
		if (s.kind === 'list') return store.listOf(s.id)?.name ?? t('Lista');
		if (s.kind === 'tag') return '#' + s.id;
		if (s.kind === 'filter') return store.filters.find((f) => f.id === s.id)?.name ?? t('Filtro');
		return t(SMART[s.id] ?? 'toodly');
	});

	// indicatore di salvataggio: «Salvataggio…» durante le scritture, «Salvato» per un attimo, errore finché non si risolve
	let justSaved = $state(false);
	$effect(() => {
		const at = store.savedAt;
		if (!at) return;
		justSaved = true;
		const id = setTimeout(() => (justSaved = false), 2200);
		return () => clearTimeout(id);
	});

	const rangeLabel = $derived.by(() => {
		if (nav.cal === 'month') return formatMonth(nav.date);
		const a = startOfWeek(nav.date);
		return `${formatDayShort(a)} – ${formatDayShort(addDays(a, 6))}`;
	});
	function step(dir: 1 | -1) {
		go({ d: nav.cal === 'month' ? addMonths(nav.date, dir) : addDays(nav.date, 7 * dir) });
	}
</script>

<header class="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
	<h1 class="truncate text-[17px] font-semibold tracking-tight">{title}</h1>

	<div class="relative ml-3 flex rounded-lg bg-hover p-0.5">
		{#each modes as m (m.id)}
			<button
				class="relative z-10 flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-all duration-150 {nav.mode === m.id ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}"
				onclick={() => go({ mode: m.id })}
			>
				<m.icon size={14} />{t(m.label)}
			</button>
		{/each}
	</div>

	<div class="ml-auto flex items-center gap-2">
		{#if nav.mode === 'list'}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger class="btn"><ArrowUpDown size={14} />{t('Ordina')}: {t(sorts.find((s) => s.id === nav.sort)?.short ?? 'Manuale').split(' ')[0]}</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content class="menu" align="end" sideOffset={6}>
						{#each sorts as s (s.id)}
							<DropdownMenu.Item class="menu-item" onSelect={() => go({ sort: s.id === 'manual' ? null : s.id })}>
								<span class="flex-1">{t(s.label)}</span>{#if nav.sort === s.id}<Check size={14} />{/if}
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		{:else if nav.mode === 'kanban'}
			<div class="flex rounded-lg bg-hover p-0.5">
				{#each [['status', 'Per stato'], ['priority', 'Per priorità']] as [id, label]}
					<button class="h-7 rounded-md px-2.5 text-[12.5px] font-medium {nav.group === id ? 'bg-panel shadow-sm' : 'text-muted hover:text-fg'}" onclick={() => go({ group: id === 'status' ? null : id })}>{t(label)}</button>
				{/each}
			</div>
		{:else if nav.mode === 'calendar'}
			<div class="flex rounded-lg bg-hover p-0.5">
				{#each [['week', 'Settimana'], ['month', 'Mese']] as [id, label]}
					<button class="h-7 rounded-md px-2.5 text-[12.5px] font-medium {nav.cal === id ? 'bg-panel shadow-sm' : 'text-muted hover:text-fg'}" onclick={() => go({ cal: id })}>{t(label)}</button>
				{/each}
			</div>
			<div class="flex items-center gap-1">
				<button class="icon-btn" aria-label={t('Precedente')} onclick={() => step(-1)}><ChevronLeft size={16} /></button>
				<button class="btn h-7" onclick={() => go({ d: todayISO() })}>{t('Oggi')}</button>
				<button class="icon-btn" aria-label={t('Successivo')} onclick={() => step(1)}><ChevronRight size={16} /></button>
				<span class="ml-1 min-w-36 text-[13px] font-semibold capitalize">{rangeLabel}</span>
			</div>
		{/if}

		<div class="flex items-center gap-1 border-l border-border pl-2">
			<span class="mr-1 flex min-w-[92px] items-center justify-end gap-1 text-[11.5px]" aria-live="polite">
				{#if store.saveError}
					<span class="flex items-center gap-1 text-p3"><CircleAlert size={13} />{t('Errore di salvataggio')}</span>
				{:else if store.saving > 0}
					<span class="flex items-center gap-1 text-muted"><LoaderCircle size={13} class="animate-spin" />{t('Salvataggio…')}</span>
				{:else if justSaved}
					<span class="flex items-center gap-1 text-faint"><Check size={13} />{t('Salvato')}</span>
				{/if}
			</span>
			<button class="icon-btn" title={t('Cerca') + ' (Ctrl+K)'} aria-label={t('Cerca')} onclick={() => (ui.searchOpen = true)}><Search size={15} /></button>
			<button class="icon-btn" title={t('Annulla azione') + ' (Ctrl+Z)'} aria-label={t('Annulla azione')} disabled={!store.undoStack.length} onclick={() => store.undo()}><Undo2 size={15} /></button>
			<button class="icon-btn" title={t('Ripeti') + ' (Ctrl+Shift+Z)'} aria-label={t('Ripeti')} disabled={!store.redoStack.length} onclick={() => store.redo()}><Redo2 size={15} /></button>
		</div>
	</div>
</header>
