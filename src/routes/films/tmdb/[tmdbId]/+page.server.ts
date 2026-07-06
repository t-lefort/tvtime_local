import { error, redirect } from '@sveltejs/kit';
import { addOrUpdateMovie, getMovieByTmdbId } from '$lib/server/movies';
import { extractProviders, getMovieDetails } from '$lib/server/tmdb';
import type { Actions, PageServerLoad } from './$types';

function tmdbIdFromParam(value: string): number {
	const tmdbId = Number(value);
	if (!Number.isInteger(tmdbId) || tmdbId <= 0) error(404, 'Film introuvable');
	return tmdbId;
}

export const load: PageServerLoad = async ({ params, url }) => {
	const tmdbId = tmdbIdFromParam(params.tmdbId);
	const localMovie = getMovieByTmdbId(tmdbId);
	const details = await getMovieDetails(tmdbId);
	const providers = extractProviders(details['watch/providers']);
	const q = url.searchParams.get('q')?.trim() ?? '';
	const backHref = q ? `/recherche?type=films&q=${encodeURIComponent(q)}` : '/recherche?type=films';

	return {
		backHref,
		localId: localMovie?.id ?? null,
		movie: {
			tmdbId,
			title: details.title || details.original_title,
			originalTitle: details.original_title,
			overview: details.overview || null,
			posterPath: details.poster_path,
			backdropPath: details.backdrop_path,
			releaseDate: details.release_date || null,
			runtime: details.runtime ?? null,
			genres: details.genres.map((g) => g.name),
			providers
		}
	};
};

export const actions: Actions = {
	addMovie: async ({ params }) => {
		const tmdbId = tmdbIdFromParam(params.tmdbId);
		const movie = await addOrUpdateMovie(tmdbId);
		redirect(303, `/films/${movie.id}`);
	}
};
