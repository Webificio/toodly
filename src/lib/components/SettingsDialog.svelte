<script lang="ts">
	import { untrack } from 'svelte';
	import { Switch } from 'bits-ui';
	import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
	import { Sun, Moon, Monitor, Power, Database, Info, Eraser } from '@lucide/svelte';
	import Modal from './Modal.svelte';
	import { ui, showToast, askConfirm } from '../nav.svelte';
	import { resetAllData } from '../backup';
	import { theme, setTheme, type Theme } from '../theme.svelte';
	import { quitApp } from '../windowing';
	import { t as tt, i18n, setLang, type Lang } from '../i18n.svelte';
	import Select from './Select.svelte';

	let open = $state(false);
	let autostart = $state(false);
	let available = $state(true);

	$effect(() => {
		if (!ui.settingsOpen) return;
		untrack(() => {
			open = true;
			isEnabled().then((v) => (autostart = v)).catch(() => (available = false));
		});
	});
	$effect(() => {
		if (!open) ui.settingsOpen = false;
	});

	function wipeAll() {
		open = false;
		askConfirm({
			title: tt('Cancella tutti i dati'),
			message: tt('Sei sicuro di voler cancellare completamente tutti i dati? Verranno eliminati per sempre tutti i set di dati con i loro task, liste, gruppi, note e allegati, oltre alle preferenze locali. L\'operazione non si può annullare: se vuoi conservare qualcosa, esporta prima un backup da «Dati».'),
			label: tt('Cancella tutto'),
			danger: true,
			run: async () => {
				try {
					await resetAllData();
				} catch (e) {
					console.error(e);
					showToast(tt('Operazione non riuscita'));
				}
			}
		});
	}

	async function toggleAutostart(v: boolean) {
		try {
			if (v) await enable();
			else await disable();
			autostart = await isEnabled();
		} catch (e) {
			console.error(e);
			autostart = !v;
			showToast(tt("Impossibile modificare l'avvio automatico"));
		}
	}

	const themes = $derived<{ id: Theme; label: string; icon: typeof Sun }[]>([
		{ id: 'light', label: tt('Chiaro'), icon: Sun },
		{ id: 'dark', label: tt('Scuro'), icon: Moon },
		{ id: 'system', label: tt('Sistema'), icon: Monitor }
	]);
	const languages: { value: Lang; label: string }[] = [
		{ value: 'it', label: 'Italiano' },
		{ value: 'en', label: 'English' }
	];
	const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
</script>

<Modal bind:open title={tt('Impostazioni')} width={460}>
	<div class="space-y-5 text-[13px]">
		<section>
			<h4 class="mb-2 text-[11.5px] font-semibold tracking-wider text-muted uppercase">{tt('Aspetto')}</h4>
			<div class="flex rounded-lg bg-hover p-0.5">
				{#each themes as th}
					<button class="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[12.5px] font-medium {theme.value === th.id ? 'bg-panel shadow-sm' : 'text-muted hover:text-fg'}" onclick={() => setTheme(th.id)}>
						<th.icon size={14} />{th.label}
					</button>
				{/each}
			</div>
		</section>

		<section class="flex items-center gap-3">
			<div class="flex-1 font-medium">{tt('Lingua')}</div>
			<div class="w-40"><Select value={i18n.lang} options={languages} onchange={(v) => setLang(v as Lang)} /></div>
		</section>

		<section class="flex items-center gap-3">
			<div class="flex-1">
				<div class="font-medium">{tt("Avvia toodly all'avvio del sistema")}</div>
				<div class="text-[12px] text-muted">{available ? tt("All'avvio ripristina le finestre aperte, oppure resta nel tray.") : tt('Non disponibile in questo ambiente.')}</div>
			</div>
			<Switch.Root
				checked={autostart}
				disabled={!available}
				onCheckedChange={toggleAutostart}
				class="relative h-6 w-10 shrink-0 rounded-full bg-hover transition-colors data-[state=checked]:bg-accent disabled:opacity-40"
			>
				<Switch.Thumb class="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
			</Switch.Root>
		</section>

		<section>
			<h4 class="mb-2 text-[11.5px] font-semibold tracking-wider text-muted uppercase">{tt('Scorciatoie')}</h4>
			<dl class="space-y-1.5">
				<div class="flex justify-between"><dt>{tt('Quick Add (globale)')}</dt><dd><kbd class="rounded border border-border bg-hover px-1.5 py-0.5 text-[11.5px]">{isMac ? '⌘' : 'Ctrl'} + Shift + {tt('Spazio')}</kbd></dd></div>
				<div class="flex justify-between"><dt>{tt('Nuova finestra')}</dt><dd><kbd class="rounded border border-border bg-hover px-1.5 py-0.5 text-[11.5px]">{isMac ? '⌘' : 'Ctrl'} + N</kbd></dd></div>
				<div class="flex justify-between"><dt>{tt('Chiudi il pannello di dettaglio')}</dt><dd><kbd class="rounded border border-border bg-hover px-1.5 py-0.5 text-[11.5px]">Esc</kbd></dd></div>
			</dl>
		</section>

		<section class="flex items-center gap-3">
			<div class="flex-1">
				<div class="font-medium">{tt('Dati')}</div>
				<div class="text-[12px] text-muted">{tt('Set di dati, esportazione e importazione (zip).')}</div>
			</div>
			<button class="btn" onclick={() => { open = false; ui.dataOpen = true; }}><Database size={14} />{tt('Gestisci…')}</button>
		</section>

		<section class="flex items-center gap-3">
			<div class="flex-1">
				<div class="font-medium text-p3">{tt('Cancella tutti i dati')}</div>
				<div class="text-[12px] text-muted">{tt('Elimina definitivamente tutti i set, i task, gli allegati e le preferenze.')}</div>
			</div>
			<button class="btn text-p3" onclick={wipeAll}><Eraser size={14} />{tt('Cancella…')}</button>
		</section>

		<section class="border-t border-border pt-4">
			<div class="flex flex-wrap gap-2">
			<button class="btn" onclick={() => { open = false; ui.aboutOpen = true; }}><Info size={14} />{tt('Informazioni')}</button>
			<button class="btn text-p3" onclick={() => quitApp()}><Power size={14} />{tt('Esci da toodly')}</button>
			</div>
			<p class="mt-1.5 text-[12px] text-muted">{tt("Alla chiusura dell'ultima finestra toodly chiede se uscire o restare nel tray.")}</p>
		</section>
	</div>
</Modal>
