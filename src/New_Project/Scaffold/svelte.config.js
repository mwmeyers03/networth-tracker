import adapterAuto from '@sveltejs/adapter-auto';
import adapterStatic from '@sveltejs/adapter-static';

// Use static adapter when building for Tauri desktop app, auto adapter for web
const isTauri = process.env.TAURI_BUILD === '1';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: isTauri
			? adapterStatic({
					fallback: 'index.html',  // Required for SPA routing inside Tauri
					pages: 'build',
					assets: 'build'
			  })
			: adapterAuto()
	}
};

export default config;
