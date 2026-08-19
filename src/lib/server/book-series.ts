import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from './db';
import { bookSeries, bookSeriesVolumes, type BookSeries, type BookSeriesVolume } from './db/schema';
import {
	findSeriesUriByTitle,
	getBookSeries,
	getBookSeriesVolumes,
	seriesUriFromSourceId,
	type BookSeriesVolume as CatalogueVolume
} from './book-metadata';
import { googleVolumeOfSeries, GoogleBooksUnavailable } from './google-books';
import { getBooksForUser } from './books';
import {
	bestDescription,
	compareVolumes,
	formatVolumeLabel,
	splitVolumeTitle,
	volumeNumber
} from '$lib/books';

/**
 * Une série de livres et ses tomes, gardés en base plutôt que redemandés aux
 * catalogues à chaque affichage.
 *
 * Deux sources se partagent le travail, parce qu'aucune ne fait les deux :
 * Inventaire sait *qu'une* série existe, combien elle compte de tomes et dans
 * quel ordre ; Google Books sait *ce qu'est* un tome — son titre propre, son
 * résumé, sa couverture. Une fois rapprochées ici, la page d'une série
 * s'affiche d'un coup, comme celle d'une série télé, sans dépendre de la
 * disponibilité ni de la lenteur des deux.
 */

/** Au-delà, on redemande au catalogue si la série a gagné des tomes. */
const SKELETON_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Tomes décrits par passe : le quota Google Books est vite atteint. */
const ENRICH_BATCH = 12;

