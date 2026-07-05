import cron from 'node-cron';
import { sql } from 'drizzle-orm';
import { db } from './db';
import { addOrUpdateShow } from './shows';

let started = false;

/** Rafraîchit chaque nuit les séries encore en production (nouvelles saisons, dates de diffusion). */
export function startDailySync(): void {
	if (started) return;
	started = true;
	cron.schedule('30 5 * * *', () => {
		syncOngoingShows().catch((e) => console.error('[sync] échec :', e));
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
