<script lang="ts">
	import Modal from './Modal.svelte';
	import { ui } from '../nav.svelte';
	import { t } from '../i18n.svelte';

	let open = $state(false);
	$effect(() => {
		open = ui.shortcutsOpen;
	});
	$effect(() => {
		if (!open) ui.shortcutsOpen = false;
	});

	const groups = [
		{
			title: 'Generale',
			rows: [
				['Ctrl+K', 'Cerca'],
				['Ctrl+Z', 'Annulla azione'],
				['Ctrl+Y', 'Ripeti'],
				['Ctrl+N', 'Nuova finestra'],
				['Ctrl+Shift+Space', 'Aggiunta rapida (globale)'],
				['Ctrl+Shift+I', 'Aggiungi più task da testo'],
				['?', 'Scorciatoie da tastiera']
			]
		},
		{
			title: 'Lista dei task',
			rows: [
				['↑ / ↓', 'Task precedente / successivo'],
				['Invio', 'Modifica il titolo del task selezionato'],
				['Spazio', 'Completa / riapri il task selezionato'],
				['Ctrl+A', 'Seleziona tutti'],
				['Esc', 'Chiudi il pannello o azzera la selezione']
			]
		},
		{
			title: 'Viste Graph, Orbit e Metro',
			rows: [
				['Ctrl + rotella', 'Zoom in avanti / indietro'],
				['Trascina', 'Sposta l’area (trascina lo sfondo)'],
				['Passa il mouse su un punto', 'Scheda del task con azioni rapide (Orbit e Metro)']
			]
		}
	];
</script>

<Modal bind:open title={t('Scorciatoie da tastiera')} width={460}>
	<div class="space-y-4 text-[13px]">
		{#each groups as g}
			<section>
				<h4 class="mb-1.5 text-[12px] font-semibold tracking-wide text-muted uppercase">{t(g.title)}</h4>
				<div class="space-y-1">
					{#each g.rows as [k, label]}
						<div class="flex items-center gap-3">
							<span class="flex-1">{t(label)}</span>
							<kbd class="rounded-md border border-border bg-hover px-1.5 py-0.5 font-mono text-[11.5px] text-muted">{t(k)}</kbd>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</Modal>
