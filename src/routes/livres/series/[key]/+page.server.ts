import { error, fail, redirect } from '@sveltejs/kit';
import {
	buildSeriesVolumes,
	collectWholeSeries,
	getSeriesVolumes,
	ownedOrdinal,
	pendingEnrichment,
	prepareSeries,
	refreshSeries,
	resolveSeries
} from '$lib/server/book-series';
import {
	collectBookFromSource,
	getBooksForUser,
	getUserSeriesState,
	updateUserBook,
	updateUserSeries
} from '$lib/server/books';
import { requireUser } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const found = await resolveSeries(params.key).catch(() => undefined);
	if (!found) error(404, 'Série introuvable');
	const series = await prepareSeries(found);

	const volumes = buildSeriesVolumes(user.id, series);
	const owned = volumes.filter((volume) => volume.bookId !== null);

	return {
		series: {
			id: series.id,
			title: series.title,
			description: series.description,
			authors: JSON.parse(series.authors) as string[],
			uri: series.externalId,
			volumeCount: series.volumeCount,
			catalogueUnavailable: Boolean(series.externalId) && getSeriesVolumes(series.id).length === 0
		},
		volumes,
		ownedCount: owned.length,
		readCount: owned.filter((volume) => volume.readingStatus === 'read').length,
		/** Tomes dont le résumé et la couverture arrivent encore en arrière-plan. */
		enriching: pendingEnrichment(series.id),
		userSeries: getUserSeriesState(user.id, series.id)
	};
};

/** La série de l'URL, ou une erreur : toutes les actions en partent. */
async function requireSeries(key: string) {
	const series = await resolveSeries(key).catch(() => undefined);
	if (!series) error(404, 'Série introuvable');
	return series;
}

/** Les tomes possédés par le profil dans cette série, avec leur numéro. */
function ownedVolumes(userId: number, seriesId: number) {
	return getBooksForUser(userId)
		.filter((book) => book.seriesId === seriesId)
		.map((book) => ({ book, ordinal: ownedOrdinal(book) }));
}

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const user = requireUser(locals);
		const sourceId = String((await request.formData()).get('sourceId') ?? '');
		if (!sourceId) return fail(400, { error: 'Tome inconnu.' });
		let book;
		try {
			book = await collectBookFromSource(user.id, sourceId);
		} catch {
			return fail(502, { error: 'Impossible de récupérer ce tome.' });
		}
		if (!book) return fail(404, { error: 'Aucune édition exploitable pour ce tome.' });
		return { ok: 'Tome ajouté à votre bibliothèque.' };
	},

	/** Toute la série d'un coup, pour une collection déjà complète en rayon. */
	addAll: async ({ params, locals }) => {
		const user = requireUser(locals);
		const series = await requireSeries(params.key);
		const added = collectWholeSeries(user.id, series);
		if (!added) return fail(400, { error: 'Tous les tomes connus sont déjà dans votre bibliothèque.' });
		return { ok: `${added} tome${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''} à votre bibliothèque.` };
	},

	// Même geste que cocher un épisode : un clic bascule l'état de lecture.
	toggleRead: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const bookId = Number(data.get('bookId'));
		const read = data.get('read') === '1';
		if (!bookId) return fail(400, { error: 'Tome inconnu.' });
		updateUserBook(user.id, bookId, { readingStatus: read ? 'read' : 'unread' });
	},

	/** « Lu jusqu'ici » : tous les tomes possédés jusqu'à celui-ci. */
	readUntil: async ({ params, request, locals }) => {
		const user = requireUser(locals);
		const series = await requireSeries(params.key);
		const upTo = Number((await request.formData()).get('ordinal'));
		if (!Number.isFinite(upTo)) return fail(400, { error: 'Tome inconnu.' });
		for (const { book, ordinal } of ownedVolumes(user.id, series.id)) {
			if (ordinal !== null && ordinal <= upTo && book.readingStatus !== 'read') {
				updateUserBook(user.id, book.id, { readingStatus: 'read' });
			}
		}
	},

	markAll: async ({ params, locals }) => {
		const user = requireUser(locals);
		const series = await requireSeries(params.key);
		for (const { book } of ownedVolumes(user.id, series.id)) {
			if (book.readingStatus !== 'read') updateUserBook(user.id, book.id, { readingStatus: 'read' });
		}
	},

	// Même contrat que les séries télé et les films : 1-10, 0 retire la note.
	rate: async ({ params, request, locals }) => {
		const user = requireUser(locals);
		const series = await requireSeries(params.key);
		const raw = Number((await request.formData()).get('rating'));
		updateUserSeries(user.id, series.id, {
			rating: Number.isInteger(raw) && raw >= 1 && raw <= 10 ? raw : null
		});
	},

	refresh: async ({ params, locals }) => {
		requireUser(locals);
		const series = await requireSeries(params.key);
		try {
			await refreshSeries(series.id);
		} catch {
			return fail(502, { error: 'Les catalogues sont momentanément indisponibles.' });
		}
		return { ok: 'Série rafraîchie.' };
	},

	/** Ouvre le premier tome non lu, comme « reprendre » une série télé. */
	resume: async ({ params, locals }) => {
		const user = requireUser(locals);
		const series = await requireSeries(params.key);
		const next = ownedVolumes(user.id, series.id)
			.filter(({ book }) => book.readingStatus !== 'read')
			.sort((a, b) => (a.ordinal ?? Infinity) - (b.ordinal ?? Infinity))[0];
		if (!next) return fail(404, { error: 'Tous les tomes de votre bibliothèque sont lus.' });
		redirect(303, `/livres/${next.book.id}`);
	}
};
