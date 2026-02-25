import adapterStatic from '@sveltejs/adapter-static';
import adapterVercel from '@sveltejs/adapter-vercel';

// Use static adapter when building for Tauri desktop app, Vercel adapter for web
const isTauri = process.env.TAURI_BUILD === '1';
const isVercel = process.env.VERCEL === '1';
const isWinLocal = process.platform === 'win32' && !isVercel && !isTauri;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: isTauri
			? adapterStatic({
					fallback: 'index.html', // Required for SPA routing inside Tauri
					pages: 'build',
					assets: 'build'
				})
			: isVercel
			? adapterVercel()
			: isWinLocal
			? adapterStatic({
					fallback: 'index.html'
				})
			: adapterStatic({
					fallback: 'index.html'
			  })
	}
};

export default config;
