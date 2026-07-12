import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fail, redirect } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import { authEnabled } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { getProfileStats } from '$lib/server/queries';
import {
	getUserById,
	profileCookieValue,
	requireUser,
	setUserAvatar,
	setUserPassword,
	USER_COOKIE,
	USER_COOKIE_OPTS
} from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	const account = getUserById(user.id);
	const stats = getProfileStats(user.id);

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
		profileId: user.id,
		profileName: user.name,
		hasPassword: Boolean(account?.passwordHash),
		hasAvatar: Boolean(account?.avatar),
		totalMinutes: stats.totalMinutes,
		seriesMinutes: stats.seriesMinutes,
		movieMinutes: stats.movieMinutes,
		distinctEpisodes: stats.distinctEpisodes,
		totalWatches: stats.totalWatches,
		distinctMovies: stats.distinctMovies,
		totalMovieWatches: stats.totalMovieWatches,
		totalMovies: stats.totalMovies,
		countsByState: stats.countsByState,
		totalShows: stats.totalShows,
		months,
		perGenre: stats.perGenre.slice(0, 10),
		watchedShows: stats.perShow
			.filter((s) => s.minutesWatched > 0)
			.map((s) => ({
				id: s.id,
				tmdbId: s.tmdbId,
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

	/** Définit ou change le mot de passe du profil actif (et re-signe son cookie). */
	setPassword: async ({ request, cookies, locals }) => {
		const user = requireUser(locals);
		const password = String((await request.formData()).get('password') ?? '');
		if (password.length < 4) {
			return fail(400, { profileError: 'Mot de passe : 4 caractères minimum.' });
		}
		setUserPassword(user.id, password);
		cookies.set(USER_COOKIE, profileCookieValue(getUserById(user.id)!), USER_COOKIE_OPTS);
		return { profileOk: 'Mot de passe défini.' };
	},

	clearPassword: async ({ cookies, locals }) => {
		const user = requireUser(locals);
		setUserPassword(user.id, null);
		cookies.set(USER_COOKIE, profileCookieValue(getUserById(user.id)!), USER_COOKIE_OPTS);
		return { profileOk: 'Mot de passe retiré.' };
	},

	avatar: async ({ request, locals }) => {
		const user = requireUser(locals);
		const file = (await request.formData()).get('avatar');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { profileError: 'Choisissez une image.' });
		}
		if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
			return fail(400, { profileError: 'Format accepté : PNG, JPEG, WebP ou GIF.' });
		}
		if (file.size > 2 * 1024 * 1024) {
			return fail(400, { profileError: 'Image trop lourde (2 Mo max).' });
		}
		setUserAvatar(user.id, Buffer.from(await file.arrayBuffer()), file.type);
		return { profileOk: 'Image mise à jour.' };
	},

	removeAvatar: async ({ locals }) => {
		const user = requireUser(locals);
		setUserAvatar(user.id, null, null);
		return { profileOk: 'Image retirée.' };
	},

	/**
	 * Remplace toutes les données par celles d'une base exportée depuis l'app.
	 * On copie les tables via ATTACH plutôt que de remplacer le fichier : pas de
	 * problème de fichier ouvert, et la transaction garantit tout-ou-rien.
	 */
	import: async ({ request, locals }) => {
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
				// Parents d'abord pour l'insertion ; copie par intersection de colonnes pour
				// accepter les exports d'anciennes versions (sans films ni watch_providers)
				const TABLES = [
					'users',
					'shows',
					'episodes',
					'movies',
					'user_shows',
					'user_movies',
					'watches',
					'movie_watches'
				];
				const srcTables = new Set(
					raw
						.prepare(`SELECT name FROM src.sqlite_master WHERE type = 'table'`)
						.all()
						.map((r) => (r as { name: string }).name)
				);
				const columnsOf = (schema: 'main' | 'src', t: string) =>
					raw
						.prepare(`SELECT name FROM pragma_table_info(?, ?)`)
						.all(t, schema)
						.map((r) => (r as { name: string }).name);
				// Export d'une version mono-utilisateur : tout est rattaché à un profil par défaut
				const legacy = !srcTables.has('users');

				raw.exec('BEGIN');
				try {
					for (const t of [...TABLES].reverse()) raw.exec(`DELETE FROM ${t}`);
					if (legacy) raw.exec(`INSERT INTO users (id, name) VALUES (1, 'Profil 1')`);
					for (const t of TABLES) {
						if (!srcTables.has(t)) continue;
						const srcCols = new Set(columnsOf('src', t));
						const common = columnsOf('main', t).filter((c) => srcCols.has(c));
						let insertCols = common.map((c) => `"${c}"`).join(', ');
						let selectCols = insertCols;
						// Anciennes tables watches/movie_watches sans user_id → profil par défaut
						if (legacy && !srcCols.has('user_id') && columnsOf('main', t).includes('user_id')) {
							insertCols = `user_id, ${insertCols}`;
							selectCols = `1, ${selectCols}`;
						}
						raw.exec(`INSERT INTO ${t} (${insertCols}) SELECT ${selectCols} FROM src."${t}"`);
					}
					if (legacy) {
						// Suivi/collection déplacés depuis les colonnes des anciennes tables catalogue
						const showCols = new Set(columnsOf('src', 'shows'));
						raw.exec(`
							INSERT INTO user_shows (user_id, show_id, followed_at, archived, favorite)
							SELECT 1, id,
								${showCols.has('followed_at') ? 'followed_at' : `datetime('now')`},
								${showCols.has('archived') ? 'archived' : '0'},
								${showCols.has('favorite') ? 'favorite' : '0'}
							FROM src.shows
						`);
						if (srcTables.has('movies')) {
							const movieCols = new Set(columnsOf('src', 'movies'));
							raw.exec(`
								INSERT INTO user_movies (user_id, movie_id, added_at, favorite)
								SELECT 1, id,
									${movieCols.has('added_at') ? 'added_at' : `datetime('now')`},
									${movieCols.has('favorite') ? 'favorite' : '0'}
								FROM src.movies
							`);
						}
					}
					raw.exec('COMMIT');
				} catch (e) {
					raw.exec('ROLLBACK');
					return fail(400, {
						error: `Import impossible (schéma incompatible ?) : ${e instanceof Error ? e.message : e}`
					});
				}
			} finally {
				raw.exec('DETACH DATABASE src');
			}

			// Le profil courant peut avoir disparu avec les données importées
			if (!locals.user || !raw.prepare('SELECT 1 FROM users WHERE id = ?').get(locals.user.id)) {
				redirect(303, '/profils');
			}

			const count = (t: string) =>
				(raw.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c;
			return {
				imported: {
					shows: count('shows'),
					episodes: count('episodes'),
					watches: count('watches'),
					movies: count('movies')
				}
			};
		} finally {
			fs.rmSync(tmp, { force: true });
		}
	}
};
