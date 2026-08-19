import { error, fail, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { books, bookSeries } from '$lib/server/db/schema';
import { getBookByIsbn } from '$lib/server/book-metadata';
import { addOrUpdateBook, getBookForUser, removeUserBook, updateUserBook } from '$lib/server/books';
import { getSeries, seriesNavigation, warmSeries } from '$lib/server/book-series';
import { requireUser } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

function idFromParam(value: string): number {
	const id = Number(value);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Livre introuvable');
	return id;
}

function requireBook(userId: number, value: string) {
	const book = getBookForUser(userId, idFromParam(value));
	if (!book) error(404, 'Livre introuvable');
	return book;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const user = requireUser(locals);
	const book = requireBook(user.id, params.id);
	// La serie se met a niveau en arriere-plan : cette page n'affiche qu'un
	// tome et n'a pas a attendre la liste complete pour s'ouvrir.
	const series = book.seriesId ? getSeries(book.seriesId) : undefined;
	if (series) warmSeries(series);
	return {
		book: { ...book, authors: JSON.parse(book.authors) as string[] },
		navigation: book.seriesId ? seriesNavigation(user.id, book.seriesId, { bookId: book.id }) : null
	};
};

export const actions: Actions = {
	status: async ({ params, request, locals }) => {
		const user = requireUser(locals);
		const book = requireBook(user.id, params.id);
		const status = String((await request.formData()).get('status'));
		if (!['unread', 'reading', 'read'].includes(status)) return fail(400, { error: 'Statut invalide.' });
		updateUserBook(user.id, book.id, { readingStatus: status });
	},
	flags: async ({ params, request, locals }) => {
		const user = requireUser(locals);
		const book = requireBook(user.id, params.id);
		const data = await request.formData();
		updateUserBook(user.id, book.id, {
			inCollection: data.get('inCollection') === '1',
			wishlist: data.get('wishlist') === '1',
			favorite: data.get('favorite') === '1'
		});
	},
	// Meme contrat que les films et les series : 1-10, 0 retire la note.
	rate: async ({ params, request, locals }) => {
		const user = requireUser(locals);
		const book = requireBook(user.id, params.id);
		const raw = Number((await request.formData()).get('rating'));
		updateUserBook(user.id, book.id, {
			rating: Number.isInteger(raw) && raw >= 1 && raw <= 10 ? raw : null
		});
	},
	edit: async ({ params, request, locals }) => {
		const user = requireUser(locals);
		const book = requireBook(user.id, params.id);
		const data = await request.formData();
		const title = String(data.get('title') ?? '').trim();
		if (!title) return fail(400, { error: 'Le titre est obligatoire.' });
		const seriesTitle = String(data.get('seriesTitle') ?? '').trim();
		let seriesId = book.seriesId;
		if (seriesTitle) {
			const existing = db.select().from(bookSeries).where(sql`lower(${bookSeries.title}) = lower(${seriesTitle})`).get();
			seriesId = existing?.id ?? db.insert(bookSeries).values({ title: seriesTitle }).returning().get().id;
		} else seriesId = null;
		db.update(books)
			.set({
				title,
				authors: JSON.stringify(String(data.get('authors') ?? '').split(',').map((value) => value.trim()).filter(Boolean)),
				publisher: String(data.get('publisher') ?? '').trim() || null,
				publishDate: String(data.get('publishDate') ?? '').trim() || null,
				volume: String(data.get('volume') ?? '').trim() || null,
				seriesId
			})
			.where(eq(books.id, book.id))
			.run();
		return { ok: 'Informations mises à jour.' };
	},
	refresh: async ({ params, locals }) => {
		const user = requireUser(locals);
		const book = requireBook(user.id, params.id);
		if (!book.isbn13) return fail(400, { error: 'Ce livre n’a pas d’ISBN.' });
		let metadata;
		try {
			metadata = await getBookByIsbn(book.isbn13);
		} catch {
			return fail(502, { error: 'Les catalogues bibliographiques sont momentanément indisponibles.' });
		}
		if (!metadata) return fail(404, { error: 'Aucune métadonnée trouvée.' });
		addOrUpdateBook(metadata, { volume: book.volume, numbering: book.numbering, price: book.price });
	},
	remove: async ({ params, locals }) => {
		const user = requireUser(locals);
		const book = requireBook(user.id, params.id);
		removeUserBook(user.id, book.id);
		redirect(303, '/livres');
	}
};
