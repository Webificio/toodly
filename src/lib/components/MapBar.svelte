<script lang="ts">
	import { FolderPlus, LayoutTemplate } from '@lucide/svelte';
	import QuickInput from './QuickInput.svelte';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { nav, ui } from '../nav.svelte';
	import { parseScope } from '../views';
	import { parseQuick } from '../quickparse';
	import { addDays, todayISO } from '../dates';

	/** Barra di aggiunta delle viste Orbit e Metro: la stessa della Lista e della Graph. */
	const scopeInfo = $derived(parseScope(nav.scope));
	function add(text: string) {
		const p = parseQuick(text, store.lists);
		if (!p.title) return;
		const today = todayISO();
		store.createTask({
			title: p.title,
			group_id: null,
			tags: scopeInfo.kind === 'tag' ? [...p.tags, scopeInfo.id] : p.tags,
			priority: p.priority || (nav.scope === 'important' ? 3 : 0),
			list_id: p.list_id ?? (scopeInfo.kind === 'list' ? scopeInfo.id : null),
			due_date: p.due_date ?? (nav.scope === 'today' ? today : nav.scope === 'next7' ? addDays(today, 1) : null)
		});
	}
</script>

<div class="flex items-center gap-2 px-4 pt-4 pb-3">
	<div class="min-w-0 flex-1"><QuickInput onsubmit={add} placeholder={t('Aggiungi un task…   (!alta  @domani  #lista)')} /></div>
	<button class="btn h-10 shrink-0" title={t('Nuovo task da un modello')} onclick={() => (ui.templatesOpen = true)}><LayoutTemplate size={16} />{t('Modello')}</button>
	<button class="btn h-10 shrink-0" title={t('Nuovo gruppo')} onclick={() => (ui.groupEditor = 'new')}><FolderPlus size={16} />{t('Gruppo')}</button>
</div>
