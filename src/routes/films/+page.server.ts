import { getMoviesWithWatch } from '$lib/server/queries';
import { requireUser } from '$lib/server/users';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, locals }) => {
	const filter = url.searchParams.get('filtre') ?? 'tous';
	const all = getMoviesWithWatch(requireUser(locals).id);

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

	// Activité la plus récente d'abord (dernier visionnage, sinon date d'ajout)
	movies.sort((a, b) =>
		(b.lastWatchedAt ?? b.addedAt).localeCompare(a.lastWatchedAt ?? a.addedAt)
	);

	return { movies, filter, counts };
};
