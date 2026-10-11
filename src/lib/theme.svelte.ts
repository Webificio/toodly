export type Theme = 'light' | 'dark' | 'system';
const KEY = 'toodly.theme';

function read(): Theme {
	try {
		const v = localStorage.getItem(KEY);
		return v === 'light' || v === 'dark' ? v : 'system';
	} catch {
		return 'system';
	}
}

function apply(t: Theme) {
	const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
	document.documentElement.classList.toggle('dark', dark);
}

export const theme = $state<{ value: Theme }>({ value: 'system' });

export function initTheme() {
	theme.value = read();
	apply(theme.value);
	matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(theme.value));
	// le altre finestre condividono localStorage: mantieni il tema sincronizzato
	window.addEventListener('storage', (e) => {
		if (e.key === KEY) {
			theme.value = read();
			apply(theme.value);
		}
	});
}

export function setTheme(t: Theme) {
	theme.value = t;
	try {
		localStorage.setItem(KEY, t);
	} catch {}
	apply(t);
}
