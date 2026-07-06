import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { movies, type Movie } from './db/schema';
import { extractCast, extractProviders, getMovieDetails } from './tmdb';

export interface AddMovieOptions {
	favorite?: boolean;
	addedAt?: string;
}

/**
 * Crée ou met à jour un film depuis TMDB (métadonnées + plateformes de streaming).
 * Idempotent : utilisé par la recherche, le bouton rafraîchir et le sync quotidien.
 */
export async function addOrUpdateMovie(tmdbId: number, opts: AddMovieOptions = {}): Promise<Movie> {
	const details = await getMovieDetails(tmdbId);
	const providers = extractProviders(details['watch/providers']);
	const cast = extractCast(details.credits);

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
		lastSyncedAt: sql`(datetime('now'))` as unknown as string
	};

	return db
		.insert(movies)
		.values({
			tmdbId,
			...base,
			favorite: opts.favorite ?? false,
			...(opts.addedAt ? { addedAt: opts.addedAt } : {})
		})
		.onConflictDoUpdate({ target: movies.tmdbId, set: base })
		.returning()
		.get();
}

export function getMovieByTmdbId(tmdbId: number): Movie | undefined {
	return db.select().from(movies).where(eq(movies.tmdbId, tmdbId)).get();
}
