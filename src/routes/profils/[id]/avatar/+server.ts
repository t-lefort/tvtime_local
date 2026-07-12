import { error } from '@sveltejs/kit';
import { getUserById } from '$lib/server/users';
import type { RequestHandler } from './$types';

/** Image d'un profil (affichée sur le sélecteur, donc accessible avant connexion au profil). */
export const GET: RequestHandler = ({ params }) => {
	const id = Number(params.id);
	const user = Number.isInteger(id) && id > 0 ? getUserById(id) : undefined;
	if (!user?.avatar || !user.avatarType) error(404, 'Pas d’image');
	return new Response(new Uint8Array(user.avatar), {
		headers: {
			'Content-Type': user.avatarType,
			'Cache-Control': 'no-cache'
		}
	});
};
