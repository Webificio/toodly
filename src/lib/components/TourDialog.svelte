<script lang="ts">
	import { Sparkles, Search, Undo2, Bell, ChartGantt, Keyboard } from '@lucide/svelte';
	import Modal from './Modal.svelte';
	import { ui } from '../nav.svelte';
	import { t } from '../i18n.svelte';
	import { setTourDone } from '../uiprefs.svelte';

	let open = $state(false);
	let step = $state(0);
	$effect(() => {
		open = ui.tourOpen;
		if (ui.tourOpen) step = 0;
	});
	$effect(() => {
		if (!open && ui.tourOpen) {
			ui.tourOpen = false;
			setTourDone(true);
		}
	});

	const steps = [
		{ icon: Sparkles, title: 'Benvenuto in toodly', text: 'Scrivi un task nella barra in alto e premi Invio. Nel testo puoi usare !alta, @domani e #lista per impostare priorità, scadenza e lista al volo.' },
		{ icon: Search, title: 'Trova tutto al volo', text: 'Premi Ctrl+K per cercare nei titoli e nelle descrizioni, filtrare per lista e priorità e saltare direttamente al task.' },
		{ icon: Undo2, title: 'Nessun timore di sbagliare', text: 'Ctrl+Z annulla le ultime operazioni (anche le eliminazioni), Ctrl+Y le ripete. Dopo un\'eliminazione trovi anche il pulsante «Annulla».' },
		{ icon: Bell, title: 'Promemoria', text: 'Nel dettaglio di un task scegli un promemoria: riceverai una notifica di sistema, anche con toodly nel tray.' },
		{ icon: ChartGantt, title: 'Viste e statistiche', text: 'Passa tra Lista, Kanban, Calendario e Gantt dalla barra in alto. Nel piè di pagina della barra laterale trovi le statistiche.' }
	];
	const last = $derived(step === steps.length - 1);
	const cur = $derived(steps[step]);
	const Icon = $derived(cur.icon);
</script>

<Modal bind:open title={t('Guida introduttiva')} width={460}>
	<div class="grid place-items-center gap-3 py-4 text-center" aria-live="polite">
		<div class="grid size-14 place-items-center rounded-2xl bg-accent/12 text-accent"><Icon size={28} /></div>
		<h3 class="text-[16px] font-semibold">{t(cur.title)}</h3>
		<p class="max-w-[360px] text-[13px] leading-relaxed text-muted">{t(cur.text)}</p>
		<div class="mt-1 flex gap-1.5" aria-hidden="true">
			{#each steps as _, i}<span class="size-1.5 rounded-full {i === step ? 'bg-accent' : 'bg-hover'}"></span>{/each}
		</div>
	</div>
	<div class="mt-2 flex items-center justify-between">
		<button class="btn" onclick={() => (open = false)}>{t('Salta')}</button>
		<div class="flex gap-2">
			{#if step > 0}<button class="btn" onclick={() => step--}>{t('Indietro')}</button>{/if}
			<button class="btn btn-primary" onclick={() => (last ? (open = false) : step++)}>{last ? t('Inizia') : t('Avanti')}</button>
		</div>
	</div>
</Modal>
