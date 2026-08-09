import { dateInTimeZone } from '$lib/date';
import { appTimeZone } from './dates';

const BASE = 'https://api.tvmaze.com';

interface TvmazeShow {
	id: number;
}

export interface TvmazeEpisode {
	season: number;
	number: number | null;
	airstamp: string | null;
}

class TvmazeError extends Error {
	constructor(
		message: string,
		public status: number
	) {
		super(message);
	}
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function tvmaze<T>(path: string): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		let response: Response;
		try {
			response = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } });
		} catch (error) {
			if (attempt >= 3) throw error;
			await sleep(500 * attempt);
			continue;
		}
		if (response.status === 429 && attempt < 4) {
			await sleep(1000 * attempt);
			continue;
		}
		if (!response.ok) throw new TvmazeError(`TVmaze ${response.status} sur ${path}`, response.status);
		return (await response.json()) as T;
	}
}

function episodeKey(season: number, episode: number): string {
	return `${season}:${episode}`;
}

/**
 * Convertit les instants de diffusion TVmaze en dates civiles du fuseau cible.
 * Les spéciaux sont exclus car leur numérotation diffère souvent de TMDB.
 */
export function buildEpisodeAirDates(
	episodes: TvmazeEpisode[],
	timeZone: string
): Map<string, string> {
	const dates = new Map<string, string>();
	for (const episode of episodes) {
		if (episode.season <= 0 || !episode.number || !episode.airstamp) continue;
		try {
			dates.set(episodeKey(episode.season, episode.number), dateInTimeZone(episode.airstamp, timeZone));
		} catch {
			// Horodatage incomplet côté TVmaze : TMDB restera la source de repli.
		}
	}
	return dates;
}

/** Dates de disponibilité locales d'une série, indexées par « saison:épisode ». */
export async function getLocalizedEpisodeAirDates(
	tvdbId: number,
	timeZone = appTimeZone()
): Promise<Map<string, string>> {
	let show: TvmazeShow;
	try {
		show = await tvmaze<TvmazeShow>(`/lookup/shows?thetvdb=${tvdbId}`);
	} catch (error) {
		if (error instanceof TvmazeError && error.status === 404) return new Map();
		throw error;
	}
	const episodes = await tvmaze<TvmazeEpisode[]>(`/shows/${show.id}/episodes?specials=1`);
	return buildEpisodeAirDates(episodes, timeZone);
}

export function localizedEpisodeAirDate(
	dates: Map<string, string>,
	season: number,
	episode: number
): string | undefined {
	return dates.get(episodeKey(season, episode));
}
