import { sql } from 'drizzle-orm';
import { db } from './db';
import type { Show } from './db/schema';

export interface WatchNextItem {
	showId: number;
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
	seasonNumber: number;
	episodeNumber: number;
	episodeName: string | null;
	airDate: string | null;
	stillPath: string | null;
	showName: string;
	posterPath: string | null;
	followedAt: string;
}

/** Prochain épisode à voir par série suivie (non archivée), trié par activité récente. */
export function getWatchNext(): WatchNextItem[] {
	const rows = db.all<UnwatchedRow>(sql`
		SELECT e.id AS episodeId, e.show_id AS showId, e.season_number AS seasonNumber,
			e.episode_number AS episodeNumber, e.name AS episodeName, e.air_date AS airDate,
			e.still_path AS stillPath, s.name AS showName, s.poster_path AS posterPath,
			s.followed_at AS followedAt
		FROM episodes e
		JOIN shows s ON s.id = e.show_id
		WHERE s.archived = 0
			AND e.season_number > 0
			AND e.air_date IS NOT NULL AND e.air_date <= date('now')
			AND NOT EXISTS (SELECT 1 FROM watches w WHERE w.episode_id = e.id)
		ORDER BY e.show_id, e.season_number, e.episode_number
	`);
	const lastActivity = new Map<number, string>(
		db
			.all<{ showId: number; last: string }>(
				sql`SELECT e.show_id AS showId, MAX(w.watched_at) AS last
					FROM watches w JOIN episodes e ON e.id = w.episode_id GROUP BY e.show_id`
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
	showName: string;
	posterPath: string | null;
	seasonNumber: number;
	episodeNumber: number;
	episodeName: string | null;
	airDate: string;
}

/** Épisodes à venir des séries suivies non archivées, sur 1 an. */
export function getUpcoming(): UpcomingItem[] {
	return db.all<UpcomingItem>(sql`
		SELECT e.id AS episodeId, s.id AS showId, s.name AS showName, s.poster_path AS posterPath,
			e.season_number AS seasonNumber, e.episode_number AS episodeNumber,
			e.name AS episodeName, e.air_date AS airDate
		FROM episodes e
		JOIN shows s ON s.id = e.show_id
		WHERE s.archived = 0
			AND e.air_date > date('now')
			AND e.air_date <= date('now', '+365 days')
		ORDER BY e.air_date, s.name COLLATE NOCASE, e.season_number, e.episode_number
		LIMIT 300
	`);
}

export type ShowState = 'watching' | 'uptodate' | 'finished' | 'stopped' | 'notstarted';

export interface ShowWithProgress extends Show {
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

export function getShowsWithProgress(showId?: number): ShowWithProgress[] {
	const rows = db.all<Record<string, unknown>>(sql`
		SELECT s.id, s.tmdb_id AS tmdbId, s.tvdb_id AS tvdbId, s.name, s.original_name AS originalName,
			s.overview, s.poster_path AS posterPath, s.backdrop_path AS backdropPath,
			s.first_air_date AS firstAirDate, s.tmdb_status AS tmdbStatus, s.genres,
			s.episode_run_time AS episodeRunTime, s.followed_at AS followedAt,
			s.archived, s.favorite, s.last_synced_at AS lastSyncedAt,
			(SELECT COUNT(*) FROM episodes e WHERE e.show_id = s.id AND e.season_number > 0
				AND e.air_date IS NOT NULL AND e.air_date <= date('now')) AS airedCount,
			(SELECT COUNT(*) FROM episodes e WHERE e.show_id = s.id AND e.season_number > 0) AS totalCount,
			(SELECT COUNT(DISTINCT w.episode_id) FROM watches w JOIN episodes e ON e.id = w.episode_id
				WHERE e.show_id = s.id AND e.season_number > 0) AS watchedCount,
			(SELECT MAX(w.watched_at) FROM watches w JOIN episodes e ON e.id = w.episode_id
				WHERE e.show_id = s.id) AS lastWatchedAt,
			(SELECT COALESCE(SUM(COALESCE(e.runtime, s.episode_run_time, 45)), 0)
				FROM watches w JOIN episodes e ON e.id = w.episode_id
				WHERE e.show_id = s.id) AS minutesWatched
		FROM shows s
		${showId !== undefined ? sql`WHERE s.id = ${showId}` : sql``}
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

export function getEpisodesWithWatch(showId: number): EpisodeWithWatch[] {
	return db.all<EpisodeWithWatch>(sql`
		SELECT e.id, e.season_number AS seasonNumber, e.episode_number AS episodeNumber,
			e.name, e.overview, e.air_date AS airDate, e.runtime, e.still_path AS stillPath,
			(SELECT COUNT(*) FROM watches w WHERE w.episode_id = e.id) AS watchCount
		FROM episodes e
		WHERE e.show_id = ${showId}
		ORDER BY e.season_number, e.episode_number
	`);
}

export interface ProfileStats {
	totalMinutes: number;
	distinctEpisodes: number;
	totalWatches: number;
	countsByState: Record<ShowState, number>;
	totalShows: number;
	perMonth: { month: string; count: number }[];
	perGenre: { genre: string; minutes: number }[];
	perShow: ShowWithProgress[];
}

export function getProfileStats(): ProfileStats {
	const totals = db.get<{ totalMinutes: number | null; distinctEpisodes: number; totalWatches: number }>(sql`
		SELECT COALESCE(SUM(COALESCE(e.runtime, s.episode_run_time, 45)), 0) AS totalMinutes,
			COUNT(DISTINCT w.episode_id) AS distinctEpisodes,
			COUNT(*) AS totalWatches
		FROM watches w
		JOIN episodes e ON e.id = w.episode_id
		JOIN shows s ON s.id = e.show_id
	`);
	const perMonth = db.all<{ month: string; count: number }>(sql`
		SELECT strftime('%Y-%m', watched_at) AS month, COUNT(*) AS count
		FROM watches
		WHERE watched_at >= datetime('now', '-24 months')
		GROUP BY month
		ORDER BY month
	`);

	const perShow = getShowsWithProgress().sort((a, b) => b.minutesWatched - a.minutesWatched);

	const genreMinutes = new Map<string, number>();
	for (const s of perShow) {
		if (!s.minutesWatched) continue;
		for (const genre of JSON.parse(s.genres) as string[]) {
			genreMinutes.set(genre, (genreMinutes.get(genre) ?? 0) + s.minutesWatched);
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

	return {
		totalMinutes: totals?.totalMinutes ?? 0,
		distinctEpisodes: totals?.distinctEpisodes ?? 0,
		totalWatches: totals?.totalWatches ?? 0,
		countsByState,
		totalShows: perShow.length,
		perMonth,
		perGenre,
		perShow
	};
}
