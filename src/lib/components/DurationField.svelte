<script lang="ts">
	import { t, locale } from '../i18n.svelte';
	import { DEFAULT_DURATION_MIN, STEP_MIN, describeDuration, formatHours, normalizeMinutes, parseHours } from '../duration';

	/**
	 * Campo «Durata stimata»: ore con la mezz'ora come .5 (punto o virgola), frecce ±0,5.
	 * Vuoto = durata predefinita (30 minuti, o l'intervallo orario se c'è). `value` è in minuti, `null` = predefinita.
	 */
	let {
		value,
		onchange,
		compact = false,
		fallback = DEFAULT_DURATION_MIN
	}: { value: number | null; onchange: (min: number | null) => void; compact?: boolean; fallback?: number } = $props();

	const dec = $derived(locale().startsWith('en') ? '.' : ',');
	let draft = $state<string | null>(null);
	const shown = $derived(draft ?? (value == null ? '' : formatHours(value, dec)));
	const effective = $derived(value ?? fallback);
	const reading = $derived(describeDuration(effective, t, locale()) + (value == null ? ' · ' + t('predefinita') : ''));

	function commit() {
		if (draft === null) return;
		const r = parseHours(draft);
		draft = null;
		if (r === undefined) return; // testo non valido: si torna al valore precedente
		if (r !== value) onchange(r);
	}
	function nudge(dir: 1 | -1) {
		const base = draft !== null ? (parseHours(draft) ?? fallback) : effective;
		const cur = typeof base === 'number' ? base : effective;
		draft = null;
		onchange(normalizeMinutes(Math.round(cur / STEP_MIN) * STEP_MIN + dir * STEP_MIN));
	}
	function key(e: KeyboardEvent) {
		if (e.key === 'ArrowUp') { e.preventDefault(); nudge(1); }
		else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(-1); }
		else if (e.key === 'Enter') { e.preventDefault(); commit(); (e.currentTarget as HTMLInputElement).blur(); }
		else if (e.key === 'Escape') { e.stopPropagation(); draft = null; (e.currentTarget as HTMLInputElement).blur(); }
	}
</script>

<div class="flex min-w-0 items-center gap-2" data-nodrag>
	<input
		type="text"
		inputmode="decimal"
		autocomplete="off"
		class={compact ? 'w-14 rounded border border-border bg-transparent px-1 py-0.5 text-[11px]' : 'field !w-20 shrink-0'}
		value={shown}
		placeholder={formatHours(fallback, dec)}
		title={compact ? reading : t('Ore: la mezz\'ora è 0,5 (↑ ↓ per cambiare). Vuoto = predefinita')}
		aria-label={t('Durata stimata')}
		oninput={(e) => (draft = e.currentTarget.value)}
		onchange={commit}
		onblur={commit}
		onkeydown={key}
		onclick={(e) => e.stopPropagation()}
	/>
	{#if !compact}
		<span class="min-w-0 truncate text-[12px] text-muted" title={t('1 giorno = 8 h · 1 settimana = 5 giorni · 1 mese = 20 giorni')}>{t('ore')} · {reading}</span>
	{/if}
</div>
