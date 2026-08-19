import 'dotenv/config';
import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { building } from '$app/environment';
import { compressResponse } from '$lib/server/compress';

export const init: ServerInit = async () => {
	if (building) return;
	await import('$lib/server/db'); // ouvre la base et applique les migrations
	const { startDailySync } = await import('$lib/server/sync');
	startDailySync();
};

export const handle: Handle = async ({ event, resolve }) => {
	// Résolution du profil actif (multi-utilisateurs) ; /profils permet d'en choisir un
	const { USER_COOKIE, userFromCookie } = await import('$lib/server/users');
	const user = userFromCookie(event.cookies.get(USER_COOKIE));
	// Champs sensibles (hash, image) volontairement absents des locals
	event.locals.user = user
		? { id: user.id, name: user.name, hideSuggestions: user.hideSuggestions }
		: null;
	if (!event.locals.user && !event.url.pathname.startsWith('/profils')) {
		redirect(303, '/profils');
	}

	// L'ajout d'un livre s'est fondu dans la recherche : le scan et la saisie
	// manuelle y vivent désormais, sous l'onglet « Livres ». L'ancienne page
	// autonome garde ses marque-pages et ses liens en y menant.
	if (event.url.pathname === '/livres/ajouter') {
		const q = event.url.searchParams.get('q');
		redirect(308, `/recherche?type=livres${q ? `&q=${encodeURIComponent(q)}` : ''}`);
	}

	return compressResponse(await resolve(event), event.request.headers.get('accept-encoding') ?? '');
};
