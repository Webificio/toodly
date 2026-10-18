/** Modo: chiaro, scuro o quello del sistema. Si combina con lo *stile* (vedi `THEME_STYLES`). */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Stile grafico: palette, forme e dettagli. `default` è l'aspetto storico di toodly; gli altri sono definiti
 * in `src/themes.css` come blocchi `:root[data-theme='<id>']` (chiaro) e `:root[data-theme='<id>'].dark` (scuro).
 * Il font non cambia mai, tranne in CRT che usa il monospazio di sistema.
 */
export type ThemeStyle = 'default' | 'material' | 'crt' | 'nord' | 'solarized' | 'dracula' | 'gruvbox' | 'rose';

export const THEME_STYLES: ReadonlyArray<{ id: ThemeStyle; label: string }> = [
	{ id: 'default', label: 'Predefinito' },
	{ id: 'material', label: 'Material' },
	{ id: 'crt', label: 'CRT' },
	{ id: 'nord', label: 'Nord' },
	{ id: 'solarized', label: 'Solarized' },
	{ id: 'dracula', label: 'Dracula' },
	{ id: 'gruvbox', label: 'Gruvbox' },
	{ id: 'rose', label: 'Rosé Pine' }
];

/** Stili che esistono solo in scuro: il modo chiaro/sistema viene ignorato. */
export const DARK_ONLY: ReadonlyArray<ThemeStyle> = ['crt'];
export const isDarkOnly = (s: ThemeStyle) => DARK_ONLY.includes(s);

const KEY = 'toodly.theme';
const KEY_STYLE = 'toodly.themestyle';

function read(): Theme {
	try {
		const v = localStorage.getItem(KEY);
		return v === 'light' || v === 'dark' ? v : 'system';
	} catch {
		return 'system';
	}
}

function readStyle(): ThemeStyle {
	try {
		const v = localStorage.getItem(KEY_STYLE);
		return THEME_STYLES.some((s) => s.id === v) ? (v as ThemeStyle) : 'default';
	} catch {
		return 'default';
	}
}

function apply(t: Theme, style: ThemeStyle) {
	const dark = isDarkOnly(style) || t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
	const el = document.documentElement;
	el.classList.toggle('dark', dark);
	if (style === 'default') el.removeAttribute('data-theme');
	else el.setAttribute('data-theme', style);
}

export const theme = $state<{ value: Theme; style: ThemeStyle }>({ value: 'system', style: 'default' });

export function initTheme() {
	theme.value = read();
	theme.style = readStyle();
	apply(theme.value, theme.style);
	matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(theme.value, theme.style));
	// le altre finestre condividono localStorage: mantieni il tema sincronizzato
	window.addEventListener('storage', (e) => {
		if (e.key === KEY || e.key === KEY_STYLE) {
			theme.value = read();
			theme.style = readStyle();
			apply(theme.value, theme.style);
		}
	});
}

export function setTheme(t: Theme) {
	theme.value = t;
	try {
		localStorage.setItem(KEY, t);
	} catch {}
	apply(t, theme.style);
}

export function setThemeStyle(s: ThemeStyle) {
	theme.style = s;
	try {
		localStorage.setItem(KEY_STYLE, s);
	} catch {}
	apply(theme.value, s);
}
