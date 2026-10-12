<script lang="ts">
	import { untrack } from 'svelte';
	import { Trash2, FilePlus } from '@lucide/svelte';
	import Modal from './Modal.svelte';
	import { nav, ui, showToast } from '../nav.svelte';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { parseScope } from '../views';
	import { templates, loadTemplates, deleteTemplate, renameTemplate, useTemplate, countNodes, defaultBase, type Template } from '../templates.svelte';

	let open = $state(false);
	let base = $state(defaultBase());
	$effect(() => {
		if (!ui.templatesOpen) return;
		untrack(() => {
			loadTemplates();
			base = defaultBase();
			open = true;
		});
	});
	$effect(() => {
		if (!open) ui.templatesOpen = false;
	});

	const scope = $derived(parseScope(nav.scope));

	async function use(tpl: Template) {
		const id = await useTemplate(tpl, {
			base,
			list_id: scope.kind === 'list' ? scope.id : null,
			tags: scope.kind === 'tag' ? [scope.id] : []
		});
		open = false;
		if (id) {
			ui.selectedTaskId = id;
			showToast(t('Task creato dal modello'));
		}
	}
</script>

<Modal bind:open title={t('Modelli di task')} width={480}>
	<div class="space-y-3 text-[13px]">
		<p class="text-[12px] text-muted">{t('Un modello ricrea un task con i suoi sotto-task. Per crearne uno apri un task e usa «Salva come modello».')}</p>
		<label class="flex items-center gap-2">
			<span class="text-muted">{t('Data di riferimento')}</span>
			<input type="date" class="field w-40" bind:value={base} />
		</label>
		<div class="space-y-1.5">
			{#each templates.list as tpl (tpl.id)}
				<div class="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
					<input
						class="min-w-0 flex-1 bg-transparent font-medium outline-none"
						value={tpl.name}
						aria-label={t('Nome del modello')}
						onchange={(e) => renameTemplate(tpl.id, e.currentTarget.value)}
					/>
					<span class="shrink-0 text-[11.5px] text-faint">{countNodes(tpl.root) === 1 ? t('1 attività') : t('{n} attività', { n: countNodes(tpl.root) })}</span>
					<button class="btn h-7" disabled={!base} onclick={() => use(tpl)}><FilePlus size={14} />{t('Usa')}</button>
					<button class="icon-btn size-7" aria-label={t('Elimina modello')} title={t('Elimina modello')} onclick={() => deleteTemplate(tpl.id)}><Trash2 size={13} /></button>
				</div>
			{:else}
				<p class="py-4 text-center text-[12.5px] text-faint">{t('Nessun modello salvato')}</p>
			{/each}
		</div>
	</div>
</Modal>
