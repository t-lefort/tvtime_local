/**
 * Import de l'export GDPR de TV Time.
 *
 * Usage : npm run import -- <dossier-gdpr> [nom-du-profil]
 *
 * Les données sont rattachées au profil indiqué (créé au besoin, « Profil 1 » par défaut).
 *
 * Règles :
 * - followed_tv_show.csv  : active=1 → série suivie (archived selon le flag "archived" = arrêtée) ;
 *                           active=0 → série désuivie dans TV Time → importée comme "arrêtée"
 * - tracking-prod-records-v2.csv : lignes watch-episode / rewatch-episode = historique complet
 *   (les séries présentes uniquement dans l'historique sont importées comme "arrêtées")
 * - tracking-prod-records.csv et tracking-prod-records-v2.csv : lignes films watch / rewatch /
 *   watchlist = collection films et historique complet
 * - user_show_special_status.csv : favorite → favori
 * Le script est idempotent : relançable après une interruption.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { sql } from 'drizzle-orm';
import { db } from '../src/lib/server/db';
import { addOrUpdateMovie, collectMovie, getMovieByTmdbId } from '../src/lib/server/movies';
import { addOrUpdateShow, followShow, getShowByTvdbId } from '../src/lib/server/shows';
import { createUser, getUserByName } from '../src/lib/server/users';
import { findByTvdbId, searchMovie, searchTv } from '../src/lib/server/tmdb';
import { collectMovieImportData, norm, type MovieToImport, type MovieWatchEvent } from './import-tvtime-utils';

const folder = process.argv[2];
if (!folder || !fs.existsSync(folder)) {
	console.error('Usage : npm run import -- <dossier-gdpr> [nom-du-profil]');
	process.exit(1);
}

const profileName = process.argv[3]?.trim() || 'Profil 1';
const user = getUserByName(profileName) ?? createUser(profileName);
console.log(`Profil cible : ${user.name}\n`);

function readCsv(name: string): Record<string, string>[] {
	const file = path.join(folder, name);
	if (!fs.existsSync(file)) {
		console.warn(`⚠ Fichier absent, ignoré : ${name}`);
		return [];
	}
	return parse(fs.readFileSync(file, 'utf8'), { columns: true, skip_empty_lines: true });
}

interface ShowToImport {
	tvdbId: number;
	name: string;
	archived: boolean;
	followedAt?: string;
	source: 'suivie' | 'désuivie' | 'historique seul';
}

interface WatchEvent {
	tvdbShowId: number;
	seasonNumber: number;
	episodeNumber: number;
	watchedAt: string;
	seriesName: string;
}

// ---------- 1. Lecture des CSV ----------

const followedRows = readCsv('followed_tv_show.csv');
const trackingRows = readCsv('tracking-prod-records-v2.csv');
const movieTrackingRows = readCsv('tracking-prod-records.csv');
const statusRows = readCsv('user_show_special_status.csv');
const statsRows = readCsv('user_statistics.csv');

const showsToImport = new Map<number, ShowToImport>();
for (const r of followedRows) {
	const tvdbId = Number(r.tv_show_id);
	if (!tvdbId) continue;
	const active = r.active === '1';
	showsToImport.set(tvdbId, {
		tvdbId,
		name: r.tv_show_name,
		archived: !active || r.archived === '1',
		followedAt: r.created_at || undefined,
		source: active ? 'suivie' : 'désuivie'
	});
}

const watchEvents: WatchEvent[] = [];
for (const r of trackingRows) {
	const key = r.key ?? '';
	if (!key.startsWith('watch-episode-') && !key.startsWith('rewatch-episode-')) continue;
	const tvdbShowId = Number(r.s_id);
	if (!tvdbShowId) continue;
	watchEvents.push({
		tvdbShowId,
		seasonNumber: Number(r.season_number),
		episodeNumber: Number(r.episode_number),
		watchedAt: r.created_at,
		seriesName: r.series_name
	});
	if (!showsToImport.has(tvdbShowId)) {
		showsToImport.set(tvdbShowId, {
			tvdbId: tvdbShowId,
			name: r.series_name,
			archived: true,
			source: 'historique seul'
		});
	}
}

const favoriteTvdbIds = new Set(
	statusRows.filter((r) => r.status === 'favorite').map((r) => Number(r.tv_show_id))
);
const movieImportData = collectMovieImportData([...movieTrackingRows, ...trackingRows]);

console.log(`Séries à importer : ${showsToImport.size} (dont ${[...showsToImport.values()].filter((s) => !s.archived).length} actives)`);
console.log(`Épisodes vus (événements) : ${watchEvents.length}\n`);
console.log(`Films à importer : ${movieImportData.moviesToImport.size} (dont ${movieImportData.watchEvents.length} visionnage(s))\n`);

// ---------- 2. Import des séries depuis TMDB (concurrence 5) ----------

const unmappedShows: ShowToImport[] = [];
const failedShows: { show: ShowToImport; error: string }[] = [];
const matchedByName: { name: string; tmdbName: string; tmdbId: number }[] = [];
const tvdbToLocalId = new Map<number, number>();
let imported = 0;
let skipped = 0;

/**
 * TMDB stocke parfois un id TheTVDB différent de celui de l'export TV Time
 * (ex. Prison Break : 75340 côté TV Time, 360115 côté TMDB). Si /find échoue,
 * on se replie sur une recherche par nom (+ année si présente dans le nom).
 */
