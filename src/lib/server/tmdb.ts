import 'dotenv/config';

const BASE = 'https://api.themoviedb.org/3';

export class TmdbError extends Error {
	constructor(
		message: string,
		public status: number
	) {
		super(message);
	}
}

function auth(): { headers: Record<string, string>; apiKeyParam: string | null } {
	const key = process.env.TMDB_API_KEY?.trim();
	if (!key) {
		throw new Error('TMDB_API_KEY manquante : créez une clé sur https://www.themoviedb.org/settings/api et renseignez-la dans .env');
	}
	// Jeton v4 (long, contient des points) → header Authorization ; clé v3 → paramètre api_key
	if (key.includes('.')) return { headers: { Authorization: `Bearer ${key}` }, apiKeyParam: null };
	return { headers: {}, apiKeyParam: key };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tmdb<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
	const { headers, apiKeyParam } = auth();
	const search = new URLSearchParams({ language: 'fr-FR' });
	if (apiKeyParam) search.set('api_key', apiKeyParam);
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined) search.set(k, String(v));
	}
	const url = `${BASE}${path}?${search}`;

	for (let attempt = 1; ; attempt++) {
		let res: Response;
		try {
			res = await fetch(url, { headers });
		} catch (e) {
			if (attempt >= 4) throw e;
			await sleep(1000 * attempt);
			continue;
		}
		if (res.status === 429 && attempt < 6) {
			const retryAfter = Number(res.headers.get('retry-after') ?? 2);
			await sleep((retryAfter + 0.5) * 1000);
			continue;
		}
		if (!res.ok) {
			throw new TmdbError(`TMDB ${res.status} sur ${path}`, res.status);
		}
		return (await res.json()) as T;
	}
}

export interface TmdbShowSummary {
	id: number;
	name: string;
	original_name: string;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	first_air_date: string | null;
	vote_average: number;
	origin_country?: string[];
}

export interface TmdbShowDetails extends TmdbShowSummary {
	status: string;
	genres: { id: number; name: string }[];
	episode_run_time: number[];
	number_of_episodes: number;
	number_of_seasons: number;
	seasons: { season_number: number; episode_count: number; air_date: string | null }[];
	external_ids?: { tvdb_id: number | null };
	last_air_date: string | null;
	networks?: { name: string }[];
}

export interface TmdbEpisode {
	id: number;
	season_number: number;
	episode_number: number;
	name: string | null;
	overview: string | null;
	air_date: string | null;
	runtime: number | null;
	still_path: string | null;
}

export async function searchTv(query: string): Promise<TmdbShowSummary[]> {
	const res = await tmdb<{ results: TmdbShowSummary[] }>('/search/tv', {
		query,
		include_adult: false
	});
	return res.results;
}

/** Retourne l'id TMDB correspondant à un id de série TheTVDB, ou null. */
export async function findByTvdbId(tvdbId: number): Promise<number | null> {
	const res = await tmdb<{ tv_results: { id: number }[] }>(`/find/${tvdbId}`, {
		external_source: 'tvdb_id'
	});
	return res.tv_results[0]?.id ?? null;
}

export async function getShowDetails(tmdbId: number): Promise<TmdbShowDetails> {
	return tmdb<TmdbShowDetails>(`/tv/${tmdbId}`, { append_to_response: 'external_ids' });
}

export async function getSeasonEpisodes(tmdbId: number, seasonNumber: number): Promise<TmdbEpisode[]> {
	const res = await tmdb<{ episodes: TmdbEpisode[] }>(`/tv/${tmdbId}/season/${seasonNumber}`);
	return res.episodes;
}
