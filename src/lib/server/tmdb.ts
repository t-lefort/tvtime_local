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
	genre_ids?: number[];
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
	credits?: TmdbCredits;
}

export interface TmdbMovieSummary {
	id: number;
	title: string;
	original_title: string;
	genre_ids?: number[];
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
	production_companies?: TmdbProductionCompany[];
	belongs_to_collection?: TmdbBelongsToCollection | null;
	'watch/providers'?: TmdbWatchProviders;
	credits?: TmdbCredits;
}

export interface TmdbProductionCompany {
	id: number;
	name: string;
	logo_path: string | null;
}

export interface TmdbBelongsToCollection {
	id: number;
	name: string;
	poster_path: string | null;
	backdrop_path: string | null;
}

export interface TmdbPersonSummary {
	id: number;
	name: string;
	known_for_department: string;
	profile_path: string | null;
	popularity: number;
}

export interface TmdbCompanySummary {
	id: number;
	name: string;
	logo_path: string | null;
	origin_country?: string;
}

export interface TmdbCastMember {
	id: number;
	name: string;
	character: string;
	profile_path: string | null;
	order: number;
}

export interface TmdbCrewMember {
	id: number;
	name: string;
	job: string;
	department: string;
}

interface TmdbCredits {
	cast?: TmdbCastMember[];
	crew?: TmdbCrewMember[];
}

/** Acteur stocké en base (colonne cast, JSON). Distribution principale via TMDB. */
export interface StoredCastMember {
	id: number;
	name: string;
	character: string | null;
	profilePath: string | null;
}

/** Nombre d'acteurs conservés dans la distribution (les plus haut au générique). */
const MAX_CAST = 15;

/** Réduit les crédits TMDB à la distribution principale, prête à stocker. */
export function extractCast(credits: TmdbCredits | undefined): StoredCastMember[] {
	const cast = credits?.cast;
	if (!cast?.length) return [];
	// Un acteur peut apparaître plusieurs fois (plusieurs rôles) : on déduplique par id
	// en fusionnant les personnages, pour garder des clés uniques côté affichage.
	const byId = new Map<number, StoredCastMember>();
	for (const c of cast.slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999))) {
		const existing = byId.get(c.id);
		if (existing) {
			if (c.character && !existing.character?.includes(c.character)) {
				existing.character = existing.character ? `${existing.character} / ${c.character}` : c.character;
			}
			continue;
		}
		if (byId.size >= MAX_CAST) continue;
		byId.set(c.id, {
			id: c.id,
			name: c.name,
			character: c.character || null,
			profilePath: c.profile_path
		});
	}
	return [...byId.values()];
}

/** Membre d'équipe stocké en base (colonne crew, JSON) : réalisation et production. */
export interface StoredCrewMember {
	id: number;
	name: string;
	job: string;
}

/** Postes conservés dans l'équipe stockée, dans l'ordre d'affichage. */
export const CREW_JOBS = ['Director', 'Producer'] as const;

/** Nombre de personnes conservées par poste (réalisateur, producteur). */
const MAX_CREW_PER_JOB = 6;

/** Réduit les crédits TMDB à l'équipe principale (réalisation, production), prête à stocker. */
export function extractCrew(credits: TmdbCredits | undefined): StoredCrewMember[] {
	const crew = credits?.crew;
	if (!crew?.length) return [];
	const result: StoredCrewMember[] = [];
	for (const job of CREW_JOBS) {
		const seen = new Set<number>();
		for (const member of crew) {
			if (member.job !== job || seen.has(member.id)) continue;
			seen.add(member.id);
			result.push({ id: member.id, name: member.name, job });
			if (seen.size >= MAX_CREW_PER_JOB) break;
		}
	}
	return result;
}

/** Société de production stockée en base (colonne production_companies, JSON). */
export interface StoredCompany {
	id: number;
	name: string;
	logoPath: string | null;
}

/** Nombre de sociétés de production conservées. */
const MAX_COMPANIES = 5;

/** Réduit les sociétés de production TMDB, prêtes à stocker. */
export function extractCompanies(companies: TmdbProductionCompany[] | undefined): StoredCompany[] {
	return (companies ?? [])
		.slice(0, MAX_COMPANIES)
		.map((c) => ({ id: c.id, name: c.name, logoPath: c.logo_path }));
}

/** Saga (collection) d'un film stockée en base (colonne collection, JSON). */
export interface StoredCollection {
	id: number;
	name: string;
}

