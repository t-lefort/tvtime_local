/** Retire les separateurs usuels sans accepter d'autres caracteres. */
export function compactIsbn(value: string): string {
	return value.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function isValidIsbn10(value: string): boolean {
	const isbn = compactIsbn(value);
	if (!/^\d{9}[\dX]$/.test(isbn)) return false;
	let sum = 0;
	for (let i = 0; i < 10; i++) sum += (10 - i) * (isbn[i] === 'X' ? 10 : Number(isbn[i]));
	return sum % 11 === 0;
}

export function isValidIsbn13(value: string): boolean {
	const isbn = compactIsbn(value);
	if (!/^97[89]\d{10}$/.test(isbn)) return false;
	let sum = 0;
	for (let i = 0; i < 12; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
	return (10 - (sum % 10)) % 10 === Number(isbn[12]);
}

export function isbn10To13(value: string): string | null {
	const isbn10 = compactIsbn(value);
	if (!isValidIsbn10(isbn10)) return null;
	const base = `978${isbn10.slice(0, 9)}`;
	let sum = 0;
	for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
	return `${base}${(10 - (sum % 10)) % 10}`;
}

/** Renvoie toujours un ISBN-13 canonique, ou null si la saisie est invalide. */
export function normalizeIsbn(value: string): string | null {
	const compact = compactIsbn(value);
	if (isValidIsbn13(compact)) return compact;
	return isbn10To13(compact);
}

export function isbn13To10(value: string): string | null {
	const isbn13 = compactIsbn(value);
	if (!isValidIsbn13(isbn13) || !isbn13.startsWith('978')) return null;
	const base = isbn13.slice(3, 12);
	let sum = 0;
	for (let i = 0; i < 9; i++) sum += Number(base[i]) * (10 - i);
	const check = (11 - (sum % 11)) % 11;
	return `${base}${check === 10 ? 'X' : check}`;
}