async function resolveTmdbId(item: ShowToImport): Promise<number | null> {
	const byTvdb = await findByTvdbId(item.tvdbId);
	if (byTvdb) return byTvdb;

	const m = item.name.match(/^(.*?)\s*\((\d{4})\)\s*$/);
	const query = m ? m[1] : item.name;
	const year = m?.[2];
	const results = await searchTv(query);
	let candidates = results;
	if (year) {
		const sameYear = results.filter((r) => r.first_air_date?.slice(0, 4) === year);
		if (sameYear.length) candidates = sameYear;
	}
	const exact = candidates.find(
		(r) => norm(r.name) === norm(query) || norm(r.original_name) === norm(query)
	);
	const pick = exact ?? candidates[0];
	if (!pick) return null;
	matchedByName.push({ name: item.name, tmdbName: pick.name, tmdbId: pick.id });
	return pick.id;
}

async function importShow(item: ShowToImport): Promise<void> {
	const followOpts = {
		archived: item.archived,
		favorite: favoriteTvdbIds.has(item.tvdbId),
		followedAt: item.followedAt
	};
	const existing = getShowByTvdbId(item.tvdbId);
	if (existing) {
		followShow(user.id, existing.id, followOpts);
		tvdbToLocalId.set(item.tvdbId, existing.id);
		skipped++;
		return;
	}
	const tmdbId = await resolveTmdbId(item);
	if (!tmdbId) {
		unmappedShows.push(item);
		return;
	}
	const show = await addOrUpdateShow(tmdbId, { tvdbId: item.tvdbId });
	followShow(user.id, show.id, followOpts);
	tvdbToLocalId.set(item.tvdbId, show.id);
	imported++;
	console.log(`✓ [${imported + skipped}/${showsToImport.size}] ${show.name} (${item.source}${item.archived ? ', arrêtée' : ''})`);
}

const queue = [...showsToImport.values()];
async function worker(): Promise<void> {
	for (;;) {
		const item = queue.shift();
		if (!item) return;
		try {
			await importShow(item);
		} catch (e) {
			failedShows.push({ show: item, error: String(e) });
			console.error(`✗ ${item.name} : ${e}`);
		}
	}
}
await Promise.all(Array.from({ length: 5 }, worker));

// ---------- 3. Import des films depuis TMDB ----------

const unmappedMovies: MovieToImport[] = [];
const failedMovies: { movie: MovieToImport; error: string }[] = [];
const matchedMoviesByName: { name: string; tmdbTitle: string; tmdbId: number }[] = [];
const movieKeyToLocalId = new Map<string, number>();
let moviesImported = 0;
let moviesSkipped = 0;

