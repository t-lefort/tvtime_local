/**
 * Logique pure de la page « Pour vous » : pondération des titres déjà regardés
 * (les « graines ») et classement des recommandations TMDB qui en découlent.
 * Séparée de suggestions.ts pour être testable sans base de données ni réseau.
 */
import { isNonFictionGenre } from './tmdb';

/** Titre de la bibliothèque servant de point de départ aux recommandations. */
export interface SuggestionSeed {
	tmdbId: number;
	title: string;
	/** Affinité du profil avec ce titre (favori, part regardée…) ; 0 = ignoré. */
	weight: number;
}

/** Titre recommandé par TMDB, réduit aux champs utiles au classement et à l'affichage. */
export interface SuggestionCandidate {
	tmdbId: number;
	name: string;
	originalName: string;
	overview: string;
	posterPath: string | null;
	backdropPath: string | null;
	date: string | null;
	voteAverage: number;
	voteCount: number;
	popularity: number;
	genreIds: number[];
}

/** Suggestion finale, prête à afficher. */
export interface Suggestion extends Omit<SuggestionCandidate, 'genreIds' | 'voteCount' | 'popularity'> {
	score: number;
	/** Titres de la bibliothèque qui ont amené cette suggestion (les plus affinitaires). */
	because: string[];
}

/** Note personnelle en dessous de laquelle un titre ne sert jamais de graine. */
const MIN_SEED_RATING = 5;

/**
 * Apport de la note personnelle au poids d'une graine : ±0,6 par point autour
 * de 5 (10/10 → +3, soit plus qu'un favori), pour qu'elle domine les autres signaux.
 */
function ratingBoost(rating: number | null): number {
	return rating === null ? 0 : (rating - 5) * 0.6;
}

/**
 * Poids d'une série comme graine : la note personnelle domine — mal notée = jamais
 * une graine, bien notée = graine même arrêtée (la note explicite prime sur
 * l'archivage). Sans note, favori et part des épisodes vus renforcent ; une série
 * arrêtée ou jamais commencée (sauf favorite) ne compte pas.
 */
export function showSeedWeight(s: {
	favorite: boolean;
	archived: boolean;
	watchedCount: number;
	airedCount: number;
	rating: number | null;
}): number {
	if (s.rating !== null && s.rating < MIN_SEED_RATING) return 0;
	if (s.rating === null && s.archived) return 0;
	if (s.rating === null && s.watchedCount === 0 && !s.favorite) return 0;
	const progress = s.airedCount > 0 ? Math.min(s.watchedCount / s.airedCount, 1) : 0;
	return 1 + progress + (s.favorite ? 1 : 0) + ratingBoost(s.rating);
}

/**
 * Poids d'un film comme graine : la note personnelle domine (mal noté = jamais
 * une graine), puis favori et revisionnages renforcent ; non vu (sauf noté ou
 * favori) = ignoré.
 */
export function movieSeedWeight(m: {
	favorite: boolean;
	watchCount: number;
	rating: number | null;
}): number {
	if (m.rating !== null && m.rating < MIN_SEED_RATING) return 0;
	if (m.watchCount === 0 && !m.favorite && m.rating === null) return 0;
	return 1 + Math.min(m.watchCount, 2) * 0.5 + (m.favorite ? 1 : 0) + ratingBoost(m.rating);
}

/**
 * Facteur appliqué au temps passé par genre selon la note personnelle du titre :
 * 0,2 (noté 1) à 2 (noté 10), neutre si non noté. Les genres des titres bien notés
 * pèsent ainsi deux fois plus dans l'affinité du profil.
 */
export function ratingGenreFactor(rating: number | null): number {
	return rating === null ? 1 : rating / 5;
}

/**
 * Poids 0..1 par genre TMDB (id), proportionnel au temps que le profil a passé
 * sur chaque genre. `idsByName` traduit les noms stockés en base vers les ids TMDB.
 */
export function buildGenreWeights(
	items: { genres: string[]; weight: number }[],
	idsByName: Map<string, number>
): Map<number, number> {
	const raw = new Map<number, number>();
	for (const item of items) {
		if (item.weight <= 0) continue;
		for (const genre of item.genres) {
			const id = idsByName.get(genre);
			if (id === undefined) continue;
			raw.set(id, (raw.get(id) ?? 0) + item.weight);
		}
	}
	const max = Math.max(0, ...raw.values());
	if (max <= 0) return new Map();
	return new Map([...raw].map(([id, weight]) => [id, weight / max]));
}

/** Rayon (années) du noyau triangulaire de l'affinité temporelle. */
const ERA_RADIUS_YEARS = 10;

