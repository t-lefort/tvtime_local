import 'dotenv/config';
import { XMLParser } from 'fast-xml-parser';
import { isbn13To10, normalizeIsbn } from '$lib/isbn';
import { BOOK_SERIES_PREFIX, bookSeriesUri } from '$lib/search';
import {
	bestDescription,
	compareVolumes,
	normalizeBookTitle,
	foldVolumesIntoSeries,
	splitSeriesTitle,
	splitVolumeTitle,
	volumeNumber
} from '$lib/books';
import { googleVolumeByIsbn, type GoogleVolume } from './google-books';

const INVENTAIRE = 'https://inventaire.io/api';
const BNF = 'https://catalogue.bnf.fr/api/SRU';
const OPEN_LIBRARY = 'https://openlibrary.org/search.json';
const USER_AGENT = 'TV-Time-local/1.0 (book metadata lookup)';

export interface BookMetadata {
	isbn13: string | null;
	isbn10: string | null;
	title: string;
	subtitle: string | null;
	authors: string[];
	description: string | null;
	publisher: string | null;
	publishDate: string | null;
	language: string | null;
	pageCount: number | null;
	coverUrl: string | null;
	seriesTitle: string | null;
	/** URI de la série chez Inventaire, pour retrouver la liste de ses tomes. */
	seriesUri: string | null;
	volume: string | null;
	source: 'inventaire' | 'bnf' | 'openlibrary' | 'google-books' | 'manual';
	sourceId: string | null;
}

export interface BookSearchResult {
	/** Une série ouvre la liste de ses tomes ; une oeuvre s'ajoute directement. */
	kind: 'work' | 'series';
	sourceId: string;
	title: string;
	description: string | null;
	coverUrl: string | null;
}

type Entity = {
	uri: string;
	type: string;
	labels?: Record<string, string> & { fromclaims?: string };
	descriptions?: Record<string, string>;
	claims?: Record<string, unknown[]>;
	originalLang?: string;
	image?: { url?: string };
};

async function getJson<T>(url: URL): Promise<T> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10_000);
	try {
		const response = await fetch(url, {
			headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
			signal: controller.signal
		});
		if (!response.ok) throw new Error(`${url.hostname}: HTTP ${response.status}`);
		return (await response.json()) as T;
	} finally {
		clearTimeout(timeout);
	}
}

function claim(entity: Entity | undefined, property: string): unknown[] {
	return entity?.claims?.[property] ?? [];
}

function firstString(entity: Entity | undefined, property: string): string | null {
	const value = claim(entity, property)[0];
	return typeof value === 'string' ? value : null;
}

function label(entity: Entity | undefined): string | null {
	if (!entity?.labels) return null;
	return (
		entity.labels.fr ??
		(entity.originalLang ? entity.labels[entity.originalLang] : undefined) ??
		entity.labels.en ??
		entity.labels.fromclaims ??
		Object.values(entity.labels)[0] ??
		null
	);
}

async function inventaireEntities(uris: string[]): Promise<Record<string, Entity>> {
	if (!uris.length) return {};
	const url = new URL(`${INVENTAIRE}/entities/by-uris`);
	url.searchParams.set('uris', uris.join('|'));
	url.searchParams.set('lang', 'fr');
	const response = await getJson<{ entities: Record<string, Entity>; redirects?: Record<string, string> }>(url);
	return response.entities ?? {};
}

function inventaireImage(path: string | undefined): string | null {
	if (!path) return null;
	return path.startsWith('http') ? path : `https://inventaire.io${path}`;
}

async function inventaireByIsbn(isbn13: string): Promise<BookMetadata | null> {
	const url = new URL(`${INVENTAIRE}/entities/by-uris`);
	url.searchParams.set('uris', `isbn:${isbn13}`);
	url.searchParams.set('lang', 'fr');
	const response = await getJson<{
		entities: Record<string, Entity>;
		redirects?: Record<string, string>;
		notFound?: string[];
	}>(url);
	const editionUri = response.redirects?.[`isbn:${isbn13}`];
	const edition = editionUri ? response.entities[editionUri] : Object.values(response.entities)[0];
	if (!edition) return null;
	return inventaireEditionToMetadata(edition);
}

