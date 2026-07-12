/**
 * Système multi-utilisateurs : migration d'une base mono-utilisateur existante
 * vers les profils, puis isolation des données entre profils.
 *
 * La base de test est créée avec les migrations 0000-0002 (schéma mono-utilisateur),
 * remplie, puis ouverte par l'app (qui applique 0003) — comme une vraie mise à jour.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvtime-test-'));
const dbPath = path.join(tmpDir, 'test.db');
process.env.DATABASE_PATH = dbPath;

// ---------- Base legacy (migrations 0000-0002) avec données ----------

const legacyDir = path.join(tmpDir, 'drizzle-legacy');
fs.mkdirSync(path.join(legacyDir, 'meta'), { recursive: true });
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8'));
const legacyEntries = journal.entries.filter((e: { idx: number }) => e.idx <= 2);
fs.writeFileSync(
	path.join(legacyDir, 'meta', '_journal.json'),
	JSON.stringify({ ...journal, entries: legacyEntries })
);
for (const entry of legacyEntries) {
	fs.copyFileSync(`drizzle/${entry.tag}.sql`, path.join(legacyDir, `${entry.tag}.sql`));
}

{
	const legacy = new Database(dbPath);
	legacy.pragma('journal_mode = WAL');
	migrate(drizzle(legacy), { migrationsFolder: legacyDir });
	legacy.exec(`
		INSERT INTO shows (id, tmdb_id, name, genres, followed_at, archived, favorite)
			VALUES (1, 100, 'Ma Série', '["Drame"]', '2024-01-05 10:00:00', 0, 1);
		INSERT INTO episodes (id, show_id, tmdb_id, season_number, episode_number, air_date, runtime)
			VALUES (1, 1, 1000, 1, 1, '2024-01-01', 40), (2, 1, 1001, 1, 2, '2024-01-08', 40);
		INSERT INTO watches (episode_id, watched_at) VALUES (1, '2024-06-01 20:00:00');
		INSERT INTO movies (id, tmdb_id, title, genres, added_at, favorite, runtime)
			VALUES (1, 200, 'Mon Film', '["Action"]', '2024-02-02 12:00:00', 1, 120);
		INSERT INTO movie_watches (movie_id, watched_at) VALUES (1, '2024-06-02 21:00:00');
	`);
	legacy.close();
}

// L'app ouvre la base et applique la migration 0003 (profils)
const { db } = await import('../src/lib/server/db');
const { getMoviesWithWatch, getProfileStats, getShowsWithProgress, getWatchNext } = await import(
	'../src/lib/server/queries'
);
const { followShow, unfollowShow } = await import('../src/lib/server/shows');
const { uncollectMovie } = await import('../src/lib/server/movies');
const { createUser, deleteUser, listUsers } = await import('../src/lib/server/users');

test('la migration rattache les données existantes à un profil par défaut', () => {
	const users = listUsers();
	assert.equal(users.length, 1);
	assert.equal(users[0].name, 'Profil 1');
	const defaultId = users[0].id;

	const shows = getShowsWithProgress(defaultId);
	assert.equal(shows.length, 1);
	assert.equal(shows[0].favorite, true);
	assert.equal(shows[0].archived, false);
	assert.equal(shows[0].followedAt, '2024-01-05 10:00:00');
	assert.equal(shows[0].watchedCount, 1);

	const movies = getMoviesWithWatch(defaultId);
	assert.equal(movies.length, 1);
	assert.equal(movies[0].favorite, true);
	assert.equal(movies[0].addedAt, '2024-02-02 12:00:00');
	assert.equal(movies[0].watchCount, 1);

	const stats = getProfileStats(defaultId);
	assert.equal(stats.distinctEpisodes, 1);
	assert.equal(stats.distinctMovies, 1);
	assert.equal(stats.totalMinutes, 40 + 120);

	// Les colonnes mono-utilisateur ont bien quitté le catalogue
	const showCols = db.$client
		.prepare(`SELECT name FROM pragma_table_info('shows')`)
		.all()
		.map((r) => (r as { name: string }).name);
	assert.ok(!showCols.includes('archived') && !showCols.includes('favorite'));
});

test('chaque profil a sa bibliothèque et son historique', () => {
	const defaultId = listUsers()[0].id;
	const bob = createUser('Bob');

	assert.equal(getShowsWithProgress(bob.id).length, 0, 'nouveau profil sans série');
	assert.equal(getMoviesWithWatch(bob.id).length, 0, 'nouveau profil sans film');

	followShow(bob.id, 1);
	const bobShows = getShowsWithProgress(bob.id);
	assert.equal(bobShows.length, 1);
	assert.equal(bobShows[0].watchedCount, 0, 'les visionnages du profil 1 ne fuient pas');

	// Bob voit l'épisode 2 : son prochain épisode devient le 1, celui du profil 1 reste le 2
	db.$client
		.prepare('INSERT INTO watches (user_id, episode_id, watched_at) VALUES (?, 2, ?)')
		.run(bob.id, '2024-06-03 20:00:00');
	assert.equal(getWatchNext(bob.id)[0].episodeNumber, 1);
	assert.equal(getWatchNext(defaultId)[0].episodeNumber, 2);

	// Bob arrête la série : plus rien dans son fil, aucun effet sur le profil 1
	unfollowShow(bob.id, 1);
	assert.equal(getShowsWithProgress(bob.id).length, 0);
	assert.equal(getWatchNext(bob.id).length, 0);
	assert.equal(getShowsWithProgress(defaultId)[0].watchedCount, 1);
	const bobWatches = db.$client
		.prepare('SELECT COUNT(*) AS c FROM watches WHERE user_id = ?')
		.get(bob.id) as { c: number };
	assert.equal(bobWatches.c, 0, 'historique de Bob supprimé avec le désabonnement');

	deleteUser(bob.id);
	assert.equal(listUsers().length, 1);
});

test('le catalogue est nettoyé quand plus aucun profil ne référence une fiche', () => {
	const defaultId = listUsers()[0].id;
	uncollectMovie(defaultId, 1);
	assert.equal(getMoviesWithWatch(defaultId).length, 0);
	const left = db.$client.prepare('SELECT COUNT(*) AS c FROM movies').get() as { c: number };
	assert.equal(left.c, 0, 'fiche film supprimée du catalogue');

	// La série reste : le profil par défaut la suit toujours
	const showsLeft = db.$client.prepare('SELECT COUNT(*) AS c FROM shows').get() as { c: number };
	assert.equal(showsLeft.c, 1);
});