/** Réduit la saga TMDB d'un film, prête à stocker. Null si le film n'appartient à aucune saga. */
export function extractCollection(
	collection: TmdbBelongsToCollection | null | undefined
): StoredCollection | null {
	if (!collection) return null;
	return { id: collection.id, name: collection.name };
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
		append_to_response: 'external_ids,watch/providers,credits'
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

/** Nombre de suggestions (sociétés / personnes) proposées dans la recherche. */
const MAX_SEARCH_SUGGESTIONS = 8;

/** Sociétés de production dont le nom correspond à la requête, les plus notoires d'abord. */
export async function searchCompanies(query: string): Promise<TmdbCompanySummary[]> {
	const res = await tmdb<{ results: TmdbCompanySummary[] }>('/search/company', { query });
	return res.results.slice(0, MAX_SEARCH_SUGGESTIONS);
}

/** Personnes (réalisateurs, producteurs, acteurs…) dont le nom correspond à la requête. */
export async function searchPeople(query: string): Promise<TmdbPersonSummary[]> {
	const res = await tmdb<{ results: TmdbPersonSummary[] }>('/search/person', {
		query,
		include_adult: false
	});
	return res.results
		.slice()
		.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
		.slice(0, MAX_SEARCH_SUGGESTIONS);
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
		append_to_response: 'watch/providers,credits'
	});
}

/** Plateformes seules (pour rafraîchir sans recharger tous les détails). */
export async function getProviders(kind: 'tv' | 'movie', tmdbId: number): Promise<StoredProviders | null> {
	const raw = await tmdb<TmdbWatchProviders>(`/${kind}/${tmdbId}/watch/providers`);
	return extractProviders(raw);
}

export interface TmdbPersonDetails {
	id: number;
	name: string;
	biography: string;
	profile_path: string | null;
	known_for_department: string | null;
	birthday: string | null;
	deathday: string | null;
	place_of_birth: string | null;
}

/** Un titre (film ou série) de la filmographie d'une personne. */
export interface PersonCredit {
	tmdbId: number;
	mediaType: 'movie' | 'tv';
	title: string;
	posterPath: string | null;
	date: string | null;
	role: string | null;
	voteAverage: number;
	popularity: number;
}

export interface PersonFilmography {
	person: TmdbPersonDetails;
	movies: PersonCredit[];
	shows: PersonCredit[];
	other: PersonCredit[];
}

/** Nombre de titres conservés par type dans la filmographie d'une personne. */
const MAX_FILMOGRAPHY = 40;

/** Genres TMDB non fiction relégués après les films et séries dans une filmographie. */
const NON_FICTION_GENRE_IDS = new Set([
	99, // Documentaire (film et TV)
	10763, // Actualités
	10764, // Téléréalité
	10767 // Talk-show
]);

export function isNonFictionGenre(genreIds: readonly number[] | undefined): boolean {
	return genreIds?.some((genreId) => NON_FICTION_GENRE_IDS.has(genreId)) ?? false;
}

/** Traductions françaises des postes TMDB affichés comme rôle dans une filmographie. */
const JOB_FR: Record<string, string> = {
	Director: 'Réalisateur',
	Producer: 'Producteur',
	'Executive Producer': 'Producteur exécutif',
	Writer: 'Scénariste',
	Screenplay: 'Scénariste',
	Creator: 'Créateur',
	Novel: 'Roman',
	'Original Music Composer': 'Compositeur'
};

function jobFr(job: string): string {
	return JOB_FR[job] ?? job;
}

export async function getPersonDetails(personId: number): Promise<TmdbPersonDetails> {
	return tmdb<TmdbPersonDetails>(`/person/${personId}`);
}

/** Fiche d'une personne + ses films et séries (rôles d'acteur et postes d'équipe), triés par notoriété. */
export async function getPersonFilmography(personId: number): Promise<PersonFilmography> {
	const [person, movieCredits, tvCredits] = await Promise.all([
		getPersonDetails(personId),
		getPersonMovieCredits(personId),
		getPersonTvCredits(personId)
	]);

	const movieItems = [
		...movieCredits.cast.map((c) => ({ summary: c, role: c.character || null })),
		...movieCredits.crew.map((c) => ({ summary: c, role: jobFr(c.job) }))
	];
	const movieToCredit = ({ summary: c, role }: (typeof movieItems)[number]): PersonCredit => ({
		tmdbId: c.id,
		mediaType: 'movie',
		title: c.title || c.original_title,
		posterPath: c.poster_path,
		date: c.release_date || null,
		role,
		voteAverage: c.vote_average,
		popularity: c.popularity ?? 0
	});
	const movies = collectFilmography(
		movieItems.filter(({ summary }) => !isNonFictionGenre(summary.genre_ids)),
		movieToCredit
	);
	const otherMovies = collectFilmography(
		movieItems.filter(({ summary }) => isNonFictionGenre(summary.genre_ids)),
		movieToCredit
	);

	const showItems = [
		...tvCredits.cast.map((c) => ({ summary: c, role: c.character || null })),
		...tvCredits.crew.map((c) => ({ summary: c, role: jobFr(c.job) }))
	];
	const showToCredit = ({ summary: c, role }: (typeof showItems)[number]): PersonCredit => ({
		tmdbId: c.id,
		mediaType: 'tv',
		title: c.name || c.original_name,
		posterPath: c.poster_path,
		date: c.first_air_date || null,
		role,
		voteAverage: c.vote_average,
		popularity: c.popularity ?? 0
	});
	const shows = collectFilmography(
		showItems.filter(({ summary }) => !isNonFictionGenre(summary.genre_ids)),
		showToCredit
	);
	const otherShows = collectFilmography(
		showItems.filter(({ summary }) => isNonFictionGenre(summary.genre_ids)),
		showToCredit
	);
	const other = [...otherMovies, ...otherShows].sort(personCreditSort).slice(0, MAX_FILMOGRAPHY);

	return { person, movies, shows, other };
}

