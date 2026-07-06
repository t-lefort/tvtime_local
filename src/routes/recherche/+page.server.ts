import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { movies, shows } from '$lib/server/db/schema';
import { searchMovie, searchTv } from '$lib/server/tmdb';
import { addOrUpdateShow } from '$lib/server/shows';
import { addOrUpdateMovie } from '$lib/server/movies';
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

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const type = url.searchParams.get('type') === 'films' ? 'films' : 'series';
	if (!q) return { q, type, results: [] as SearchResult[], error: null };

	try {
		let results: SearchResult[];
		if (type === 'films') {
			const found = await searchMovie(q);
			const inDb = new Map(
				db.select({ tmdbId: movies.tmdbId, id: movies.id }).from(movies).all().map((r) => [r.tmdbId, r.id])
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
				db.select({ tmdbId: shows.tmdbId, id: shows.id }).from(shows).all().map((r) => [r.tmdbId, r.id])
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
		return { q, type, results, error: null };
	} catch (e) {
		return { q, type, results: [] as SearchResult[], error: e instanceof Error ? e.message : String(e) };
	}
};

export const actions: Actions = {
	add: async ({ request }) => {
		const tmdbId = Number((await request.formData()).get('tmdbId'));
		if (!tmdbId) return;
		const show = await addOrUpdateShow(tmdbId);
		redirect(303, `/series/${show.id}`);
	},

	addMovie: async ({ request }) => {
		const tmdbId = Number((await request.formData()).get('tmdbId'));
		if (!tmdbId) return;
		const movie = await addOrUpdateMovie(tmdbId);
		redirect(303, `/films/${movie.id}`);
	}
};
