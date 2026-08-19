import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { movies, shows, userMovies, userShows } from '$lib/server/db/schema';
import {
	searchCompanies,
	searchMovie,
	searchPeople,
	searchTv,
	type TmdbMovieSummary,
	type TmdbShowSummary
} from '$lib/server/tmdb';
import { searchBooks, type BookMetadata, type BookSearchResult } from '$lib/server/book-metadata';
import { isbn13To10, normalizeIsbn } from '$lib/isbn';
import {
	addOrUpdateBook,
	bookTitleKey,
	collectBook,
	collectBookFromSource,
	collectedBookIds
} from '$lib/server/books';
import { addOrUpdateShow, followShow } from '$lib/server/shows';
import { addOrUpdateMovie, collectMovie } from '$lib/server/movies';
import { requireUser } from '$lib/server/users';
import { interleaveResults, parseSearchType, type SearchResult } from '$lib/search';
import type { Actions, PageServerLoad } from './$types';

/** Suggestion de société de production correspondant à la requête (recherche de films). */
export interface CompanySuggestion {
	id: number;
	name: string;
	logoPath: string | null;
}

/** Suggestion de personne (producteur, réalisateur, acteur…) correspondant à la requête. */
export interface PersonSuggestion {
	id: number;
	name: string;
	knownFor: string | null;
	profilePath: string | null;
}

const emptySuggestions = {
	companies: [] as CompanySuggestion[],
	people: [] as PersonSuggestion[]
};

function toMovieResult(r: TmdbMovieSummary, localId: number | null): SearchResult {
	return {
		kind: 'films',
		key: `films:${r.id}`,
		tmdbId: r.id,
		sourceId: null,
		coverUrl: null,
		name: r.title,
		originalName: r.original_title,
		overview: r.overview,
		posterPath: r.poster_path,
		backdropPath: r.backdrop_path,
		date: r.release_date,
		voteAverage: r.vote_average,
		popularity: r.popularity ?? 0,
		localId
	};
}

function toShowResult(r: TmdbShowSummary, localId: number | null): SearchResult {
	return {
		kind: 'series',
		key: `series:${r.id}`,
		tmdbId: r.id,
		sourceId: null,
		coverUrl: null,
		name: r.name,
		originalName: r.original_name,
		overview: r.overview,
		posterPath: r.poster_path,
		backdropPath: r.backdrop_path,
		date: r.first_air_date,
		voteAverage: r.vote_average,
		popularity: r.popularity ?? 0,
		localId
	};
}

/**
 * Un livre n'a ni identifiant TMDB, ni jaquette TMDB, ni note : la fiche de
 * recherche s'appuie sur la couverture et la description du catalogue.
 */
function toBookResult(r: BookSearchResult, localId: number | null): SearchResult {
	return {
		kind: 'livres',
		key: `livres:${r.sourceId}`,
		tmdbId: null,
		sourceId: r.sourceId,
		name: r.title,
		originalName: r.title,
		overview: r.description ?? '',
		posterPath: null,
		coverUrl: r.coverUrl,
		backdropPath: null,
		date: null,
		voteAverage: 0,
		popularity: 0,
		localId
	};
}

/** Films de la bibliothèque du profil, indexés par id TMDB. */
function collectedMovieIds(userId: number): Map<number, number> {
	return new Map(
		db
			.select({ tmdbId: movies.tmdbId, id: movies.id })
			.from(movies)
			.innerJoin(userMovies, eq(userMovies.movieId, movies.id))
			.where(eq(userMovies.userId, userId))
			.all()
			.map((r) => [r.tmdbId, r.id])
	);
}

