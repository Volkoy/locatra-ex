<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Switch } from '$lib/components/ui/switch';
	import { Share2, Check, BookOpen } from 'lucide-svelte';

	let { data, form: formResult } = $props();
	let { session, segments, cards } = $derived(data);

	const HERO_STEP_LABELS: Record<string, string> = {
		introduction: 'Introduction',
		call_to_adventure: 'Call to Adventure',
		crossing_the_threshold: 'Crossing the Threshold',
		meeting_the_mentor: 'Meeting the Mentor',
		trials_and_growth: 'Trials & Growth',
		death_and_transformation: 'Death & Transformation',
		change_and_return: 'Change & Return',
		reflection: 'Reflection'
	};

	let storyTitle = $state(data.story?.title ?? '');
	let isPublic = $state(data.story?.is_public ?? false);
	let isSaving = $state(false);
	let savedStoryId = $state<string | null>(data.story?.story_id ?? null);
	let expandedSegmentId = $state<number | null>(null);

	$effect(() => {
		if (formResult && 'story_id' in formResult && formResult.story_id) {
			savedStoryId = formResult.story_id as string;
		}
	});

	let shareUrl = $derived(
		savedStoryId
			? `${typeof window !== 'undefined' ? window.location.origin : ''}/stories/${savedStoryId}`
			: null
	);

	type Segment = {
		id: number;
		segment_type: string;
		hero_step: string | null;
		card_id: number | null;
		content: string;
	};

	type Card = { id: number; title: string | null; prompt: string | null };

	type SessionWithCharacter = typeof session & { characters: { name: string; summary: string | null; image_url: string | null; bg_color: string; text_color: string } | null };

	const character = $derived((session as SessionWithCharacter).characters);
	const typedSegments = $derived(segments as Segment[]);
	const typedCards = $derived(cards as Card[]);

	function stepLabel(segment: Segment): string {
		if (segment.hero_step) return HERO_STEP_LABELS[segment.hero_step] ?? segment.hero_step;
		return HERO_STEP_LABELS[segment.segment_type] ?? segment.segment_type;
	}

	function cardPrompt(cardId: number | null): string | null {
		if (!cardId) return null;
		return typedCards.find((c) => c.id === cardId)?.prompt ?? null;
	}

	function cardTitle(cardId: number | null): string | null {
		if (!cardId) return null;
		return typedCards.find((c) => c.id === cardId)?.title ?? null;
	}
</script>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<div class="bg-dark-green px-4 py-8 text-white">
		<div class="mx-auto flex max-w-2xl items-center gap-3">
			<BookOpen class="size-7 shrink-0" />
			<h1 class="text-3xl font-bold">Your Final Story</h1>
		</div>
	</div>

	<div class="mx-auto max-w-2xl space-y-8 px-4 py-8">
		<!-- ── Share & publish panel ─────────────────────────────────── -->
		<div class="rounded-xl border bg-card p-5 shadow-sm">
			<!-- Toggle row -->
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="font-semibold">Make public & share</p>
					<p class="text-sm text-muted-foreground">
						Do you want to save your story and share with other players?
					</p>
				</div>
				<Switch
					aria-label="Make story public"
					checked={isPublic}
					onCheckedChange={(v) => (isPublic = v)}
				/>
			</div>

			{#if isPublic}
				<form
					method="POST"
					action="?/saveStory"
					use:enhance={() => {
						isSaving = true;
						return async ({ result, update }) => {
							isSaving = false;
							if (result.type === "success" && (result.data as { story_id?: string })?.story_id) {
								goto(`/stories/${(result.data as { story_id?: string }).story_id}`);
							} else {
								await update({ reset: false });
							}
						};
					}}
					class="mt-4 space-y-3"
				>
					<input type="hidden" name="is_public" value="true" />
					<Input name="title" placeholder="Give your story a title…" bind:value={storyTitle} />
					{#if formResult?.message}
						<p class="text-sm text-destructive">{formResult.message}</p>
					{/if}
					<Button type="submit" class="w-full" disabled={isSaving || !storyTitle.trim()}>
						{#if isSaving}
							Saving…
						{:else}
							<Share2 class="size-4" />
							Save & Share
						{/if}
					</Button>
				</form>

				{#if savedStoryId && shareUrl}
					<div class="mt-3 rounded-lg border bg-green-50 p-3">
						<div class="mb-2 flex items-center gap-2">
							<Check class="h-4 w-4 text-green-600" />
							<p class="text-sm font-medium text-green-700">Story saved!</p>
						</div>
						<div class="flex items-center gap-2">
							<code class="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{shareUrl}</code>
							<Button
								size="sm"
								variant="outline"
								aria-label="Copy link"
								onclick={() => navigator.clipboard?.writeText(shareUrl!)}
							>
								<Share2 class="h-3 w-3" />
							</Button>
						</div>
						<a href={shareUrl} class="mt-2 block">
							<Button variant="ghost" size="sm" class="w-full text-xs">View public story</Button>
						</a>
					</div>
				{/if}
			{:else}
				<div class="mt-4">
					<Button variant="outline" class="w-full" onclick={() => goto('/play')}>
						Return to games
					</Button>
				</div>
			{/if}
		</div>

		<!-- ── Character header + story (single bordered block) ─────── -->
		<div class="rounded-xl border bg-card shadow-sm">
			<!-- Character header -->
			<div class="flex items-start gap-5 border-b p-5">
				{#if character?.image_url}
					<img
						src={character.image_url}
						alt={session.character_name}
						class="size-24 shrink-0 rounded-full object-cover ring-2 ring-border"
					/>
				{:else}
					<div
						class="flex size-24 shrink-0 items-center justify-center rounded-full text-3xl font-bold ring-2 ring-border"
						style="background-color: {character?.bg_color ??
							'#0f342a'}; color: {character?.text_color ?? '#ffffff'}"
					>
						{session.character_name?.charAt(0) ?? '?'}
					</div>
				{/if}
				<div class="min-w-0 flex-1">
					<p class="text-xl font-bold">{session.character_name}</p>
					{#if character?.name}
						<p class="text-sm text-muted-foreground">as {character.name}</p>
					{/if}
					{#if character?.summary}
						<p class="mt-2 text-sm leading-relaxed text-muted-foreground">{character.summary}</p>
					{/if}
				</div>
			</div>

			<!-- Story segments -->
			<div class="space-y-2 p-4">
				{#each typedSegments as segment (segment.id)}
					{@const prompt = cardPrompt(segment.card_id)}
					{@const title = cardTitle(segment.card_id)}
					{@const isExpanded = expandedSegmentId === segment.id}
					<button
						type="button"
						aria-label="{isExpanded ? 'Hide' : 'Show'} details for {stepLabel(segment)}"
						class="w-full cursor-pointer rounded-lg p-4 text-left transition-colors hover:bg-muted/40"
						onclick={() => (expandedSegmentId = isExpanded ? null : segment.id)}
					>
						{#if isExpanded}
							<div class="mb-2 space-y-1">
								<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
									{stepLabel(segment)}
								</p>
								{#if prompt}
									<p class="text-sm text-muted-foreground italic">
										"{title ? title + ' — ' : ''}{prompt}"
									</p>
								{/if}
							</div>
						{/if}
						<p class="text-base leading-loose whitespace-pre-wrap text-foreground">
							{segment.content}
						</p>
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>
