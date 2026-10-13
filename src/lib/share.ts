import { formatVolumeNumber } from './books';
import type { LibrarySection } from './library';

/**
 * Partage d'un catalogue de la bibliothèque. L'instance n'est joignable que
 * par quelques comptes : on ne partage donc pas un lien mais une copie — texte,
 * image, page HTML autonome ou PDF — que le destinataire lit sans se connecter.
 */

export type ShareKind = LibrarySection;

export interface ShareItem {
	title: string;
	/** « 2023 », « Eiichirō Oda · tomes 1 à 12 »… */
	detail: string | null;
	/** Affiche TMDB (publique) ou couverture du cache local (`/couvertures/…`). */
	image: string | null;
	rating: number | null;
	favorite: boolean;
}

export interface ShareSection {
	label: string;
	items: ShareItem[];
}

export interface ShareList {
	kind: ShareKind;
	owner: string;
	sections: ShareSection[];
}

export interface ShareOptions {
	/** Afficher les notes personnelles et les favoris. */
	ratings: boolean;
}

/** Sous-ensembles proposés au partage, par catalogue. Le premier est le défaut. */
export const SHARE_FILTERS = {
	series: [
		{ key: 'toutes', label: 'Toutes' },
		{ key: 'encours', label: 'En cours' },
		{ key: 'terminees', label: 'Terminées' },
		{ key: 'favoris', label: 'Favorites' },
		{ key: 'notees', label: 'Notées' }
	],
	films: [
		{ key: 'tous', label: 'Tous' },
		{ key: 'vus', label: 'Vus' },
		{ key: 'avoir', label: 'À voir' },
		{ key: 'favoris', label: 'Favoris' },
		{ key: 'notes', label: 'Notés' }
	],
	livres: [
		{ key: 'tous', label: 'Tous' },
		{ key: 'lus', label: 'Lus' },
		{ key: 'encours', label: 'En cours' },
		{ key: 'alire', label: 'À lire' },
		{ key: 'envies', label: 'Envies' },
		{ key: 'favoris', label: 'Favoris' }
	]
} as const satisfies Record<ShareKind, readonly { key: string; label: string }[]>;

const KIND_WORDS: Record<ShareKind, { icon: string; noun: string }> = {
	series: { icon: '📺', noun: 'séries' },
	films: { icon: '🎬', noun: 'films' },
	livres: { icon: '📚', noun: 'livres' }
};

export function parseShareKind(value: string | null | undefined): ShareKind {
	return value === 'films' || value === 'livres' ? value : 'series';
}

export function parseShareFilter(kind: ShareKind, value: string | null | undefined): string {
	const filters = SHARE_FILTERS[kind];
	return filters.find((filter) => filter.key === value)?.key ?? filters[0].key;
}

export function shareFilterLabel(kind: ShareKind, filter: string): string {
	return SHARE_FILTERS[kind].find((item) => item.key === filter)?.label ?? '';
}

export function shareCount(list: ShareList): number {
	return list.sections.reduce((total, section) => total + section.items.length, 0);
}

/** « Les séries de Thomas », « Les livres de Thomas ». */
export function shareTitle(list: Pick<ShareList, 'kind' | 'owner'>): string {
	return `Les ${KIND_WORDS[list.kind].noun} de ${list.owner}`;
}

export function shareIcon(kind: ShareKind): string {
	return KIND_WORDS[kind].icon;
}

/** Nom de fichier sans accents ni espaces : « series-thomas-2026-10-13 ». */
export function shareFileName(list: Pick<ShareList, 'kind' | 'owner'>, date: string): string {
	const slug = (value: string) =>
		value
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	return [slug(list.kind), slug(list.owner), date].filter(Boolean).join('-');
}

/** Note et favori tels qu'ils s'affichent derrière un titre : « ★ 9/10 ♥ ». */
export function shareMarks(item: ShareItem, options: ShareOptions): string {
	if (!options.ratings) return '';
	return [item.rating !== null ? `★ ${item.rating}/10` : '', item.favorite ? '♥' : '']
		.filter(Boolean)
		.join(' ');
}

/** La liste en texte brut, prête à coller dans une messagerie. */
export function shareText(list: ShareList, options: ShareOptions): string {
	const lines = [`${shareIcon(list.kind)} ${shareTitle(list)} (${shareCount(list)})`];
	for (const section of list.sections) {
		lines.push('', `${section.label} (${section.items.length})`);
		for (const item of section.items) {
			const detail = item.detail ? ` (${item.detail})` : '';
			const marks = shareMarks(item, options);
			lines.push(`• ${item.title}${detail}${marks ? ` ${marks}` : ''}`);
		}
	}
	return lines.join('\n');
}

/**
 * Tomes possédés d'une série, en plages : [1, 2, 3, 5, 7, 8] → « tomes 1 à 3,
 * 5, 7 à 8 ». Les tomes sans numéro ne se comptent qu'à la fin.
 */
export function formatVolumeRanges(volumes: (number | null)[]): string {
	const numbers = [...new Set(volumes.filter((volume): volume is number => volume !== null))].sort(
		(a, b) => a - b
	);
	const unnumbered = volumes.length - volumes.filter((volume) => volume !== null).length;
	const ranges: string[] = [];
	for (let i = 0; i < numbers.length; ) {
		let end = i;
		// Une plage ne court que sur des entiers consécutifs : un hors-série
		// « 2,5 » se cite à part.
		while (
			end + 1 < numbers.length &&
			Number.isInteger(numbers[end]) &&
			numbers[end + 1] === numbers[end] + 1
		)
			end++;
		ranges.push(
			end === i
				? formatVolumeNumber(numbers[i])
				: `${formatVolumeNumber(numbers[i])} à ${formatVolumeNumber(numbers[end])}`
		);
		i = end + 1;
	}
	const counted = numbers.length + unnumbered;
	const label = numbers.length === 1 && !unnumbered ? 'tome' : 'tomes';
	if (!numbers.length) return `${counted} ${counted > 1 ? 'tomes' : 'tome'}`;
	return `${label} ${ranges.join(', ')}${unnumbered ? ` + ${unnumbered} hors numérotation` : ''}`;
}
