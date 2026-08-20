import { dateInTimeZone } from '$lib/date';
import { appTimeZone } from './dates';

const BASE = 'https://api.tvmaze.com';

interface TvmazeShow {
	id: number;
}

export interface TvmazeEpisode {
	season: number;
	number: number | null;
	airdate: string | null;
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

function episodeKey(episode: number, airDate: string): string {
	return `${episode}:${airDate}`;
}

/**
 * Convertit les instants de diffusion TVmaze en dates civiles du fuseau cible.
 * La saison n'entre volontairement pas dans la clé : TMDB et TVmaze peuvent découper
 * une même série différemment. La date TMDB et le numéro d'épisode servent d'ancre.
 */
export function buildEpisodeAirDates(
	episodes: TvmazeEpisode[],
	timeZone: string
): Map<string, string> {
	const dates = new Map<string, string>();
	for (const episode of episodes) {
		if (episode.season <= 0 || !episode.number || !episode.airdate || !episode.airstamp) continue;
		try {
			dates.set(
				episodeKey(episode.number, episode.airdate),
				dateInTimeZone(episode.airstamp, timeZone)
			);
		} catch {
			// Horodatage incomplet côté TVmaze : TMDB restera la source de repli.
		}
	}
	return dates;
}

/** Dates de disponibilité locales d'une série, indexées par « épisode:date TMDB ». */
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
	episode: number,
	airDate: string | null
): string | undefined {
	if (!airDate) return undefined;

	const exact = dates.get(episodeKey(episode, airDate));
	if (exact) return exact;

	// TMDB date parfois les épisodes de plateformes au jour de sortie américain,
	// tandis que TVmaze retient le lendemain (jour officiel de la plateforme).
	// Le numéro seul n'est pas assez discriminant entre plusieurs saisons : on
	// n'accepte donc ce repli que si les deux dates civiles diffèrent d'un seul jour.
	const target = Date.parse(`${airDate}T00:00:00Z`);
	if (Number.isNaN(target)) return undefined;

	let match: string | undefined;
	for (const [key, localizedDate] of dates) {
		const separator = key.indexOf(':');
		if (separator < 0 || Number(key.slice(0, separator)) !== episode) continue;
		const sourceDate = Date.parse(`${key.slice(separator + 1)}T00:00:00Z`);
		if (Number.isNaN(sourceDate) || Math.abs(sourceDate - target) !== 86_400_000) continue;
		if (match && match !== localizedDate) return undefined;
		match = localizedDate;
	}
	return match;
}
