import 'dotenv/config';
import { normalizeIsbn } from '$lib/isbn';
import { cleanDescription, normalizeBookTitle, sameSeries, splitSeriesTitle } from '$lib/books';

/**
 * Google Books est la seule source qui décrive correctement un tome français :
 * son titre propre, séparé de celui de la série, un vrai quatrième de
 * couverture et une jaquette. Il ignore en revanche complètement la notion de
 * série — c'est Inventaire qui donne l'ossature. Ce module ne fait donc qu'une
 * chose : décrire une édition qu'on lui désigne, par son ISBN ou par son rang
 * dans une série.
 */

const GOOGLE_BOOKS = 'https://www.googleapis.com/books/v1/volumes';
const USER_AGENT = 'TV-Time-local/1.0 (book metadata lookup)';
const TIMEOUT_MS = 10_000;

/**
 * Le quota journalier de l'API est vite atteint (sans clé, il l'est en
 * permanence). Les appels partent donc à la file, espacés : un enrichissement
 * de série de cent tomes ne doit pas griller le quota de la journée en dix
 * secondes ni faire attendre une page.
 */
const MIN_INTERVAL_MS = 250;
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

function throttled<T>(task: () => Promise<T>): Promise<T> {
	const run = queue.then(async () => {
		const wait = MIN_INTERVAL_MS - (Date.now() - lastCall);
		if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
		lastCall = Date.now();
		return task();
	});
	// La file ne doit pas s'interrompre parce qu'un appel a échoué.
	queue = run.catch(() => undefined);
	return run;
}

export interface GoogleVolume {
	sourceId: string;
	title: string;
	subtitle: string | null;
	authors: string[];
	description: string | null;
	publisher: string | null;
	publishDate: string | null;
	language: string | null;
	pageCount: number | null;
	coverUrl: string | null;
	isbn13: string | null;
	isbn10: string | null;
}

interface RawVolume {
	id: string;
	volumeInfo: {
		title?: string;
		subtitle?: string;
		authors?: string[];
		description?: string;
		publisher?: string;
		publishedDate?: string;
		language?: string;
		pageCount?: number;
		imageLinks?: { thumbnail?: string; smallThumbnail?: string };
		industryIdentifiers?: { type?: string; identifier?: string }[];
	};
}

function apiKey(): string | null {
	return process.env.GOOGLE_BOOKS_API_KEY?.trim() || null;
}

export function googleBooksConfigured(): boolean {
	return apiKey() !== null;
}

/**
 * Google répond régulièrement 503 à des requêtes parfaitement valides, une
 * fois sur deux et sans raison : ce sont des pannes d'un instant, qu'un second
 * essai suffit à traverser. Sans cette reprise, ajouter un livre par son
 * code-barres échouerait une fois sur deux — c'est souvent la seule source à
 * connaître une édition numérique récente.
 */
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [500, 1200];

