<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft, BookOpen } from 'lucide-svelte';

	let { data } = $props();
	let { game, game_id, stories } = $derived(data);
</script>

<svelte:head>
	<title>Stories — {game.title}</title>
</svelte:head>

<div class="flex min-h-screen bg-primary-foreground">
	<div
		class="mx-4 my-4 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-dark-green bg-white shadow-lg md:mx-auto"
	>
		<!-- Back button -->
		<div class="flex items-center gap-2 p-2">
			<Button variant="ghost" size="sm" href="/play/{game_id}" class="gap-1">
				<ArrowLeft class="size-4" />
				Back
			</Button>
		</div>

		<!-- Title -->
		<div class="flex items-center gap-3 border-b border-dark-green px-5 py-4">
			<BookOpen class="size-5 shrink-0 text-dark-green" />
			<h1 class="text-xl font-bold">Stories from {game.title}</h1>
		</div>

		<!-- Story list -->
		<div class="flex-1 overflow-y-auto p-4">
			{#if stories.length === 0}
				<div class="flex flex-col items-center justify-center py-16 text-muted-foreground">
					<BookOpen class="mb-3 size-10 opacity-30" />
					<p class="font-medium">No public stories yet</p>
					<p class="mt-1 text-sm">Be the first to complete and share your story!</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each stories as story (story.story_id)}
						<div class="rounded-xl border p-4 transition-colors hover:bg-muted/20">
							<div class="flex items-start gap-4">
								<!-- Avatar -->
								{#if story.character?.image_url}
									<img
										src={story.character.image_url}
										alt={story.character_name}
										class="size-12 shrink-0 rounded-full object-cover"
									/>
								{:else}
									<div
										class="flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-bold"
										style="background-color: {story.character?.bg_color ?? '#0f342a'}; color: {story.character?.text_color ?? '#ffffff'}"
									>
										{story.character_name.charAt(0)}
									</div>
								{/if}

								<div class="min-w-0 flex-1">
									<p class="text-xs text-muted-foreground">{story.character_name}</p>
									<p class="font-semibold">{story.title}</p>
									{#if story.excerpt}
										<p class="mt-1 line-clamp-3 text-sm text-muted-foreground">{story.excerpt}</p>
									{/if}
									<Button size="sm" variant="outline" class="mt-3" href="/stories/{story.story_id}">
										Read more
									</Button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
