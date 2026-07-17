import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { shows, watches } from '$lib/server/db/schema';
import { getEpisodesWithWatch } from '$lib/server/queries';
import { getUserShow } from '$lib/server/shows';
import { getUserById, requireUser } from '$lib/server/users';
import {
	extractCast,
	getEpisodeDetails,
	type StoredCastMember,
	type StoredCrewMember
} from '$lib/server/tmdb';
import type { Actions, PageServerLoad } from './$types';

function intParam(value: string, min: number): number {
	const n = Number(value);
	if (!Number.isInteger(n) || n < min) error(404, 'Épisode introuvable');
	return n;
}

/** Série suivie par le profil, sinon 404 (les liens vers les épisodes viennent de la bibliothèque). */
function requireFollowedShow(userId: number, tmdbId: number) {
	const show = db.select().from(shows).where(eq(shows.tmdbId, tmdbId)).get();
	if (!show || !getUserShow(userId, show.id)) error(404, 'Épisode introuvable');
	return show;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const tmdbId = intParam(params.tmdbId, 1);
	const seasonNumber = intParam(params.season, 0);
	const episodeNumber = intParam(params.episode, 1);
	const show = requireFollowedShow(user.id, tmdbId);

	// Épisodes dans l'ordre de la page série (saisons croissantes, spéciaux à la fin)
	// pour naviguer d'un épisode au précédent/suivant
	const all = getEpisodesWithWatch(user.id, show.id);
	const ordered = [...all.filter((e) => e.seasonNumber > 0), ...all.filter((e) => e.seasonNumber === 0)];
	const index = ordered.findIndex(
		(e) => e.seasonNumber === seasonNumber && e.episodeNumber === episodeNumber
	);
	if (index === -1) error(404, 'Épisode introuvable');
	const episode = ordered[index];
	const neighbor = (ep: (typeof ordered)[number] | undefined) =>
		ep ? { seasonNumber: ep.seasonNumber, episodeNumber: ep.episodeNumber, name: ep.name } : null;

	const watchDates = db
		.select({ watchedAt: watches.watchedAt })
		.from(watches)
		.where(and(eq(watches.episodeId, episode.id), eq(watches.userId, user.id)))
		.orderBy(desc(watches.watchedAt))
		.all()
		.map((w) => w.watchedAt);

	// Enrichissement TMDB en direct (note, guest stars, réalisation/scénario) ;
	// la page reste utilisable sans réseau ou si TMDB ne connaît pas l'épisode
	let voteAverage: number | null = null;
	let guestStars: StoredCastMember[] = [];
	let directors: StoredCrewMember[] = [];
	let writers: StoredCrewMember[] = [];
	try {
		const details = await getEpisodeDetails(tmdbId, seasonNumber, episodeNumber);
		voteAverage = details.vote_average || null;
		guestStars = extractCast({ cast: details.guest_stars });
		const byJob = (job: string): StoredCrewMember[] => {
			const seen = new Set<number>();
			const result: StoredCrewMember[] = [];
			for (const member of details.crew ?? []) {
				if (member.job !== job || seen.has(member.id)) continue;
				seen.add(member.id);
				result.push({ id: member.id, name: member.name, job, profilePath: member.profile_path });
			}
			return result;
		};
		directors = byJob('Director');
		writers = byJob('Writer');
	} catch {
		// TMDB indisponible : la page affiche les données locales
	}

	return {
		show: {
			tmdbId,
			name: show.name,
			backdropPath: show.backdropPath
		},
		episode: {
			id: episode.id,
			seasonNumber,
			episodeNumber,
			name: episode.name,
			overview: episode.overview,
			airDate: episode.airDate,
			runtime: episode.runtime,
			stillPath: episode.stillPath,
			watchCount: episode.watchCount
		},
		watchDates,
		prev: neighbor(ordered[index - 1]),
		next: neighbor(ordered[index + 1]),
		voteAverage,
		guestStars,
		directors,
		writers,
		hideEpisodeOverviews: Boolean(getUserById(user.id)?.hideEpisodeOverviews),
		today: new Date().toISOString().slice(0, 10)
	};
};

export const actions: Actions = {
	toggle: async ({ params, request, locals }) => {
		const user = requireUser(locals);
		requireFollowedShow(user.id, intParam(params.tmdbId, 1));
		const episodeId = Number((await request.formData()).get('episodeId'));
		if (!episodeId) return;
		const mine = and(eq(watches.episodeId, episodeId), eq(watches.userId, user.id));
		const existing = db.select().from(watches).where(mine).all();
		if (existing.length > 0) {
			db.delete(watches).where(mine).run();
		} else {
			db.insert(watches).values({ userId: user.id, episodeId }).run();
		}
	}
};
