<script lang="ts">
	import { tmdbImg } from '$lib/format';

	/**
	 * `grid` : l'affiche est une vignette d'une grille de bibliothèque. TMDB
	 * sert alors deux largeurs et le navigateur prend la plus petite qui
	 * convienne — sur un téléphone, une colonne fait une centaine de pixels,
	 * inutile d'y télécharger une image de 342 px de large.
	 */
	let {
		path,
		alt = '',
		size = 'w342',
		fallback = '📺',
		grid = false
	}: {
		path: string | null;
		alt?: string;
		size?: 'w185' | 'w342' | 'w500' | 'w780';
		fallback?: string;
		grid?: boolean;
	} = $props();

	const srcset = $derived(
		grid && path ? `${tmdbImg(path, 'w185')} 185w, ${tmdbImg(path, 'w342')} 342w` : undefined
	);
	// Trois colonnes sur mobile, jusqu'à sept sur très grand écran.
	const sizes =
		'(min-width: 1280px) 15vw, (min-width: 1024px) 17vw, (min-width: 768px) 20vw, (min-width: 640px) 25vw, 31vw';
</script>

{#if path}
	<img
		src={tmdbImg(path, size)}
		{srcset}
		sizes={srcset ? sizes : undefined}
		{alt}
		loading="lazy"
		decoding="async"
		class="h-full w-full object-cover"
	/>
{:else}
	<div class="flex h-full w-full items-center justify-center bg-card-hover text-2xl" aria-label={alt}>
		{fallback}
	</div>
{/if}
