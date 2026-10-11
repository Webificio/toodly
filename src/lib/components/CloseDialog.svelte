<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import Modal from './Modal.svelte';
	import { ui } from '../nav.svelte';
	import { t } from '../i18n.svelte';

	let open = $state(false);
	$effect(() => {
		open = ui.closeAsk;
	});
	$effect(() => {
		if (!open) ui.closeAsk = false;
	});

	async function choose(quit: boolean) {
		open = false;
		try {
			await invoke('close_choice', { quitApp: quit });
		} catch (e) {
			console.error(e);
		}
	}
</script>

<Modal bind:open title={t('Chiudere toodly?')} width={440}>
	<div class="space-y-5">
		<p class="text-[13.5px] leading-relaxed">{t("Questa è l'ultima finestra. Vuoi uscire dall'app o lasciarla in background nella tray? I dati sono già salvati.")}</p>
		<div class="flex flex-wrap justify-end gap-2">
			<button class="btn" onclick={() => (open = false)}>{t('Annulla')}</button>
			<button class="btn" onclick={() => choose(true)}>{t('Esci')}</button>
			<!-- svelte-ignore a11y_autofocus -->
			<button class="btn btn-primary" autofocus onclick={() => choose(false)}>{t('Resta nella tray')}</button>
		</div>
	</div>
</Modal>
