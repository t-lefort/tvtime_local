/**
 * Rapprochement des tomes et de leur série. Sans réseau ni base, pour rester
 * testable : les catalogues bibliographiques nomment les tomes de dix façons
 * (« One Piece, tome 2 », « One Piece 9 : Larmes », « One Piece T. 51 »).
 */

/** Minuscules sans accents ni ponctuation : la base de toute comparaison. */
export function normalizeBookTitle(value: string): string {
	return value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** « tome 2 », « t. 51 », « vol 3 » — le marqueur explicite et tout ce qui suit. */
const VOLUME_MARKER = /\b(?:tomes?|volumes?|vol|t)\s*(\d+)\b.*$/;
/** « one piece 9 larmes » — un nombre isolé après le titre, et sa suite. */
const TRAILING_NUMBER = /\s(\d{1,4})(?:\s.*)?$/;

/**
 * Titre de la série auquel se ramène le titre d'un tome, et son numéro.
 * `« One Piece 9 : Larmes » → { title: 'one piece', volume: 9 }`.
 */
export function splitVolumeTitle(title: string): { title: string; volume: number | null } {
	const normalized = normalizeBookTitle(title);
	for (const pattern of [VOLUME_MARKER, TRAILING_NUMBER]) {
		const match = pattern.exec(normalized);
		if (match) {
			const base = normalized.slice(0, match.index).trim();
			// Un titre qui n'est *que* son numéro n'est pas un tome : on le garde entier.
			if (base) return { title: base, volume: Number(match[1]) };
		}
	}
	return { title: normalized, volume: null };
}

/** Numéro de tome tel que les catalogues et l'import Bubble l'écrivent. */
export function volumeNumber(value: string | null | undefined): number | null {
	if (!value) return null;
	const match = /\d+(?:[.,]\d+)?/.exec(value);
	return match ? Number(match[0].replace(',', '.')) : null;
}

/**
 * Un résultat de recherche est-il un tome de cette série ? Sert à ne plus
 * proposer côte à côte la série et la moitié de ses tomes.
 */
export function belongsToSeries(workTitle: string, seriesTitle: string): boolean {
	const series = normalizeBookTitle(seriesTitle);
	if (!series) return false;
	const work = normalizeBookTitle(workTitle);
	return work === series || splitVolumeTitle(workTitle).title === series;
}

/** Compare deux tomes : par numéro, les non numérotés à la fin, puis par titre. */
export function compareVolumes(
	a: { volume: number | null; title: string },
	b: { volume: number | null; title: string }
): number {
	if (a.volume !== null && b.volume !== null && a.volume !== b.volume) return a.volume - b.volume;
	if (a.volume !== null && b.volume === null) return -1;
	if (a.volume === null && b.volume !== null) return 1;
	return a.title.localeCompare(b.title, 'fr');
}

/**
 * Sépare séries et tomes isolés dans un résultat de recherche. Une série qui
 * regroupe des tomes présents dans la liste les remplace : la recherche cesse
 * de proposer côte à côte « One Piece » et une poignée de ses tomes en
 * désordre, et renvoie vers la liste complète et ordonnée.
 */
export function foldVolumesIntoSeries<S extends { label: string }, W extends { label: string }>(
	series: S[],
	works: W[],
	maxSeries = 5
): { series: S[]; works: W[] } {
	const kept: S[] = [];
	const folded = new Set<W>();
	for (const candidate of series) {
		if (kept.length >= maxSeries) break;
		const volumes = works.filter((work) => belongsToSeries(work.label, candidate.label));
		// Une série dont aucun tome ne ressort de la recherche est presque
		// toujours un homonyme (liste d'épisodes, saga dérivée) : on la laisse.
		if (!volumes.length) continue;
		kept.push(candidate);
		for (const volume of volumes) folded.add(volume);
	}
	return { series: kept, works: works.filter((work) => !folded.has(work)) };
}
