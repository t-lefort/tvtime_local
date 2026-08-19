import { coverResponse, getCover } from '$lib/server/covers';
import type { RequestHandler } from './$types';

/** Couverture d'un livre de la bibliothèque, servie depuis le cache local. */
export const GET: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	return coverResponse(Number.isInteger(id) && id > 0 ? await getCover(id) : null, request);
};
