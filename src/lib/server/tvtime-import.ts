/**
 * Import de l'export GDPR de TV Time — moteur commun au script CLI
 * (scripts/import-tvtime.ts) et à la page profil (import depuis l'interface).
 *
 * Règles :
 * - followed_tv_show.csv  : active=1 → série suivie ; active=0 → série désuivie dans TV Time.
 *   Le drapeau "arrêtée" n'est conservé que si TMDB déclare la série réellement terminée
 *   (statut Ended/Canceled). TV Time archive/désactive une série dès qu'on a vu tous ses
 *   épisodes, même si elle est encore en production : on ne veut pas la marquer arrêtée
 *   dans ce cas (issue #16), elle reste suivie (état « à jour »).
 * - tracking-prod-records-v2.csv : lignes watch-episode / rewatch-episode = historique complet
 *   (les séries présentes uniquement dans l'historique sont candidates au statut "arrêtée",
 *   sous la même condition TMDB ci-dessus)
 * - tracking-prod-records.csv et tracking-prod-records-v2.csv : lignes films watch / rewatch /
 *   watchlist = collection films et historique complet
 * - user_show_special_status.csv : favorite → favori
 * L'import est idempotent : relançable après une interruption.
 */
import { parse } from 'csv-parse/sync';
import { sql } from 'drizzle-orm';
import { db } from './db';
import { addOrUpdateMovie, collectMovie, getMovieByTmdbId } from './movies';
import { addOrUpdateShow, followShow, getShowByTvdbId } from './shows';
import { findByTvdbId, searchMovie, searchTv } from './tmdb';
import {
	collectMovieImportData,
	isExactMovieTitle,
	norm,
	pickBestMovieMatch,
	type MovieToImport,
	type MovieWatchEvent,
	type TvTimeCsvFiles,
	type TvTimeCsvName
} from './tvtime-import-utils';

export {
	csvFilesFromUpload,
	TVTIME_CSV_NAMES,
	type TvTimeCsvFiles,
	type TvTimeCsvName
} from './tvtime-import-utils';

export interface TvTimeImportProgress {
	phase: 'préparation' | 'séries' | 'films' | 'visionnages' | 'terminé';
	current: number;
	total: number;
	/** Dernier élément traité (nom de série ou de film). */
	label?: string;
}

