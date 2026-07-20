import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return { hideSuggestions: Boolean(locals.user?.hideSuggestions) };
};
