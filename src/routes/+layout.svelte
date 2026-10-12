<script lang="ts">
	import '../app.css';
	import '@fontsource/quicksand/700.css';
	import { onMount } from 'svelte';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import AboutDialog from '../lib/components/AboutDialog.svelte';
	import SearchDialog from '../lib/components/SearchDialog.svelte';
	import StatsDialog from '../lib/components/StatsDialog.svelte';
	import TourDialog from '../lib/components/TourDialog.svelte';
	import ShortcutsDialog from '../lib/components/ShortcutsDialog.svelte';
	import TemplatesDialog from '../lib/components/TemplatesDialog.svelte';
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
	import { store, onTasksRemoved } from '../lib/store.svelte';
	import { nav, ui, toast, go } from '../lib/nav.svelte';
	import { initTheme } from '../lib/theme.svelte';
	import { startAutoBackup } from '../lib/autobackup.svelte';
	import { initUiPrefs, uiprefs, setTourDone } from '../lib/uiprefs.svelte';
	import { startReminders } from '../lib/reminders.svelte';
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
		store.clearHistory();
		await store.reload();
		store.purgeOldAttachments();
		// primo avvio: la guida compare solo con un set vuoto; chi ha già dei dati non la vede
		if (!nav.quick && !uiprefs.tourDone) {
			if (store.tasks.length === 0) ui.tourOpen = true;
			else setTourDone(true);
		}
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
		initUiPrefs();
		// task spariti (eliminati o annullati): niente selezione né pannello di dettaglio su ciò che non esiste più
		onTasksRemoved((ids) => {
			if (ui.selectedTaskId && ids.includes(ui.selectedTaskId)) ui.selectedTaskId = null;
			for (const id of ids) selection.delete(id);
		});
		initLang();
		if (!nav.quick) initSidebar();
		const stopReminders = nav.quick ? () => {} : startReminders();
		const stopAutoBackup = nav.quick ? () => {} : startAutoBackup();
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
			const tgt = e.target as HTMLElement;
			const typing = !!tgt.closest?.('input, textarea, select, [contenteditable]');
			const overlay = !!document.querySelector('[role=menu],[role=listbox],[role=dialog]');
			const onControl = !!tgt.closest?.('button, a, [role=button], summary');
			if (!mod && !e.altKey && !typing && !overlay) {
				if (e.key === '?') {
					e.preventDefault();
					ui.shortcutsOpen = true;
					return;
				}
				if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
					const rows = [...document.querySelectorAll<HTMLElement>('[data-task][data-task-id]')];
					if (rows.length) {
						e.preventDefault();
						const i = rows.findIndex((r) => r.dataset.taskId === ui.selectedTaskId);
						const next = rows[Math.max(0, Math.min(rows.length - 1, i < 0 ? 0 : i + (e.key === 'ArrowDown' ? 1 : -1)))];
						ui.selectedTaskId = next.dataset.taskId ?? null;
						next.scrollIntoView({ block: 'nearest' });
					}
					return;
				}
				if (ui.selectedTaskId && e.key === 'Enter' && !onControl) {
					e.preventDefault();
					document.querySelector<HTMLInputElement>('aside input[type=text], aside input:not([type])')?.focus();
					return;
				}
				if (ui.selectedTaskId && e.key === ' ' && !onControl) {
					e.preventDefault();
					const tk = store.byId.get(ui.selectedTaskId);
					if (tk) store.setCompleted(tk.id, !tk.completed);
					return;
				}
			}
			if (mod && e.shiftKey && e.key.toLowerCase() === 'i') {
				e.preventDefault();
				ui.bulkOpen = true;
			} else if (mod && !e.altKey && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y') && !(e.target as HTMLElement).closest('input, textarea, [contenteditable]')) {
				// annulla / ripeti (nei campi di testo resta l'annulla del testo)
				e.preventDefault();
				if (e.key.toLowerCase() === 'y' || e.shiftKey) store.redo();
				else store.undo();
			} else if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				ui.searchOpen = !ui.searchOpen;
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
			stopReminders();
			stopAutoBackup();
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
	<SearchDialog />
	<StatsDialog />
	<TourDialog />
	<ShortcutsDialog />
	<TemplatesDialog />
	<ImportDialog />
	<SetPicker onchosen={openDataset} />
	<DragGhost />
	{#if fatal}
		<div class="fixed inset-x-0 bottom-4 mx-auto w-fit max-w-xl rounded-xl border border-p3 bg-elev px-4 py-3 text-p3 shadow-pop">{tt('Errore database')}: {fatal}</div>
	{/if}
	{#if toast.msg}
		{#key toast.id}
			<div class="fixed bottom-6 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-3 rounded-xl bg-fg px-4 py-2 text-[13px] text-bg shadow-pop" in:mIn={{ y: 10 }} out:mOut={{ y: 10 }}>
				<span>{toast.msg}</span>
				{#if toast.action}
					{@const act = toast.action}
					<button class="rounded-md px-1.5 py-0.5 font-semibold text-accent-fg underline-offset-2 hover:underline" style="color: color-mix(in srgb, var(--accent) 70%, white)" onclick={() => { toast.msg = ''; toast.action = null; act.run(); }}>{act.label}</button>
				{/if}
			</div>
		{/key}
	{/if}
{/if}
