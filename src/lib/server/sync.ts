import cron from 'node-cron';
import { sql } from 'drizzle-orm';
import { db } from './db';
import { addOrUpdateShow } from './shows';
import { getProviders } from './tmdb';

let started = false;

/**
 * Rafraîchit chaque nuit les séries encore en production (nouvelles saisons, dates de
 * diffusion, plateformes) puis les plateformes de streaming du reste du catalogue.
 */
export function startDailySync(): void {
	if (started) return;
	started = true;
	cron.schedule('30 5 * * *', async () => {
		try {
			await syncOngoingShows();
			await syncProviders();
		} catch (e) {
			console.error('[sync] échec :', e);
		}
	});
	console.log('[sync] tâche quotidienne planifiée (5h30)');
}

export async function syncOngoingShows(): Promise<{ ok: number; failed: number }> {
	const list = db.all<{ id: number; tmdbId: number; name: string }>(sql`
		SELECT id, tmdb_id AS tmdbId, name FROM shows
		WHERE tmdb_status IS NULL OR tmdb_status NOT IN ('Ended', 'Canceled')
	`);
	let ok = 0;
	let failed = 0;
	for (const show of list) {
		try {
			await addOrUpdateShow(show.tmdbId);
			ok++;
		} catch (e) {
			failed++;
			console.error(`[sync] ${show.name} :`, e);
		}
	}
	console.log(`[sync] terminé : ${ok} séries à jour, ${failed} échecs`);
	return { ok, failed };
}

/**
 * Met à jour les plateformes de streaming des séries terminées et des films
 * (celles des séries en production le sont déjà via syncOngoingShows).
 */
export async function syncProviders(): Promise<{ ok: number; failed: number }> {
	const targets: { kind: 'tv' | 'movie'; id: number; tmdbId: number; name: string }[] = [
		...db
			.all<{ id: number; tmdbId: number; name: string }>(sql`
				SELECT id, tmdb_id AS tmdbId, name FROM shows
				WHERE tmdb_status IN ('Ended', 'Canceled')
			`)
			.map((s) => ({ kind: 'tv' as const, ...s })),
		...db
			.all<{ id: number; tmdbId: number; name: string }>(sql`
				SELECT id, tmdb_id AS tmdbId, title AS name FROM movies
			`)
			.map((m) => ({ kind: 'movie' as const, ...m }))
	];
	let ok = 0;
	let failed = 0;
	for (const t of targets) {
		try {
			const providers = await getProviders(t.kind, t.tmdbId);
			const json = providers ? JSON.stringify(providers) : null;
			if (t.kind === 'tv') {
				db.run(sql`UPDATE shows SET watch_providers = ${json} WHERE id = ${t.id}`);
			} else {
				db.run(sql`UPDATE movies SET watch_providers = ${json} WHERE id = ${t.id}`);
			}
			ok++;
		} catch (e) {
			failed++;
			console.error(`[sync] plateformes de ${t.name} :`, e);
		}
	}
	console.log(`[sync] plateformes : ${ok} mises à jour, ${failed} échecs`);
	return { ok, failed };
}
