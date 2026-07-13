import { unzipSync } from 'fflate';

export const TVTIME_CSV_NAMES = [
	'followed_tv_show.csv',
	'tracking-prod-records-v2.csv',
	'tracking-prod-records.csv',
	'user_show_special_status.csv',
	'user_statistics.csv'
] as const;

export type TvTimeCsvName = (typeof TVTIME_CSV_NAMES)[number];

/** Contenu des CSV de l'export, indexé par nom de fichier (tous optionnels). */
export type TvTimeCsvFiles = Partial<Record<TvTimeCsvName, string>>;

/**
 * Retrouve les CSV attendus dans des fichiers envoyés depuis l'interface :
 * le zip GDPR complet ou des CSV sélectionnés individuellement.
 */
export function csvFilesFromUpload(uploads: { name: string; data: Uint8Array }[]): TvTimeCsvFiles {
	const found: TvTimeCsvFiles = {};
	const decoder = new TextDecoder();
	const collect = (filePath: string, data: Uint8Array) => {
		const base = filePath.split(/[\\/]/).pop()?.toLowerCase();
		const match = TVTIME_CSV_NAMES.find((n) => n === base);
		if (match) found[match] = decoder.decode(data);
	};
	for (const f of uploads) {
		if (f.name.toLowerCase().endsWith('.zip')) {
			for (const [entryPath, data] of Object.entries(unzipSync(f.data))) {
				if (entryPath.startsWith('__MACOSX/') || entryPath.endsWith('/')) continue;
				collect(entryPath, data);
			}
		} else {
			collect(f.name, f.data);
		}
	}
	return found;
}

export interface MovieToImport {
	key: string;
	name: string;
	releaseYear?: string;
	addedAt?: string;
	source: 'vu' | 'a voir';
}

export interface MovieWatchEvent {
	key: string;
	movieName: string;
	releaseYear?: string;
	watchedAt: string;
	type: 'watch' | 'rewatch';
}

export interface MovieImportData {
	moviesToImport: Map<string, MovieToImport>;
	watchEvents: MovieWatchEvent[];
}

export const norm = (s: string) =>
	s.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

function validYear(date: string | undefined): string | undefined {
	const year = date?.slice(0, 4);
	if (!year || !/^\d{4}$/.test(year)) return undefined;
	if (year === '0000' || Number(year) < 1800) return undefined;
	return year;
}

function movieKey(name: string, releaseYear: string | undefined): string {
	return `${norm(name)}|${releaseYear ?? ''}`;
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
	return values.find((v) => v?.trim())?.trim();
}

function minDate(a: string | undefined, b: string | undefined): string | undefined {
	if (!a) return b;
	if (!b) return a;
	return a.localeCompare(b) <= 0 ? a : b;
}

export function collectMovieImportData(rows: Record<string, string>[]): MovieImportData {
	const moviesToImport = new Map<string, MovieToImport>();
	const watchEvents: MovieWatchEvent[] = [];

	for (const r of rows) {
		const name = firstNonEmpty(r.movie_name, r.movie_title, r.title);
		if (!name) continue;

		const type = (r.type ?? '').toLowerCase();
		const recordKey = (r.key ?? '').toLowerCase();
		const releaseYear = validYear(firstNonEmpty(r.release_date, r.movie_release_date));
		const timestamp = firstNonEmpty(r.updated_at, r.created_at);
		const isWatch = type === 'watch' || type === 'rewatch' || recordKey.startsWith('watch-movie-') || recordKey.startsWith('rewatch-movie-');
		const isWatchlist =
			type === 'watchlist' ||
			type === 'to_watch' ||
			type === 'towatch' ||
			recordKey.includes('watchlist-movie') ||
			recordKey.includes('follow-movie');

		if (!isWatch && !isWatchlist) continue;

		const key = movieKey(name, releaseYear);
		const existing = moviesToImport.get(key);
		moviesToImport.set(key, {
			key,
			name,
			releaseYear,
			addedAt: minDate(existing?.addedAt, timestamp),
			source: existing?.source === 'vu' || isWatch ? 'vu' : 'a voir'
		});

		if (isWatch && timestamp) {
			watchEvents.push({
				key,
				movieName: name,
				releaseYear,
				watchedAt: timestamp,
				type: type === 'rewatch' || recordKey.startsWith('rewatch-movie-') ? 'rewatch' : 'watch'
			});
		}
	}

	return { moviesToImport, watchEvents };
}
