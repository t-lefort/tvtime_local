<script lang="ts">
	import { tmdbImg } from '$lib/format';
	import type { StoredProviders } from '$lib/server/tmdb';

	let { providers }: { providers: StoredProviders | null } = $props();

	// Location/achat : liste de noms dédoublonnée, en texte discret
	const rentBuy = $derived([
		...new Set([...(providers?.rent ?? []), ...(providers?.buy ?? [])].map((p) => p.name))
	]);
</script>

<section class="mt-6">
	<h2 class="mb-2 text-sm font-semibold tracking-wide text-mut uppercase">Où regarder</h2>
	{#if providers?.streaming.length}
		<div class="flex flex-wrap gap-2">
			{#each providers.streaming as p (p.name)}
				<span class="flex items-center gap-2 rounded-xl bg-card py-1.5 pr-3 pl-1.5 text-sm font-medium">
					{#if p.logoPath}
						<img src={tmdbImg(p.logoPath, 'w92')} alt="" loading="lazy" class="h-7 w-7 rounded-lg" />
					{:else}
						<span class="flex h-7 w-7 items-center justify-center rounded-lg bg-card-hover text-xs">▶</span>
					{/if}
					{p.name}
				</span>
			{/each}
		</div>
	{:else}
		<p class="text-sm text-mut">Sur aucune plateforme de streaming par abonnement en ce moment.</p>
	{/if}
	{#if rentBuy.length}
		<p class="mt-2 text-xs text-mut">Location / achat : {rentBuy.join(', ')}</p>
	{/if}
	<p class="mt-2 text-[11px] text-mut/70">
		Source :
		{#if providers?.link}
			<a href={providers.link} target="_blank" rel="noopener" class="underline">JustWatch</a>
		{:else}
			JustWatch
		{/if}
		via TMDB
	</p>
</section>
