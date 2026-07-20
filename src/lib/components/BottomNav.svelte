<script lang="ts">
	import { page } from '$app/state';

	let { hideSuggestions = false }: { hideSuggestions?: boolean } = $props();

	const allItems = [
		{ href: '/', label: 'Fil', d: 'M4 6h16M4 12h16M4 18h9' },
		{
			href: '/series',
			label: 'Séries',
			d: 'M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z'
		},
		{
			href: '/films',
			label: 'Films',
			d: 'M3.5 4.5h17v15h-17zM7.5 4.5v15M16.5 4.5v15M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4'
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
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}
</script>

<nav class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur"
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
