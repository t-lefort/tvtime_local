import { error, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { shows, watches } from '$lib/server/db/schema';
import { getEpisodesWithWatch, getShowsWithProgress, type EpisodeWithWatch } from '$lib/server/queries';
import { addOrUpdateShow } from '$lib/server/shows';
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

function requireLocalShow(tmdbId: number) {
	const show = db.select().from(shows).where(eq(shows.tmdbId, tmdbId)).get();
	if (!show) error(404, 'Série introuvable');
	return show;
}

export const load: PageServerLoad = async ({ params, url }) => {
	const tmdbId = tmdbIdFromParam(params.tmdbId);
	const q = url.searchParams.get('q')?.trim() ?? '';
	const backHref = q ? `/recherche?type=series&q=${encodeURIComponent(q)}` : '/series';
	const today = new Date().toISOString().slice(0, 10);

	const local = getShowsWithProgress({ tmdbId })[0];
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
		for (const ep of getEpisodesWithWatch(local.id)) {
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
	add: async ({ params }) => {
		await addOrUpdateShow(tmdbIdFromParam(params.tmdbId));
	},

	toggle: async ({ params, request }) => {
		requireLocalShow(tmdbIdFromParam(params.tmdbId));
		const episodeId = Number((await request.formData()).get('episodeId'));
		if (!episodeId) return;
		const existing = db.select().from(watches).where(eq(watches.episodeId, episodeId)).all();
		if (existing.length > 0) {
			db.delete(watches).where(eq(watches.episodeId, episodeId)).run();
		} else {
			db.insert(watches).values({ episodeId }).run();
		}
	},

	season: async ({ params, request }) => {
		const id = requireLocalShow(tmdbIdFromParam(params.tmdbId)).id;
		const seasonNumber = Number((await request.formData()).get('seasonNumber'));
		db.run(sql`
			INSERT INTO watches (episode_id)
			SELECT e.id FROM episodes e
			WHERE e.show_id = ${id} AND e.season_number = ${seasonNumber}
				AND e.air_date IS NOT NULL AND e.air_date <= date('now')
				AND NOT EXISTS (SELECT 1 FROM watches w WHERE w.episode_id = e.id)
		`);
	},

	until: async ({ params, request }) => {
		const id = requireLocalShow(tmdbIdFromParam(params.tmdbId)).id;
		const data = await request.formData();
		const seasonNumber = Number(data.get('seasonNumber'));
		const episodeNumber = Number(data.get('episodeNumber'));
		db.run(sql`
			INSERT INTO watches (episode_id)
			SELECT e.id FROM episodes e
			WHERE e.show_id = ${id} AND e.season_number > 0
				AND (e.season_number < ${seasonNumber}
					OR (e.season_number = ${seasonNumber} AND e.episode_number <= ${episodeNumber}))
				AND e.air_date IS NOT NULL AND e.air_date <= date('now')
				AND NOT EXISTS (SELECT 1 FROM watches w WHERE w.episode_id = e.id)
		`);
	},

	archive: async ({ params }) => {
		const show = requireLocalShow(tmdbIdFromParam(params.tmdbId));
		db.update(shows).set({ archived: !show.archived }).where(eq(shows.id, show.id)).run();
	},

	favorite: async ({ params }) => {
		const show = requireLocalShow(tmdbIdFromParam(params.tmdbId));
		db.update(shows).set({ favorite: !show.favorite }).where(eq(shows.id, show.id)).run();
	},

	refresh: async ({ params }) => {
		const tmdbId = tmdbIdFromParam(params.tmdbId);
		requireLocalShow(tmdbId);
		await addOrUpdateShow(tmdbId);
	},

	unfollow: async ({ params }) => {
		const show = requireLocalShow(tmdbIdFromParam(params.tmdbId));
		db.delete(shows).where(eq(shows.id, show.id)).run();
		redirect(303, '/series');
	}
};
