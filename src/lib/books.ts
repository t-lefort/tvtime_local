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

// ---------------------------------------------------------------------------
// Présentation : ce que les catalogues renvoient est brut et incohérent d'une
// notice à l'autre. Tout ce qui suit ramène leurs libellés à une forme unique,
// sans réseau ni base, pour rester testable.
// ---------------------------------------------------------------------------

/** Balises et entités que Google Books glisse dans ses résumés. */
function stripHtml(value: string): string {
	return value
		.replace(/<(?:br|\/p|\/div)\s*\/?>/gi, ' ')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

/** Met une majuscule à la première lettre, en ignorant guillemets et tirets. */
export function capitalizeFirst(value: string): string {
	const chars = [...value];
	const index = chars.findIndex((char) => /\p{L}/u.test(char));
	if (index < 0) return value;
	chars[index] = chars[index].toLocaleUpperCase('fr');
	return chars.join('');
}

/** Types d'ouvrage par lesquels Wikidata ouvre ses gloses. */
const GLOSS_HEAD =
	/^(?:une?|un|le|la|les|l')?\s*(?:s[ée]ries?|saga|collection|cycle|livre|roman|manga|manhwa|manhua|webtoon|bande[\s-]dessin[ée]e|bd|album|nouvelle|recueil|essai|tome|volume|[œo]uvre|comics?|light novel)\b/i;

/** Gloses anglaises : « 1998 manga volume by Eiichiro Oda ». */
const GLOSS_EN = /^\d{4}\s|\b(?:manga|comic|book|novel|volume|series)\b[^.]{0,30}\bby\b/i;

/**
 * Une glose de catalogue n'est pas un résumé : Wikidata décrit le *type* de
 * l'ouvrage (« série de manga d'Eiichirō Oda ») là où on attend son histoire.
 * On la reconnaît à sa brièveté, à son absence de phrase et à sa minuscule
 * initiale — les trois signes qui la séparent d'un vrai quatrième de couverture.
 */
export function isCatalogueGloss(text: string): boolean {
	if (text.length > 120) return false;
	if (/[.!?…]\s+\S/.test(text)) return false;
	const first = [...text].find((char) => /\p{L}|\d/u.test(char));
	if (!first) return true;
	const startsUpper = /\p{L}/u.test(first) && first === first.toLocaleUpperCase('fr');
	if (startsUpper) return GLOSS_EN.test(text);
	return GLOSS_HEAD.test(text) || GLOSS_EN.test(text);
}

/** Un résumé exploitable, nettoyé de son balisage ; `null` si ce n'est qu'une glose. */
export function cleanDescription(value: string | null | undefined): string | null {
	if (!value) return null;
	const text = stripHtml(value);
	if (!text || isCatalogueGloss(text)) return null;
	return capitalizeFirst(text);
}

/**
 * Le meilleur résumé parmi ceux que les sources proposent : un vrai résumé
 * l'emporte toujours sur une glose, et faute de mieux la glose elle-même part
 * avec une majuscule plutôt que telle que Wikidata l'écrit.
 */
export function bestDescription(...candidates: (string | null | undefined)[]): string | null {
	const texts = candidates.map((value) => (value ? stripHtml(value) : '')).filter(Boolean);
	const real = texts.find((text) => !isCatalogueGloss(text));
	const chosen = real ?? texts[0];
	return chosen ? capitalizeFirst(chosen) : null;
}

/** Mot annonçant un numéro de tome. */
const VOLUME_WORD = /^(?:tomes?|volumes?|vol|t)$/;

/** Segment qui n'est qu'un numéro de tome : « tome 51 », « t 51 », « 51 ». */
const VOLUME_ONLY = /^(?:tomes?|volumes?|vol|t)?\s*\d+(?:[.,]\d+)?$/;

/** Mentions d'édition : elles ne distinguent pas un tome d'un autre. */
const EDITION_NOISE =
	/^(?:nouvelle\s+)?(?:edition|ed)\b|^perfect edition\b|^integrale\b|^coffret\b|^serie\b|^(?:broche|relie|poche|numerique)$/;

/** Une écriture non latine ne dit rien au lecteur d'une liste française. */
const NON_LATIN = /[　-ヿ㐀-鿿가-힯＀-ﾟ]/;

/** Découpe un titre en mots, l'orthographe d'origine à côté de sa forme comparable. */
function titleWords(value: string): { raw: string; norm: string }[] {
	return value
		.split(/\s+/)
		.map((raw) => ({ raw, norm: normalizeBookTitle(raw) }))
		.filter((word) => word.norm !== '');
}

/** Ce qui reste d'un titre de tome une fois la série et son numéro retirés. */
function stripSeriesAndVolume(title: string, seriesTitle: string | null | undefined): string {
	const words = titleWords(title);
	const series = seriesTitle ? titleWords(seriesTitle).map((word) => word.norm) : [];
	let index = 0;
	// La série ouvre presque toujours le titre du tome.
	if (series.length && series.every((word, offset) => words[index + offset]?.norm === word)) {
		index += series.length;
	}
	// Puis le marqueur de tome et son numéro, dans un ordre ou dans l'autre.
	while (index < words.length && (VOLUME_WORD.test(words[index].norm) || /^\d+$/.test(words[index].norm))) {
		index += 1;
	}
	return words
		.slice(index)
		.map((word) => word.raw)
		.join(' ')
		.replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '')
		.trim();
}

/** Un fragment de titre mérite-t-il d'être affiché comme titre de tome ? */
function usableAsVolumeTitle(candidate: string, seriesTitle: string | null | undefined): boolean {
	const normalized = normalizeBookTitle(candidate);
	if (!normalized) return false;
	if (seriesTitle && normalized === normalizeBookTitle(seriesTitle)) return false;
	if (VOLUME_ONLY.test(normalized)) return false;
	if (EDITION_NOISE.test(normalized)) return false;
	if (NON_LATIN.test(candidate)) return false;
	return /\p{L}/u.test(candidate);
}

/** Titre propre au tome, extrait de ce que le catalogue a bien voulu nommer. */
function volumeTitle(
	seriesTitle: string | null | undefined,
	title: string,
	subtitle: string | null | undefined
): string | null {
	const explicit = subtitle?.trim();
	if (explicit && usableAsVolumeTitle(explicit, seriesTitle)) return explicit;
	const segments = title
		.split(/\s+[-–—:;]\s+|\s*,\s+|\s+\/\s+|\.\s+/)
		.map((segment) => segment.trim())
		.filter(Boolean);
	if (segments.length > 1) {
		// Le titre du tome vient après la série et la mention d'édition : on
		// garde le dernier fragment qui dise encore quelque chose.
		const usable = segments.filter((segment) => usableAsVolumeTitle(segment, seriesTitle));
		return usable.length ? usable[usable.length - 1] : null;
	}
	const rest = stripSeriesAndVolume(title, seriesTitle);
	return rest && usableAsVolumeTitle(rest, seriesTitle) ? rest : null;
}

/** « 51 », et « 2,5 » pour les hors-séries intercalaires. */
export function formatVolumeNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

/** Un tome tel qu'il s'affiche : un rang, et le titre qui le distingue. */
export interface VolumeLabel {
	/** « Tome 51 » — le repère, identique d'un bout à l'autre de la série. */
	label: string;
	/** « Les onze supernovae » — absent quand le catalogue ne nomme pas le tome. */
	title: string | null;
}

/**
 * Ramène à une forme unique les dix façons dont les catalogues nomment un tome
 * (« One Piece, tome 2 », « ONE PIECE 2 », « Piété filiale », « One Piece -
 * Édition originale - Tome 51 »). Le rang passe toujours devant, le titre du
 * tome derrière quand il en existe un : une liste de série se lit alors de haut
 * en bas sans changer de convention à chaque ligne.
 */
export function formatVolumeLabel(input: {
	seriesTitle?: string | null;
	title?: string | null;
	subtitle?: string | null;
	volume?: number | string | null;
}): VolumeLabel {
	const title = (input.title ?? '').trim();
	const volume =
		typeof input.volume === 'number'
			? input.volume
			: (volumeNumber(input.volume) ?? splitVolumeTitle(title).volume);
	const own = volumeTitle(input.seriesTitle, title, input.subtitle);
	if (volume === null) return { label: title || 'Tome sans numéro', title: own === title ? null : own };
	return { label: `Tome ${formatVolumeNumber(volume)}`, title: own };
}

/** Le tome sur une seule ligne : « Tome 51 · Les onze supernovae ». */
export function volumeLabelText(input: Parameters<typeof formatVolumeLabel>[0]): string {
	const { label, title } = formatVolumeLabel(input);
	return title ? `${label} · ${title}` : label;
}

/**
 * Une série mérite-t-elle sa propre vignette dans la bibliothèque ? Comme une
 * série télé, dès que le catalogue la connaît pour ce qu'elle est : un tome
 * isolé d'une série de cent tomes reste un tome, pas un livre. Une série sans
 * catalogue — saisie à la main, rattachée à l'aveugle — n'a droit à sa vignette
 * qu'une fois plusieurs tomes réunis, pour qu'un roman unique ne disparaisse
 * pas derrière une série fantôme.
 */
export function shouldGroupAsSeries(input: { volumeCount?: number | null; ownedCount: number }): boolean {
	return input.ownedCount >= 2 || (input.volumeCount ?? 0) >= 2;
}

/** Marqueur de tome dans un titre d'édition : « , tome 51 », « - T. 3 », « vol. 2 ». */
const VOLUME_IN_TITLE = /[\s.,:;–—-]\s*\b(?:tomes?|volumes?|vol|t)\.?\s*(\d+(?:[.,]\d+)?)\b/i;

/** À défaut de marqueur, un nombre isolé en fin de titre : « One piece. 112 ». */
const TRAILING_VOLUME = /[\s.,:;–—-]\s*(\d{1,4})\s*$/;

/**
 * Le titre de la série et le numéro du tome, tirés du titre d'une édition.
 *
 * Google Books décrit très bien un tome mais ignore complètement la notion de
 * série : sans cette lecture du titre, un tome ajouté par son code-barres
 * resterait un livre isolé, sans page de série ni tome suivant. Les mentions
 * d'édition qui suivent le nom de la série sont écartées, sans quoi « One
 * Piece - Édition originale - Tome 51 » créerait une série à lui tout seul.
 */
export function splitSeriesTitle(title: string): {
	seriesTitle: string | null;
	volume: number | null;
} {
	const trimmed = title.trim();
	const match = VOLUME_IN_TITLE.exec(trimmed) ?? TRAILING_VOLUME.exec(trimmed);
	if (!match) return { seriesTitle: null, volume: null };
	const volume = Number(match[1].replace(',', '.'));
	const prefix = trimmed.slice(0, match.index).trim();
	if (!prefix) return { seriesTitle: null, volume: null };
	// La série est le premier fragment du titre ; ce qui suit qualifie l'édition.
	const segment = prefix
		.split(/\s*[-–—:;,/]\s*|\.\s+/)
		.map((part) => part.trim())
		.find((part) => {
			if (!part || !/\p{L}/u.test(part)) return false;
			const normalized = normalizeBookTitle(part);
			// « Tome 3 » tout seul n'est le nom d'aucune série.
			return (
				!EDITION_NOISE.test(normalized) &&
				!VOLUME_WORD.test(normalized) &&
				!VOLUME_ONLY.test(normalized)
			);
		});
	return { seriesTitle: segment ?? null, volume: segment ? volume : null };
}

/** Deux titres désignent-ils la même série ? */
export function sameSeries(a: string | null | undefined, b: string | null | undefined): boolean {
	if (!a || !b) return false;
	return normalizeBookTitle(a) === normalizeBookTitle(b);
}
