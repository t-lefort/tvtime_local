import { sql } from 'drizzle-orm';
import { db } from './db';
import type { Movie, Show } from './db/schema';

/** Durée par défaut (min) quand TMDB ne connaît pas le runtime d'un film. */
const DEFAULT_MOVIE_RUNTIME = 110;

export interface WatchNextItem {
	showId: number;
	showTmdbId: number;
	showName: string;
	posterPath: string | null;
	episodeId: number;
	seasonNumber: number;
	episodeNumber: number;
	episodeName: string | null;
	airDate: string | null;
	stillPath: string | null;
	remaining: number;
	lastWatchedAt: string | null;
}

interface UnwatchedRow {
	episodeId: number;
	showId: number;
	showTmdbId: number;
	seasonNumber: number;
	episodeNumber: number;
	episodeName: string | null;
	airDate: string | null;
	stillPath: string | null;
	showName: string;
	posterPath: string | null;
	followedAt: string;
}

/** Prochain épisode à voir par série suivie (non arrêtée) du profil, trié par activité récente. */
export function getWatchNext(userId: number): WatchNextItem[] {
	const rows = db.all<UnwatchedRow>(sql`
		SELECT e.id AS episodeId, e.show_id AS showId, s.tmdb_id AS showTmdbId, e.season_number AS seasonNumber,
			e.episode_number AS episodeNumber, e.name AS episodeName, e.air_date AS airDate,
			e.still_path AS stillPath, s.name AS showName, s.poster_path AS posterPath,
			us.followed_at AS followedAt
		FROM episodes e
		JOIN shows s ON s.id = e.show_id
		JOIN user_shows us ON us.show_id = s.id AND us.user_id = ${userId}
		WHERE us.archived = 0
			AND e.season_number > 0
			AND e.air_date IS NOT NULL AND e.air_date <= date('now')
			AND NOT EXISTS (SELECT 1 FROM watches w WHERE w.episode_id = e.id AND w.user_id = ${userId})
		ORDER BY e.show_id, e.season_number, e.episode_number
	`);
	const lastActivity = new Map<number, string>(
		db
			.all<{ showId: number; last: string }>(
				sql`SELECT e.show_id AS showId, MAX(w.watched_at) AS last
					FROM watches w JOIN episodes e ON e.id = w.episode_id
					WHERE w.user_id = ${userId} GROUP BY e.show_id`
			)
			.map((r) => [r.showId, r.last])
	);

	const byShow = new Map<number, WatchNextItem>();
	for (const r of rows) {
		const existing = byShow.get(r.showId);
		if (existing) {
			existing.remaining++;
			continue;
		}
		byShow.set(r.showId, {
			showId: r.showId,
			showTmdbId: r.showTmdbId,
			showName: r.showName,
			posterPath: r.posterPath,
			episodeId: r.episodeId,
			seasonNumber: r.seasonNumber,
			episodeNumber: r.episodeNumber,
			episodeName: r.episodeName,
			airDate: r.airDate,
			stillPath: r.stillPath,
			remaining: 1,
			lastWatchedAt: lastActivity.get(r.showId) ?? null
		});
	}
	return [...byShow.values()].sort((a, b) => {
		if (a.lastWatchedAt && b.lastWatchedAt) return b.lastWatchedAt.localeCompare(a.lastWatchedAt);
		if (a.lastWatchedAt) return -1;
		if (b.lastWatchedAt) return 1;
		return b.showId - a.showId;
	});
}

export interface UpcomingItem {
	episodeId: number;
	showId: number;
	showTmdbId: number;
	showName: string;
	posterPath: string | null;
	seasonNumber: number;
	episodeNumber: number;
	episodeName: string | null;
	airDate: string;
}

/** Épisodes à venir des séries suivies non arrêtées du profil, sur 1 an. */
export function getUpcoming(userId: number): UpcomingItem[] {
	return db.all<UpcomingItem>(sql`
		SELECT e.id AS episodeId, s.id AS showId, s.tmdb_id AS showTmdbId, s.name AS showName,
			s.poster_path AS posterPath, e.season_number AS seasonNumber, e.episode_number AS episodeNumber,
			e.name AS episodeName, e.air_date AS airDate
		FROM episodes e
		JOIN shows s ON s.id = e.show_id
		JOIN user_shows us ON us.show_id = s.id AND us.user_id = ${userId}
		WHERE us.archived = 0
			AND e.air_date > date('now')
			AND e.air_date <= date('now', '+365 days')
		ORDER BY e.air_date, s.name COLLATE NOCASE, e.season_number, e.episode_number
		LIMIT 300
	`);
}

export type ShowState = 'watching' | 'uptodate' | 'finished' | 'stopped' | 'notstarted';

export interface ShowWithProgress extends Show {
	followedAt: string;
	archived: boolean;
	favorite: boolean;
	airedCount: number;
	totalCount: number;
	watchedCount: number;
	lastWatchedAt: string | null;
	state: ShowState;
	minutesWatched: number;
}

