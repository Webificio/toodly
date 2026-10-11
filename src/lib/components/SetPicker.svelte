<script lang="ts">
	import { Database } from '@lucide/svelte';
	import DatasetList from './DatasetList.svelte';
	import { ui, showToast } from '../nav.svelte';
	import { assignDataset } from '../datasets';
	import { t } from '../i18n.svelte';
	import { mIn } from '../motion';

	let { onchosen }: { onchosen: (id: string) => void | Promise<void> } = $props();

	async function open(id: string) {
		try {
			await assignDataset(id);
			await onchosen(id);
		} catch (e) {
			console.error(e);
			showToast(t("Il set è già aperto in un'altra finestra"));
		}
	}
</script>

{#if ui.pickDataset}
	<div class="fixed inset-0 z-[80] grid place-items-center bg-bg p-4">
		<div class="w-full max-w-md rounded-2xl border border-border bg-elev p-5 shadow-pop" in:mIn={{ y: 14, duration: 0.26 }}>
			<div class="mb-1 flex items-center gap-2 text-[16px] font-semibold"><Database size={18} class="text-accent" />{t('Scegli i dati per questa finestra')}</div>
			<p class="mb-4 text-[12.5px] text-muted">{t('Ogni finestra lavora su un set di dati: scegline uno esistente (non aperto altrove) oppure creane uno nuovo.')}</p>
			<DatasetList mode="picker" onopen={open} />
		</div>
	</div>
{/if}
