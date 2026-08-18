import { fail, redirect } from '@sveltejs/kit';
import { isbn13To10, normalizeIsbn } from '$lib/isbn';
import { searchBooks, type BookMetadata } from '$lib/server/book-metadata';
import { addOrUpdateBook, collectBook, collectBookFromSource } from '$lib/server/books';
import { requireUser } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (!q) return { q, results: [], error: null };
	try {
		return { q, results: await searchBooks(q), error: null };
	} catch {
		return { q, results: [], error: 'La recherche de livres est momentanément indisponible.' };
	}
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const user = requireUser(locals);
		const sourceId = String((await request.formData()).get('sourceId') ?? '');
		let book;
		try {
			book = await collectBookFromSource(user.id, sourceId);
		} catch {
			return fail(502, { error: 'Impossible de récupérer cette édition.' });
		}
		if (!book) return fail(404, { error: 'Aucune édition exploitable trouvée. Utilisez l’ajout manuel.' });
		redirect(303, `/livres/${book.id}`);
	},
	manual: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const title = String(data.get('title') ?? '').trim();
		if (!title) return fail(400, { error: 'Le titre est obligatoire.' });
		const rawIsbn = String(data.get('isbn') ?? '').trim();
		const isbn13 = rawIsbn ? normalizeIsbn(rawIsbn) : null;
		if (rawIsbn && !isbn13) return fail(400, { error: 'ISBN invalide.' });
		const metadata: BookMetadata = {
			isbn13,
			isbn10: isbn13 ? isbn13To10(isbn13) : null,
			title,
			subtitle: null,
			authors: String(data.get('authors') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
			description: null,
			publisher: String(data.get('publisher') ?? '').trim() || null,
			publishDate: String(data.get('publishDate') ?? '').trim() || null,
			language: 'fr',
			pageCount: null,
			coverUrl: null,
			seriesTitle: String(data.get('seriesTitle') ?? '').trim() || null,
			seriesUri: null,
			volume: String(data.get('volume') ?? '').trim() || null,
			source: 'manual',
			sourceId: null
		};
		const book = addOrUpdateBook(metadata);
		collectBook(user.id, book);
		redirect(303, `/livres/${book.id}`);
	}
};
