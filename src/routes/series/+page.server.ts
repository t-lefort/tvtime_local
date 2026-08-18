import { parseQuery } from '$lib/library';
import { parseSort } from '$lib/sort';
import { getLibraryCounts } from '$lib/server/library';
import { getShowsWithProgress } from '$lib/server/queries';
import { requireUser } from '$lib/server/users';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, locals }) => {
	const user = requireUser(locals);
	// La liste complète part en une fois : recherche, puces et tri sont
	// appliqués par la page elle-même, donc sans aller-retour serveur. Les
	// paramètres d'URL ne servent plus qu'à retrouver le même écran au
	// chargement (partage, rechargement, rendu sans JavaScript).
	const shows = getShowsWithProgress(user.id).map((s) => ({
		id: s.id,
		tmdbId: s.tmdbId,
		name: s.name,
		originalName: s.originalName,
		posterPath: s.posterPath,
		state: s.state,
		favorite: s.favorite,
		airedCount: s.airedCount,
		watchedCount: s.watchedCount,
		lastWatchedAt: s.lastWatchedAt
	}));

	return {
		shows,
		filter: url.searchParams.get('filtre') ?? 'toutes',
		sort: parseSort(url.searchParams.get('tri')),
		q: parseQuery(url.searchParams.get('q')).q,
		libraryCounts: getLibraryCounts(user.id)
	};
};