export function computeState(s: {
	archived: boolean | number;
	watchedCount: number;
	airedCount: number;
	tmdbStatus: string | null;
}): ShowState {
	if (s.archived) return 'stopped';
	if (s.watchedCount === 0) return 'notstarted';
	if (s.watchedCount < s.airedCount) return 'watching';
	return s.tmdbStatus === 'Ended' || s.tmdbStatus === 'Canceled' ? 'finished' : 'uptodate';
}

/** Séries suivies par le profil, avec progression (visionnages du profil uniquement). */
export function getShowsWithProgress(
	userId: number,
	filter?: { id?: number; tmdbId?: number }
): ShowWithProgress[] {
	const where =
		filter?.id !== undefined
			? sql`AND s.id = ${filter.id}`
			: filter?.tmdbId !== undefined
				? sql`AND s.tmdb_id = ${filter.tmdbId}`
				: sql``;
	const rows = db.all<Record<string, unknown>>(sql`
		SELECT s.id, s.tmdb_id AS tmdbId, s.tvdb_id AS tvdbId, s.name, s.original_name AS originalName,
			s.overview, s.poster_path AS posterPath, s.backdrop_path AS backdropPath,
			s.first_air_date AS firstAirDate, s.tmdb_status AS tmdbStatus, s.genres,
			s.episode_run_time AS episodeRunTime, us.followed_at AS followedAt,
			us.archived, us.favorite, s.last_synced_at AS lastSyncedAt,
			s.watch_providers AS watchProviders, s.cast,
			(SELECT COUNT(*) FROM episodes e WHERE e.show_id = s.id AND e.season_number > 0
				AND e.air_date IS NOT NULL AND e.air_date <= date('now')) AS airedCount,
			(SELECT COUNT(*) FROM episodes e WHERE e.show_id = s.id AND e.season_number > 0) AS totalCount,
			(SELECT COUNT(DISTINCT w.episode_id) FROM watches w JOIN episodes e ON e.id = w.episode_id
				WHERE e.show_id = s.id AND e.season_number > 0 AND w.user_id = ${userId}) AS watchedCount,
			(SELECT MAX(w.watched_at) FROM watches w JOIN episodes e ON e.id = w.episode_id
				WHERE e.show_id = s.id AND w.user_id = ${userId}) AS lastWatchedAt,
			(SELECT COALESCE(SUM(COALESCE(e.runtime, s.episode_run_time, 45)), 0)
				FROM watches w JOIN episodes e ON e.id = w.episode_id
				WHERE e.show_id = s.id AND w.user_id = ${userId}) AS minutesWatched
		FROM shows s
		JOIN user_shows us ON us.show_id = s.id AND us.user_id = ${userId}
		WHERE 1 = 1 ${where}
		ORDER BY s.name COLLATE NOCASE
	`);
	return rows.map((r) => {
		const row = r as unknown as ShowWithProgress;
		return {
			...row,
			archived: Boolean(r.archived),
			favorite: Boolean(r.favorite),
			state: computeState({
				archived: Boolean(r.archived),
				watchedCount: row.watchedCount,
				airedCount: row.airedCount,
				tmdbStatus: row.tmdbStatus
			})
		};
	});
}

export interface MovieWithWatch extends Movie {
	addedAt: string;
	favorite: boolean;
	watchCount: number;
	lastWatchedAt: string | null;
}

/** Films de la collection du profil, avec visionnages du profil uniquement. */
export function getMoviesWithWatch(
	userId: number,
	filter?: { id?: number; tmdbId?: number }
): MovieWithWatch[] {
	const where =
		filter?.id !== undefined
			? sql`AND m.id = ${filter.id}`
			: filter?.tmdbId !== undefined
				? sql`AND m.tmdb_id = ${filter.tmdbId}`
				: sql``;
	const rows = db.all<Record<string, unknown>>(sql`
		SELECT m.id, m.tmdb_id AS tmdbId, m.title, m.original_title AS originalTitle,
			m.overview, m.poster_path AS posterPath, m.backdrop_path AS backdropPath,
			m.release_date AS releaseDate, m.runtime, m.genres, um.added_at AS addedAt,
			um.favorite, m.last_synced_at AS lastSyncedAt, m.watch_providers AS watchProviders, m.cast,
			(SELECT COUNT(*) FROM movie_watches w WHERE w.movie_id = m.id AND w.user_id = ${userId}) AS watchCount,
			(SELECT MAX(w.watched_at) FROM movie_watches w WHERE w.movie_id = m.id AND w.user_id = ${userId}) AS lastWatchedAt
		FROM movies m
		JOIN user_movies um ON um.movie_id = m.id AND um.user_id = ${userId}
		WHERE 1 = 1 ${where}
		ORDER BY m.title COLLATE NOCASE
	`);
	return rows.map((r) => ({ ...(r as unknown as MovieWithWatch), favorite: Boolean(r.favorite) }));
}

