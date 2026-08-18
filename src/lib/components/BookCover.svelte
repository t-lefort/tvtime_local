<script lang="ts">
	/**
	 * Couverture d'une édition. Un livre déjà dans la bibliothèque passe par le
	 * cache local (`/couvertures/…`), qui essaie plusieurs catalogues et ne les
	 * rappelle plus ensuite ; un résultat de recherche, pas encore ajouté,
	 * n'existe que chez la source et garde son adresse d'origine.
	 */
	let {
		url = null,
		bookId = null,
		alt = '',
		fallback = '📚'
	}: { url?: string | null; bookId?: number | null; alt?: string; fallback?: string } = $props();

	const src = $derived(bookId ? `/couvertures/${bookId}` : url);
	// Mémorise l'adresse en échec plutôt qu'un simple drapeau : la vignette est
	// réutilisée d'un livre à l'autre quand la liste est filtrée.
	let failed = $state<string | null>(null);
</script>

{#if src && failed !== src}
	<img
		{src}
		{alt}
		loading="lazy"
		decoding="async"
		referrerpolicy="no-referrer"
		class="h-full w-full object-cover"
		onerror={() => (failed = src)}
	/>
{:else}
	<div class="flex h-full w-full items-center justify-center bg-card-hover text-3xl" aria-label={alt}>
		{fallback}
	</div>
{/if}
