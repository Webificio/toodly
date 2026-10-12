import { defineConfig } from 'vitest/config';

// Test di logica pura (nessun browser, nessun Tauri): `npm test`
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
