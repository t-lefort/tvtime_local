<script lang="ts">
	import { enhance } from '$app/forms';

	/** Note personnelle du profil (1–10) ; cliquer sur la note actuelle la retire. */
	let { value, action = '?/rate' }: { value: number | null; action?: string } = $props();

	let hovered = $state<number | null>(null);
	let pending = $state(false);

	const shown = $derived(hovered ?? value ?? 0);
</script>

<form
	method="POST"
	{action}
	use:enhance={() => {
		pending = true;
		return async ({ update }) => {
			await update();
			pending = false;
		};
	}}
	class="flex flex-wrap items-center gap-x-2 gap-y-1"
>
	<span class="text-sm font-semibold">Ma note</span>
	<div
		class="flex"
		role="group"
		aria-label="Ma note sur 10"
		onmouseleave={() => (hovered = null)}
	>
		{#each Array.from({ length: 10 }, (_, i) => i + 1) as n (n)}
			<button
				name="rating"
				value={n === value ? 0 : n}
				disabled={pending}
				aria-label="{n} sur 10"
				title={n === value ? 'Retirer ma note' : `Noter ${n}/10`}
				onmouseenter={() => (hovered = n)}
				onfocus={() => (hovered = n)}
				onblur={() => (hovered = null)}
				class="px-0.5 text-xl leading-none transition-colors disabled:opacity-50
					{n <= shown ? 'text-amber-400' : 'text-line hover:text-mut'}"
			>
				★
			</button>
		{/each}
	</div>
	{#if value}
		<span class="text-sm font-semibold text-amber-400">{value}/10</span>
		<span class="text-xs text-mut">(cliquez sur la même étoile pour retirer)</span>
	{/if}
</form>
