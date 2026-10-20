/** Preferenze di interfaccia salvate in localStorage (prefisso `toodly.`: finiscono anche nei backup). */
const KEY_NUMBERS = 'toodly.showNumbers';
const KEY_ECONOMY = 'toodly.showEconomy';
const KEY_ECO_OFF = 'toodly.economyOff';
const KEY_REMINDERS = 'toodly.reminders';
const KEY_ALLDAY = 'toodly.allDayTime';
const KEY_TOUR = 'toodly.tourDone';
const KEY_DENSITY = 'toodly.density';
const KEY_SCALE = 'toodly.textScale';
const KEY_SECTIONS = 'toodly.drawerClosed';

export const uiprefs = $state<{ showNumbers: boolean; showEconomy: boolean; economyOff: string[]; remindersEnabled: boolean; allDayTime: string; tourDone: boolean; closedSections: string[]; density: 'compact' | 'normal' | 'comfy'; textScale: number }>({
	showNumbers: false,
	showEconomy: false,
	economyOff: [],
	remindersEnabled: true,
	allDayTime: '09:00',
	tourDone: true,
	closedSections: [],
	density: 'normal',
	textScale: 100
});

function get(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}
function put(key: string, v: string) {
	try {
		localStorage.setItem(key, v);
	} catch {}
}

/** Densità delle righe e dimensione dell'interfaccia (zoom del documento). */
function applyAppearance() {
	const el = document.documentElement;
	el.dataset.density = uiprefs.density;
	el.style.setProperty('zoom', uiprefs.textScale === 100 ? '' : String(uiprefs.textScale / 100));
}

function load() {
	uiprefs.showNumbers = get(KEY_NUMBERS) === '1';
	uiprefs.showEconomy = get(KEY_ECONOMY) === '1';
	try {
		const off = JSON.parse(get(KEY_ECO_OFF) ?? '[]');
		uiprefs.economyOff = Array.isArray(off) ? off.filter((x) => typeof x === 'string') : [];
	} catch {
		uiprefs.economyOff = [];
	}
	uiprefs.remindersEnabled = get(KEY_REMINDERS) !== '0';
	const t = get(KEY_ALLDAY);
	uiprefs.allDayTime = t && /^\d{2}:\d{2}$/.test(t) ? t : '09:00';
	uiprefs.tourDone = get(KEY_TOUR) === '1';
	const d = get(KEY_DENSITY);
	uiprefs.density = d === 'compact' || d === 'comfy' ? d : 'normal';
	const sc = Number(get(KEY_SCALE));
	uiprefs.textScale = [90, 100, 110, 125].includes(sc) ? sc : 100;
	applyAppearance();
	try {
		const arr = JSON.parse(get(KEY_SECTIONS) ?? '[]');
		uiprefs.closedSections = Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
	} catch {
		uiprefs.closedSections = [];
	}
}

export function initUiPrefs() {
	load();
	// le altre finestre condividono localStorage: le preferenze restano sincronizzate
	window.addEventListener('storage', (e) => {
		if (e.key && e.key.startsWith('toodly.')) load();
	});
}

export function setShowNumbers(v: boolean) {
	uiprefs.showNumbers = v;
	put(KEY_NUMBERS, v ? '1' : '0');
}
export function setShowEconomy(v: boolean) {
	uiprefs.showEconomy = v;
	put(KEY_ECONOMY, v ? '1' : '0');
}
/** Mostra o nasconde gli importi in una vista (o superficie) quando «Economia» è attiva. */
export function setEconomyIn(view: string, on: boolean) {
	uiprefs.economyOff = on ? uiprefs.economyOff.filter((v) => v !== view) : [...new Set([...uiprefs.economyOff, view])];
	put(KEY_ECO_OFF, JSON.stringify(uiprefs.economyOff));
}
export function setRemindersEnabled(v: boolean) {
	uiprefs.remindersEnabled = v;
	put(KEY_REMINDERS, v ? '1' : '0');
}
export function setAllDayTime(v: string) {
	if (!/^\d{2}:\d{2}$/.test(v)) return;
	uiprefs.allDayTime = v;
	put(KEY_ALLDAY, v);
}
export function setTourDone(v: boolean) {
	uiprefs.tourDone = v;
	put(KEY_TOUR, v ? '1' : '0');
}
export function toggleSection(key: string) {
	uiprefs.closedSections = uiprefs.closedSections.includes(key)
		? uiprefs.closedSections.filter((k) => k !== key)
		: [...uiprefs.closedSections, key];
	put(KEY_SECTIONS, JSON.stringify(uiprefs.closedSections));
}
export function setDensity(v: 'compact' | 'normal' | 'comfy') {
	uiprefs.density = v;
	put(KEY_DENSITY, v);
	applyAppearance();
}
export function setTextScale(v: number) {
	uiprefs.textScale = v;
	put(KEY_SCALE, String(v));
	applyAppearance();
}
