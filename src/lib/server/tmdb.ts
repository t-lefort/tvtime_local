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
	popularity?: number;
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
	'watch/providers'?: TmdbWatchProviders;
}

export interface TmdbMovieSummary {
	id: number;
	title: string;
	original_title: string;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	release_date: string | null;
	vote_average: number;
	popularity?: number;
	vote_count?: number;
}

export interface TmdbMovieDetails extends TmdbMovieSummary {
	runtime: number | null;
	genres: { id: number; name: string }[];
	'watch/providers'?: TmdbWatchProviders;
}

interface TmdbPersonSummary {
	id: number;
	name: string;
	known_for_department: string;
	popularity: number;
}

interface TmdbMovieCastCredit extends TmdbMovieSummary {
	character: string;
	order?: number;
}

interface TmdbMovieCrewCredit extends TmdbMovieSummary {
	department: string;
	job: string;
}

interface TmdbPersonMovieCredits {
	cast: TmdbMovieCastCredit[];
	crew: TmdbMovieCrewCredit[];
}

interface TmdbTvCastCredit extends TmdbShowSummary {
	character: string;
	episode_count?: number;
}

interface TmdbTvCrewCredit extends TmdbShowSummary {
	department: string;
	job: string;
	episode_count?: number;
}

interface TmdbPersonTvCredits {
	cast: TmdbTvCastCredit[];
	crew: TmdbTvCrewCredit[];
}

const MAX_PERSON_MATCHES = 3;
const MAX_MOVIE_RESULTS = 40;
const MAX_TV_RESULTS = 40;
const TV_CREW_SEARCH_JOBS = new Set(['Creator', 'Director', 'Writer']);

interface TmdbProvider {
	provider_name: string;
	logo_path: string | null;
	display_priority: number;
}

export interface TmdbWatchProviders {
	results: Record<
		string,
		{
			link?: string;
			flatrate?: TmdbProvider[];
			free?: TmdbProvider[];
			ads?: TmdbProvider[];
			rent?: TmdbProvider[];
			buy?: TmdbProvider[];
		}
	>;
}

/** Forme stockée en base (colonne watch_providers, JSON). Source JustWatch via TMDB. */
export interface StoredProviders {
	link: string | null;
	streaming: { name: string; logoPath: string | null }[];
	rent: { name: string; logoPath: string | null }[];
	buy: { name: string; logoPath: string | null }[];
}

/** Pays utilisé pour les plateformes de streaming (défaut : France). */
export function watchRegion(): string {
	return process.env.WATCH_REGION?.trim().toUpperCase() || 'FR';
}

/** Réduit la réponse TMDB aux plateformes de la région, prêtes à stocker. Null si aucune. */
export function extractProviders(raw: TmdbWatchProviders | undefined): StoredProviders | null {
	const region = raw?.results?.[watchRegion()];
	if (!region) return null;
	const slim = (list?: TmdbProvider[]) =>
		(list ?? [])
			.slice()
			.sort((a, b) => a.display_priority - b.display_priority)
			.map((p) => ({ name: p.provider_name, logoPath: p.logo_path }));
	// « streaming » = abonnement + gratuit (avec ou sans pub), dédoublonné
	const streaming = [...slim(region.flatrate), ...slim(region.free), ...slim(region.ads)].filter(
		(p, i, arr) => arr.findIndex((q) => q.name === p.name) === i
	);
	const rent = slim(region.rent);
	const buy = slim(region.buy);
	if (!streaming.length && !rent.length && !buy.length) return null;
	return { link: region.link ?? null, streaming, rent, buy };
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
	const [shows, people] = await Promise.all([
		tmdb<{ results: TmdbShowSummary[] }>('/search/tv', {
			query,
			include_adult: false
		}),
		tmdb<{ results: TmdbPersonSummary[] }>('/search/person', {
			query,
			include_adult: false
		})
	]);

	const peopleCredits = await Promise.all(
		people.results.slice(0, MAX_PERSON_MATCHES).map((person) => getPersonTvCredits(person.id))
	);
	const creditedShows = peopleCredits.flatMap(tvCreditsSearchResults);

	return mergeTvSearchResults(shows.results, creditedShows);
}

/** Retourne l'id TMDB correspondant à un id de série TheTVDB, ou null. */
export async function findByTvdbId(tvdbId: number): Promise<number | null> {
	const res = await tmdb<{ tv_results: { id: number }[] }>(`/find/${tvdbId}`, {
		external_source: 'tvdb_id'
	});
	return res.tv_results[0]?.id ?? null;
}

