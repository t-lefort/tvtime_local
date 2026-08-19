import { coverResponse, getSeriesVolumeCover } from '$lib/server/covers';
import type { RequestHandler } from './$types';

/**
 * Couverture d'un tome du catalogue, possédé ou non. Même cache que les livres
 * de la bibliothèque : une page de série affiche cent vignettes et ne doit pas
 * dépendre de cent requêtes distantes.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	return coverResponse(Number.isInteger(id) && id > 0 ? await getSeriesVolumeCover(id) : null, request);
};