/** Dédoublonne par titre (plusieurs rôles → rôles fusionnés), trie et plafonne. */
function collectFilmography<T>(credits: T[], toCredit: (credit: T) => PersonCredit): PersonCredit[] {
	const byId = new Map<number, PersonCredit>();
	for (const credit of credits) {
		const item = toCredit(credit);
		const existing = byId.get(item.tmdbId);
		if (!existing) {
			byId.set(item.tmdbId, item);
		} else if (item.role && !existing.role?.includes(item.role)) {
			existing.role = existing.role ? `${existing.role} / ${item.role}` : item.role;
		}
	}
	return [...byId.values()].sort(personCreditSort).slice(0, MAX_FILMOGRAPHY);
}

function personCreditSort(a: PersonCredit, b: PersonCredit): number {
	const popularity = b.popularity - a.popularity;
	if (popularity !== 0) return popularity;
	return (b.date ?? '').localeCompare(a.date ?? '');
}

export interface TmdbCompanyDetails {
	id: number;
	name: string;
	logo_path: string | null;
	description: string | null;
	headquarters: string | null;
	origin_country: string | null;
}

export async function getCompanyDetails(companyId: number): Promise<TmdbCompanyDetails> {
	return tmdb<TmdbCompanyDetails>(`/company/${companyId}`);
}

/** Nombre de pages "discover" chargées pour les films d'une société (20 films par page). */
const COMPANY_MOVIE_PAGES = 2;

export interface TmdbCollectionDetails {
	id: number;
	name: string;
	overview: string | null;
	poster_path: string | null;
	backdrop_path: string | null;
	parts: TmdbMovieSummary[];
}

export async function getCollectionDetails(collectionId: number): Promise<TmdbCollectionDetails> {
	return tmdb<TmdbCollectionDetails>(`/collection/${collectionId}`);
}

/** Trie les films d'une saga par date de sortie (les non datés en dernier). */
export function orderCollectionParts(parts: TmdbMovieSummary[]): TmdbMovieSummary[] {
	return parts.slice().sort((a, b) => {
		const da = a.release_date || '';
		const db = b.release_date || '';
		if (da && db) return da.localeCompare(db);
		return da ? -1 : db ? 1 : 0;
	});
}

/** Rang (à partir de 1) d'un film dans sa saga triée par date, ou 0 s'il est absent. */
export function collectionPosition(orderedParts: TmdbMovieSummary[], tmdbId: number): number {
	return orderedParts.findIndex((p) => p.id === tmdbId) + 1;
}

/** Saga d'un film prête à afficher : « Rocky - Saga (2/6) ». */
export interface CollectionInfo {
	id: number;
	name: string;
	position: number;
	total: number;
}

/** Situe un film dans sa saga (rang + total) via l'API collection TMDB. */
export async function getCollectionInfo(
	collection: StoredCollection,
	tmdbId: number
): Promise<CollectionInfo> {
	const details = await getCollectionDetails(collection.id);
	const ordered = orderCollectionParts(details.parts);
	return {
		id: collection.id,
		name: collection.name,
		position: collectionPosition(ordered, tmdbId),
		total: ordered.length
	};
}

/** Films d'une société de production, triés par notoriété. */
export async function getCompanyMovies(companyId: number): Promise<TmdbMovieSummary[]> {
	const pages = await Promise.all(
		Array.from({ length: COMPANY_MOVIE_PAGES }, (_, i) =>
			tmdb<{ results: TmdbMovieSummary[]; total_pages: number }>('/discover/movie', {
				with_companies: companyId,
				sort_by: 'popularity.desc',
				include_adult: false,
				page: i + 1
			})
		)
	);
	return mergeMovieSearchResults(
		pages.flatMap((p) => p.results),
		[]
	);
}
