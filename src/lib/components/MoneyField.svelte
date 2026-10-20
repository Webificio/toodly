<script lang="ts">
	import { t, locale } from '../i18n.svelte';
	import { currencySymbol, formatAmount, parseMoney } from '../money';

	/**
	 * Campo per un importo (valuta della lista), digitato come testo: «1250», «1.250,50», «12,5».
	 * `value` è in centesimi; vuoto = nessun importo (null).
	 */
	let {
		value,
		onchange,
		currency = 'EUR',
		placeholder = '',
		label = '',
		compact = false
	}: { value: number | null; onchange: (cents: number | null) => void; currency?: string; placeholder?: string; label?: string; compact?: boolean } = $props();

	const dec = $derived<',' | '.'>(locale().startsWith('en') ? '.' : ',');
	let draft = $state<string | null>(null);
	const shown = $derived(draft ?? (value == null ? '' : formatAmount(value, dec)));

	function commit() {
		if (draft === null) return;
		const r = parseMoney(draft, dec);
		draft = null;
		if (r === undefined) return; // testo non valido: si torna al valore precedente
		if (r !== value) onchange(r);
	}
	function key(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); commit(); (e.currentTarget as HTMLInputElement).blur(); }
		else if (e.key === 'Escape') { e.stopPropagation(); draft = null; (e.currentTarget as HTMLInputElement).blur(); }
	}
</script>

<div class="flex min-w-0 items-center gap-1.5" data-nodrag>
	<input
		type="text"
		inputmode="decimal"
		autocomplete="off"
		class={compact ? 'w-24 rounded border border-border bg-transparent px-1.5 py-0.5 text-[12px]' : 'field !w-32 shrink-0 text-right'}
		value={shown}
		{placeholder}
		title={t('Importo: puoi scrivere 1250, 1.250,50 o 12,5. Vuoto = nessun importo')}
		aria-label={label || t('Importo')}
		oninput={(e) => (draft = e.currentTarget.value)}
		onchange={commit}
		onblur={commit}
		onkeydown={key}
		onclick={(e) => e.stopPropagation()}
	/>
	<span class="text-[12px] text-muted">{currencySymbol(currency, locale())}</span>
</div>
