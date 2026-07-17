import { db } from '$lib/server/db';
import { watches } from '$lib/server/db/schema';
import { getUpcoming, getWatchNext } from '$lib/server/queries';
import { getUserById, requireUser } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	return {
		watchNext: getWatchNext(user.id),
		upcoming: getUpcoming(user.id),
		hideEpisodeOverviews: Boolean(getUserById(user.id)?.hideEpisodeOverviews)
	};
};

export const actions: Actions = {
	watch: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const episodeId = Number(data.get('episodeId'));
		if (episodeId) {
			db.insert(watches).values({ userId: user.id, episodeId }).run();
		}
		return { success: true };
	}
};
