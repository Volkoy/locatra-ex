<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import Button from '../ui/button/button.svelte';

	type Message = { role: 'user' | 'assistant'; content: string };

	let {
		sessionId,
		nearbyPoiId,
		focusedPoiId,
		currentHeroStep,
		currentCard,
		companionName,
		companionAvatarUrl,
		proactivePoisSeen,
		isOpen = $bindable(false),
		messages = $bindable<Message[]>([]),
		isLoading = $bindable(false)
	}: {
		sessionId: string;
		nearbyPoiId: number | null;
		focusedPoiId: number | null;
		currentHeroStep: string | null;
		currentCard: {
			id: number;
			title: string | null;
			prompt: string | null;
			type: string | null;
		} | null;
		companionName: string;
		companionAvatarUrl: string | null;
		proactivePoisSeen: Set<string>;
		isOpen?: boolean;
		messages?: Message[];
		isLoading?: boolean;
	} = $props();

	let lastProactiveMessage = $state<string | null>(null);

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
		// Capture at request time — used to discard stale POI reactions if the player moves on
		const poiIdAtRequest = nearbyPoiId;
		// For manual messages: fall back to focusedPoiId (selected/nearest) when not yet in unlock radius
		const chatPoiId = proactive ? poiIdAtRequest : (poiIdAtRequest ?? focusedPoiId);
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					contextMessages,
					messages,
					nearbyPoiId: chatPoiId,
					currentHeroStep,
					currentCard,
					proactive,
					proactiveType
				})
			});
			const data = (await res.json()) as { message?: string };
			// Discard POI proactive responses that arrived after the player changed location
			if (proactiveType === 'poi' && nearbyPoiId !== poiIdAtRequest) return;
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
			{
				role: 'user',
				content: `[CONTEXT UPDATE] Player just wrote a new story segment: "${content}"`
			}
		];
		await fetchResponse(true, 'segment');
	}

	$effect(() => {
		if (!contextInitialized) return;
		if (nearbyPoiId !== null) {
			const key = `${nearbyPoiId}-${currentHeroStep ?? 'none'}`;
			if (!proactivePoisSeen.has(key)) {
				proactivePoisSeen.add(key);
				fetchResponse(true, 'poi');
			}
		}
	});
</script>

<!-- Trigger button -->
<Button
	onclick={openChat}
	size="icon-xl"
	variant="default"
	class="relative rounded-full border-2 border-white shadow-lg transition-transform hover:scale-110 focus:ring-2 focus:ring-dark-green focus:ring-offset-2 focus:outline-none"
	aria-label="Open companion chat"
>
	{#if companionAvatarUrl}
		<img src={companionAvatarUrl} alt={companionName} class="size-full rounded-full object-cover" />
	{:else}
		<span class="text-lg font-bold">{initial}</span>
	{/if}
	{#if lastProactiveMessage}
		<span
			class="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-white bg-destructive"
		></span>
	{/if}
</Button>

<!-- Speech bubble -->
{#if lastProactiveMessage && !isOpen}
	<div class="absolute top-16 left-0 z-30 w-72 pl-1">
		<button
			onclick={openChat}
			class="group relative w-full rounded-2xl border-2 border-dark-green bg-white p-4 text-left shadow-xl transition-transform hover:scale-105 focus:ring-2 focus:ring-dark-green focus:ring-offset-1 focus:outline-none"
			aria-label="Open companion chat"
		>
			<div class="mb-3 flex items-center gap-2">
				{#if companionAvatarUrl}
					<img
						src={companionAvatarUrl}
						alt={companionName}
						class="size-7 flex-shrink-0 rounded-full object-cover"
					/>
				{:else}
					<div
						class="flex size-7 shrink-0 items-center justify-center rounded-full bg-dark-green text-xs font-bold text-white"
					>
						{initial}
					</div>
				{/if}
				<span class="text-sm font-bold text-dark-green">{companionName}</span>
			</div>
			<p class="mb-2 line-clamp-3 text-sm leading-relaxed text-foreground">
				{lastProactiveMessage}
			</p>
			<p class="text-xs font-medium text-dark-green/70">Tap to reply →</p>
			<!-- Arrow pointing up-left to button -->
			<!-- Arrow: outer dark-green triangle + inner white triangle for bordered look -->
			<div class="absolute -top-[9px] left-4 h-[9px] w-3">
				<div class="absolute top-0 left-[6px] size-0 border-b-[9px] border-r-[6px] border-l-[6px] border-b-dark-green border-r-transparent border-l-transparent"></div>
				<div class="absolute top-[2px] left-[6px] size-0 border-b-[7px] border-r-[5px] border-l-[5px] border-b-white border-r-transparent border-l-transparent"></div>
			</div>
		</button>
	</div>
{/if}
