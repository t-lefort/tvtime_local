<script lang="ts">let { data } = $props();</script>
<svelte:head><title>Bibliothèque — TV Time local</title></svelte:head>
<h1 class="mb-5 text-2xl font-bold">Bibliothèque</h1>
<div class="grid gap-3 sm:grid-cols-3">
	<a href="/series" class="rounded-2xl bg-card p-5 transition-colors hover:bg-card-hover"><p class="text-3xl">📺</p><h2 class="mt-3 text-lg font-bold">Séries</h2><p class="text-sm text-mut">{data.shows} série{data.shows > 1 ? 's' : ''}</p></a>
	<a href="/films" class="rounded-2xl bg-card p-5 transition-colors hover:bg-card-hover"><p class="text-3xl">🎬</p><h2 class="mt-3 text-lg font-bold">Films</h2><p class="text-sm text-mut">{data.movies} film{data.movies > 1 ? 's' : ''}</p></a>
	<a href="/livres" class="rounded-2xl bg-card p-5 transition-colors hover:bg-card-hover"><p class="text-3xl">📚</p><h2 class="mt-3 text-lg font-bold">Livres</h2><p class="text-sm text-mut">{data.books} livre{data.books > 1 ? 's' : ''}</p></a>
</div>
