import { normTag } from './tags';
import { addDays, todayISO } from './dates';
import type { List, Priority } from './types';

export interface QuickParsed {
	title: string;
	priority: Priority;
	due_date: string | null;
	list_id: string | null;
	tags: string[];
}

/**
 * Parsing leggero del Quick Add:
 *   !alta !media !bassa   priorità
 *   @oggi @domani         scadenza
 *   #NomeLista            lista (prefisso del nome, senza distinzione di maiuscole)
 *   #etichetta +etichetta etichetta (con # solo se non corrisponde a una lista; con + sempre)
 */
export function parseQuick(input: string, lists: List[], withTags = true): QuickParsed {
	const tags: string[] = [];
	let priority: Priority = 0;
	let due: string | null = null;
	let list_id: string | null = null;
	const words: string[] = [];
	for (const w of input.trim().split(/\s+/)) {
		const lw = w.toLowerCase();
		if (lw === '!alta' || lw === '!high' || lw === '!3') priority = 3;
		else if (lw === '!media' || lw === '!medium' || lw === '!2') priority = 2;
		else if (lw === '!bassa' || lw === '!low' || lw === '!1') priority = 1;
		else if (/^@\d{4}-\d{2}-\d{2}$/.test(lw)) due = lw.slice(1);
		else if (lw === '@oggi' || lw === '@today') due = todayISO();
		else if (lw === '@domani' || lw === '@tomorrow') due = addDays(todayISO(), 1);
		else if (lw.startsWith('#') && lw.length > 1) {
			const q = lw.slice(1);
			const found = lists.find((l) => l.name.toLowerCase().startsWith(q));
			if (found) list_id = found.id;
			else if (withTags && normTag(lw)) tags.push(normTag(lw));
			else words.push(w);
		} else if (withTags && lw.startsWith('+') && normTag(lw)) {
			tags.push(normTag(lw));
		} else words.push(w);
	}
	return { title: words.join(' ').trim(), priority, due_date: due, list_id, tags: [...new Set(tags)] };
}
