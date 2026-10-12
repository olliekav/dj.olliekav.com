// Service worker: keeps the app shell and the last mix list for offline launches.
// Audio and stream URLs are never cached: they're signed and short-lived, and
// SoundCloud's terms don't allow offline listening. Cross-origin requests pass through.

const CACHE = 'ok-sessions-v1';
const SHELL = '/';

/** Built files referenced by the shell, e.g. /assets/index-RzK1jSrl.js */
const assetsIn = html => [...new Set(html.match(/\/assets\/[^"'\s)]+/g) ?? [])];

/** Caches a fresh shell and its assets, dropping built files the shell no longer uses. */
const updateShell = async response => {
	const cache = await caches.open(CACHE);
	const assets = assetsIn(await response.clone().text());
	await cache.put(SHELL, response);
	await Promise.all(
		assets.map(async asset => (await cache.match(asset)) || cache.add(asset).catch(() => {}))
	);
	const keys = await cache.keys();
	await Promise.all(
		keys
			.map(request => new URL(request.url).pathname)
			.filter(path => /^\/assets\/.+\.(js|css)$/.test(path) && !assets.includes(path))
			.map(path => cache.delete(path))
	);
};

self.addEventListener('install', event => {
	event.waitUntil(
		fetch(SHELL, { cache: 'no-cache' })
			.then(response => response.ok && updateShell(response))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', event => {
	event.waitUntil(
		caches
			.keys()
			.then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

/** Network first, falling back to the cache (or the shell, for pages) when offline. */
const networkFirst = async (event, fallback) => {
	try {
		const response = await fetch(event.request);
		if (response.ok && response.type === 'basic') {
			const { pathname } = new URL(event.request.url);
			if (pathname === SHELL) {
				event.waitUntil(updateShell(response.clone()));
			} else if (!fallback && response.headers.get('content-type')?.includes('json')) {
				const copy = response.clone();
				event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
			}
		}
		return response;
	} catch (error) {
		const cached = await caches.match(event.request, { ignoreSearch: true });
		const offline = cached ?? (fallback && (await caches.match(fallback)));
		if (offline) {
			return offline;
		}
		throw error;
	}
};

/** Built files are content-hashed, so a cached copy is always current. */
const cacheFirst = async event => {
	const cached = await caches.match(event.request);
	if (cached) {
		return cached;
	}
	const response = await fetch(event.request);
	if (response.ok) {
		const copy = response.clone();
		event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
	}
	return response;
};

self.addEventListener('fetch', event => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== self.location.origin) {
		return;
	}
	if (request.mode === 'navigate') {
		event.respondWith(networkFirst(event, SHELL));
	} else if (url.pathname.startsWith('/assets/')) {
		event.respondWith(cacheFirst(event));
	} else if (url.pathname === '/api/mixes') {
		event.respondWith(networkFirst(event));
	}
});
