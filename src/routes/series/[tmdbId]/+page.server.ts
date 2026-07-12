import { error, redirect } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { shows, userShows, watches } from '$lib/server/db/schema';
import { getEpisodesWithWatch, getShowsWithProgress, type EpisodeWithWatch } from '$lib/server/queries';
import { addOrUpdateShow, followShow, getUserShow, unfollowShow } from '$lib/server/shows';
import { requireUser } from '$lib/server/users';
import {
	extractCast,
	extractProviders,
	getCast,
	getShowDetails,
	type StoredCastMember,
	type StoredProviders
} from '$lib/server/tmdb';
import type { Actions, PageServerLoad } from './$types';

function tmdbIdFromParam(value: string): number {
	const tmdbId = Number(value);
	if (!Number.isInteger(tmdbId) || tmdbId <= 0) error(404, 'Série introuvable');
	return tmdbId;
}

/** Série présente dans la bibliothèque du profil (suivie), sinon 404. */
function requireFollowedShow(userId: number, tmdbId: number) {
	const show = db.select().from(shows).where(eq(shows.tmdbId, tmdbId)).get();
	const userShow = show ? getUserShow(userId, show.id) : undefined;
	if (!show || !userShow) error(404, 'Série introuvable');
	return { show, userShow };
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const user = requireUser(locals);
	const tmdbId = tmdbIdFromParam(params.tmdbId);
	const q = url.searchParams.get('q')?.trim() ?? '';
	const backHref = q ? `/recherche?type=series&q=${encodeURIComponent(q)}` : '/series';
	const today = new Date().toISOString().slice(0, 10);

	const local = getShowsWithProgress(user.id, { tmdbId })[0];
	if (local) {
		// Complète la distribution en direct pour les séries ajoutées avant cette fonctionnalité
		let cast = JSON.parse(local.cast ?? '[]') as StoredCastMember[];
		if (!cast.length) {
			cast = await getCast('tv', tmdbId);
			if (cast.length) {
				db.update(shows).set({ cast: JSON.stringify(cast) }).where(eq(shows.id, local.id)).run();
			}
		}

		const bySeason = new Map<number, EpisodeWithWatch[]>();
		for (const ep of getEpisodesWithWatch(user.id, local.id)) {
			const list = bySeason.get(ep.seasonNumber) ?? [];
			list.push(ep);
			bySeason.set(ep.seasonNumber, list);
		}
		const seasons = [...bySeason.entries()]
			.map(([number, episodes]) => ({
				number,
				episodes,
				watched: episodes.filter((e) => e.watchCount > 0).length
			}))
			// Saisons dans l'ordre, spéciaux (saison 0) à la fin
			.sort((a, b) => (a.number === 0 ? 1 : b.number === 0 ? -1 : a.number - b.number));

		const openSeason =
			seasons.find((s) =>
				s.number > 0 && s.episodes.some((e) => !e.watchCount && e.airDate && e.airDate <= today)
			)?.number ??
			seasons[0]?.number ??
			null;

		return {
			backHref,
			inLibrary: true,
			show: {
				tmdbId,
				localId: local.id,
				name: local.name,
				overview: local.overview,
				posterPath: local.posterPath,
				backdropPath: local.backdropPath,
				firstAirDate: local.firstAirDate,
				tmdbStatus: local.tmdbStatus,
				genres: JSON.parse(local.genres) as string[],
				archived: local.archived,
				favorite: local.favorite,
				watchedCount: local.watchedCount,
				airedCount: local.airedCount,
				episodeRunTime: local.episodeRunTime,
				numberOfEpisodes: null as number | null,
				numberOfSeasons: null as number | null,
				networks: [] as string[],
				providers: local.watchProviders
					? (JSON.parse(local.watchProviders) as StoredProviders)
					: null,
				cast
			},
			seasons,
			openSeason,
			today
		};
	}

	const details = await getShowDetails(tmdbId);
	return {
		backHref,
		inLibrary: false,
		show: {
			tmdbId,
			localId: null,
			name: details.name || details.original_name,
			overview: details.overview || null,
			posterPath: details.poster_path,
			backdropPath: details.backdrop_path,
			firstAirDate: details.first_air_date || null,
			tmdbStatus: details.status,
			genres: details.genres.map((g) => g.name),
			archived: false,
			favorite: false,
			watchedCount: 0,
			airedCount: 0,
			episodeRunTime: details.episode_run_time?.[0] ?? null,
			numberOfEpisodes: details.number_of_episodes,
			numberOfSeasons: details.number_of_seasons,
			networks: details.networks?.map((network) => network.name) ?? [],
			providers: extractProviders(details['watch/providers']),
			cast: extractCast(details.credits)
		},
		seasons: [] as { number: number; episodes: EpisodeWithWatch[]; watched: number }[],
		openSeason: null as number | null,
		today
	};
};

