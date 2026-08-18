<script lang="ts">
	import { updateListParams } from '$lib/library-nav';

	/**
	 * Filtre texte d'une liste de la bibliothèque. La liste est déjà chargée :
	 * c'est la page qui filtre à chaque frappe, sans aller-retour serveur.
	 * L'URL suit avec un léger différé, pour qu'un rechargement ou un partage
	 * retrouve la recherche sans que chaque lettre écrive dans l'historique.
	 *
	 * Sans JavaScript, le formulaire GET reste fonctionnel : le rendu serveur
	 * applique le même filtre à partir du paramètre `q`.
	 */
	let {
		value = $bindable(),
		placeholder,
		hidden = {}
	}: { value: string; placeholder: string; hidden?: Record<string, string> } = $props();

	let timer: ReturnType<typeof setTimeout> | undefined;

	function syncUrl() {
		clearTimeout(timer);
		const q = value.trim();
		timer = setTimeout(() => updateListParams(null, { q: q || null }), 250);
	}

	function submit(event: SubmitEvent) {
		// Entrée ne doit rien recharger : les résultats sont déjà à l'écran.
		event.preventDefault();
		clearTimeout(timer);
		updateListParams(null, { q: value.trim() || null });
		(event.target as HTMLFormElement).querySelector('input')?.blur();
	}
</script>

<form method="GET" class="mb-3" onsubmit={submit}>
	{#each Object.entries(hidden) as [name, hiddenValue] (name)}
		<input type="hidden" {name} value={hiddenValue} />
	{/each}
	<input
		type="search"
		name="q"
		bind:value
		oninput={syncUrl}
		{placeholder}
		autocomplete="off"
		enterkeyhint="search"
		class="w-full rounded-xl border border-line bg-card px-4 py-3 text-ink placeholder:text-mut focus:border-brand focus:outline-none"
	/>
</form>
