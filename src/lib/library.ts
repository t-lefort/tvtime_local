/**
 * Les trois catalogues de la bibliothèque. Chaque page de liste s'appuie sur
 * cette table pour afficher le même sélecteur de type de média.
 */
export const LIBRARY_SECTIONS = [
	{ key: 'series', href: '/series', label: 'Séries', icon: '📺', addHref: '/recherche?type=series' },
	{ key: 'films', href: '/films', label: 'Films', icon: '🎬', addHref: '/recherche?type=films' },
	{ key: 'livres', href: '/livres', label: 'Livres', icon: '📚', addHref: '/recherche?type=livres' }
] as const;

export type LibrarySection = (typeof LIBRARY_SECTIONS)[number]['key'];

export type LibraryCounts = Record<LibrarySection, number>;

export function librarySection(key: LibrarySection) {
	return LIBRARY_SECTIONS.find((section) => section.key === key)!;
}

/**
 * Catalogue ouvert par défaut : le plus fourni, pour tomber directement sur le
 * contenu au lieu d'un menu intermédiaire. À égalité, l'ordre des onglets tranche.
 */
export function biggestLibrarySection(counts: LibraryCounts): LibrarySection {
	return LIBRARY_SECTIONS.reduce((best, section) =>
		counts[section.key] > counts[best.key] ? section : best
	).key;
}

/** Filtre local d'une liste : insensible à la casse et aux champs absents. */
export function matchesQuery(query: string, fields: (string | null | undefined)[]): boolean {
	if (!query) return true;
	return fields.some((field) => field?.toLocaleLowerCase('fr').includes(query));
}

/** Normalise la saisie du champ de recherche locale d'une liste. */
export function parseQuery(value: string | null | undefined): { q: string; needle: string } {
	const q = value?.trim() ?? '';
	return { q, needle: q.toLocaleLowerCase('fr') };
}
