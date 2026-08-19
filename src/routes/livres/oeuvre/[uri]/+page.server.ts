import { error, fail, redirect } from '@sveltejs/kit';
import { getBookByInventaireWork } from '$lib/server/book-metadata';
import { bookTitleKey, collectBookFromSource, collectedBookIds } from '$lib/server/books';
import { resolveSeries, seriesNavigation, warmSeries } from '$lib/server/book-series';
import { requireUser } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

/**
 * Fiche d'un tome du catalogue, avant tout ajout : le détail que la liste
 * d'une série ne montre pas (couverture, auteurs, éditeur, résumé) et le
 * bouton pour le faire entrer dans la bibliothèque.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const book = await getBookByInventaireWork(params.uri).catch(() => null);
	if (!book) error(404, 'Aucune édition exploitable pour cette œuvre');
	const owned = collectedBookIds(user.id);
	// La serie du tome, pour le situer et permettre d'aller au precedent ou au
	// suivant sans repasser par sa liste.
	const series = book.seriesUri ? await resolveSeries(book.seriesUri).catch(() => undefined) : undefined;
	if (series) warmSeries(series);
	return {
		uri: params.uri,
		book,
		navigation: series ? seriesNavigation(user.id, series.id, { uri: params.uri }) : null,
		localId:
			(book.isbn13 ? owned.get(`isbn:${book.isbn13}`) : undefined) ??
			(book.sourceId ? owned.get(book.sourceId) : undefined) ??
			owned.get(bookTitleKey(book.title)) ??
			null
	};
};

export const actions: Actions = {
	add: async ({ params, locals }) => {
		const user = requireUser(locals);
		let book;
		try {
			book = await collectBookFromSource(user.id, params.uri);
		} catch {
			return fail(502, { error: 'Impossible de récupérer cette édition.' });
		}
		if (!book) return fail(404, { error: 'Aucune édition exploitable pour cette œuvre.' });
		redirect(303, `/livres/${book.id}`);
	}
};
