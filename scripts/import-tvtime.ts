/**
 * Import de l'export GDPR de TV Time.
 *
 * Usage : npm run import -- <dossier-gdpr>
 *
 * Règles :
 * - followed_tv_show.csv  : active=1 → série suivie (archived selon le flag "archived" = arrêtée) ;
 *                           active=0 → série désuivie dans TV Time → importée comme "arrêtée"
 * - tracking-prod-records-v2.csv : lignes watch-episode / rewatch-episode = historique complet
 *   (les séries présentes uniquement dans l'historique sont importées comme "arrêtées")
 * - user_show_special_status.csv : favorite → favori
 * Le script est idempotent : relançable après une interruption.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { sql } from 'drizzle-orm';
import { db } from '../src/lib/server/db';
import { addOrUpdateShow, getShowByTvdbId } from '../src/lib/server/shows';
import { findByTvdbId, searchTv } from '../src/lib/server/tmdb';

const folder = process.argv[2];
if (!folder || !fs.existsSync(folder)) {
	console.error('Usage : npm run import -- <dossier-gdpr>');
	process.exit(1);
}

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

console.log(`Séries à importer : ${showsToImport.size} (dont ${[...showsToImport.values()].filter((s) => !s.archived).length} actives)`);
console.log(`Épisodes vus (événements) : ${watchEvents.length}\n`);

// ---------- 2. Import des séries depuis TMDB (concurrence 5) ----------

const unmappedShows: ShowToImport[] = [];
const failedShows: { show: ShowToImport; error: string }[] = [];
const matchedByName: { name: string; tmdbName: string; tmdbId: number }[] = [];
const tvdbToLocalId = new Map<number, number>();
let imported = 0;
let skipped = 0;

const norm = (s: string) =>
	s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

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
	const existing = getShowByTvdbId(item.tvdbId);
	if (existing) {
		tvdbToLocalId.set(item.tvdbId, existing.id);
		skipped++;
		return;
	}
	const tmdbId = await resolveTmdbId(item);
	if (!tmdbId) {
		unmappedShows.push(item);
		return;
	}
	const show = await addOrUpdateShow(tmdbId, {
		tvdbId: item.tvdbId,
		archived: item.archived,
		favorite: favoriteTvdbIds.has(item.tvdbId),
		followedAt: item.followedAt
	});
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

// ---------- 3. Insertion des visionnages ----------

let watchesInserted = 0;
let watchesAlready = 0;
const unmatchedEpisodes: WatchEvent[] = [];

const findEpisode = db.$client.prepare(
	'SELECT id FROM episodes WHERE show_id = ? AND season_number = ? AND episode_number = ?'
);
const findWatch = db.$client.prepare(
	'SELECT id FROM watches WHERE episode_id = ? AND watched_at = ?'
);
const insertWatch = db.$client.prepare('INSERT INTO watches (episode_id, watched_at) VALUES (?, ?)');

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
	if (findWatch.get(ep.id, ev.watchedAt)) {
		watchesAlready++;
		continue;
	}
	insertWatch.run(ep.id, ev.watchedAt);
	watchesInserted++;
}

// ---------- 4. Rapport ----------

const totals = db.get<{ minutes: number; episodes: number }>(sql`
	SELECT COALESCE(SUM(COALESCE(e.runtime, s.episode_run_time, 45)), 0) AS minutes,
		COUNT(DISTINCT w.episode_id) AS episodes
	FROM watches w JOIN episodes e ON e.id = w.episode_id JOIN shows s ON s.id = e.show_id
`);
const refMinutes = Number(statsRows[0]?.time_spent ?? 0);

console.log('\n================ RAPPORT ================');
console.log(`Séries importées : ${imported} (déjà présentes : ${skipped})`);
console.log(`Visionnages insérés : ${watchesInserted} (déjà présents : ${watchesAlready})`);
console.log(`Épisodes vus distincts en base : ${totals?.episodes}`);
console.log(`Temps total calculé : ${totals?.minutes} min${refMinutes ? ` (référence TV Time : ${refMinutes} min)` : ''}`);

if (matchedByName.length) {
	console.log(`\nℹ ${matchedByName.length} séries mappées par nom (id TVDB inconnu de TMDB) — à vérifier :`);
	for (const s of matchedByName) console.log(`  - "${s.name}" → "${s.tmdbName}" (tmdb ${s.tmdbId})`);
}
if (unmappedShows.length) {
	console.log(`\n⚠ ${unmappedShows.length} séries introuvables sur TMDB (à ajouter via la recherche) :`);
	for (const s of unmappedShows) console.log(`  - ${s.name} (tvdb ${s.tvdbId}, ${s.source})`);
}
if (failedShows.length) {
	console.log(`\n✗ ${failedShows.length} séries en échec (relancez l'import) :`);
	for (const f of failedShows) console.log(`  - ${f.show.name} : ${f.error}`);
}
if (unmatchedEpisodes.length) {
	console.log(`\n⚠ ${unmatchedEpisodes.length} visionnages non rattachés à un épisode :`);
	const byShow = new Map<string, number>();
	for (const ev of unmatchedEpisodes) {
		byShow.set(ev.seriesName, (byShow.get(ev.seriesName) ?? 0) + 1);
	}
	for (const [name, count] of byShow) console.log(`  - ${name} : ${count} épisode(s)`);
}
console.log('=========================================');
