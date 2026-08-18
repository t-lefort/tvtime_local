/** Onglets de la recherche ; « tout » interroge séries et films en même temps. */
export const SEARCH_TYPES = ['tout', 'series', 'films'] as const;

export type SearchType = (typeof SEARCH_TYPES)[number];

export function parseSearchType(value: string | null | undefined): SearchType {
	return SEARCH_TYPES.includes(value as SearchType) ? (value as SearchType) : 'tout';
}

/**
 * Lien de retour d'une fiche vers la recherche qui l'a ouverte, en rouvrant
 * l'onglet d'origine. Sans requête, on retombe sur la bibliothèque.
 */
export function searchBackHref(
	q: string,
	type: string | null | undefined,
	fallback: '/series' | '/films'
): string {
	if (!q) return fallback;
	const known = SEARCH_TYPES.includes(type as SearchType) ? (type as SearchType) : null;
	const params = new URLSearchParams({ type: known ?? fallback.slice(1), q });
	return `/recherche?${params}`;
}

/** Un résultat de recherche TMDB, série ou film, prêt à afficher. */
export interface SearchResult {
	/** Nature du résultat : indispensable dans l'onglet « Tout », qui mélange les deux. */
	kind: 'series' | 'films';
	tmdbId: number;
	name: string;
	originalName: string;
	overview: string;
	posterPath: string | null;
	backdropPath: string | null;
	date: string | null;
	voteAverage: number;
	/** Popularité TMDB, utilisée pour départager séries et films dans l'onglet « Tout ». */
	popularity: number;
	localId: number | null;
}

/** Nombre de résultats conservés quand séries et films sont mélangés. */
const MAX_MIXED_RESULTS = 40;

/**
 * Fusionne séries et films en respectant le classement TMDB de chaque liste :
 * on descend rang par rang, le plus populaire d'abord à rang égal.
 */
export function interleaveResults(shows: SearchResult[], movies: SearchResult[]): SearchResult[] {
	const ranked = [
		...shows.map((result, rank) => ({ result, rank })),
		...movies.map((result, rank) => ({ result, rank }))
	];
	ranked.sort((a, b) => a.rank - b.rank || b.result.popularity - a.result.popularity);
	return ranked.slice(0, MAX_MIXED_RESULTS).map((entry) => entry.result);
}
