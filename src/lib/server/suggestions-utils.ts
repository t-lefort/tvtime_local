/**
 * Logique pure de la page « Pour vous » : pondération des titres déjà regardés
 * (les « graines ») et classement des recommandations TMDB qui en découlent.
 * Séparée de suggestions.ts pour être testable sans base de données ni réseau.
 */

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
	genreIds: number[];
}

/** Suggestion finale, prête à afficher. */
export interface Suggestion extends Omit<SuggestionCandidate, 'genreIds'> {
	score: number;
	/** Titres de la bibliothèque qui ont amené cette suggestion (les plus affinitaires). */
	because: string[];
}

/**
 * Poids d'une série comme graine : favori et part des épisodes vus renforcent,
 * une série arrêtée ou jamais commencée ne compte pas.
 */
export function showSeedWeight(s: {
	favorite: boolean;
	archived: boolean;
	watchedCount: number;
	airedCount: number;
}): number {
	if (s.archived) return 0;
	if (s.watchedCount === 0 && !s.favorite) return 0;
	const progress = s.airedCount > 0 ? Math.min(s.watchedCount / s.airedCount, 1) : 0;
	return 1 + progress + (s.favorite ? 1 : 0);
}

/** Poids d'un film comme graine : favori et revisionnages renforcent, non vu = ignoré. */
export function movieSeedWeight(m: { favorite: boolean; watchCount: number }): number {
	if (m.watchCount === 0 && !m.favorite) return 0;
	return 1 + Math.min(m.watchCount, 2) * 0.5 + (m.favorite ? 1 : 0);
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

/** Nombre de titres de la bibliothèque cités comme origine d'une suggestion. */
const MAX_BECAUSE = 2;

/**
 * Fusionne les recommandations de chaque graine et les classe :
 * un titre recommandé par plusieurs graines (ou des graines très affinitaires)
 * monte, la note TMDB module fortement (facteur 0,5 à 1,5) et l'affinité de
 * genres du profil départage. Les titres déjà en bibliothèque sont exclus.
 */
export function rankSuggestions(
	entries: { seed: SuggestionSeed; candidates: SuggestionCandidate[] }[],
	exclude: Set<number>,
	genreWeights: Map<number, number>,
	limit = 24
): Suggestion[] {
	const byId = new Map<
		number,
		{ candidate: SuggestionCandidate; match: number; seeds: SuggestionSeed[] }
	>();
	for (const { seed, candidates } of entries) {
		for (const candidate of candidates) {
			if (exclude.has(candidate.tmdbId)) continue;
			const entry = byId.get(candidate.tmdbId) ?? { candidate, match: 0, seeds: [] };
			entry.match += seed.weight;
			entry.seeds.push(seed);
			byId.set(candidate.tmdbId, entry);
		}
	}
	return [...byId.values()]
		.map(({ candidate: { genreIds, ...candidate }, match, seeds }) => {
			const affinity = genreIds.length
				? genreIds.reduce((sum, id) => sum + (genreWeights.get(id) ?? 0), 0) / genreIds.length
				: 0;
			return {
				...candidate,
				score: (match + affinity) * (0.5 + candidate.voteAverage / 10),
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