export const actions: Actions = {
	/** Suit la série (reste sur la même page, qui repasse en mode bibliothèque). */
	add: async ({ params, locals }) => {
		const user = requireUser(locals);
		const show = await addOrUpdateShow(tmdbIdFromParam(params.tmdbId));
		followShow(user.id, show.id);
	},

	toggle: async ({ params, request, locals }) => {
		const user = requireUser(locals);
		requireFollowedShow(user.id, tmdbIdFromParam(params.tmdbId));
		const episodeId = Number((await request.formData()).get('episodeId'));
		if (!episodeId) return;
		const mine = and(eq(watches.episodeId, episodeId), eq(watches.userId, user.id));
		const existing = db.select().from(watches).where(mine).all();
		if (existing.length > 0) {
			db.delete(watches).where(mine).run();
		} else {
			db.insert(watches).values({ userId: user.id, episodeId }).run();
		}
	},

	season: async ({ params, request, locals }) => {
		const user = requireUser(locals);
		const id = requireFollowedShow(user.id, tmdbIdFromParam(params.tmdbId)).show.id;
		const seasonNumber = Number((await request.formData()).get('seasonNumber'));
		db.run(sql`
			INSERT INTO watches (user_id, episode_id)
			SELECT ${user.id}, e.id FROM episodes e
			WHERE e.show_id = ${id} AND e.season_number = ${seasonNumber}
				AND e.air_date IS NOT NULL AND e.air_date <= date('now')
				AND NOT EXISTS (SELECT 1 FROM watches w WHERE w.episode_id = e.id AND w.user_id = ${user.id})
		`);
	},

	until: async ({ params, request, locals }) => {
		const user = requireUser(locals);
		const id = requireFollowedShow(user.id, tmdbIdFromParam(params.tmdbId)).show.id;
		const data = await request.formData();
		const seasonNumber = Number(data.get('seasonNumber'));
		const episodeNumber = Number(data.get('episodeNumber'));
		db.run(sql`
			INSERT INTO watches (user_id, episode_id)
			SELECT ${user.id}, e.id FROM episodes e
			WHERE e.show_id = ${id} AND e.season_number > 0
				AND (e.season_number < ${seasonNumber}
					OR (e.season_number = ${seasonNumber} AND e.episode_number <= ${episodeNumber}))
				AND e.air_date IS NOT NULL AND e.air_date <= date('now')
				AND NOT EXISTS (SELECT 1 FROM watches w WHERE w.episode_id = e.id AND w.user_id = ${user.id})
		`);
	},

	archive: async ({ params, locals }) => {
		const user = requireUser(locals);
		const { userShow } = requireFollowedShow(user.id, tmdbIdFromParam(params.tmdbId));
		db.update(userShows)
			.set({ archived: !userShow.archived })
			.where(eq(userShows.id, userShow.id))
			.run();
	},

	favorite: async ({ params, locals }) => {
		const user = requireUser(locals);
		const { userShow } = requireFollowedShow(user.id, tmdbIdFromParam(params.tmdbId));
		db.update(userShows)
			.set({ favorite: !userShow.favorite })
			.where(eq(userShows.id, userShow.id))
			.run();
	},

	refresh: async ({ params, locals }) => {
		const user = requireUser(locals);
		const tmdbId = tmdbIdFromParam(params.tmdbId);
		requireFollowedShow(user.id, tmdbId);
		await addOrUpdateShow(tmdbId);
	},

	unfollow: async ({ params, locals }) => {
		const user = requireUser(locals);
		const { show } = requireFollowedShow(user.id, tmdbIdFromParam(params.tmdbId));
		unfollowShow(user.id, show.id);
		redirect(303, '/series');
	}
};
