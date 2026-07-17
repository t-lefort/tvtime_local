<script lang="ts">
	/** Note moyenne TMDB (0–10). Rien n'est affiché si absente ou nulle. */
	let { value }: { value: number | null | undefined } = $props();
</script>

{#if value}
	<span
		class="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-400"
		title="Note moyenne TMDB"
	>
		★ {value.toFixed(1)}
	</span>
{/if}
