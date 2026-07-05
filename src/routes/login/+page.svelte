<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Connexion — TV Time local</title>
</svelte:head>

<div class="flex min-h-[70vh] items-center justify-center">
	<form method="POST" use:enhance class="w-full max-w-sm rounded-2xl bg-card p-6">
		<p class="mb-1 text-center text-3xl">📺</p>
		<h1 class="mb-5 text-center text-xl font-bold">TV Time local</h1>
		<input
			type="password"
			name="password"
			placeholder="Mot de passe"
			autocomplete="current-password"
			class="mb-3 w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink placeholder:text-mut focus:border-brand focus:outline-none"
		/>
		{#if form?.incorrect}
			<p class="mb-3 text-sm text-red-400">Mot de passe incorrect.</p>
		{/if}
		<button class="w-full rounded-xl bg-brand py-3 font-semibold text-brand-ink hover:opacity-90">
			Se connecter
		</button>
	</form>
</div>
