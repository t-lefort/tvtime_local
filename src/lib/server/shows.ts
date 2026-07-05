import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { episodes, shows, type Show } from './db/schema';
import { getSeasonEpisodes, getShowDetails } from './tmdb';

export interface AddShowOptions {
	tvdbId?: number | null;
	archived?: boolean;
	favorite?: boolean;
	followedAt?: string;
}

/**
 * Crée ou met à jour une série (et tous ses épisodes) depuis TMDB.
 * Idempotent : utilisé par la recherche, l'import GDPR et le sync quotidien.
 */
export async function addOrUpdateShow(tmdbId: number, opts: AddShowOptions = {}): Promise<Show> {
	const details = await getShowDetails(tmdbId);

	const base = {
		tvdbId: opts.tvdbId ?? details.external_ids?.tvdb_id ?? null,
		name: details.name || details.original_name,
		originalName: details.original_name,
		overview: details.overview || null,
		posterPath: details.poster_path,
		backdropPath: details.backdrop_path,
		firstAirDate: details.first_air_date || null,
		tmdbStatus: details.status,
		genres: JSON.stringify(details.genres.map((g) => g.name)),
		episodeRunTime: details.episode_run_time?.[0] ?? null,
		lastSyncedAt: sql`(datetime('now'))` as unknown as string
	};

	const show = db
		.insert(shows)
		.values({
			tmdbId,
			...base,
			archived: opts.archived ?? false,
			favorite: opts.favorite ?? false,
			...(opts.followedAt ? { followedAt: opts.followedAt } : {})
		})
		.onConflictDoUpdate({ target: shows.tmdbId, set: base })
		.returning()
		.get();

	const seenTmdbIds = new Set<number>();
	for (const season of details.seasons) {
		const eps = await getSeasonEpisodes(tmdbId, season.season_number);
		for (const ep of eps) {
			seenTmdbIds.add(ep.id);
			try {
				db.insert(episodes)
					.values({
						showId: show.id,
						tmdbId: ep.id,
						seasonNumber: ep.season_number,
						episodeNumber: ep.episode_number,
						name: ep.name,
						overview: ep.overview,
						airDate: ep.air_date,
						runtime: ep.runtime,
						stillPath: ep.still_path
					})
					.onConflictDoUpdate({
						target: episodes.tmdbId,
						set: {
							seasonNumber: ep.season_number,
							episodeNumber: ep.episode_number,
							name: ep.name,
							overview: ep.overview,
							airDate: ep.air_date,
							runtime: ep.runtime,
							stillPath: ep.still_path
						}
					})
					.run();
			} catch (e) {
				// Collision possible sur (show, saison, numéro) si TMDB renumérote — on ignore, corrigé au sync suivant
				console.warn(`[shows] épisode ignoré S${ep.season_number}E${ep.episode_number} de ${base.name}:`, e);
			}
		}
	}

	// Épisodes supprimés côté TMDB : on les retire s'ils n'ont pas été vus
	db.run(sql`
		DELETE FROM episodes
		WHERE show_id = ${show.id}
			AND tmdb_id NOT IN ${seenTmdbIds.size ? sql`(${sql.join([...seenTmdbIds].map((id) => sql`${id}`), sql`, `)})` : sql`(-1)`}
			AND NOT EXISTS (SELECT 1 FROM watches w WHERE w.episode_id = episodes.id)
	`);

	return show;
}

export function getShowByTmdbId(tmdbId: number): Show | undefined {
	return db.select().from(shows).where(eq(shows.tmdbId, tmdbId)).get();
}

export function getShowByTvdbId(tvdbId: number): Show | undefined {
	return db.select().from(shows).where(eq(shows.tvdbId, tvdbId)).get();
}
