<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { ArrowLeft } from 'lucide-svelte';
	import CharacterCarousel from '$lib/components/play/character-carousel.svelte';

	let { data, form: formResult } = $props();
	let { game, characters, playMode } = $derived(data);

	let currentIndex = $state(0);
	let characterName = $state('');
	let characterDescription = $state('');
	let isSubmitting = $state(false);

	let selectedCharacter = $derived(characters[currentIndex]);
</script>

<div class="flex h-[calc(100svh-var(--app-nav-height,0px))] bg-primary-foreground">
	<div
		class="mx-4 my-4 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-dark-green bg-white shadow-lg md:mx-auto"
	>
		<!-- Back button -->
		<div class="shrink-0 px-2 py-2">
			<Button variant="ghost" size="sm" href="/play/{game.game_id}" class="gap-1">
				<ArrowLeft class="h-4 w-4" />
				Back
			</Button>
		</div>

		<!-- Scrollable content -->
		<div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
			<!-- Title -->
			<div class="px-6 pt-6 pb-2">
				<h1 class="text-2xl font-bold text-dark-green">Select your character</h1>
				<p class="mt-1 text-sm text-muted-foreground">Choose who you'll become in this story</p>
			</div>

			<!-- Carousel — full bleed -->
			<CharacterCarousel {characters} bind:currentIndex />

			<!-- Form -->
			<form
				method="POST"
				class="flex flex-1 flex-col px-6 pb-6"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
			>
				<!-- Hidden inputs -->
				<input type="hidden" name="play_mode" value={playMode} />
				<input type="hidden" name="character_id" value={selectedCharacter?.character_id ?? ''} />

				<div class="space-y-4">
					<!-- Name -->
					<div class="space-y-1.5">
						<label for="character_name" class="text-sm font-medium">Your name</label>
						<Input
							id="character_name"
							name="character_name"
							placeholder="What should we call you?"
							bind:value={characterName}
							required
						/>
					</div>

					<!-- Description -->
					<div class="space-y-1.5">
						<label for="character_description" class="text-sm font-medium"
							>Your backstory <span class="font-normal text-muted-foreground">(optional)</span
							></label
						>
						<textarea
							id="character_description"
							name="character_description"
							placeholder="A few words about who you are in this story…"
							bind:value={characterDescription}
							rows={3}
							class="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-dark-green focus:ring-2 focus:ring-dark-green/30 focus:outline-none"
						></textarea>
					</div>
				</div>

				{#if formResult?.message}
					<p class="mt-3 text-sm text-destructive">{formResult.message}</p>
				{/if}

				<!-- Submit -->
				<div class="mt-auto pt-6">
					<Button
						type="submit"
						class="w-full"
						disabled={isSubmitting || characters.length === 0 || !characterName.trim()}
					>
						{isSubmitting ? 'Starting…' : 'Start game'}
					</Button>
				</div>
			</form>
		</div>
	</div>
</div>
