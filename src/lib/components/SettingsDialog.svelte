<script lang="ts">
	import { untrack } from 'svelte';
	import { Switch } from 'bits-ui';
	import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
	import { Sun, Moon, Monitor, Power, Database, Info, Eraser } from '@lucide/svelte';
	import Modal from './Modal.svelte';
	import { ui, showToast, askConfirm } from '../nav.svelte';
	import { resetAllData } from '../backup';
	import { theme, setTheme, setThemeStyle, isDarkOnly, THEME_STYLES, type Theme, type ThemeStyle } from '../theme.svelte';
	import { quitApp } from '../windowing';
	import { t as tt, i18n, setLang, type Lang } from '../i18n.svelte';
	import Select from './Select.svelte';
	import { uiprefs, setDensity, setTextScale, setShowNumbers, setRemindersEnabled, setAllDayTime } from '../uiprefs.svelte';
	import { testNotification } from '../reminders.svelte';

	const densityOptions = $derived([
		{ value: 'compact', label: tt('Compatta') },
		{ value: 'normal', label: tt('Normale') },
		{ value: 'comfy', label: tt('Comoda') }
	]);
	const scaleOptions = [90, 100, 110, 125].map((v) => ({ value: String(v), label: v + '%' }));

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
	const styleOptions = $derived(THEME_STYLES.map((s) => ({ value: s.id, label: tt(s.label) })));
	const darkOnly = $derived(isDarkOnly(theme.style));
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
					<button
						class="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[12.5px] font-medium disabled:opacity-40 {!darkOnly && theme.value === th.id ? 'bg-panel shadow-sm' : 'text-muted hover:text-fg'}"
						disabled={darkOnly}
						onclick={() => setTheme(th.id)}
					>
						<th.icon size={14} />{th.label}
					</button>
				{/each}
			</div>
			<div class="mt-3 flex items-center gap-3">
				<div class="flex-1 font-medium">{tt('Tema')}</div>
				<div class="w-40"><Select value={theme.style} options={styleOptions} onchange={(v) => setThemeStyle(v as ThemeStyle)} /></div>
			</div>
			{#if darkOnly}<p class="mt-1.5 text-[12px] text-muted">{tt('Questo tema è sempre scuro')}</p>{/if}
		</section>

		<section class="flex items-center gap-3">
			<div class="flex-1 font-medium">{tt('Lingua')}</div>
			<div class="w-40"><Select value={i18n.lang} options={languages} onchange={(v) => setLang(v as Lang)} /></div>
		</section>

		<section class="flex items-center gap-3">
			<div class="flex-1 font-medium">{tt('Densità della lista')}</div>
			<div class="w-40"><Select value={uiprefs.density} options={densityOptions} onchange={(v) => setDensity(v as 'compact' | 'normal' | 'comfy')} /></div>
		</section>

		<section class="flex items-center gap-3">
			<div class="flex-1 font-medium">{tt("Dimensione dell'interfaccia")}</div>
			<div class="w-40"><Select value={String(uiprefs.textScale)} options={scaleOptions} onchange={(v) => setTextScale(Number(v))} /></div>
		</section>

		<section class="space-y-2">
			<div class="flex items-center gap-3">
				<div class="flex-1">
					<div class="font-medium">{tt('Notifiche dei promemoria')}</div>
					<div class="text-[12px] text-muted">{tt('Una notifica di sistema all\'ora del promemoria dei task (finché toodly è in esecuzione, anche nel tray).')}</div>
				</div>
				<Switch.Root
					checked={uiprefs.remindersEnabled}
					onCheckedChange={setRemindersEnabled}
					class="relative h-6 w-10 shrink-0 rounded-full bg-hover transition-colors data-[state=checked]:bg-accent"
				>
					<Switch.Thumb class="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
				</Switch.Root>
			</div>
			<div class="flex items-center gap-3">
				<div class="flex-1 text-[12.5px]">{tt('Ora predefinita per i task senza orario')}</div>
				<input type="time" class="field w-28" value={uiprefs.allDayTime} onchange={(e) => setAllDayTime(e.currentTarget.value)} />
				<button class="btn" onclick={testNotification}>{tt('Prova')}</button>
			</div>
		</section>

		<section class="flex items-center gap-3">
			<div class="flex-1">
				<div class="font-medium">{tt('Numera i task nella lista')}</div>
				<div class="text-[12px] text-muted">{tt('Mostra un numero progressivo per i task dello stesso livello (i gruppi non contano).')}</div>
			</div>
			<Switch.Root
				checked={uiprefs.showNumbers}
				onCheckedChange={setShowNumbers}
				class="relative h-6 w-10 shrink-0 rounded-full bg-hover transition-colors data-[state=checked]:bg-accent"
			>
				<Switch.Thumb class="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
			</Switch.Root>
		</section>

		<section class="flex items-center gap-3">
			<div class="flex-1">
				<div class="font-medium">{tt('Scorciatoie da tastiera')}</div>
				<div class="text-[12px] text-muted">{tt('Elenco dei comandi da tastiera (anche con ?).')}</div>
			</div>
			<button class="btn" onclick={() => { ui.settingsOpen = false; ui.shortcutsOpen = true; }}>{tt('Mostra')}</button>
		</section>

		<section class="flex items-center gap-3">
			<div class="flex-1">
				<div class="font-medium">{tt('Guida introduttiva')}</div>
				<div class="text-[12px] text-muted">{tt('Rivedi il breve tour delle funzioni principali.')}</div>
			</div>
			<button class="btn" onclick={() => { ui.settingsOpen = false; ui.tourOpen = true; }}>{tt('Mostra')}</button>
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
