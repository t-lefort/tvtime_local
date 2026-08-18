<script lang="ts">
	import { page } from '$app/state';

	let { hideSuggestions = false }: { hideSuggestions?: boolean } = $props();

	const allItems = [
		{ href: '/', label: 'Fil', d: 'M4 6h16M4 12h16M4 18h9' },
		{
			href: '/bibliotheque',
			label: 'Bibliothèque',
			d: 'M4 5.5h5v14H4zM10.5 5.5h5v14h-5zM17 4l3 1-3 14-3-1z'
		},
		{
			href: '/suggestions',
			label: 'Pour vous',
			d: 'M11 4l1.7 4.8 4.8 1.7-4.8 1.7L11 17l-1.7-4.8L4.5 10.5l4.8-1.7zM17.5 14.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z'
		},
		{
			href: '/recherche',
			label: 'Recherche',
			d: 'M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z'
		},
		{
			href: '/profil',
			label: 'Profil',
			d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z'
		}
	];

	const items = $derived(
		hideSuggestions ? allItems.filter((i) => i.href !== '/suggestions') : allItems
	);

	function isActive(href: string): boolean {
		if (href === '/bibliotheque') {
			return ['/bibliotheque', '/series', '/films', '/livres'].some((prefix) => page.url.pathname.startsWith(prefix));
		}
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}
</script>

<!-- Fond opaque plutot qu'un flou : la barre est fixe, et re-flouter ce qui
	 defile dessous coute une recomposition a chaque image, ce qui se sent
	 immediatement sur telephone. -->
<nav class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg"
	style="padding-bottom: env(safe-area-inset-bottom)">
	<div class="mx-auto flex max-w-2xl">
		{#each items as item (item.href)}
			<a
				href={item.href}
				class="flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium transition-colors
					{isActive(item.href) ? 'text-brand' : 'text-mut hover:text-ink'}"
			>
				<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					<path d={item.d} />
				</svg>
				{item.label}
			</a>
		{/each}
	</div>
</nav>
