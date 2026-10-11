<script lang="ts">
	import { drag } from '../dnd.svelte';
</script>

{#if drag.active}
	<div
		class="pointer-events-none fixed z-[100] max-w-64 truncate rounded-lg border border-accent/50 bg-elev px-3 py-1.5 text-[12.5px] font-medium shadow-pop"
		style="left:{drag.x + 14}px;top:{drag.y + 10}px"
	>
		{drag.label || 'Task'}
	</div>
{/if}
