<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { page } from '$app/state';

	let { data, children } = $props();
	// Pas de navigation avant d'être connecté à un profil (sélecteur, connexion profil)
	const hideNav = $derived(page.url.pathname.startsWith('/profils'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<main class="mx-auto w-full max-w-2xl px-4 pt-5 pb-28 md:max-w-4xl lg:max-w-6xl md:px-6">
	{@render children()}
</main>

{#if !hideNav}
	<BottomNav hideSuggestions={data.hideSuggestions} />
{/if}
