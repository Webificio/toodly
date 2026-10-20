<script lang="ts">
	import type { Summary } from '../money';

	/** Piccola pillola con un importo (margine o costo), verde o rossa; il dettaglio è nel tooltip. */
	let { money, class: cls = '' }: { money: Summary | null; class?: string } = $props();
</script>

{#if money}
	<span
		class="inline-flex shrink-0 items-center rounded-full border border-border px-1.5 py-px text-[11px] font-medium whitespace-nowrap tabular-nums {cls}"
		style={money.tone === 'neg' ? 'color:var(--p3)' : money.tone === 'pos' ? 'color:var(--ok,#22a06b)' : ''}
		title={money.tip}>{money.text}</span
	>
{/if}
