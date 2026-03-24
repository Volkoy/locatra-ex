<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	let {
		card,
		poi,
		onWrite
	}: {
		card: { title: string | null; prompt: string | null } | null;
		poi: { name: string; type: string } | null;
		onWrite: () => void;
	} = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
	role="dialog"
	aria-modal="true"
>
	<div class="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
		{#if poi}
			<div class="bg-slate-800 px-6 py-4 text-white">
				<p class="text-xs font-medium uppercase tracking-wide opacity-80">{poi.type}</p>
				<h3 class="mt-0.5 text-lg font-bold">{poi.name}</h3>
			</div>
		{/if}

		<div class="p-6">
			{#if card}
				<h4 class="mb-2 font-bold text-foreground">{card.title}</h4>
				<p class="leading-relaxed text-muted-foreground">{card.prompt}</p>
			{:else}
				<p class="text-muted-foreground">You've arrived at a new location. Time to write your story!</p>
			{/if}

			<Button class="mt-6 w-full" onclick={onWrite}>
				Write story
			</Button>
		</div>
	</div>
</div>
