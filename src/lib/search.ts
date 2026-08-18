/** Onglets de la recherche ; « tout » interroge les trois catalogues à la fois. */
export const SEARCH_TYPES = ['tout', 'series', 'films', 'livres'] as const;

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
	fallback: '/series' | '/films' | '/livres'
): string {
	if (!q) return fallback;
	const known = SEARCH_TYPES.includes(type as SearchType) ? (type as SearchType) : null;
	const params = new URLSearchParams({ type: known ?? fallback.slice(1), q });
	return `/recherche?${params}`;
}

/** Un résultat de recherche, série, film ou livre, prêt à afficher. */
export interface SearchResult {
	/** Nature du résultat : indispensable dans l'onglet « Tout », qui les mélange. */
	kind: 'series' | 'films' | 'livres';
	/** Clé unique dans la liste : les livres n'ont pas d'identifiant TMDB. */
	key: string;
	/** Identifiant TMDB (séries et films uniquement). */
	tmdbId: number | null;
	/** Identifiant côté catalogue bibliographique (livres uniquement). */
	sourceId: string | null;
	name: string;
	originalName: string;
	overview: string;
	/** Chemin TMDB de l'affiche (séries et films). */
	posterPath: string | null;
	/** URL absolue de la couverture (livres). */
	coverUrl: string | null;
	backdropPath: string | null;
	date: string | null;
	voteAverage: number;
	/** Popularité TMDB, utilisée pour départager les catalogues dans « Tout ». */
	popularity: number;
	/** Identifiant local si le titre est déjà dans la bibliothèque du profil. */
	localId: number | null;
}

/** Nombre de résultats conservés quand les catalogues sont mélangés. */
const MAX_MIXED_RESULTS = 40;

/**
 * Fusionne les catalogues en respectant le classement de chaque liste :
 * on descend rang par rang, le plus populaire d'abord à rang égal.
 */
export function interleaveResults(...lists: SearchResult[][]): SearchResult[] {
	const ranked = lists.flatMap((list) => list.map((result, rank) => ({ result, rank })));
	ranked.sort((a, b) => a.rank - b.rank || b.result.popularity - a.result.popularity);
	return ranked.slice(0, MAX_MIXED_RESULTS).map((entry) => entry.result);
}

/**
 * Prefixe d'un resultat de recherche qui designe une serie de livres entiere
 * plutot qu'un tome : « serie:wd:Q28667972 ».
 */
export const BOOK_SERIES_PREFIX = 'serie:';

/** URI de la serie designee par un resultat de recherche, si c'en est une. */
export function bookSeriesUri(sourceId: string | null | undefined): string | null {
	return sourceId?.startsWith(BOOK_SERIES_PREFIX) ? sourceId.slice(BOOK_SERIES_PREFIX.length) : null;
}

/**
 * Ou mene un resultat de recherche « livre ». Une serie ouvre la liste
 * ordonnee de ses tomes ; un tome deja possede ouvre sa fiche de
 * bibliotheque, sinon celle du catalogue. Une edition trouvee par ISBN n'a
 * pas de fiche : elle passe par la page d'ajout, qui sait la retrouver.
 */
export function bookResultHref(result: Pick<SearchResult, 'sourceId' | 'localId' | 'name'>): string {
	const seriesUri = bookSeriesUri(result.sourceId);
	if (seriesUri) return `/livres/series/${encodeURIComponent(seriesUri)}`;
	if (result.localId) return `/livres/${result.localId}`;
	if (result.sourceId && /^(?:inv|wd):/.test(result.sourceId)) {
		return `/livres/oeuvre/${encodeURIComponent(result.sourceId)}`;
	}
	return `/livres/ajouter?q=${encodeURIComponent(result.name)}`;
}
