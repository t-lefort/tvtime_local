import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvtime-books-test-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'books.db');

const { createUser } = await import('../src/lib/server/users');
const { addOrUpdateBook, collectBook, getBooksForUser, removeUserBook, updateUserBook } = await import(
	'../src/lib/server/books'
);

const alice = createUser('Alice livres');
const bob = createUser('Bob livres');
const edition = addOrUpdateBook(
	{
		isbn13: '9782723427371',
		isbn10: '2723427374',
		title: 'Akira',
		subtitle: null,
		authors: ['Katsuhiro Ōtomo'],
		description: null,
		publisher: 'Glénat',
		publishDate: '1999-04-14',
		language: 'fr',
		pageCount: 359,
		coverUrl: null,
		seriesTitle: 'Akira (1999)',
		volume: '1',
		source: 'manual',
		sourceId: null
	},
	{ category: 'Mangas' }
);

test('le catalogue de livres est partagé mais les états sont isolés par profil', () => {
	collectBook(alice.id, edition, { readingStatus: 'read', rating: 9 });
	collectBook(bob.id, edition, { readingStatus: 'unread' });
	assert.equal(getBooksForUser(alice.id)[0].readingStatus, 'read');
	assert.equal(getBooksForUser(alice.id)[0].rating, 9);
	assert.equal(getBooksForUser(bob.id)[0].readingStatus, 'unread');

	updateUserBook(bob.id, edition.id, { wishlist: true });
	assert.equal(getBooksForUser(bob.id)[0].wishlist, true);
	assert.equal(getBooksForUser(alice.id)[0].wishlist, false);
});

test("retirer un livre d'un profil ne supprime pas l'édition encore utilisée", () => {
	removeUserBook(alice.id, edition.id);
	assert.equal(getBooksForUser(alice.id).length, 0);
	assert.equal(getBooksForUser(bob.id).length, 1);
});
