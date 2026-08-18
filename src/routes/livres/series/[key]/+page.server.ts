import { error, fail, redirect } from '@sveltejs/kit';
import {
	getBookSeries,
	getBookSeriesVolumes,
	type BookSeriesVolume
} from '$lib/server/book-metadata';
import { collectBookFromSource, getBooksForUser, getUserBookSeries } from '$lib/server/books';
import {
	compareVolumes,
	normalizeBookTitle,
	splitVolumeTitle,
	volumeNumber
} from '$lib/books';
import { requireUser } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

/**
 * Un tome tel qu'il s'affiche : soit un livre du profil, soit une entrée du
 * catalogue qu'il ne possède pas encore, soit les deux rapprochés.
 */
export interface SeriesVolumeView {
	key: string;
	title: string;
	volume: number | null;
	date: string | null;
	/** Œuvre du catalogue, pour ouvrir sa fiche et l'ajouter. */
	uri: string | null;
	/** Livre du profil, pour ouvrir sa fiche de bibliothèque. */
	bookId: number | null;
	readingStatus: string | null;
	inCollection: boolean;
	favorite: boolean;
}

type OwnedBook = ReturnType<typeof getBooksForUser>[number];

function ownedView(book: OwnedBook): SeriesVolumeView {
	return {
		key: `book:${book.id}`,
		title: book.title,
		volume: volumeNumber(book.volume) ?? splitVolumeTitle(book.title).volume,
		date: book.publishDate,
		uri: null,
		bookId: book.id,
		readingStatus: book.readingStatus,
		inCollection: book.inCollection,
		favorite: book.favorite
	};
}

/**
 * Rapproche les tomes du catalogue et ceux du profil par leur numéro : la
 * liste garde l'ordre de la série, chaque tome dit s'il est déjà là ou non.
 */
function mergeVolumes(catalogue: BookSeriesVolume[], owned: OwnedBook[]): SeriesVolumeView[] {
	const remaining = owned.map(ownedView);
	const merged = catalogue.map((volume) => {
		const index = remaining.findIndex((view) => view.volume !== null && view.volume === volume.volume);
		const own = index >= 0 ? remaining.splice(index, 1)[0] : null;
		return {
			...(own ?? {
				key: `work:${volume.uri}`,
				bookId: null,
				readingStatus: null,
				inCollection: false,
				favorite: false
			}),
			key: own ? own.key : `work:${volume.uri}`,
			// Le catalogue nomme et ordonne ; le profil dit ce qu'il en a.
			title: own?.title ?? volume.title,
			volume: volume.volume ?? own?.volume ?? null,
			date: volume.date ?? own?.date ?? null,
			uri: volume.uri
		};
	});
	// Les tomes possédés qu'aucun numéro ne rattache au catalogue restent listés.
	return [...merged, ...remaining.sort(compareVolumes)];
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const localId = /^\d+$/.test(params.key) ? Number(params.key) : null;

	let title: string;
	let description: string | null = null;
	let uri: string | null = null;
	let owned: OwnedBook[];

	if (localId) {
		const local = getUserBookSeries(user.id, localId);
		if (!local) error(404, 'Série introuvable');
		title = local.series.title;
		uri = local.series.externalId;
		owned = local.books;
	} else {
		const series = await getBookSeries(params.key).catch(() => null);
		if (!series) error(404, 'Série introuvable');
		title = series.title;
		description = series.description;
		uri = series.uri;
		// Les tomes déjà achetés sont rangés sous une série locale du même nom.
		const wanted = normalizeBookTitle(title);
		owned = getBooksForUser(user.id).filter(
			(book) => book.seriesTitle && normalizeBookTitle(book.seriesTitle) === wanted
		);
	}

	// Une panne du catalogue ne doit pas masquer les tomes déjà possédés.
	const catalogue = uri ? await getBookSeriesVolumes(uri).catch(() => []) : [];
	const volumes = catalogue.length ? mergeVolumes(catalogue, owned) : owned.map(ownedView).sort(compareVolumes);

	return {
		series: {
			id: localId ?? owned[0]?.seriesId ?? null,
			title,
			description,
			uri,
			catalogueUnavailable: Boolean(uri) && catalogue.length === 0
		},
		volumes,
		ownedCount: owned.length,
		readCount: owned.filter((book) => book.readingStatus === 'read').length
	};
};

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
		redirect(303, `/livres/${book.id}`);
	}
};
