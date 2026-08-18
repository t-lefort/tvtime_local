import { redirect } from '@sveltejs/kit';
import { biggestLibrarySection, librarySection } from '$lib/library';
import { getLibraryCounts } from '$lib/server/library';
import { requireUser } from '$lib/server/users';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const counts = getLibraryCounts(requireUser(locals).id);
	// La bibliothèque n'est pas un menu : on ouvre directement le catalogue le
	// mieux garni, les onglets de la liste suffisent ensuite pour changer de type.
	if (counts.series + counts.films + counts.livres > 0) {
		redirect(307, librarySection(biggestLibrarySection(counts)).href);
	}
	return { counts };
};
