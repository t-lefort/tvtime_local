/**
 * Choix des sources d'une couverture d'édition. Séparé du téléchargement pour
 * rester testable sans réseau ni base.
 */

/** Ce qu'il faut d'un livre pour lui chercher une couverture. */
export interface CoverSubject {
	coverUrl: string | null;
	isbn13: string | null;
	isbn10: string | null;
	externalSource: string | null;
	externalId: string | null;
}

/**
 * Google renvoie la même image « couverture indisponible » pour tous les ISBN
 * qu'il ne connaît pas, avec un code 200 : seule son empreinte permet de la
 * distinguer d'une vraie couverture.
 */
const PLACEHOLDER_DIGESTS = new Set(['ba8cd5043eedf32e39a4f328a4ec22f8a7dbbaba']);

export function isPlaceholderCover(digest: string): boolean {
	return PLACEHOLDER_DIGESTS.has(digest);
}

/**
 * Adresses à essayer dans l'ordre, de la plus fidèle à l'édition à la plus
 * approximative. La couverture enregistrée par le catalogue passe d'abord ;
 * les suivantes rattrapent les éditions arrivées sans image (import Bubble,
 * notice BnF, saisie manuelle) et celles dont la source ne répond plus.
 */
export function coverSources(book: CoverSubject): string[] {
	const sources: string[] = [];
	// Certaines sources historiques donnent des adresses en clair : la page est
	// servie en HTTPS, un mélange des deux serait bloqué par le navigateur.
	if (book.coverUrl) sources.push(book.coverUrl.replace(/^http:/, 'https:'));
	if (book.isbn13) {
		sources.push(
			`https://books.google.com/books/content?vid=ISBN${book.isbn13}&printsec=frontcover&img=1&zoom=1`,
			`https://covers.openlibrary.org/b/isbn/${book.isbn13}-L.jpg?default=false`
		);
	}
	if (book.isbn10) sources.push(`https://covers.openlibrary.org/b/isbn/${book.isbn10}-L.jpg?default=false`);
	if (book.externalSource === 'bnf' && book.externalId?.includes('ark:/')) {
		const ark = book.externalId.slice(book.externalId.indexOf('ark:/'));
		sources.push(`https://catalogue.bnf.fr/couverture?&appName=NE&idArk=${ark}&couverture=1`);
	}
	return [...new Set(sources)];
}
