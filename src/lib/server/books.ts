import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { books, bookSeries, userBooks, userBookSeries, type Book } from './db/schema';
import { getBookByInventaireWork, getBookByIsbn, type BookMetadata } from './book-metadata';

export interface StoreBookOptions {
	seriesType?: string | null;
	collection?: string | null;
	category?: string | null;
	volume?: string | null;
	numbering?: string | null;
	price?: number | null;
}

export interface CollectBookOptions {
	addedAt?: string | null;
	inCollection?: boolean;
	wishlist?: boolean;
	readingStatus?: 'unread' | 'reading' | 'read';
	favorite?: boolean;
	rating?: number | null;
	review?: string | null;
	signed?: boolean;
	originalEdition?: boolean;
	deluxe?: boolean;
	limitedSeries?: boolean;
	digital?: boolean;
	forSale?: boolean;
	purchasePrice?: number | null;
	estimatedValue?: number | null;
	condition?: string | null;
	seriesRating?: number | null;
	seriesReview?: string | null;
}

function normalizeTitle(value: string): string {
	return value.trim().replace(/\s+/g, ' ');
}

function findOrCreateSeries(metadata: BookMetadata, opts: StoreBookOptions): number | null {
	const title = metadata.seriesTitle?.trim();
	if (!title) return null;
	let series = db
		.select()
		.from(bookSeries)
		.where(sql`lower(${bookSeries.title}) = lower(${title})`)
		.get();
	if (!series) {
		series = db
			.insert(bookSeries)
			.values({
				title,
				type: opts.seriesType ?? null,
				collection: opts.collection ?? null,
				category: opts.category ?? null,
				externalSource: metadata.source,
				externalId: null,
				lastSyncedAt: sql`(datetime('now'))` as unknown as string
			})
			.returning()
			.get();
	} else if (opts.seriesType || opts.collection || opts.category) {
		db.update(bookSeries)
			.set({
				type: opts.seriesType ?? series.type,
				collection: opts.collection ?? series.collection,
				category: opts.category ?? series.category
			})
			.where(eq(bookSeries.id, series.id))
			.run();
	}
	return series.id;
}

/** Stocke une edition partagee et preserve les champs locaux absents de la source. */
export function addOrUpdateBook(metadata: BookMetadata, opts: StoreBookOptions = {}): Book {
	const seriesId = findOrCreateSeries(metadata, opts);
	const existing = metadata.isbn13
		? db.select().from(books).where(eq(books.isbn13, metadata.isbn13)).get()
		: metadata.sourceId
			? db
					.select()
					.from(books)
					.where(and(eq(books.externalSource, metadata.source), eq(books.externalId, metadata.sourceId)))
					.get()
			: undefined;
	const values = {
		seriesId,
		isbn13: metadata.isbn13,
		isbn10: metadata.isbn10,
		externalSource: metadata.source,
		externalId: metadata.sourceId,
		title: normalizeTitle(metadata.title),
		subtitle: metadata.subtitle,
		authors: JSON.stringify(metadata.authors),
		description: metadata.description,
		publisher: metadata.publisher,
		publishDate: metadata.publishDate,
		language: metadata.language,
		pageCount: metadata.pageCount,
		coverUrl: metadata.coverUrl,
		volume: opts.volume ?? metadata.volume,
		numbering: opts.numbering ?? null,
		price: opts.price ?? null,
		lastSyncedAt: sql`(datetime('now'))` as unknown as string
	};
	if (!existing) return db.insert(books).values(values).returning().get();
	return db
		.update(books)
		.set({
			...values,
			seriesId: seriesId ?? existing.seriesId,
			subtitle: metadata.subtitle ?? existing.subtitle,
			description: metadata.description ?? existing.description,
			publisher: metadata.publisher ?? existing.publisher,
			publishDate: metadata.publishDate ?? existing.publishDate,
			language: metadata.language ?? existing.language,
			pageCount: metadata.pageCount ?? existing.pageCount,
			coverUrl: metadata.coverUrl ?? existing.coverUrl,
			volume: opts.volume ?? metadata.volume ?? existing.volume,
			numbering: opts.numbering ?? existing.numbering,
			price: opts.price ?? existing.price
		})
		.where(eq(books.id, existing.id))
		.returning()
		.get();
}

