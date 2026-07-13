/**
 * Corrige les séries importées à tort comme « arrêtées » (issue #16).
 *
 * TV Time archive/désactive une série dès qu'on a vu tous ses épisodes, même si
 * elle est toujours en production et qu'on souhaite continuer à la regarder.
 * L'ancien import reportait ce drapeau en « arrêtée » (état grisé). On ne garde
 * « arrêtée » que pour les séries réellement terminées selon TMDB
 * (statut Ended ou Canceled) ; toutes les autres repassent en suivi normal.
 *
 * Idempotent et non destructif : ne touche qu'aux suivis marqués arrêtés dont la
 * série n'est pas confirmée terminée par TMDB. Relançable sans risque.
 *
 * Usage : npm run fix:series-arretees
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/lib/server/db';

// `IS NOT 'Ended'` couvre aussi les statuts NULL (série au statut inconnu → non
// confirmée terminée → on la repasse en suivi, conformément à l'import corrigé).
const result = db.run(sql`
	UPDATE user_shows
	SET archived = 0
	WHERE archived = 1
		AND show_id IN (
			SELECT id FROM shows
			WHERE tmdb_status IS NOT 'Ended' AND tmdb_status IS NOT 'Canceled'
		)
`);

console.log(
	`Séries « arrêtées » corrigées (repassées en suivi) : ${result.changes}`
);
