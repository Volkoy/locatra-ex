<script lang="ts">
	import { MapPin } from 'lucide-svelte';

	let {
		game,
		distance
	}: {
		game: {
			game_id: string;
			title: string;
			description: string | null;
			image_url: string | null;
		};
		distance: number | null;
	} = $props();
</script>

<a href="/play/{game.game_id}" class="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
	<!-- Thumbnail -->
	<div class="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
		{#if game.image_url}
			<img src={game.image_url} alt={game.title} class="h-full w-full object-cover" />
		{:else}
			<div class="flex h-full w-full items-center justify-center">
				<MapPin class="h-6 w-6 text-muted-foreground/40" />
			</div>
		{/if}
	</div>

	<!-- Content -->
	<div class="min-w-0 flex-1">
		<p class="truncate font-semibold text-dark-green">{game.title}</p>
		{#if distance !== null}
			<p class="text-xs text-muted-foreground">{distance.toFixed(1)} km away</p>
		{/if}
		{#if game.description}
			<p class="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{game.description}</p>
		{/if}
	</div>

	<!-- Arrow -->
	<span class="shrink-0 text-muted-foreground">›</span>
</a>
