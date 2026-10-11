<script lang="ts">
	import '../app.css';
	import '@fontsource/quicksand/700.css';
	import { onMount } from 'svelte';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import AboutDialog from '../lib/components/AboutDialog.svelte';
	import { panel, setSidebarWidth, initSidebar, SIDEBAR_DEFAULT } from '../lib/layoutui.svelte';
	import CloseDialog from '../lib/components/CloseDialog.svelte';
	import Sidebar from '../lib/components/Sidebar.svelte';
	import Header from '../lib/components/Header.svelte';
	import TaskDrawer from '../lib/components/TaskDrawer.svelte';
	import SettingsDialog from '../lib/components/SettingsDialog.svelte';
	import FilterEditor from '../lib/components/FilterEditor.svelte';
	import GroupEditor from '../lib/components/GroupEditor.svelte';
	import ConfirmDialog from '../lib/components/ConfirmDialog.svelte';
	import BulkBar from '../lib/components/BulkBar.svelte';
	import BulkImport from '../lib/components/BulkImport.svelte';
	import ListEditor from '../lib/components/ListEditor.svelte';
	import QuickBar from '../lib/components/QuickBar.svelte';
	import DragGhost from '../lib/components/DragGhost.svelte';
	import { store } from '../lib/store.svelte';
	import { nav, ui, toast, go } from '../lib/nav.svelte';
	import { initTheme } from '../lib/theme.svelte';
	import { selection, clearSelection, selectAll } from '../lib/selection.svelte';
	import { initLang, t as tt } from '../lib/i18n.svelte';
	import { setWorkspace } from '../lib/db';
	import { windowDataset, refreshWindowTitle } from '../lib/datasets';
	import SetPicker from '../lib/components/SetPicker.svelte';
	import DataDialog from '../lib/components/DataDialog.svelte';
	import ImportDialog from '../lib/components/ImportDialog.svelte';
	import { onDataChanged, openWindow, reportRoute, windowReady } from '../lib/windowing';
	import { mIn, mOut } from '../lib/motion';

	let { children } = $props();
	let fatal = $state('');

	/** Collega la finestra a un set di dati e ne carica il contenuto. */
	async function openDataset(id: string) {
		setWorkspace(id);
		ui.datasetId = id;
		ui.pickDataset = false;
		await store.reload();
		refreshWindowTitle(id);
	}
	// cambiando vista la selezione non ha più senso
	$effect(() => {
		nav.scope;
		nav.mode;
		clearSelection();
	});

	onMount(() => {
		initTheme();
		initLang();
		if (!nav.quick) initSidebar();
		let timer: ReturnType<typeof setTimeout>;
		let unlisten: (() => void) | undefined;
		let unlistenClose: (() => void) | undefined;
		if (!nav.quick) getCurrentWindow().listen('close-confirm', () => (ui.closeAsk = true)).then((u) => (unlistenClose = u)).catch(() => {});

		(async () => {
			try {
				if (!nav.quick) {
					const ws = await windowDataset().catch(() => 'browser' as string | null);
					if (ws) await openDataset(ws);
					else ui.pickDataset = true; // scelta del set: nuovo o uno esistente
				}
			} catch (e) {
				console.error(e);
				fatal = String(e);
			}
			if (!nav.quick) windowReady();
			// sincronizzazione in tempo reale: le altre finestre notificano ogni scrittura
			unlisten = await onDataChanged(() => {
				clearTimeout(timer);
				timer = setTimeout(() => store.reload(), 60);
			});
		})();

		const key = (e: KeyboardEvent) => {
			if (nav.quick) return;
			const mod = e.ctrlKey || e.metaKey;
			if (mod && e.shiftKey && e.key.toLowerCase() === 'i') {
				e.preventDefault();
				ui.bulkOpen = true;
			} else if (mod && e.key.toLowerCase() === 'n') {
				e.preventDefault();
				openWindow();
			} else if (e.key === 'Escape' && selection.size > 0 && !document.querySelector('[role=menu],[role=listbox],[role=dialog]')) {
				clearSelection();
			} else if (mod && e.key.toLowerCase() === 'a' && !(e.target as HTMLElement).closest('input, textarea, [contenteditable]')) {
				e.preventDefault();
				selectAll();
			} else if (e.key === 'Escape' && ui.selectedTaskId) {
				if (document.querySelector('[role=menu],[role=listbox],[role=dialog]')) return;
				ui.selectedTaskId = null;
			}
		};
		window.addEventListener('keydown', key);
		// clic fuori dal pannello di dettaglio: lo chiude (fase di cattura, prima dei gestori dei task)
		const outside = (e: MouseEvent) => {
			if (nav.quick || !ui.selectedTaskId) return;
			const el = e.target as HTMLElement | null;
			if (!el || !el.isConnected) return;
			if (el.closest('[data-drawer], [data-task], [data-nodismiss], [role=menu], [role=listbox], [role=dialog]')) return;
			if (document.querySelector('[role=menu], [role=listbox], [role=dialog]')) return;
			ui.selectedTaskId = null;
		};
		window.addEventListener('click', outside, true);
		// evita il menu contestuale del browser (la UI è nativa)
		const ctx = (e: MouseEvent) => {
			if (!(e.target as HTMLElement).closest('input, textarea')) e.preventDefault();
		};
		window.addEventListener('contextmenu', ctx);
		return () => {
			unlisten?.();
			unlistenClose?.();
			clearTimeout(timer);
			window.removeEventListener('keydown', key);
			window.removeEventListener('click', outside, true);
			window.removeEventListener('contextmenu', ctx);
		};
	});

	let resizing = $state(false);
	function startResize(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		resizing = true;
		const startX = e.clientX;
		const startW = panel.sidebar;
		const move = (ev: PointerEvent) => setSidebarWidth(startW + ev.clientX - startX);
		const up = () => {
			resizing = false;
			setSidebarWidth(panel.sidebar, true);
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		};
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}

	// la vecchia vista «Inbox» non esiste più (ogni task ha una lista)
	$effect(() => {
		if (nav.scope === 'inbox') go({ scope: 'today' });
	});

	// il backend salva rotta e geometria di ogni finestra per ripristinarle al riavvio
	$effect(() => {
		if (!nav.quick) reportRoute('/' + nav.search);
	});