async function inventaireEditionToMetadata(edition: Entity): Promise<BookMetadata> {
	const workUri = firstString(edition, 'wdt:P629');
	const publisherUri = firstString(edition, 'wdt:P123');
	const firstEntities = await inventaireEntities([workUri, publisherUri].filter((v): v is string => Boolean(v)));
	const work = workUri ? firstEntities[workUri] : undefined;
	const seriesUri = firstString(work, 'wdt:P179');
	const contributorUris = [
		...claim(work, 'wdt:P50'),
		...claim(work, 'wdt:P58'),
		...claim(work, 'wdt:P110'),
		...claim(work, 'wdt:P655')
	].filter((v): v is string => typeof v === 'string');
	const related = await inventaireEntities([seriesUri, ...contributorUris].filter((v): v is string => Boolean(v)));
	let volume: string | null = null;
	if (seriesUri && workUri) {
		try {
			const url = new URL(`${INVENTAIRE}/entities/serie-parts`);
			url.searchParams.set('uri', seriesUri);
			const parts = await getJson<{ parts: { uri: string; ordinal?: string }[] }>(url);
			volume = parts.parts.find((part) => part.uri === workUri)?.ordinal ?? null;
		} catch {
			// La serie reste exploitable meme si son ordre est incomplet.
		}
	}
	const title = firstString(edition, 'wdt:P1476') ?? label(edition) ?? label(work) ?? 'Livre sans titre';
	if (!volume) volume = /(?:tome|vol(?:ume)?\.?)[\s:.-]*(\d+(?:\.\d+)?)/i.exec(title)?.[1] ?? null;
	const isbn13 = normalizeIsbn(firstString(edition, 'wdt:P212') ?? '') ?? null;
	const isbn10 = firstString(edition, 'wdt:P957')?.replace(/-/g, '') ?? (isbn13 ? isbn13To10(isbn13) : null);
	const pageValue = claim(edition, 'wdt:P1104')[0];
	return {
		isbn13,
		isbn10,
		title,
		subtitle: null,
		authors: [...new Set(contributorUris.map((uri) => label(related[uri])).filter((v): v is string => Boolean(v)))],
		description: work?.descriptions?.fr ?? work?.descriptions?.en ?? null,
		publisher: publisherUri ? label(firstEntities[publisherUri]) : null,
		publishDate: firstString(edition, 'wdt:P577'),
		language: edition.originalLang ?? null,
		pageCount: typeof pageValue === 'number' ? pageValue : Number(pageValue) || null,
		coverUrl: inventaireImage(edition.image?.url ?? work?.image?.url),
		seriesTitle: seriesUri ? label(related[seriesUri]) : null,
		seriesUri,
		volume,
		source: 'inventaire',
		sourceId: edition.uri
	};
}

