<script lang="ts">
	import { updateListParams } from '$lib/library-nav';
	import { DEFAULT_SORT, SORT_LABELS, SORT_ORDERS, type SortOrder } from '$lib/sort';

	/**
	 * Choix de l'ordre d'affichage. Le tri est appliqué par la page sur les
	 * données déjà chargées : le lien reste là pour le rendu sans JavaScript et
	 * pour l'ouverture dans un nouvel onglet.
	 *
	 * `params` porte les autres paramètres à conserver (filtre et recherche).
	 */
	let {
		base,
		sort = $bindable(),
		params = {}
	}: { base: string; sort: SortOrder; params?: Record<string, string> } = $props();

	function href(order: SortOrder) {
		const search = new URLSearchParams(params);
		if (order === DEFAULT_SORT) search.delete('tri');
		else search.set('tri', order);
		const query = search.toString();
		return query ? `${base}?${query}` : base;
	}

	function choose(event: MouseEvent, order: SortOrder) {
		if (updateListParams(event, { tri: order === DEFAULT_SORT ? null : order })) sort = order;
	}
</script>

<div class="mb-5 flex items-center justify-end gap-2 text-xs">
	<span class="text-mut">Trier par</span>
	<div class="flex overflow-hidden rounded-full bg-card p-0.5">
		{#each SORT_ORDERS as order (order)}
			<a
				href={href(order)}
				onclick={(event) => choose(event, order)}
				aria-current={sort === order ? 'true' : undefined}
				class="rounded-full px-3 py-1 font-medium transition-colors
					{sort === order ? 'bg-brand text-brand-ink' : 'text-mut hover:text-ink'}"
			>
				{SORT_LABELS[order]}
			</a>
		{/each}
	</div>
</div>
