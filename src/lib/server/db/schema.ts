import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const shows = sqliteTable('shows', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	tmdbId: integer('tmdb_id').notNull().unique(),
	tvdbId: integer('tvdb_id'),
	name: text('name').notNull(),
	originalName: text('original_name'),
	overview: text('overview'),
	posterPath: text('poster_path'),
	backdropPath: text('backdrop_path'),
	firstAirDate: text('first_air_date'),
	tmdbStatus: text('tmdb_status'),
	genres: text('genres').notNull().default('[]'),
	episodeRunTime: integer('episode_run_time'),
	followedAt: text('followed_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
	favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
	lastSyncedAt: text('last_synced_at'),
	// Plateformes de streaming (JSON StoredProviders, source JustWatch via TMDB)
	watchProviders: text('watch_providers'),
	// Distribution principale (JSON StoredCastMember[], via TMDB)
	cast: text('cast')
});

export const episodes = sqliteTable(
	'episodes',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		showId: integer('show_id')
			.notNull()
			.references(() => shows.id, { onDelete: 'cascade' }),
		tmdbId: integer('tmdb_id').notNull().unique(),
		seasonNumber: integer('season_number').notNull(),
		episodeNumber: integer('episode_number').notNull(),
		name: text('name'),
		overview: text('overview'),
		airDate: text('air_date'),
		runtime: integer('runtime'),
		stillPath: text('still_path')
	},
	(t) => [
		uniqueIndex('episodes_show_season_ep').on(t.showId, t.seasonNumber, t.episodeNumber),
		index('episodes_air_date').on(t.airDate)
	]
);

export const watches = sqliteTable(
	'watches',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		episodeId: integer('episode_id')
			.notNull()
			.references(() => episodes.id, { onDelete: 'cascade' }),
		watchedAt: text('watched_at')
			.notNull()
			.default(sql`(datetime('now'))`)
	},
	(t) => [index('watches_episode').on(t.episodeId), index('watches_watched_at').on(t.watchedAt)]
);

export const movies = sqliteTable('movies', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	tmdbId: integer('tmdb_id').notNull().unique(),
	title: text('title').notNull(),
	originalTitle: text('original_title'),
	overview: text('overview'),
	posterPath: text('poster_path'),
	backdropPath: text('backdrop_path'),
	releaseDate: text('release_date'),
	runtime: integer('runtime'),
	genres: text('genres').notNull().default('[]'),
	addedAt: text('added_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
	lastSyncedAt: text('last_synced_at'),
	watchProviders: text('watch_providers'),
	// Distribution principale (JSON StoredCastMember[], via TMDB)
	cast: text('cast')
});

export const movieWatches = sqliteTable(
	'movie_watches',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		movieId: integer('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		watchedAt: text('watched_at')
			.notNull()
			.default(sql`(datetime('now'))`)
	},
	(t) => [
		index('movie_watches_movie').on(t.movieId),
		index('movie_watches_watched_at').on(t.watchedAt)
	]
);

export type Show = typeof shows.$inferSelect;
export type Episode = typeof episodes.$inferSelect;
export type Watch = typeof watches.$inferSelect;
export type Movie = typeof movies.$inferSelect;
export type MovieWatch = typeof movieWatches.$inferSelect;
