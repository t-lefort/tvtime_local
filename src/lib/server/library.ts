import { sql } from 'drizzle-orm';
import type { LibraryCounts } from '$lib/library';
import { db } from './db';

/** Nombre d'éléments par catalogue, pour le sélecteur de type de média. */
export function getLibraryCounts(userId: number): LibraryCounts {
	const row = db.get<LibraryCounts>(sql`
		SELECT
			(SELECT COUNT(*) FROM user_shows WHERE user_id = ${userId}) AS series,
			(SELECT COUNT(*) FROM user_movies WHERE user_id = ${userId}) AS films,
			(SELECT COUNT(*) FROM user_books WHERE user_id = ${userId}) AS livres
	`);
	return { series: row?.series ?? 0, films: row?.films ?? 0, livres: row?.livres ?? 0 };
}
