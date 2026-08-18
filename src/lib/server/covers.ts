import 'dotenv/config';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { books } from './db/schema';
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
const inFlight = new Map<number, Promise<Cover | null>>();

function cacheKey(sources: string[]): string {
	// L'empreinte des sources fait partie du nom : si la fiche change de
	// couverture, l'ancien fichier n'est plus retrouvé et le cache se refait.
	return createHash('sha1').update(sources.join('|')).digest('hex').slice(0, 12);
}

function readCached(bookId: number, key: string): Cover | null {
	for (const [contentType, extension] of Object.entries(EXTENSIONS)) {
		const file = path.join(COVER_DIR, `${bookId}-${key}.${extension}`);
		if (!fs.existsSync(file)) continue;
		const body = fs.readFileSync(file);
		return { body, contentType, etag: `"${key}-${body.length}"` };
	}
	return null;
}

/** Marqueur d'échec : évite de rappeler des sources muettes à chaque affichage. */
function missedRecently(bookId: number, key: string): boolean {
	const marker = path.join(COVER_DIR, `${bookId}-${key}.none`);
	if (!fs.existsSync(marker)) return false;
	return Date.now() - fs.statSync(marker).mtimeMs < RETRY_MISSING_MS;
}

function forget(bookId: number): void {
	if (!fs.existsSync(COVER_DIR)) return;
	for (const name of fs.readdirSync(COVER_DIR)) {
		if (name.startsWith(`${bookId}-`)) fs.rmSync(path.join(COVER_DIR, name), { force: true });
	}
}

function store(bookId: number, key: string, extension: string, body: Buffer): void {
	fs.mkdirSync(COVER_DIR, { recursive: true });
	forget(bookId);
	fs.writeFileSync(path.join(COVER_DIR, `${bookId}-${key}.${extension}`), body);
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

async function resolve(bookId: number, subject: CoverSubject): Promise<Cover | null> {
	const sources = coverSources(subject);
	const key = cacheKey(sources);
	const cached = readCached(bookId, key);
	if (cached) return cached;
	if (!sources.length || missedRecently(bookId, key)) return null;

	for (const url of sources) {
		const found = await download(url);
		if (!found) continue;
		store(bookId, key, EXTENSIONS[found.contentType], found.body);
		return { ...found, etag: `"${key}-${found.body.length}"` };
	}
	fs.mkdirSync(COVER_DIR, { recursive: true });
	forget(bookId);
	fs.writeFileSync(path.join(COVER_DIR, `${bookId}-${key}.none`), '');
	return null;
}

/**
 * Couverture d'une édition, servie depuis le disque. Les catalogues
 * bibliographiques sont lents, limitent les appels répétés et perdent parfois
 * leurs images : une page de bibliothèque qui les appellerait toutes en direct
 * afficherait forcément des trous. On les télécharge donc une fois, en
 * essayant chaque source à la suite, puis on ne ressert que la copie locale.
 */
export function getCover(bookId: number): Promise<Cover | null> {
	const pending = inFlight.get(bookId);
	if (pending) return pending;
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
	if (!book) return Promise.resolve(null);
	const task = resolve(bookId, book).finally(() => inFlight.delete(bookId));
	inFlight.set(bookId, task);
	return task;
}
