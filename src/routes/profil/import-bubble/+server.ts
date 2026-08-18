import { json } from '@sveltejs/kit';
import { getBubbleImportJob } from '$lib/server/bubble-import';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) return json(null, { status: 401 });
	return json(getBubbleImportJob(locals.user.id));
};
