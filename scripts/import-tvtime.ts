/**
 * Import de l'export GDPR de TV Time (version ligne de commande).
 *
 * Usage : npm run import -- <dossier-gdpr> [nom-du-profil]
 *
 * Les données sont rattachées au profil indiqué (créé au besoin, « Profil 1 » par défaut).
 * La logique d'import (aussi utilisée par la page profil) vit dans
 * src/lib/server/tvtime-import.ts.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createUser, getUserByName } from '../src/lib/server/users';
import {
	runTvTimeImport,
	TVTIME_CSV_NAMES,
	type TvTimeCsvFiles
} from '../src/lib/server/tvtime-import';

const folder = process.argv[2];
if (!folder || !fs.existsSync(folder)) {
	console.error('Usage : npm run import -- <dossier-gdpr> [nom-du-profil]');
	process.exit(1);
}

const profileName = process.argv[3]?.trim() || 'Profil 1';
const user = getUserByName(profileName) ?? createUser(profileName);
console.log(`Profil cible : ${user.name}\n`);

const files: TvTimeCsvFiles = {};
for (const name of TVTIME_CSV_NAMES) {
	const file = path.join(folder, name);
	if (fs.existsSync(file)) files[name] = fs.readFileSync(file, 'utf8');
}

const report = await runTvTimeImport(user.id, files, { onLog: console.log });

console.log('\n================ RAPPORT ================');
console.log(`Séries importées : ${report.showsImported} (déjà présentes : ${report.showsSkipped})`);
console.log(`Films importés : ${report.moviesImported} (déjà présents : ${report.moviesSkipped})`);
console.log(`Visionnages insérés : ${report.watchesInserted} (déjà présents : ${report.watchesAlready})`);
console.log(`Visionnages films insérés : ${report.movieWatchesInserted} (déjà présents : ${report.movieWatchesAlready})`);
console.log(`Épisodes vus distincts en base : ${report.distinctEpisodes}`);
console.log(`Films vus distincts en base : ${report.distinctMovies}`);
console.log(
	`Temps total calculé : ${report.totalMinutes} min${report.refMinutes ? ` (référence TV Time : ${report.refMinutes} min)` : ''}`
);

if (report.matchedByName.length) {
	console.log(`\nℹ ${report.matchedByName.length} séries mappées par nom (id TVDB inconnu de TMDB) — à vérifier :`);
	for (const s of report.matchedByName) console.log(`  - "${s.name}" → "${s.tmdbName}" (tmdb ${s.tmdbId})`);
}
if (report.matchedMoviesByName.length) {
	console.log(`\nℹ ${report.matchedMoviesByName.length} films mappés par nom — à vérifier :`);
	for (const m of report.matchedMoviesByName) console.log(`  - "${m.name}" → "${m.tmdbTitle}" (tmdb ${m.tmdbId})`);
}
if (report.unmappedShows.length) {
	console.log(`\n⚠ ${report.unmappedShows.length} séries introuvables sur TMDB (à ajouter via la recherche) :`);
	for (const s of report.unmappedShows) console.log(`  - ${s.name} (tvdb ${s.tvdbId}, ${s.source})`);
}
if (report.unmappedMovies.length) {
	console.log(`\n⚠ ${report.unmappedMovies.length} films introuvables sur TMDB (à ajouter via la recherche) :`);
	for (const m of report.unmappedMovies) console.log(`  - ${m.name}${m.releaseYear ? ` (${m.releaseYear})` : ''} (${m.source})`);
}
if (report.failedShows.length) {
	console.log(`\n✗ ${report.failedShows.length} séries en échec (relancez l'import) :`);
	for (const f of report.failedShows) console.log(`  - ${f.name} : ${f.error}`);
}
if (report.failedMovies.length) {
	console.log(`\n✗ ${report.failedMovies.length} films en échec (relancez l'import) :`);
	for (const f of report.failedMovies) console.log(`  - ${f.name} : ${f.error}`);
}
if (report.unmatchedEpisodes.length) {
	const total = report.unmatchedEpisodes.reduce((sum, s) => sum + s.count, 0);
	console.log(`\n⚠ ${total} visionnages non rattachés à un épisode :`);
	for (const s of report.unmatchedEpisodes) console.log(`  - ${s.name} : ${s.count} épisode(s)`);
}
if (report.unmatchedMovieWatches.length) {
	const total = report.unmatchedMovieWatches.reduce((sum, m) => sum + m.count, 0);
	console.log(`\n⚠ ${total} visionnages non rattachés à un film :`);
	for (const m of report.unmatchedMovieWatches) console.log(`  - ${m.name} : ${m.count} visionnage(s)`);
}
console.log('=========================================');
