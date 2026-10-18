import { describe, expect, it } from 'vitest';
import src from '../src/lib/theme.svelte.ts?raw';
import css from '../src/themes.css?raw';

// theme.svelte.ts usa le rune di Svelte (non importabili qui): se ne leggono gli id dal sorgente
const THEME_STYLES = [...(src.match(/THEME_STYLES[^=]*=\s*\[([\s\S]*?)\n\];/)?.[1] ?? '').matchAll(/id: '([a-z]+)'/g)].map((m) => ({ id: m[1] }));
const DARK_ONLY: string[] = (src.match(/DARK_ONLY[^=]*=\s*\[([^\]]*)\]/)?.[1] ?? '').match(/[a-z]+/g) ?? [];
const isDarkOnly = (id: string) => DARK_ONLY.includes(id);

const VARS = ['bg', 'panel', 'sidebar', 'elev', 'border', 'fg', 'muted', 'faint', 'hover', 'active', 'accent', 'accent-fg', 'p3', 'p2', 'p1', 'p0', 'shadow'];
const block = (sel: string) => css.match(new RegExp(String.raw`${sel.replace(/[.[\]()]/g, '\\$&')} \{([^}]*)\}`))?.[1] ?? '';

describe('temi', () => {
	const styles = THEME_STYLES.filter((s) => s.id !== 'default');
	it('«default» è il primo e gli id sono unici', () => {
		expect(THEME_STYLES[0].id).toBe('default');
		expect(new Set(THEME_STYLES.map((s) => s.id)).size).toBe(THEME_STYLES.length);
	});
	it.each(styles.map((s) => s.id))('%s ha il blocco scuro, e quello chiaro se non è solo scuro', (id) => {
		expect(block(`:root[data-theme='${id}'].dark`)).not.toBe('');
		if (!isDarkOnly(id)) expect(block(`:root[data-theme='${id}']`)).not.toBe('');
	});
	it.each(styles.map((s) => s.id))('%s definisce tutte le variabili di colore (chiaro e scuro)', (id) => {
		const sels = [`:root[data-theme='${id}'].dark`, ...(isDarkOnly(id) ? [] : [`:root[data-theme='${id}']`])];
		for (const sel of sels) for (const v of VARS) expect(block(sel), `${sel} --${v}`).toContain(`--${v}:`);
	});
	it('solo CRT è limitato al modo scuro', () => {
		expect(DARK_ONLY).toEqual(['crt']);
		expect(isDarkOnly('crt')).toBe(true);
		expect(isDarkOnly('nord')).toBe(false);
	});
	it('il CRT usa il monospazio generico, senza nomi di font', () => {
		expect(css).toMatch(/\[data-theme='crt'\] body \{[^}]*font-family: monospace;/);
	});
});
