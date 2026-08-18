import { parse } from 'csv-parse/sync';

export type BubbleRow = Record<string, string>;

export function parseBubbleCsv(content: string): BubbleRow[] {
	return parse(content.replace(/^\uFEFF/, ''), {
		columns: (headers: string[]) => headers.map((header) => header.trim()),
		delimiter: ';',
		skip_empty_lines: true,
		relax_column_count: true,
		trim: true
	}) as BubbleRow[];
}

export function bubbleText(row: BubbleRow, name: string): string {
	return String(row[name] ?? '').trim();
}

/** Bubble exporte ses cases cochees sous forme de symbole non vide (parfois affiche « ? »). */
export function bubbleChecked(value: string): boolean {
	const normalized = value.trim().toLocaleLowerCase('fr');
	return Boolean(normalized) && !['0', 'false', 'faux', 'non', 'no', 'null'].includes(normalized);
}

export function bubbleNumber(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number(trimmed.replace(',', '.'));
	return Number.isFinite(parsed) ? parsed : null;
}

export function bubbleRating(value: string): number | null {
	const parsed = bubbleNumber(value);
	return parsed !== null && parsed >= 1 && parsed <= 10 ? Math.round(parsed) : null;
}

export function bubbleAuthors(value: string): string[] {
	return value
		.split(/\s*(?:,|\||\/|;|\s+&\s+)\s*/)
		.map((author) => author.trim())
		.filter(Boolean);
}
