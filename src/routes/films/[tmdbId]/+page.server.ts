import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { movies, movieWatches } from '$lib/server/db/schema';
import { getMoviesWithWatch } from '$lib/server/queries';
import { addOrUpdateMovie } from '$lib/server/movies';
import {
	extractCast,
	extractCompanies,
	extractCrew,
	extractProviders,
	getMovieDetails,
	type StoredCastMember,
	type StoredCompany,
	type StoredCrewMember,
	type StoredProviders
} from '$lib/server/tmdb';
import type { Actions, PageServerLoad } from './$types';

function tmdbIdFromParam(value: string): number {
	const tmdbId = Number(value);
	if (!Number.isInteger(tmdbId) || tmdbId <= 0) error(404, 'Film introuvable');
	return tmdbId;
}

function requireLocalMovie(tmdbId: number) {
	const movie = db.select().from(movies).where(eq(movies.tmdbId, tmdbId)).get();
	if (!movie) error(404, 'Film introuvable');
	return movie;
}

export const load: PageServerLoad = async ({ params, url }) => {
	const tmdbId = tmdbIdFromParam(params.tmdbId);
	const q = url.searchParams.get('q')?.trim() ?? '';
	const backHref = q ? `/recherche?type=films&q=${encodeURIComponent(q)}` : '/films';

	const local = getMoviesWithWatch({ tmdbId })[0];
	if (local) {
		// Complète distribution, équipe et sociétés en direct pour les films ajoutés avant ces fonctionnalités
		let cast = JSON.parse(local.cast ?? '[]') as StoredCastMember[];
		let crew = JSON.parse(local.crew ?? '[]') as StoredCrewMember[];
		let companies = JSON.parse(local.productionCompanies ?? '[]') as StoredCompany[];
		if (!cast.length || local.crew === null || local.productionCompanies === null) {
			const details = await getMovieDetails(tmdbId);
			if (!cast.length) cast = extractCast(details.credits);
			crew = extractCrew(details.credits);
			companies = extractCompanies(details.production_companies);
			db.update(movies)
				.set({
					cast: cast.length ? JSON.stringify(cast) : local.cast,
					crew: JSON.stringify(crew),
					productionCompanies: JSON.stringify(companies)
				})
				.where(eq(movies.id, local.id))
				.run();
		}
		return {
			backHref,
			inLibrary: true,
			movie: {
				tmdbId,
				localId: local.id,
				title: local.title,
				overview: local.overview,
				posterPath: local.posterPath,
				backdropPath: local.backdropPath,
				releaseDate: local.releaseDate,
				runtime: local.runtime,
				genres: JSON.parse(local.genres) as string[],
				favorite: local.favorite,
				watchCount: local.watchCount,
				lastWatchedAt: local.lastWatchedAt,
				providers: local.watchProviders
					? (JSON.parse(local.watchProviders) as StoredProviders)
					: null,
				cast,
				crew,
				companies
			}
		};
	}

	const details = await getMovieDetails(tmdbId);
	return {
		backHref,
		inLibrary: false,
		movie: {
			tmdbId,
			localId: null,
			title: details.title || details.original_title,
			overview: details.overview || null,
			posterPath: details.poster_path,
			backdropPath: details.backdrop_path,
			releaseDate: details.release_date || null,
			runtime: details.runtime ?? null,
			genres: details.genres.map((g) => g.name),
			favorite: false,
			watchCount: 0,
			lastWatchedAt: null as string | null,
			providers: extractProviders(details['watch/providers']),
			cast: extractCast(details.credits),
			crew: extractCrew(details.credits),
			companies: extractCompanies(details.production_companies)
		}
	};
};

export const actions: Actions = {
	/** Ajoute le film à la bibliothèque (reste sur la même page, qui repasse en mode bibliothèque). */
	add: async ({ params }) => {
		await addOrUpdateMovie(tmdbIdFromParam(params.tmdbId));
	},

	/** Marque vu (aujourd'hui) ou efface tout l'historique si déjà vu. */
	toggle: async ({ params }) => {
		const movie = requireLocalMovie(tmdbIdFromParam(params.tmdbId));
		const existing = db.select().from(movieWatches).where(eq(movieWatches.movieId, movie.id)).all();
		if (existing.length > 0) {
			db.delete(movieWatches).where(eq(movieWatches.movieId, movie.id)).run();
		} else {
			db.insert(movieWatches).values({ movieId: movie.id }).run();
		}
	},

	/** Ajoute un visionnage supplémentaire (revisionnage). */
	rewatch: async ({ params }) => {
		const movie = requireLocalMovie(tmdbIdFromParam(params.tmdbId));
		db.insert(movieWatches).values({ movieId: movie.id }).run();
	},

	favorite: async ({ params }) => {
		const movie = requireLocalMovie(tmdbIdFromParam(params.tmdbId));
		db.update(movies).set({ favorite: !movie.favorite }).where(eq(movies.id, movie.id)).run();
	},

	refresh: async ({ params }) => {
		const tmdbId = tmdbIdFromParam(params.tmdbId);
		requireLocalMovie(tmdbId);
		await addOrUpdateMovie(tmdbId);
	},

	remove: async ({ params }) => {
		const movie = requireLocalMovie(tmdbIdFromParam(params.tmdbId));
		db.delete(movies).where(eq(movies.id, movie.id)).run();
		redirect(303, '/films');
	}
};