function nowIso(): string {
	return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function olderThan(value: string | null, ms: number): boolean {
	if (!value) return true;
	const at = Date.parse(value.replace(' ', 'T') + (value.endsWith('Z') ? '' : 'Z'));
	return Number.isNaN(at) || Date.now() - at > ms;
}

/**
 * La série locale correspondant à une clé d'URL : un identifiant de base, ou
 * l'URI d'un catalogue. Une série consultée depuis la recherche est créée à
 * cette occasion — c'est elle qui portera ensuite ses tomes et son cache, que
 * le profil en possède ou non.
 */
export async function resolveSeries(key: string): Promise<BookSeries | undefined> {
	if (/^\d+$/.test(key)) return db.select().from(bookSeries).where(eq(bookSeries.id, Number(key))).get();
	const uri = seriesUriFromSourceId(key) ?? seriesUriFromSourceId(`serie:${key}`);
	if (!uri) return undefined;
	const known = db.select().from(bookSeries).where(eq(bookSeries.externalId, uri)).get();
	if (known) return known;
	// Le titre avant la creation : les tomes deja achetes sont ranges sous une
	// serie locale du meme nom, et deux lignes pour une meme serie separeraient
	// la bibliotheque du catalogue.
	const info = await getBookSeries(uri).catch(() => null);
	const title = info?.title ?? uri;
	const sameName = db
		.select()
		.from(bookSeries)
		.where(sql`lower(${bookSeries.title}) = lower(${title}) AND ${bookSeries.externalId} IS NULL`)
		.get();
	if (sameName) {
		db.update(bookSeries)
			.set({ externalSource: 'inventaire', externalId: uri, description: bestDescription(info?.description, sameName.description) })
			.where(eq(bookSeries.id, sameName.id))
			.run();
		return db.select().from(bookSeries).where(eq(bookSeries.id, sameName.id)).get();
	}
	return db
		.insert(bookSeries)
		.values({
			title,
			description: bestDescription(info?.description),
			externalSource: 'inventaire',
			externalId: uri
		})
		.returning()
		.get();
}

/** Rattache une série locale à son entrée de catalogue, quand elle n'en avait pas. */
export function linkSeriesToCatalogue(seriesId: number, uri: string, source = 'inventaire'): void {
	db.update(bookSeries)
		.set({ externalId: uri, externalSource: source })
		.where(and(eq(bookSeries.id, seriesId), isNull(bookSeries.externalId)))
		.run();
}

/** Les tomes d'une série tels qu'ils sont en base, dans l'ordre de la série. */
export function getSeriesVolumes(seriesId: number): BookSeriesVolume[] {
	return db
		.select()
		.from(bookSeriesVolumes)
		.where(eq(bookSeriesVolumes.seriesId, seriesId))
		.all()
		.sort((a, b) => compareVolumes({ volume: a.ordinal, title: a.title }, { volume: b.ordinal, title: b.title }));
}

/**
 * Écrit l'ossature renvoyée par le catalogue sans perdre l'enrichissement déjà
 * acquis : un tome se reconnaît à son numéro, ou à son URI quand la série ne
 * le numérote pas.
 */
function storeSkeleton(seriesId: number, catalogue: CatalogueVolume[]): void {
	const existing = getSeriesVolumes(seriesId);
	const byOrdinal = new Map(existing.filter((row) => row.ordinal !== null).map((row) => [row.ordinal, row]));
	const byUri = new Map(existing.filter((row) => row.sourceUri).map((row) => [row.sourceUri, row]));
	const seen = new Set<number>();
	for (const volume of catalogue) {
		const match = (volume.volume !== null ? byOrdinal.get(volume.volume) : undefined) ?? byUri.get(volume.uri);
		if (match) {
			seen.add(match.id);
			db.update(bookSeriesVolumes)
				.set({
					ordinal: volume.volume ?? match.ordinal,
					sourceUri: match.sourceUri ?? volume.uri,
					// Le titre décrit par Google Books ne se laisse pas réécrire
					// par le libellé approximatif du catalogue.
					title: match.enrichedAt ? match.title : volume.title,
					publishDate: match.publishDate ?? volume.date,
					lastSyncedAt: nowIso()
				})
				.where(eq(bookSeriesVolumes.id, match.id))
				.run();
			continue;
		}
		const inserted = db
			.insert(bookSeriesVolumes)
			.values({
				seriesId,
				ordinal: volume.volume,
				sourceUri: volume.uri,
				title: volume.title,
				publishDate: volume.date,
				lastSyncedAt: nowIso()
			})
			.onConflictDoNothing()
			.returning()
			.get();
		if (inserted) seen.add(inserted.id);
	}
	// Un tome que le catalogue ne connaît plus disparaît, sauf s'il tenait tout
	// seul (saisi à la main, ajouté par un import) : on ne supprime que ce qu'on
	// avait soi-même écrit depuis ce catalogue.
	for (const row of existing) {
		if (!seen.has(row.id) && row.sourceUri) {
			db.delete(bookSeriesVolumes).where(eq(bookSeriesVolumes.id, row.id)).run();
		}
	}
}

/** Va chercher l'ossature de la série chez Inventaire et l'écrit en base. */
export async function syncSeriesSkeleton(series: BookSeries): Promise<void> {
	const uri = series.externalId;
	if (!uri) return;
	const [info, catalogue] = await Promise.all([
		getBookSeries(uri).catch(() => null),
		getBookSeriesVolumes(uri).catch(() => [] as CatalogueVolume[])
	]);
	if (catalogue.length) storeSkeleton(series.id, catalogue);
	db.update(bookSeries)
		.set({
			// L'URI a pu servir de titre provisoire à la création de la série.
			title: info?.title ?? (series.title === uri ? uri : series.title),
			description: bestDescription(info?.description, series.description),
			volumeCount: catalogue.length || series.volumeCount,
			lastSyncedAt: nowIso()
		})
		.where(eq(bookSeries.id, series.id))
		.run();
}

/**
 * Fait décrire par Google Books les tomes qui ne le sont pas encore. Un tome
 * paru ne change plus : une fois décrit, on n'y revient jamais.
 */
export async function enrichSeriesVolumes(seriesId: number, budget = ENRICH_BATCH): Promise<number> {
	const series = db.select().from(bookSeries).where(eq(bookSeries.id, seriesId)).get();
	if (!series) return 0;
	const pending = getSeriesVolumes(seriesId)
		.filter((volume) => !volume.enrichedAt && volume.ordinal !== null)
		.slice(0, budget);
	let enriched = 0;
	let authors: string[] = [];
	for (const volume of pending) {
		let found;
		try {
			found = await googleVolumeOfSeries(series.title, volume.ordinal as number);
		} catch (error) {
			// Google est tombé : inutile de marquer ces tomes comme décrits, ni
			// d'insister sur les suivants. La passe suivante les reprendra.
			if (error instanceof GoogleBooksUnavailable) break;
			throw error;
		}
		if (found?.authors.length && !authors.length) authors = found.authors;
		db.update(bookSeriesVolumes)
			.set({
				// Marquer même l'absence de résultat : une série que Google ne
				// connaît pas serait sinon réinterrogée à chaque affichage.
				enrichedAt: nowIso(),
				...(found
					? {
							title: found.title,
							subtitle: found.subtitle,
							description: found.description,
							isbn13: found.isbn13 ?? volume.isbn13,
							coverUrl: found.coverUrl ?? volume.coverUrl,
							publisher: found.publisher,
							publishDate: found.publishDate ?? volume.publishDate,
							pageCount: found.pageCount
						}
					: {})
			})
			.where(eq(bookSeriesVolumes.id, volume.id))
			.run();
		if (found) enriched += 1;
	}
	if (enriched) {
		// La couverture et les auteurs de la série sont ceux de son premier tome décrit.
		const first = getSeriesVolumes(seriesId).find((volume) => volume.coverUrl);
		const updates: Partial<typeof bookSeries.$inferInsert> = {};
		if (first?.coverUrl && !series.coverUrl) updates.coverUrl = first.coverUrl;
		if (authors.length && series.authors === '[]') updates.authors = JSON.stringify(authors);
		if (Object.keys(updates).length) {
			db.update(bookSeries).set(updates).where(eq(bookSeries.id, seriesId)).run();
		}
	}
	return enriched;
}

/** Enrichissements déjà lancés, pour qu'un rafraîchissement de page ne les double pas. */
const running = new Set<number>();

/** Ossatures déjà en cours de récupération, pour la même raison. */
const syncing = new Set<number>();

/** Combien de tomes attendent encore d'être décrits. */
export function pendingEnrichment(seriesId: number): number {
	const row = db.get<{ n: number }>(sql`
		SELECT COUNT(*) AS n FROM book_series_volumes
		WHERE series_id = ${seriesId} AND enriched_at IS NULL AND ordinal IS NOT NULL
	`);
	return row?.n ?? 0;
}

/**
 * Poursuit l'enrichissement en tâche de fond. La page n'attend pas : elle
 * affiche déjà les tomes avec leur rang, et gagne leur titre et leur résumé au
 * fil des consultations suivantes.
 */
export function enrichInBackground(seriesId: number): void {
	if (running.has(seriesId) || !pendingEnrichment(seriesId)) return;
	running.add(seriesId);
	void enrichSeriesVolumes(seriesId)
		.catch((error) => console.error(`[livres] enrichissement de la série ${seriesId} :`, error))
		.finally(() => running.delete(seriesId));
}

/** L'ossature doit-elle être (re)demandée au catalogue ? */
function skeletonStale(series: BookSeries): boolean {
	if (!series.externalId) return olderThan(series.lastSyncedAt, SKELETON_TTL_MS);
	return !getSeriesVolumes(series.id).length || olderThan(series.lastSyncedAt, SKELETON_TTL_MS);
}

/**
 * Rattache au catalogue une série qui n'y est pas encore, en la cherchant par
 * son nom. Une série née d'un code-barres arrive sans rattachement — Google
 * Books ignore les séries — et resterait une coquille vide : un seul tome, pas
 * de liste, pas de tome suivant. La date de synchronisation s'écrit même en cas
 * d'échec, pour ne pas réinterroger le catalogue à chaque affichage.
 */
async function ensureCatalogueLink(series: BookSeries): Promise<BookSeries> {
	if (series.externalId) return series;
	const uri = await findSeriesUriByTitle(series.title).catch(() => null);
	db.update(bookSeries)
		.set({
			...(uri ? { externalId: uri, externalSource: 'inventaire' } : {}),
			lastSyncedAt: nowIso()
		})
		.where(eq(bookSeries.id, series.id))
		.run();
	return getSeries(series.id) ?? series;
}

function syncInBackground(series: BookSeries): void {
	if (syncing.has(series.id)) return;
	syncing.add(series.id);
	void ensureCatalogueLink(series)
		.then((linked) => syncSeriesSkeleton(linked))
		.then(() => enrichInBackground(series.id))
		.catch((error) => console.error(`[livres] synchronisation de la série ${series.id} :`, error))
		.finally(() => syncing.delete(series.id));
}

/**
 * Prépare une série pour l'affichage : la première consultation attend
 * l'ossature du catalogue, faute de quoi il n'y aurait rien à montrer ; les
 * suivantes lisent la base et ne rafraîchissent qu'en arrière-plan.
 */
export async function prepareSeries(series: BookSeries): Promise<BookSeries> {
	if (skeletonStale(series)) {
		if (!getSeriesVolumes(series.id).length && !syncing.has(series.id)) {
			syncing.add(series.id);
			await ensureCatalogueLink(series)
				.then((linked) => syncSeriesSkeleton(linked))
				.catch(() => undefined)
				.finally(() => syncing.delete(series.id));
		} else syncInBackground(series);
	}
	enrichInBackground(series.id);
	return getSeries(series.id) ?? series;
}

/**
 * Met une série à niveau sans faire attendre : une page qui n'en montre qu'un
 * tome n'a pas à payer le prix d'une liste de trois cents.
 */
export function warmSeries(series: BookSeries): void {
	if (skeletonStale(series)) syncInBackground(series);
	else enrichInBackground(series.id);
}

/** La série locale d'un identifiant, sans passer par les catalogues. */
export function getSeries(seriesId: number): BookSeries | undefined {
	return db.select().from(bookSeries).where(eq(bookSeries.id, seriesId)).get();
}

/** Force une remise à niveau complète, depuis le bouton de rafraîchissement. */
export async function refreshSeries(seriesId: number): Promise<void> {
	const series = db.select().from(bookSeries).where(eq(bookSeries.id, seriesId)).get();
	if (!series) return;
	await syncSeriesSkeleton(series);
	await enrichSeriesVolumes(seriesId);
}

// ---------------------------------------------------------------------------
// Vue d'une série : le catalogue et la bibliothèque du profil rapprochés.
// Partagée par la page de la série et par la navigation d'un tome à l'autre,
// pour que « le tome suivant » soit exactement le suivant de la liste affichée.
// ---------------------------------------------------------------------------

/**
 * Un tome tel qu'il s'affiche : soit une entrée du catalogue, soit un livre du
 * profil, soit les deux rapprochés — comme un épisode qui sait s'il a été vu.
 */
export interface SeriesVolumeView {
	key: string;
	/** « Tome 51 », identique d'une ligne à l'autre quoi qu'en dise le catalogue. */
	label: string;
	/** « Les onze supernovae », quand le tome porte un titre à lui. */
	title: string | null;
	ordinal: number | null;
	date: string | null;
	/** Ce que l'ajout au profil désigne : un ISBN, sinon l'œuvre du catalogue. */
	sourceId: string | null;
	/** Fiche du catalogue, avant tout achat. */
	uri: string | null;
	/** Vignette : celle du livre possédé, sinon celle du tome au catalogue. */
	bookId: number | null;
	volumeId: number | null;
	readingStatus: string | null;
	inCollection: boolean;
	wishlist: boolean;
	favorite: boolean;
}

type OwnedBook = ReturnType<typeof getBooksForUser>[number];

/** Le numéro d'un tome possédé, tel que le catalogue ou son titre l'écrivent. */
export function ownedOrdinal(book: OwnedBook): number | null {
	return volumeNumber(book.volume) ?? splitVolumeTitle(book.title).volume;
}

function ownedView(book: OwnedBook): SeriesVolumeView {
	const { label, title } = formatVolumeLabel({
		seriesTitle: book.seriesTitle,
		title: book.title,
		subtitle: book.subtitle,
		volume: book.volume
	});
	return {
		key: `book:${book.id}`,
		label,
		title,
		ordinal: ownedOrdinal(book),
		date: book.publishDate,
		sourceId: null,
		uri: null,
		bookId: book.id,
		volumeId: null,
		readingStatus: book.readingStatus,
		inCollection: book.inCollection,
		wishlist: book.wishlist,
		favorite: book.favorite
	};
}

/**
 * Les tomes d'une série dans l'ordre, chacun disant si le profil le possède.
 * Le catalogue nomme et ordonne, la bibliothèque dit ce qu'elle en a : on les
 * rapproche par le numéro de tome, comme un épisode et son visionnage.
 */
export function buildSeriesVolumes(userId: number, series: BookSeries): SeriesVolumeView[] {
	const remaining = getBooksForUser(userId)
		.filter((book) => book.seriesId === series.id)
		.map(ownedView);
	const volumes: SeriesVolumeView[] = getSeriesVolumes(series.id).map((volume) => {
		const index = remaining.findIndex((view) => view.ordinal !== null && view.ordinal === volume.ordinal);
		const own = index >= 0 ? remaining.splice(index, 1)[0] : null;
		const { label, title } = formatVolumeLabel({
			seriesTitle: series.title,
			title: volume.title,
			subtitle: volume.subtitle,
			volume: volume.ordinal
		});
		return {
			key: own ? own.key : `tome:${volume.id}`,
			label,
			// Le catalogue nomme le tome ; à défaut, l'édition qu'on en possède
			// le nomme aussi bien, et souvent mieux.
			title: title ?? own?.title ?? null,
			ordinal: volume.ordinal,
			date: volume.publishDate ?? own?.date ?? null,
			sourceId: volume.isbn13 ? `isbn:${volume.isbn13}` : volume.sourceUri,
			uri: volume.sourceUri,
			bookId: own?.bookId ?? null,
			volumeId: volume.id,
			readingStatus: own?.readingStatus ?? null,
			inCollection: own?.inCollection ?? false,
			wishlist: own?.wishlist ?? false,
			favorite: own?.favorite ?? false
		};
	});
	// Un tome possédé qu'aucun numéro ne rattache au catalogue reste listé.
	volumes.push(...remaining.sort((a, b) => (a.ordinal ?? Infinity) - (b.ordinal ?? Infinity)));
	return volumes;
}

/** Où mène un tome : sa fiche de bibliothèque, sinon celle du catalogue. */
export function volumeHref(volume: SeriesVolumeView): string | null {
	if (volume.bookId) return `/livres/${volume.bookId}`;
	return volume.uri ? `/livres/oeuvre/${encodeURIComponent(volume.uri)}` : null;
}

/** Le tome précédent et le suivant, tels qu'un lien peut les annoncer. */
export interface VolumeNeighbour {
	label: string;
	title: string | null;
	href: string;
	owned: boolean;
}

export interface SeriesNavigation {
	seriesId: number;
	seriesTitle: string;
	seriesHref: string;
	prev: VolumeNeighbour | null;
	next: VolumeNeighbour | null;
}

function neighbour(volume: SeriesVolumeView | undefined): VolumeNeighbour | null {
	if (!volume) return null;
	const href = volumeHref(volume);
	return href ? { label: volume.label, title: volume.title, href, owned: volume.bookId !== null } : null;
}

/**
 * De quoi passer d'un tome au précédent ou au suivant sans repasser par la
 * liste, comme d'un épisode au suivant. Le voisin peut n'être qu'au catalogue :
 * le lien mène alors à sa fiche, d'où il s'ajoute.
 */
export function seriesNavigation(
	userId: number,
	seriesId: number,
	current: { bookId?: number | null; uri?: string | null }
): SeriesNavigation | null {
	const series = db.select().from(bookSeries).where(eq(bookSeries.id, seriesId)).get();
	if (!series) return null;
	const volumes = buildSeriesVolumes(userId, series);
	const index = volumes.findIndex(
		(volume) =>
			(current.bookId != null && volume.bookId === current.bookId) ||
			(current.uri != null && volume.uri === current.uri)
	);
	if (index < 0) return null;
	return {
		seriesId,
		seriesTitle: series.title,
		seriesHref: `/livres/series/${series.id}`,
		prev: neighbour(volumes[index - 1]),
		next: neighbour(volumes[index + 1])
	};
}
