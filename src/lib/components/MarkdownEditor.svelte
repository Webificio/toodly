<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { Bold, Italic, Heading2, List, ListOrdered, ListChecks, Code, Quote, Strikethrough, LayoutTemplate, Eye, Pencil } from '@lucide/svelte';
	import { renderMarkdown, toggleCheckbox } from '../markdown';
	import { openExternal } from '../windowing';
	import { t } from '../i18n.svelte';

	let { value, onsave, placeholder }: { value: string; onsave: (v: string) => void; placeholder?: string } = $props();
	const ph = $derived(placeholder ?? t('Aggiungi una descrizione… (supporta Markdown)'));

	// svelte-ignore state_referenced_locally
	let text = $state(value);
	let editing = $state(false);
	let ta = $state<HTMLTextAreaElement>();
	let timer: ReturnType<typeof setTimeout> | undefined;

	// se il valore cambia dall'esterno (altra finestra) e non stiamo scrivendo, aggiorna
	$effect(() => {
		if (!editing) text = value;
	});

	const html = $derived(renderMarkdown(text));

	function commit() {
		clearTimeout(timer);
		if (text !== value) onsave(text);
	}
	function changed() {
		clearTimeout(timer);
		timer = setTimeout(commit, 600);
	}
	function edit() {
		editing = true;
		queueMicrotask(() => ta?.focus());
	}
	function done() {
		commit();
		editing = false;
	}

	function setText(next: string, selStart: number, selEnd: number) {
		text = next;
		changed();
		queueMicrotask(() => {
			ta?.focus();
			ta?.setSelectionRange(selStart, selEnd);
		});
	}

	function wrap(before: string, after = before, ph = t('testo')) {
		if (!ta) return;
		const { selectionStart: s, selectionEnd: e } = ta;
		const sel = text.slice(s, e) || ph;
		setText(text.slice(0, s) + before + sel + after + text.slice(e), s + before.length, s + before.length + sel.length);
	}

	function prefixLines(make: (i: number) => string) {
		if (!ta) return;
		const { selectionStart: s, selectionEnd: e } = ta;
		const ls = text.lastIndexOf('\n', s - 1) + 1;
		let le = text.indexOf('\n', e);
		if (le < 0) le = text.length;
		const block = text.slice(ls, le).split('\n').map((l, i) => make(i) + l).join('\n');
		setText(text.slice(0, ls) + block + text.slice(le), ls, ls + block.length);
	}

	function codeBlock() {
		if (!ta) return;
		const { selectionStart: s, selectionEnd: e } = ta;
		const sel = text.slice(s, e);
		if (sel.includes('\n') || sel === '') {
			const ins = '```\n' + (sel || t('codice')) + '\n```';
			setText(text.slice(0, s) + ins + text.slice(e), s + 4, s + 4 + (sel || t('codice')).length);
		} else wrap('`', '`', t('codice'));
	}

	const templates = $derived<{ label: string; body: string }[]>([
		{ label: t('Checklist'), body: `- [ ] ${t('Primo passo')}\n- [ ] ${t('Secondo passo')}\n- [ ] ${t('Terzo passo')}\n` },
		{ label: t('Passi numerati'), body: `1. ${t('Passo uno')}\n2. ${t('Passo due')}\n3. ${t('Passo tre')}\n` },
		{ label: t('Pro / Contro'), body: `### ${t('Pro')}\n- \n\n### ${t('Contro')}\n- \n` },
		{ label: t('Note di riunione'), body: `### ${t('Partecipanti')}\n- \n\n### ${t('Decisioni')}\n- \n\n### ${t('Azioni')}\n- [ ] \n` },
		{ label: t('Blocco di codice'), body: '```\n\n```\n' }
	]);
	function insertTemplate(body: string) {
		if (!ta) {
			edit();
		}
		const pos = ta?.selectionStart ?? text.length;
		const pre = pos > 0 && text[pos - 1] !== '\n' ? '\n' : '';
		setText(text.slice(0, pos) + pre + body + text.slice(pos), pos + pre.length + body.length, pos + pre.length + body.length);
	}

	function keydown(e: KeyboardEvent) {
		const mod = e.ctrlKey || e.metaKey;
		if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); wrap('**'); return; }
		if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); wrap('*'); return; }
		if (e.key === 'Escape') { e.stopPropagation(); done(); return; }
		if (e.key === 'Enter' && !e.shiftKey && !mod && ta) {
			// continua automaticamente elenchi puntati / numerati / checklist
			const pos = ta.selectionStart;
			const ls = text.lastIndexOf('\n', pos - 1) + 1;
			const line = text.slice(ls, pos);
			const m = line.match(/^(\s*)([-*+]|\d+[.)])\s(\[[ xX]\]\s)?/);
			if (m) {
				e.preventDefault();
				if (line.trim() === m[0].trim()) {
					// riga vuota: termina l'elenco
					setText(text.slice(0, ls) + text.slice(pos), ls, ls);
					return;
				}
				let marker = m[2];
				const num = marker.match(/^(\d+)([.)])$/);
				if (num) marker = `${Number(num[1]) + 1}${num[2]}`;
				const ins = '\n' + m[1] + marker + ' ' + (m[3] ? '[ ] ' : '');
				setText(text.slice(0, pos) + ins + text.slice(pos), pos + ins.length, pos + ins.length);
			}
		}
	}

	function previewClick(e: MouseEvent) {
		const el = e.target as HTMLElement;
		if (el instanceof HTMLInputElement && el.type === 'checkbox') {
			e.preventDefault();
			const all = Array.from((e.currentTarget as HTMLElement).querySelectorAll('input[type=checkbox]'));
			text = toggleCheckbox(text, all.indexOf(el));
			commit();
			return;
		}
		const a = el.closest('a');
		if (a) {
			e.preventDefault();
			openExternal(a.getAttribute('href') ?? '');
			return;
		}
		if (!window.getSelection()?.toString()) edit();
	}
