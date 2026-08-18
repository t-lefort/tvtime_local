<script lang="ts">
	import { DEFAULT_SORT, SORT_LABELS, SORT_ORDERS, type SortOrder } from '$lib/sort';

	/** `params` porte les autres paramètres à conserver (le filtre courant). */
	let {
		base,
		sort,
		params = {}
	}: { base: string; sort: SortOrder; params?: Record<string, string> } = $props();

	function href(order: SortOrder) {
		const search = new URLSearchParams(params);
		if (order === DEFAULT_SORT) search.delete('tri');
		else search.set('tri', order);
		const query = search.toString();
		return query ? `${base}?${query}` : base;
	}
</script>

<div class="mb-5 flex items-center justify-end gap-2 text-xs">
	<span class="text-mut">Trier par</span>
	<div class="flex overflow-hidden rounded-full bg-card p-0.5">
		{#each SORT_ORDERS as order (order)}
			<a
				href={href(order)}
				data-sveltekit-replacestate
				aria-current={sort === order ? 'true' : undefined}
				class="rounded-full px-3 py-1 font-medium transition-colors
					{sort === order ? 'bg-brand text-brand-ink' : 'text-mut hover:text-ink'}"
			>
				{SORT_LABELS[order]}
			</a>
		{/each}
	</div>
</div>
