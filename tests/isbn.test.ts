import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactIsbn, isbn10To13, isbn13To10, isValidIsbn10, isValidIsbn13, normalizeIsbn } from '../src/lib/isbn';

test('valide et normalise les ISBN de Bubble', () => {
	assert.equal(compactIsbn('978-2-7234-2737-1'), '9782723427371');
	assert.equal(isValidIsbn13('9782723427371'), true);
	assert.equal(isValidIsbn13('9782723427372'), false);
	assert.equal(normalizeIsbn('2-7234-2737-4'), '9782723427371');
});

test('convertit dans les deux sens quand un ISBN-10 existe', () => {
	assert.equal(isValidIsbn10('222646526X'), true);
	assert.equal(isbn10To13('222646526X'), '9782226465269');
	assert.equal(isbn13To10('9782226465269'), '222646526X');
	assert.equal(isbn13To10('9791090636076'), null);
});
