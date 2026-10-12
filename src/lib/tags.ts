/** Etichette dei task: nel DB sono una stringa di parole minuscole separate da spazio. */

export const MAX_TAG_LEN = 30;

/** Normalizza un'etichetta: minuscolo, senza # o +, solo lettere/numeri/_/-. Stringa vuota se non valida. */
export function normTag(s: string): string {
	return s
		.trim()
		.toLowerCase()
		.replace(/^[#+]+/, '')
		.replace(/[^\p{L}\p{N}_-]/gu, '')
		.slice(0, MAX_TAG_LEN);
}

export function parseTags(s: string | null | undefined): string[] {
	if (!s) return [];
	return [...new Set(s.split(/\s+/).map(normTag).filter(Boolean))];
}

export function joinTags(a: string[] | null | undefined): string {
	return [...new Set((a ?? []).map(normTag).filter(Boolean))].join(' ');
}

export function uniqTags(a: string[] | null | undefined): string[] {
	return parseTags(joinTags(a));
}
