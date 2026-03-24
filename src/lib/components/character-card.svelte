<script lang="ts">
	import { User } from 'lucide-svelte';

	type Props = {
		character: {
			name: string | null;
			summary: string | null;
			image_url: string | null;
			category: string | null;
			color?: string | null;
		};
	};

	let { character }: Props = $props();
</script>

<div class="flex aspect-[2/3] w-72 flex-col overflow-hidden rounded-xl border-8 border-white shadow-md outline-2 outline-gray-200">
	<div class="aspect-square w-full overflow-hidden bg-gray-100">
		{#if character.image_url}
			<img
				src={character.image_url}
				alt={character.name ?? ''}
				class="h-full w-full object-cover"
			/>
		{:else}
			<div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
				<User class="h-16 w-16 text-gray-400" />
			</div>
		{/if}
	</div>
	<div class="flex flex-1 flex-col items-center bg-white px-3 pb-3 pt-2 text-center">
		{#if character.category}
			<span class="mb-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium uppercase text-gray-600">
				{character.category}
			</span>
		{/if}
		<h3 class="font-semibold text-gray-900">{character.name ?? 'Unknown'}</h3>
		{#if character.summary}
			<p class="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-600">{character.summary}</p>
		{/if}
	</div>
</div>
