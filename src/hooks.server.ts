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
	return resolve(event);
};
