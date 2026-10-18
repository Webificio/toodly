<script lang="ts">
	import { Copy, Download } from '@lucide/svelte';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { nav, showToast } from '../nav.svelte';
	import { parseScope } from '../views';
	import { exportMapMd } from '../exportmap';

	/** Pulsanti «Mermaid» e «Copia» di Orbit e Metro. `build` restituisce il testo (o '' se non c'è nulla), dato il titolo. */
	let { kind, build }: { kind: 'orbit' | 'metro'; build: (title: string) => string } = $props();

	const info = $derived(parseScope(nav.scope));
	const title = $derived.by(() => {
		if (info.kind === 'list') return store.listOf(info.id)?.name ?? t('Lista');
		if (info.kind === 'tag') return '#' + info.id;
		if (info.kind === 'filter') return store.filters.find((f) => f.id === info.id)?.name ?? t('Filtro');
		return t('Tutti i task');
	});
	async function save() {
		try {
			const dest = await exportMapMd(build(title), title, kind);
			if (dest === 'empty') showToast(t('Nessun task da esportare'));
			else if (dest) showToast(t('Esportato in Mermaid'));
		} catch (e) {
			console.error(e);
			showToast(t('Esportazione non riuscita'));
		}
	}
	async function copy() {
		const md = build(title);
		if (!md) return showToast(t('Nessun task da esportare'));
		try {
			await navigator.clipboard.writeText(md);
			showToast(t('Mermaid copiato negli appunti'));
		} catch {
			showToast(t('Operazione non riuscita'));
		}
	}
</script>

<span class="h-4 w-px bg-border"></span>
<button class="btn h-7 border-transparent bg-transparent" title={t('Esporta in Mermaid (.md)')} onclick={save}><Download size={14} />Mermaid</button>
<button class="icon-btn size-7" title={t('Copia Mermaid')} aria-label={t('Copia Mermaid')} onclick={copy}><Copy size={15} /></button>
