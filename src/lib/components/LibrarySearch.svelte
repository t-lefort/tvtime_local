<script lang="ts">
	/**
	 * Filtre texte d'une liste de la bibliothèque. Les paramètres courants
	 * (filtre, tri) voyagent en champs cachés pour survivre à la soumission.
	 */
	let {
		value,
		placeholder,
		hidden = {}
	}: { value: string; placeholder: string; hidden?: Record<string, string> } = $props();
</script>

<form method="GET" class="mb-3">
	{#each Object.entries(hidden) as [name, hiddenValue] (name)}
		<input type="hidden" {name} value={hiddenValue} />
	{/each}
	<input
		type="search"
		name="q"
		{value}
		{placeholder}
		autocomplete="off"
		enterkeyhint="search"
		class="w-full rounded-xl border border-line bg-card px-4 py-3 text-ink placeholder:text-mut focus:border-brand focus:outline-none"
	/>
</form>
