<script lang="ts">
	import { onMount } from 'svelte';
	import { listen } from '@tauri-apps/api/event';
	import { Plus } from '@lucide/svelte';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { parseQuick } from '../quickparse';
	import { hideQuick } from '../windowing';
	import { setWorkspace } from '../db';
	import { animate } from 'motion';

	let value = $state('');
	let input: HTMLInputElement;
	let box: HTMLDivElement;

	function focusBar() {
		value = '';
		input?.focus();
		if (box) animate(box, { opacity: [0, 1], y: [-8, 0], scale: [0.98, 1] }, { duration: 0.2, ease: [0.22, 1, 0.36, 1] });
	}

	onMount(() => {
		input?.focus();
		document.documentElement.style.background = 'transparent';
		document.body.style.background = 'transparent';
		// il Quick Add scrive nello spazio dati della finestra attiva (indicato dal backend)
		const un = listen<string>('quick-show', async (e) => {
			if (e.payload) {
				setWorkspace(e.payload);
				await store.reload().catch(console.error); // le liste potrebbero essere cambiate
			}
			focusBar();
		});
		window.addEventListener('focus', () => input?.focus());
		return () => { un.then((f) => f()); };
	});

	async function submit() {
		const text = value.trim();
		if (!text) return hideQuick();
		const p = parseQuick(text, store.lists);
		value = '';
		hideQuick(); // la barra scompare subito, restituendo il focus al sistema
		if (p.title) await store.createTask({ title: p.title, priority: p.priority, due_date: p.due_date, list_id: p.list_id });
	}
</script>

<div class="grid h-screen place-items-center p-3">
	<div bind:this={box} class="flex h-14 w-full items-center gap-3 rounded-2xl border border-border bg-elev px-4 shadow-pop">
		<Plus size={20} class="shrink-0 text-accent" />
		<input
			bind:this={input}
			bind:value
			placeholder={t('Nuovo task…   (!alta  @domani  #lista)')}
			class="h-full min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-faint"
			onkeydown={(e) => {
				if (e.key === 'Enter' && !e.isComposing) submit();
				else if (e.key === 'Escape') hideQuick();
			}}
		/>
		<kbd class="rounded border border-border px-1.5 py-0.5 text-[11px] text-faint">{t('Invio')}</kbd>
	</div>
</div>
