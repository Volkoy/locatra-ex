<script lang="ts">
	import { X, Send } from 'lucide-svelte';
	import { tick } from 'svelte';

	type Message = { role: 'user' | 'assistant'; content: string };

	let {
		sessionId,
		nearbyPoiId,
		currentHeroStep,
		currentCard,
		companionName,
		companionAvatarUrl
	}: {
		sessionId: string;
		nearbyPoiId: number | null;
		currentHeroStep: string | null;
		currentCard: { id: number; title: string | null; prompt: string | null; type: string | null } | null;
		companionName: string;
		companionAvatarUrl: string | null;
	} = $props();

	let messages = $state<Message[]>([]);
	let input = $state('');
	let isOpen = $state(false);
	let isLoading = $state(false);
	let lastProactiveMessage = $state<string | null>(null);
	const proactivePoisSeen = new Set<number>();

	let messagesEl: HTMLElement | null = $state(null);

	async function scrollToBottom() {
		await tick();
		if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	async function fetchResponse(proactive: boolean) {
		isLoading = true;
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					messages,
					nearbyPoiId,
					currentHeroStep,
					currentCard,
					proactive
				})
			});
			const data = await res.json();
			if (data.message) {
				messages = [...messages, { role: 'assistant', content: data.message }];
				if (!isOpen) {
					lastProactiveMessage = data.message;
					setTimeout(() => (lastProactiveMessage = null), 3000);
				}
				scrollToBottom();
			}
		} catch (e) {
			console.error('Chat fetch error:', e);
		} finally {
			isLoading = false;
		}
	}

	async function send() {
		const text = input.trim();
		if (!text || isLoading) return;
		input = '';
		messages = [...messages, { role: 'user', content: text }];
		scrollToBottom();
		await fetchResponse(false);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function openChat() {
		isOpen = true;
		lastProactiveMessage = null;
		scrollToBottom();
	}

	// Proactive message when entering a new POI
	$effect(() => {
		if (nearbyPoiId !== null && !proactivePoisSeen.has(nearbyPoiId)) {
			proactivePoisSeen.add(nearbyPoiId);
			fetchResponse(true);
		}
	});

	const initial = companionName.charAt(0).toUpperCase();
</script>

<!-- Trigger button — placed in top bar by parent via absolute positioning -->
{#if !isOpen}
	<button
		onclick={openChat}
		class="relative flex size-8 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30 active:bg-white/40"
		aria-label="Open companion chat"
	>
		{#if companionAvatarUrl}
			<img src={companionAvatarUrl} alt={companionName} class="size-full rounded-full object-cover" />
		{:else}
			<span class="text-xs font-bold">{initial}</span>
		{/if}
		{#if lastProactiveMessage}
			<span class="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-dark-green bg-destructive"></span>
		{/if}
	</button>
{:else}
	<div class="size-8"></div>
{/if}

<!-- Speech bubble — below and to the right of the top-left button -->
{#if lastProactiveMessage && !isOpen}
	<div class="absolute top-16 left-2 z-30 w-64">
		<button onclick={openChat} class="w-full text-left" aria-label="Open companion chat">
			<div class="relative rounded-2xl border border-dark-green bg-white px-4 py-3 shadow-xl">
				<div class="mb-2 flex items-center gap-2">
					{#if companionAvatarUrl}
						<img src={companionAvatarUrl} alt={companionName} class="size-6 rounded-full object-cover" />
					{:else}
						<div class="flex size-6 shrink-0 items-center justify-center rounded-full bg-dark-green text-xs font-bold text-white">
							{initial}
						</div>
					{/if}
					<span class="text-xs font-semibold text-dark-green">{companionName}</span>
				</div>
				<p class="line-clamp-3 text-sm leading-relaxed text-foreground">{lastProactiveMessage}</p>
				<p class="mt-2 text-xs text-muted-foreground">Tap to reply…</p>
				<!-- Tail pointing up-left -->
				<div class="absolute -top-2 left-4">
					<div class="size-4 rotate-45 border-t border-l border-dark-green bg-white"></div>
				</div>
			</div>
		</button>
	</div>
{/if}

<!-- Full-screen chat overlay -->
{#if isOpen}
	<!-- Backdrop -->
	<div
		class="absolute inset-0 z-40 bg-black/30 backdrop-blur-sm"
		role="presentation"
		onclick={() => (isOpen = false)}
	></div>

	<!-- Chat panel — centered, almost full screen -->
	<div
		class="absolute inset-x-3 bottom-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-dark-green bg-white shadow-2xl"
		style="top: max(env(safe-area-inset-top, 0px) + 12px, 12px); max-height: calc(100vh - 24px);"
	>
		<!-- Header -->
		<div class="flex shrink-0 items-center gap-3 border-b border-dark-green bg-dark-green px-4 py-3">
			{#if companionAvatarUrl}
				<img
					src={companionAvatarUrl}
					alt={companionName}
					class="size-9 rounded-full object-cover ring-2 ring-white/30"
				/>
			{:else}
				<div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
					{initial}
				</div>
			{/if}
			<div class="flex-1">
				<p class="text-sm font-semibold text-white">{companionName}</p>
				<p class="text-xs text-white/70">Your guide</p>
			</div>
			<button onclick={() => (isOpen = false)} aria-label="Close chat" class="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white">
				<X class="size-5" />
			</button>
		</div>

		<!-- Messages -->
		<div
			bind:this={messagesEl}
			class="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
		>
			{#if messages.length === 0 && !isLoading}
				<div class="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
					{#if companionAvatarUrl}
						<img src={companionAvatarUrl} alt={companionName} class="size-16 rounded-full object-cover" />
					{:else}
						<div class="flex size-16 items-center justify-center rounded-full bg-dark-green text-2xl font-bold text-white">
							{initial}
						</div>
					{/if}
					<div>
						<p class="font-semibold text-foreground">{companionName}</p>
						<p class="mt-1 text-sm text-muted-foreground">Say hello to your guide!</p>
					</div>
				</div>
			{/if}
			{#each messages as msg (msg)}
				{#if msg.role === 'assistant'}
					<div class="flex items-end gap-2">
						<div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-dark-green text-xs font-bold text-white">
							{initial}
						</div>
						<div class="max-w-[80%] rounded-2xl rounded-bl-sm border border-dark-green/20 bg-muted/40 px-4 py-2.5 text-sm leading-relaxed">
							{msg.content}
						</div>
					</div>
				{:else}
					<div class="flex justify-end">
						<div class="max-w-[80%] rounded-2xl rounded-br-sm bg-dark-green px-4 py-2.5 text-sm leading-relaxed text-white">
							{msg.content}
						</div>
					</div>
				{/if}
			{/each}
			{#if isLoading}
				<div class="flex items-end gap-2">
					<div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-dark-green text-xs font-bold text-white">
						{initial}
					</div>
					<div class="rounded-2xl rounded-bl-sm border border-dark-green/20 bg-muted/40 px-4 py-3">
						<span class="flex gap-1">
							<span class="size-2 animate-bounce rounded-full bg-dark-green/50" style="animation-delay:0ms"></span>
							<span class="size-2 animate-bounce rounded-full bg-dark-green/50" style="animation-delay:150ms"></span>
							<span class="size-2 animate-bounce rounded-full bg-dark-green/50" style="animation-delay:300ms"></span>
						</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Input -->
		<div class="flex shrink-0 items-center gap-2 border-t border-dark-green/20 px-4 py-3">
			<input
				type="text"
				bind:value={input}
				onkeydown={onKeyDown}
				placeholder="Ask {companionName}…"
				class="flex-1 rounded-full border border-dark-green/30 bg-muted/20 px-4 py-2 text-sm outline-none focus:border-dark-green"
			/>
			<button
				onclick={send}
				disabled={!input.trim() || isLoading}
				class="flex size-9 shrink-0 items-center justify-center rounded-full bg-dark-green text-white disabled:opacity-40"
				aria-label="Send"
			>
				<Send class="size-4" />
			</button>
		</div>
	</div>
{/if}