</script>

{#if nav.quick}
	<QuickBar />
{:else}
	<div class="flex h-screen w-screen overflow-hidden bg-bg">
		<Sidebar />
		<!-- separatore trascinabile tra sidebar e area principale (doppio clic: larghezza predefinita) -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="group relative z-20 w-px shrink-0 cursor-col-resize bg-border"
			role="separator"
			aria-orientation="vertical"
			onpointerdown={startResize}
			ondblclick={() => setSidebarWidth(SIDEBAR_DEFAULT, true)}
		>
			<div class="absolute inset-y-0 -left-1.5 w-3 transition-colors group-hover:bg-accent/25 {resizing ? 'bg-accent/35' : ''}"></div>
		</div>
		<main class="flex min-w-0 flex-1 flex-col bg-panel">
			<Header />
			<div class="relative min-h-0 flex-1 overflow-hidden">
				{#if store.ready}
					{#key nav.mode}
						<div class="h-full" in:mIn={{ y: 6, duration: 0.22 }}>{@render children()}</div>
					{/key}
				{/if}
				<TaskDrawer />
			</div>
		</main>
	</div>
	<SettingsDialog />
	<FilterEditor />
	<ListEditor />
	<BulkImport />
	<BulkBar />
	<ConfirmDialog />
	<GroupEditor />
	<DataDialog />
	<CloseDialog />
	<AboutDialog />
	<ImportDialog />
	<SetPicker onchosen={openDataset} />
	<DragGhost />
	{#if fatal}
		<div class="fixed inset-x-0 bottom-4 mx-auto w-fit max-w-xl rounded-xl border border-p3 bg-elev px-4 py-3 text-p3 shadow-pop">{tt('Errore database')}: {fatal}</div>
	{/if}
	{#if toast.msg}
		{#key toast.id}
			<div class="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-fg px-4 py-2 text-[13px] text-bg shadow-pop" in:mIn={{ y: 10 }} out:mOut={{ y: 10 }}>{toast.msg}</div>
		{/key}
	{/if}
{/if}
