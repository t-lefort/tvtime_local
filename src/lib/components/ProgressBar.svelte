<script lang="ts">
	let { value, max }: { value: number; max: number } = $props();
	const pct = $derived(max > 0 ? Math.min(100, (value / max) * 100) : 0);
</script>

<div class="h-1.5 w-full overflow-hidden rounded-full bg-line/80">
	<div class="h-full rounded-full bg-brand transition-[width]" style="width: {pct}%"></div>
</div>
