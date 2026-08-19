import 'dotenv/config';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { books, bookSeriesVolumes } from './db/schema';
import { coverSources, isPlaceholderCover, type CoverSubject } from './covers-utils';

/** Les couvertures se rangent à côté de la base, dans le volume persistant. */
const COVER_DIR = path.resolve(
	path.dirname(path.resolve(process.env.DATABASE_PATH ?? './data/tvtime.db')),
	'covers'
);

const EXTENSIONS: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/avif': 'avif'
};

/** En dessous, ce n'est pas une couverture mais une image d'erreur ou un pixel. */
const MIN_BYTES = 1024;

/** Délai avant de redemander une couverture qu'aucune source n'a fournie. */
const RETRY_MISSING_MS = 7 * 24 * 60 * 60 * 1000;

const FETCH_TIMEOUT_MS = 8000;

export interface Cover {
	body: Buffer;
	contentType: string;
	etag: string;
}

/** Téléchargements en cours, pour qu'une grille entière ne les multiplie pas. */
const inFlight = new Map<string, Promise<Cover | null>>();

function cacheKey(sources: string[]): string {
	// L'empreinte des sources fait partie du nom : si la fiche change de
	// couverture, l'ancien fichier n'est plus retrouvé et le cache se refait.
	return createHash('sha1').update(sources.join('|')).digest('hex').slice(0, 12);
}

function readCached(id: string, key: string): Cover | null {
	for (const [contentType, extension] of Object.entries(EXTENSIONS)) {
		const file = path.join(COVER_DIR, `${id}-${key}.${extension}`);
		if (!fs.existsSync(file)) continue;
		const body = fs.readFileSync(file);
		return { body, contentType, etag: `"${key}-${body.length}"` };
	}
	return null;
}

/** Marqueur d'échec : évite de rappeler des sources muettes à chaque affichage. */
function missedRecently(id: string, key: string): boolean {
	const marker = path.join(COVER_DIR, `${id}-${key}.none`);
	if (!fs.existsSync(marker)) return false;
	return Date.now() - fs.statSync(marker).mtimeMs < RETRY_MISSING_MS;
}

function forget(id: string): void {
	if (!fs.existsSync(COVER_DIR)) return;
	for (const name of fs.readdirSync(COVER_DIR)) {
		if (name.startsWith(`${id}-`)) fs.rmSync(path.join(COVER_DIR, name), { force: true });
	}
}

function store(id: string, key: string, extension: string, body: Buffer): void {
	fs.mkdirSync(COVER_DIR, { recursive: true });
	forget(id);
	fs.writeFileSync(path.join(COVER_DIR, `${id}-${key}.${extension}`), body);
}

async function download(url: string): Promise<{ contentType: string; body: Buffer } | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { 'User-Agent': 'TV-Time-local/1.0 (book cover cache)', Accept: 'image/*' }
		});
		if (!response.ok) return null;
		const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
		const extension = EXTENSIONS[contentType];
		if (!extension) return null;
		const body = Buffer.from(await response.arrayBuffer());
		if (body.length < MIN_BYTES) return null;
		if (isPlaceholderCover(createHash('sha1').update(body).digest('hex'))) return null;
		return { contentType, body };
	} catch {
		// Une source injoignable ne doit pas empêcher d'essayer la suivante.
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

async function resolve(id: string, subject: CoverSubject): Promise<Cover | null> {
	const sources = coverSources(subject);
	const key = cacheKey(sources);
	const cached = readCached(id, key);
	if (cached) return cached;
	if (!sources.length || missedRecently(id, key)) return null;

	for (const url of sources) {
		const found = await download(url);
		if (!found) continue;
		store(id, key, EXTENSIONS[found.contentType], found.body);
		return { ...found, etag: `"${key}-${found.body.length}"` };
	}
	fs.mkdirSync(COVER_DIR, { recursive: true });
	forget(id);
	fs.writeFileSync(path.join(COVER_DIR, `${id}-${key}.none`), '');
	return null;
}

/** Un seul téléchargement à la fois par image, quel que soit le nombre d'appels. */
function once(id: string, subject: CoverSubject | undefined): Promise<Cover | null> {
	if (!subject) return Promise.resolve(null);
	const pending = inFlight.get(id);
	if (pending) return pending;
	const task = resolve(id, subject).finally(() => inFlight.delete(id));
	inFlight.set(id, task);
	return task;
}

/**
 * Couverture d'une édition, servie depuis le disque. Les catalogues
 * bibliographiques sont lents, limitent les appels répétés et perdent parfois
 * leurs images : une page de bibliothèque qui les appellerait toutes en direct
 * afficherait forcément des trous. On les télécharge donc une fois, en
 * essayant chaque source à la suite, puis on ne ressert que la copie locale.
 */
export function getCover(bookId: number): Promise<Cover | null> {
	const book = db
		.select({
			coverUrl: books.coverUrl,
			isbn13: books.isbn13,
			isbn10: books.isbn10,
			externalSource: books.externalSource,
			externalId: books.externalId
		})
		.from(books)
		.where(eq(books.id, bookId))
		.get();
	return once(String(bookId), book);
}

/**
 * Couverture d'un tome que le profil ne possède pas encore, servie du même
 * cache local. Une page de série affiche cent vignettes : les laisser pointer
 * chez Google Books ferait cent requêtes distantes à chaque ouverture, et
 * autant de trous quand il refuse d'en servir une.
 */
export function getSeriesVolumeCover(volumeId: number): Promise<Cover | null> {
	const volume = db
		.select({ coverUrl: bookSeriesVolumes.coverUrl, isbn13: bookSeriesVolumes.isbn13 })
		.from(bookSeriesVolumes)
		.where(eq(bookSeriesVolumes.id, volumeId))
		.get();
	if (!volume) return Promise.resolve(null);
	return once(`t${volumeId}`, {
		...volume,
		isbn10: null,
		externalSource: null,
		externalId: null
	});
}

/** Une journée : assez pour ne plus y revenir, assez court pour voir une correction. */
const CACHE_CONTROL = 'public, max-age=86400';

/**
 * Réponse HTTP d'une couverture, partagée par les deux routes qui en servent.
 * L'absence de couverture est un 404 : le composant retombe alors sur son
 * emoji, et le navigateur retient la réponse au lieu de la redemander.
 */
export function coverResponse(cover: Cover | null, request: Request): Response {
	if (!cover) return new Response(null, { status: 404, headers: { 'Cache-Control': CACHE_CONTROL } });
	if (request.headers.get('if-none-match') === cover.etag) {
		return new Response(null, { status: 304, headers: { ETag: cover.etag, 'Cache-Control': CACHE_CONTROL } });
	}
	return new Response(new Uint8Array(cover.body), {
		headers: {
			'Content-Type': cover.contentType,
			'Content-Length': String(cover.body.length),
			ETag: cover.etag,
			'Cache-Control': CACHE_CONTROL
		}
	});
}