export interface TvTimeImportReport {
	showsImported: number;
	showsSkipped: number;
	moviesImported: number;
	moviesSkipped: number;
	watchesInserted: number;
	watchesAlready: number;
	movieWatchesInserted: number;
	movieWatchesAlready: number;
	distinctEpisodes: number;
	distinctMovies: number;
	totalMinutes: number;
	/** Temps total annoncé par TV Time (user_statistics.csv), 0 si absent. */
	refMinutes: number;
	matchedByName: { name: string; tmdbName: string; tmdbId: number }[];
	matchedMoviesByName: { name: string; tmdbTitle: string; tmdbId: number }[];
	unmappedShows: { name: string; tvdbId: number; source: string }[];
	unmappedMovies: { name: string; releaseYear?: string; source: string }[];
	failedShows: { name: string; error: string }[];
	failedMovies: { name: string; error: string }[];
	/** Visionnages sans épisode correspondant, agrégés par série. */
	unmatchedEpisodes: { name: string; count: number }[];
	unmatchedMovieWatches: { name: string; count: number }[];
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

/**
 * Une série n'est « arrêtée » que si TMDB la déclare réellement terminée.
 * TV Time archive/désactive une série dès qu'on a vu tous ses épisodes (même
 * en production) ; ce n'est pas un vrai arrêt, on ne la grise donc pas (issue #16).
 */
function isEndedStatus(status: string | null | undefined): boolean {
	return status === 'Ended' || status === 'Canceled';
}

export interface TvTimeImportHooks {
	onProgress?: (p: TvTimeImportProgress) => void;
	onLog?: (line: string) => void;
}

export async function runTvTimeImport(
	userId: number,
	files: TvTimeCsvFiles,
	hooks: TvTimeImportHooks = {}
): Promise<TvTimeImportReport> {
	const onProgress = hooks.onProgress ?? (() => {});
	const onLog = hooks.onLog ?? (() => {});
	onProgress({ phase: 'préparation', current: 0, total: 0 });

	const readCsv = (name: TvTimeCsvName): Record<string, string>[] => {
		const content = files[name];
		if (!content) {
			onLog(`⚠ Fichier absent, ignoré : ${name}`);
			return [];
		}
		return parse(content, { columns: true, skip_empty_lines: true });
	};

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

	onLog(
		`Séries à importer : ${showsToImport.size} (dont ${[...showsToImport.values()].filter((s) => !s.archived).length} actives)`
	);
	onLog(`Épisodes vus (événements) : ${watchEvents.length}`);
	onLog(
		`Films à importer : ${movieImportData.moviesToImport.size} (dont ${movieImportData.watchEvents.length} visionnage(s))`
	);

	// ---------- 2. Import des séries depuis TMDB (concurrence 5) ----------

	const unmappedShows: ShowToImport[] = [];
	const failedShows: { show: ShowToImport; error: string }[] = [];
	const matchedByName: { name: string; tmdbName: string; tmdbId: number }[] = [];
	const tvdbToLocalId = new Map<number, number>();
	let imported = 0;
	let skipped = 0;
	let showsDone = 0;

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
		const favorite = favoriteTvdbIds.has(item.tvdbId);
		const existing = getShowByTvdbId(item.tvdbId);
		if (existing) {
			followShow(userId, existing.id, {
				archived: item.archived && isEndedStatus(existing.tmdbStatus),
				favorite,
				followedAt: item.followedAt
			});
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
		// On ne conserve « arrêtée » que si TMDB confirme la série terminée (issue #16).
		const archived = item.archived && isEndedStatus(show.tmdbStatus);
		followShow(userId, show.id, { archived, favorite, followedAt: item.followedAt });
		tvdbToLocalId.set(item.tvdbId, show.id);
		imported++;
		onLog(
			`✓ [${imported + skipped}/${showsToImport.size}] ${show.name} (${item.source}${archived ? ', arrêtée' : ''})`
		);
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
				onLog(`✗ ${item.name} : ${e}`);
			}
			showsDone++;
			onProgress({ phase: 'séries', current: showsDone, total: showsToImport.size, label: item.name });
		}
	}
	onProgress({ phase: 'séries', current: 0, total: showsToImport.size });
	await Promise.all(Array.from({ length: 5 }, worker));

	// ---------- 3. Import des films depuis TMDB ----------

	const unmappedMovies: MovieToImport[] = [];
	const failedMovies: { movie: MovieToImport; error: string }[] = [];
	const matchedMoviesByName: { name: string; tmdbTitle: string; tmdbId: number }[] = [];
	const movieKeyToLocalId = new Map<string, number>();
	let moviesImported = 0;
	let moviesSkipped = 0;
	let moviesDone = 0;

	async function resolveMovieTmdbId(item: MovieToImport): Promise<number | null> {
		const results = await searchMovie(item.name);
		// Classement pondéré : correspondance du titre, puis année (±1 an toléré),
		// puis notoriété — plutôt que le premier résultat brut, souvent le mauvais.
		const pick = pickBestMovieMatch(results, item);
		if (!pick) return null;
		if (!isExactMovieTitle(pick, item)) {
			matchedMoviesByName.push({ name: item.name, tmdbTitle: pick.title, tmdbId: pick.id });
		}
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
			collectMovie(userId, existing.id, { addedAt: item.addedAt });
			movieKeyToLocalId.set(item.key, existing.id);
			moviesSkipped++;
			return;
		}
		const movie = await addOrUpdateMovie(tmdbId);
		collectMovie(userId, movie.id, { addedAt: item.addedAt });
		movieKeyToLocalId.set(item.key, movie.id);
		moviesImported++;
		onLog(
			`✓ [film ${moviesImported + moviesSkipped}/${movieImportData.moviesToImport.size}] ${movie.title} (${item.source})`
		);
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
				onLog(`✗ ${item.name} : ${e}`);
			}
			moviesDone++;
			onProgress({
				phase: 'films',
				current: moviesDone,
				total: movieImportData.moviesToImport.size,
				label: item.name
			});
		}
	}
	onProgress({ phase: 'films', current: 0, total: movieImportData.moviesToImport.size });
	await Promise.all(Array.from({ length: 5 }, movieWorker));

	// ---------- 4. Insertion des visionnages ----------

	const watchTotal = watchEvents.length + movieImportData.watchEvents.length;
	onProgress({ phase: 'visionnages', current: 0, total: watchTotal });

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
		const ep = findEpisode.get(showId, ev.seasonNumber, ev.episodeNumber) as
			| { id: number }
			| undefined;
		if (!ep) {
			unmatchedEpisodes.push(ev);
			continue;
		}
		if (findWatch.get(userId, ep.id, ev.watchedAt)) {
			watchesAlready++;
			continue;
		}
		insertWatch.run(userId, ep.id, ev.watchedAt);
		watchesInserted++;
	}

	for (const ev of movieImportData.watchEvents) {
		const movieId = movieKeyToLocalId.get(ev.key);
		if (!movieId) {
			unmatchedMovieWatches.push(ev);
			continue;
		}
		if (findMovieWatch.get(userId, movieId, ev.watchedAt)) {
			movieWatchesAlready++;
			continue;
		}
		insertMovieWatch.run(userId, movieId, ev.watchedAt);
		movieWatchesInserted++;
	}

	// ---------- 5. Rapport ----------

	const totals = db.get<{ minutes: number; episodes: number }>(sql`
		SELECT COALESCE(SUM(COALESCE(e.runtime, s.episode_run_time, 45)), 0) AS minutes,
			COUNT(DISTINCT w.episode_id) AS episodes
		FROM watches w JOIN episodes e ON e.id = w.episode_id JOIN shows s ON s.id = e.show_id
		WHERE w.user_id = ${userId}
	`);
	const movieTotals = db.get<{ minutes: number; movies: number }>(sql`
		SELECT COALESCE(SUM(COALESCE(m.runtime, 110)), 0) AS minutes,
			COUNT(DISTINCT w.movie_id) AS movies
		FROM movie_watches w JOIN movies m ON m.id = w.movie_id
		WHERE w.user_id = ${userId}
	`);

	const groupByName = <T>(items: T[], nameOf: (item: T) => string) => {
		const counts = new Map<string, number>();
		for (const item of items) {
			const name = nameOf(item);
			counts.set(name, (counts.get(name) ?? 0) + 1);
		}
		return [...counts].map(([name, count]) => ({ name, count }));
	};

	onProgress({ phase: 'terminé', current: watchTotal, total: watchTotal });

	return {
		showsImported: imported,
		showsSkipped: skipped,
		moviesImported,
		moviesSkipped,
		watchesInserted,
		watchesAlready,
		movieWatchesInserted,
		movieWatchesAlready,
		distinctEpisodes: totals?.episodes ?? 0,
		distinctMovies: movieTotals?.movies ?? 0,
		totalMinutes: (totals?.minutes ?? 0) + (movieTotals?.minutes ?? 0),
		refMinutes: Number(statsRows[0]?.time_spent ?? 0),
		matchedByName,
		matchedMoviesByName,
		unmappedShows: unmappedShows.map((s) => ({ name: s.name, tvdbId: s.tvdbId, source: s.source })),
		unmappedMovies: unmappedMovies.map((m) => ({
			name: m.name,
			releaseYear: m.releaseYear,
			source: m.source
		})),
		failedShows: failedShows.map((f) => ({ name: f.show.name, error: f.error })),
		failedMovies: failedMovies.map((f) => ({ name: f.movie.name, error: f.error })),
		unmatchedEpisodes: groupByName(unmatchedEpisodes, (ev) => ev.seriesName),
		unmatchedMovieWatches: groupByName(
			unmatchedMovieWatches,
			(ev) => `${ev.movieName}${ev.releaseYear ? ` (${ev.releaseYear})` : ''}`
		)
	};
}

