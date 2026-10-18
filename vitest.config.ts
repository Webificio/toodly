import { defineConfig } from 'vitest/config';

// Test di logica pura (nessun browser, nessun Tauri): `npm test`
// `css.include`: tests/themes.test.ts legge themes.css come testo (`?raw`), che altrimenti in vitest risulta vuoto
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], css: { include: [/themes\.css/] } } });
