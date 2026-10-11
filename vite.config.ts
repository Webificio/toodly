import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			// SPA statica: Tauri serve i file di `build/` e ogni rotta ricade su index.html
			adapter: adapter({ pages: 'build', assets: 'build', fallback: 'index.html', precompress: false, strict: false })
		})
	],
	define: { __APP_VERSION__: JSON.stringify(pkg.version) },
	clearScreen: false,
	server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } }
});
