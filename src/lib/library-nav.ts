import { replaceState } from '$app/navigation';
import { page } from '$app/state';

/** Un clic à modificateur reste un vrai clic de lien (nouvel onglet, etc.). */
function opensElsewhere(event: MouseEvent): boolean {
	return event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0;
}

/**
 * Reflète dans l'URL un changement de tri, de filtre ou de recherche d'une
 * liste de la bibliothèque, sans repasser par le serveur : la page a déjà
 * toutes ses données, seule l'adresse doit suivre pour qu'un rechargement ou
 * un partage retrouve le même écran.
 *
 * Renvoie `false` quand le clic doit garder son comportement de lien, auquel
 * cas l'appelant ne doit pas mettre son état local à jour.
 */
export function updateListParams(
	event: MouseEvent | null,
	params: Record<string, string | null>
): boolean {
	if (event) {
		if (opensElsewhere(event)) return false;
		event.preventDefault();
	}
	// L'adresse courante se lit dans le navigateur, pas dans `page.url` :
	// `replaceState` change bien l'URL mais laisse `page.url` sur celle du
	// dernier chargement, et un tri appliqué après un filtre effacerait le filtre.
	const url = new URL(location.href);
	for (const [name, value] of Object.entries(params)) {
		if (value === null) url.searchParams.delete(name);
		else url.searchParams.set(name, value);
	}
	if (url.href !== location.href) replaceState(url, page.state);
	return true;
}
