/** Ordres d'affichage proposés sur les listes de séries et de films. */
export const SORT_ORDERS = ['recent', 'alpha'] as const;

export type SortOrder = (typeof SORT_ORDERS)[number];

/** Ordre par défaut : l'activité la plus récente d'abord. */
export const DEFAULT_SORT: SortOrder = 'recent';

/** Lit le paramètre `tri` de l'URL, en retombant sur l'ordre par défaut. */
export function parseSort(value: string | null | undefined): SortOrder {
	return SORT_ORDERS.includes(value as SortOrder) ? (value as SortOrder) : DEFAULT_SORT;
}

export const SORT_LABELS: Record<SortOrder, string> = {
	recent: 'Récents',
	alpha: 'A-Z'
};