/**
 * Affinité temporelle du profil, apprise de sa bibliothèque : renvoie, pour une
 * date de sortie, la part (0..1) des titres du profil sortis à moins de
 * ERA_RADIUS_YEARS ans (noyau triangulaire, pondéré par le poids de chaque titre).
 * Un profil qui regarde du récent favorise le récent, un profil qui regarde des
 * classiques garde ses classiques. 0,5 = neutre (date ou bibliothèque inconnues).
 */
export function buildEraAffinity(
	items: { date: string | null; weight: number }[]
): (date: string | null) => number {
	const points = items
		.filter((item) => item.weight > 0 && item.date)
		.map((item) => ({ year: Number(item.date!.slice(0, 4)), weight: item.weight }))
		.filter((point) => Number.isFinite(point.year));
	const total = points.reduce((sum, point) => sum + point.weight, 0);
	if (total <= 0) return () => 0.5;
	return (date) => {
		const year = date ? Number(date.slice(0, 4)) : NaN;
		if (!Number.isFinite(year)) return 0.5;
		let sum = 0;
		for (const point of points) {
			sum += point.weight * Math.max(0, 1 - Math.abs(point.year - year) / ERA_RADIUS_YEARS);
		}
		return sum / total;
	};
}

/** Nombre minimal de votes TMDB pour retenir un candidat (écarte les titres confidentiels). */
const MIN_VOTE_COUNT = 100;

/** Nombre de titres de la bibliothèque cités comme origine d'une suggestion. */
const MAX_BECAUSE = 2;

/** Facteur temporel (0,6 à 1,4) : privilégie les époques que le profil regarde. */
function eraFactor(affinity: number | undefined): number {
	return affinity === undefined ? 1 : 0.6 + 0.8 * affinity;
}

/** Facteur de notoriété (0,7 à 1,3, logarithmique) : départage en faveur des titres connus. */
function popularityFactor(popularity: number): number {
	return 0.7 + 0.2 * Math.min(Math.log10(1 + Math.max(0, popularity)), 3);
}

export interface RankOptions {
	/** Ids TMDB déjà en bibliothèque, jamais suggérés. */
	exclude: Set<number>;
	/** Poids 0..1 par genre TMDB (buildGenreWeights). */
	genreWeights: Map<number, number>;
	/** Affinité temporelle du profil (buildEraAffinity) ; absente = neutre. */
	eraAffinity?: (date: string | null) => number;
	limit?: number;
}

/**
 * Fusionne les recommandations de chaque graine et les classe :
 * un titre recommandé par plusieurs graines (ou des graines très affinitaires)
 * monte, puis la note TMDB (facteur 0,5 à 1,5), l'époque du profil (0,6 à 1,4),
 * la notoriété (0,7 à 1,3) et l'affinité de genres modulent. Sont exclus : les
 * titres déjà en bibliothèque, la non-fiction (documentaires, actualités,
 * téléréalité, talk-shows), les titres confidentiels (moins de MIN_VOTE_COUNT
 * votes) et ceux sans résumé français (jamais distribués en France).
 */
export function rankSuggestions(
	entries: { seed: SuggestionSeed; candidates: SuggestionCandidate[] }[],
	options: RankOptions
): Suggestion[] {
	const { exclude, genreWeights, eraAffinity, limit = 24 } = options;
	const byId = new Map<
		number,
		{ candidate: SuggestionCandidate; match: number; seeds: SuggestionSeed[] }
	>();
	for (const { seed, candidates } of entries) {
		for (const candidate of candidates) {
			if (
				exclude.has(candidate.tmdbId) ||
				isNonFictionGenre(candidate.genreIds) ||
				candidate.voteCount < MIN_VOTE_COUNT ||
				!candidate.overview.trim()
			) {
				continue;
			}
			const entry = byId.get(candidate.tmdbId) ?? { candidate, match: 0, seeds: [] };
			entry.match += seed.weight;
			entry.seeds.push(seed);
			byId.set(candidate.tmdbId, entry);
		}
	}
	return [...byId.values()]
		.map(({ candidate: { genreIds, voteCount, popularity, ...candidate }, match, seeds }) => {
			const affinity = genreIds.length
				? genreIds.reduce((sum, id) => sum + (genreWeights.get(id) ?? 0), 0) / genreIds.length
				: 0;
			return {
				...candidate,
				score:
					(match + affinity) *
					(0.5 + candidate.voteAverage / 10) *
					eraFactor(eraAffinity?.(candidate.date)) *
					popularityFactor(popularity),
				because: seeds
					.slice()
					.sort((a, b) => b.weight - a.weight)
					.slice(0, MAX_BECAUSE)
					.map((s) => s.title)
			};
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}