function asArray<T>(value: T | T[] | undefined): T[] {
	return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

async function bnfByIsbn(isbn13: string): Promise<BookMetadata | null> {
	const isbn10 = isbn13To10(isbn13);
	const terms = [isbn13, isbn10].filter(Boolean).join(' ');
	const url = new URL(BNF);
	url.searchParams.set('version', '1.2');
	url.searchParams.set('operation', 'searchRetrieve');
	url.searchParams.set('query', `bib.isbn any "${terms}"`);
	url.searchParams.set('recordSchema', 'dublincore');
	url.searchParams.set('maximumRecords', '5');
	const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (!response.ok) throw new Error(`catalogue.bnf.fr: HTTP ${response.status}`);
	const parsed = new XMLParser({ removeNSPrefix: true }).parse(await response.text()) as Record<string, any>;
	const records = asArray(parsed.searchRetrieveResponse?.records?.record);
	if (!records.length) return null;
	const dc = records[0]?.recordData?.dc;
	if (!dc) return null;
	const identifiers = asArray(dc.identifier).map(String);
	const ark = identifiers.find((value) => value.includes('ark:/')) ?? null;
	const rawTitle = String(asArray(dc.title)[0] ?? 'Livre sans titre');
	return {
		isbn13,
		isbn10,
		title: rawTitle.split(' / ')[0].trim(),
		subtitle: null,
		authors: asArray(dc.creator).map(String),
		description: null,
		publisher: asArray(dc.publisher).map(String)[0] ?? null,
		publishDate: asArray(dc.date).map(String)[0] ?? null,
		language: asArray(dc.language).map(String)[0] ?? 'fr',
		pageCount: null,
		coverUrl: null,
		seriesTitle: null,
		seriesUri: null,
		volume: /(?:^|[.\s])([0-9]+)\s*(?:\/|$)/.exec(rawTitle)?.[1] ?? null,
		source: 'bnf',
		sourceId: ark
	};
}

async function openLibraryByIsbn(isbn13: string): Promise<BookMetadata | null> {
	const url = new URL(OPEN_LIBRARY);
	url.searchParams.set('isbn', isbn13);
	url.searchParams.set('fields', 'key,title,author_name,publisher,publish_date,cover_i,edition_key,language,number_of_pages_median');
	url.searchParams.set('limit', '1');
	const response = await getJson<{ docs?: Record<string, any>[] }>(url);
	const doc = response.docs?.[0];
	if (!doc) return null;
	return {
		isbn13,
		isbn10: isbn13To10(isbn13),
		title: doc.title ?? 'Livre sans titre',
		subtitle: null,
		authors: doc.author_name ?? [],
		description: null,
		publisher: doc.publisher?.[0] ?? null,
		publishDate: doc.publish_date?.[0] ?? null,
		language: doc.language?.[0] ?? null,
		pageCount: doc.number_of_pages_median ?? null,
		coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
		seriesTitle: null,
		seriesUri: null,
		volume: null,
		source: 'openlibrary',
		sourceId: doc.edition_key?.[0] ?? doc.key ?? null
	};
}

/** Une notice Google Books ramenee au vocabulaire commun des sources. */
function googleToMetadata(volume: GoogleVolume, isbn13: string): BookMetadata {
	return {
		isbn13: volume.isbn13 ?? isbn13,
		isbn10: volume.isbn10 ?? isbn13To10(isbn13),
		title: volume.title,
		subtitle: volume.subtitle,
		authors: volume.authors,
		description: volume.description,
		publisher: volume.publisher,
		publishDate: volume.publishDate,
		language: volume.language,
		pageCount: volume.pageCount,
		coverUrl: volume.coverUrl,
		seriesTitle: null,
		seriesUri: null,
		volume: null,
		source: 'google-books',
		sourceId: volume.sourceId
	};
}

async function googleByIsbn(isbn13: string): Promise<BookMetadata | null> {
	const volume = await googleVolumeByIsbn(isbn13);
	return volume ? googleToMetadata(volume, isbn13) : null;
}

function mergeMetadata(primary: BookMetadata, extra: BookMetadata): BookMetadata {
	return {
		...primary,
		isbn13: primary.isbn13 ?? extra.isbn13,
		isbn10: primary.isbn10 ?? extra.isbn10,
		subtitle: primary.subtitle ?? extra.subtitle,
		authors: primary.authors.length ? primary.authors : extra.authors,
		description: primary.description ?? extra.description,
		publisher: primary.publisher ?? extra.publisher,
		publishDate: primary.publishDate ?? extra.publishDate,
		language: primary.language ?? extra.language,
		pageCount: primary.pageCount ?? extra.pageCount,
		coverUrl: primary.coverUrl ?? extra.coverUrl,
		seriesTitle: primary.seriesTitle ?? extra.seriesTitle,
		seriesUri: primary.seriesUri ?? extra.seriesUri,
		volume: primary.volume ?? extra.volume
	};
}

/**
 * Fusionne une notice riche en presentation dans une notice riche en
 * structure : Inventaire sait a quelle serie appartient un tome, Google Books
 * sait comment il s'appelle et de quoi il parle. Le second n'ecrase jamais le
 * rattachement du premier.
 */
function mergePresentation(base: BookMetadata, google: BookMetadata): BookMetadata {
	return {
		...base,
		title: google.title || base.title,
		subtitle: google.subtitle ?? base.subtitle,
		authors: google.authors.length ? google.authors : base.authors,
		publisher: google.publisher ?? base.publisher,
		publishDate: google.publishDate ?? base.publishDate,
		pageCount: google.pageCount ?? base.pageCount,
		coverUrl: google.coverUrl ?? base.coverUrl,
		volume: base.volume ?? splitVolumeTitle(google.title).volume?.toString() ?? null
	};
}

/** Une notice complete : rien a aller chercher ailleurs. */
function isComplete(metadata: BookMetadata): boolean {
	return Boolean(
		metadata.authors.length && metadata.publisher && metadata.publishDate && metadata.coverUrl && metadata.description
	);
}

/**
 * Recherche une edition et fusionne les sources sans laisser une panne bloquer
 * l'ajout. Inventaire et Google Books partent ensemble : le premier rattache
 * le tome a sa serie, le second le decrit. La BnF et Open Library ne servent
 * qu'a boucher les trous restants.
 */
export async function getBookByIsbn(rawIsbn: string): Promise<BookMetadata | null> {
	const isbn13 = normalizeIsbn(rawIsbn);
	if (!isbn13) return null;
	const [inventaire, google] = await Promise.all([
		inventaireByIsbn(isbn13).catch(() => null),
		googleByIsbn(isbn13).catch(() => null)
	]);
	const descriptions: (string | null | undefined)[] = [google?.description, inventaire?.description];
	let result =
		inventaire && google ? mergePresentation(inventaire, google) : (inventaire ?? google ?? null);
	if (!result || !isComplete(result)) {
		for (const lookup of [bnfByIsbn, openLibraryByIsbn]) {
			try {
				const found = await lookup(isbn13);
				if (!found) continue;
				descriptions.push(found.description);
				result = result ? mergeMetadata(result, found) : found;
				if (isComplete(result)) break;
			} catch {
				// Une source indisponible ne doit pas masquer les suivantes.
			}
		}
	}
	if (!result) return null;
	result.description = bestDescription(...descriptions);
	// Google Books ignore la notion de serie : sans cette lecture du titre, un
	// tome scanne resterait un livre isole, sans page de serie ni tome suivant.
	if (!result.seriesTitle) {
		const derived = splitSeriesTitle(result.title);
		if (derived.seriesTitle) {
			result.seriesTitle = derived.seriesTitle;
			result.volume = result.volume ?? (derived.volume === null ? null : String(derived.volume));
		}
	}
	return result;
}

interface InventaireHit {
	uri: string;
	label: string;
	description?: string;
	image?: string;
	type: string;
}

async function searchInventaire(q: string, types: 'works' | 'series', limit: number): Promise<InventaireHit[]> {
	const url = new URL(`${INVENTAIRE}/search`);
	url.searchParams.set('search', q);
	url.searchParams.set('types', types);
	url.searchParams.set('lang', 'fr');
	url.searchParams.set('limit', String(limit));
	const response = await getJson<{ results?: InventaireHit[] }>(url);
	return response.results ?? [];
}

function hitToResult(hit: InventaireHit, kind: 'work' | 'series'): BookSearchResult {
	return {
		kind,
		sourceId: kind === 'series' ? `${BOOK_SERIES_PREFIX}${hit.uri}` : hit.uri,
		title: hit.label,
		// Inventaire ne donne ici que sa glose : au moins qu'elle commence par
		// une majuscule, le temps qu'un vrai resume la remplace a l'ouverture.
		description: bestDescription(hit.description),
		coverUrl: inventaireImage(hit.image)
	};
}

export async function searchBooks(query: string): Promise<BookSearchResult[]> {
	const q = query.trim();
	if (!q) return [];
	const isbn = normalizeIsbn(q);
	if (isbn) {
		const book = await getBookByIsbn(isbn);
		return book
			? [
					{
						kind: 'work',
						sourceId: `isbn:${isbn}`,
						title: book.title,
						description: book.description,
						coverUrl: book.coverUrl
					}
				]
			: [];
	}
	// Les series sont interrogees en meme temps que les oeuvres : sans elles,
	// chercher un manga ne renvoie qu'une poignee de tomes en desordre au lieu
	// de l'entree qui mene a la liste complete.
	const [works, series] = await Promise.all([
		searchInventaire(q, 'works', 20),
		searchInventaire(q, 'series', 10).catch(() => [] as InventaireHit[])
	]);
	const folded = foldVolumesIntoSeries(series, works);
	return [
		...folded.series.map((hit) => hitToResult(hit, 'series')),
		...folded.works.map((hit) => hitToResult(hit, 'work'))
	];
}

/**
 * L'URI de catalogue d'une serie qu'on ne connait que par son nom. Un tome
 * ajoute par son code-barres arrive sans rattachement — Google Books ignore
 * les series — et sa serie resterait une coquille vide sans cette recherche.
 * On exige une egalite stricte des titres : « Liste des episodes de One Piece »
 * ressort de la meme requete sans etre la meme chose.
 */
export async function findSeriesUriByTitle(title: string): Promise<string | null> {
	const wanted = normalizeBookTitle(title);
	if (!wanted) return null;
	const hits = await searchInventaire(title, 'series', 5);
	const match = hits.find((hit) => normalizeBookTitle(hit.label) === wanted);
	return match && isInventaireUri(match.uri) ? match.uri : null;
}

/**
 * Choisit une edition d'une oeuvre trouvee par la recherche plein texte, puis
 * la fait decrire par Google Books : sans cela, la fiche d'un tome s'ouvre sur
 * une glose Wikidata et une couverture manquante.
 */
export async function getBookByInventaireWork(workUri: string): Promise<BookMetadata | null> {
	if (!/^(?:inv|wd):[A-Za-z0-9]+$/.test(workUri)) return null;
	const url = new URL(`${INVENTAIRE}/entities/reverse-claims`);
	url.searchParams.set('property', 'wdt:P629');
	url.searchParams.set('value', workUri);
	const { uris } = await getJson<{ uris?: string[] }>(url);
	const editions = await inventaireEntities((uris ?? []).slice(0, 20));
	const candidates = Object.values(editions).filter((entity) => normalizeIsbn(firstString(entity, 'wdt:P212') ?? ''));
	const edition = candidates.find((entity) => entity.originalLang === 'fr') ?? candidates[0];
	if (!edition) return null;
	const metadata = await inventaireEditionToMetadata(edition);
	const google = metadata.isbn13 ? await googleByIsbn(metadata.isbn13).catch(() => null) : null;
	const merged = google ? mergePresentation(metadata, google) : metadata;
	merged.description = bestDescription(google?.description, metadata.description);
	return merged;
}

/** Une serie du catalogue, telle qu'elle s'affiche en tete de sa page. */
export interface BookSeriesInfo {
	uri: string;
	title: string;
	description: string | null;
}

/** Un tome de serie, avant tout ajout a la bibliotheque. */
export interface BookSeriesVolume {
	uri: string;
	title: string;
	volume: number | null;
	date: string | null;
}

function isInventaireUri(uri: string): boolean {
	return /^(?:inv|wd):[A-Za-z0-9]+$/.test(uri);
}

/** Reconnait l'identifiant de serie porte par un resultat de recherche. */
export function seriesUriFromSourceId(sourceId: string): string | null {
	const uri = bookSeriesUri(sourceId);
	return uri && isInventaireUri(uri) ? uri : null;
}

/**
 * Une serie et ses tomes ne bougent pas d'une consultation a l'autre : les
 * garder une heure en memoire evite d'attendre Inventaire a chaque affichage.
 */
const SERIES_TTL_MS = 60 * 60 * 1000;
const seriesCache = new Map<string, { at: number; value: unknown }>();

async function cachedSeriesCall<T>(key: string, load: () => Promise<T>): Promise<T> {
	const hit = seriesCache.get(key);
	if (hit && Date.now() - hit.at < SERIES_TTL_MS) return hit.value as T;
	const value = await load();
	seriesCache.set(key, { at: Date.now(), value });
	return value;
}

export async function getBookSeries(uri: string): Promise<BookSeriesInfo | null> {
	if (!isInventaireUri(uri)) return null;
	return cachedSeriesCall(`serie:${uri}`, async () => {
		const entity = (await inventaireEntities([uri]))[uri];
		if (!entity) return null;
		return {
			uri,
			title: label(entity) ?? 'Serie sans titre',
			description: bestDescription(entity.descriptions?.fr, entity.descriptions?.en)
		};
	});
}

/** Combien de tomes on accepte de detailler, et par paquets de combien. */
const MAX_SERIES_PARTS = 400;
const ENTITY_CHUNK = 50;

/**
 * Les tomes d'une serie, dans l'ordre. Wikidata et Inventaire decrivent
 * souvent le meme tome chacun de son cote : on n'en garde qu'un par numero,
 * en preferant celui qui porte un titre en francais.
 */
export async function getBookSeriesVolumes(uri: string): Promise<BookSeriesVolume[]> {
	if (!isInventaireUri(uri)) return [];
	return cachedSeriesCall(`parts:${uri}`, async () => {
		const url = new URL(`${INVENTAIRE}/entities/serie-parts`);
		url.searchParams.set('uri', uri);
		const { parts = [] } = await getJson<{ parts?: { uri: string; ordinal?: string; date?: string }[] }>(url);
		const kept = parts.slice(0, MAX_SERIES_PARTS);
		const entities: Record<string, Entity> = {};
		for (let index = 0; index < kept.length; index += ENTITY_CHUNK) {
			Object.assign(entities, await inventaireEntities(kept.slice(index, index + ENTITY_CHUNK).map((part) => part.uri)));
		}
		const byOrdinal = new Map<string, BookSeriesVolume & { french: boolean }>();
		for (const part of kept) {
			const entity = entities[part.uri];
			const title = firstString(entity, 'wdt:P1476') ?? label(entity);
			if (!title) continue;
			// Le numero prime sur l'URI comme cle de regroupement : Wikidata donne
			// souvent l'ordre, Inventaire seulement un titre numerote.
			const volume = volumeNumber(part.ordinal) ?? splitVolumeTitle(title).volume;
			const key = volume !== null ? `t${volume}` : part.uri;
			const french = Boolean(entity?.labels?.fr);
			const existing = byOrdinal.get(key);
			if (existing && (existing.french || !french)) continue;
			byOrdinal.set(key, { uri: part.uri, title, volume, date: part.date ?? null, french });
		}
		return [...byOrdinal.values()]
			.map(({ french: _french, ...volume }) => volume)
			.sort(compareVolumes);
	});
}
