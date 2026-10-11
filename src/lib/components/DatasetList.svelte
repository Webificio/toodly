<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { Database, Plus, Pencil, Trash2, AppWindow, FolderOpen, Check, X } from '@lucide/svelte';
	import { listDatasets, createDataset, renameDataset, deleteDataset, formatCreated, checkName, uniqueName, refreshWindowTitle, type DatasetInfo } from '../datasets';
	import { askConfirm, showToast } from '../nav.svelte';
	import { t } from '../i18n.svelte';

	let {
		mode,
		currentId = null,
		onopen
	}: {
		mode: 'picker' | 'manage';
		currentId?: string | null;
		/** apre il set nella finestra corrente */
		onopen: (id: string) => void | Promise<void>;
	} = $props();

	let sets = $state<DatasetInfo[]>([]);
	let loaded = $state(false);
	let editing = $state<string | null>(null);
	let draft = $state('');
	let creating = $state(false);
	let newName = $state('');
	let error = $state('');

	let me = 'browser';
	try {
		me = getCurrentWindow().label;
	} catch {}

	async function refresh() {
		sets = (await listDatasets()).sort((a, b) => a.name.localeCompare(b.name));
		loaded = true;
	}
	onMount(() => {
		refresh().catch(console.error);
	});

	const busyElsewhere = (d: DatasetInfo) => !!d.window && d.window !== me;
	const isHere = (d: DatasetInfo) => d.id === currentId;

	async function saveRename(d: DatasetInfo) {
		const n = draft.trim();
		if (n === d.name) {
			editing = null;
			error = '';
			return;
		}
		const err = checkName(n, sets, d.id);
		if (err) {
			error = err;
			return;
		}
		try {
			await renameDataset(d.id, n);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			return;
		}
		editing = null;
		error = '';
		await refresh();
		if (isHere(d)) refreshWindowTitle(d.id);
	}
	function startCreate() {
		creating = true;
		error = '';
		newName = uniqueName(t('Nuovo set di dati'), sets.map((s) => s.name));
	}
	async function create() {
		const n = newName.trim();
		const err = checkName(n, sets);
		if (err) {
			error = err;
			return;
		}
		try {
			const ds = await createDataset(n);
			creating = false;
			newName = '';
			error = '';
			if (mode === 'picker') await onopen(ds.id);
			else await refresh();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}
	function remove(d: DatasetInfo) {
		askConfirm({
			title: t('Elimina set di dati'),
			message: t('Sei sicuro di voler eliminare il set «{name}»? Task, liste, gruppi, note e allegati andranno persi definitivamente.', { name: d.name }),
			label: t('Elimina'),
			danger: true,
			run: async () => {
				try {
					await deleteDataset(d.id);
				} catch (e) {
					console.error(e);
					showToast(t('Impossibile eliminare il set'));
				}
				await refresh();
			}
		});
	}
	async function openNewWindow(d: DatasetInfo) {
		try {
			await invoke('open_window', { route: null, dataset: d.id });
			setTimeout(refresh, 600);
		} catch (e) {
			console.error(e);
			showToast(t('Impossibile aprire una nuova finestra'));
		}
	}
</script>

<div class="space-y-1.5 text-[13px]">
	{#if loaded && sets.length === 0}
		<p class="py-3 text-center text-muted">{t('Nessun set di dati: creane uno.')}</p>
	{/if}
	{#each sets as d (d.id)}
		<div class="group flex items-center gap-2 rounded-lg border border-border px-3 py-2 {isHere(d) ? 'border-accent/60 bg-accent/5' : ''}">
			<Database size={16} class="shrink-0 text-accent" />
			<div class="min-w-0 flex-1">
				{#if editing === d.id}
					<!-- svelte-ignore a11y_autofocus -->
					<input
						class="field h-7"
						autofocus
						bind:value={draft}
						oninput={() => (error = '')}
						onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); saveRename(d); } else if (e.key === 'Escape') { e.stopPropagation(); editing = null; error = ''; } }}
					/>
					{#if error}<div class="mt-1 text-[11.5px] text-p3">{error}</div>{/if}
				{:else}
					<div class="truncate font-medium">{d.name}</div>
					<div class="text-[11.5px] text-muted">
						{#if isHere(d)}{t('Aperto in questa finestra')}
						{:else if busyElsewhere(d)}{t("Aperto in un'altra finestra")}
						{:else}{t('Creato il {date}', { date: formatCreated(d.created_at) })}{/if}
					</div>
				{/if}
			</div>
			{#if mode === 'picker'}
				<button class="btn btn-primary h-8" disabled={busyElsewhere(d)} onclick={() => onopen(d.id)}><FolderOpen size={14} />{t('Apri')}</button>
			{:else}
				{#if !isHere(d)}
					<button class="icon-btn" title={t('Apri in questa finestra')} aria-label={t('Apri in questa finestra')} disabled={busyElsewhere(d)} onclick={() => onopen(d.id)}><FolderOpen size={15} /></button>
					<button class="icon-btn" title={t('Apri in una nuova finestra')} aria-label={t('Apri in una nuova finestra')} disabled={busyElsewhere(d)} onclick={() => openNewWindow(d)}><AppWindow size={15} /></button>
				{/if}
				{#if editing === d.id}
					<button class="icon-btn" aria-label={t('Salva')} onclick={() => saveRename(d)}><Check size={16} /></button>
					<button class="icon-btn" aria-label={t('Annulla')} onclick={() => { editing = null; error = ''; }}><X size={16} /></button>
				{:else}
					<button class="icon-btn" title={t('Rinomina')} aria-label={t('Rinomina')} onclick={() => { editing = d.id; draft = d.name; error = ''; }}><Pencil size={14} /></button>
				{/if}
				<button class="icon-btn hover:text-p3" title={t('Elimina')} aria-label={t('Elimina')} disabled={isHere(d) || busyElsewhere(d)} onclick={() => remove(d)}><Trash2 size={14} /></button>
			{/if}
		</div>
	{/each}

	{#if creating}
		<div class="pt-1">
			<div class="flex items-center gap-2">
				<!-- svelte-ignore a11y_autofocus -->
				<input class="field h-8" autofocus placeholder={t('Nome del set di dati')} bind:value={newName} oninput={() => (error = '')} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); create(); } else if (e.key === 'Escape') { e.stopPropagation(); creating = false; error = ''; } }} />
				<button class="icon-btn" aria-label={t('Salva')} onclick={create}><Check size={16} /></button>
				<button class="icon-btn" aria-label={t('Annulla')} onclick={() => { creating = false; error = ''; }}><X size={16} /></button>
			</div>
			{#if error}<div class="mt-1 text-[11.5px] text-p3">{error}</div>{/if}
		</div>
	{:else}
		<button class="btn btn-ghost w-full justify-start" onclick={startCreate}><Plus size={14} />{t('Nuovo set di dati')}</button>
	{/if}
</div>
