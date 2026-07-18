/**
 * Suggestions personnalisées (« Pour vous ») : à partir des titres les plus
 * affinitaires de la bibliothèque du profil, interroge les recommandations TMDB
 * puis les classe selon la correspondance avec le profil et les notes TMDB.
 */
import { getMoviesWithWatch, getShowsWithProgress } from './queries';
import {
	getGenres,
	getMovieRecommendations,
	getTvRecommendations,
	type TmdbMovieSummary,
	type TmdbShowSummary
} from './tmdb';
import {
	buildGenreWeights,
	movieSeedWeight,
	rankSuggestions,
	showSeedWeight,
	type Suggestion,
	type SuggestionCandidate,
	type SuggestionSeed
} from './suggestions-utils';

export type { Suggestion } from './suggestions-utils';

/** Nombre de titres de la bibliothèque utilisés comme graines, par type de média. */
const MAX_SEEDS = 8;

/** Durée par défaut (min) quand TMDB ne connaît pas le runtime d'un film. */
const DEFAULT_MOVIE_RUNTIME = 110;

const RECOMMENDATIONS_TTL_MS = 6 * 60 * 60 * 1000;
const GENRES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Cache mémoire des réponses TMDB : les recommandations bougent peu et la page
// en agrège jusqu'à 2 × MAX_SEEDS appels, inutile de les refaire à chaque visite.
const cache = new Map<string, { at: number; data: unknown }>();

async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
	const data = await fetcher();
	cache.set(key, { at: Date.now(), data });
	return data;
}

function showCandidate(s: TmdbShowSummary): SuggestionCandidate {
	return {
		tmdbId: s.id,
		name: s.name,
		originalName: s.original_name,
		overview: s.overview,
		posterPath: s.poster_path,
		backdropPath: s.backdrop_path,
		date: s.first_air_date,
		voteAverage: s.vote_average,
		genreIds: s.genre_ids ?? []
	};
}

function movieCandidate(m: TmdbMovieSummary): SuggestionCandidate {
	return {
		tmdbId: m.id,
		name: m.title,
		originalName: m.original_title,
		overview: m.overview,
		posterPath: m.poster_path,
		backdropPath: m.backdrop_path,
		date: m.release_date,
		voteAverage: m.vote_average,
		genreIds: m.genre_ids ?? []
	};
}

/**
 * Recommandations TMDB de chaque graine. Une graine qui échoue est ignorée
 * (titre retiré du catalogue…), mais si toutes échouent l'erreur remonte
 * (clé API manquante, réseau coupé) pour être affichée sur la page.
 */
async function recommendationsFor(
	kind: 'tv' | 'movie',
	seeds: SuggestionSeed[]
): Promise<{ seed: SuggestionSeed; candidates: SuggestionCandidate[] }[]> {
	const settled = await Promise.allSettled(
		seeds.map((seed) =>
			cached(`recs:${kind}:${seed.tmdbId}`, RECOMMENDATIONS_TTL_MS, () =>
				kind === 'tv'
					? getTvRecommendations(seed.tmdbId).then((r) => r.map(showCandidate))
					: getMovieRecommendations(seed.tmdbId).then((r) => r.map(movieCandidate))
			)
		)
	);
	if (seeds.length && settled.every((r) => r.status === 'rejected')) {
		throw (settled[0] as PromiseRejectedResult).reason;
	}
	return settled.flatMap((result, i) =>
		result.status === 'fulfilled' ? [{ seed: seeds[i], candidates: result.value }] : []
	);
}

export interface SuggestionsResult {
	series: Suggestion[];
	films: Suggestion[];
}

export async function getSuggestions(userId: number): Promise<SuggestionsResult> {
	const shows = getShowsWithProgress(userId);
	const movies = getMoviesWithWatch(userId);

	const showSeeds: SuggestionSeed[] = shows
		.map((s) => ({
			tmdbId: s.tmdbId,
			title: s.name,
			weight: showSeedWeight(s),
			last: s.lastWatchedAt ?? ''
		}))
		.filter((s) => s.weight > 0)
		.sort((a, b) => b.weight - a.weight || b.last.localeCompare(a.last))
		.slice(0, MAX_SEEDS);
	const movieSeeds: SuggestionSeed[] = movies
		.map((m) => ({
			tmdbId: m.tmdbId,
			title: m.title,
			weight: movieSeedWeight(m),
			last: m.lastWatchedAt ?? m.addedAt
		}))
		.filter((m) => m.weight > 0)
		.sort((a, b) => b.weight - a.weight || b.last.localeCompare(a.last))
		.slice(0, MAX_SEEDS);

	const [tvGenres, movieGenres, showEntries, movieEntries] = await Promise.all([
		cached('genres:tv', GENRES_TTL_MS, () => getGenres('tv')),
		cached('genres:movie', GENRES_TTL_MS, () => getGenres('movie')),
		recommendationsFor('tv', showSeeds),
		recommendationsFor('movie', movieSeeds)
	]);

	const tvGenreWeights = buildGenreWeights(
		shows.map((s) => ({ genres: JSON.parse(s.genres) as string[], weight: s.minutesWatched })),
		new Map(tvGenres.map((g) => [g.name, g.id]))
	);
	const movieGenreWeights = buildGenreWeights(
		movies.map((m) => ({
			genres: JSON.parse(m.genres) as string[],
			weight: m.watchCount * (m.runtime ?? DEFAULT_MOVIE_RUNTIME)
		})),
		new Map(movieGenres.map((g) => [g.name, g.id]))
	);

	return {
		series: rankSuggestions(showEntries, new Set(shows.map((s) => s.tmdbId)), tvGenreWeights),
		films: rankSuggestions(movieEntries, new Set(movies.map((m) => m.tmdbId)), movieGenreWeights)
	};
}
