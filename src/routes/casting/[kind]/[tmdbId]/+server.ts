import { error, json } from '@sveltejs/kit';
import { getFullCast } from '$lib/server/tmdb';
import { requireUser } from '$lib/server/users';
import type { RequestHandler } from './$types';

/** `/casting/series/42` et `/casting/films/42` : distribution complète, chargée à la demande. */
const KINDS = { series: 'tv', films: 'movie' } as const;

export const GET: RequestHandler = async ({ params, locals }) => {
	requireUser(locals);
	const kind = KINDS[params.kind as keyof typeof KINDS];
	const tmdbId = Number(params.tmdbId);
	if (!kind || !Number.isInteger(tmdbId) || tmdbId <= 0) error(404, 'Casting introuvable');

	try {
		return json({ cast: await getFullCast(kind, tmdbId) });
	} catch (e) {
		error(502, e instanceof Error ? e.message : 'TMDB indisponible');
	}
};