async function resolveMovieTmdbId(item: MovieToImport): Promise<number | null> {
	const results = await searchMovie(item.name);
	let candidates = results;
	if (item.releaseYear) {
		const sameYear = results.filter((r) => r.release_date?.slice(0, 4) === item.releaseYear);
		if (sameYear.length) candidates = sameYear;
	}
	const exact = candidates.find(
		(r) => norm(r.title) === norm(item.name) || norm(r.original_title) === norm(item.name)
	);
	const pick = exact ?? candidates[0];
	if (!pick) return null;
	if (!exact) matchedMoviesByName.push({ name: item.name, tmdbTitle: pick.title, tmdbId: pick.id });
	return pick.id;
}

async function importMovie(item: MovieToImport): Promise<void> {
	const tmdbId = await resolveMovieTmdbId(item);
	if (!tmdbId) {
		unmappedMovies.push(item);
		return;
	}
	const existing = getMovieByTmdbId(tmdbId);
	if (existing) {
		collectMovie(user.id, existing.id, { addedAt: item.addedAt });
		movieKeyToLocalId.set(item.key, existing.id);
		moviesSkipped++;
		return;
	}
	const movie = await addOrUpdateMovie(tmdbId);
	collectMovie(user.id, movie.id, { addedAt: item.addedAt });
	movieKeyToLocalId.set(item.key, movie.id);
	moviesImported++;
	console.log(`✓ [film ${moviesImported + moviesSkipped}/${movieImportData.moviesToImport.size}] ${movie.title} (${item.source})`);
}

const movieQueue = [...movieImportData.moviesToImport.values()];
async function movieWorker(): Promise<void> {
	for (;;) {
		const item = movieQueue.shift();
		if (!item) return;
		try {
			await importMovie(item);
		} catch (e) {
			failedMovies.push({ movie: item, error: String(e) });
			console.error(`✗ ${item.name} : ${e}`);
		}
	}
}
await Promise.all(Array.from({ length: 5 }, movieWorker));

// ---------- 4. Insertion des visionnages ----------

let watchesInserted = 0;
let watchesAlready = 0;
const unmatchedEpisodes: WatchEvent[] = [];
let movieWatchesInserted = 0;
let movieWatchesAlready = 0;
const unmatchedMovieWatches: MovieWatchEvent[] = [];

const findEpisode = db.$client.prepare(
	'SELECT id FROM episodes WHERE show_id = ? AND season_number = ? AND episode_number = ?'
);
const findWatch = db.$client.prepare(
	'SELECT id FROM watches WHERE user_id = ? AND episode_id = ? AND watched_at = ?'
);
const insertWatch = db.$client.prepare(
	'INSERT INTO watches (user_id, episode_id, watched_at) VALUES (?, ?, ?)'
);
const findMovieWatch = db.$client.prepare(
	'SELECT id FROM movie_watches WHERE user_id = ? AND movie_id = ? AND watched_at = ?'
);
const insertMovieWatch = db.$client.prepare(
	'INSERT INTO movie_watches (user_id, movie_id, watched_at) VALUES (?, ?, ?)'
);

for (const ev of watchEvents) {
	const showId = tvdbToLocalId.get(ev.tvdbShowId);
	if (!showId) {
		unmatchedEpisodes.push(ev);
		continue;
	}
	const ep = findEpisode.get(showId, ev.seasonNumber, ev.episodeNumber) as { id: number } | undefined;
	if (!ep) {
		unmatchedEpisodes.push(ev);
		continue;
	}
	if (findWatch.get(user.id, ep.id, ev.watchedAt)) {
		watchesAlready++;
		continue;
	}
	insertWatch.run(user.id, ep.id, ev.watchedAt);
	watchesInserted++;
}

for (const ev of movieImportData.watchEvents) {
	const movieId = movieKeyToLocalId.get(ev.key);
	if (!movieId) {
		unmatchedMovieWatches.push(ev);
		continue;
	}
	if (findMovieWatch.get(user.id, movieId, ev.watchedAt)) {
		movieWatchesAlready++;
		continue;
	}
	insertMovieWatch.run(user.id, movieId, ev.watchedAt);
	movieWatchesInserted++;
}

// ---------- 5. Rapport ----------

