import { error, redirect } from '@sveltejs/kit';
import { addOrUpdateShow, getShowByTmdbId } from '$lib/server/shows';
import { extractCast, extractProviders, getShowDetails } from '$lib/server/tmdb';
import type { Actions, PageServerLoad } from './$types';

function tmdbIdFromParam(value: string): number {
	const tmdbId = Number(value);
	if (!Number.isInteger(tmdbId) || tmdbId <= 0) error(404, 'Série introuvable');
	return tmdbId;
}

export const load: PageServerLoad = async ({ params, url }) => {
	const tmdbId = tmdbIdFromParam(params.tmdbId);
	const localShow = getShowByTmdbId(tmdbId);
	const details = await getShowDetails(tmdbId);
	const providers = extractProviders(details['watch/providers']);
	const cast = extractCast(details.credits);
	const q = url.searchParams.get('q')?.trim() ?? '';
	const backHref = q ? `/recherche?type=series&q=${encodeURIComponent(q)}` : '/recherche?type=series';

	return {
		backHref,
		localId: localShow?.id ?? null,
		show: {
			tmdbId,
			name: details.name || details.original_name,
			originalName: details.original_name,
			overview: details.overview || null,
			posterPath: details.poster_path,
			backdropPath: details.backdrop_path,
			firstAirDate: details.first_air_date || null,
			status: details.status,
			episodeRunTime: details.episode_run_time?.[0] ?? null,
			numberOfEpisodes: details.number_of_episodes,
			numberOfSeasons: details.number_of_seasons,
			genres: details.genres.map((g) => g.name),
			networks: details.networks?.map((network) => network.name) ?? [],
			providers,
			cast
		}
	};
};

export const actions: Actions = {
	add: async ({ params }) => {
		const tmdbId = tmdbIdFromParam(params.tmdbId);
		const show = await addOrUpdateShow(tmdbId);
		redirect(303, `/series/${show.id}`);
	}
};
