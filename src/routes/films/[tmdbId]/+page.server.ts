import { error, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { movies, movieWatches, userMovies } from '$lib/server/db/schema';
import { getMoviesWithWatch } from '$lib/server/queries';
import { addOrUpdateMovie, collectMovie, getUserMovie, uncollectMovie } from '$lib/server/movies';
import { requireUser } from '$lib/server/users';
import {
	extractCast,
	extractProviders,
	getCast,
	getMovieDetails,
	type StoredCastMember,
	type StoredProviders
} from '$lib/server/tmdb';
import type { Actions, PageServerLoad } from './$types';

function tmdbIdFromParam(value: string): number {
	const tmdbId = Number(value);
	if (!Number.isInteger(tmdbId) || tmdbId <= 0) error(404, 'Film introuvable');
	return tmdbId;
}

/** Film présent dans la collection du profil, sinon 404. */
function requireCollectedMovie(userId: number, tmdbId: number) {
	const movie = db.select().from(movies).where(eq(movies.tmdbId, tmdbId)).get();
	const userMovie = movie ? getUserMovie(userId, movie.id) : undefined;
	if (!movie || !userMovie) error(404, 'Film introuvable');
	return { movie, userMovie };
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const user = requireUser(locals);
	const tmdbId = tmdbIdFromParam(params.tmdbId);
	const q = url.searchParams.get('q')?.trim() ?? '';
	const backHref = q ? `/recherche?type=films&q=${encodeURIComponent(q)}` : '/films';

	const local = getMoviesWithWatch(user.id, { tmdbId })[0];
	if (local) {
		// Complète la distribution en direct pour les films ajoutés avant cette fonctionnalité
		let cast = JSON.parse(local.cast ?? '[]') as StoredCastMember[];
		if (!cast.length) {
			cast = await getCast('movie', tmdbId);
			if (cast.length) {
				db.update(movies).set({ cast: JSON.stringify(cast) }).where(eq(movies.id, local.id)).run();
			}
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
				cast
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
			cast: extractCast(details.credits)
		}
	};
};

export const actions: Actions = {
	/** Ajoute le film à la collection du profil (reste sur la même page, qui repasse en mode bibliothèque). */
	add: async ({ params, locals }) => {
		const user = requireUser(locals);
		const movie = await addOrUpdateMovie(tmdbIdFromParam(params.tmdbId));
		collectMovie(user.id, movie.id);
	},

	/** Marque vu (aujourd'hui) ou efface tout l'historique du profil si déjà vu. */
	toggle: async ({ params, locals }) => {
		const user = requireUser(locals);
		const { movie } = requireCollectedMovie(user.id, tmdbIdFromParam(params.tmdbId));
		const mine = and(eq(movieWatches.movieId, movie.id), eq(movieWatches.userId, user.id));
		const existing = db.select().from(movieWatches).where(mine).all();
		if (existing.length > 0) {
			db.delete(movieWatches).where(mine).run();
		} else {
			db.insert(movieWatches).values({ userId: user.id, movieId: movie.id }).run();
		}
	},

	/** Ajoute un visionnage supplémentaire (revisionnage). */
	rewatch: async ({ params, locals }) => {
		const user = requireUser(locals);
		const { movie } = requireCollectedMovie(user.id, tmdbIdFromParam(params.tmdbId));
		db.insert(movieWatches).values({ userId: user.id, movieId: movie.id }).run();
	},

	favorite: async ({ params, locals }) => {
		const user = requireUser(locals);
		const { userMovie } = requireCollectedMovie(user.id, tmdbIdFromParam(params.tmdbId));
		db.update(userMovies)
			.set({ favorite: !userMovie.favorite })
			.where(eq(userMovies.id, userMovie.id))
			.run();
	},

	refresh: async ({ params, locals }) => {
		const user = requireUser(locals);
		const tmdbId = tmdbIdFromParam(params.tmdbId);
		requireCollectedMovie(user.id, tmdbId);
		await addOrUpdateMovie(tmdbId);
	},

	remove: async ({ params, locals }) => {
		const user = requireUser(locals);
		const { movie } = requireCollectedMovie(user.id, tmdbIdFromParam(params.tmdbId));
		uncollectMovie(user.id, movie.id);
		redirect(303, '/films');
	}
};