export async function getShowDetails(tmdbId: number): Promise<TmdbShowDetails> {
	return tmdb<TmdbShowDetails>(`/tv/${tmdbId}`, {
		append_to_response: 'external_ids,watch/providers'
	});
}

export async function getSeasonEpisodes(tmdbId: number, seasonNumber: number): Promise<TmdbEpisode[]> {
	const res = await tmdb<{ episodes: TmdbEpisode[] }>(`/tv/${tmdbId}/season/${seasonNumber}`);
	return res.episodes;
}

export async function searchMovie(query: string): Promise<TmdbMovieSummary[]> {
	const [movies, people] = await Promise.all([
		tmdb<{ results: TmdbMovieSummary[] }>('/search/movie', {
			query,
			include_adult: false
		}),
		tmdb<{ results: TmdbPersonSummary[] }>('/search/person', {
			query,
			include_adult: false
		})
	]);

	const peopleCredits = await Promise.all(
		people.results.slice(0, MAX_PERSON_MATCHES).map((person) => getPersonMovieCredits(person.id))
	);
	const creditedMovies = peopleCredits.flatMap(movieCreditsSearchResults);

	return mergeMovieSearchResults(movies.results, creditedMovies);
}

async function getPersonMovieCredits(personId: number): Promise<TmdbPersonMovieCredits> {
	return tmdb<TmdbPersonMovieCredits>(`/person/${personId}/movie_credits`);
}

function movieCreditsSearchResults(credits: TmdbPersonMovieCredits): TmdbMovieSummary[] {
	return mergeMovieSearchResults(
		[],
		[
			...credits.cast,
			...credits.crew.filter((credit) => credit.job === 'Director')
		].sort(movieCreditSort)
	);
}

function movieCreditSort(a: TmdbMovieSummary, b: TmdbMovieSummary): number {
	const popularity = (b.popularity ?? 0) - (a.popularity ?? 0);
	if (popularity !== 0) return popularity;
	return (b.release_date ?? '').localeCompare(a.release_date ?? '');
}

export function mergeMovieSearchResults(
	titleResults: TmdbMovieSummary[],
	creditResults: TmdbMovieSummary[]
): TmdbMovieSummary[] {
	const byId = new Map<number, TmdbMovieSummary>();
	for (const movie of [...titleResults, ...creditResults]) {
		if (!byId.has(movie.id)) byId.set(movie.id, movie);
		if (byId.size >= MAX_MOVIE_RESULTS) break;
	}
	return [...byId.values()];
}

async function getPersonTvCredits(personId: number): Promise<TmdbPersonTvCredits> {
	return tmdb<TmdbPersonTvCredits>(`/person/${personId}/tv_credits`);
}

function tvCreditsSearchResults(credits: TmdbPersonTvCredits): TmdbShowSummary[] {
	return mergeTvSearchResults(
		[],
		[
			...credits.cast,
			...credits.crew.filter((credit) => TV_CREW_SEARCH_JOBS.has(credit.job))
		].sort(tvCreditSort)
	);
}

function tvCreditSort(a: TmdbShowSummary, b: TmdbShowSummary): number {
	const popularity = (b.popularity ?? 0) - (a.popularity ?? 0);
	if (popularity !== 0) return popularity;
	return (b.first_air_date ?? '').localeCompare(a.first_air_date ?? '');
}

export function mergeTvSearchResults(
	titleResults: TmdbShowSummary[],
	creditResults: TmdbShowSummary[]
): TmdbShowSummary[] {
	const byId = new Map<number, TmdbShowSummary>();
	for (const show of [...titleResults, ...creditResults]) {
		if (!byId.has(show.id)) byId.set(show.id, show);
		if (byId.size >= MAX_TV_RESULTS) break;
	}
	return [...byId.values()];
}

export async function getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
	return tmdb<TmdbMovieDetails>(`/movie/${tmdbId}`, {
		append_to_response: 'watch/providers'
	});
}

/** Plateformes seules (pour rafraîchir sans recharger tous les détails). */
export async function getProviders(kind: 'tv' | 'movie', tmdbId: number): Promise<StoredProviders | null> {
	const raw = await tmdb<TmdbWatchProviders>(`/${kind}/${tmdbId}/watch/providers`);
	return extractProviders(raw);
}
