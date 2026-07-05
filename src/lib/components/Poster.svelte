<script lang="ts">
	import { tmdbImg } from '$lib/format';

	let {
		path,
		alt = '',
		size = 'w342',
		fallback = '📺'
	}: { path: string | null; alt?: string; size?: 'w185' | 'w342' | 'w500' | 'w780'; fallback?: string } = $props();
</script>

{#if path}
	<img src={tmdbImg(path, size)} {alt} loading="lazy" class="h-full w-full object-cover" />
{:else}
	<div class="flex h-full w-full items-center justify-center bg-card-hover text-2xl" aria-label={alt}>
		{fallback}
	</div>
{/if}
