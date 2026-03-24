<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { X } from 'lucide-svelte';

	let {
		poi,
		card,
		canDeepen,
		currentHeroStep,
		poiId,
		onClose,
		onSaved
	}: {
		poi: { name: string; type: string | null; image_url: string | null } | null;
		card: { id: number; title: string | null; prompt: string | null } | null;
		canDeepen: boolean;
		currentHeroStep: string | null;
		poiId: number;
		onClose: () => void;
		onSaved: () => void;
	} = $props();

	const HERO_STEP_LABELS: Record<string, string> = {
		call_to_adventure: 'Call to Adventure',
		crossing_the_threshold: 'Crossing the Threshold',
		meeting_the_mentor: 'Meeting the Mentor',
		trials_and_growth: 'Trials & Growth',
		death_and_transformation: 'Death & Transformation',
		change_and_return: 'Change & Return'
	};

	const TYPE_LABELS: Record<string, string> = {
		action: 'Action',
		sense: 'Sense',
		landmark: 'Landmark',
		history: 'History',
		nature: 'Nature'
	};

	let segmentType = $state<'step' | 'deepening'>('step');
	let content = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state('');

	let heroStepLabel = $derived(
		currentHeroStep ? HERO_STEP_LABELS[currentHeroStep] ?? currentHeroStep : null
	);
</script>

<div
	class="fixed inset-0 z-50 flex flex-col bg-background md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-[420px] md:border-l md:shadow-2xl"
	role="dialog"
	aria-modal="true"
>
	<!-- Top bar -->
	<div class="shrink-0 border-b bg-white">
		<div class="flex items-center gap-3 px-4 py-3">
			<Button variant="ghost" size="sm" onclick={onClose} class="shrink-0 p-1">
				<X class="h-5 w-5" />
			</Button>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">Write the next part of your story</p>
			</div>
			{#if heroStepLabel}
				<span class="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
					{heroStepLabel}
				</span>
			{/if}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto">
		<!-- POI image -->
		<div class="relative aspect-video w-full bg-muted">
			{#if poi?.image_url}
				<img src={poi.image_url} alt={poi.name} class="h-full w-full object-cover" />
			{/if}
			<div class="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 p-4">
				<h2 class="text-xl font-bold text-white">{poi?.name ?? ''}</h2>
				{#if poi?.type}
					<span class="mt-1 inline-block w-fit rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
						{TYPE_LABELS[poi.type] ?? poi.type}
					</span>
				{/if}
			</div>
		</div>

		<div class="space-y-4 px-4 py-4">
			<!-- Card prompt -->
			{#if card}
				<div class="rounded-lg border bg-card p-4">
					<h3 class="font-bold">{card.title}</h3>
					{#if card.prompt}
						<p class="mt-2 text-sm leading-relaxed text-muted-foreground">{card.prompt}</p>
					{/if}
				</div>
			{/if}

			<!-- Deepen/advance choice -->
			{#if canDeepen}
				<div class="space-y-2">
					<p class="text-sm font-medium">How do you want to progress?</p>
					<div class="flex gap-2">
						<Button
							variant={segmentType === 'deepening' ? 'default' : 'outline'}
							size="sm"
							class="flex-1"
							onclick={() => (segmentType = 'deepening')}
						>
							Deepen this step
						</Button>
						<Button
							variant={segmentType === 'step' ? 'default' : 'outline'}
							size="sm"
							class="flex-1"
							onclick={() => (segmentType = 'step')}
						>
							Next step
						</Button>
					</div>
				</div>
			{/if}

			<!-- Writing form -->
			<form
				method="POST"
				action="?/saveSegment"
				use:enhance={() => {
					isSubmitting = true;
					errorMessage = '';
					return async ({ result, update }) => {
						isSubmitting = false;
						if (result.type === 'failure') {
							errorMessage = (result.data as any)?.message ?? 'Failed to save';
						} else {
							onSaved();
							await update();
						}
					};
				}}
			>
				<input type="hidden" name="poi_id" value={poiId} />
				<input type="hidden" name="segment_type" value={segmentType} />
				{#if card}
					<input type="hidden" name="card_id" value={card.id} />
				{/if}

				<Textarea
					name="content"
					bind:value={content}
					placeholder="Write your story here..."
					class="min-h-[200px]"
					required
				/>

				{#if errorMessage}
					<p class="mt-2 text-sm text-destructive">{errorMessage}</p>
				{/if}

				<div class="pb-8 pt-4">
					<Button type="submit" class="w-full" disabled={isSubmitting || !content.trim()}>
						{isSubmitting ? 'Saving...' : 'Submit'}
					</Button>
				</div>
			</form>
		</div>
	</div>
</div>
