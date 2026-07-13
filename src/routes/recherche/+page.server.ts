import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { movies, shows, userMovies, userShows } from '$lib/server/db/schema';
import { searchCompanies, searchMovie, searchPeople, searchTv } from '$lib/server/tmdb';
import { addOrUpdateShow, followShow } from '$lib/server/shows';
import { addOrUpdateMovie, collectMovie } from '$lib/server/movies';
import { requireUser } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

export interface SearchResult {
	tmdbId: number;
	name: string;
	originalName: string;
	overview: string;
	posterPath: string | null;
	backdropPath: string | null;
	date: string | null;
	voteAverage: number;
	localId: number | null;
}

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

export const load: PageServerLoad = async ({ url, locals }) => {
	const user = requireUser(locals);
	const q = url.searchParams.get('q')?.trim() ?? '';
	const type = url.searchParams.get('type') === 'films' ? 'films' : 'series';
	if (!q) return { q, type, results: [] as SearchResult[], error: null, ...emptySuggestions };

	try {
		let results: SearchResult[];
		let suggestions = emptySuggestions;
		if (type === 'films') {
			const [found, companies, people] = await Promise.all([
				searchMovie(q),
				searchCompanies(q),
				searchPeople(q)
			]);
			suggestions = {
				companies: companies.map((c) => ({ id: c.id, name: c.name, logoPath: c.logo_path })),
				people: people.map((p) => ({
					id: p.id,
					name: p.name,
					knownFor: p.known_for_department || null,
					profilePath: p.profile_path
				}))
			};
			const inDb = new Map(
				db
					.select({ tmdbId: movies.tmdbId, id: movies.id })
					.from(movies)
					.innerJoin(userMovies, eq(userMovies.movieId, movies.id))
					.where(eq(userMovies.userId, user.id))
					.all()
					.map((r) => [r.tmdbId, r.id])
			);
			results = found.map((r) => ({
				tmdbId: r.id,
				name: r.title,
				originalName: r.original_title,
				overview: r.overview,
				posterPath: r.poster_path,
				backdropPath: r.backdrop_path,
				date: r.release_date,
				voteAverage: r.vote_average,
				localId: inDb.get(r.id) ?? null
			}));
		} else {
			const found = await searchTv(q);
			const inDb = new Map(
				db
					.select({ tmdbId: shows.tmdbId, id: shows.id })
					.from(shows)
					.innerJoin(userShows, eq(userShows.showId, shows.id))
					.where(eq(userShows.userId, user.id))
					.all()
					.map((r) => [r.tmdbId, r.id])
			);
			results = found.map((r) => ({
				tmdbId: r.id,
				name: r.name,
				originalName: r.original_name,
				overview: r.overview,
				posterPath: r.poster_path,
				backdropPath: r.backdrop_path,
				date: r.first_air_date,
				voteAverage: r.vote_average,
				localId: inDb.get(r.id) ?? null
			}));
		}
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
	}
};
