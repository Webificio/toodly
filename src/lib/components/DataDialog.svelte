<script lang="ts">
	import { untrack } from 'svelte';
	import { Download, Upload, FolderOpen, CalendarDays, Play } from '@lucide/svelte';
	import { open as pickDir } from '@tauri-apps/plugin-dialog';
	import Select from './Select.svelte';
	import { autoBackup, loadAutoBackup, setAutoMode, setAutoDir, setAutoKeep, runAutoBackup, type AutoMode } from '../autobackup.svelte';
	import { exportIcs } from '../exportics';
	import Modal from './Modal.svelte';
	import DatasetList from './DatasetList.svelte';
	import { ui, showToast } from '../nav.svelte';
	import { exportAll, pickAndReadBackup, backupErrorText } from '../backup';
	import { assignDataset } from '../datasets';
	import { t as tt, locale } from '../i18n.svelte';

	let open = $state(false);
	let busy = $state(false);

	$effect(() => {
		if (!ui.dataOpen) return;
		untrack(() => {
			open = true;
			loadAutoBackup();
		});
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
	const modeOptions = $derived([
		{ value: 'off', label: tt('Disattivato') },
		{ value: 'daily', label: tt('Ogni giorno') },
		{ value: 'weekly', label: tt('Ogni settimana') }
	]);
	const keepOptions = [3, 7, 14, 30].map((n) => ({ value: String(n), label: String(n) }));
	async function chooseDir() {
		try {
			const d = await pickDir({ directory: true, multiple: false, title: tt('Cartella dei backup automatici') });
			if (typeof d === 'string' && d) setAutoDir(d);
		} catch (e) {
			console.error(e);
		}
	}
	async function backupNow() {
		const ok = await runAutoBackup(true);
		showToast(ok ? tt('Backup completato') : tt('Backup non riuscito'));
	}
	const lastText = $derived(autoBackup.last ? new Date(autoBackup.last).toLocaleString(locale()) : tt('mai'));

	async function doIcs() {
		try {
			const r = await exportIcs();
			if (r === 'empty') showToast(tt('Nessun task con scadenza da esportare'));
			else if (r) showToast(tt('Calendario esportato in .ics'));
		} catch (e) {
			console.error(e);
			showToast(tt('Esportazione non riuscita'));
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

		<section class="border-t border-border pt-4">
			<h4 class="mb-2 text-[11.5px] font-semibold tracking-wider text-muted uppercase">{tt('Backup automatico')}</h4>
			<p class="mb-3 text-[12px] text-muted">{tt('Salva periodicamente un backup completo nella cartella scelta (finché toodly è in esecuzione) e conserva solo gli ultimi.')}</p>
			<div class="grid grid-cols-[130px_1fr] items-center gap-x-3 gap-y-2.5">
				<span class="text-muted">{tt('Frequenza')}</span>
				<div class="w-44"><Select value={autoBackup.mode} options={modeOptions} onchange={(v) => setAutoMode(v as AutoMode)} /></div>
				<span class="text-muted">{tt('Cartella')}</span>
				<div class="flex min-w-0 items-center gap-2">
					<button class="btn shrink-0" onclick={chooseDir}><FolderOpen size={14} />{tt('Scegli…')}</button>
					<span class="min-w-0 truncate text-[12px] {autoBackup.dir ? '' : 'text-faint'}" title={autoBackup.dir}>{autoBackup.dir || tt('Nessuna cartella')}</span>
				</div>
				<span class="text-muted">{tt('Backup da conservare')}</span>
				<div class="w-24"><Select value={String(autoBackup.keep)} options={keepOptions} onchange={(v) => setAutoKeep(Number(v))} /></div>
			</div>
			<div class="mt-3 flex flex-wrap items-center gap-3">
				<button class="btn" disabled={!autoBackup.dir || autoBackup.running} onclick={backupNow}><Play size={14} />{tt('Esegui ora')}</button>
				<span class="text-[12px] text-muted">{tt('Ultimo backup: {when}', { when: lastText })}</span>
			</div>
			{#if autoBackup.error}<p class="mt-2 text-[12px] text-p3">{autoBackup.error}</p>{/if}
		</section>

		<section class="border-t border-border pt-4">
			<h4 class="mb-2 text-[11.5px] font-semibold tracking-wider text-muted uppercase">{tt('Calendario esterno')}</h4>
			<p class="mb-3 text-[12px] text-muted">{tt('Esporta i task con scadenza di questo set in un file .ics (Google Calendar, Outlook, Apple Calendar…). Orari, ripetizioni e promemoria sono inclusi.')}</p>
			<button class="btn" onclick={doIcs}><CalendarDays size={14} />{tt('Esporta .ics…')}</button>
		</section>
	</div>
</Modal>