export interface EpisodeWithWatch {
	id: number;
	seasonNumber: number;
	episodeNumber: number;
	name: string | null;
	overview: string | null;
	airDate: string | null;
	runtime: number | null;
	stillPath: string | null;
	watchCount: number;
}

export function getEpisodesWithWatch(userId: number, showId: number): EpisodeWithWatch[] {
	return db.all<EpisodeWithWatch>(sql`
		SELECT e.id, e.season_number AS seasonNumber, e.episode_number AS episodeNumber,
			e.name, e.overview, e.air_date AS airDate, e.runtime, e.still_path AS stillPath,
			(SELECT COUNT(*) FROM watches w WHERE w.episode_id = e.id AND w.user_id = ${userId}) AS watchCount
		FROM episodes e
		WHERE e.show_id = ${showId}
		ORDER BY e.season_number, e.episode_number
	`);
}

export interface ProfileStats {
	totalMinutes: number;
	seriesMinutes: number;
	movieMinutes: number;
	distinctEpisodes: number;
	totalWatches: number;
	distinctMovies: number;
	totalMovieWatches: number;
	totalMovies: number;
	countsByState: Record<ShowState, number>;
	totalShows: number;
	perMonth: { month: string; count: number }[];
	perGenre: { genre: string; minutes: number }[];
	perShow: ShowWithProgress[];
}

export function getProfileStats(userId: number): ProfileStats {
	const totals = db.get<{ totalMinutes: number | null; distinctEpisodes: number; totalWatches: number }>(sql`
		SELECT COALESCE(SUM(COALESCE(e.runtime, s.episode_run_time, 45)), 0) AS totalMinutes,
			COUNT(DISTINCT w.episode_id) AS distinctEpisodes,
			COUNT(*) AS totalWatches
		FROM watches w
		JOIN episodes e ON e.id = w.episode_id
		JOIN shows s ON s.id = e.show_id
		WHERE w.user_id = ${userId}
	`);
	const movieTotals = db.get<{ minutes: number | null; distinctMovies: number; totalWatches: number }>(sql`
		SELECT COALESCE(SUM(COALESCE(m.runtime, ${DEFAULT_MOVIE_RUNTIME})), 0) AS minutes,
			COUNT(DISTINCT w.movie_id) AS distinctMovies,
			COUNT(*) AS totalWatches
		FROM movie_watches w
		JOIN movies m ON m.id = w.movie_id
		WHERE w.user_id = ${userId}
	`);
	const totalMovies =
		db.get<{ c: number }>(sql`SELECT COUNT(*) AS c FROM user_movies WHERE user_id = ${userId}`)?.c ?? 0;
	const perMonth = db.all<{ month: string; count: number }>(sql`
		SELECT month, SUM(count) AS count FROM (
			SELECT strftime('%Y-%m', watched_at) AS month, COUNT(*) AS count
			FROM watches
			WHERE watched_at >= datetime('now', '-24 months') AND user_id = ${userId}
			GROUP BY month
			UNION ALL
			SELECT strftime('%Y-%m', watched_at) AS month, COUNT(*) AS count
			FROM movie_watches
			WHERE watched_at >= datetime('now', '-24 months') AND user_id = ${userId}
			GROUP BY month
		)
		GROUP BY month
		ORDER BY month
	`);

	const perShow = getShowsWithProgress(userId).sort((a, b) => b.minutesWatched - a.minutesWatched);

	const genreMinutes = new Map<string, number>();
	for (const s of perShow) {
		if (!s.minutesWatched) continue;
		for (const genre of JSON.parse(s.genres) as string[]) {
			genreMinutes.set(genre, (genreMinutes.get(genre) ?? 0) + s.minutesWatched);
		}
	}
	for (const m of getMoviesWithWatch(userId)) {
		if (!m.watchCount) continue;
		const minutes = m.watchCount * (m.runtime ?? DEFAULT_MOVIE_RUNTIME);
		for (const genre of JSON.parse(m.genres) as string[]) {
			genreMinutes.set(genre, (genreMinutes.get(genre) ?? 0) + minutes);
		}
	}
	const perGenre = [...genreMinutes.entries()]
		.map(([genre, minutes]) => ({ genre, minutes }))
		.sort((a, b) => b.minutes - a.minutes);

	const countsByState: Record<ShowState, number> = {
		watching: 0,
		uptodate: 0,
		finished: 0,
		stopped: 0,
		notstarted: 0
	};
	for (const s of perShow) countsByState[s.state]++;

	const seriesMinutes = totals?.totalMinutes ?? 0;
	const movieMinutes = movieTotals?.minutes ?? 0;
	return {
		totalMinutes: seriesMinutes + movieMinutes,
		seriesMinutes,
		movieMinutes,
		distinctEpisodes: totals?.distinctEpisodes ?? 0,
		totalWatches: totals?.totalWatches ?? 0,
		distinctMovies: movieTotals?.distinctMovies ?? 0,
		totalMovieWatches: movieTotals?.totalWatches ?? 0,
		totalMovies,
		countsByState,
		totalShows: perShow.length,
		perMonth,
		perGenre,
		perShow
	};
}
