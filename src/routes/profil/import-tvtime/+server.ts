import { json } from '@sveltejs/kit';
import { getTvTimeImportJob } from '$lib/server/tvtime-import';
import type { RequestHandler } from './$types';

/** Statut de l'import TV Time en cours (ou du dernier terminé), pour le suivi côté page profil. */
export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) return json(null, { status: 401 });
	return json(getTvTimeImportJob());
};
