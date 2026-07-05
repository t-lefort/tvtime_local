import { error, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { shows, watches } from '$lib/server/db/schema';
import { getEpisodesWithWatch, getShowsWithProgress, type EpisodeWithWatch } from '$lib/server/queries';
import { addOrUpdateShow } from '$lib/server/shows';
import type { Actions, PageServerLoad } from './$types';

function requireShow(id: number) {
	const show = db.select().from(shows).where(eq(shows.id, id)).get();
	if (!show) error(404, 'Série introuvable');
	return show;
}

export const load: PageServerLoad = ({ params }) => {
	const id = Number(params.id);
	const show = getShowsWithProgress(id)[0];
	if (!show) error(404, 'Série introuvable');

	const bySeason = new Map<number, EpisodeWithWatch[]>();
	for (const ep of getEpisodesWithWatch(id)) {
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

	const today = new Date().toISOString().slice(0, 10);
	const openSeason =
		seasons.find((s) =>
			s.number > 0 && s.episodes.some((e) => !e.watchCount && e.airDate && e.airDate <= today)
		)?.number ?? seasons[0]?.number ?? null;

	return {
		show: { ...show, genres: JSON.parse(show.genres) as string[] },
		seasons,
		openSeason,
		today
	};
};

export const actions: Actions = {
	toggle: async ({ params, request }) => {
		const id = Number(params.id);
		requireShow(id);
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
		const id = Number(params.id);
		requireShow(id);
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
		const id = Number(params.id);
		requireShow(id);
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
		const show = requireShow(Number(params.id));
		db.update(shows).set({ archived: !show.archived }).where(eq(shows.id, show.id)).run();
	},

	favorite: async ({ params }) => {
		const show = requireShow(Number(params.id));
		db.update(shows).set({ favorite: !show.favorite }).where(eq(shows.id, show.id)).run();
	},

	refresh: async ({ params }) => {
		const show = requireShow(Number(params.id));
		await addOrUpdateShow(show.tmdbId);
	},

	unfollow: async ({ params }) => {
		const show = requireShow(Number(params.id));
		db.delete(shows).where(eq(shows.id, show.id)).run();
		redirect(303, '/series');
	}
};
