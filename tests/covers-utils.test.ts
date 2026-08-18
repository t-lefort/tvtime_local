import assert from 'node:assert/strict';
import test from 'node:test';
import { coverSources, isPlaceholderCover, type CoverSubject } from '../src/lib/server/covers-utils';

const subject = (overrides: Partial<CoverSubject> = {}): CoverSubject => ({
	coverUrl: null,
	isbn13: null,
	isbn10: null,
	externalSource: null,
	externalId: null,
	...overrides
});

test('la couverture du catalogue passe avant les sources de secours', () => {
	const sources = coverSources(subject({ coverUrl: 'https://inventaire.io/img/entities/abc', isbn13: '9782723427371' }));
	assert.equal(sources[0], 'https://inventaire.io/img/entities/abc');
	assert.ok(sources.length > 1, 'les sources de secours restent proposées');
});

test('une adresse en clair est remontée en HTTPS', () => {
	assert.equal(
		coverSources(subject({ coverUrl: 'http://books.google.com/cover.jpg' }))[0],
		'https://books.google.com/cover.jpg'
	);
});

test('une édition sans image est rattrapée par son ISBN', () => {
	const sources = coverSources(subject({ isbn13: '9782723427371', isbn10: '2723427374' }));
	assert.ok(sources.some((url) => url.includes('vid=ISBN9782723427371')));
	assert.ok(sources.some((url) => url.includes('isbn/9782723427371-L.jpg')));
	assert.ok(sources.some((url) => url.includes('isbn/2723427374-L.jpg')));
});

test('une notice BnF est rattrapée par son ark', () => {
	const sources = coverSources(
		subject({ externalSource: 'bnf', externalId: 'http://catalogue.bnf.fr/ark:/12148/cb37654321z' })
	);
	assert.deepEqual(sources, [
		'https://catalogue.bnf.fr/couverture?&appName=NE&idArk=ark:/12148/cb37654321z&couverture=1'
	]);
});

test('une édition sans identifiant exploitable n’a aucune source', () => {
	assert.deepEqual(coverSources(subject()), []);
	assert.deepEqual(coverSources(subject({ externalSource: 'bnf', externalId: 'OL123M' })), []);
});

test('l’image « couverture indisponible » de Google n’est pas une couverture', () => {
	assert.equal(isPlaceholderCover('ba8cd5043eedf32e39a4f328a4ec22f8a7dbbaba'), true);
	assert.equal(isPlaceholderCover('5e33d6065c5437040a223276138e5df8743cd300'), false);
});