export function collectBook(userId: number, book: Book, opts: CollectBookOptions = {}): void {
	const existing = db
		.select()
		.from(userBooks)
		.where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, book.id)))
		.get();
	const values = {
		userId,
		bookId: book.id,
		...(opts.addedAt ? { addedAt: opts.addedAt } : {}),
		inCollection: opts.inCollection ?? true,
		wishlist: opts.wishlist ?? false,
		readingStatus: opts.readingStatus ?? 'unread',
		favorite: opts.favorite ?? false,
		rating: opts.rating ?? null,
		review: opts.review ?? null,
		signed: opts.signed ?? false,
		originalEdition: opts.originalEdition ?? false,
		deluxe: opts.deluxe ?? false,
		limitedSeries: opts.limitedSeries ?? false,
		digital: opts.digital ?? false,
		forSale: opts.forSale ?? false,
		purchasePrice: opts.purchasePrice ?? null,
		estimatedValue: opts.estimatedValue ?? null,
		condition: opts.condition ?? null
	};
	if (!existing) {
		db.insert(userBooks).values(values).onConflictDoNothing().run();
	} else {
		const updates: Partial<typeof userBooks.$inferInsert> = {};
		if (opts.addedAt) updates.addedAt = opts.addedAt;
		if (opts.inCollection !== undefined) updates.inCollection = opts.inCollection;
		if (opts.wishlist !== undefined) updates.wishlist = opts.wishlist;
		if (opts.readingStatus !== undefined) updates.readingStatus = opts.readingStatus;
		if (opts.favorite !== undefined) updates.favorite = opts.favorite;
		if (opts.rating !== undefined) updates.rating = opts.rating;
		if (opts.review !== undefined) updates.review = opts.review;
		if (opts.signed !== undefined) updates.signed = opts.signed;
		if (opts.originalEdition !== undefined) updates.originalEdition = opts.originalEdition;
		if (opts.deluxe !== undefined) updates.deluxe = opts.deluxe;
		if (opts.limitedSeries !== undefined) updates.limitedSeries = opts.limitedSeries;
		if (opts.digital !== undefined) updates.digital = opts.digital;
		if (opts.forSale !== undefined) updates.forSale = opts.forSale;
		if (opts.purchasePrice !== undefined) updates.purchasePrice = opts.purchasePrice;
		if (opts.estimatedValue !== undefined) updates.estimatedValue = opts.estimatedValue;
		if (opts.condition !== undefined) updates.condition = opts.condition;
		if (Object.keys(updates).length) db.update(userBooks).set(updates).where(eq(userBooks.id, existing.id)).run();
	}
	if (book.seriesId) {
		const existingSeries = db
			.select()
			.from(userBookSeries)
			.where(and(eq(userBookSeries.userId, userId), eq(userBookSeries.seriesId, book.seriesId)))
			.get();
		if (!existingSeries) {
			db.insert(userBookSeries)
				.values({
					userId,
					seriesId: book.seriesId,
					rating: opts.seriesRating ?? null,
					review: opts.seriesReview ?? null
				})
				.onConflictDoNothing()
				.run();
		} else if (opts.seriesRating !== undefined || opts.seriesReview !== undefined) {
			db.update(userBookSeries)
				.set({
					...(opts.seriesRating !== undefined ? { rating: opts.seriesRating } : {}),
					...(opts.seriesReview !== undefined ? { review: opts.seriesReview } : {})
				})
				.where(eq(userBookSeries.id, existingSeries.id))
				.run();
		}
	}
}

export interface BookWithUser extends Book {
	seriesTitle: string | null;
	seriesType: string | null;
	category: string | null;
	addedAt: string;
	inCollection: boolean;
	wishlist: boolean;
	readingStatus: string;
	favorite: boolean;
	rating: number | null;
	review: string | null;
	signed: boolean;
	originalEdition: boolean;
	deluxe: boolean;
	limitedSeries: boolean;
	digital: boolean;
	forSale: boolean;
	purchasePrice: number | null;
	estimatedValue: number | null;
	condition: string | null;
}

/**
 * Ajoute au profil l'edition designee par un resultat de recherche
 * bibliographique (`isbn:...` ou URI d'oeuvre Inventaire). Partage par la
 * recherche generale et par la page d'ajout de livre.
 */
export async function collectBookFromSource(userId: number, sourceId: string): Promise<Book | null> {
	const metadata = sourceId.startsWith('isbn:')
		? await getBookByIsbn(sourceId.slice(5))
		: await getBookByInventaireWork(sourceId);
	if (!metadata) return null;
	const book = addOrUpdateBook(metadata);
	collectBook(userId, book);
	return book;
}

