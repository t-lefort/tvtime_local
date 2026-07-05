import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fail, redirect } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import { authEnabled } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { getProfileStats } from '$lib/server/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const stats = getProfileStats();

	// 24 derniers mois, mois vides inclus
	const byMonth = new Map(stats.perMonth.map((m) => [m.month, m.count]));
	const months: { month: string; count: number }[] = [];
	const now = new Date();
	for (let i = 23; i >= 0; i--) {
		const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
		const ym = d.toISOString().slice(0, 7);
		months.push({ month: ym, count: byMonth.get(ym) ?? 0 });
	}

	return {
		totalMinutes: stats.totalMinutes,
		distinctEpisodes: stats.distinctEpisodes,
		totalWatches: stats.totalWatches,
		countsByState: stats.countsByState,
		totalShows: stats.totalShows,
		months,
		perGenre: stats.perGenre.slice(0, 10),
		watchedShows: stats.perShow
			.filter((s) => s.minutesWatched > 0)
			.map((s) => ({
				id: s.id,
				name: s.name,
				posterPath: s.posterPath,
				minutesWatched: s.minutesWatched,
				watchedCount: s.watchedCount,
				state: s.state
			})),
		authEnabled: authEnabled()
	};
};

export const actions: Actions = {
	logout: async ({ cookies }) => {
		cookies.delete('session', { path: '/' });
		redirect(303, '/login');
	},

	/**
	 * Remplace toutes les données par celles d'une base exportée depuis l'app.
	 * On copie les tables via ATTACH plutôt que de remplacer le fichier : pas de
	 * problème de fichier ouvert, et la transaction garantit tout-ou-rien.
	 */
	import: async ({ request }) => {
		const file = (await request.formData()).get('db');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choisissez un fichier .db exporté depuis l’application.' });
		}
		const tmp = path.join(os.tmpdir(), `tvtime-import-${Date.now()}.db`);
		try {
			fs.writeFileSync(tmp, new Uint8Array(await file.arrayBuffer()));

			// validation : c'est bien une base de l'app ?
			let src: InstanceType<typeof Database>;
			try {
				src = new Database(tmp, { readonly: true, fileMustExist: true });
			} catch {
				return fail(400, { error: 'Ce fichier n’est pas une base SQLite valide.' });
			}
			try {
				const tables = src
					.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
					.all()
					.map((r) => (r as { name: string }).name);
				for (const t of ['shows', 'episodes', 'watches']) {
					if (!tables.includes(t)) {
						return fail(400, { error: `Base invalide : table « ${t} » absente. Utilisez un fichier créé par le bouton Exporter.` });
					}
				}
			} finally {
				src.close();
			}

			const raw = db.$client;
			raw.prepare('ATTACH DATABASE ? AS src').run(tmp);
			try {
				raw.exec(`
					BEGIN;
					DELETE FROM watches;
					DELETE FROM episodes;
					DELETE FROM shows;
					INSERT INTO shows SELECT * FROM src.shows;
					INSERT INTO episodes SELECT * FROM src.episodes;
					INSERT INTO watches SELECT * FROM src.watches;
					COMMIT;
				`);
			} catch (e) {
				raw.exec('ROLLBACK');
				return fail(400, {
					error: `Import impossible (schéma incompatible ?) : ${e instanceof Error ? e.message : e}`
				});
			} finally {
				raw.exec('DETACH DATABASE src');
			}

			const count = (t: string) =>
				(raw.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c;
			return {
				imported: { shows: count('shows'), episodes: count('episodes'), watches: count('watches') }
			};
		} finally {
			fs.rmSync(tmp, { force: true });
		}
	}
};