</script>

<div class="rounded-xl border border-border bg-panel transition-colors {editing ? 'border-accent' : ''}">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div onmousedown={(e) => e.preventDefault()} class="flex items-center gap-0.5 border-b border-border px-1.5 py-1 {editing ? '' : 'hidden'}">
		<button class="icon-btn" title={t('Grassetto (Ctrl+B)')} onclick={() => wrap('**')}><Bold size={15} /></button>
		<button class="icon-btn" title={t('Corsivo (Ctrl+I)')} onclick={() => wrap('*')}><Italic size={15} /></button>
		<button class="icon-btn" title={t('Barrato')} onclick={() => wrap('~~')}><Strikethrough size={15} /></button>
		<button class="icon-btn" title={t('Titolo')} onclick={() => prefixLines(() => '## ')}><Heading2 size={15} /></button>
		<span class="mx-1 h-4 w-px bg-border"></span>
		<button class="icon-btn" title={t('Elenco puntato')} onclick={() => prefixLines(() => '- ')}><List size={15} /></button>
		<button class="icon-btn" title={t('Elenco numerato')} onclick={() => prefixLines((i) => `${i + 1}. `)}><ListOrdered size={15} /></button>
		<button class="icon-btn" title={t('Checklist')} onclick={() => prefixLines(() => '- [ ] ')}><ListChecks size={15} /></button>
		<button class="icon-btn" title={t('Citazione')} onclick={() => prefixLines(() => '> ')}><Quote size={15} /></button>
		<button class="icon-btn" title={t('Codice')} onclick={codeBlock}><Code size={15} /></button>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="icon-btn" title={t('Template')}><LayoutTemplate size={15} /></DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content class="menu" sideOffset={4} align="start">
					{#each templates as tpl}
						<DropdownMenu.Item class="menu-item" onSelect={() => insertTemplate(tpl.body)}>{tpl.label}</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
		<button class="btn btn-ghost ml-auto h-7" onclick={done}><Eye size={14} /> {t('Anteprima')}</button>
	</div>

	{#if editing}
		<textarea
			bind:this={ta}
			bind:value={text}
			oninput={changed}
			onblur={(e) => {
				// non uscire dalla modifica se il focus passa alla toolbar
				const next = e.relatedTarget as HTMLElement | null;
				if (!next || !e.currentTarget.parentElement?.contains(next)) done();
			}}
			onkeydown={keydown}
			rows="16"
			placeholder={ph}
			class="block min-h-72 w-full resize-y bg-transparent px-3 py-2.5 font-mono text-[12.5px] leading-relaxed outline-none"
		></textarea>
	{:else}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="group relative min-h-44 cursor-text px-3 py-2.5" onclick={previewClick}>
			{#if text.trim()}
				<div class="md text-[13.5px]">{@html html}</div>
			{:else}
				<p class="text-faint">{ph}</p>
			{/if}
			<span class="absolute top-2 right-2 text-faint opacity-0 transition-opacity group-hover:opacity-100"><Pencil size={13} /></span>
		</div>
	{/if}
</div>
