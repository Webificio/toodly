<script lang="ts">
	import { untrack } from 'svelte';
	import { Download, Upload } from '@lucide/svelte';
	import Modal from './Modal.svelte';
	import DatasetList from './DatasetList.svelte';
	import { ui, showToast } from '../nav.svelte';
	import { exportAll, pickAndReadBackup, backupErrorText } from '../backup';
	import { assignDataset } from '../datasets';
	import { t as tt } from '../i18n.svelte';

	let open = $state(false);
	let busy = $state(false);

	$effect(() => {
		if (!ui.dataOpen) return;
		untrack(() => (open = true));
	});
	$effect(() => {
		if (!open) ui.dataOpen = false;
	});

	async function switchHere(id: string) {
		try {
			await assignDataset(id);
			location.assign('/?scope=today&mode=list'); // ricarica la finestra sul nuovo set
		} catch (e) {
			console.error(e);
			showToast(tt("Il set è già aperto in un'altra finestra"));
		}
	}

	async function doExport() {
		busy = true;
		try {
			const r = await exportAll();
			if (r) showToast(tt('Esportati {n} set di dati ({t} task) in uno zip', { n: r.datasets, t: r.tasks }));
		} catch (e) {
			console.error(e);
			showToast(tt('Esportazione non riuscita'));
		} finally {
			busy = false;
		}
	}
	async function doImport() {
		busy = true;
		try {
			const b = await pickAndReadBackup();
			if (b) {
				open = false;
				ui.importPlan = b;
			}
		} catch (e) {
			console.error(e);
			showToast(tt('File non valido: {e}', { e: backupErrorText(e) }));
		} finally {
			busy = false;
		}
	}
</script>

<Modal bind:open title={tt('Dati')} width={520}>
	<div class="space-y-5 text-[13px]">
		<section>
			<h4 class="mb-2 text-[11.5px] font-semibold tracking-wider text-muted uppercase">{tt('Set di dati')}</h4>
			<p class="mb-2 text-[12px] text-muted">{tt('I dati sono salvati in set indipendenti: chiudere una finestra non li elimina. Ogni finestra apre un set alla volta.')}</p>
			<DatasetList mode="manage" currentId={ui.datasetId} onopen={switchHere} />
		</section>

		<section class="border-t border-border pt-4">
			<h4 class="mb-2 text-[11.5px] font-semibold tracking-wider text-muted uppercase">{tt('Backup')}</h4>
			<p class="mb-3 text-[12px] text-muted">{tt('Un unico file zip con tutti i set di dati, gli allegati, la disposizione delle finestre e le preferenze.')}</p>
			<div class="flex gap-2">
				<button class="btn" disabled={busy} onclick={doExport}><Download size={14} />{tt('Esporta tutto…')}</button>
				<button class="btn" disabled={busy} onclick={doImport}><Upload size={14} />{tt('Importa da zip…')}</button>
			</div>
		</section>
	</div>
</Modal>