// ---------- Job en arrière-plan (import lancé depuis l'interface) ----------

export interface TvTimeImportJob {
	userId: number;
	userName: string;
	running: boolean;
	startedAt: string;
	finishedAt?: string;
	progress: TvTimeImportProgress;
	report?: TvTimeImportReport;
	error?: string;
}

/** Un seul import à la fois pour toute l'instance (écritures SQLite + quota TMDB). */
let job: TvTimeImportJob | null = null;

export function getTvTimeImportJob(): TvTimeImportJob | null {
	return job;
}

export function startTvTimeImportJob(
	user: { id: number; name: string },
	files: TvTimeCsvFiles
): { started: true } | { error: string } {
	if (job?.running) {
		return { error: `Un import est déjà en cours (profil « ${job.userName} »).` };
	}
	const current: TvTimeImportJob = {
		userId: user.id,
		userName: user.name,
		running: true,
		startedAt: new Date().toISOString(),
		progress: { phase: 'préparation', current: 0, total: 0 }
	};
	job = current;
	void runTvTimeImport(user.id, files, {
		onProgress: (p) => (current.progress = p),
		onLog: (line) => console.log(`[import-tvtime] ${line}`)
	})
		.then((report) => (current.report = report))
		.catch((e) => {
			current.error = e instanceof Error ? e.message : String(e);
			console.error('[import-tvtime] échec :', e);
		})
		.finally(() => {
			current.running = false;
			current.finishedAt = new Date().toISOString();
		});
	return { started: true };
}
