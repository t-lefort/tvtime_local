import 'dotenv/config';
import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { building } from '$app/environment';
import { authEnabled, isValidSession } from '$lib/server/auth';

export const init: ServerInit = async () => {
	if (building) return;
	await import('$lib/server/db'); // ouvre la base et applique les migrations
	const { startDailySync } = await import('$lib/server/sync');
	startDailySync();
};

export const handle: Handle = async ({ event, resolve }) => {
	if (authEnabled() && event.url.pathname !== '/login') {
		if (!isValidSession(event.cookies.get('session'))) {
			redirect(303, '/login');
		}
	}

	// Résolution du profil actif (multi-utilisateurs) ; /profils permet d'en choisir un
	if (event.url.pathname !== '/login') {
		const { USER_COOKIE, userFromCookie } = await import('$lib/server/users');
		event.locals.user = userFromCookie(event.cookies.get(USER_COOKIE)) ?? null;
		if (!event.locals.user && event.url.pathname !== '/profils') {
			redirect(303, '/profils');
		}
	} else {
		event.locals.user = null;
	}

	return resolve(event);
};
