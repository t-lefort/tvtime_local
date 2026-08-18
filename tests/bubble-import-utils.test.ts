import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	bubbleAuthors,
	bubbleChecked,
	bubbleNumber,
	bubbleRating,
	parseBubbleCsv
} from '../src/lib/server/bubble-import-utils';

const csv = `"Titre de la série";"Type";"Collection";"Catégory";"Titre de l'album";"EAN";"Tome";"Date de publication";"Editeur";"Auteurs";"Prix";"Date d'ajout";"Dans ma collection";"Lu";"Dédicacé";"Edition originale";"Prété à";"Tirage de tête";"Série limitée";"Version numérique";"A vendre";"Numérotation";"Prix d'achat";"Cote";"Etat";"Ma note de l'album";"Mon avis de l'album";"Ma note de la série";"Mon avis de la série"
"78140 Velizy";;;"BD";;"9782378940997";;"2020-11-13T00:00:00.000Z";"Les Reveurs";"Manu Larcenet";"60.00";;"?";"?";;;;;;;;;;"";"";"";"";""
"Akira (1999)";"album simple N&B";;"Mangas";;"9782723427371";1;"1999-04-14T00:00:00.000Z";"Glénat";"Katsuhiro Ōtomo";"14.95";;"?";"?";;;;;;;;;;"";"";"";"";""`;

test("lit le CSV Bubble au séparateur point-virgule et conserve les accents", () => {
	const rows = parseBubbleCsv(csv);
	assert.equal(rows.length, 2);
	assert.equal(rows[0]['Titre de la série'], '78140 Velizy');
	assert.equal(rows[1].Auteurs, 'Katsuhiro Ōtomo');
	assert.equal(rows[1].Tome, '1');
	assert.equal(rows[1]['Catégory'], 'Mangas');
});

test('interprète les cases, nombres, notes et auteurs Bubble', () => {
	assert.equal(bubbleChecked('?'), true);
	assert.equal(bubbleChecked('non'), false);
	assert.equal(bubbleChecked(''), false);
	assert.equal(bubbleNumber('14,95'), 14.95);
	assert.equal(bubbleNumber(''), null);
	assert.equal(bubbleRating('11'), null);
	assert.deepEqual(bubbleAuthors('Alice, Bob / Chloé'), ['Alice', 'Bob', 'Chloé']);
});