/**
 * Index des livres deja dans la bibliotheque du profil, pour marquer les
 * resultats de recherche. L'ISBN et l'identifiant de source sont fiables ;
 * le titre normalise rattrape les oeuvres Inventaire, dont l'URI de recherche
 * differe de celle de l'edition stockee.
 */
export function collectedBookIds(userId: number): Map<string, number> {
	const rows = db
		.select({
			id: books.id,
			isbn13: books.isbn13,
			externalId: books.externalId,
			title: books.title
		})
		.from(userBooks)
		.innerJoin(books, eq(books.id, userBooks.bookId))
		.where(eq(userBooks.userId, userId))
		.all();
	const index = new Map<string, number>();
	for (const row of rows) {
		if (row.isbn13) index.set(`isbn:${row.isbn13}`, row.id);
		if (row.externalId) index.set(row.externalId, row.id);
		index.set(bookTitleKey(row.title), row.id);
	}
	return index;
}

/** Cle de rapprochement d'un livre par son titre, insensible a la casse. */
export function bookTitleKey(title: string): string {
	return `title:${normalizeTitle(title).toLocaleLowerCase('fr')}`;
}

export function getBooksForUser(userId: number): BookWithUser[] {
	const rows = db.all<Record<string, unknown>>(sql`
		SELECT b.id, b.series_id AS seriesId, b.isbn13, b.isbn10,
			b.external_source AS externalSource, b.external_id AS externalId,
			b.title, b.subtitle, b.authors, b.description, b.publisher,
			b.publish_date AS publishDate, b.language, b.page_count AS pageCount,
			b.cover_url AS coverUrl, b.volume, b.numbering, b.price,
			b.last_synced_at AS lastSyncedAt,
			bs.title AS seriesTitle, bs.type AS seriesType, bs.category,
			ub.added_at AS addedAt, ub.in_collection AS inCollection, ub.wishlist,
			ub.reading_status AS readingStatus, ub.favorite, ub.rating, ub.review,
			ub.signed, ub.original_edition AS originalEdition,
			ub.deluxe, ub.limited_series AS limitedSeries, ub.digital, ub.for_sale AS forSale,
			ub.purchase_price AS purchasePrice, ub.estimated_value AS estimatedValue,
			ub.condition
		FROM user_books ub
		JOIN books b ON b.id = ub.book_id
		LEFT JOIN book_series bs ON bs.id = b.series_id
		WHERE ub.user_id = ${userId}
	`);
	return rows.map((row) => ({
		...(row as unknown as BookWithUser),
		inCollection: Boolean(row.inCollection),
		wishlist: Boolean(row.wishlist),
		favorite: Boolean(row.favorite),
		signed: Boolean(row.signed),
		originalEdition: Boolean(row.originalEdition),
		deluxe: Boolean(row.deluxe),
		limitedSeries: Boolean(row.limitedSeries),
		digital: Boolean(row.digital),
		forSale: Boolean(row.forSale)
	}));
}

export function getBookForUser(userId: number, bookId: number): BookWithUser | undefined {
	return getBooksForUser(userId).find((book) => book.id === bookId);
}

export function updateUserBook(userId: number, bookId: number, values: Partial<typeof userBooks.$inferInsert>): void {
	db.update(userBooks)
		.set(values)
		.where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
		.run();
}

export function removeUserBook(userId: number, bookId: number): void {
	const book = db.select().from(books).where(eq(books.id, bookId)).get();
	db.delete(userBooks).where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId))).run();
	db.run(sql`DELETE FROM books WHERE id = ${bookId} AND NOT EXISTS (SELECT 1 FROM user_books WHERE book_id = ${bookId})`);
	if (book?.seriesId) {
		db.run(sql`
			DELETE FROM user_book_series
			WHERE user_id = ${userId} AND series_id = ${book.seriesId}
				AND NOT EXISTS (
					SELECT 1 FROM user_books ub JOIN books b ON b.id = ub.book_id
					WHERE ub.user_id = ${userId} AND b.series_id = ${book.seriesId}
				)
		`);
		db.run(sql`DELETE FROM book_series WHERE id = ${book.seriesId} AND NOT EXISTS (SELECT 1 FROM books WHERE series_id = ${book.seriesId})`);
	}
}
