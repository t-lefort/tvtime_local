import { eq } from 'drizzle-orm';
import { shouldGroupAsSeries, volumeNumber } from '$lib/books';
import { tmdbImg, yearOf } from '$lib/format';
import { formatVolumeRanges, type ShareItem, type ShareKind, type ShareList, type ShareSection } from '$lib/share';
import { getBooksForUser, type BookWithUser } from './books';
import { appToday } from './dates';
import { db } from './db';
import { userBookSeries } from './db/schema';
import { getMoviesWithWatch, getShowsWithProgress, type ShowState } from './queries';

const byTitle = (a: ShareItem, b: ShareItem) => a.title.localeCompare(b.title, 'fr');

/** Range les éléments dans l'ordre des sections et écarte les sections vides. */
function sectionsOf<T>(
	rows: T[],
	order: readonly { key: string; label: string }[],
	sectionOf: (row: T) => string,
	toItems: (rows: T[]) => ShareItem[]
): ShareSection[] {
	return order
		.map(({ key, label }) => ({
			label,
			items: toItems(rows.filter((row) => sectionOf(row) === key)).sort(byTitle)
		}))
		.filter((section) => section.items.length > 0);
}

const SHOW_SECTIONS: { key: ShowState; label: string }[] = [
	{ key: 'watching', label: 'En cours' },
	{ key: 'uptodate', label: 'À jour' },
	{ key: 'notstarted', label: 'Pas commencées' },
	{ key: 'finished', label: 'Terminées' },
	{ key: 'stopped', label: 'Arrêtées' }
];

function showSections(userId: number, filter: string): ShareSection[] {
	const shows = getShowsWithProgress(userId).filter((show) => {
		switch (filter) {
			case 'encours':
				return show.state === 'watching' || show.state === 'uptodate';
			case 'terminees':
				return show.state === 'finished';
			case 'favoris':
				return show.favorite;
			case 'notees':
				return show.rating !== null;
			default:
				return true;
		}
	});
	return sectionsOf(
		shows,
		SHOW_SECTIONS,
		(show) => show.state,
		(rows) =>
			rows.map((show) => ({
				title: show.name,
				detail: yearOf(show.firstAirDate) || null,
				image: tmdbImg(show.posterPath, 'w185'),
				rating: show.rating,
				favorite: show.favorite
			}))
	);
}

const MOVIE_SECTIONS = [
	{ key: 'vus', label: 'Vus' },
	{ key: 'avoir', label: 'À voir' },
	{ key: 'avenir', label: 'À venir' }
];

function movieSections(userId: number, filter: string): ShareSection[] {
	const today = appToday();
	const sectionOf = (movie: { watchCount: number; releaseDate: string | null }) =>
		movie.watchCount > 0
			? 'vus'
			: movie.releaseDate && movie.releaseDate > today
				? 'avenir'
				: 'avoir';
	const movies = getMoviesWithWatch(userId).filter((movie) => {
		switch (filter) {
			case 'vus':
				return movie.watchCount > 0;
			case 'avoir':
				return movie.watchCount === 0;
			case 'favoris':
				return movie.favorite;
			case 'notes':
				return movie.rating !== null;
			default:
				return true;
		}
	});
	return sectionsOf(movies, MOVIE_SECTIONS, sectionOf, (rows) =>
		rows.map((movie) => ({
			title: movie.title,
			detail: yearOf(movie.releaseDate) || null,
			image: tmdbImg(movie.posterPath, 'w185'),
			rating: movie.rating,
			favorite: movie.favorite
		}))
	);
}

const BOOK_SECTIONS = [
	{ key: 'read', label: 'Lus' },
	{ key: 'reading', label: 'En cours' },
	{ key: 'unread', label: 'À lire' },
	{ key: 'wishlist', label: 'Envies' }
];

/** Une envie qu'on ne possède pas encore n'est pas « à lire » sur l'étagère. */
function bookSectionOf(book: BookWithUser): string {
	if (book.wishlist && !book.inCollection) return 'wishlist';
	return book.readingStatus === 'read' || book.readingStatus === 'reading' ? book.readingStatus : 'unread';
}

function authorsOf(books: BookWithUser[]): string | null {
	const authors = [...new Set(books.flatMap((book) => JSON.parse(book.authors) as string[]))];
	if (!authors.length) return null;
	return authors.length > 2 ? `${authors.slice(0, 2).join(', ')}…` : authors.join(', ');
}

function bookSections(userId: number, filter: string): ShareSection[] {
	const all = getBooksForUser(userId);
	const books = all.filter((book) => {
		switch (filter) {
			case 'lus':
				return book.readingStatus === 'read';
			case 'encours':
				return book.readingStatus === 'reading';
			case 'alire':
				return bookSectionOf(book) === 'unread';
			case 'envies':
				return book.wishlist;
			case 'favoris':
				return book.favorite;
			default:
				return true;
		}
	});

	// Comme dans la bibliothèque, une série tient une ligne et ses tomes s'y
	// résument : « One Piece (tomes 1 à 50) » plutôt que cinquante lignes.
	// Le regroupement se décide sur tout ce que le profil possède de la série,
	// pas sur le seul filtre, pour qu'une série ne s'éclate pas selon l'onglet.
	const owned = new Map<number, number>();
	for (const book of all) {
		if (book.seriesId !== null) owned.set(book.seriesId, (owned.get(book.seriesId) ?? 0) + 1);
	}
	const seriesRatings = new Map(
		db
			.select({ seriesId: userBookSeries.seriesId, rating: userBookSeries.rating })
			.from(userBookSeries)
			.where(eq(userBookSeries.userId, userId))
			.all()
			.map((row) => [row.seriesId, row.rating])
	);
	const grouped = (book: BookWithUser) =>
		book.seriesId !== null &&
		shouldGroupAsSeries({ volumeCount: book.seriesVolumeCount, ownedCount: owned.get(book.seriesId) ?? 0 });

	return sectionsOf(books, BOOK_SECTIONS, bookSectionOf, (rows) => {
		const items: ShareItem[] = [];
		const series = new Map<number, BookWithUser[]>();
		for (const book of rows) {
			if (grouped(book)) {
				const volumes = series.get(book.seriesId!) ?? [];
				volumes.push(book);
				series.set(book.seriesId!, volumes);
				continue;
			}
			items.push({
				title: book.title,
				detail: authorsOf([book]),
				image: `/couvertures/${book.id}`,
				rating: book.rating,
				favorite: book.favorite
			});
		}
		for (const [seriesId, volumes] of series) {
			const first = [...volumes].sort(
				(a, b) => (volumeNumber(a.volume) ?? Infinity) - (volumeNumber(b.volume) ?? Infinity)
			)[0];
			items.push({
				title: first.seriesTitle ?? first.title,
				detail: [authorsOf(volumes), formatVolumeRanges(volumes.map((book) => volumeNumber(book.volume)))]
					.filter(Boolean)
					.join(' · '),
				image: `/couvertures/${first.id}`,
				rating: seriesRatings.get(seriesId) ?? null,
				favorite: volumes.some((book) => book.favorite)
			});
		}
		return items;
	});
}

/** Le catalogue d'un profil tel qu'il se partage : sections ordonnées, titres triés. */
export function getShareList(user: { id: number; name: string }, kind: ShareKind, filter: string): ShareList {
	const sections =
		kind === 'series'
			? showSections(user.id, filter)
			: kind === 'films'
				? movieSections(user.id, filter)
				: bookSections(user.id, filter);
	return { kind, owner: user.name, sections };
}
