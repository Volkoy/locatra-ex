<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	type Message = { role: 'user' | 'assistant'; content: string };

	let {
		sessionId,
		nearbyPoiId,
		currentHeroStep,
		currentCard,
		companionName,
		companionAvatarUrl,
		isOpen = $bindable(false),
		messages = $bindable<Message[]>([]),
		isLoading = $bindable(false)
	}: {
		sessionId: string;
		nearbyPoiId: number | null;
		currentHeroStep: string | null;
		currentCard: {
			id: number;
			title: string | null;
			prompt: string | null;
			type: string | null;
		} | null;
		companionName: string;
		companionAvatarUrl: string | null;
		isOpen?: boolean;
		messages?: Message[];
		isLoading?: boolean;
	} = $props();

	let lastProactiveMessage = $state<string | null>(null);
	const proactivePoisSeen = new SvelteSet<number>();

	// Context messages — sent to Groq but never shown in the UI.
	// Seeded once on mount (full game context), then appended with small deltas
	// (new POI arrived, new segment written) so the model always has up-to-date info
	// without re-fetching everything from the DB on every message.
	let contextMessages = $state<Message[]>([]);
	let contextInitialized = $state(false);

	const initial = companionName.charAt(0).toUpperCase();

	onMount(async () => {
		try {
			const res = await fetch(`/api/chat/init?sessionId=${encodeURIComponent(sessionId)}`);
			if (res.ok) {
				const data = (await res.json()) as { context?: string };
				if (data.context) {
					contextMessages = [
						{
							role: 'user',
							content: `[GAME CONTEXT — remember this throughout our conversation]\n${data.context}`
						}
					];
				}
			}
		} catch (e) {
			console.error('Context init error:', e);
		}
		contextInitialized = true;
	});

	async function fetchResponse(proactive: boolean, proactiveType?: 'poi' | 'segment') {
		isLoading = true;
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					contextMessages,
					messages,
					nearbyPoiId,
					currentHeroStep,
					currentCard,
					proactive,
					proactiveType
				})
			});
			const data = (await res.json()) as { message?: string };
			if (data.message) {
				messages = [...messages, { role: 'assistant', content: data.message }];
				if (!isOpen) {
					lastProactiveMessage = data.message;
					setTimeout(() => (lastProactiveMessage = null), 3000);
				}
			}
		} catch (e) {
			console.error('Chat fetch error:', e);
		} finally {
			isLoading = false;
		}
	}

	export async function send(text: string) {
		messages = [...messages, { role: 'user', content: text }];
		await fetchResponse(false);
	}

	export function openChat() {
		isOpen = true;
		lastProactiveMessage = null;
	}

	export async function commentOnSegment(content: string) {
		// Append delta: only the new segment, not the full story
		contextMessages = [
			...contextMessages,
			{ role: 'user', content: `[CONTEXT UPDATE] Player just wrote a new story segment: "${content}"` }
		];
		await fetchResponse(true, 'segment');
	}

	$effect(() => {
		if (!contextInitialized) return;
		if (nearbyPoiId !== null && !proactivePoisSeen.has(nearbyPoiId)) {
			proactivePoisSeen.add(nearbyPoiId);
			fetchResponse(true, 'poi');
		}
	});
</script>

<!-- Trigger button -->
<button
	onclick={openChat}
	class="relative flex size-11 items-center justify-center rounded-full bg-white text-dark-green transition-colors hover:bg-white/90 active:bg-white/80"
	aria-label="Open companion chat"
>
	{#if companionAvatarUrl}
		<img src={companionAvatarUrl} alt={companionName} class="size-full rounded-full object-cover" />
	{:else}
		<span class="text-sm font-bold">{initial}</span>
	{/if}
	{#if lastProactiveMessage}
		<span
			class="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-white bg-destructive"
		></span>
	{/if}
</button>

<!-- Speech bubble -->
{#if lastProactiveMessage && !isOpen}
	<div class="absolute top-14 left-2 z-30 w-64">
		<button onclick={openChat} class="w-full text-left" aria-label="Open companion chat">
			<div class="relative rounded-2xl border border-dark-green bg-white px-4 py-3 shadow-xl">
				<div class="mb-2 flex items-center gap-2">
					{#if companionAvatarUrl}
						<img
							src={companionAvatarUrl}
							alt={companionName}
							class="size-6 rounded-full object-cover"
						/>
					{:else}
						<div
							class="flex size-6 shrink-0 items-center justify-center rounded-full bg-dark-green text-xs font-bold text-white"
						>
							{initial}
						</div>
					{/if}
					<span class="text-xs font-semibold text-dark-green">{companionName}</span>
				</div>
				<p class="line-clamp-3 text-sm leading-relaxed text-foreground">{lastProactiveMessage}</p>
				<p class="mt-2 text-xs text-muted-foreground">Tap to reply…</p>
				<div class="absolute -top-2 left-4">
					<div class="size-4 rotate-45 border-t border-l border-dark-green bg-white"></div>
				</div>
			</div>
		</button>
	</div>
{/if}
