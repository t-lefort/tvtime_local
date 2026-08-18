<script lang="ts">
	let {
		url,
		alt = '',
		fallback = '📚'
	}: { url: string | null; alt?: string; fallback?: string } = $props();
	let failed = $state(false);
</script>

{#if url && !failed}
	<img
		src={url}
		{alt}
		loading="lazy"
		referrerpolicy="no-referrer"
		class="h-full w-full object-cover"
		onerror={() => (failed = true)}
	/>
{:else}
	<div class="flex h-full w-full items-center justify-center bg-card-hover text-3xl" aria-label={alt}>
		{fallback}
	</div>
{/if}
