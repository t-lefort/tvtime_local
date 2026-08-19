<script lang="ts">
	/**
	 * Bandeau d'un livre ou d'une série de livres.
	 *
	 * Un livre n'a pas d'image large comme un film a son fond d'écran : sa
	 * couverture agrandie et floutée en tient lieu. Elle reste **opaque** et
	 * c'est un dégradé qui la fond dans la page — la rendre translucide la
	 * délavait sur le fond de la carte et donnait ce voile grisâtre que rien ne
	 * rattrapait. Un léger assombrissement suffit à faire ressortir ce qui se
	 * pose par-dessus.
	 */
	let {
		bookId = null,
		volumeId = null,
		url = null,
		/** Vers quelle couleur le bandeau se fond : le fond de page ou celui d'une carte. */
		tone = 'page',
		children
	}: {
		bookId?: number | null;
		volumeId?: number | null;
		url?: string | null;
		tone?: 'page' | 'card';
		children?: import('svelte').Snippet;
	} = $props();

	const src = $derived(
		bookId ? `/couvertures/${bookId}` : volumeId ? `/couvertures/tome/${volumeId}` : url
	);
	let failed = $state(false);

	const fade = $derived(
		tone === 'card'
			? 'bg-gradient-to-t from-card via-card/75 to-card/25'
			: 'bg-gradient-to-t from-bg via-bg/60 to-bg/20'
	);
</script>

<div class="absolute inset-0 overflow-hidden bg-card">
	{#if src && !failed}
		<img
			{src}
			alt=""
			aria-hidden="true"
			decoding="async"
			referrerpolicy="no-referrer"
			class="h-full w-full scale-150 object-cover blur-2xl saturate-150"
			onerror={() => (failed = true)}
		/>
	{/if}
	<div class="absolute inset-0 {fade}"></div>
</div>
{@render children?.()}
