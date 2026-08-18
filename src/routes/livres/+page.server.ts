import { parseSort } from '$lib/sort';
import { getBooksForUser } from '$lib/server/books';
import { requireUser } from '$lib/server/users';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, locals }) => {
	const filter = url.searchParams.get('filtre') ?? 'tous';
	const sort = parseSort(url.searchParams.get('tri'));
	const q = url.searchParams.get('q')?.trim().toLocaleLowerCase('fr') ?? '';
	const all = getBooksForUser(requireUser(locals).id);
	const counts = {
		tous: all.length,
		collection: all.filter((book) => book.inCollection).length,
		souhaits: all.filter((book) => book.wishlist).length,
		nonlus: all.filter((book) => book.readingStatus === 'unread').length,
		encours: all.filter((book) => book.readingStatus === 'reading').length,
		lus: all.filter((book) => book.readingStatus === 'read').length,
		pretes: all.filter((book) => book.loanedTo).length,
		favoris: all.filter((book) => book.favorite).length
	};
	let filtered = all.filter((book) => {
		if (filter === 'collection') return book.inCollection;
		if (filter === 'souhaits') return book.wishlist;
		if (filter === 'nonlus') return book.readingStatus === 'unread';
		if (filter === 'encours') return book.readingStatus === 'reading';
		if (filter === 'lus') return book.readingStatus === 'read';
		if (filter === 'pretes') return Boolean(book.loanedTo);
		if (filter === 'favoris') return book.favorite;
		return true;
	});
	if (q) {
		filtered = filtered.filter((book) =>
			[book.title, book.seriesTitle, book.publisher, ...(JSON.parse(book.authors) as string[])]
				.filter(Boolean)
				.some((value) => value!.toLocaleLowerCase('fr').includes(q))
		);
	}
	filtered.sort((a, b) =>
		sort === 'alpha'
			? a.title.localeCompare(b.title, 'fr')
			: b.addedAt.localeCompare(a.addedAt) || a.title.localeCompare(b.title, 'fr')
	);
	return {
		books: filtered.map((book) => ({ ...book, authors: JSON.parse(book.authors) as string[] })),
		filter,
		sort,
		q: url.searchParams.get('q')?.trim() ?? '',
		counts
	};
};
