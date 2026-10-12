import { parseQuick } from './quickparse';
import type { List, Priority } from './types';

export const MAX_TITLE = 80;

export interface BulkItem {
	title: string;
	description: string;
	priority: Priority;
	due_date: string | null;
	list_id: string | null;
	shortened: boolean;
	/** Catena di gruppi (dal livello più alto) dichiarata dalle intestazioni Markdown; vuota = nessun gruppo. */
	groupPath: string[];
}

export interface BulkParse {
	items: BulkItem[];
	/** Tutti i gruppi dichiarati (anche senza task), come catene di nomi. */
	groups: string[][];
}

/** Divide un testo troppo lungo in titolo breve + resto (che va in descrizione). */
export function splitTitle(text: string, max = MAX_TITLE): { title: string; description: string } {
	const s = text.trim();
	if (s.length <= max) return { title: s, description: '' };
	const head = s.slice(0, max + 1);
	// 1) fine frase / clausola entro il limite
	let cut = -1;
	for (const m of head.matchAll(/[.!?;:](?=\s)/g)) if (m.index! >= 15 && m.index! < max) cut = m.index! + 1;
	if (cut > 0) {
		return { title: s.slice(0, cut).replace(/[.;:]+$/, '').trim(), description: s.slice(cut).trim() };
	}
	// 2) ultimo spazio entro il limite (non spezza le parole)
	const sp = head.lastIndexOf(' ', max - 1);
	if (sp >= 15) return { title: s.slice(0, sp).replace(/[,\s]+$/, '') + '…', description: '…' + s.slice(sp + 1).trim() };
	// 3) parola lunghissima: taglio netto
	return { title: s.slice(0, max - 1) + '…', description: '…' + s.slice(max - 1) };
}

/** Intestazione Markdown: da 1 a 6 «#» seguiti da spazio (`#lista` senza spazio è un tag, non un'intestazione). */
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;

/**
 * Testo semplice o Markdown.
 * - una riga non vuota = un task (marcatori `-`, `*`, `1.` e checkbox ignorati; vale la sintassi `!alta @domani #lista`);
 * - un'intestazione `#`, `##`, `###`… crea un gruppo: il numero di `#` ne dà il livello (un `##` dopo un `#` è suo
 *   sottogruppo) e le righe che seguono, con o senza `-`, appartengono a quel gruppo fino alla prossima intestazione.
 */
export function parseBulk(text: string, lists: List[]): BulkParse {
	const items: BulkItem[] = [];
	const groups: string[][] = [];
	// pila delle intestazioni aperte: [livello, nome]
	let stack: { level: number; name: string }[] = [];
	for (const raw of text.split(/\r?\n/)) {
		const h = HEADING.exec(raw);
		if (h) {
			const name = h[2].replace(/[*_`]/g, '').trim();
			if (!name) continue;
			const level = h[1].length;
			stack = stack.filter((x) => x.level < level);
			stack.push({ level, name });
			groups.push(stack.map((x) => x.name));
			continue;
		}
		// toglie i marcatori di elenco (-, *, •, 1.) e le checkbox markdown
		if (/^\s*>/.test(raw)) continue; // citazioni (descrizioni nell'export Markdown): ignorate
		const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, '').trim();
		if (!line) continue;
		const p = parseQuick(line, lists, false);
		if (!p.title) continue;
		const { title, description } = splitTitle(p.title);
		items.push({ title, description, priority: p.priority, due_date: p.due_date, list_id: p.list_id, shortened: !!description, groupPath: stack.map((x) => x.name) });
	}
	return { items, groups };
}
