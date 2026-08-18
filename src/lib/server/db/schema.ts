import { sql } from 'drizzle-orm';
import { blob, index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Profils : chaque personne utilisant l'instance a sa bibliothèque et son historique
export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	// Mot de passe optionnel (« sel:hash » scrypt) ; null = connexion directe
	passwordHash: text('password_hash'),
	// Image de profil (petite, servie par /profils/[id]/avatar) et son type MIME
	avatar: blob('avatar', { mode: 'buffer' }),
	avatarType: text('avatar_type'),
	// Anti-spoiler : masque les descriptions d'épisodes dans l'interface
	hideEpisodeOverviews: integer('hide_episode_overviews', { mode: 'boolean' })
		.notNull()
		.default(false),
	// Masque la page de suggestions « Pour vous » (onglet et route)
	hideSuggestions: integer('hide_suggestions', { mode: 'boolean' })
		.notNull()
		.default(false),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`)
});

// Catalogue partagé : métadonnées TMDB, communes à tous les profils
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
	// Note moyenne TMDB (0–10), null si inconnue
	voteAverage: real('vote_average'),
	genres: text('genres').notNull().default('[]'),
	episodeRunTime: integer('episode_run_time'),
	lastSyncedAt: text('last_synced_at'),
	// Plateformes de streaming (JSON StoredProviders, source JustWatch via TMDB)
	watchProviders: text('watch_providers'),
	// Distribution principale (JSON StoredCastMember[], via TMDB)
	cast: text('cast')
});

// Suivi d'une série par un profil (statut arrêté/favori propre à chacun)
export const userShows = sqliteTable(
	'user_shows',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		showId: integer('show_id')
			.notNull()
			.references(() => shows.id, { onDelete: 'cascade' }),
		followedAt: text('followed_at')
			.notNull()
			.default(sql`(datetime('now'))`),
		archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
		favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
		// Note personnelle du profil (1–10), null = non notée
		rating: integer('rating')
	},
	(t) => [
		uniqueIndex('user_shows_user_show').on(t.userId, t.showId),
		index('user_shows_show').on(t.showId)
	]
);

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
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		episodeId: integer('episode_id')
			.notNull()
			.references(() => episodes.id, { onDelete: 'cascade' }),
		watchedAt: text('watched_at')
			.notNull()
			.default(sql`(datetime('now'))`)
	},
	(t) => [
		index('watches_episode').on(t.episodeId),
		index('watches_watched_at').on(t.watchedAt),
		index('watches_user').on(t.userId)
	]
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
	// Note moyenne TMDB (0–10), null si inconnue
	voteAverage: real('vote_average'),
	genres: text('genres').notNull().default('[]'),
	lastSyncedAt: text('last_synced_at'),
	watchProviders: text('watch_providers'),
	// Distribution principale (JSON StoredCastMember[], via TMDB)
	cast: text('cast'),
	// Équipe principale : réalisation et production (JSON StoredCrewMember[], via TMDB)
	crew: text('crew'),
	// Sociétés de production (JSON StoredCompany[], via TMDB)
	productionCompanies: text('production_companies'),
	// Saga / collection (JSON StoredCollection ou 'null' ; NULL = pas encore récupéré)
	collection: text('collection')
});

// Présence d'un film dans la collection d'un profil
export const userMovies = sqliteTable(
	'user_movies',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		movieId: integer('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		addedAt: text('added_at')
			.notNull()
			.default(sql`(datetime('now'))`),
		favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
		// Note personnelle du profil (1–10), null = non noté
		rating: integer('rating')
	},
	(t) => [
		uniqueIndex('user_movies_user_movie').on(t.userId, t.movieId),
		index('user_movies_movie').on(t.movieId)
	]
);

export const movieWatches = sqliteTable(
	'movie_watches',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		movieId: integer('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		watchedAt: text('watched_at')
			.notNull()
			.default(sql`(datetime('now'))`)
	},
	(t) => [
		index('movie_watches_movie').on(t.movieId),
		index('movie_watches_watched_at').on(t.watchedAt),
		index('movie_watches_user').on(t.userId)
	]
);

// Catalogue bibliographique partage. Une serie regroupe des oeuvres/tomes ;
// un livre represente une edition physique ou numerique identifiee par son ISBN.
export const bookSeries = sqliteTable('book_series', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	title: text('title').notNull(),
	type: text('type'),
	collection: text('collection'),
	category: text('category'),
	externalSource: text('external_source'),
	externalId: text('external_id'),
	lastSyncedAt: text('last_synced_at')
});

export const books = sqliteTable(
	'books',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		seriesId: integer('series_id').references(() => bookSeries.id, { onDelete: 'set null' }),
		isbn13: text('isbn13'),
		isbn10: text('isbn10'),
		externalSource: text('external_source'),
		externalId: text('external_id'),
		title: text('title').notNull(),
		subtitle: text('subtitle'),
		authors: text('authors').notNull().default('[]'),
		description: text('description'),
		publisher: text('publisher'),
		publishDate: text('publish_date'),
		language: text('language'),
		pageCount: integer('page_count'),
		coverUrl: text('cover_url'),
		volume: text('volume'),
		numbering: text('numbering'),
		price: real('price'),
		lastSyncedAt: text('last_synced_at')
	},
	(t) => [
		uniqueIndex('books_isbn13').on(t.isbn13),
		index('books_series').on(t.seriesId),
		index('books_external').on(t.externalSource, t.externalId)
	]
);

// Etat d'une edition dans la bibliotheque d'un profil. Les attributs avances
// correspondent aux colonnes exportees par Bubble et restent independants du catalogue.
export const userBooks = sqliteTable(
	'user_books',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		bookId: integer('book_id')
			.notNull()
			.references(() => books.id, { onDelete: 'cascade' }),
		addedAt: text('added_at')
			.notNull()
			.default(sql`(datetime('now'))`),
		inCollection: integer('in_collection', { mode: 'boolean' }).notNull().default(true),
		wishlist: integer('wishlist', { mode: 'boolean' }).notNull().default(false),
		readingStatus: text('reading_status').notNull().default('unread'),
		favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
		rating: integer('rating'),
		review: text('review'),
		signed: integer('signed', { mode: 'boolean' }).notNull().default(false),
		originalEdition: integer('original_edition', { mode: 'boolean' }).notNull().default(false),
		deluxe: integer('deluxe', { mode: 'boolean' }).notNull().default(false),
		limitedSeries: integer('limited_series', { mode: 'boolean' }).notNull().default(false),
		digital: integer('digital', { mode: 'boolean' }).notNull().default(false),
		forSale: integer('for_sale', { mode: 'boolean' }).notNull().default(false),
		purchasePrice: real('purchase_price'),
		estimatedValue: real('estimated_value'),
		condition: text('condition')
	},
	(t) => [
		uniqueIndex('user_books_user_book').on(t.userId, t.bookId),
		index('user_books_user').on(t.userId),
		index('user_books_book').on(t.bookId)
	]
);

export const userBookSeries = sqliteTable(
	'user_book_series',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		seriesId: integer('series_id')
			.notNull()
			.references(() => bookSeries.id, { onDelete: 'cascade' }),
		followed: integer('followed', { mode: 'boolean' }).notNull().default(true),
		rating: integer('rating'),
		review: text('review')
	},
	(t) => [
		uniqueIndex('user_book_series_user_series').on(t.userId, t.seriesId),
		index('user_book_series_series').on(t.seriesId)
	]
);

export type User = typeof users.$inferSelect;
export type Show = typeof shows.$inferSelect;
export type UserShow = typeof userShows.$inferSelect;
export type Episode = typeof episodes.$inferSelect;
export type Watch = typeof watches.$inferSelect;
export type Movie = typeof movies.$inferSelect;
export type UserMovie = typeof userMovies.$inferSelect;
export type MovieWatch = typeof movieWatches.$inferSelect;
export type BookSeries = typeof bookSeries.$inferSelect;
export type Book = typeof books.$inferSelect;
export type UserBook = typeof userBooks.$inferSelect;
export type UserBookSeries = typeof userBookSeries.$inferSelect;
