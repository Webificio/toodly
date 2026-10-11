<script lang="ts">
	import Modal from './Modal.svelte';
	import { ui } from '../nav.svelte';
	import { t } from '../i18n.svelte';
	import { openExternal } from '../windowing';

	const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
	let open = $state(false);
	$effect(() => {
		open = ui.aboutOpen;
	});
	$effect(() => {
		if (!open) ui.aboutOpen = false;
	});
</script>

<Modal bind:open title={t('Informazioni')} width={380}>
	<div class="space-y-4 text-center text-[13px]">
		<img src="/logo.png" alt="" class="mx-auto size-16" />
		<div>
			<div class="text-[22px] leading-none" style="font-family: 'Quicksand', var(--font-sans); font-weight: 700">toodly</div>
			<div class="mt-1 text-muted">{t('Versione')} {version}</div>
		</div>
		<div class="space-y-1">
			<div class="text-[11.5px] font-semibold tracking-wider text-muted uppercase">{t('Autore')}</div>
			<div class="font-medium">Alessandro Di Michele</div>
			<div><button class="text-accent hover:underline" onclick={() => openExternal('mailto:info@atlantide-design.it')}>info@atlantide-design.it</button></div>
			<div><button class="text-accent hover:underline" onclick={() => openExternal('https://www.atlantide-design.it')}>www.atlantide-design.it</button></div>
		</div>
	</div>
</Modal>
