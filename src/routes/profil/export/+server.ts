import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

/** Télécharge un instantané complet de la base (SQLite online backup, sûr même en cours d'écriture). */
export const GET: RequestHandler = async () => {
	const tmp = path.join(os.tmpdir(), `tvtime-export-${Date.now()}.db`);
	try {
		await db.$client.backup(tmp);
		const buf = fs.readFileSync(tmp);
		const date = new Date().toISOString().slice(0, 10);
		return new Response(new Uint8Array(buf), {
			headers: {
				'Content-Type': 'application/vnd.sqlite3',
				'Content-Disposition': `attachment; filename="tvtime-${date}.db"`,
				'Content-Length': String(buf.length)
			}
		});
	} finally {
		fs.rmSync(tmp, { force: true });
	}
};
