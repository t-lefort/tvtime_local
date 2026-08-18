<script lang="ts">
	import { LIBRARY_SECTIONS } from '$lib/library';
</script>

<!-- Seule la bibliothèque vide arrive ici : sinon le load redirige vers le
	 catalogue le plus fourni. -->
<svelte:head><title>Bibliothèque — TV Time local</title></svelte:head>

<h1 class="mb-5 text-2xl font-bold">Bibliothèque</h1>

<p class="mb-4 text-sm text-mut">
	Votre bibliothèque est vide. Choisissez un catalogue pour ajouter vos premiers titres.
</p>

<div class="grid gap-3 sm:grid-cols-3">
	{#each LIBRARY_SECTIONS as section (section.key)}
		<a href={section.addHref} class="rounded-2xl bg-card p-5 transition-colors hover:bg-card-hover">
			<p class="text-3xl">{section.icon}</p>
			<h2 class="mt-3 text-lg font-bold">{section.label}</h2>
			<p class="text-sm text-mut">Ajouter {section.key === 'series' ? 'une série' : section.key === 'films' ? 'un film' : 'un livre'}</p>
		</a>
	{/each}
</div>
