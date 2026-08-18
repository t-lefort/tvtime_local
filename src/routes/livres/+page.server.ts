import { parseQuery } from '$lib/library';
import { parseSort } from '$lib/sort';
import { getBooksForUser } from '$lib/server/books';
import { getLibraryCounts } from '$lib/server/library';
import { requireUser } from '$lib/server/users';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, locals }) => {
	const user = requireUser(locals);
	// Comme pour les séries et les films : la bibliothèque part en une fois et
	// la page se charge du filtre, du tri et de la recherche.
	const books = getBooksForUser(user.id).map((book) => ({
		id: book.id,
		seriesId: book.seriesId,
		seriesTitle: book.seriesTitle,
		title: book.title,
		authors: JSON.parse(book.authors) as string[],
		publisher: book.publisher,
		volume: book.volume,
		addedAt: book.addedAt,
		inCollection: book.inCollection,
		wishlist: book.wishlist,
		readingStatus: book.readingStatus,
		favorite: book.favorite
	}));

	return {
		books,
		filter: url.searchParams.get('filtre') ?? 'tous',
		sort: parseSort(url.searchParams.get('tri')),
		q: parseQuery(url.searchParams.get('q')).q,
		libraryCounts: getLibraryCounts(user.id)
	};
};
