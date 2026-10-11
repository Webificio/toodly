<script lang="ts">
	import { untrack } from 'svelte';
	import { FolderPlus, RefreshCcw } from '@lucide/svelte';
	import Modal from './Modal.svelte';
	import { ui, showToast, askConfirm } from '../nav.svelte';
	import { store } from '../store.svelte';
	import { importAppendSets, importReplace, backupLabel, type Backup } from '../backup';
	import { notifyDataChanged } from '../windowing';
	import { t as tt } from '../i18n.svelte';

	let open = $state(false);
	let plan = $state<Backup | null>(null);
	let busy = $state(false);

	$effect(() => {
		const p = ui.importPlan;
		if (!p) return;
		untrack(() => {
			plan = p;
			open = true;
		});
	});
	$effect(() => {
		if (!open) ui.importPlan = null;
	});

	async function run(fn: (b: Backup) => Promise<void>, done: string, reload = true) {
		const b = plan;
		if (!b || busy) return;
		busy = true;
		try {
			await fn(b);
			if (reload) {
				await store.reload();
				notifyDataChanged();
			}
			showToast(done);
		} catch (e) {
			console.error(e);
			showToast(tt('Importazione non riuscita'));
		} finally {
			busy = false;
			open = false;
		}
	}

	function replaceAll() {
		const b = plan;
		if (!b) return;
		open = false;
		askConfirm({
			title: tt('Sostituire tutti i dati?'),
			message: tt('Tutti i set di dati attuali verranno eliminati e sostituiti da quelli del backup; le finestre aperte saranno chiuse e ricreate come nel backup. L’operazione non è annullabile.'),
			label: tt('Elimina tutto e importa'),
			danger: true,
			run: async () => {
				try {
					await importReplace(b);
				} catch (e) {
					console.error(e);
					showToast(tt('Importazione non riuscita'));
				}
			}
		});
	}
</script>

<Modal bind:open title={tt('Importa backup')} width={540}>
	{#if plan}
		<div class="space-y-4 text-[13px]">
			<p class="font-medium">{tt('Cosa fare con i dati presenti?')}</p>
			<p class="text-muted">
				{tt('Backup del {date}: {n} set di dati, {tasks} task, {lists} liste, {groups} gruppi, {files} allegati.', {
					date: backupLabel(plan),
					n: plan.counts.datasets,
					tasks: plan.counts.tasks,
					lists: plan.counts.lists,
					groups: plan.counts.groups,
					files: plan.counts.attachments
				})}
			</p>
			<div class="space-y-2">
				<button class="flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-accent/60 hover:bg-hover" disabled={busy} onclick={() => run(importAppendSets, tt('Set di dati importati'), false)}>
					<FolderPlus size={18} class="mt-0.5 shrink-0 text-accent" />
					<span><span class="block font-semibold">{tt('Accoda ai set presenti')}</span><span class="text-[12px] text-muted">{tt('Aggiunge ogni set del backup come set separato, senza toccare i dati esistenti. Se un nome è già in uso viene aggiunto (2), (3)… Li apri poi da Impostazioni → Dati.')}</span></span>
				</button>
				<button class="flex w-full items-start gap-3 rounded-xl border border-p3/40 p-3 text-left transition-colors hover:bg-p3/10" disabled={busy} onclick={replaceAll}>
					<RefreshCcw size={18} class="mt-0.5 shrink-0 text-p3" />
					<span><span class="block font-semibold">{tt('Sovrascrivi i dati presenti')}</span><span class="text-[12px] text-muted">{tt('Elimina tutti i set attuali e ripristina quelli del backup, con finestre e preferenze.')}</span></span>
				</button>
			</div>
			<div class="flex justify-end"><button class="btn" onclick={() => (open = false)}>{tt('Annulla')}</button></div>
		</div>
	{/if}
</Modal>
