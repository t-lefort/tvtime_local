import { matchesQuery, parseQuery } from '$lib/library';
import { parseSort } from '$lib/sort';
import { getBooksForUser } from '$lib/server/books';
import { getLibraryCounts } from '$lib/server/library';
import { requireUser } from '$lib/server/users';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, locals }) => {
	const user = requireUser(locals);
	const filter = url.searchParams.get('filtre') ?? 'tous';
	const sort = parseSort(url.searchParams.get('tri'));
	const { q, needle } = parseQuery(url.searchParams.get('q'));
	const all = getBooksForUser(user.id)
		.map((book) => ({ ...book, authors: JSON.parse(book.authors) as string[] }))
		.filter((book) =>
			matchesQuery(needle, [book.title, book.seriesTitle, book.publisher, ...book.authors])
		);

	// Les compteurs portent sur le résultat de la recherche : les puces disent
	// combien de titres restent dans chaque catégorie.
	const counts = {
		tous: all.length,
		collection: all.filter((book) => book.inCollection).length,
		souhaits: all.filter((book) => book.wishlist).length,
		nonlus: all.filter((book) => book.readingStatus === 'unread').length,
		encours: all.filter((book) => book.readingStatus === 'reading').length,
		lus: all.filter((book) => book.readingStatus === 'read').length,
		favoris: all.filter((book) => book.favorite).length
	};

	const books = all.filter((book) => {
		if (filter === 'collection') return book.inCollection;
		if (filter === 'souhaits') return book.wishlist;
		if (filter === 'nonlus') return book.readingStatus === 'unread';
		if (filter === 'encours') return book.readingStatus === 'reading';
		if (filter === 'lus') return book.readingStatus === 'read';
		if (filter === 'favoris') return book.favorite;
		return true;
	});

	books.sort((a, b) =>
		sort === 'alpha'
			? a.title.localeCompare(b.title, 'fr')
			: b.addedAt.localeCompare(a.addedAt) || a.title.localeCompare(b.title, 'fr')
	);

	return { books, filter, sort, counts, q, libraryCounts: getLibraryCounts(user.id) };
};
