<script lang="ts">
	import Poster from './Poster.svelte';

	interface Variant {
		languageCode: string;
		languageName: string;
		titles: string[];
		posterPath: string | null;
	}

	let {
		variants,
		fallback = '📺'
	}: { variants: Variant[]; fallback?: string } = $props();
</script>

{#if variants.length}
	<details class="group mt-5 overflow-hidden rounded-xl bg-card">
		<summary
			class="flex cursor-pointer list-none items-center gap-3 p-3.5 select-none [&::-webkit-details-marker]:hidden"
		>
			<svg
				viewBox="0 0 24 24"
				class="h-4 w-4 shrink-0 text-mut transition-transform group-open:rotate-90"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M9 6l6 6-6 6" />
			</svg>
			<span class="font-semibold">Titres et affiches dans d'autres langues</span>
			<span class="text-xs text-mut">{variants.length}</span>
		</summary>
		<div class="border-t border-line/70 p-3.5">
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each variants as variant (variant.languageCode)}
					<article class="min-w-0 overflow-hidden rounded-lg bg-card-hover">
						<div class="aspect-[2/3]">
							<Poster
								path={variant.posterPath}
								alt={variant.titles[0] || `Affiche en ${variant.languageName}`}
								size="w342"
								{fallback}
							/>
						</div>
						<div class="p-2.5">
							<p class="text-[11px] font-semibold tracking-wide text-brand uppercase">
								{variant.languageName}
							</p>
							{#if variant.titles.length}
								<p class="mt-1 text-sm leading-snug font-medium">{variant.titles[0]}</p>
								{#each variant.titles.slice(1) as title (title)}
									<p class="mt-0.5 text-xs leading-snug text-mut">{title}</p>
								{/each}
							{:else}
								<p class="mt-1 text-xs text-mut">Affiche disponible</p>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		</div>
	</details>
{/if}
