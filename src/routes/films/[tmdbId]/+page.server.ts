import { error, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { movies, movieWatches, userMovies } from '$lib/server/db/schema';
import { getMoviesWithWatch } from '$lib/server/queries';
import { addOrUpdateMovie, collectMovie, getUserMovie, uncollectMovie } from '$lib/server/movies';
import { requireUser } from '$lib/server/users';
import {
	extractCast,
	extractCollection,
	extractCompanies,
	extractCrew,
	extractProviders,
	getCollectionInfo,
	getMovieDetails,
	getMovieLocalizedMedia,
	type CollectionInfo,
	type StoredCastMember,
	type StoredCollection,
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

/** Position d'un film dans sa saga, ou null (film hors saga ou API indisponible). */
async function collectionInfo(
	collection: StoredCollection | null,
	tmdbId: number
): Promise<CollectionInfo | null> {
	if (!collection) return null;
	try {
		return await getCollectionInfo(collection, tmdbId);
	} catch {
		// Saga indisponible (API) : on affiche au moins le nom, sans la position
		return { id: collection.id, name: collection.name, position: 0, total: 0 };
	}
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
	const localizedMedia = getMovieLocalizedMedia(tmdbId).catch(() => []);

	const local = getMoviesWithWatch(user.id, { tmdbId })[0];
	if (local) {
		// Complète distribution, équipe et sociétés en direct pour les films ajoutés avant ces fonctionnalités
		let cast = JSON.parse(local.cast ?? '[]') as StoredCastMember[];
		let crew = JSON.parse(local.crew ?? '[]') as StoredCrewMember[];
		let companies = JSON.parse(local.productionCompanies ?? '[]') as StoredCompany[];
		let collection = JSON.parse(local.collection ?? 'null') as StoredCollection | null;
		let voteAverage = local.voteAverage;
		const crewNeedsProfiles = crew.some((member) => member.profilePath === undefined);
		if (
			!cast.length ||
			local.crew === null ||
			crewNeedsProfiles ||
			local.productionCompanies === null ||
			local.collection === null ||
			local.voteAverage === null
		) {
			const details = await getMovieDetails(tmdbId);
			if (!cast.length) cast = extractCast(details.credits);
			crew = extractCrew(details.credits);
			companies = extractCompanies(details.production_companies);
			collection = extractCollection(details.belongs_to_collection);
			voteAverage = details.vote_average ?? null;
			db.update(movies)
				.set({
					cast: cast.length ? JSON.stringify(cast) : local.cast,
					crew: JSON.stringify(crew),
					productionCompanies: JSON.stringify(companies),
					collection: JSON.stringify(collection),
					voteAverage
				})
				.where(eq(movies.id, local.id))
				.run();
		}
		return {
			backHref,
			localizedMedia: await localizedMedia,
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
				voteAverage,
				genres: JSON.parse(local.genres) as string[],
				favorite: local.favorite,
				rating: local.rating,
				watchCount: local.watchCount,
				lastWatchedAt: local.lastWatchedAt,
				providers: local.watchProviders
					? (JSON.parse(local.watchProviders) as StoredProviders)
					: null,
				cast,
				crew,
				companies,
				collection: await collectionInfo(collection, tmdbId)
			}
		};
	}

	const details = await getMovieDetails(tmdbId);
	return {
		backHref,
		localizedMedia: await localizedMedia,
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
			voteAverage: details.vote_average ?? null,
			genres: details.genres.map((g) => g.name),
			favorite: false,
			rating: null as number | null,
			watchCount: 0,
			lastWatchedAt: null as string | null,
			providers: extractProviders(details['watch/providers']),
			cast: extractCast(details.credits),
			crew: extractCrew(details.credits),
			companies: extractCompanies(details.production_companies),
			collection: await collectionInfo(extractCollection(details.belongs_to_collection), tmdbId)
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

	/** Note personnelle (1–10) ; toute autre valeur retire la note. */
	rate: async ({ params, request, locals }) => {
		const user = requireUser(locals);
		const { userMovie } = requireCollectedMovie(user.id, tmdbIdFromParam(params.tmdbId));
		const raw = Number((await request.formData()).get('rating'));
		const rating = Number.isInteger(raw) && raw >= 1 && raw <= 10 ? raw : null;
		db.update(userMovies).set({ rating }).where(eq(userMovies.id, userMovie.id)).run();
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