/** Séries suivies par le profil, indexées par id TMDB. */
function followedShowIds(userId: number): Map<number, number> {
	return new Map(
		db
			.select({ tmdbId: shows.tmdbId, id: shows.id })
			.from(shows)
			.innerJoin(userShows, eq(userShows.showId, shows.id))
			.where(eq(userShows.userId, userId))
			.all()
			.map((r) => [r.tmdbId, r.id])
	);
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const user = requireUser(locals);
	const q = url.searchParams.get('q')?.trim() ?? '';
	const type = parseSearchType(url.searchParams.get('type'));
	if (!q) return { q, type, results: [] as SearchResult[], error: null, ...emptySuggestions };

	try {
		// Les sociétés et personnes n'ont d'intérêt que là où des films sont proposés.
		const withSuggestions = type === 'tout' || type === 'films';
		const wantsShows = type === 'tout' || type === 'series';
		const wantsMovies = type === 'tout' || type === 'films';
		const wantsBooks = type === 'tout' || type === 'livres';
		const [foundShows, foundMovies, foundBooks, companies, people] = await Promise.all([
			wantsShows ? searchTv(q) : [],
			wantsMovies ? searchMovie(q) : [],
			// Les catalogues bibliographiques sont lents et faillibles : leur panne
			// ne doit pas emporter les résultats TMDB de l'onglet « Tout ».
			wantsBooks ? searchBooks(q).catch(() => [] as BookSearchResult[]) : [],
			withSuggestions ? searchCompanies(q) : [],
			withSuggestions ? searchPeople(q) : []
		]);

		const suggestions = {
			companies: companies.map((c) => ({ id: c.id, name: c.name, logoPath: c.logo_path })),
			people: people.map((p) => ({
				id: p.id,
				name: p.name,
				knownFor: p.known_for_department || null,
				profilePath: p.profile_path
			}))
		};

		const collected = foundMovies.length ? collectedMovieIds(user.id) : new Map<number, number>();
		const followed = foundShows.length ? followedShowIds(user.id) : new Map<number, number>();
		const owned = foundBooks.length ? collectedBookIds(user.id) : new Map<string, number>();
		const showResults = foundShows.map((r) => toShowResult(r, followed.get(r.id) ?? null));
		const movieResults = foundMovies.map((r) => toMovieResult(r, collected.get(r.id) ?? null));
		const bookResults = foundBooks.map((r) =>
			toBookResult(r, owned.get(r.sourceId) ?? owned.get(bookTitleKey(r.title)) ?? null)
		);
		const results =
			type === 'tout'
				? interleaveResults(showResults, movieResults, bookResults)
				: [...showResults, ...movieResults, ...bookResults];

		return { q, type, results, error: null, ...suggestions };
	} catch (e) {
		return {
			q,
			type,
			results: [] as SearchResult[],
			error: e instanceof Error ? e.message : String(e),
			...emptySuggestions
		};
	}
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const user = requireUser(locals);
		const tmdbId = Number((await request.formData()).get('tmdbId'));
		if (!tmdbId) return;
		const show = await addOrUpdateShow(tmdbId);
		followShow(user.id, show.id);
		redirect(303, `/series/${show.tmdbId}`);
	},

	addMovie: async ({ request, locals }) => {
		const user = requireUser(locals);
		const tmdbId = Number((await request.formData()).get('tmdbId'));
		if (!tmdbId) return;
		const movie = await addOrUpdateMovie(tmdbId);
		collectMovie(user.id, movie.id);
		redirect(303, `/films/${movie.tmdbId}`);
	},

	addBook: async ({ request, locals }) => {
		const user = requireUser(locals);
		const sourceId = String((await request.formData()).get('sourceId') ?? '');
		if (!sourceId) return;
		let book;
		try {
			book = await collectBookFromSource(user.id, sourceId);
		} catch {
			return fail(502, { error: 'Impossible de récupérer cette édition.' });
		}
		// Une œuvre sans édition exploitable se rattrape par la saisie manuelle,
		// proposée juste en dessous des résultats.
		if (!book) {
			return fail(404, {
				error: 'Aucune édition exploitable pour ce titre. Utilisez la saisie manuelle.'
			});
		}
		redirect(303, `/livres/${book.id}`);
	},

	/**
	 * Dernier recours quand aucun catalogue ne connaît le livre : le profil
	 * décrit lui-même son exemplaire. Vivait sur une page d'ajout séparée, que
	 * plus rien ne justifiait de garder à l'écart de la recherche.
	 */
	addManual: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const title = String(data.get('title') ?? '').trim();
		if (!title) return fail(400, { error: 'Le titre est obligatoire.' });
		const rawIsbn = String(data.get('isbn') ?? '').trim();
		const isbn13 = rawIsbn ? normalizeIsbn(rawIsbn) : null;
		if (rawIsbn && !isbn13) return fail(400, { error: 'ISBN invalide.' });
		const metadata: BookMetadata = {
			isbn13,
			isbn10: isbn13 ? isbn13To10(isbn13) : null,
			title,
			subtitle: null,
			authors: String(data.get('authors') ?? '')
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean),
			description: null,
			publisher: String(data.get('publisher') ?? '').trim() || null,
			publishDate: String(data.get('publishDate') ?? '').trim() || null,
			language: 'fr',
			pageCount: null,
			coverUrl: null,
			seriesTitle: String(data.get('seriesTitle') ?? '').trim() || null,
			seriesUri: null,
			volume: String(data.get('volume') ?? '').trim() || null,
			source: 'manual',
			sourceId: null
		};
		const book = addOrUpdateBook(metadata);
		collectBook(user.id, book);
		redirect(303, `/livres/${book.id}`);
	}
};