async function fetchVolumes(url: URL): Promise<{ items?: RawVolume[] } | number | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
			signal: controller.signal
		});
		if (response.ok) return (await response.json()) as { items?: RawVolume[] };
		return response.status;
	} catch {
		// Une coupure réseau se retente comme une panne serveur.
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

async function search(query: string, limit = 10): Promise<RawVolume[]> {
	const key = apiKey();
	// Sans clé, le quota anonyme partagé est saturé en permanence : mieux vaut
	// ne pas appeler du tout que faire attendre pour un 429.
	if (!key) return [];
	const url = new URL(GOOGLE_BOOKS);
	url.searchParams.set('q', query);
	url.searchParams.set('langRestrict', 'fr');
	url.searchParams.set('maxResults', String(limit));
	url.searchParams.set('key', key);
	return throttled(async () => {
		for (let attempt = 0; ; attempt += 1) {
			const outcome = await fetchVolumes(url);
			if (outcome !== null && typeof outcome !== 'number') return outcome.items ?? [];
			// Une requête refusée sur le fond (clé invalide, syntaxe) ne se retente pas.
			if (typeof outcome === 'number' && !RETRY_STATUS.has(outcome)) return [];
			if (attempt >= RETRY_DELAYS_MS.length) throw new GoogleBooksUnavailable();
			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
		}
	});
}

/**
 * Panne passagère, distinguée d'une absence de résultat : un tome qu'on n'a
 * pas pu décrire doit rester à décrire, alors qu'un tome que Google ne connaît
 * pas est réglé une fois pour toutes.
 */
export class GoogleBooksUnavailable extends Error {
	constructor() {
		super('Google Books est momentanément indisponible.');
		this.name = 'GoogleBooksUnavailable';
	}
}

function identifier(raw: RawVolume, type: 'ISBN_13' | 'ISBN_10'): string | null {
	const value = raw.volumeInfo.industryIdentifiers?.find((entry) => entry.type === type)?.identifier;
	return value ? value.replace(/-/g, '') : null;
}

/** La vignette de Google porte des paramètres d'affichage dont on ne veut pas. */
function coverUrl(raw: RawVolume): string | null {
	const link = raw.volumeInfo.imageLinks?.thumbnail ?? raw.volumeInfo.imageLinks?.smallThumbnail;
	if (!link) return null;
	return link.replace(/^http:/, 'https:').replace(/&edge=curl/, '').replace(/&zoom=\d/, '&zoom=1');
}

function toVolume(raw: RawVolume): GoogleVolume {
	const info = raw.volumeInfo;
	return {
		sourceId: raw.id,
		title: info.title ?? 'Livre sans titre',
		subtitle: info.subtitle ?? null,
		authors: info.authors ?? [],
		description: cleanDescription(info.description),
		publisher: info.publisher ?? null,
		publishDate: info.publishedDate ?? null,
		language: info.language ?? null,
		pageCount: info.pageCount ?? null,
		coverUrl: coverUrl(raw),
		isbn13: identifier(raw, 'ISBN_13'),
		isbn10: identifier(raw, 'ISBN_10')
	};
}

/**
 * L'édition portant cet ISBN. Google renvoie parfois un volume sans rapport
 * avec l'ISBN demandé : on ne retient que celui qui le porte réellement.
 */
export async function googleVolumeByIsbn(rawIsbn: string): Promise<GoogleVolume | null> {
	const isbn13 = normalizeIsbn(rawIsbn);
	if (!isbn13) return null;
	const items = await search(`isbn:${isbn13}`, 5);
	const match = items.find((item) =>
		item.volumeInfo.industryIdentifiers?.some(
			(entry) => normalizeIsbn(entry.identifier ?? '') === isbn13
		)
	);
	return match ? toVolume(match) : null;
}

/** Un chapitre vendu à l'unité n'est pas un tome : il en existe mille par série. */
const CHAPTER = /\bchapitres?\b/i;

/**
 * Tous les tomes de cette série que Google reconnaît dans une seule réponse,
 * rangés par numéro.
 *
 * Une recherche « intitle:<série> tome N » ne ramène pas que le tome N : la
 * même réponse contient une dizaine d'autres tomes de la série. Les récolter
 * tous divise par autant le nombre d'appels — ce qui compte, l'API répondant
 * 503 une fois sur deux et son quota journalier étant vite atteint.
 *
 * On interroge `intitle:` seul : combiné à `inauthor:`, ou avec une expression
 * entre guillemets, l'API répond 503 de façon reproductible. Le tri se fait
 * donc ici — un candidat doit désigner *cette* série et porter un numéro.
 */
export async function googleVolumesOfSeries(
	seriesTitle: string,
	near: number
): Promise<Map<number, GoogleVolume>> {
	const found = new Map<number, GoogleVolume>();
	if (!normalizeBookTitle(seriesTitle)) return found;
	const items = await search(`intitle:${seriesTitle} tome ${near}`, 40);
	for (const item of items) {
		const candidate = toVolume(item);
		if (CHAPTER.test(candidate.title)) continue;
		// Le titre du candidat doit désigner *cette* série, pas une dérivée :
		// « One Piece Doors » et « One Piece Party » commencent par « One
		// Piece » sans en être des tomes.
		const parsed = splitSeriesTitle(candidate.title);
		if (parsed.volume === null || !sameSeries(parsed.seriesTitle, seriesTitle)) continue;
		const kept = found.get(parsed.volume);
		if (!kept || better(candidate, kept)) found.set(parsed.volume, candidate);
	}
	return found;
}

/**
 * Entre deux éditions du même tome : l'édition française d'abord —
 * `langRestrict` laisse passer des tirages japonais, dont l'ISBN mènerait
 * ensuite à la mauvaise édition. Puis une notice décrite plutôt que nue,
 * illustrée plutôt qu'aveugle.
 */
function better(candidate: GoogleVolume, kept: GoogleVolume): boolean {
	const score = (volume: GoogleVolume) =>
		Number(volume.language === 'fr') * 4 +
		Number(Boolean(volume.description)) * 2 +
		Number(Boolean(volume.coverUrl));
	return score(candidate) > score(kept);
}

/** Le tome numéro `volume` de cette série, tel que Google Books le décrit. */
export async function googleVolumeOfSeries(
	seriesTitle: string,
	volume: number
): Promise<GoogleVolume | null> {
	return (await googleVolumesOfSeries(seriesTitle, volume)).get(volume) ?? null;
}
