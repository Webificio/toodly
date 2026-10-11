import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

/** Markdown -> HTML sanificato. Le checkbox della todo-list restano cliccabili. */
export function renderMarkdown(src: string): string {
	const raw = marked.parse(src ?? '', { async: false }) as string;
	const clean = DOMPurify.sanitize(raw, {
		ADD_TAGS: ['input'],
		ADD_ATTR: ['checked', 'type', 'target']
	});
	return clean.replace(/<input([^>]*?)disabled(="")?([^>]*?)>/g, '<input$1$3>');
}

/** Inverte la n-esima checkbox `- [ ]` / `- [x]` nel sorgente markdown. */
export function toggleCheckbox(src: string, index: number): string {
	const lines = src.split('\n');
	let n = 0;
	let inFence = false;
	for (let i = 0; i < lines.length; i++) {
		if (/^\s*(```|~~~)/.test(lines[i])) inFence = !inFence;
		if (inFence) continue;
		const m = lines[i].match(/^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\]/);
		if (m) {
			if (n === index) {
				lines[i] = lines[i].replace(/\[( |x|X)\]/, m[2] === ' ' ? '[x]' : '[ ]');
				break;
			}
			n++;
		}
	}
	return lines.join('\n');
}
