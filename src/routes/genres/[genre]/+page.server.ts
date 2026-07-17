import { error } from '@sveltejs/kit';
import { getMoviesWithWatch, getShowsWithProgress } from '$lib/server/queries';
import { requireUser } from '$lib/server/users';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	const user = requireUser(locals);
	const genre = params.genre;

	const hasGenre = (raw: string) => {
		try {
			return (JSON.parse(raw) as string[]).includes(genre);
		} catch {
			return false;
		}
	};

	const shows = getShowsWithProgress(user.id)
		.filter((s) => hasGenre(s.genres))
		.map((s) => ({
			tmdbId: s.tmdbId,
			name: s.name,
			posterPath: s.posterPath,
			state: s.state,
			favorite: s.favorite,
			watchedCount: s.watchedCount,
			airedCount: s.airedCount
		}));

	const movies = getMoviesWithWatch(user.id)
		.filter((m) => hasGenre(m.genres))
		.map((m) => ({
			tmdbId: m.tmdbId,
			title: m.title,
			posterPath: m.posterPath,
			releaseDate: m.releaseDate,
			favorite: m.favorite,
			watchCount: m.watchCount
		}));

	if (!shows.length && !movies.length) error(404, 'Aucun média pour ce genre');

	return { genre, shows, movies };
};
