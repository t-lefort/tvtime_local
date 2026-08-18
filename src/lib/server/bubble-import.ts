import { normalizeIsbn, isbn13To10 } from '$lib/isbn';
import type { User } from './db/schema';
import { getBookByIsbn, type BookMetadata } from './book-metadata';
import { addOrUpdateBook, collectBook } from './books';
import {
	bubbleAuthors,
	bubbleChecked,
	bubbleNumber,
	bubbleRating,
	bubbleText,
	parseBubbleCsv,
	type BubbleRow
} from './bubble-import-utils';

export { parseBubbleCsv } from './bubble-import-utils';

export interface BubbleImportProgress {
	current: number;
	total: number;
	label?: string;
}

export interface BubbleImportReport {
	imported: number;
	invalid: { line: number; title: string; reason: string }[];
	metadataMissing: { title: string; isbn: string }[];
}

export interface BubbleImportJob {
	running: boolean;
	userId: number;
	userName: string;
	startedAt: string;
	progress: BubbleImportProgress;
	report?: BubbleImportReport;
	error?: string;
}

let job: BubbleImportJob | null = null;

export function getBubbleImportJob(userId: number): BubbleImportJob | null {
	return job?.userId === userId ? job : null;
}

function mergeRow(row: BubbleRow, remote: BookMetadata | null, isbn13: string | null): BookMetadata {
	const seriesTitle = bubbleText(row, 'Titre de la série');
	const albumTitle = bubbleText(row, "Titre de l'album");
	const rowAuthors = bubbleAuthors(bubbleText(row, 'Auteurs'));
	return {
		isbn13,
		isbn10: remote?.isbn10 ?? (isbn13 ? isbn13To10(isbn13) : null),
		title: albumTitle || seriesTitle || remote?.title || 'Livre sans titre',
		subtitle: remote?.subtitle ?? null,
		authors: rowAuthors.length ? rowAuthors : (remote?.authors ?? []),
		description: remote?.description ?? null,
		publisher: bubbleText(row, 'Editeur') || remote?.publisher || null,
		publishDate: bubbleText(row, 'Date de publication') || remote?.publishDate || null,
		language: remote?.language ?? 'fr',
		pageCount: remote?.pageCount ?? null,
		coverUrl: remote?.coverUrl ?? null,
		seriesTitle: seriesTitle || remote?.seriesTitle || null,
		seriesUri: remote?.seriesUri ?? null,
		volume: bubbleText(row, 'Tome') || remote?.volume || null,
		source: remote?.source ?? 'manual',
		sourceId: remote?.sourceId ?? null
	};
}

export async function importBubbleCsv(
	user: Pick<User, 'id' | 'name'>,
	content: string,
	onProgress: (progress: BubbleImportProgress) => void = () => {}
): Promise<BubbleImportReport> {
	const rows = parseBubbleCsv(content);
	const report: BubbleImportReport = { imported: 0, invalid: [], metadataMissing: [] };
	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		const seriesTitle = bubbleText(row, 'Titre de la série');
		const albumTitle = bubbleText(row, "Titre de l'album");
		const title = albumTitle || seriesTitle || `Ligne ${index + 2}`;
		onProgress({ current: index, total: rows.length, label: title });
		const rawIsbn = bubbleText(row, 'EAN');
		const isbn13 = rawIsbn ? normalizeIsbn(rawIsbn) : null;
		if (rawIsbn && !isbn13) {
			report.invalid.push({ line: index + 2, title, reason: `EAN/ISBN invalide : ${rawIsbn}` });
			continue;
		}
		if (!albumTitle && !seriesTitle) {
			report.invalid.push({ line: index + 2, title, reason: 'Titre absent' });
			continue;
		}
		let remote: BookMetadata | null = null;
		if (isbn13) {
			try {
				remote = await getBookByIsbn(isbn13);
			} catch {
				// Le CSV suffit pour continuer hors ligne.
			}
			if (!remote) report.metadataMissing.push({ title, isbn: isbn13 });
		}
		const metadata = mergeRow(row, remote, isbn13);
		const book = addOrUpdateBook(metadata, {
			seriesType: bubbleText(row, 'Type') || null,
			collection: bubbleText(row, 'Collection') || null,
			category: bubbleText(row, 'Catégory') || bubbleText(row, 'Category') || null,
			volume: bubbleText(row, 'Tome') || null,
			numbering: bubbleText(row, 'Numérotation') || null,
			price: bubbleNumber(bubbleText(row, 'Prix'))
		});
		collectBook(user.id, book, {
			addedAt: bubbleText(row, "Date d'ajout") || null,
			inCollection: bubbleChecked(bubbleText(row, 'Dans ma collection')),
			readingStatus: bubbleChecked(bubbleText(row, 'Lu')) ? 'read' : 'unread',
			rating: bubbleRating(bubbleText(row, "Ma note de l'album")),
			review: bubbleText(row, "Mon avis de l'album") || null,
			signed: bubbleChecked(bubbleText(row, 'Dédicacé')),
			originalEdition: bubbleChecked(bubbleText(row, 'Edition originale')),
			deluxe: bubbleChecked(bubbleText(row, 'Tirage de tête')),
			limitedSeries: bubbleChecked(bubbleText(row, 'Série limitée')),
			digital: bubbleChecked(bubbleText(row, 'Version numérique')),
			forSale: bubbleChecked(bubbleText(row, 'A vendre')),
			purchasePrice: bubbleNumber(bubbleText(row, "Prix d'achat")),
			estimatedValue: bubbleNumber(bubbleText(row, 'Cote')),
			condition: bubbleText(row, 'Etat') || null,
			seriesRating: bubbleRating(bubbleText(row, 'Ma note de la série')),
			seriesReview: bubbleText(row, 'Mon avis de la série') || null
		});
		report.imported++;
	}
	onProgress({ current: rows.length, total: rows.length });
	return report;
}

export function startBubbleImportJob(user: Pick<User, 'id' | 'name'>, content: string): { started: true } | { error: string } {
	if (job?.running) return { error: `Un import Bubble est déjà en cours pour « ${job.userName} ».` };
	const current: BubbleImportJob = {
		running: true,
		userId: user.id,
		userName: user.name,
		startedAt: new Date().toISOString(),
		progress: { current: 0, total: 0 }
	};
	job = current;
	importBubbleCsv(user, content, (progress) => (current.progress = progress))
		.then((report) => (current.report = report))
		.catch((cause) => (current.error = cause instanceof Error ? cause.message : String(cause)))
		.finally(() => (current.running = false));
	return { started: true };
}
