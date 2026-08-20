import { parseQuery } from '$lib/library';
import { parseSort } from '$lib/sort';
import { appToday } from '$lib/server/dates';
import { getLibraryCounts } from '$lib/server/library';
import { getMoviesWithWatch } from '$lib/server/queries';
import { requireUser } from '$lib/server/users';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, locals }) => {
	const user = requireUser(locals);
	// Comme pour les séries : la collection part en une fois et la page se
	// charge du filtre, du tri et de la recherche, sans aller-retour serveur.
	const movies = getMoviesWithWatch(user.id).map((m) => ({
		id: m.id,
		tmdbId: m.tmdbId,
		title: m.title,
		originalTitle: m.originalTitle,
		posterPath: m.posterPath,
		releaseDate: m.releaseDate,
		favorite: m.favorite,
		watchCount: m.watchCount,
		lastWatchedAt: m.lastWatchedAt,
		addedAt: m.addedAt
	}));

	return {
		movies,
		filter: url.searchParams.get('filtre') ?? 'tous',
		sort: parseSort(url.searchParams.get('tri')),
		q: parseQuery(url.searchParams.get('q')).q,
		// Le jour de référence vient du serveur : c'est lui qui dit, dans le fuseau
		// de l'instance, quels films ne sont pas encore sortis.
		today: appToday(),
		libraryCounts: getLibraryCounts(user.id)
	};
};
