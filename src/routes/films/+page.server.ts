import { matchesQuery, parseQuery } from '$lib/library';
import { parseSort } from '$lib/sort';
import { getLibraryCounts } from '$lib/server/library';
import { getMoviesWithWatch } from '$lib/server/queries';
import { requireUser } from '$lib/server/users';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, locals }) => {
	const user = requireUser(locals);
	const filter = url.searchParams.get('filtre') ?? 'tous';
	const sort = parseSort(url.searchParams.get('tri'));
	const { q, needle } = parseQuery(url.searchParams.get('q'));
	const all = getMoviesWithWatch(user.id).filter((m) => matchesQuery(needle, [m.title, m.originalTitle]));

	// Les compteurs portent sur le résultat de la recherche : les puces disent
	// combien de titres restent dans chaque catégorie.
	const counts = {
		tous: all.length,
		avoir: all.filter((m) => m.watchCount === 0).length,
		vus: all.filter((m) => m.watchCount > 0).length,
		favoris: all.filter((m) => m.favorite).length
	};

	const filtered =
		filter === 'avoir'
			? all.filter((m) => m.watchCount === 0)
			: filter === 'vus'
				? all.filter((m) => m.watchCount > 0)
				: filter === 'favoris'
					? all.filter((m) => m.favorite)
					: all;

	const movies = filtered.map((m) => ({
		id: m.id,
		tmdbId: m.tmdbId,
		title: m.title,
		posterPath: m.posterPath,
		releaseDate: m.releaseDate,
		favorite: m.favorite,
		watchCount: m.watchCount,
		lastWatchedAt: m.lastWatchedAt,
		addedAt: m.addedAt
	}));

	if (sort === 'alpha') {
		movies.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
	} else {
		// Activité la plus récente d'abord (dernier visionnage, sinon date d'ajout)
		movies.sort((a, b) =>
			(b.lastWatchedAt ?? b.addedAt).localeCompare(a.lastWatchedAt ?? a.addedAt)
		);
	}

	return { movies, filter, sort, counts, q, libraryCounts: getLibraryCounts(user.id) };
};
