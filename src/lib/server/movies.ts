import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { movies, userMovies, type Movie } from './db/schema';
import {
	extractCast,
	extractCollection,
	extractCompanies,
	extractCrew,
	extractProviders,
	getMovieDetails
} from './tmdb';

export interface CollectMovieOptions {
	favorite?: boolean;
	addedAt?: string;
}

/**
 * Crée ou met à jour un film depuis TMDB (métadonnées + plateformes de streaming).
 * Idempotent : utilisé par la recherche, le bouton rafraîchir et le sync quotidien.
 */
export async function addOrUpdateMovie(tmdbId: number): Promise<Movie> {
	const details = await getMovieDetails(tmdbId);
	const providers = extractProviders(details['watch/providers']);
	const cast = extractCast(details.credits);
	const crew = extractCrew(details.credits);
	const companies = extractCompanies(details.production_companies);
	const collection = extractCollection(details.belongs_to_collection);

	const base = {
		title: details.title || details.original_title,
		originalTitle: details.original_title,
		overview: details.overview || null,
		posterPath: details.poster_path,
		backdropPath: details.backdrop_path,
		releaseDate: details.release_date || null,
		runtime: details.runtime ?? null,
		genres: JSON.stringify(details.genres.map((g) => g.name)),
		watchProviders: providers ? JSON.stringify(providers) : null,
		cast: cast.length ? JSON.stringify(cast) : null,
		crew: JSON.stringify(crew),
		productionCompanies: JSON.stringify(companies),
		collection: JSON.stringify(collection),
		lastSyncedAt: sql`(datetime('now'))` as unknown as string
	};

	return db
		.insert(movies)
		.values({ tmdbId, ...base })
		.onConflictDoUpdate({ target: movies.tmdbId, set: base })
		.returning()
		.get();
}

/** Ajoute le film à la collection d'un profil (idempotent : n'écrase pas un ajout existant). */
export function collectMovie(userId: number, movieId: number, opts: CollectMovieOptions = {}): void {
	db.insert(userMovies)
		.values({
			userId,
			movieId,
			favorite: opts.favorite ?? false,
			...(opts.addedAt ? { addedAt: opts.addedAt } : {})
		})
		.onConflictDoNothing()
		.run();
}

export function getUserMovie(userId: number, movieId: number) {
	return db
		.select()
		.from(userMovies)
		.where(and(eq(userMovies.userId, userId), eq(userMovies.movieId, movieId)))
		.get();
}

/**
 * Retire le film de la collection du profil (ajout + historique).
 * La fiche catalogue est supprimée si plus personne ne la référence.
 */
export function uncollectMovie(userId: number, movieId: number): void {
	db.delete(userMovies)
		.where(and(eq(userMovies.userId, userId), eq(userMovies.movieId, movieId)))
		.run();
	db.run(sql`DELETE FROM movie_watches WHERE user_id = ${userId} AND movie_id = ${movieId}`);
	db.run(sql`
		DELETE FROM movies
		WHERE id = ${movieId}
			AND NOT EXISTS (SELECT 1 FROM user_movies um WHERE um.movie_id = ${movieId})
			AND NOT EXISTS (SELECT 1 FROM movie_watches w WHERE w.movie_id = ${movieId})
	`);
}

export function getMovieByTmdbId(tmdbId: number): Movie | undefined {
	return db.select().from(movies).where(eq(movies.tmdbId, tmdbId)).get();
}