const totals = db.get<{ minutes: number; episodes: number }>(sql`
	SELECT COALESCE(SUM(COALESCE(e.runtime, s.episode_run_time, 45)), 0) AS minutes,
		COUNT(DISTINCT w.episode_id) AS episodes
	FROM watches w JOIN episodes e ON e.id = w.episode_id JOIN shows s ON s.id = e.show_id
	WHERE w.user_id = ${user.id}
`);
const movieTotals = db.get<{ minutes: number; movies: number }>(sql`
	SELECT COALESCE(SUM(COALESCE(m.runtime, 110)), 0) AS minutes,
		COUNT(DISTINCT w.movie_id) AS movies
	FROM movie_watches w JOIN movies m ON m.id = w.movie_id
	WHERE w.user_id = ${user.id}
`);
const refMinutes = Number(statsRows[0]?.time_spent ?? 0);
const totalMinutes = (totals?.minutes ?? 0) + (movieTotals?.minutes ?? 0);

console.log('\n================ RAPPORT ================');
console.log(`Séries importées : ${imported} (déjà présentes : ${skipped})`);
console.log(`Films importés : ${moviesImported} (déjà présents : ${moviesSkipped})`);
console.log(`Visionnages insérés : ${watchesInserted} (déjà présents : ${watchesAlready})`);
console.log(`Visionnages films insérés : ${movieWatchesInserted} (déjà présents : ${movieWatchesAlready})`);
console.log(`Épisodes vus distincts en base : ${totals?.episodes}`);
console.log(`Films vus distincts en base : ${movieTotals?.movies}`);
console.log(`Temps total calculé : ${totalMinutes} min${refMinutes ? ` (référence TV Time : ${refMinutes} min)` : ''}`);

if (matchedByName.length) {
	console.log(`\nℹ ${matchedByName.length} séries mappées par nom (id TVDB inconnu de TMDB) — à vérifier :`);
	for (const s of matchedByName) console.log(`  - "${s.name}" → "${s.tmdbName}" (tmdb ${s.tmdbId})`);
}
if (matchedMoviesByName.length) {
	console.log(`\nℹ ${matchedMoviesByName.length} films mappés par nom — à vérifier :`);
	for (const m of matchedMoviesByName) console.log(`  - "${m.name}" → "${m.tmdbTitle}" (tmdb ${m.tmdbId})`);
}
if (unmappedShows.length) {
	console.log(`\n⚠ ${unmappedShows.length} séries introuvables sur TMDB (à ajouter via la recherche) :`);
	for (const s of unmappedShows) console.log(`  - ${s.name} (tvdb ${s.tvdbId}, ${s.source})`);
}
if (unmappedMovies.length) {
	console.log(`\n⚠ ${unmappedMovies.length} films introuvables sur TMDB (à ajouter via la recherche) :`);
	for (const m of unmappedMovies) console.log(`  - ${m.name}${m.releaseYear ? ` (${m.releaseYear})` : ''} (${m.source})`);
}
if (failedShows.length) {
	console.log(`\n✗ ${failedShows.length} séries en échec (relancez l'import) :`);
	for (const f of failedShows) console.log(`  - ${f.show.name} : ${f.error}`);
}
if (failedMovies.length) {
	console.log(`\n✗ ${failedMovies.length} films en échec (relancez l'import) :`);
	for (const f of failedMovies) console.log(`  - ${f.movie.name} : ${f.error}`);
}
if (unmatchedEpisodes.length) {
	console.log(`\n⚠ ${unmatchedEpisodes.length} visionnages non rattachés à un épisode :`);
	const byShow = new Map<string, number>();
	for (const ev of unmatchedEpisodes) {
		byShow.set(ev.seriesName, (byShow.get(ev.seriesName) ?? 0) + 1);
	}
	for (const [name, count] of byShow) console.log(`  - ${name} : ${count} épisode(s)`);
}
if (unmatchedMovieWatches.length) {
	console.log(`\n⚠ ${unmatchedMovieWatches.length} visionnages non rattachés à un film :`);
	const byMovie = new Map<string, number>();
	for (const ev of unmatchedMovieWatches) {
		const name = `${ev.movieName}${ev.releaseYear ? ` (${ev.releaseYear})` : ''}`;
		byMovie.set(name, (byMovie.get(name) ?? 0) + 1);
	}
	for (const [name, count] of byMovie) console.log(`  - ${name} : ${count} visionnage(s)`);
}
console.log('=========================================');
