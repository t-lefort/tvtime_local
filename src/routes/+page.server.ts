import { db } from '$lib/server/db';
import { watches } from '$lib/server/db/schema';
import { getUpcoming, getWatchNext } from '$lib/server/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return {
		watchNext: getWatchNext(),
		upcoming: getUpcoming()
	};
};

export const actions: Actions = {
	watch: async ({ request }) => {
		const data = await request.formData();
		const episodeId = Number(data.get('episodeId'));
		if (episodeId) {
			db.insert(watches).values({ episodeId }).run();
		}
		return { success: true };
	}
};
